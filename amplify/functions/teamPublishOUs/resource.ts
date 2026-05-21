import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamPublishOUsProps {
    stack: Stack;
    env: string;
    graphqlApiEndpoint: string;
    graphqlApiId: string;
    sharedPythonLayer: lambda.ILayerVersion;
}

export function createTeamPublishOUs(props: TeamPublishOUsProps): lambda.Function {
    const { stack, env, graphqlApiEndpoint, graphqlApiId, sharedPythonLayer } = props;

    const fn = new lambda.Function(stack, 'TeamPublishOUs', {
        functionName: `teamPublishOUs-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname)),
        timeout: Duration.seconds(300),
        memorySize: 128,
        layers: [sharedPythonLayer],
        environment: {
            ENV: env,
            REGION: stack.region,
            API_TEAM_GRAPHQLAPIENDPOINTOUTPUT: graphqlApiEndpoint,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['organizations:Describe*', 'organizations:List*'],
        resources: ['*'],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['appsync:GraphQL'],
        resources: [`arn:aws:appsync:${stack.region}:${stack.account}:apis/${graphqlApiId}/*`],
    }));

    return fn;
}
