import { defineData } from '@aws-amplify/backend';
import type { Backend } from '../backend';
import { AmplifyDynamoDbTableWrapper } from '@aws-amplify/graphql-api-construct';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { schema } from './schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const data = defineData({
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
  logging: { fieldLogLevel: 'error', excludeVerboseContent: true },
  schema,
});

export function applyEscapeHatches(backend: Backend) {
  const cfnGraphqlApi = backend.data.resources.cfnResources.cfnGraphqlApi;
  cfnGraphqlApi.additionalAuthenticationProviders = [
    {
      authenticationType: 'AWS_IAM',
    },
  ];

  // Load VTL templates from files (like Gen 1 structure)
  const resolversDir = join(__dirname, 'resolvers');
  const loadTemplate = (filename: string): string => {
    return readFileSync(join(resolversDir, filename), 'utf-8');
  };

  const validationTemplates: Record<string, string> = {
    CreateApproversInit: loadTemplate('Mutation.createApprovers.init.req.vtl'),
    CreateEligibilityInit: loadTemplate('Mutation.createEligibility.init.req.vtl'),
    CreatePoliciesInit: loadTemplate('Mutation.createPolicies.init.req.vtl'),
    CreateRequestsInit: loadTemplate('Mutation.createRequests.init.req.vtl'),
    CreateSettingsInit: loadTemplate('Mutation.createSettings.init.req.vtl'),
    UpdateApproversInit: loadTemplate('Mutation.updateApprovers.init.req.vtl'),
    UpdateEligibilityInit: loadTemplate('Mutation.updateEligibility.init.req.vtl'),
    UpdatePoliciesInit: loadTemplate('Mutation.updatePolicies.init.req.vtl'),
    UpdateRequestsInit: loadTemplate('Mutation.updateRequests.init.req.vtl'),
    UpdateSettingsInit: loadTemplate('Mutation.updateSettings.init.req.vtl'),
  };

  // Override resolvers using cfnResources.cfnResolvers
  const cfnResolvers = backend.data.resources.cfnResources.cfnResolvers;

  // Fix pub/sub mutation response templates
  const pubSubMutations = [
    'Mutation.publishPolicy',
    'Mutation.publishOUs',
    'Mutation.publishPermissions',
  ];

  for (const resolverKey of pubSubMutations) {
    if (cfnResolvers[resolverKey]) {
      cfnResolvers[resolverKey].addPropertyOverride('ResponseMappingTemplate', '$util.toJson($ctx.args.result)');
    }
  }

  // Fix subscription filter for onPublishPolicy
  if (cfnResolvers['Subscription.onPublishPolicy']) {
    cfnResolvers['Subscription.onPublishPolicy'].addPropertyOverride('ResponseMappingTemplate', `$extensions.setSubscriptionFilter({
  "filterGroup": [
    {
      "filters": [
        {
          "fieldName": "username",
          "operator": "eq",
          "value": $context.identity.username
        }
      ]
    }
  ]
})
$util.toJson($context.result)`);
  }

  // Apply validation templates to init functions via cfnFunctionConfigurations
  const validationFunctionMapping: Record<string, string> = {
    'createApprovers': 'CreateApproversInit',
    'updateApprovers': 'UpdateApproversInit',
    'createEligibility': 'CreateEligibilityInit',
    'updateEligibility': 'UpdateEligibilityInit',
    'createPolicies': 'CreatePoliciesInit',
    'updatePolicies': 'UpdatePoliciesInit',
    'createRequests': 'CreateRequestsInit',
    'updateRequests': 'UpdateRequestsInit',
    'createSettings': 'CreateSettingsInit',
    'updateSettings': 'UpdateSettingsInit',
  };

  const cfnFunctions = backend.data.resources.cfnResources.cfnFunctionConfigurations;

  for (const [logicalId, fn] of Object.entries(cfnFunctions)) {
    const fnName = (fn.name as string) || logicalId;

    for (const [mutationName, templateKey] of Object.entries(validationFunctionMapping)) {
      if (fnName.toLowerCase().includes(mutationName.toLowerCase()) &&
          fnName.toLowerCase().includes('init') &&
          validationTemplates[templateKey]) {
        (fn as any).requestMappingTemplateS3Location = undefined;
        (fn as any).requestMappingTemplate = validationTemplates[templateKey];
      }
    }
  }

  // Enable TTL on sessions table (expireAt field)
  const sessionsTable = backend.data.resources.tables['sessions'];
  if (sessionsTable) {
    const sessionsTableResource = sessionsTable.node.defaultChild;
    if (sessionsTableResource && AmplifyDynamoDbTableWrapper.isAmplifyDynamoDbTableResource(sessionsTableResource)) {
      const wrapper = new AmplifyDynamoDbTableWrapper(sessionsTableResource);
      wrapper.timeToLiveAttribute = {
        enabled: true,
        attributeName: 'expireAt',
      };
    }
  }

  // Enable TTL on OUAccountsCache table (ttl field)
  const ouCacheTable = backend.data.resources.tables['OUAccountsCache'];
  if (ouCacheTable) {
    const ouCacheTableResource = ouCacheTable.node.defaultChild;
    if (ouCacheTableResource && AmplifyDynamoDbTableWrapper.isAmplifyDynamoDbTableResource(ouCacheTableResource)) {
      const wrapper = new AmplifyDynamoDbTableWrapper(ouCacheTableResource);
      wrapper.timeToLiveAttribute = {
        enabled: true,
        attributeName: 'ttl',
      };
    }
  }
}
