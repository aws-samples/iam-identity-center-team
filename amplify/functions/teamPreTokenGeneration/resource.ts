import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamPreTokenGenerationProps {
    stack: Stack;
    env: string;
    teamAdminGroup?: string;
    teamAuditorGroup?: string;
    settingsTableSsmPath: string;
}

export function createTeamPreTokenGeneration(props: TeamPreTokenGenerationProps): lambda.Function {
    const { stack, env, teamAdminGroup, teamAuditorGroup, settingsTableSsmPath } = props;

    const fn = new lambda.Function(stack, 'TeamPreTokenGeneration', {
        functionName: `teamPreTokenGeneration-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_11,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(120),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
            TEAM_ADMIN_GROUP: teamAdminGroup ?? '',
            TEAM_AUDITOR_GROUP: teamAuditorGroup ?? '',
            SETTINGS_TABLE_SSM_PATH: settingsTableSsmPath,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'identitystore:GetUserId',
            'identitystore:GetGroupId',
            'identitystore:ListGroupMembershipsForMember',
            'sso:ListInstances',
        ],
        resources: ['*'],
    }));

    // SSM permission to read Settings table name
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${stack.region}:${stack.account}:parameter${settingsTableSsmPath}`],
    }));

    // DynamoDB GetItem on Settings table (name resolved at runtime from SSM)
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [`arn:aws:dynamodb:${stack.region}:${stack.account}:table/Settings-*`],
    }));

    return fn;
}
