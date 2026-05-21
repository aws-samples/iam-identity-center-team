import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamgetOUAccountsProps {
    stack: Stack;
    env: string;
    cacheTableName: string;
    cacheTtl?: number;
}

export function createTeamgetOUAccounts(props: TeamgetOUAccountsProps): lambda.Function {
    const { stack, env, cacheTableName } = props;
    const cacheTtl = props.cacheTtl ?? 604800;

    const fn = new lambda.Function(stack, 'TeamgetOUAccounts', {
        functionName: `teamgetOUAccounts-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(30),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
            ACCOUNT_ID: stack.account,
            CACHE_TABLE_NAME: cacheTableName,
            CACHE_TTL: cacheTtl.toString(),
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['organizations:DescribeOrganization', 'organizations:ListAccountsForParent'],
        resources: ['*'],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: cacheTableName }),
        ],
    }));

    return fn;
}
