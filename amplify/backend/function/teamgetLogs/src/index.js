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
	BEDROCK_ANALYZER_FUNCTION_ARN
	BEDROCK_SCHEDULER_ROLE_ARN
Amplify Params - DO NOT EDIT */
import crypto from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { default as fetch, Request } from 'node-fetch';

import {
  CloudTrailClient,
  StartQueryCommand,
  DescribeQueryCommand,
} from "@aws-sdk/client-cloudtrail"

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena";

import {
  SchedulerClient,
  CreateScheduleCommand,
} from "@aws-sdk/client-scheduler";

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const EventDataStore = (process.env.EVENT_DATA_STORE).split("/").pop();
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

// Athena audit mode configuration
const AUDIT_MODE = process.env.AUDIT_MODE || 'cloudtrail_lake';
const ATHENA_ROLE_ARN = process.env.ATHENA_ROLE_ARN;
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP || 'team-audit';
const ATHENA_DATABASE = process.env.ATHENA_DATABASE;
const ATHENA_TABLE = process.env.ATHENA_TABLE;
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET;

// Bedrock auto-analysis configuration
const BEDROCK_AUDIT_ENABLED = process.env.BEDROCK_AUDIT_ENABLED === 'true';
const BEDROCK_ANALYZER_FUNCTION_ARN = process.env.BEDROCK_ANALYZER_FUNCTION_ARN || '';
const BEDROCK_SCHEDULER_ROLE_ARN = process.env.BEDROCK_SCHEDULER_ROLE_ARN || '';
const ENV = process.env.ENV;

// const {
//   CloudTrailClient,
//   StartQueryCommand,
//   DescribeQueryCommand,
// } = require("@aws-sdk/client-cloudtrail");

const client = new CloudTrailClient({ region: REGION });

const assumeCrossAccountRole = async () => {
  const stsClient = new STSClient({ region: REGION });
  const command = new AssumeRoleCommand({
    RoleArn: ATHENA_ROLE_ARN,
    RoleSessionName: 'team-athena-getlogs',
    DurationSeconds: 900,
  });
  const response = await stsClient.send(command);
  return response.Credentials;
};

// Escape single quotes for SQL string literals
const escapeSql = (value) => value.replace(/'/g, "''");

// Escape LIKE pattern special characters and single quotes
const escapeLike = (value) => value.replace(/'/g, "''").replace(/%/g, '\\%').replace(/_/g, '\\_');

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

export const buildAthenaQuery = (event) => {
  const startTime = event["startTime"]["S"];
  const endTime = event["endTime"]["S"];
  const username = event["username"]["S"].replace('idc_', '');
  const accountId = event["accountId"]["S"];
  const role = event["role"]["S"];

  if (!/^\d{12}$/.test(accountId)) {
    throw new Error(`Invalid accountId for Athena query: ${accountId}`);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  const partitionFilter = buildPartitionFilter(start, end, accountId);

  return `SELECT eventID, eventName, eventSource, eventTime
    FROM "${ATHENA_DATABASE}"."${ATHENA_TABLE}"
    WHERE ${partitionFilter}
      AND eventTime > '${escapeSql(startTime)}'
      AND eventTime < '${escapeSql(endTime)}'
      AND lower(useridentity.principalId) LIKE '%:${escapeLike(username.toLowerCase())}%'
      AND useridentity.sessionContext.sessionIssuer.arn LIKE '%${escapeLike(role)}%'`;
};

const startAthenaQuery = async (event) => {
  const credentials = await assumeCrossAccountRole();
  const athenaClient = new AthenaClient({
    region: REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });

  const queryString = buildAthenaQuery(event);
  const params = {
    QueryString: queryString,
    WorkGroup: ATHENA_WORKGROUP,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
  };
  if (ATHENA_RESULTS_BUCKET) {
    params.ResultConfiguration = {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/team-query-results/`,
    };
  }
  const command = new StartQueryExecutionCommand(params);

  const response = await athenaClient.send(command);
  return { queryExecutionId: response.QueryExecutionId, athenaClient };
};

const pollAthenaQuery = async (athenaClient, queryExecutionId) => {
  const command = new GetQueryExecutionCommand({
    QueryExecutionId: queryExecutionId,
  });
  const response = await athenaClient.send(command);
  return response.QueryExecution.Status.State;
};

const query = /* GraphQL */ `
  mutation UpdateSessions(
    $input: UpdateSessionsInput!
    $condition: ModelSessionsConditionInput
  ) {
    updateSessions(input: $input, condition: $condition) {
      id
      startTime
      endTime
      username
      accountId
      role
      approver_ids
      queryId
      createdAt
      updatedAt
      owner
    }
  }
`;

/**
 * @type {import('@types/aws-lambda').APIGatewayProxyHandler}
 */

const updateItem = async (id, queryId) => {
  const variables = {
    input: {
      id: id,
      queryId: queryId
    } 
  }

  const endpoint = new URL(GRAPHQL_ENDPOINT);

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region: REGION,
    service: 'appsync',
    sha256: Sha256
  });

  const requestToBeSigned = new HttpRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.host
    },
    hostname: endpoint.host,
    body: JSON.stringify({ query, variables }),
    path: endpoint.pathname
  });

  const signed = await signer.sign(requestToBeSigned);
  const request = new Request(endpoint, signed);

  let statusCode = 200;
  let body;
  let response;

  try {
    response = await fetch(request);
    body = await response.json();
    console.log(body);
    if (body.errors) statusCode = 400;
  } catch (error) {
    statusCode = 400;
    body = {
      errors: [
        {
          status: response.status,
          message: error.message,
          stack: error.stack
        }
      ]
    };
  }

  return {
    statusCode,
    body: JSON.stringify(body)
  };
};


const get_query_status = async (queryId) => {
  try {
    const input = {
      EventDataStore: EventDataStore,
      QueryId: queryId,
    };
    const command = new DescribeQueryCommand(input);
    const response = await client.send(command);
    return response.QueryStatus;
  } catch (err) {
    console.log("Error", err);
  }
};

const start_query = async (event) => {
  const startTime = event["startTime"]["S"];
  const endTime = event["endTime"]["S"];
  const  username = event["username"]["S"].replace('idc_', '');
  const accountId = event["accountId"]["S"];
  const role = event["role"]["S"];
  try {
    const input = {
      QueryStatement: `SELECT eventID, eventName, eventSource, eventTime FROM ${EventDataStore} WHERE eventTime > '${startTime}' AND eventTime < '${endTime}' AND lower(useridentity.principalId) LIKE '%:${username}%' AND useridentity.sessionContext.sessionIssuer.arn LIKE '%${role}%' AND recipientAccountId='${accountId}'`,
    };
    const command = new StartQueryCommand(input);
    const response = await client.send(command);
    return response.QueryId;
  } catch (err) {
    console.log("Error", err);
  }
};

/**
 * Clamp the auto-analysis delay to a minimum of 5 minutes.
 * Exported for property-based testing (Property 2).
 *
 * @param {number} delay - The configured delay in minutes
 * @returns {number} The effective delay, clamped to minimum 5 minutes
 */
export const clampDelay = (delay) => Math.max(5, delay);

/**
 * Query the Settings model via GraphQL to get Bedrock auto-analysis configuration.
 * Returns the first settings record found.
 *
 * @returns {Object|null} Settings object with bedrockAutoAnalysisEnabled, bedrockAutoAnalysisDelay, or null if unavailable
 */
const getBedrockSettings = async () => {
  const settingsQuery = /* GraphQL */ `
    query ListSettings {
      listSettings(limit: 1) {
        items {
          id
          bedrockAutoAnalysisEnabled
          bedrockAutoAnalysisDelay
        }
      }
    }
  `;

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
    body: JSON.stringify({ query: settingsQuery }),
    path: endpoint.pathname,
  });

  const signed = await signer.sign(requestToBeSigned);
  const request = new Request(endpoint, signed);

  const response = await fetch(request);
  const body = await response.json();

  if (body.errors || !body.data?.listSettings?.items?.length) {
    return null;
  }

  return body.data.listSettings.items[0];
};

/**
 * Schedule auto-analysis for a session via EventBridge Scheduler.
 * Creates a one-time schedule that invokes the teamBedrockAnalyzer Lambda
 * after the configured delay.
 *
 * @param {string} sessionId - The session ID to analyze
 * @param {string} requestId - The associated request ID
 * @param {number} delayMinutes - The delay in minutes (already clamped)
 */
const scheduleAutoAnalysis = async (sessionId, requestId, delayMinutes) => {
  const schedulerClient = new SchedulerClient({ region: REGION });

  // Calculate the schedule time (now + delay)
  const scheduleTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  const scheduleExpression = `at(${scheduleTime.toISOString().replace(/\.\d{3}Z$/, '')})`;

  // Create a unique schedule name using sessionId and timestamp
  const scheduleName = `team-auto-analysis-${sessionId}-${Date.now()}`;

  const command = new CreateScheduleCommand({
    Name: scheduleName,
    ScheduleExpression: scheduleExpression,
    ScheduleExpressionTimezone: 'UTC',
    FlexibleTimeWindow: { Mode: 'OFF' },
    Target: {
      Arn: BEDROCK_ANALYZER_FUNCTION_ARN,
      RoleArn: BEDROCK_SCHEDULER_ROLE_ARN,
      Input: JSON.stringify({
        sessionId,
        requestId,
        source: 'auto-analysis',
      }),
    },
    ActionAfterCompletion: 'DELETE',
  });

  await schedulerClient.send(command);
  console.log(`Scheduled auto-analysis for session ${sessionId} at ${scheduleTime.toISOString()} (delay: ${delayMinutes} min), schedule: ${scheduleName}`);
};

/**
 * Attempt to schedule Bedrock auto-analysis for a session that has ended or been revoked.
 * Checks if the feature is enabled at both infrastructure and settings level.
 * On any failure, logs the error but does NOT fail the session flow.
 *
 * The sessions table does not have a "status" field. A session INSERT with an endTime
 * indicates the session has ended (the Logs component creates sessions with endTime set).
 *
 * @param {Object} data - The DynamoDB stream NewImage data (sessions table)
 */
const tryScheduleAutoAnalysis = async (data) => {
  try {
    // Check infrastructure-level feature toggle
    if (!BEDROCK_AUDIT_ENABLED) {
      return;
    }

    // Check if this is an Athena mode deployment (Bedrock AI requires Athena mode)
    if (AUDIT_MODE !== 'athena') {
      return;
    }

    // Sessions table doesn't have a status field. Check endTime is set
    // (sessions are created with endTime when the access session has ended)
    const endTime = data["endTime"]?.["S"];
    if (!endTime) {
      return;
    }

    // Check if we have the required ARNs configured
    if (!BEDROCK_ANALYZER_FUNCTION_ARN || !BEDROCK_SCHEDULER_ROLE_ARN) {
      console.warn('Bedrock auto-analysis: missing BEDROCK_ANALYZER_FUNCTION_ARN or BEDROCK_SCHEDULER_ROLE_ARN');
      return;
    }

    // Query settings to check if auto-analysis is enabled
    const settings = await getBedrockSettings();
    if (!settings || !settings.bedrockAutoAnalysisEnabled) {
      return;
    }

    // Get the delay and clamp to minimum 5 minutes
    const configuredDelay = settings.bedrockAutoAnalysisDelay || 15;
    const effectiveDelay = clampDelay(configuredDelay);

    // Get sessionId and requestId from the stream event
    const sessionId = data["id"]?.["S"];
    const requestId = data["id"]?.["S"]; // session and request share the same ID

    if (!sessionId) {
      console.warn('Bedrock auto-analysis: missing sessionId in stream event');
      return;
    }

    // Schedule the auto-analysis
    await scheduleAutoAnalysis(sessionId, requestId, effectiveDelay);
  } catch (error) {
    // On scheduling failure, log error but don't fail the session flow
    console.error('Bedrock auto-analysis scheduling failed (non-blocking):', error);
  }
};

export const handler = async (event) => {
  let data = event["Records"].pop()
  data = data["dynamodb"]["NewImage"]
  const id = data["id"]["S"]
  console.log("Event", data);

  // Attempt to schedule Bedrock auto-analysis (non-blocking)
  await tryScheduleAutoAnalysis(data);

  if (AUDIT_MODE === 'none') {
    console.log("Audit mode disabled, skipping query.");
    return;
  }

  if (AUDIT_MODE === 'athena') {
    try {
      const { queryExecutionId, athenaClient } = await startAthenaQuery(data);
      let status = await pollAthenaQuery(athenaClient, queryExecutionId);
      const MAX_POLL_ATTEMPTS = 120;
      let attempts = 0;
      while ((status === 'QUEUED' || status === 'RUNNING') && attempts < MAX_POLL_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await pollAthenaQuery(athenaClient, queryExecutionId);
        attempts++;
      }
      if (status === 'SUCCEEDED') {
        console.log("Athena query Finished - queryExecutionId:", queryExecutionId);
        return await updateItem(id, queryExecutionId);
      } else {
        console.error(`Athena query ended with status: ${status} after ${attempts} attempts, executionId: ${queryExecutionId}, sessionId: ${id}`);
      }
    } catch (err) {
      console.error(`Athena query error for session ${id}:`, err);
    }
  } else if (AUDIT_MODE === 'cloudtrail_lake') {
    const queryId = await start_query(data);
    let status = await get_query_status(queryId);
    while (status) {
      console.log(status);
      status = await get_query_status(queryId);
      if (status === "FINISHED") {
        console.log("query Finished - queryId:", queryId);
        const response = await updateItem(id, queryId);
        return response;
      }
    }
  } else {
    console.error(`Unknown AUDIT_MODE: '${AUDIT_MODE}', skipping audit query.`);
    return;
  }
};