// © 2021 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

// Amplify Gen 2 version - only updates React frontend parameters
// Auth, Lambda, and other backend configurations are handled via environment variables
// in TypeScript/CDK files (auth/resource.ts, functions/*/resource.ts, etc.)

const fs = require("fs");
const path = require("path");

const { SSO_LOGIN, TEAM_ADMIN_GROUP, TEAM_AUDITOR_GROUP, TEAM_ACCOUNT } = process.env;

async function update_react_parameters() {
  console.log("Updating React frontend parameters...");
  const reactParametersJsonPath = path.resolve("./src/parameters.json");
  const reactParametersJson = require(reactParametersJsonPath);

  if (SSO_LOGIN) {
    reactParametersJson.Login = SSO_LOGIN;
    console.log(`  Login: ${SSO_LOGIN}`);
  }

  // Determine deployment type based on TEAM_ACCOUNT
  const deploymentType = (TEAM_ACCOUNT === undefined || TEAM_ACCOUNT === "")
    ? "management"
    : "delegated";
  reactParametersJson.DeploymentType = deploymentType;
  console.log(`  DeploymentType: ${deploymentType}`);

  if (TEAM_ADMIN_GROUP) {
    reactParametersJson.teamAdminGroup = TEAM_ADMIN_GROUP;
    console.log(`  teamAdminGroup: ${TEAM_ADMIN_GROUP}`);
  }

  if (TEAM_AUDITOR_GROUP) {
    reactParametersJson.teamAuditorGroup = TEAM_AUDITOR_GROUP;
    console.log(`  teamAuditorGroup: ${TEAM_AUDITOR_GROUP}`);
  }

  fs.writeFileSync(
    reactParametersJsonPath,
    JSON.stringify(reactParametersJson, null, 4)
  );
  console.log("React parameters updated successfully.");
}

update_react_parameters();