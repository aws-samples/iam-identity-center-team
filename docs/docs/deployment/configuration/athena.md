---
layout: default
title: Athena audit log configuration
nav_order: 9
parent: Configuration
grand_parent: Solution deployment
---

# Athena audit log configuration

> AWS closed CloudTrail Lake to new customers on May 31, 2026. If you already have a CloudTrail Lake event data store, you do not need this page - continue using `CLOUDTRAIL_AUDIT_LOGS=read`/`write`/`read_write`/an event data store ARN as before. This page is for new TEAM deployments that query an existing AWS Organizations CloudTrail trail via Amazon Athena instead.
{: .important}

TEAM does not create the Glue table, crawler, or Athena workgroup for you. You create these once, before deploying TEAM, against the S3 bucket your organization trail already delivers logs to.

## 1. Create the Glue table

Run this once, in the account where your organization trail's log bucket lives (often a dedicated log-archive account). Replace `<trail-bucket>`, `<database>`, and `<table>` with your own values, and adjust the `storage.location.template` to match your trail's S3 key prefix.

```sql
CREATE EXTERNAL TABLE <database>.<table> (
  eventversion STRING,
  useridentity STRUCT<
    type: STRING,
    principalid: STRING,
    arn: STRING,
    accountid: STRING,
    invokedby: STRING,
    accesskeyid: STRING,
    userName: STRING,
    sessioncontext: STRUCT<
      attributes: STRUCT<
        mfaauthenticated: STRING,
        creationdate: STRING>,
      sessionissuer: STRUCT<
        type: STRING,
        principalId: STRING,
        arn: STRING,
        accountId: STRING,
        userName: STRING>>>,
  eventtime STRING,
  eventsource STRING,
  eventname STRING,
  awsregion STRING,
  sourceipaddress STRING,
  useragent STRING,
  errorcode STRING,
  errormessage STRING,
  requestparameters STRING,
  responseelements STRING,
  additionaleventdata STRING,
  requestid STRING,
  eventid STRING,
  resources ARRAY<STRUCT<
    ARN: STRING,
    accountId: STRING,
    type: STRING>>,
  eventtype STRING,
  apiversion STRING,
  readonly STRING,
  recipientaccountid STRING,
  serviceeventdetails STRING,
  sharedeventid STRING,
  vpcendpointid STRING
)
PARTITIONED BY (account STRING, region STRING, date STRING)
ROW FORMAT SERDE 'com.amazon.emr.hive.serde.CloudTrailSerde'
STORED AS INPUTFORMAT 'com.amazon.emr.cloudtrail.CloudTrailInputFormat'
OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION 's3://<trail-bucket>/AWSLogs/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.account.type' = 'injected',
  'projection.region.type' = 'enum',
  'projection.region.values' = 'us-east-1,us-east-2,us-west-1,us-west-2,eu-west-1,eu-west-2,eu-central-1,ap-southeast-1,ap-southeast-2,ap-northeast-1',
  'projection.date.type' = 'date',
  'projection.date.range' = '2023/01/01,NOW',
  'projection.date.format' = 'yyyy/MM/dd',
  'projection.date.interval' = '1',
  'projection.date.interval.unit' = 'DAYS',
  'storage.location.template' = 's3://<trail-bucket>/AWSLogs/${account}/CloudTrail/${region}/${date}'
)
```

> Adjust `projection.region.values` to the regions your organization actually operates in - a narrower list means Athena enumerates fewer region partitions per query. If your trail bucket key layout includes an AWS Organizations ID segment (`AWSLogs/o-xxxxxxxxxx/<account>/CloudTrail/...`), add it to `LOCATION` and `storage.location.template` accordingly.
{: .note}

TEAM's session lookup filters on `account` and `date` (the session's target account and time window) but has no region for a session, so it cannot prune the `region` partition - Athena scans every enumerated region's partition for the matched account/date. This is still bounded and cheap; it is not a full-history scan.

## 2. Create (or choose) an Athena workgroup

The workgroup must have a query result location configured (**Settings → Query result location** in the Athena console, or `ResultConfiguration.OutputLocation` via the API). TEAM's Lambda functions rely on the workgroup's default result location - they do not pass an explicit `ResultConfiguration`, so if the workgroup has none configured, queries will fail.

## 3. Cross-account access

If the trail bucket lives in a different account than TEAM (for example, a log-archive account), that bucket's policy must grant the TEAM Lambda execution role read access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<team-account-id>:role/teamapplicationLambdaRole5fbe17a6-<env>"
      },
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::<trail-bucket>",
        "arn:aws:s3:::<trail-bucket>/*"
      ]
    }
  ]
}
```

If the trail bucket is encrypted with a customer-managed KMS key, grant the same role `kms:Decrypt` on that key (via a key policy grant or `aws kms create-grant`).

## 4. Set the TEAM deployment parameters

In `deployment/parameters.sh`, set:

```sh
CLOUDTRAIL_AUDIT_LOGS=athena://<workgroup>/<database>/<table>
ATHENA_TRAIL_BUCKET_ARN=arn:aws:s3:::<trail-bucket>
ATHENA_RESULTS_BUCKET_ARN=arn:aws:s3:::<athena-results-bucket>
# Only if the trail bucket is encrypted with a customer-managed KMS key:
ATHENA_TRAIL_KMS_KEY_ARN=arn:aws:kms:<region>:<account-id>:key/<key-id>
```

`ATHENA_TRAIL_BUCKET_ARN` and `ATHENA_RESULTS_BUCKET_ARN` scope the IAM permissions TEAM's Lambda execution roles get - they are only used for policy generation, not passed to Athena at query time. TEAM does not create the workgroup, the Glue table, or run any DDL on your behalf; it only queries the table you created in step 1.

## Cost

Athena charges per TB of data scanned per query. Partition projection (configured above) is what keeps a single session lookup scoped to the megabytes of logs for one account over one day's date partitions, rather than scanning your entire trail history. Without correctly configured partitioning, a single "what did this user do" lookup could scan your organization's entire CloudTrail history and cost accordingly - verify partition projection is working (`EXPLAIN` the query, or check *Data scanned* on a test query in the Athena console) before relying on this in production.
