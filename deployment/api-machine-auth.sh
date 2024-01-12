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

# remove pager
export AWS_PAGER=""

# Create the resource server with the needed custom scopes
aws cognito-idp create-resource-server --region $REGION \
--user-pool-id $cognitoUserpoolId \
--identifier "api" \
--name "api" \
--scopes "ScopeName=admin,ScopeDescription=Provides Admin access to machine authentication flows"

# Create the user pool client with a secret access key to allow machine auth
aws cognito-idp create-user-pool-client --region $REGION \
--user-pool-id $cognitoUserpoolId \
--client-name machine_auth \
--generate-secret \
--explicit-auth-flows "ALLOW_REFRESH_TOKEN_AUTH" \
--supported-identity-providers "COGNITO" \
--callback-urls "https://localhost" \
--allowed-o-auth-flows "client_credentials" \
--allowed-o-auth-scopes "api/admin" \
--allowed-o-auth-flows-user-pool-client