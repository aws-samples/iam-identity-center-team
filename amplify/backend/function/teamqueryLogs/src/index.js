//  © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
//  This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
//  http: // aws.amazon.com/agreement or other written agreement between Customer and either
//  Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
const RAW_EVENT_DATA_STORE = process.env.EVENT_DATA_STORE;
const REGION = process.env.REGION;
const IS_ATHENA = RAW_EVENT_DATA_STORE.startsWith("athena://");
const IS_AUDIT_DISABLED = RAW_EVENT_DATA_STORE === "none";
const EventDataStore = (IS_ATHENA || IS_AUDIT_DISABLED) ? RAW_EVENT_DATA_STORE : RAW_EVENT_DATA_STORE.split("/").pop();
const {
    CloudTrailClient,
    paginateGetQueryResults,
  } = require("@aws-sdk/client-cloudtrail");
  const client = new CloudTrailClient({ region: REGION });
const {
    AthenaClient,
    paginateGetQueryResults: paginateAthenaQueryResults,
  } = require("@aws-sdk/client-athena");
  const athenaClient = new AthenaClient({ region: REGION });


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

// Athena's GetQueryResults returns a header row as the first row of the first
// page only (never on subsequent NextToken pages) - the Lake API has no such row.
const get_query_athena = async (queryExecutionId) => {
try {
    const output = [];
    const input = {
    QueryExecutionId: queryExecutionId,
    };
    const paginatorConfig = {
    client: new AthenaClient({ region: REGION }),
    };
    const paginator = paginateAthenaQueryResults(paginatorConfig, input);
    let isFirstPage = true;
    for await (const page of paginator) {
    const columns = page.ResultSet.ResultSetMetadata.ColumnInfo.map((c) => c.Name);
    const rows = isFirstPage ? page.ResultSet.Rows.slice(1) : page.ResultSet.Rows;
    isFirstPage = false;
    for (const row of rows) {
        const logs = {};
        row.Data.forEach((cell, index) => {
        logs[columns[index]] = cell.VarCharValue;
        });
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
    const queryId = event["arguments"]["queryId"]
    if (IS_AUDIT_DISABLED || !queryId) {
      console.log("CloudTrailAuditLogs is set to 'none' or no query was recorded for this session; returning no logs.");
      return [];
    }
    if (IS_ATHENA) {
      return get_query_athena(queryId);
    }
    return get_query(queryId);
};
