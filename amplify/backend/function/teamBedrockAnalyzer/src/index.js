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
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

const { Sha256 } = crypto;

// Environment configuration
const REGION = process.env.REGION;
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

// Bedrock configuration
const BEDROCK_AUDIT_ENABLED = process.env.BEDROCK_AUDIT_ENABLED === 'true';
const BASE_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-haiku-4-5-20251001-v1:0';
const BEDROCK_REGION = process.env.BEDROCK_REGION || REGION;

// Minimum minutes after session end before caching the report
const CACHE_MIN_MINUTES = 15;

/**
 * Derive the cross-region inference profile ID from the base model ID and region.
 * Amazon-native models (nova, titan) don't need a geo prefix.
 */
const resolveModelId = (baseModelId, region) => {
  // Amazon models don't need cross-region inference prefix
  if (baseModelId.startsWith('amazon.')) {
    return baseModelId;
  }
  // Third-party models need geo prefix for cross-region inference
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
 */
export const parseEvent = (event) => {
  if (event.source === 'auto-analysis') {
    return { sessionId: event.sessionId, requestId: event.requestId, source: 'auto-analysis' };
  }
  if (event.arguments) {
    return { sessionId: event.arguments.sessionId, requestId: event.arguments.requestId, source: 'graphql' };
  }
  throw new Error('Unable to parse event: unrecognized invocation source');
};

/**
 * Execute a signed GraphQL request against the AppSync API.
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
    headers: { 'Content-Type': 'application/json', host: endpoint.host },
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

export const getSessionFromDDB = async (sessionId) => {
  const graphqlQuery = /* GraphQL */ `
    query GetSessions($id: ID!) {
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
  try {
    const data = await executeGraphQL(graphqlQuery, { id: sessionId });
    if (data?.getSessions) return data.getSessions;
  } catch (err) {
    console.warn(`getSessions failed for ${sessionId}: ${err.message}`);
  }
  return null;
};

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
  if (!data?.getRequests) throw new Error(`Request not found: ${requestId}`);
  return data.getRequests;
};

// SQL helpers
export const escapeSql = (value) => value.replace(/'/g, "''");
export const escapeLike = (value) => value.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');

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
 * Build Athena SQL query for AI analysis.
 * Filters OUT read-only events (Describe*, List*, Get*) to focus on write/mutating actions.
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
      AND useridentity.sessionContext.sessionIssuer.arn LIKE '%${escapeLike(role)}%'
      AND readonly = 'false'`;
};

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

export const executeExtendedAthenaQuery = async (session) => {
  const credentials = await assumeCrossAccountRole();
  const athenaClient = new AthenaClient({
    region: REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });

  const queryString = buildExtendedAthenaQuery(session);
  console.log('Athena query:', queryString);

  const startCommand = new StartQueryExecutionCommand({
    QueryString: queryString,
    WorkGroup: ATHENA_WORKGROUP,
    ResultConfiguration: { OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/team-query-results/` },
    QueryExecutionContext: { Database: ATHENA_DATABASE },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  let status = 'RUNNING';
  while (status === 'QUEUED' || status === 'RUNNING') {
    await new Promise(resolve => setTimeout(resolve, ATHENA_POLL_INTERVAL));
    const pollResponse = await athenaClient.send(new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }));
    status = pollResponse.QueryExecution.Status.State;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query failed with status: ${status}`);
  }

  const results = [];
  let nextToken = undefined;
  let isFirstPage = true;

  do {
    const resultsResponse = await athenaClient.send(new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId, NextToken: nextToken }));
    const rows = resultsResponse.ResultSet.Rows;
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

  console.log(`Athena returned ${results.length} write events`);
  return results;
};

/**
 * Build the analysis prompt for Bedrock.
 */
export const buildAnalysisPrompt = (events, justification, session) => {
  return `You are a cloud security expert analyzing an AWS session. All events shown are WRITE/MUTATING actions only (read-only events have been pre-filtered).

Session Context:
- Account: ${session.accountId}
- Role: ${session.role}
- User: ${session.username}
- Duration: ${session.startTime} to ${session.endTime}
- Justification: "${justification}"

CloudTrail Write Events (${events.length} total):
${JSON.stringify(events, null, 2)}

Provide analysis in the following JSON structure:
{
  "summary": {
    "description": "Brief summary of mutating actions performed during this session",
    "serviceBreakdown": [{"service": "...", "actions": ["..."], "count": N}]
  },
  "coherenceCheck": {
    "status": "consistent|inconsistent|insufficient_justification",
    "reasoning": "Explain whether the actions match the stated justification",
    "findings": [{"action": "...", "explanation": "why this action seems unrelated to justification"}]
  },
  "securityReview": {
    "findings": [{"severity": "HIGH", "eventName": "...", "resource": "...", "description": "..."}]
  }
}

Rules:
- coherenceCheck: set status "insufficient_justification" only if justification is too vague to compare. Set "inconsistent" if actions clearly don't match the stated purpose.
- securityReview: Report only HIGH criticality NEW misconfigurations (0.0.0.0/0 security groups, public S3 buckets, disabled encryption, overly permissive IAM policies, unencrypted volumes). Look at requestparameters for these patterns.
- If there are 0 events, set summary.description to "No write actions recorded during this session" and skip coherence/security review.
- Return ONLY the JSON object, no additional text.`;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Invoke Bedrock using the Converse API (model-agnostic, works with Anthropic, Nova, etc.)
 */
export const invokeBedrockModel = async (prompt) => {
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: MAX_TOKENS },
    });

    try {
      const response = await client.send(command);
      const textContent = response.output?.message?.content
        ?.filter(block => block.text)
        ?.map(block => block.text)
        ?.join('') || '';
      return textContent;
    } catch (error) {
      if (error.name === 'ThrottlingException' || error.__type === 'ThrottlingException') {
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(`Bedrock throttled (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
          continue;
        }
      }
      throw error;
    }
  }
};

/**
 * Parse and validate the Bedrock response.
 */
export const parseAnalysisResponse = (bedrockResponse) => {
  try {
    let jsonStr = bedrockResponse.trim();
    const codeBlockMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    let securityFindings = [];
    if (parsed.securityReview && Array.isArray(parsed.securityReview.findings)) {
      securityFindings = parsed.securityReview.findings.filter(finding =>
        finding.severity === 'HIGH' &&
        finding.eventName && finding.eventName.trim() !== '' &&
        finding.description && finding.description.trim() !== ''
      );
    }

    const coherenceCheck = parsed.coherenceCheck || {};
    const coherenceStatus = coherenceCheck.status || '';
    let coherenceFindings = Array.isArray(coherenceCheck.findings) ? coherenceCheck.findings : [];
    if (coherenceStatus === 'insufficient_justification') coherenceFindings = [];

    return {
      status: 'completed',
      summary: parsed.summary || null,
      coherenceCheck: { status: coherenceStatus, reasoning: coherenceCheck.reasoning || '', findings: coherenceFindings },
      securityReview: { findings: securityFindings },
      hasSecurityFindings: securityFindings.length > 0,
      hasCoherenceFindings: coherenceFindings.length > 0,
      error: null,
    };
  } catch (error) {
    console.error('Failed to parse Bedrock response:', error.message, 'Raw response:', bedrockResponse?.substring(0, 500));
    return { status: 'failed', error: 'Failed to parse AI response' };
  }
};

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
  if (!data?.createAnalysisReport) throw new Error('Failed to store analysis report');
  return data.createAnalysisReport;
};

/**
 * Check if a completed analysis report already exists for this session.
 * Only returns cached report if session ended more than CACHE_MIN_MINUTES ago.
 */
const getExistingReport = async (sessionId, sessionEndTime) => {
  // Only cache if session ended > 15 min ago (CloudTrail propagation time)
  if (sessionEndTime) {
    const endTime = new Date(sessionEndTime);
    const minutesSinceEnd = (Date.now() - endTime.getTime()) / 60000;
    if (minutesSinceEnd < CACHE_MIN_MINUTES) {
      console.log(`Session ended ${Math.round(minutesSinceEnd)} min ago (< ${CACHE_MIN_MINUTES}), skipping cache`);
      return null;
    }
  }

  const graphqlQuery = /* GraphQL */ `
    query AnalysisReportBySessionId($sessionId: String!) {
      analysisReportBySessionId(sessionId: $sessionId, limit: 1, sortDirection: DESC) {
        items {
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
    }
  `;

  try {
    const data = await executeGraphQL(graphqlQuery, { sessionId });
    const items = data?.analysisReportBySessionId?.items || [];
    if (items.length > 0 && items[0].status === 'completed') {
      return items[0];
    }
    return null;
  } catch (err) {
    console.warn('Failed to check for existing report:', err.message);
    return null;
  }
};

/**
 * Main Lambda handler.
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (!BEDROCK_AUDIT_ENABLED) {
    return {
      id: 'error', sessionId: 'unknown', requestId: null,
      analyzedAt: new Date().toISOString(), status: 'failed',
      error: 'Bedrock AI audit feature is not enabled',
    };
  }

  let sessionId, requestId;
  try {
    const parsed = parseEvent(event);
    sessionId = parsed.sessionId;
    requestId = parsed.requestId;
    const source = parsed.source;
    console.log(`Processing analysis for session: ${sessionId}, request: ${requestId}, source: ${source}`);

    // Get session metadata (needed for cache check and Athena query)
    const session = await getSessionFromDDB(sessionId);
    const request = await getRequestFromDDB(requestId);

    // Build session context from session record (preferred) or fall back to request data
    const sessionContext = session || {
      id: request.id,
      startTime: request.startTime,
      endTime: new Date(new Date(request.startTime).getTime() + parseInt(request.duration) * 3600000).toISOString(),
      username: request.username || request.email,
      accountId: request.accountId,
      role: request.role,
    };

    // Check for existing completed report (cache) — only for on-demand GraphQL invocations
    if (source === 'graphql') {
      const existing = await getExistingReport(sessionId, sessionContext.endTime);
      if (existing) {
        console.log(`Returning cached report for session: ${sessionId}`);
        return existing;
      }
    }

    // Execute Athena query (write events only)
    let athenaResults = [];
    try {
      athenaResults = await executeExtendedAthenaQuery(sessionContext);
    } catch (athenaError) {
      console.error('Athena query failed:', athenaError);
      const errorReport = { status: 'failed', error: `Athena query failed: ${athenaError.message}` };
      const stored = await storeAnalysisReport(sessionId, requestId, errorReport);
      return stored;
    }

    if (athenaResults.length === 0) {
      console.log('No write events found for this session');
    }

    // Build prompt and invoke Bedrock
    const prompt = buildAnalysisPrompt(athenaResults, request.justification || '', sessionContext);
    let bedrockResponse;
    try {
      bedrockResponse = await invokeBedrockModel(prompt);
      console.log('Bedrock response length:', bedrockResponse?.length);
    } catch (bedrockError) {
      console.error('Bedrock invocation failed:', bedrockError);
      const errorReport = { status: 'failed', error: `Bedrock invocation failed: ${bedrockError.message}` };
      const stored = await storeAnalysisReport(sessionId, requestId, errorReport);
      return stored;
    }

    // Parse and store
    const report = parseAnalysisResponse(bedrockResponse);
    const stored = await storeAnalysisReport(sessionId, requestId, report);
    return stored;
  } catch (error) {
    console.error('Analysis failed:', error);
    return {
      id: 'error', sessionId: sessionId || 'unknown', requestId: requestId || null,
      analyzedAt: new Date().toISOString(), status: 'failed', error: error.message,
    };
  }
};
