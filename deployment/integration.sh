# Copyright 2022 Amazon Web Services, Inc
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License 

#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!/usr/bin/env bash

. "./parameters.sh"

if [ -z "$TEAM_ACCOUNT" ]; then 
  export AWS_PROFILE=$ORG_MASTER_PROFILE
else 
  export AWS_PROFILE=$TEAM_ACCOUNT_PROFILE
fi

green='\033[0;32m'
clear='\033[0m'
cognitoUserpoolId=`aws cognito-idp list-user-pools --region $REGION --max-results 10 --output json | jq -r '.UserPools[] | select(.Name | contains("team06dbb7fc")) | .Id'`
cognitouserpoolhostedUIdomain=`aws cognito-idp describe-user-pool --region $REGION --user-pool-id $cognitoUserpoolId --output json | jq -r '.UserPool.Domain'`
cognitoClientWebClientID=`aws cognito-idp list-user-pool-clients --region $REGION --user-pool-id $cognitoUserpoolId --output json | jq -r '.UserPoolClients[] | select(.ClientName | contains("clientWeb")) | .ClientId'`
cognitoHostedUIdomain=$cognitouserpoolhostedUIdomain.auth.$REGION.amazoncognito.com

amplifyAppId=`aws amplify list-apps --region $REGION --output json | jq -r '.apps[] | select(.name=="TEAM-IDC-APP") | .appId'`
amplifyDomain=`aws amplify list-apps --region $REGION --output json | jq -r '.apps[] | select(.name=="TEAM-IDC-APP") | .defaultDomain'`
amplifyDomain="main.$amplifyDomain"

amplifyCustomDomains=`aws amplify list-domain-associations --region $REGION --app-id $amplifyAppId --output json`
amplifyCustomDomain=`echo $amplifyCustomDomains | jq -r 'select(.domainAssociations | length > 0) | .domainAssociations[0].domainName'`

if [ -n "$amplifyCustomDomain" ]; then
  amplifyCustomDomainPrefix=$(echo $amplifyCustomDomains | jq -r 'select(.domainAssociations | length > 0) | .domainAssociations[0].subDomains[] | select(.subDomainSetting.branchName=="main") | .subDomainSetting.prefix')
  amplifyDomain=$([ -z "$amplifyCustomDomainPrefix" ] && echo $amplifyCustomDomain || echo $amplifyCustomDomainPrefix.$amplifyCustomDomain)
fi

echo $amplifyDomain
applicationStartURL="https://$cognitoHostedUIdomain/authorize?client_id=$cognitoClientWebClientID&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=https://$amplifyDomain/&idp_identifier=team"
applicationACSURL="https://$cognitoHostedUIdomain/saml2/idpresponse"
applicationSAMLAudience="urn:amazon:cognito:sp:$cognitoUserpoolId"

printf "\n${green}applicationStartURL:${clear} %s\n${green}applicationACSURL:${clear} %s\n${green}applicationSAMLAudience:${clear} %s\n\n" "$applicationStartURL" "$applicationACSURL" "$applicationSAMLAudience"
