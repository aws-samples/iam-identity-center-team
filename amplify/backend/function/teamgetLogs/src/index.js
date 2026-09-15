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
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena"

const { Sha256 } = crypto;
const REGION = process.env.REGION;
const RAW_EVENT_DATA_STORE = process.env.EVENT_DATA_STORE;
const IS_ATHENA = RAW_EVENT_DATA_STORE.startsWith("athena://");
const IS_AUDIT_DISABLED = RAW_EVENT_DATA_STORE === "none";
const EventDataStore = (IS_ATHENA || IS_AUDIT_DISABLED) ? RAW_EVENT_DATA_STORE : RAW_EVENT_DATA_STORE.split("/").pop();
const GRAPHQL_ENDPOINT = process.env.API_TEAM_GRAPHQLAPIENDPOINTOUTPUT;

// const {
//   CloudTrailClient,
//   StartQueryCommand,
//   DescribeQueryCommand,
// } = require("@aws-sdk/client-cloudtrail");

const client = new CloudTrailClient({ region: REGION });
const athenaClient = new AthenaClient({ region: REGION });

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

// athena:// URIs are validated by the CloudTrailAuditLogs AllowedPattern, but the
// values interpolated into the query below (accountId, username, role, times) come
// from a user-supplied request record, so they are escaped/validated explicitly.
const escapeSqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

const parseAthenaTarget = (target) => {
  const [workgroup, database, table] = target.slice("athena://".length).split("/");
  return { workgroup, database, table };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const start_query_athena = async (event) => {
  const startTime = event["startTime"]["S"];
  const endTime = event["endTime"]["S"];
  const username = event["username"]["S"].replace('idc_', '');
  const accountId = event["accountId"]["S"];
  const role = event["role"]["S"];

  if (!/^\d{12}$/.test(accountId)) {
    console.log("Error", new Error(`Invalid accountId for Athena query: ${accountId}`));
    return;
  }

  const { workgroup, database, table } = parseAthenaTarget(EventDataStore);
  const startDate = startTime.slice(0, 10).replace(/-/g, "/");
  const endDate = endTime.slice(0, 10).replace(/-/g, "/");

  try {
    const input = {
      QueryString: `SELECT eventid AS "eventID", eventname AS "eventName", eventsource AS "eventSource", eventtime AS "eventTime" FROM "${database}"."${table}" WHERE account = ${escapeSqlLiteral(accountId)} AND date BETWEEN ${escapeSqlLiteral(startDate)} AND ${escapeSqlLiteral(endDate)} AND eventtime > ${escapeSqlLiteral(startTime)} AND eventtime < ${escapeSqlLiteral(endTime)} AND lower(useridentity.principalid) LIKE ${escapeSqlLiteral(`%:${username}%`)} AND useridentity.sessioncontext.sessionissuer.arn LIKE ${escapeSqlLiteral(`%${role}%`)} AND recipientaccountid = ${escapeSqlLiteral(accountId)}`,
      WorkGroup: workgroup,
      QueryExecutionContext: { Database: database },
    };
    const command = new StartQueryExecutionCommand(input);
    const response = await athenaClient.send(command);
    return response.QueryExecutionId;
  } catch (err) {
    console.log("Error", err);
  }
};

const get_query_status_athena = async (queryExecutionId) => {
  try {
    const input = { QueryExecutionId: queryExecutionId };
    const command = new GetQueryExecutionCommand(input);
    const response = await athenaClient.send(command);
    return response.QueryExecution.Status.State;
  } catch (err) {
    console.log("Error", err);
  }
};

const poll_query_athena = async (queryExecutionId) => {
  let status = await get_query_status_athena(queryExecutionId);
  while (status === "QUEUED" || status === "RUNNING") {
    console.log(status);
    await sleep(1000);
    status = await get_query_status_athena(queryExecutionId);
  }
  return status;
};

export const handler = async (event) => {
  let data = event["Records"].pop()
  data = data["dynamodb"]["NewImage"]
  const id = data["id"]["S"]
  console.log("Event", data);

  if (IS_AUDIT_DISABLED) {
    console.log("CloudTrailAuditLogs is set to 'none'; skipping audit query for this session.");
    return;
  }

  if (IS_ATHENA) {
    const queryExecutionId = await start_query_athena(data);
    const status = await poll_query_athena(queryExecutionId);
    if (status === "SUCCEEDED") {
      console.log("Athena query succeeded - queryExecutionId:", queryExecutionId);
      const response = await updateItem(id, queryExecutionId);
      return response;
    }
    console.log("Athena query did not succeed - status:", status);
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