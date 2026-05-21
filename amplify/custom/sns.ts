import { Stack } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as kms from 'aws-cdk-lib/aws-kms';
import { appIdLower } from '../config';

/**
 * Creates SNS Topic for TEAM notifications.
 *
 * Original Gen 1: amplify/backend/custom/sns/sns-cloudformation-template.json
 *
 * @param stack - CDK Stack where the resource will be created
 * @param env - Environment name (e.g., 'sandbox', 'prod')
 * @returns SNS Topic instance (needed by Step Functions)
 */
export function createSnsTopic(stack: Stack, env: string): sns.Topic {
  // Use AWS managed KMS key for SNS encryption
  // This is equivalent to "KmsMasterKeyId": "alias/aws/sns" in CloudFormation
  const snsKey = kms.Alias.fromAliasName(stack, 'SnsKey', 'alias/aws/sns');

  // Create the SNS Topic
  // Original CloudFormation:
  // {
  //   "Type": "AWS::SNS::Topic",
  //   "Properties": {
  //     "KmsMasterKeyId": "alias/aws/sns",
  //     "TopicName": "TeamNotifications-{env}"
  //   }
  // }
  const topic = new sns.Topic(stack, 'TeamNotificationsTopic', {
    topicName: `TeamNotifications-${appIdLower}-${env}`,
    masterKey: snsKey,
  });

  return topic;
}
