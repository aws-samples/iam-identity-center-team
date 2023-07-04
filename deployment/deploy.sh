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

export AWS_PROFILE=$TEAM_ACCOUNT_PROFILE

cd ..

aws codecommit create-repository --repository-name team-idc-app --repository-description "Temporary Elevated Access Management (TEAM) Application"
git remote remove origin
git remote add origin codecommit::$REGION://team-idc-app

# Part below will update tag keys and values in amplify/backend/tags.json
IFS=' ' read -ra TAG_ARRAY <<< "$TAGS"

output="["
for tag in "${TAG_ARRAY[@]}"; do
  IFS='=' read -ra pair <<< "$tag"
  key="${pair[0]}"
  value="${pair[1]}"
  output+="\n  {\n    \"Key\": \"$key\",\n    \"Value\": \"$value\"\n  },"
done

output="${output%,}\n]"
echo "$output" > ./amplify/backend/tags.json

if git diff-index --quiet HEAD -- "./amplify/backend/tags.json"; then
  echo "No changes to amplify/backend/tags.json."
else
  git add ./amplify/backend/tags.json
  git commit -m "Update tags."
fi

git push origin main

cd ./deployment

if [[ ! -z "$TAGS" ]];
then
  aws cloudformation deploy --region $REGION --template-file template.yml \
  --stack-name TEAM-IDC-APP \
  --parameter-overrides \
    Source=$EMAIL_SOURCE \
    Login=$IDC_LOGIN_URL \
    teamAdminGroup="$TEAM_ADMIN_GROUP" \
    teamAuditGroup="$TEAM_AUDITOR_GROUP" \
  --tags "$TAGS" \
  --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
else
  aws cloudformation deploy --region $REGION --template-file template.yml \
  --stack-name TEAM-IDC-APP \
  --parameter-overrides \
    Source=$EMAIL_SOURCE \
    Login=$IDC_LOGIN_URL \
    teamAdminGroup="$TEAM_ADMIN_GROUP" \
    teamAuditGroup="$TEAM_AUDITOR_GROUP" \
  --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM
fi