// © 2021 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

const fs = require("fs");
const path = require("path");

const { AWS_APP_ID, AWS_BRANCH, EMAIL_SOURCE, SSO_LOGIN, TEAM_ADMIN_GROUP, TEAM_AUDITOR_GROUP } = process.env;

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
  oAuthMetadata.CallbackURLs.push(
    `https://${AWS_BRANCH}.${AWS_APP_ID}.amplifyapp.com/`
  );
  oAuthMetadata.LogoutURLs.push(
    `https://${AWS_BRANCH}.${AWS_APP_ID}.amplifyapp.com/`
  );
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

  fs.writeFileSync(
    reactParametersJsonPath,
    JSON.stringify(reactParametersJson, null, 4)
  );
}

async function update_custom_parameters() {
  console.log(`updating stepfunctions custom parameters"...`);

  const customParametersJsonPath = path.resolve(
    `./amplify/backend/custom/stepfunctions/parameters.json`
  );
  const customParametersJson = require(customParametersJsonPath);

  customParametersJson.Source = EMAIL_SOURCE;
  customParametersJson.Login = SSO_LOGIN;

  fs.writeFileSync(
    customParametersJsonPath,
    JSON.stringify(customParametersJson, null, 4)
  );
}

async function update_groups_parameters() {
  console.log(`updating teamgetgroups lambda parameters"...`);

  const groupsParametersJsonPath = path.resolve(
    `./amplify/backend/function/teamgetGroups/parameters.json`
  );
  const groupsParametersJson = require(groupsParametersJsonPath);

  groupsParametersJson.teamAdminGroup = TEAM_ADMIN_GROUP;
  groupsParametersJson.teamAuditorGroup = TEAM_AUDITOR_GROUP;

  fs.writeFileSync(
    groupsParametersJsonPath,
    JSON.stringify(groupsParametersJson, null, 4)
  );
}

update_custom_parameters();
update_auth_parameters();
update_react_parameters();
update_groups_parameters();