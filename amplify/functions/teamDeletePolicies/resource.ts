import { Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamDeletePoliciesProps {
    stack: Stack;
    env: string;
    sharedPythonLayer?: lambda.ILayerVersion;
    eligibilityTableName: string;
    policiesTableName: string;
}

export function createTeamDeletePolicies(props: TeamDeletePoliciesProps): lambda.Function {
    const { stack, env, sharedPythonLayer, eligibilityTableName, policiesTableName } = props;

    const fn = new lambda.Function(stack, 'TeamDeletePolicies', {
        functionName: `teamDeletePolicies-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_10,
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
        layers: sharedPythonLayer ? [sharedPythonLayer] : [],
    });

    // Grant read access to Eligibility table (to check usage)
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'dynamodb:Scan',
            'dynamodb:Query',
        ],
        resources: [
            `arn:aws:dynamodb:${stack.region}:${stack.account}:table/${eligibilityTableName}`,
            `arn:aws:dynamodb:${stack.region}:${stack.account}:table/${eligibilityTableName}/index/*`,
        ],
    }));

    // Grant read/delete access to Policies table
    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
            'dynamodb:GetItem',
            'dynamodb:DeleteItem',
        ],
        resources: [
            `arn:aws:dynamodb:${stack.region}:${stack.account}:table/${policiesTableName}`,
        ],
    }));

    return fn;
}
