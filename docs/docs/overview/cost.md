---
layout: default
title: Cost considerations
nav_order: 5
parent: Solution overview
---

# Cost considerations

The TEAM solution consists of numerous AWS serverless services. As cost is accrued based on usage of these services there is no consistent cost evaluation that would address all levels of potential usage. In order to get a better understanding of what running this application in your environment may cost, please leverage the [AWS Pricing Calculator](https://calculator.aws).

## AWS services pricing
- [AWS Amplify](https://aws.amazon.com/amplify/pricing/)
- [AWS Appsync](https://aws.amazon.com/appsync/pricing/)
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/pricing)
- [AWS Lambda](https://aws.amazon.com/lambda/pricing)
- [AWS Step Functions](https://aws.amazon.com/step-functions/pricing)
- [Amazon Cognito](https://aws.amazon.com/cognito/pricing)
- [AWS CloudTrail Lake](https://aws.amazon.com/cloudtrail/pricing/)
- [AWS IAM Identity Center](https://aws.amazon.com/iam/identity-center/) (free)
- [AWS Secret Manager](https://aws.amazon.com/secrets-manager/)

## Managing CloudTrail Lake cost 

TEAM uses [AWS CloudTrail Lake](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-lake.html) for querying, auditing and logging API activities and actions performed by a user during the period of elevated access. For CloudTrail Lake, you pay for ingestion and storage together, where the billing is based on the amount of uncompressed data ingested during the month. When you run queries in Lake, you pay based upon the amount of data scanned. 

TEAM CloudTrail lake event datastore records all [management events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-management-events-with-cloudtrail.html) and no [data events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-data-events-with-cloudtrail.html) by default. Depending on your organization's auditing and compliance requirement, you can chose to either log all events or specific events (read-only, write, read-write, management, data events). Recording only specific events can help to reduce the overall cost of running the TEAM solution. For more information about managing CloudTrail lake costs, see [Managing CloudTrail Lake costs](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-lake-manage-costs.html).