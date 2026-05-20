//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
const EventDataStore = (process.env.EVENT_DATA_STORE).split("/").pop();
const REGION = process.env.REGION;
const {
    CloudTrailClient,
    paginateGetQueryResults,
  } = require("@aws-sdk/client-cloudtrail");
  const client = new CloudTrailClient({ region: REGION });
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const { AthenaClient, GetQueryResultsCommand } = require("@aws-sdk/client-athena");

const AUDIT_MODE = process.env.AUDIT_MODE || 'cloudtrail_lake';
const ATHENA_ROLE_ARN = process.env.ATHENA_ROLE_ARN;

const assumeCrossAccountRole = async () => {
  const stsClient = new STSClient({ region: REGION });
  const command = new AssumeRoleCommand({
    RoleArn: ATHENA_ROLE_ARN,
    RoleSessionName: 'team-athena-querylogs',
    DurationSeconds: 900,
  });
  const response = await stsClient.send(command);
  return response.Credentials;
};


const transformAthenaRows = (rows, headers) => {
  const output = [];
  for (const row of rows) {
    const log = {};
    row.Data.forEach((cell, idx) => {
      log[headers[idx]] = cell.VarCharValue || '';
    });
    output.push(log);
  }
  return output;
};

const getAthenaResults = async (queryExecutionId) => {
  const credentials = await assumeCrossAccountRole();
  const athenaClient = new AthenaClient({
    region: REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });

  const output = [];
  let nextToken = undefined;
  let headers = null;

  do {
    const command = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
    });
    const response = await athenaClient.send(command);
    const rows = response.ResultSet.Rows;

    if (!headers) {
      headers = rows[0].Data.map(d => d.VarCharValue);
    }

    const dataRows = !nextToken ? rows.slice(1) : rows;
    const transformed = transformAthenaRows(dataRows, headers);
    output.push(...transformed);

    nextToken = response.NextToken;
  } while (nextToken);

  return output;
};

const get_query = async (queryId) => {
try {
    const output = [];
    const input = {
    EventDataStore: EventDataStore,
    QueryId: queryId,
    };
    const paginatorConfig = {
    client: new CloudTrailClient({ region: REGION }),
    };
    const paginator = paginateGetQueryResults(paginatorConfig, input);
    for await (const page of paginator) {
    // page contains a single paginated output.
    for (const data of page.QueryResultRows) {
        const logs = {};
        for (const log of data) {
        for (const [k, v] of Object.entries(log)) {
            logs[k] = v;
        }
        }
        output.push(logs);
    }
    }
    console.log(output);
    return output;
} catch (err) {
    console.log("Error", err);
}
};
  
exports.handler = async (event) => {
  const queryId = event["arguments"]["queryId"];

  if (AUDIT_MODE === 'athena') {
    try {
      return await getAthenaResults(queryId);
    } catch (err) {
      console.error("Athena GetQueryResults error:", err);
      return [];
    }
  } else {
    return get_query(queryId);
  }
};

exports.transformAthenaRows = transformAthenaRows;
