import { defineFunction } from '@aws-amplify/backend';
import { aws_iam } from 'aws-cdk-lib';
import type { Backend } from '../../backend';
import { appIdLower, branchName } from '../../config';

export const teamStatus = defineFunction({
  entry: './index.js',
  name: `teamStatus-${appIdLower}-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  environment: { ENV: `${branchName}`, REGION: 'eu-west-1' },
  runtime: 22,
  resourceGroupName: 'data',
});

export function applyEscapeHatches(backend: Backend) {
  backend.teamStatus.resources.cfnResources.cfnFunction.functionName = `teamStatus-${appIdLower}-${branchName}`;
  backend.teamStatus.addEnvironment(
    'API_TEAM_GRAPHQLAPIENDPOINTOUTPUT',
    backend.data.graphqlUrl
  );
  backend.teamStatus.addEnvironment(
    'API_TEAM_GRAPHQLAPIIDOUTPUT',
    backend.data.apiId
  );
  // Use explicit IAM policy instead of grant* methods to avoid circular dependency
  backend.teamStatus.resources.lambda.addToRolePolicy(
    new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: ['appsync:GraphQL'],
      resources: [`${backend.data.resources.graphqlApi.arn}/*`],
    })
  );
}
