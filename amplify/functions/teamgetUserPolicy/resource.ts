import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamgetUserPolicyProps {
    stack: Stack;
    env: string;
}

export function createTeamgetUserPolicy(props: TeamgetUserPolicyProps): lambda.Function {
    const { stack, env } = props;

    const fn = new lambda.Function(stack, 'TeamgetUserPolicy', {
        functionName: `teamgetUserPolicy-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(25),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
        },
    });

    return fn;
}
