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
    sharedPythonLayer: lambda.ILayerVersion;
}

export function createTeamListPoliciesWithAccounts(props: TeamListPoliciesWithAccountsProps): lambda.Function {
    const { stack, env, policiesTableName, cacheTableName, settingsTableName, sharedPythonLayer } = props;
    const cacheTtl = props.cacheTtl ?? 604800;

    const fn = new lambda.Function(stack, 'TeamListPoliciesWithAccounts', {
        functionName: `teamListPoliciesWithAccounts-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(60),
        memorySize: 128,
        layers: [sharedPythonLayer],
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

    // Policies table - only scan
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Scan'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: policiesTableName }),
        ],
    }));

    // Settings table - only read
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: settingsTableName }),
        ],
    }));

    // Cache table - full CRUD for OUCache
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: cacheTableName }),
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
