import {ArnFormat, Stack} from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { appIdLower } from '../config';


export function createCwLogRole(stack: Stack, env: string): void {
    const policy = new iam.PolicyDocument({
        statements: [
            new iam.PolicyStatement({
                actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                resources: [stack.formatArn({
                    service: 'logs',
                    resource: 'log-group',
                    resourceName: `/aws/appsync/apis/*`,
                    region: stack.region,
                    account: stack.account,
                    arnFormat: ArnFormat.COLON_RESOURCE_NAME
                })],
                effect: iam.Effect.ALLOW,
            })
        ]
    })
    new iam.Role(stack, 'AppsyncCloudWatchRole', {
        assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
        inlinePolicies: { "appsync-cloudwatch-policy": policy },
        roleName: `AppsyncCloudWatchRole-${appIdLower}-${env}`
    })
}