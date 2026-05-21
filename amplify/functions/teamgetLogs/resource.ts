import { defineFunction } from '@aws-amplify/backend';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { aws_iam } from 'aws-cdk-lib';
import type { Backend } from '../../backend';
import { appIdLower, branchName } from '../../config';

export const teamgetLogs = defineFunction({
  entry: './index.js',
  name: `teamgetLogs-${appIdLower}-${branchName}`,
  timeoutSeconds: 250,
  memoryMB: 128,
  environment: {
    ENV: `${branchName}`,
    REGION: process.env.AWS_REGION ?? 'eu-west-1',
  },
  runtime: 22,
  resourceGroupName: 'data',
});

export function applyEscapeHatches(backend: Backend, eventDataStoreArn?: string) {
  backend.teamgetLogs.resources.cfnResources.cfnFunction.functionName = `teamgetLogs-${appIdLower}-${branchName}`;
  backend.teamgetLogs.addEnvironment(
    'API_TEAM_GRAPHQLAPIENDPOINTOUTPUT',
    backend.data.graphqlUrl
  );
  backend.teamgetLogs.addEnvironment(
    'API_AWSPIM_GRAPHQLAPIIDOUTPUT',
    backend.data.apiId
  );
  backend.teamgetLogs.addEnvironment(
    'SESSIONS_TABLE_NAME',
    backend.data.resources.tables['sessions'].tableName
  );
  if (eventDataStoreArn) {
    backend.teamgetLogs.addEnvironment('EVENT_DATA_STORE', eventDataStoreArn);
  }

  // Use explicit IAM policy instead of grant* methods to avoid circular dependency
  backend.teamgetLogs.resources.lambda.addToRolePolicy(
    new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: ['appsync:GraphQL'],
      resources: [`${backend.data.resources.graphqlApi.arn}/*`],
    })
  );

  for (const model of ['sessions']) {
    const table = backend.data.resources.tables[model];
    backend.teamgetLogs.resources.lambda.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: StartingPosition.LATEST,
      })
    );
    // Use explicit IAM policies instead of grant* methods
    backend.teamgetLogs.resources.lambda.addToRolePolicy(
      new aws_iam.PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          'dynamodb:DescribeStream',
          'dynamodb:GetRecords',
          'dynamodb:GetShardIterator',
          'dynamodb:ListStreams',
        ],
        resources: [`${table.tableArn}/stream/*`],
      })
    );
  }
}
