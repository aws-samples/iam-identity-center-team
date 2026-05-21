import {ArnFormat, Duration, Stack} from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import {Construct} from "constructs";
import { appIdLower } from '../config';

interface StepFunctionProps {
    env: string;
    definition: sfn.DefinitionBody;
    policyStatements: iam.PolicyStatement[];
    logGroup: logs.LogGroup;
}

function capitalize(s: string): string {
    return  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

class TeamStepMachine extends Construct {
    public readonly stateMachine: sfn.StateMachine;
    constructor(scope: Construct, id: string, props: StepFunctionProps) {
      super(scope, id);
      const sfnRole = new iam.Role(this, `TEAM${capitalize(id)}SMRole`, {
        assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });
      props.policyStatements.forEach(statement => sfnRole.addToPolicy(statement));
      this.stateMachine = new sfn.StateMachine(this, `${capitalize(id)}StateMachine`, {
        stateMachineName: `TEAM-${capitalize(id)}-SM-${appIdLower}-${props.env}`,
        definitionBody: props.definition,
        role: sfnRole,
        logs: {
          destination: props.logGroup,
          level: sfn.LogLevel.ALL,
          includeExecutionData: true,
        },
        tracingEnabled: true,
      });
    }


}

export interface StepFunctionsOutput {
    grantSmArn: string;
    revokeSmArn: string;
    rejectSmArn: string;
    scheduleSmArn: string;
    approvalSmArn: string;
}

export function createStepFunctions(stack: Stack, env: string, functionTeamStatusArn: string, functionTeamNotificationsArn: string): StepFunctionsOutput {
    const logGroupArn = stack.formatArn({
        partition: stack.partition,
        account: stack.account,
        region: stack.region,
        service: 'logs',
        resource: 'log-group',
        resourceName: `/aws/stepfunction/team-step-function/${appIdLower}-${env}`,
        arnFormat: ArnFormat.COLON_RESOURCE_NAME
    })

    const kmsLog = new kms.Key(stack, 'LogGroupKey', {
        enableKeyRotation: true,
        description: "TEAM Stepfunction CloudwatchLog Key",
        pendingWindow: Duration.days(20),
        policy: new iam.PolicyDocument({
            statements: [
                // Allow root account full access
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.AccountRootPrincipal()],
                    actions: ['kms:*'],
                    resources: ['*'],
                }),
                // Allow CloudWatch Logs to use the key
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.ServicePrincipal(`logs.${stack.region}.amazonaws.com`)],
                    actions: [
                        'kms:Encrypt*',
                        'kms:Decrypt*',
                        'kms:ReEncrypt*',
                        'kms:GenerateDataKey*',
                        'kms:Describe*',
                    ],
                    resources: ['*'],
                    conditions: {
                        ArnEquals: {
                            'kms:EncryptionContext:aws:logs:arn': logGroupArn,
                        },
                    },
                }),
            ],
        }),
    });

    const logGroup = new logs.LogGroup(stack, 'TEAMStateMachineLogGroup', {
        encryptionKey: kmsLog,
        logGroupName: `/aws/stepfunction/team-step-function/${appIdLower}-${env}`,
        retention: logs.RetentionDays.TWO_WEEKS,
    });

    // Common policy statements
    const logsPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'logs:CreateLogDelivery',
            'logs:GetLogDelivery',
            'logs:UpdateLogDelivery',
            'logs:DeleteLogDelivery',
            'logs:ListLogDeliveries',
            'logs:PutResourcePolicy',
            'logs:DescribeResourcePolicies',
            'logs:DescribeLogGroups',
        ],
        resources: ['*'],
    });

    const lambdaStatusPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [functionTeamStatusArn],
    });

    const lambdaNotificationsPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [functionTeamNotificationsArn],
    });

    const dynamoDbPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:UpdateItem', 'dynamodb:GetItem'],
        resources: [stack.formatArn({
            service: 'dynamodb',
            resource: 'table',
            resourceName: 'requests*',
        })],
    });

    // ========== REJECT STATE MACHINE ==========
    const rejectDefinition = {
        Comment: "Temporary Elevated Access Management - Reject state machine",
        StartAt: "Status?",
        States: {
            "Status?": {
                Type: "Choice",
                Choices: [
                    { Variable: "$.status", StringEquals: "cancelled", Next: "Notify Requester Cancelled" },
                    { Variable: "$.status", StringEquals: "rejected", Next: "Notify Requester Rejected" }
                ]
            },
            "Notify Requester Cancelled": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Success", ResultPath: "$.error" }],
                Next: "Success"
            },
            "Notify Requester Rejected": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Success", ResultPath: "$.error" }],
                Next: "Success"
            },
            "Success": { Type: "Succeed" }
        }
    };

    const rejectSM = new TeamStepMachine(stack, 'Reject', {
        env: env,
        definition: sfn.DefinitionBody.fromString(JSON.stringify(rejectDefinition)),
        policyStatements: [logsPolicy, lambdaNotificationsPolicy],
        logGroup: logGroup,
    });

    // ========== APPROVAL STATE MACHINE ==========
    const approvalDefinition = {
        Comment: "Temporary Elevated Access Management - Approval state machine",
        StartAt: "Notify Approvers Pending",
        States: {
            "Notify Approvers Pending": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Wait", ResultPath: "$.error" }],
                Next: "Wait"
            },
            "Wait": { Type: "Wait", SecondsPath: "$.expire", Next: "DynamoDB GetStatus" },
            "DynamoDB GetStatus": {
                Type: "Task",
                Resource: "arn:aws:states:::dynamodb:getItem",
                Parameters: { "TableName.$": "$.requests_table", "Key": { "id": { "S.$": "$.id" } } },
                ResultPath: "$.result",
                Next: "Pending?"
            },
            "Pending?": {
                Type: "Choice",
                Choices: [{ Variable: "$.result.Item.status.S", StringEquals: "pending", Next: "Update Request Status" }],
                Default: "Pass"
            },
            "Update Request Status": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamstatus_arn", "Payload.$": "$" },
                ResultPath: "$.Payload",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Next: "Update Status Field"
            },
            "Update Status Field": { Type: "Pass", Result: "expired", ResultPath: "$.status", Next: "Notify Requester Expired" },
            "Notify Requester Expired": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Pass", ResultPath: "$.error" }],
                End: true
            },
            "Pass": { Type: "Pass", End: true }
        }
    };

    const approvalSM = new TeamStepMachine(stack, 'Approval', {
        env: env,
        definition: sfn.DefinitionBody.fromString(JSON.stringify(approvalDefinition)),
        policyStatements: [logsPolicy, lambdaStatusPolicy, lambdaNotificationsPolicy, dynamoDbPolicy],
        logGroup: logGroup,
    });

    // ========== REVOKE STATE MACHINE ==========
    const revokeDefinition = {
        Comment: "Temporary Elevated Access Management - Revoke state machine",
        StartAt: "DynamoDB GetStatus",
        States: {
            "DynamoDB GetStatus": {
                Type: "Task",
                Resource: "arn:aws:states:::dynamodb:getItem",
                Parameters: { "TableName.$": "$.requests_table", "Key": { "id": { "S.$": "$.id" } } },
                ResultPath: "$.data",
                Next: "Revoked?"
            },
            "Revoked?": {
                Type: "Choice",
                Choices: [{
                    And: [
                        { Variable: "$.data.Item.status.S", StringEquals: "revoked" },
                        { Variable: "$.result", IsPresent: true }
                    ],
                    Next: "Pass"
                }],
                Default: "Revoke Permission"
            },
            "Revoke Permission": {
                Type: "Task",
                Resource: "arn:aws:states:::aws-sdk:ssoadmin:deleteAccountAssignment",
                Parameters: {
                    "InstanceArn.$": "$.instanceARN",
                    "PermissionSetArn.$": "$.roleId",
                    "PrincipalId.$": "$.userId",
                    "PrincipalType": "USER",
                    "TargetId.$": "$.accountId",
                    "TargetType": "AWS_ACCOUNT"
                },
                ResultPath: "$.revoke",
                Retry: [{ ErrorEquals: ["SsoAdmin.ThrottlingException", "ThrottlingException", "ServiceUnavailable", "InternalServerError"], IntervalSeconds: 3, MaxAttempts: 5, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Update Request Status", ResultPath: "$.statusError" }],
                Next: "Notify Requester Session Ended"
            },
            "Notify Requester Session Ended": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Revoked || Ended ?", ResultPath: "$.error" }],
                Next: "Revoked || Ended ?"
            },
            "Revoked || Ended ?": {
                Type: "Choice",
                Choices: [{ Variable: "$.data.Item.status.S", StringEquals: "revoked", Next: "DynamoDB Update EndTime" }],
                Default: "Update Request Status"
            },
            "Update Request Status": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamstatus_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Next: "Revoke Error?"
            },
            "Revoke Error?": {
                Type: "Choice",
                Choices: [{ Variable: "$.statusError", IsPresent: true, Next: "Notify Error" }],
                Default: "DynamoDB Update EndTime"
            },
            "Notify Error": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                End: true
            },
            "DynamoDB Update EndTime": {
                Type: "Task",
                Resource: "arn:aws:states:::dynamodb:updateItem",
                Parameters: {
                    "TableName.$": "$.requests_table",
                    "Key": { "id": { "S.$": "$.id" } },
                    "UpdateExpression": "SET endTime = :time",
                    "ExpressionAttributeValues": { ":time": { "S.$": "$$.State.EnteredTime" } }
                },
                End: true
            },
            "Pass": { Type: "Pass", End: true }
        }
    };

    const ssoRevokePolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sso:DeleteAccountAssignment'],
        resources: ['*'],
    });

    const revokeSM = new TeamStepMachine(stack, 'Revoke', {
        env: env,
        definition: sfn.DefinitionBody.fromString(JSON.stringify(revokeDefinition)),
        policyStatements: [logsPolicy, lambdaStatusPolicy, lambdaNotificationsPolicy, dynamoDbPolicy, ssoRevokePolicy],
        logGroup: logGroup,
    });

    // ========== GRANT STATE MACHINE ==========
    const grantDefinition = {
        Comment: "Temporary Elevated Access Management - Grant state machine",
        StartAt: "Grant Permission",
        States: {
            "Grant Permission": {
                Type: "Task",
                Resource: "arn:aws:states:::aws-sdk:ssoadmin:createAccountAssignment",
                Parameters: {
                    "InstanceArn.$": "$.instanceARN",
                    "PermissionSetArn.$": "$.roleId",
                    "PrincipalId.$": "$.userId",
                    "PrincipalType": "USER",
                    "TargetId.$": "$.accountId",
                    "TargetType": "AWS_ACCOUNT"
                },
                ResultPath: "$.grant",
                Retry: [{ ErrorEquals: ["SsoAdmin.ThrottlingException", "ThrottlingException", "ServiceUnavailable", "InternalServerError"], IntervalSeconds: 3, MaxAttempts: 5, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Update Request Status - in progress", ResultPath: "$.statusError" }],
                Next: "Update Request Status - in progress"
            },
            "Update Request Status - in progress": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamstatus_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Next: "DynamoDB UpdateStartTime"
            },
            "DynamoDB UpdateStartTime": {
                Type: "Task",
                Resource: "arn:aws:states:::dynamodb:updateItem",
                Parameters: {
                    "TableName.$": "$.requests_table",
                    "Key": { "id": { "S.$": "$.id" } },
                    "UpdateExpression": "SET startTime = :time",
                    "ExpressionAttributeValues": { ":time": { "S.$": "$$.State.EnteredTime" } }
                },
                ResultPath: "$.lastTaskResult",
                Next: "Grant Error?"
            },
            "Grant Error?": {
                Type: "Choice",
                Choices: [{ Variable: "$.statusError", IsPresent: true, Next: "Notify Error" }],
                Default: "Notify Started"
            },
            "Notify Error": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                End: true
            },
            "Notify Started": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Wait", ResultPath: "$.error" }],
                Next: "Wait"
            },
            "Wait": { Type: "Wait", SecondsPath: "$.duration", Next: "Revoke Permission" },
            "Revoke Permission": {
                Type: "Task",
                Resource: "arn:aws:states:::states:startExecution",
                Parameters: { "StateMachineArn.$": "$.revoke_sm", "Input.$": "$" },
                End: true
            }
        }
    };

    const ssoGrantPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sso:CreateAccountAssignment'],
        resources: ['*'],
    });

    const startRevokeSmPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [revokeSM.stateMachine.stateMachineArn],
    });

    const grantSM = new TeamStepMachine(stack, 'Grant', {
        env: env,
        definition: sfn.DefinitionBody.fromString(JSON.stringify(grantDefinition)),
        policyStatements: [logsPolicy, lambdaStatusPolicy, lambdaNotificationsPolicy, dynamoDbPolicy, ssoGrantPolicy, startRevokeSmPolicy],
        logGroup: logGroup,
    });

    // ========== SCHEDULE STATE MACHINE ==========
    const scheduleDefinition = {
        Comment: "Temporary Elevated Access Management - Schedule state machine",
        StartAt: "Update Request Status - scheduled",
        States: {
            "Update Request Status - scheduled": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamstatus_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Next: "Notify Requester Scheduled"
            },
            "Notify Requester Scheduled": {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                Parameters: { "FunctionName.$": "$.fn_teamnotifications_arn", "Payload.$": "$" },
                ResultPath: "$.lastTaskResult",
                Retry: [{ ErrorEquals: ["Lambda.ServiceException", "Lambda.AWSLambdaException", "Lambda.SdkClientException", "Lambda.TooManyRequestsException"], IntervalSeconds: 2, MaxAttempts: 6, BackoffRate: 2 }],
                Catch: [{ ErrorEquals: ["States.ALL"], Next: "Schedule", ResultPath: "$.error" }],
                Next: "Schedule"
            },
            "Schedule": { Type: "Wait", TimestampPath: "$.startTime", Next: "DynamoDB GetStatus" },
            "DynamoDB GetStatus": {
                Type: "Task",
                Resource: "arn:aws:states:::dynamodb:getItem",
                Parameters: { "TableName.$": "$.requests_table", "Key": { "id": { "S.$": "$.id" } } },
                ResultPath: "$.result",
                Next: "Scheduled?"
            },
            "Scheduled?": {
                Type: "Choice",
                Choices: [{ Variable: "$.result.Item.status.S", StringEquals: "scheduled", Next: "Grant Permission" }],
                Default: "Pass"
            },
            "Grant Permission": {
                Type: "Task",
                Resource: "arn:aws:states:::states:startExecution",
                Parameters: { "StateMachineArn.$": "$.grant_sm", "Input.$": "$" },
                End: true
            },
            "Pass": { Type: "Pass", End: true }
        }
    };

    const startGrantSmPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['states:StartExecution'],
        resources: [grantSM.stateMachine.stateMachineArn],
    });

    const scheduleSM = new TeamStepMachine(stack, 'Schedule', {
        env: env,
        definition: sfn.DefinitionBody.fromString(JSON.stringify(scheduleDefinition)),
        policyStatements: [logsPolicy, lambdaStatusPolicy, lambdaNotificationsPolicy, dynamoDbPolicy, startGrantSmPolicy],
        logGroup: logGroup,
    });

    return {
        grantSmArn: grantSM.stateMachine.stateMachineArn,
        revokeSmArn: revokeSM.stateMachine.stateMachineArn,
        rejectSmArn: rejectSM.stateMachine.stateMachineArn,
        scheduleSmArn: scheduleSM.stateMachine.stateMachineArn,
        approvalSmArn: approvalSM.stateMachine.stateMachineArn,
    };
}

