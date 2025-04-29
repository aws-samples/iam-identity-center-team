# Copyright 2022 Amazon Web Services, Inc
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

# This script should be deployed in the Organisation Management account
# The script enables delegated admin for AWS Account Management, AWS IAM IdC and CloudTrail Lake

#!/usr/bin/env bash
set +e

. "./parameters.sh"

export AWS_PROFILE=$ORG_MASTER_PROFILE

idc=`aws organizations list-delegated-administrators --service-principal sso.amazonaws.com --region $REGION --output json | jq -r '.DelegatedAdministrators[] | select(.Id=='\"$TEAM_ACCOUNT\"') | .Id'`
cloudtrail=`aws organizations list-delegated-administrators --service-principal cloudtrail.amazonaws.com --region $REGION --output json | jq -r '.DelegatedAdministrators[] | select(.Id=='\"$TEAM_ACCOUNT\"') | .Id'`
accountManager=`aws organizations list-delegated-administrators --service-principal account.amazonaws.com --region $REGION --output json | jq -r '.DelegatedAdministrators[] | select(.Id=='\"$TEAM_ACCOUNT\"') | .Id'`
serviceRole=`aws iam get-role --role-name AWSServiceRoleForCloudTrail --region $REGION `

# Enable trusted access for account management
aws organizations enable-aws-service-access --service-principal account.amazonaws.com --region $REGION

# Enable Delegated Admin for Account Management
if [ -z "$accountManager" ]
then
    aws organizations register-delegated-administrator \
        --account-id $TEAM_ACCOUNT \
        --service-principal account.amazonaws.com \
        --region $REGION

    echo "$TEAM_ACCOUNT configured as delegated Admin for AWS Account Manager"
else
    echo "$TEAM_ACCOUNT is already configured as delegated Admin for AWS Account Manager"
fi

# Enable trusted access for cloudtrail
aws organizations enable-aws-service-access --service-principal cloudtrail.amazonaws.com --region $REGION

if [ -z "$serviceRole" ]; then
    aws iam create-service-linked-role --aws-service-name cloudtrail.amazonaws.com --region $REGION 
fi

# Enable Delegated Admin for CloudTrail
if [ -z "$cloudtrail" ]
then
    aws organizations register-delegated-administrator \
        --account-id $TEAM_ACCOUNT \
        --service-principal cloudtrail.amazonaws.com\
        --region $REGION
    echo "$TEAM_ACCOUNT configured as delegated Admin for cloudtrail"
else
    echo "$TEAM_ACCOUNT is already configured as delegated Admin for cloudtrail"
fi

# Enable trusted access for IdC
aws organizations enable-aws-service-access --service-principal sso.amazonaws.com  --region $REGION

# Enable Delegated Admin for IdC
if [ -z "$idc" ]
then
aws organizations register-delegated-administrator \
    --account-id $TEAM_ACCOUNT \
    --service-principal sso.amazonaws.com \
    --region $REGION
    echo "$TEAM_ACCOUNT configured as delegated Admin for IAM IdC"
else
    echo "$TEAM_ACCOUNT is already configured as delegated Admin for IAM IdC"
fi
