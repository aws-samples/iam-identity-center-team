import { defineFunction } from '@aws-amplify/backend';
import type { Backend } from '../../backend';
import { appIdLower, branchName } from '../../config';

export const teamqueryLogs = defineFunction({
  entry: './index.js',
  name: `teamqueryLogs-${appIdLower}-${branchName}`,
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
  backend.teamqueryLogs.resources.cfnResources.cfnFunction.functionName = `teamqueryLogs-${appIdLower}-${branchName}`;
  if (eventDataStoreArn) {
    backend.teamqueryLogs.addEnvironment('EVENT_DATA_STORE', eventDataStoreArn);
  }
}
