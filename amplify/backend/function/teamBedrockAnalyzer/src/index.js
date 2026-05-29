//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

/* Amplify Params - DO NOT EDIT
	API_TEAM_GRAPHQLAPIENDPOINTOUTPUT
	API_AWSPIM_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
	BEDROCK_AUDIT_ENABLED
	BEDROCK_MODEL_ID
	BEDROCK_REGION
	ATHENA_ROLE_ARN
	ATHENA_WORKGROUP
	ATHENA_DATABASE
	ATHENA_TABLE
	ATHENA_RESULTS_BUCKET
Amplify Params - DO NOT EDIT */

import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const { Sha256 } = crypto;

// Environment configuration
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

// Bedrock configuration (from parameters.json via CloudFormation env vars)
const BEDROCK_AUDIT_ENABLED = process.env.BEDROCK_AUDIT_ENABLED === 'true';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const BEDROCK_REGION = process.env.BEDROCK_REGION || REGION;

// Athena configuration
const ATHENA_ROLE_ARN = process.env.ATHENA_ROLE_ARN;
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP || 'team-audit';
const ATHENA_DATABASE = process.env.ATHENA_DATABASE;
const ATHENA_TABLE = process.env.ATHENA_TABLE;
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET;

// Maximum tokens for Bedrock response
const MAX_TOKENS = 4096;

// Athena query polling interval (ms)
const ATHENA_POLL_INTERVAL = 1000;

/**
 * Parse the incoming event to extract sessionId and requestId.
 * Supports two invocation sources:
 * 1. GraphQL (AppSync @function): event.arguments.sessionId, event.arguments.requestId
 * 2. EventBridge Scheduler (auto-analysis): event.sessionId, event.requestId, event.source === "auto-analysis"
 */
export const parseEvent = (event) => {
  // EventBridge Scheduler invocation (auto-analysis)
  if (event.source === 'auto-analysis') {
    return {
      sessionId: event.sessionId,
      requestId: event.requestId,
      source: 'auto-analysis',
    };
  }

  // GraphQL (AppSync @function) invocation
  if (event.arguments) {
    return {
      sessionId: event.arguments.sessionId,
      requestId: event.arguments.requestId,
      source: 'graphql',
    };
  }

  throw new Error('Unable to parse event: unrecognized invocation source');
};

/**
 * Execute a signed GraphQL request against the AppSync API.
 * Uses IAM (SigV4) signing, matching the pattern in teamgetLogs and teamStatus.
 *
 * @param {string} graphqlQuery - The GraphQL query/mutation string
 * @param {Object} variables - The variables for the GraphQL operation
 * @returns {Object} The parsed response body from AppSync
 */
const executeGraphQL = async (graphqlQuery, variables) => {
  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: 'appsync',
    sha256: Sha256,
  });

  const requestToBeSigned = new HttpRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.host,
    },
    hostname: endpoint.host,
    body: JSON.stringify({ query: graphqlQuery, variables }),
    path: endpoint.pathname,
  });

  const signed = await signer.sign(requestToBeSigned);
  const request = new Request(endpoint, signed);

  const response = await fetch(request);
  const body = await response.json();

  if (body.errors) {
    console.error('GraphQL errors:', JSON.stringify(body.errors));
    throw new Error(`GraphQL request failed: ${body.errors[0]?.message || 'Unknown error'}`);
  }

  return body.data;
};

/**
 * Get session metadata from DynamoDB via GraphQL.
 * Queries the Sessions model by ID to retrieve session details needed for Athena query.
 *
 * @param {string} sessionId - The session ID to look up
 * @returns {Object} Session metadata with startTime, endTime, username, accountId, role
 */
export const getSessionFromDDB = async (sessionId) => {
  const graphqlQuery = /* GraphQL */ `
    query GetSessions($id: String!) {
      getSessions(id: $id) {
        id
        startTime
        endTime
        username
        accountId
        role
        approver_ids
        queryId
      }
    }
  `;

  const data = await executeGraphQL(graphqlQuery, { id: sessionId });

  if (!data?.getSessions) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return data.getSessions;
};

/**
 * Get request metadata from DynamoDB via GraphQL.
 * Queries the Requests model by ID to retrieve the justification text.
 *
 * @param {string} requestId - The request ID to look up
 * @returns {Object} Request metadata including justification
 */
export const getRequestFromDDB = async (requestId) => {
  const graphqlQuery = /* GraphQL */ `
    query GetRequests($id: ID!) {
      getRequests(id: $id) {
        id
        email
        accountId
        accountName
        role
        roleId
        startTime
        duration
        justification
        status
        username
      }
    }
  `;

  const data = await executeGraphQL(graphqlQuery, { id: requestId });

  if (!data?.getRequests) {
    throw new Error(`Request not found: ${requestId}`);
  }

  return data.getRequests;
};

// Escape single quotes for SQL string literals
export const escapeSql = (value) => value.replace(/'/g, "''");

// Escape LIKE pattern special characters and single quotes
export const escapeLike = (value) => value.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * Build partition filter for Athena query.
 * Generates date-based partition predicates (year, month, day) for the given time range and account.
 * Reuses the same logic as teamgetLogs buildPartitionFilter.
 */
export const buildPartitionFilter = (start, end, accountId) => {
  const filters = [];
  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear().toString();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    filters.push(`(year='${year}' AND month='${month}' AND day='${day}')`);
    current.setDate(current.getDate() + 1);
  }
  const dateFilter = filters.length > 0 ? `(${filters.join(' OR ')})` : '1=1';
  return `account_id = '${escapeSql(accountId)}' AND ${dateFilter}`;
};

/**
 * Build extended Athena SQL query for AI analysis.
 * Returns all 9 required columns: eventID, eventName, eventSource, eventTime,
 * requestparameters, responseelements, readonly, errorcode, sourceipaddress.
 * Uses the same WHERE clause filters as the existing buildAthenaQuery in teamgetLogs.
 */
export const buildExtendedAthenaQuery = (session) => {
  const { startTime, endTime, username, accountId, role } = session;
  const cleanUsername = username.replace('idc_', '');

  const start = new Date(startTime);
  const end = new Date(endTime);
  const partitionFilter = buildPartitionFilter(start, end, accountId);

  return `SELECT eventID, eventName, eventSource, eventTime, requestparameters, responseelements, readonly, errorcode, sourceipaddress
    FROM "${ATHENA_DATABASE}"."${ATHENA_TABLE}"
    WHERE ${partitionFilter}
      AND eventTime > '${escapeSql(startTime)}'
      AND eventTime < '${escapeSql(endTime)}'
      AND lower(useridentity.principalId) LIKE '%:${escapeLike(cleanUsername)}%'
      AND useridentity.sessionContext.sessionIssuer.arn LIKE '%${escapeLike(role)}%'`;
};

/**
 * Assume cross-account role for Athena access.
 * Reuses the same mechanism as teamgetLogs.
 */
const assumeCrossAccountRole = async () => {
  const stsClient = new STSClient({ region: REGION });
  const command = new AssumeRoleCommand({
    RoleArn: ATHENA_ROLE_ARN,
    RoleSessionName: 'team-athena-bedrock-analyzer',
    DurationSeconds: 900,
  });
  const response = await stsClient.send(command);
  return response.Credentials;
};

/**
 * Execute extended Athena query for AI analysis.
 * Assumes cross-account role, starts query, polls for completion, and retrieves results.
 */
export const executeExtendedAthenaQuery = async (session) => {
  // 1. Assume cross-account role
  const credentials = await assumeCrossAccountRole();
  const athenaClient = new AthenaClient({
    region: REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });

  // 2. Build and start the extended query
  const queryString = buildExtendedAthenaQuery(session);
  const startCommand = new StartQueryExecutionCommand({
    QueryString: queryString,
    WorkGroup: ATHENA_WORKGROUP,
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/team-query-results/`,
    },
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  // 3. Poll for query completion
  let status = 'RUNNING';
  while (status === 'QUEUED' || status === 'RUNNING') {
    await new Promise(resolve => setTimeout(resolve, ATHENA_POLL_INTERVAL));
    const pollCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });
    const pollResponse = await athenaClient.send(pollCommand);
    status = pollResponse.QueryExecution.Status.State;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query failed with status: ${status}`);
  }

  // 4. Retrieve query results
  const results = [];
  let nextToken = undefined;
  let isFirstPage = true;

  do {
    const getResultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
    });
    const resultsResponse = await athenaClient.send(getResultsCommand);
    const rows = resultsResponse.ResultSet.Rows;

    // Skip header row on first page
    const dataRows = isFirstPage ? rows.slice(1) : rows;
    isFirstPage = false;

    for (const row of dataRows) {
      const data = row.Data;
      results.push({
        eventID: data[0]?.VarCharValue || '',
        eventName: data[1]?.VarCharValue || '',
        eventSource: data[2]?.VarCharValue || '',
        eventTime: data[3]?.VarCharValue || '',
        requestparameters: data[4]?.VarCharValue || '',
        responseelements: data[5]?.VarCharValue || '',
        readonly: data[6]?.VarCharValue || '',
        errorcode: data[7]?.VarCharValue || '',
        sourceipaddress: data[8]?.VarCharValue || '',
      });
    }

    nextToken = resultsResponse.NextToken;
  } while (nextToken);

  return results;
};

/**
 * Build the analysis prompt for Bedrock.
 * Constructs a structured prompt with session context, justification text,
 * and CloudTrail events for AI analysis.
 *
 * @param {Array} events - CloudTrail events from Athena query
 * @param {string} justification - Session justification text (included verbatim)
 * @param {Object} session - Session metadata (accountId, role, username, startTime, endTime)
 * @returns {string} The complete prompt string for Bedrock invocation
 */
export const buildAnalysisPrompt = (events, justification, session) => {
  return `You are a cloud security expert analyzing an AWS session.

Session Context:
- Account: ${session.accountId}
- Role: ${session.role}
- User: ${session.username}
- Duration: ${session.startTime} to ${session.endTime}
- Justification: "${justification}"

CloudTrail Events (${events.length} total):
${JSON.stringify(events, null, 2)}

Provide analysis in the following JSON structure:
{
  "summary": {
    "description": "Brief summary of actions performed, prioritizing write/mutating actions",
    "serviceBreakdown": [{"service": "...", "actions": ["..."], "count": N}]
  },
  "coherenceCheck": {
    "status": "consistent|inconsistent|insufficient_justification",
    "reasoning": "Explain your assessment",
    "findings": [{"action": "...", "explanation": "..."}]
  },
  "securityReview": {
    "findings": [{"severity": "HIGH", "eventName": "...", "resource": "...", "description": "..."}]
  }
}

Rules:
- For coherenceCheck: If the justification lacks sufficient detail/specificity to meaningfully compare against actions, set status to "insufficient_justification". Do NOT rely solely on length.
- For securityReview: Only report HIGH criticality NEW misconfigurations introduced in this session (e.g., 0.0.0.0/0 security groups, public S3 buckets, disabled encryption, overly permissive IAM policies).
- Focus coherence analysis on destructive/high-impact actions (delete, terminate, modify security).
- Return ONLY the JSON object, no additional text.`;
};

/**
 * Sleep utility for retry backoff.
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Truncate events to reduce prompt size, keeping most recent write events.
 * Used when the prompt exceeds the model's context window.
 *
 * @param {Array} events - CloudTrail events array
 * @returns {Array} Truncated events array prioritizing recent write events
 */
export const truncateEvents = (events) => {
  // Separate write and read events
  const writeEvents = events.filter(e => e.readonly === 'false' || e.readonly === false);
  const readEvents = events.filter(e => e.readonly !== 'false' && e.readonly !== false);

  // Sort by eventTime descending (most recent first)
  const sortByTime = (a, b) => (b.eventTime || '').localeCompare(a.eventTime || '');
  writeEvents.sort(sortByTime);
  readEvents.sort(sortByTime);

  // Keep all write events (up to half the original size), fill rest with recent reads
  const maxEvents = Math.max(Math.floor(events.length / 2), 1);
  const keptWrites = writeEvents.slice(0, maxEvents);
  const remainingSlots = Math.max(maxEvents - keptWrites.length, 0);
  const keptReads = readEvents.slice(0, remainingSlots);

  return [...keptWrites, ...keptReads].sort(sortByTime);
};

/**
 * Invoke Amazon Bedrock model with the analysis prompt.
 * Creates a BedrockRuntimeClient, builds the InvokeModel request with anthropic_version,
 * max_tokens, and messages. Enforces maxTokens limit (Property 8).
 * Implements retry with exponential backoff for ThrottlingException (max 3 retries).
 * Handles token limit exceeded by truncating events (keeping most recent write events) and retrying.
 *
 * @param {string} prompt - The analysis prompt to send to Bedrock
 * @returns {string} The text content from the Bedrock response
 */
export const invokeBedrockModel = async (prompt) => {
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const maxRetries = 3;
  let currentPrompt = prompt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const requestBody = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: currentPrompt,
        },
      ],
    });

    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: requestBody,
    });

    try {
      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      // Extract text content from the Anthropic Messages API response
      const textContent = responseBody.content
        ?.filter(block => block.type === 'text')
        ?.map(block => block.text)
        ?.join('') || '';
      return textContent;
    } catch (error) {
      // Handle ThrottlingException with exponential backoff
      if (error.name === 'ThrottlingException' || error.__type === 'ThrottlingException') {
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.warn(`Bedrock throttled (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`Bedrock invocation failed after ${maxRetries + 1} attempts: ThrottlingException`);
      }

      // Handle token/input limit exceeded by truncating events and retrying
      if (
        error.name === 'ValidationException' &&
        error.message?.toLowerCase().includes('too many input tokens')
      ) {
        if (attempt < maxRetries) {
          console.warn(`Input too large (attempt ${attempt + 1}/${maxRetries + 1}), truncating events and retrying...`);
          // Extract events JSON from prompt and truncate
          const eventsMatch = currentPrompt.match(/CloudTrail Events \(\d+ total\):\n([\s\S]*?)\n\nProvide analysis/);
          if (eventsMatch) {
            try {
              const events = JSON.parse(eventsMatch[1]);
              const truncatedEvents = truncateEvents(events);
              currentPrompt = currentPrompt.replace(
                /CloudTrail Events \(\d+ total\):\n[\s\S]*?\n\nProvide analysis/,
                `CloudTrail Events (${truncatedEvents.length} total, truncated from original):\n${JSON.stringify(truncatedEvents, null, 2)}\n\nProvide analysis`
              );
              continue;
            } catch (parseError) {
              // If we can't parse/truncate events, propagate the original error
              throw new Error('Failed to parse AI response: input too large and events could not be truncated');
            }
          }
          throw new Error('Failed to parse AI response: input too large and events could not be truncated');
        }
        throw new Error('Bedrock invocation failed: input too large even after truncation');
      }

      // Re-throw any other errors
      throw error;
    }
  }
};

/**
 * Parse and validate the Bedrock response.
 * Handles markdown code block wrapping, validates security findings structure,
 * preserves coherence check status, and sets boolean flags.
 *
 * @param {string} bedrockResponse - Raw text response from Bedrock (JSON string, possibly wrapped in markdown code blocks)
 * @returns {Object} Parsed analysis report with validated findings and boolean flags
 */
export const parseAnalysisResponse = (bedrockResponse) => {
  try {
    // Strip markdown code block wrapping if present (```json ... ``` or ``` ... ```)
    let jsonStr = bedrockResponse.trim();
    const codeBlockMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and filter security findings: only keep HIGH severity with non-empty required fields
    let securityFindings = [];
    if (parsed.securityReview && Array.isArray(parsed.securityReview.findings)) {
      securityFindings = parsed.securityReview.findings.filter(finding =>
        finding.severity === 'HIGH' &&
        finding.eventName && finding.eventName.trim() !== '' &&
        finding.resource && finding.resource.trim() !== '' &&
        finding.description && finding.description.trim() !== ''
      );
    }

    // Preserve coherence check status exactly as returned
    const coherenceCheck = parsed.coherenceCheck || {};
    const coherenceStatus = coherenceCheck.status || '';
    let coherenceFindings = Array.isArray(coherenceCheck.findings) ? coherenceCheck.findings : [];

    // When status is "insufficient_justification", set findings to empty array
    if (coherenceStatus === 'insufficient_justification') {
      coherenceFindings = [];
    }

    // Set boolean flags
    const hasSecurityFindings = securityFindings.length > 0;
    const hasCoherenceFindings = coherenceFindings.length > 0;

    return {
      status: 'completed',
      summary: parsed.summary || null,
      coherenceCheck: {
        status: coherenceStatus,
        reasoning: coherenceCheck.reasoning || '',
        findings: coherenceFindings,
      },
      securityReview: {
        findings: securityFindings,
      },
      hasSecurityFindings,
      hasCoherenceFindings,
      error: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      error: 'Failed to parse AI response',
    };
  }
};

/**
 * Store the analysis report in DynamoDB via GraphQL.
 * Creates an AnalysisReport record with the session analysis results.
 *
 * @param {string} sessionId - The session ID this report belongs to
 * @param {Object} report - The parsed analysis report to store
 * @returns {Object} The created AnalysisReport record
 */
export const storeAnalysisReport = async (sessionId, requestId, report) => {
  const graphqlQuery = /* GraphQL */ `
    mutation CreateAnalysisReport($input: CreateAnalysisReportInput!) {
      createAnalysisReport(input: $input) {
        id
        sessionId
        requestId
        analyzedAt
        status
        summary
        coherenceCheck
        securityReview
        hasSecurityFindings
        hasCoherenceFindings
        error
      }
    }
  `;

  const input = {
    sessionId,
    requestId,
    analyzedAt: new Date().toISOString(),
    status: report.status,
    summary: report.summary ? JSON.stringify(report.summary) : null,
    coherenceCheck: report.coherenceCheck ? JSON.stringify(report.coherenceCheck) : null,
    securityReview: report.securityReview ? JSON.stringify(report.securityReview) : null,
    hasSecurityFindings: report.hasSecurityFindings || false,
    hasCoherenceFindings: report.hasCoherenceFindings || false,
    error: report.error || null,
  };

  const data = await executeGraphQL(graphqlQuery, { input });

  if (!data?.createAnalysisReport) {
    throw new Error('Failed to store analysis report');
  }

  return data.createAnalysisReport;
};

/**
 * Main Lambda handler.
 * Orchestrates the complete AI analysis flow for a session.
 * Triggered by GraphQL query (on-demand) or EventBridge Scheduler (auto-analysis).
 *
 * Flow: parse event → get session/request from DDB → execute extended Athena query →
 *       build prompt → invoke Bedrock → parse response → store report in DynamoDB
 *
 * Error handling:
 * - Athena failure: returns error status
 * - Bedrock failure: returns error status
 * - No Athena results: proceeds with empty events array (not a failure)
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // Check if Bedrock is enabled
  if (!BEDROCK_AUDIT_ENABLED) {
    return {
      status: 'failed',
      error: 'Bedrock AI audit feature is not enabled',
    };
  }

  try {
    // 1. Parse event to get sessionId and requestId
    const { sessionId, requestId, source } = parseEvent(event);
    console.log(`Processing analysis for session: ${sessionId}, request: ${requestId}, source: ${source}`);

    // 2. Get session and request metadata from DynamoDB
    const session = await getSessionFromDDB(sessionId);
    const request = await getRequestFromDDB(requestId);

    // 3. Execute extended Athena query
    let athenaResults = [];
    try {
      athenaResults = await executeExtendedAthenaQuery(session);
    } catch (athenaError) {
      console.error('Athena query failed:', athenaError);
      const errorReport = {
        status: 'failed',
        error: `Athena query failed: ${athenaError.message}`,
      };
      await storeAnalysisReport(sessionId, requestId, errorReport);
      return errorReport;
    }

    // No results case: proceed with empty events array (not a failure)
    if (athenaResults.length === 0) {
      console.log('No Athena results found, proceeding with empty events array');
    }

    // 4. Build prompt with session context
    const prompt = buildAnalysisPrompt(athenaResults, request.justification || '', session);

    // 5. Invoke Bedrock
    let bedrockResponse;
    try {
      bedrockResponse = await invokeBedrockModel(prompt);
    } catch (bedrockError) {
      console.error('Bedrock invocation failed:', bedrockError);
      const errorReport = {
        status: 'failed',
        error: `Bedrock invocation failed: ${bedrockError.message}`,
      };
      await storeAnalysisReport(sessionId, requestId, errorReport);
      return errorReport;
    }

    // 6. Parse structured response
    const report = parseAnalysisResponse(bedrockResponse);

    // 7. Persist report
    await storeAnalysisReport(sessionId, requestId, report);

    return report;
  } catch (error) {
    console.error('Analysis failed:', error);
    return {
      status: 'failed',
      error: error.message,
    };
  }
};
