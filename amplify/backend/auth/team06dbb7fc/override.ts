import { AmplifyAuthCognitoStackTemplate } from '@aws-amplify/cli-extensibility-helper';

export function override(resources: AmplifyAuthCognitoStackTemplate) {
  // TEAM is a federated-only application: users authenticate through AWS IAM
  // Identity Center (SAML). Public self-service sign-up is not used and should
  // not be possible, otherwise anyone on the internet can create and confirm an
  // account in the user pool that backs this privileged-access workflow.
  //
  // Cognito defaults AdminCreateUserConfig.AllowAdminCreateUserOnly to false,
  // which permits public SignUp. Force it to true so only admin-created /
  // federated identities can exist in the pool. Federated (hosted UI / SAML)
  // sign-in is unaffected, since those users are provisioned via the identity
  // provider linkage rather than the public SignUp API.
  resources.userPool.addPropertyOverride(
    'AdminCreateUserConfig.AllowAdminCreateUserOnly',
    true
  );
}
