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

#!/usr/bin/env bash
set -xe

. "./parameters.sh"

# Build Athena parameter overrides if configured
ATHENA_PARAMS=""
if [ -n "$ATHENA_CLOUDTRAIL_BUCKET" ]; then
  CLOUDTRAIL_AUDIT_LOGS=${CLOUDTRAIL_AUDIT_LOGS:-none}
  ATHENA_PARAMS="AthenaLoggingAccountId=${ATHENA_LOGGING_ACCOUNT_ID:-} AthenaRoleArn=${ATHENA_ROLE_ARN:-} AthenaWorkgroup=${ATHENA_WORKGROUP:-team-audit} AthenaDatabase=${ATHENA_DATABASE:-team_cloudtrail_db} AthenaTable=${ATHENA_TABLE:-cloudtrail_logs} AthenaResultsBucket=${ATHENA_RESULTS_BUCKET:-} AthenaCloudTrailBucket=$ATHENA_CLOUDTRAIL_BUCKET AthenaCloudTrailPrefix=${ATHENA_CLOUDTRAIL_PREFIX:-} AthenaKmsKeyArn=${ATHENA_KMS_KEY_ARN:-}"
fi

# Build Bedrock parameter overrides
BEDROCK_PARAMS="BedrockAuditEnabled=${BEDROCK_AUDIT_ENABLED:-false} BedrockModelId=${BEDROCK_MODEL_ID:-amazon.nova-lite-v1:0} BedrockRegion=${BEDROCK_REGION:-}"

if [ -z "$TEAM_ACCOUNT" ]; then 
  export AWS_PROFILE=$ORG_MASTER_PROFILE
else 
  export AWS_PROFILE=$TEAM_ACCOUNT_PROFILE
fi

cd ..

if [ -z "$SECRET_NAME" ]; then
  aws codecommit create-repository --region $REGION --repository-name team-idc-app --repository-description "Temporary Elevated Access Management (TEAM) Application" 2>/dev/null || true
  git remote remove origin 2>/dev/null || true
  git remote add origin codecommit::$REGION://team-idc-app 2>/dev/null || true
  git push origin main

  cd ./deployment
  if [[ ! -z "$TAGS" ]]; then
    if [[ ! -z "$UI_DOMAIN" ]]; then
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          tags="$TAGS" \
          teamAccount="$TEAM_ACCOUNT" \
          cacheTTL=$CACHE_TTL \
          customAmplifyDomain="$UI_DOMAIN" \
        --tags $TAGS \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    else
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          tags="$TAGS" \
          teamAccount="$TEAM_ACCOUNT" \
          cacheTTL=$CACHE_TTL \
        --tags $TAGS \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    fi
  else
    if [[ ! -z "$UI_DOMAIN" ]]; then
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          teamAccount="$TEAM_ACCOUNT" \
          tags="$TAGS" \
          customAmplifyDomain="$UI_DOMAIN" \
          cacheTTL=$CACHE_TTL \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    else
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          teamAccount="$TEAM_ACCOUNT" \
          cacheTTL=$CACHE_TTL \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    fi
  fi
else
  cd ./deployment
  if [[ ! -z "$TAGS" ]]; then
    if [[ ! -z "$UI_DOMAIN" ]]; then
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          tags="$TAGS" \
          teamAccount="$TEAM_ACCOUNT" \
          customAmplifyDomain="$UI_DOMAIN" \
          cacheTTL=$CACHE_TTL \
          customRepository="Yes" \
          customRepositorySecretName="$SECRET_NAME" \
        --tags $TAGS \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    else
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          tags="$TAGS" \
          teamAccount="$TEAM_ACCOUNT" \
          cacheTTL=$CACHE_TTL \
          customRepository="Yes" \
          customRepositorySecretName="$SECRET_NAME" \
        --tags $TAGS \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    fi
  else
    if [[ ! -z "$UI_DOMAIN" ]]; then
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          teamAccount="$TEAM_ACCOUNT" \
          tags="$TAGS" \
          customAmplifyDomain="$UI_DOMAIN" \
          cacheTTL=$CACHE_TTL \
          customRepository="Yes" \
          customRepositorySecretName="$SECRET_NAME" \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    else
      aws cloudformation deploy --region $REGION --template-file template.yml \
        --stack-name TEAM-IDC-APP \
        --parameter-overrides \
          Login=$IDC_LOGIN_URL \
          CloudTrailAuditLogs=$CLOUDTRAIL_AUDIT_LOGS \
          teamAdminGroup="$TEAM_ADMIN_GROUP" \
          teamAuditGroup="$TEAM_AUDITOR_GROUP" \
          teamAccount="$TEAM_ACCOUNT" \
          cacheTTL=$CACHE_TTL \
          customRepository="Yes" \
          customRepositorySecretName="$SECRET_NAME" \
        $ATHENA_PARAMS $BEDROCK_PARAMS \
        --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
    fi
  fi
fi