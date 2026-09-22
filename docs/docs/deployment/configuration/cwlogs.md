---
layout: default
title: CloudWatch Logs audit log configuration
nav_order: 10
parent: Configuration
grand_parent: Solution deployment
---

# CloudWatch Logs audit log configuration

> AWS closed CloudTrail Lake to new customers on May 31, 2026. If you already have a CloudTrail Lake event data store, you do not need this page — continue using `CLOUDTRAIL_AUDIT_LOGS=read`/`write`/`read_write`/an event data store ARN as before. This page is for new TEAM deployments that query an existing CloudTrail-fed CloudWatch Log Group via CloudWatch Logs Insights instead of CloudTrail Lake.
{: .important}

TEAM does not create the CloudTrail trail or the CloudWatch Log Group for you. You point it at a log group your organization trail already delivers management events to. AWS Control Tower users get this for free: Control Tower's organization trail (`aws-controltower-BaselineCloudTrail`) delivers events to `aws-controltower/CloudTrailLogs` in the management account, and that log-group name is what you set below.

## 1. Prerequisites

- An existing CloudTrail trail (organization trail or single-account trail) that delivers **management events** to a CloudWatch Log Group. AWS Control Tower configures this by default in the management account.
- Access to configure that log group's location, plus IAM in whichever account it lives in.

## 2. Choosing a setup pattern

TEAM's `teamgetLogs` / `teamqueryLogs` Lambdas issue CloudWatch Logs Insights queries. Two setup patterns are supported, depending on whether the CloudTrail-fed log group is in the same AWS account as TEAM or in another account (typical for AWS Control Tower, where the log group lives in the management account and TEAM is deployed in a delegated admin account).

### Option A — Same-account log group

If the log group is in the same AWS account as TEAM — either because TEAM's account is where CloudTrail delivers, or because you configured a CloudWatch Logs subscription filter to replicate events from the source log group into a destination log group in TEAM's account — no additional IAM is needed. Set:

```sh
CLOUDTRAIL_AUDIT_LOGS=cwlogs://<log-group-name>
CWLOGS_ASSUME_ROLE_ARN=
```

TEAM's CloudFormation grants the audit-log Lambdas `logs:StartQuery` / `logs:GetQueryResults` scoped to the log group ARN in TEAM's own account. Simplest IAM story; higher recurring cost if you set up a subscription filter (duplicated CloudWatch Logs ingestion for the mgmt trail's data volume).

### Option B — Cross-account log group via STS AssumeRole (recommended for Control Tower)

CloudWatch Logs Insights does not support cross-account queries via `logGroupIdentifiers` unless the caller is a monitoring account in [CloudWatch cross-account observability](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Unified-Cross-Account.html). For everyone else — including a delegated-admin TEAM account querying Control Tower's log group in the management account — the pragmatic path is to have TEAM's Lambdas AssumeRole into the log-group's account and run the query there.

This pattern requires **one IAM role in the source account** (typically the management account for Control Tower users), trusted by TEAM's Lambda execution role. TEAM performs `sts:AssumeRole` before every query and executes the CloudWatch Logs Insights query using the temporary credentials.

Create the role in the source account (e.g. management account).

**Trust policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "<team-lambda-role-arn>"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Permissions policy**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:StartQuery",
        "logs:GetQueryResults"
      ],
      "Resource": "arn:aws:logs:<region>:<source-account>:log-group:<log-group-name>:*"
    }
  ]
}
```

Then set:

```sh
CLOUDTRAIL_AUDIT_LOGS=cwlogs://<log-group-name>
CWLOGS_ASSUME_ROLE_ARN=arn:aws:iam::<source-account>:role/TEAM-CWLogs-Query
```

TEAM's CloudFormation grants the audit-log Lambdas `sts:AssumeRole` scoped specifically to this role ARN. No `logs:*` permissions are needed in the TEAM account when `CWLOGS_ASSUME_ROLE_ARN` is set — the log-group permissions live in the source account's role.

The `<team-lambda-role-arn>` in the trust policy is the shared execution role TEAM's audit-log Lambdas run as. You can obtain it from the CloudFormation outputs of the deployed TEAM stack (`LambdaExecutionRoleArn` on the `teamgetLogs` and `teamqueryLogs` nested stacks — the same role is shared across both). If you need a placeholder before the first deploy, use `arn:aws:iam::<team-account>:role/teamapplicationLambdaRole5fbe17a6-<env>` where `<env>` is the Amplify branch (typically `main`).

## 3. Worked example — AWS Control Tower

Control Tower creates an organization trail that writes to `aws-controltower/CloudTrailLogs` in the management account. To use this log group with a TEAM deployment in a delegated-admin account:

1. In the management account, create the `TEAM-CWLogs-Query` role (as above) with `logs:StartQuery` / `logs:GetQueryResults` on the ARN `arn:aws:logs:<region>:<mgmt-account>:log-group:aws-controltower/CloudTrailLogs:*`. Trust TEAM's Lambda execution role.
2. In the TEAM account's `parameters.sh`, set:

    ```sh
    CLOUDTRAIL_AUDIT_LOGS=cwlogs://aws-controltower/CloudTrailLogs
    CWLOGS_ASSUME_ROLE_ARN=arn:aws:iam::<mgmt-account>:role/TEAM-CWLogs-Query
    ```

3. Deploy TEAM. Grant a test request via the UI and confirm the *Session details → Logs* view populates.

## 4. What TEAM queries

For each elevated-access session, TEAM runs the following CloudWatch Logs Insights query:

```
fields eventID, eventName, eventSource, eventTime
| filter recipientAccountId = "<accountId>"
| filter userIdentity.principalId like ":<username>"
| filter userIdentity.sessionContext.sessionIssuer.arn like "<role>"
| sort @timestamp desc
| limit 10000
```

scoped to the session's `startTime` / `endTime`. The result columns (`eventID`, `eventName`, `eventSource`, `eventTime`) match exactly what the CloudTrail Lake backend produces, so no frontend changes are required.

## Cost

CloudWatch Logs Insights charges per GB of data scanned. Scoping each query tightly to a single session's time window and a single log group keeps a typical session lookup well under a cent — total cost scales with elevated-access session volume, not with organization trail volume. See [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/) for current rates.

If you use Option A with a subscription filter to replicate events into TEAM's account, you also pay for the additional CloudWatch Logs *ingestion* on the destination log group — usually a much larger line item than the per-query scan cost. Option B avoids this by querying the source log group in-place.
