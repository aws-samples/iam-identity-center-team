import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamListGroupsProps {
    stack: Stack;
    env: string;
    sharedPythonLayer?: lambda.ILayerVersion;
}

export function createTeamListGroups(props: TeamListGroupsProps): lambda.Function {
    const { stack, env, sharedPythonLayer } = props;

    const fn = new lambda.Function(stack, 'TeamListGroups', {
        functionName: `teamListGroups-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(120),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
        },
        layers: sharedPythonLayer ? [sharedPythonLayer] : [],
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'identitystore:ListGroupMemberships',
            'sso:ListInstances',
        ],
        resources: ['*'],
    }));

    return fn;
}
