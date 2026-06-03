//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

/* Amplify Params - DO NOT EDIT
	ENV
	REGION
Amplify Params - DO NOT EDIT */

import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
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

const BASE_MODEL_ID = parameters.BedrockModelId || "anthropic.claude-haiku-4-5-20251001-v1:0";
const BEDROCK_REGION = parameters.BedrockRegion || process.env.REGION || process.env.AWS_REGION;

/**
 * Resolve model ID: Amazon models don't need geo prefix, third-party models do.
 */
const resolveModelId = (baseModelId, region) => {
  if (baseModelId.startsWith('amazon.')) return baseModelId;
  const getGeoPrefix = (r) => {
    if (!r) return 'us';
    if (r.startsWith('eu-')) return 'eu';
    if (r.startsWith('us-') || r.startsWith('ca-')) return 'us';
    if (r.startsWith('ap-southeast-2') || r.startsWith('ap-southeast-4')) return 'au';
    if (r.startsWith('ap-northeast-1') || r.startsWith('ap-northeast-3')) return 'jp';
    return 'us';
  };
  return `${getGeoPrefix(region)}.${baseModelId}`;
};

const BEDROCK_MODEL_ID = resolveModelId(BASE_MODEL_ID, BEDROCK_REGION);

const FAIL_OPEN_RESPONSE = { adequate: true, suggestion: null };

/**
 * Builds the justification evaluation prompt.
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
 * Invokes Bedrock using the Converse API (model-agnostic).
 */
const invokeBedrockModel = async (prompt) => {
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const command = new ConverseCommand({
    modelId: BEDROCK_MODEL_ID,
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 256 },
  });

  const response = await client.send(command);
  const textContent = response.output?.message?.content
    ?.filter(block => block.text)
    ?.map(block => block.text)
    ?.join('') || '';
  return textContent;
};

/**
 * Parses the Bedrock response into the expected format.
 */
export const parseResponse = (responseText) => {
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
    console.error("Justification check failed (fail-open):", error.message);
    return FAIL_OPEN_RESPONSE;
  }
};
