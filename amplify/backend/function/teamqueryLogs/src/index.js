//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
const RAW_EVENT_DATA_STORE = process.env.EVENT_DATA_STORE;
const REGION = process.env.REGION;
const IS_CWLOGS = RAW_EVENT_DATA_STORE.startsWith("cwlogs://");
const EventDataStore = IS_CWLOGS ? RAW_EVENT_DATA_STORE : RAW_EVENT_DATA_STORE.split("/").pop();
const CWLOGS_ASSUME_ROLE_ARN = process.env.CWLOGS_ASSUME_ROLE_ARN || "";
const {
    CloudTrailClient,
    paginateGetQueryResults,
  } = require("@aws-sdk/client-cloudtrail");
  const client = new CloudTrailClient({ region: REGION });
const {
    CloudWatchLogsClient,
    GetQueryResultsCommand,
  } = require("@aws-sdk/client-cloudwatch-logs");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");


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
  
// When CWLOGS_ASSUME_ROLE_ARN is set, fetch results using temporary credentials
// from the role in the log-group's account. This mirrors teamgetLogs and is
// required because CloudWatch Logs Insights queryIds are scoped to the account
// that started the query - so the same credentials must be used to read them.
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

// CloudWatch Logs Insights returns each row as an array of {field, value} pairs;
// reshape into objects keyed by field name to match what the Logs GraphQL type
// and the CloudTrail Lake path already produce (no schema or UI changes).
const get_query_cwlogs = async (queryId) => {
try {
    const cwlogsClient = await getCwlogsClient();
    const command = new GetQueryResultsCommand({ queryId });
    const response = await cwlogsClient.send(command);
    const output = [];
    for (const row of response.results || []) {
        const logs = {};
        for (const cell of row) {
        logs[cell.field] = cell.value;
        }
        output.push(logs);
    }
    console.log(output);
    return output;
} catch (err) {
    console.log("Error", err);
}
};

exports.handler = async (event) => {
    const queryId = event["arguments"]["queryId"]
    if (IS_CWLOGS) {
      return get_query_cwlogs(queryId);
    }
    return get_query(queryId);
};
