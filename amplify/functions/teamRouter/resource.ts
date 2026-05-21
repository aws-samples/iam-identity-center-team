import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';
import { StepFunctionsOutput } from '../../custom/stepfunctions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamRouterProps {
    stack: Stack;
    env: string;
    graphqlApiEndpoint: string;
    graphqlApiId: string;
    userPoolId: string;
    snsTopicArn: string;
    ssoLoginUrl: string;
    teamStatusArn: string;
    teamNotificationsArn: string;
    stepFunctions: StepFunctionsOutput;
    tableNames: {
        Eligibility: string;
        Settings: string;
        Approvers: string;
        requests: string;
        Policies: string;
    };
    sharedPythonLayer: lambda.ILayerVersion;
    requestsTable: dynamodb.ITable;
}

export function createTeamRouter(props: TeamRouterProps): lambda.Function {
    const { stack, env, sharedPythonLayer } = props;

    const fn = new lambda.Function(stack, 'TeamRouter', {
        functionName: `teamRouter-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(120),
        memorySize: 128,
        layers: [sharedPythonLayer],
        environment: {
            ENV: env,
            REGION: stack.region,
            API_TEAM_GRAPHQLAPIENDPOINTOUTPUT: props.graphqlApiEndpoint,
            API_TEAM_GRAPHQLAPIIDOUTPUT: props.graphqlApiId,
            AUTH_TEAM06DBB7FC_USERPOOLID: props.userPoolId,
            NOTIFICATION_TOPIC_ARN: props.snsTopicArn,
            SSO_LOGIN_URL: props.ssoLoginUrl,
            FN_TEAMSTATUS_ARN: props.teamStatusArn,
            FN_TEAMNOTIFICATIONS_ARN: props.teamNotificationsArn,
            GRANT_SM: props.stepFunctions.grantSmArn,
            REVOKE_SM: props.stepFunctions.revokeSmArn,
            REJECT_SM: props.stepFunctions.rejectSmArn,
            SCHEDULE_SM: props.stepFunctions.scheduleSmArn,
            APPROVAL_SM: props.stepFunctions.approvalSmArn,
            POLICY_TABLE_NAME: props.tableNames.Eligibility,
            SETTINGS_TABLE_NAME: props.tableNames.Settings,
            APPROVER_TABLE_NAME: props.tableNames.Approvers,
            REQUESTS_TABLE_NAME: props.tableNames.requests,
            POLICIES_TABLE_NAME: props.tableNames.Policies,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'identitystore:ListUsers',
            'identitystore:GetUserId',
            'identitystore:ListGroupMembershipsForMember',
            'identitystore:ListGroupMemberships',
            'identitystore:DescribeUser',
            'sso:ListInstances',
            'sso:DescribePermissionSet',
            'organizations:Describe*',
            'organizations:List*',
        ],
        resources: ['*'],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [
            props.stepFunctions.grantSmArn,
            props.stepFunctions.revokeSmArn,
            props.stepFunctions.rejectSmArn,
            props.stepFunctions.scheduleSmArn,
            props.stepFunctions.approvalSmArn,
        ],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: props.tableNames.Eligibility }),
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: props.tableNames.Settings }),
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: props.tableNames.Approvers }),
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: props.tableNames.Policies }),
        ],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [
            stack.formatArn({ service: 'cognito-idp', resource: 'userpool', resourceName: props.userPoolId }),
        ],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['appsync:GraphQL'],
        resources: [`arn:aws:appsync:${stack.region}:${stack.account}:apis/${props.graphqlApiId}/*`],
    }));

    // Add DynamoDB Stream event source for requests table (triggers on INSERT/MODIFY/REMOVE)
    fn.addEventSource(
        new DynamoEventSource(props.requestsTable, {
            startingPosition: StartingPosition.LATEST,
            batchSize: 10,
            bisectBatchOnError: true,
            retryAttempts: 3,
        })
    );

    // IAM permissions for DynamoDB Stream access
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'dynamodb:DescribeStream',
            'dynamodb:GetRecords',
            'dynamodb:GetShardIterator',
            'dynamodb:ListStreams',
        ],
        resources: [`${props.requestsTable.tableArn}/stream/*`],
    }));

    return fn;
}
