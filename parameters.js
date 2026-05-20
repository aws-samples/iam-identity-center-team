// © 2021 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const fs = require("fs");
const path = require("path");

const { AWS_APP_ID, AWS_BRANCH, SSO_LOGIN, TEAM_ADMIN_GROUP, TEAM_AUDITOR_GROUP, TAGS, CLOUDTRAIL_AUDIT_LOGS, TEAM_ACCOUNT, AMPLIFY_CUSTOM_DOMAIN, ATHENA_AUDIT_LOGS, ATHENA_ROLE_ARN, ATHENA_WORKGROUP, ATHENA_DATABASE, ATHENA_TABLE, ATHENA_RESULTS_BUCKET, ATHENA_CLOUDTRAIL_BUCKET, ATHENA_CLOUDTRAIL_PREFIX, ATHENA_KMS_KEY_ARN } = process.env;

async function update_auth_parameters() {
  console.log(`updating amplify config for branch "${AWS_BRANCH}"...`);
  // update callback/logout redirect urls for build url
  const backendConfig = require(path.resolve(
    "./amplify/backend/backend-config.json"
  ));
  const authResourceName = Object.keys(backendConfig.auth)[0];
  const authParametersJsonPath = path.resolve(
    `./amplify/backend/auth/${authResourceName}/cli-inputs.json`
  );
  const authParametersJson = require(authParametersJsonPath);
  const oAuthMetadata = JSON.parse(
    authParametersJson.cognitoConfig.oAuthMetadata
  );
  oAuthMetadata.CallbackURLs.pop();
  oAuthMetadata.LogoutURLs.pop();

  const amplifyDomain = AMPLIFY_CUSTOM_DOMAIN ? `https://${AMPLIFY_CUSTOM_DOMAIN}/` :`https://${AWS_BRANCH}.${AWS_APP_ID}.amplifyapp.com/`

  console.log("domain",amplifyDomain)
  oAuthMetadata.CallbackURLs.push(amplifyDomain);
  oAuthMetadata.LogoutURLs.push(amplifyDomain);

  authParametersJson.cognitoConfig.oAuthMetadata =
    JSON.stringify(oAuthMetadata);

  authParametersJson.cognitoConfig.hostedUIDomainName = AWS_APP_ID;

  fs.writeFileSync(
    authParametersJsonPath,
    JSON.stringify(authParametersJson, null, 4)
  );
}
async function update_react_parameters() {
  console.log(`updating react parameters"...`);
  const reactParametersJsonPath = path.resolve(`./src/parameters.json`);
  const reactParametersJson = require(reactParametersJsonPath);
  reactParametersJson.Login = SSO_LOGIN;

  console.log("Team Account param:");
  console.log(TEAM_ACCOUNT);
  if (TEAM_ACCOUNT === undefined) {
    reactParametersJson.DeploymentType = "management"
  } else {
    reactParametersJson.DeploymentType = "delegated"
  };

  reactParametersJson.teamAdminGroup = TEAM_ADMIN_GROUP;
  reactParametersJson.teamAuditorGroup = TEAM_AUDITOR_GROUP;


  fs.writeFileSync(
    reactParametersJsonPath,
    JSON.stringify(reactParametersJson, null, 4)
  );
}

async function update_groups_parameters() {
  console.log(`updating team06dbb7fcPreTokenGeneration lambda parameters"...`);

  const groupsParametersJsonPath = path.resolve(
    `./amplify/backend/function/team06dbb7fcPreTokenGeneration/parameters.json`
  );
  const groupsParametersJson = require(groupsParametersJsonPath);

  groupsParametersJson.teamAdminGroup = TEAM_ADMIN_GROUP;
  groupsParametersJson.teamAuditorGroup = TEAM_AUDITOR_GROUP;

  fs.writeFileSync(
    groupsParametersJsonPath,
    JSON.stringify(groupsParametersJson, null, 4)
  );
}

async function update_router_parameters() {
  console.log(`updating teamRouter lambda parameters"...`);

  const routerParametersJsonPath = path.resolve(
    `./amplify/backend/function/teamRouter/parameters.json`
  );
  const routerParametersJson = require(routerParametersJsonPath);

  routerParametersJson.SSOLoginUrl = SSO_LOGIN;

  fs.writeFileSync(
    routerParametersJsonPath,
    JSON.stringify(routerParametersJson, null, 4)
  );
}

async function update_tag_parameters() {
  console.log(`updating amplify/backend/tags.json"...`);

  const tagsParametersJsonPath = path.resolve(
    `./amplify/backend/tags.json`
  );

  const tagsArray = TAGS ? TAGS.split(' ').map((tag) => {
    const [key, value] = tag.split('=');
    return {
      Key: key,
      Value: value,
    };
  }) : [];

  fs.writeFileSync(tagsParametersJsonPath, JSON.stringify(tagsArray, null, 2));
}

async function update_cloudtrail_parameters() {
  console.log(`updating amplify/backend/custom/cloudtrailLake/parameters.json"...`);

  const cloudtrailParametersJsonPath = path.resolve(
    `./amplify/backend/custom/cloudtrailLake/parameters.json`
  );

  const cloudtrailParametersJson = require(cloudtrailParametersJsonPath);

  cloudtrailParametersJson.CloudTrailAuditLogs = CLOUDTRAIL_AUDIT_LOGS;
  
  fs.writeFileSync(
    cloudtrailParametersJsonPath,
    JSON.stringify(cloudtrailParametersJson, null, 4)
  );
}

async function update_cloudtrail_parameters() {
  console.log(`updating amplify/backend/custom/cloudtrailLake/parameters.json"...`);

  const cloudtrailParametersJsonPath = path.resolve(
    `./amplify/backend/custom/cloudtrailLake/parameters.json`
  );

  const cloudtrailParametersJson = require(cloudtrailParametersJsonPath);

  cloudtrailParametersJson.CloudTrailAuditLogs = CLOUDTRAIL_AUDIT_LOGS;
  
  fs.writeFileSync(
    cloudtrailParametersJsonPath,
    JSON.stringify(cloudtrailParametersJson, null, 4)
  );
}

async function update_athena_parameters() {
  console.log(`updating Athena parameters for teamgetLogs and teamqueryLogs"...`);

  // Determine audit mode
  const auditMode = ATHENA_AUDIT_LOGS === 'enabled' ? 'athena' : 'cloudtrail_lake';

  // Write to teamgetLogs parameters
  const getLogsParamsPath = path.resolve(
    './amplify/backend/function/teamgetLogs/parameters.json'
  );
  const getLogsParams = require(getLogsParamsPath);
  getLogsParams.AuditMode = auditMode;
  getLogsParams.AthenaRoleArn = ATHENA_ROLE_ARN || '';
  getLogsParams.AthenaWorkgroup = ATHENA_WORKGROUP || 'team-audit';
  getLogsParams.AthenaDatabase = ATHENA_DATABASE || 'team_cloudtrail_db';
  getLogsParams.AthenaTable = ATHENA_TABLE || 'cloudtrail_logs';
  getLogsParams.AthenaResultsBucket = ATHENA_RESULTS_BUCKET || '';
  getLogsParams.AthenaCloudTrailBucket = ATHENA_CLOUDTRAIL_BUCKET || '';
  getLogsParams.AthenaCloudTrailPrefix = ATHENA_CLOUDTRAIL_PREFIX || '';
  getLogsParams.AthenaKmsKeyArn = ATHENA_KMS_KEY_ARN || '';
  fs.writeFileSync(getLogsParamsPath, JSON.stringify(getLogsParams, null, 4));

  // Write to teamqueryLogs parameters
  const queryLogsParamsPath = path.resolve(
    './amplify/backend/function/teamqueryLogs/parameters.json'
  );
  const queryLogsParams = require(queryLogsParamsPath);
  queryLogsParams.AuditMode = auditMode;
  queryLogsParams.AthenaRoleArn = ATHENA_ROLE_ARN || '';
  queryLogsParams.AthenaDatabase = ATHENA_DATABASE || 'team_cloudtrail_db';
  queryLogsParams.AthenaTable = ATHENA_TABLE || 'cloudtrail_logs';
  queryLogsParams.AthenaResultsBucket = ATHENA_RESULTS_BUCKET || '';
  fs.writeFileSync(queryLogsParamsPath, JSON.stringify(queryLogsParams, null, 4));
}

update_auth_parameters();
update_react_parameters();
update_groups_parameters();
update_router_parameters()
update_tag_parameters();
update_cloudtrail_parameters();
update_athena_parameters();