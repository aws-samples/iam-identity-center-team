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

cognitoUserpoolId=$(aws cognito-idp list-user-pools --region $REGION --max-results 10 --output json | jq -r '.UserPools[] | select(.Name | contains("team06dbb7fc")) | .Id')
cognitoUserpoolDomain=$(aws cognito-idp describe-user-pool --region $REGION --user-pool-id $cognitoUserpoolId --output json | jq -r '.UserPool.Domain')
cognitoUserpoolClientId=$(aws cognito-idp list-user-pool-clients --region $REGION --user-pool-id $cognitoUserpoolId --output json | jq -r '.UserPoolClients[] | select(.ClientName | contains("machine_auth")) | .ClientId')
cognitoUserpoolClient=$(aws cognito-idp describe-user-pool-client --region $REGION --user-pool-id $cognitoUserpoolId --client-id $cognitoUserpoolClientId --output json | jq -r '.UserPoolClient')
graphEndpoint=$(aws appsync list-graphql-apis --region $REGION --output json | jq -r '.graphqlApis[] | select(.name | contains("team-main")) | .uris.GRAPHQL')

echo "token_endpoint=\"https://$cognitoUserpoolDomain.auth.$REGION.amazoncognito.com/oauth2/token\""
echo "graph_endpoint=\"$graphEndpoint\""
echo "client_id=$(echo $cognitoUserpoolClient | jq .ClientId)"
echo "client_secret=$(echo $cognitoUserpoolClient | jq .ClientSecret)"