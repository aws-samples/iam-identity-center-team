# Copyright 2022 Amazon Web Services, Inc
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License ateiifccuguhukbglvivtflddnheicjudncrlcdhjtlucr

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

export AWS_PROFILE=$TEAM_ACCOUNT_PROFILE

green='\033[0;32m'
clear='\033[0m'
cognitoUserpoolId=`aws cognito-idp list-user-pools --max-results 10 --output json | jq -r '.UserPools[] | select(.Name | contains("team06dbb7fc")) | .Id'`
cognitouserpoolhostedUIdomain=`aws cognito-idp describe-user-pool --user-pool-id $cognitoUserpoolId  |jq -r '.UserPool.Domain'`
applicationURL=`aws amplify list-apps --output json | jq -r '.apps[] | select(.name=="TEAM-IDC-APP") | .defaultDomain' `
clientID=`aws cognito-idp list-user-pool-clients --user-pool-id $cognitoUserpoolId --output json | jq -r '.UserPoolClients[] | select(.ClientName | contains("clientWeb")) | .ClientId'`

hostedUIdomain=$cognitouserpoolhostedUIdomain.auth.$REGION.amazoncognito.com
appURL=https://main.$applicationURL

applicationStartURL="https://$hostedUIdomain/authorize?client_id=$clientID&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=$appURL/&idp_identifier=team"
applicationACSURL="https://$hostedUIdomain/saml2/idpresponse"
applicationSAMLAudience="urn:amazon:cognito:sp:$cognitoUserpoolId"


printf "\n${green}applicationStartURL:${clear} %s\n${green}applicationACSURL:${clear} %s\n${green}applicationSAMLAudience:${clear} %s\n\n" "$applicationStartURL" "$applicationACSURL" "$applicationSAMLAudience"