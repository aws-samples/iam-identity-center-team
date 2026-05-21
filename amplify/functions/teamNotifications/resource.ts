import { BundlingOutput, DockerImage, Duration, Stack } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { appIdLower } from '../../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TeamNotificationsProps {
    stack: Stack;
    env: string;
    settingsTableName: string;
    snsTopicArn: string;
}

export function createTeamNotifications(props: TeamNotificationsProps): lambda.Function {
    const { stack, env, settingsTableName, snsTopicArn } = props;

    const fn = new lambda.Function(stack, 'TeamNotifications', {
        functionName: `teamNotifications-${appIdLower}-${env}`,
        runtime: lambda.Runtime.PYTHON_3_10,
        architecture: lambda.Architecture.ARM_64,
        handler: 'index.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname), {
            bundling: {
                image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.10:latest-arm64'),
                command: [
                    'bash', '-c',
                    'pip install -r requirements.txt -t /asset-output && cp -r . /asset-output/',
                ],
                outputType: BundlingOutput.AUTO_DISCOVER,
                local: {
                    tryBundle(outputDir: string) {
                        try {
                            execSync('pip --version');
                        } catch {
                            return false;
                        }
                        execSync(`pip install -r "${path.join(__dirname, 'requirements.txt')}" --target "${outputDir}"`);
                        execSync(`cp -r "${__dirname}/"* "${outputDir}/"`);
                        return true;
                    },
                },
            },
        }),
        timeout: Duration.seconds(120),
        memorySize: 128,
        environment: {
            ENV: env,
            REGION: stack.region,
            SETTINGS_TABLE_NAME: settingsTableName,
        },
    });

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dynamodb:GetItem'],
        resources: [stack.formatArn({
            service: 'dynamodb',
            resource: 'table',
            resourceName: settingsTableName,
        })],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail'],
        resources: ['*'],
    }));

    fn.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: [snsTopicArn],
    }));

    return fn;
}
