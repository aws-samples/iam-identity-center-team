import { defineBackend } from '@aws-amplify/backend';
import { Tags, CfnOutput } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

// Amplify Gen 2 resources
import { data } from './data/resource';
import { auth } from './auth/resource';
import { teamStatus } from './functions/teamStatus/resource';
import { teamgetLogs } from './functions/teamgetLogs/resource';
import { teamqueryLogs } from './functions/teamqueryLogs/resource';
import * as dataResource from './data/resource';
import * as authResource from './auth/resource';
import * as teamStatusResource from './functions/teamStatus/resource';
import * as teamgetLogsResource from './functions/teamgetLogs/resource';
import * as teamqueryLogsResource from './functions/teamqueryLogs/resource';

// Custom resources
import { createSnsTopic } from './custom/sns';
import { createStepFunctions } from './custom/stepfunctions';
import { cloudTrailLake } from './custom/cloudtrailLake';
import { createCwLogRole } from './custom/appsyncCloudwatchLogRole';

// Python functions
import { createTeamNotifications } from './functions/teamNotifications/resource';
import { createPythonFunctions } from './functions/pythonFunctions';
import { createTeamRouter } from './functions/teamRouter/resource';
import { createTeamPreTokenGeneration } from './functions/teamPreTokenGeneration/resource';
import { createTeamDeleteApproverGroups } from './functions/teamDeleteApproverGroups/resource';
import { createTeamDeletePolicies } from './functions/teamDeletePolicies/resource';

// Shared configuration
import { branchName, settingsTableSsmPath, appUrl } from './config';

// Define backend with Amplify Gen 2 resources
const backend = defineBackend({
    data,
    auth,
    teamStatus,
    teamgetLogs,
    teamqueryLogs,
});

export type Backend = typeof backend;

// Get the data stack for Python functions (used as @function resolvers)
// This avoids circular dependency: data -> custom -> data
const dataStack = backend.data.stack;

// Cache TTL from environment (default 7 days = 604800 seconds)
const cacheTtl = parseInt(process.env.CACHE_TTL ?? '604800', 10);

// Get dynamic table names from Amplify-generated tables
const tableNames = {
    requests: backend.data.resources.tables['requests'].tableName,
    sessions: backend.data.resources.tables['sessions'].tableName,
    Approvers: backend.data.resources.tables['Approvers'].tableName,
    Settings: backend.data.resources.tables['Settings'].tableName,
    Eligibility: backend.data.resources.tables['Eligibility'].tableName,
    Policies: backend.data.resources.tables['Policies'].tableName,
    OUAccountsCache: backend.data.resources.tables['OUAccountsCache'].tableName,
};

// Create SSM parameter for Settings table name (used by preToken Lambda in auth stack)
const settingsTableParam = new ssm.StringParameter(dataStack, 'SettingsTableNameParam', {
    parameterName: settingsTableSsmPath,
    stringValue: tableNames.Settings,
    description: 'Settings DynamoDB table name for TEAM application',
});

// 1. Create SNS Topic in data stack
const snsTopic = createSnsTopic(dataStack, branchName);

// 2. Create teamNotifications in data stack (needed by Step Functions)
const teamNotifications = createTeamNotifications({
    stack: dataStack,
    env: branchName,
    settingsTableName: tableNames.Settings,
    snsTopicArn: snsTopic.topicArn,
});

// 3. Create Step Functions in data stack
const stepFunctions = createStepFunctions(
    dataStack,
    branchName,
    backend.teamStatus.resources.lambda.functionArn,
    teamNotifications.functionArn
);

// 4. Pre-token generation Lambda - in auth stack (no cross-stack dependency)
// Uses SSM parameter to get Settings table name (avoids circular dependency)
const authStack = backend.auth.stack;
const preTokenGeneration = createTeamPreTokenGeneration({
    stack: authStack,
    env: branchName,
    teamAdminGroup: process.env.TEAM_ADMIN_GROUP,
    teamAuditorGroup: process.env.TEAM_AUDITOR_GROUP,
    settingsTableSsmPath: settingsTableSsmPath,
});

// Grant Cognito permission to invoke the Lambda (same stack - no cross-stack reference)
preTokenGeneration.addPermission('CognitoInvoke', {
    principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
    sourceArn: backend.auth.resources.userPool.userPoolArn,
});

// 5. Configure Cognito trigger via escape hatch (same stack - no circular dependency)
const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.lambdaConfig = {
    preTokenGeneration: preTokenGeneration.functionArn,
};

// 6. Create Python resolver functions in data stack
const pythonFunctions = createPythonFunctions({
    stack: dataStack,
    env: branchName,
    graphqlApiEndpoint: backend.data.graphqlUrl,
    graphqlApiId: backend.data.apiId,
    snsTopicArn: snsTopic.topicArn,
    tableNames,
    teamAdminGroup: process.env.TEAM_ADMIN_GROUP,
    teamAuditorGroup: process.env.TEAM_AUDITOR_GROUP,
    cacheTtl,
});

// 7. Create teamRouter in data stack
const teamRouter = createTeamRouter({
    stack: dataStack,
    env: branchName,
    graphqlApiEndpoint: backend.data.graphqlUrl,
    graphqlApiId: backend.data.apiId,
    userPoolId: backend.auth.resources.userPool.userPoolId,
    snsTopicArn: snsTopic.topicArn,
    ssoLoginUrl: appUrl,
    teamStatusArn: backend.teamStatus.resources.lambda.functionArn,
    teamNotificationsArn: teamNotifications.functionArn,
    stepFunctions,
    tableNames,
    sharedPythonLayer: pythonFunctions.sharedPythonLayer,
    requestsTable: backend.data.resources.tables['requests'],
});

// 8. Create batch delete validation Lambdas (validates before delete)
const teamDeleteApproverGroups = createTeamDeleteApproverGroups({
    stack: dataStack,
    env: branchName,
    policiesTableName: tableNames.Policies,
    approversTableName: tableNames.Approvers,
    sharedPythonLayer: pythonFunctions.sharedPythonLayer,
});

const teamDeletePolicies = createTeamDeletePolicies({
    stack: dataStack,
    env: branchName,
    eligibilityTableName: tableNames.Eligibility,
    policiesTableName: tableNames.Policies,
    sharedPythonLayer: pythonFunctions.sharedPythonLayer,
});

// 9. Create CloudTrail Lake Event Data Store (in data stack - same as log functions)
const cloudTrailAuditLogs = process.env.CLOUDTRAIL_AUDIT_LOGS ?? 'read_write';
const eventDataStoreArn = cloudTrailLake(dataStack, cloudTrailAuditLogs as any);

// 10. Create AppSync CloudWatch Log Role
createCwLogRole(dataStack, branchName);

// Apply escape hatches for Amplify resources
dataResource.applyEscapeHatches(backend);
authResource.applyEscapeHatches(backend);
teamStatusResource.applyEscapeHatches(backend);
teamgetLogsResource.applyEscapeHatches(backend, eventDataStoreArn);
teamqueryLogsResource.applyEscapeHatches(backend, eventDataStoreArn);

// Tag all resources
Tags.of(backend.stack).add('Application', 'TEAM-IDC');
Tags.of(dataStack).add('Application', 'TEAM-IDC');
Tags.of(backend.auth.stack).add('Application', 'TEAM-IDC');

// Export for testing
export { pythonFunctions, teamRouter, stepFunctions, snsTopic, eventDataStoreArn, preTokenGeneration };
