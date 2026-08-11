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

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
} from "@aws-sdk/client-athena";

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
  return `account_id = '${accountId}' AND ${dateFilter}`;
};

export const buildAthenaQuery = (event) => {
  const startTime = event["startTime"]["S"];
  const endTime = event["endTime"]["S"];
  const username = event["username"]["S"].replace('idc_', '');
  const accountId = event["accountId"]["S"];
  const role = event["role"]["S"];

  const start = new Date(startTime);
  const end = new Date(endTime);
  const partitionFilter = buildPartitionFilter(start, end, accountId);

  return `SELECT eventID, eventName, eventSource, eventTime
    FROM "${ATHENA_DATABASE}"."${ATHENA_TABLE}"
    WHERE ${partitionFilter}
      AND eventTime > '${startTime}'
      AND eventTime < '${endTime}'
      AND lower(useridentity.principalId) LIKE '%:${username}%'
      AND useridentity.sessionContext.sessionIssuer.arn LIKE '%${role}%'`;
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
  const command = new StartQueryExecutionCommand({
    QueryString: queryString,
    WorkGroup: ATHENA_WORKGROUP,
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/team-query-results/`,
    },
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
  });

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

export const handler = async (event) => {
  let data = event["Records"].pop()
  data = data["dynamodb"]["NewImage"]
  const id = data["id"]["S"]
  console.log("Event", data);

  if (AUDIT_MODE === 'athena') {
    try {
      const { queryExecutionId, athenaClient } = await startAthenaQuery(data);
      let status = await pollAthenaQuery(athenaClient, queryExecutionId);
      while (status === 'QUEUED' || status === 'RUNNING') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await pollAthenaQuery(athenaClient, queryExecutionId);
      }
      if (status === 'SUCCEEDED') {
        console.log("Athena query Finished - queryExecutionId:", queryExecutionId);
        return await updateItem(id, queryExecutionId);
      } else {
        console.error(`Athena query failed with status: ${status}, executionId: ${queryExecutionId}, sessionId: ${id}`);
      }
    } catch (err) {
      console.error(`Athena query error for session ${id}:`, err);
    }
  } else {
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
  }
};