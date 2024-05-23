# Copyright 2023 Amazon Web Services, Inc
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
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

cognitoUserpoolId=`aws cognito-idp list-user-pools --region $REGION --max-results 10 --output json | jq -r '.UserPools[] | select(.Name | contains("team06dbb7fc")) | .Id'`
clientID=`aws cognito-idp list-user-pool-clients --region $REGION --user-pool-id $cognitoUserpoolId --output json | jq -r '.UserPoolClients[] | select(.ClientName | contains("clientWeb")) | .ClientId'`


amplifyAppId=`aws amplify list-apps --region $REGION --output json | jq -r '.apps[] | select(.name=="TEAM-IDC-APP") | .appId'`
amplifyDomain=`aws amplify list-apps --region $REGION --output json | jq -r '.apps[] | select(.name=="TEAM-IDC-APP") | .defaultDomain'`
amplifyDomain="main.$amplifyDomain"

amplifyCustomDomains=`aws amplify list-domain-associations --region $REGION --app-id $amplifyAppId --output json`
amplifyCustomDomain=`echo $amplifyCustomDomains | jq -r 'select(.domainAssociations | length > 0) | .domainAssociations[0].domainName'`

if [ -n "$amplifyCustomDomain" ]; then
  amplifyCustomDomainPrefix=$(echo $amplifyCustomDomains | jq -r 'select(.domainAssociations | length > 0) | .domainAssociations[0].subDomains[] | select(.subDomainSetting.branchName=="main") | .subDomainSetting.prefix')
  amplifyDomain=$([ -z "$amplifyCustomDomainPrefix" ] && echo $amplifyCustomDomain || echo $amplifyCustomDomainPrefix.$amplifyCustomDomain)
fi

aws cognito-idp create-identity-provider --region $REGION --user-pool-id $cognitoUserpoolId --provider-name=IDC --provider-type SAML --provider-details file://details.json --attribute-mapping email=Email --idp-identifiers team
aws cognito-idp update-user-pool-client --region $REGION --user-pool-id $cognitoUserpoolId \
--client-id $clientID \
--refresh-token-validity 1 \
--supported-identity-providers IDC \
--allowed-o-auth-flows code \
--allowed-o-auth-scopes "phone" "email" "openid" "profile" "aws.cognito.signin.user.admin" \
--logout-urls "https://$amplifyDomain/"  \
--callback-urls "https://$amplifyDomain/" \
--allowed-o-auth-flows-user-pool-client