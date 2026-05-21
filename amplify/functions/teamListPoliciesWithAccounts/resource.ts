import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamListPoliciesWithAccountsProps {
    stack: Stack;
    env: string;
    policiesTableName: string;
    cacheTableName: string;
    settingsTableName: string;
    cacheTtl?: number;
}

export function createTeamListPoliciesWithAccounts(props: TeamListPoliciesWithAccountsProps): lambda.Function {
    const { stack, env, policiesTableName, cacheTableName, settingsTableName } = props;
    const cacheTtl = props.cacheTtl ?? 604800;

    const fn = new lambda.Function(stack, 'TeamListPoliciesWithAccounts', {
        functionName: `teamListPoliciesWithAccounts-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(60),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
            POLICIES_TABLE_NAME: policiesTableName,
            CACHE_TABLE_NAME: cacheTableName,
            SETTINGS_TABLE_NAME: settingsTableName,
            CACHE_TTL: cacheTtl.toString(),
            ACCOUNT_ID: stack.account,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'dynamodb:Scan',
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
        ],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: policiesTableName }),
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: cacheTableName }),
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: settingsTableName }),
        ],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'organizations:DescribeOrganization',
            'organizations:ListAccountsForParent',
        ],
        resources: ['*'],
    }));

    return fn;
}
