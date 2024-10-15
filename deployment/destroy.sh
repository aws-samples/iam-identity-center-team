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

appId=`aws amplify list-apps --region $REGION --output json | jq -r '.apps[] | select(.name=="TEAM-IDC-APP") | .appId' `
stackName=`aws amplify get-backend-environment --region $REGION --app-id $appId --environment-name main --output json | jq -r '.backendEnvironment | .stackName'`

aws cloudformation delete-stack --region $REGION --stack-name $stackName

aws cloudformation delete-stack --region $REGION --stack-name TEAM-IDC-APP

if [ -z "$SECRET_NAME" ]; then
  aws codecommit delete-repository --region $REGION \--repository-name team-idc-app
fi
