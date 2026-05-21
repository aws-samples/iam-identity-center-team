import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeaminvalidateOUCacheProps {
    stack: Stack;
    env: string;
    cacheTableName: string;
}

export function createTeaminvalidateOUCache(props: TeaminvalidateOUCacheProps): lambda.Function {
    const { stack, env, cacheTableName } = props;

    const fn = new lambda.Function(stack, 'TeaminvalidateOUCache', {
        functionName: `teaminvalidateOUCache-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(30),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
            CACHE_TABLE_NAME: cacheTableName,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:DeleteItem', 'dynamodb:BatchWriteItem'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: cacheTableName }),
        ],
    }));

    return fn;
}
