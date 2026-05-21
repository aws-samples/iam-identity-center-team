import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamvalidateRequestProps {
    stack: Stack;
    env: string;
    eligibilityTableName: string;
    policiesTableName: string;
}

export function createTeamvalidateRequest(props: TeamvalidateRequestProps): lambda.Function {
    const { stack, env, eligibilityTableName, policiesTableName } = props;

    const fn = new lambda.Function(stack, 'TeamvalidateRequest', {
        functionName: `teamvalidateRequest-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(30),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
            ELIGIBILITY_TABLE_NAME: eligibilityTableName,
            POLICIES_TABLE_NAME: policiesTableName,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem', 'dynamodb:BatchGetItem', 'dynamodb:Query'],
        resources: [
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: eligibilityTableName }),
            stack.formatArn({ service: 'dynamodb', resource: 'table', resourceName: policiesTableName }),
        ],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['organizations:ListParents'],
        resources: ['*'],
    }));

    return fn;
}
