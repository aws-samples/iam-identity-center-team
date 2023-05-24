import { AmplifyApiGraphQlResourceStackTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(resources: AmplifyApiGraphQlResourceStackTemplate) { 
  resources.api.GraphQLAPI.xrayEnabled = true
  resources.api.GraphQLAPI.addPropertyOverride('LogConfig', {
    FieldLogLevel: 'ERROR',
    ExcludeVerboseContent: true,
    CloudWatchLogsRoleArn: {
      'Fn::Join': [
        '',
        [
          'arn:aws:iam::',
          { Ref: 'AWS::AccountId' },
          ':role/AppsyncCloudWatchRole-',
          { Ref: 'env' },
        ],
      ],
    },
})
}