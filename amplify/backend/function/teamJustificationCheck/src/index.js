//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load parameters
const parametersPath = resolve(process.cwd(), "parameters.json");
let parameters = {};
try {
  parameters = JSON.parse(readFileSync(parametersPath, "utf-8"));
} catch (e) {
  console.warn("Could not load parameters.json:", e.message);
}

const BEDROCK_MODEL_ID = parameters.BedrockModelId || "anthropic.claude-3-haiku-20240307-v1:0";
const BEDROCK_REGION = parameters.BedrockRegion || process.env.REGION || process.env.AWS_REGION;

const FAIL_OPEN_RESPONSE = { adequate: true, suggestion: null };

/**
 * Builds the justification evaluation prompt.
 * Uses medium-low tolerance threshold to avoid productivity issues.
 */
export const buildJustificationPrompt = (justification, accountName, role) => {
  return `You are evaluating the quality of a justification provided for an AWS elevated access request.

Request Context:
- Account: ${accountName}
- Role: ${role}
- Justification: "${justification}"

Evaluate whether this justification adequately explains WHY the requester needs this specific elevated access. Apply a MEDIUM-LOW tolerance threshold (be lenient — only flag clearly insufficient justifications).

A justification is ADEQUATE if it:
- Provides any meaningful context about the task or reason (even briefly)
- References a ticket, incident, project, or specific activity
- Explains what needs to be done, even in general terms

A justification is INADEQUATE only if it:
- Is completely generic with no context (e.g., "need access", "testing", "work")
- Contains only the role or account name restated
- Is nonsensical or clearly placeholder text
- Provides zero indication of the actual task or purpose

Respond with ONLY a JSON object in this exact format:
{
  "adequate": true or false,
  "suggestion": null or "a brief, helpful suggestion for improvement"
}

When adequate is true, suggestion must be null.
When adequate is false, provide a short, constructive suggestion (1 sentence max).
Return ONLY the JSON object, no additional text.`;
};

/**
 * Invokes Bedrock with the justification evaluation prompt.
 */
const invokeBedrockModel = async (prompt) => {
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
};

/**
 * Parses the Bedrock response into the expected format.
 * Returns fail-open response if parsing fails.
 */
export const parseResponse = (responseText) => {
  // Extract JSON from the response (handle potential markdown code blocks)
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  if (typeof parsed.adequate !== "boolean") {
    throw new Error("Invalid response: adequate must be a boolean");
  }

  return {
    adequate: parsed.adequate,
    suggestion: parsed.adequate ? null : (parsed.suggestion || null),
  };
};

/**
 * Lambda handler for justification quality check.
 * Receives GraphQL arguments and returns evaluation result.
 * CRITICAL: On ANY failure, returns fail-open response (never blocks submission).
 */
export const handler = async (event) => {
  try {
    const { justification, accountName, role } = event.arguments;

    if (!justification || !justification.trim()) {
      return FAIL_OPEN_RESPONSE;
    }

    const prompt = buildJustificationPrompt(justification, accountName, role);
    const responseText = await invokeBedrockModel(prompt);
    const result = parseResponse(responseText);

    return result;
  } catch (error) {
    // Fail-open: on ANY error, return adequate=true so submission is never blocked
    console.error("Justification check failed (fail-open):", error.message);
    return FAIL_OPEN_RESPONSE;
  }
};
