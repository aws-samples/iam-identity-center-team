import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamPrewarmOUCacheProps {
    stack: Stack;
    env: string;
    policiesTableName: string;
    cacheTableName: string;
    cacheTtl?: number;
    prewarmIntervalDays?: number;
    sharedPythonLayer: lambda.ILayerVersion;
}

export function createTeamPrewarmOUCache(props: TeamPrewarmOUCacheProps): lambda.Function {
    const { stack, env, policiesTableName, cacheTableName, sharedPythonLayer } = props;
    const cacheTtl = props.cacheTtl ?? 604800;
    const prewarmIntervalDays = props.prewarmIntervalDays ?? 1;

    const fn = new lambda.Function(stack, 'TeamPrewarmOUCache', {
        functionName: `teamPrewarmOUCache-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.minutes(5),
        memorySize: 256,
        layers: [sharedPythonLayer],
        environment: {
            ENV: env,
            REGION: stack.region,
            ACCOUNT_ID: stack.account,
            POLICIES_TABLE_NAME: policiesTableName,
            CACHE_TABLE_NAME: cacheTableName,
            CACHE_TTL: cacheTtl.toString(),
        },
    });

    // DynamoDB permissions
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:Scan'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: policiesTableName }),
        ],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: cacheTableName }),
        ],
    }));

    // Organizations API permissions
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['organizations:DescribeOrganization', 'organizations:ListAccountsForParent'],
        resources: ['*'],
    }));

    // EventBridge scheduled rule
    const rule = new events.Rule(stack, 'PrewarmOUCacheSchedule', {
        ruleName: `prewarmOUCache-${appIdLower}-${env}`,
        description: `Pre-warm OU cache every ${prewarmIntervalDays} day(s)`,
        schedule: events.Schedule.rate(Duration.days(prewarmIntervalDays)),
    });

    rule.addTarget(new targets.LambdaFunction(fn));

    return fn;
}
