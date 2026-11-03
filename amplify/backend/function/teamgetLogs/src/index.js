//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

/* Amplify Params - DO NOT EDIT
	API_TEAM_GRAPHQLAPIENDPOINTOUTPUT
	API_AWSPIM_GRAPHQLAPIIDOUTPUT
	ENV
	REGION
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
import {
  CloudWatchLogsClient,
  StartQueryCommand as CWLogsStartQueryCommand,
  GetQueryResultsCommand as CWLogsGetQueryResultsCommand,
} from "@aws-sdk/client-cloudwatch-logs"
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts"

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const RAW_EVENT_DATA_STORE = process.env.EVENT_DATA_STORE;
const IS_CWLOGS = RAW_EVENT_DATA_STORE.startsWith("cwlogs://");
const EventDataStore = IS_CWLOGS ? RAW_EVENT_DATA_STORE : RAW_EVENT_DATA_STORE.split("/").pop();
const CWLOGS_ASSUME_ROLE_ARN = process.env.CWLOGS_ASSUME_ROLE_ARN || "";
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

// const {
//   CloudTrailClient,
//   StartQueryCommand,
//   DescribeQueryCommand,
// } = require("@aws-sdk/client-cloudtrail");

const client = new CloudTrailClient({ region: REGION });

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

// cwlogs:// URIs are validated by the CloudTrailAuditLogs AllowedPattern, but the
// values interpolated into the query below (accountId, username, role) come from
// a user-supplied request record, so they are wrapped as literal strings using
// CloudWatch Logs Insights' `like "..."` substring-match syntax.
const escapeCwlogsStringLiteral = (value) => `"${String(value).replace(/["\\]/g, "\\$&")}"`;

const parseCwlogsTarget = (target) => target.slice("cwlogs://".length);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// When CWLOGS_ASSUME_ROLE_ARN is set, run the query using temporary credentials
// from the role in the log-group's account rather than the Lambda's own role.
// This is how TEAM supports cross-account setups (e.g. querying Control Tower's
// aws-controltower/CloudTrailLogs in the management account from a delegated
// TEAM account) without requiring CloudWatch Observability Access Manager.
const getCwlogsClient = async () => {
  if (!CWLOGS_ASSUME_ROLE_ARN) {
    return new CloudWatchLogsClient({ region: REGION });
  }
  const sts = new STSClient({ region: REGION });
  const response = await sts.send(new AssumeRoleCommand({
    RoleArn: CWLOGS_ASSUME_ROLE_ARN,
    RoleSessionName: "team-audit-query",
    DurationSeconds: 900,
  }));
  return new CloudWatchLogsClient({
    region: REGION,
    credentials: {
      accessKeyId: response.Credentials.AccessKeyId,
      secretAccessKey: response.Credentials.SecretAccessKey,
      sessionToken: response.Credentials.SessionToken,
    },
  });
};

const start_query_cwlogs = async (event, cwlogsClient) => {
  const startTime = event["startTime"]["S"];
  const endTime = event["endTime"]["S"];
  const username = event["username"]["S"].replace('idc_', '');
  const accountId = event["accountId"]["S"];
  const role = event["role"]["S"];

  if (!/^\d{12}$/.test(accountId)) {
    console.log("Error", new Error(`Invalid accountId for CloudWatch Logs query: ${accountId}`));
    return;
  }

  const logGroupName = parseCwlogsTarget(EventDataStore);
  const startEpoch = Math.floor(new Date(startTime).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endTime).getTime() / 1000);

  try {
    const input = {
      logGroupName,
      startTime: startEpoch,
      endTime: endEpoch,
      queryString: `fields eventID, eventName, eventSource, eventTime | filter recipientAccountId = ${escapeCwlogsStringLiteral(accountId)} | filter userIdentity.principalId like ${escapeCwlogsStringLiteral(":" + username)} | filter userIdentity.sessionContext.sessionIssuer.arn like ${escapeCwlogsStringLiteral(role)} | sort @timestamp desc | limit 10000`,
    };
    const command = new CWLogsStartQueryCommand(input);
    const response = await cwlogsClient.send(command);
    return response.queryId;
  } catch (err) {
    console.log("Error", err);
  }
};

const get_query_status_cwlogs = async (queryId, cwlogsClient) => {
  try {
    const command = new CWLogsGetQueryResultsCommand({ queryId });
    const response = await cwlogsClient.send(command);
    return response.status;
  } catch (err) {
    console.log("Error", err);
  }
};

const poll_query_cwlogs = async (queryId, cwlogsClient) => {
  let status = await get_query_status_cwlogs(queryId, cwlogsClient);
  while (status === "Scheduled" || status === "Running") {
    console.log(status);
    await sleep(1000);
    status = await get_query_status_cwlogs(queryId, cwlogsClient);
  }
  return status;
};

export const handler = async (event) => {
  let data = event["Records"].pop()
  data = data["dynamodb"]["NewImage"]
  const id = data["id"]["S"]
  console.log("Event", data);

  if (IS_CWLOGS) {
    const cwlogsClient = await getCwlogsClient();
    const queryId = await start_query_cwlogs(data, cwlogsClient);
    const status = await poll_query_cwlogs(queryId, cwlogsClient);
    if (status === "Complete") {
      console.log("CloudWatch Logs Insights query succeeded - queryId:", queryId);
      const response = await updateItem(id, queryId);
      return response;
    }
    console.log("CloudWatch Logs Insights query did not succeed - status:", status);
    return;
  }

  const queryId = await start_query(data);
  let status = await get_query_status(queryId);
  while (status) {
    console.log(status);
    status = await get_query_status(queryId);
    if (status === "FINISHED") {
      console.log("query Finished - queryId:", queryId );
      const response = await updateItem (id, queryId);
      return response;
    }
  }
};