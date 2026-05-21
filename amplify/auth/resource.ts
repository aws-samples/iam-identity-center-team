import { defineAuth, secret } from '@aws-amplify/backend';
import { CfnResource, Duration } from 'aws-cdk-lib';
import {
  OAuthScope,
  UserPoolClientIdentityProvider,
} from 'aws-cdk-lib/aws-cognito';
import type { Backend } from '../backend';
import { appId, appIdLower, branchName } from '../config';

// Generate callback URLs based on environment
const appUrl = `https://${branchName}.${appId}.amplifyapp.com/`;

// SAML provider (IDC) is added after deployment via cognito.sh
// because we need the callback URL first
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'Your verification code',
      verificationEmailBody: () => 'Your verification code is {####}',
    },
  },
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
  groups: ['Auditors', 'Admin'],
  multifactor: {
    mode: 'OFF',
  },
});

export function applyEscapeHatches(backend: Backend) {
  const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
  cfnUserPool.userPoolName = `teamAuth-${appIdLower}-${branchName}`;
  cfnUserPool.usernameAttributes = ['email'];
  cfnUserPool.policies = {
    passwordPolicy: {
      minimumLength: 8,
      requireLowercase: false,
      requireNumbers: false,
      requireSymbols: false,
      requireUppercase: false,
      temporaryPasswordValidityDays: 7,
    },
  };
  const cfnIdentityPool = backend.auth.resources.cfnResources.cfnIdentityPool;
  cfnIdentityPool.identityPoolName = `teamAuthIdentityPool-${appIdLower}-${branchName}`;
  cfnIdentityPool.allowUnauthenticatedIdentities = false;
  const cfnUserPoolClient =
    backend.auth.resources.cfnResources.cfnUserPoolClient;
  cfnUserPoolClient.clientName = `teamAuth-clientWeb-${appIdLower}-${branchName}`;
  cfnUserPoolClient.allowedOAuthFlows = ['code'];
  const userPool = backend.auth.resources.userPool;
  userPool.addDomain('TeamAuthDomain', {
    cognitoDomain: {
      domainPrefix: appIdLower,
    },
  });

  // Export OAuth config to amplify_outputs.json
  const region = userPool.stack.region;
  backend.addOutput({
    auth: {
      oauth: {
        identity_providers: [],
        domain: `${appIdLower}.auth.${region}.amazoncognito.com`,
        scopes: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
        redirect_sign_in_uri: [appUrl],
        redirect_sign_out_uri: [appUrl],
        response_type: 'code',
      },
    },
  });

  const userPoolClient = userPool.addClient('NativeAppClient', {
    refreshTokenValidity: Duration.days(1),
    enableTokenRevocation: true,
    enablePropagateAdditionalUserContextData: false,
    authSessionValidity: Duration.minutes(3),
    supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
    oAuth: {
      callbackUrls: [appUrl],
      logoutUrls: [appUrl],
      flows: {
        authorizationCodeGrant: true,
        implicitCodeGrant: false,
        clientCredentials: false,
      },
      scopes: [
        OAuthScope.COGNITO_ADMIN,
        OAuthScope.EMAIL,
        OAuthScope.OPENID,
        OAuthScope.PHONE,
        OAuthScope.PROFILE,
      ],
    },
    // flows: ['code'],
    disableOAuth: false,
    generateSecret: false,
  });
  const cfnNativeAppClient = userPoolClient.node.defaultChild as CfnResource;
  cfnNativeAppClient.addPropertyOverride('ClientName', `teamAuth-nativeClient-${appIdLower}-${branchName}`);
  const providerSetupResult = (
    backend.auth.stack.node.children.find(
      (child) => child.node.id === 'amplifyAuth'
    ) as any
  ).providerSetupResult;
  Object.keys(providerSetupResult).forEach((provider) => {
    const providerSetupPropertyValue = providerSetupResult[provider];
    if (
      providerSetupPropertyValue.node &&
      providerSetupPropertyValue.node.id.toLowerCase().endsWith('idp')
    ) {
      userPoolClient.node.addDependency(providerSetupPropertyValue);
    }
  });
  // backend.auth.resources.userPool.node.tryRemoveChild("UserPoolDomain");
  for (const cfnResource of backend.auth.stack.node
    .findAll()
    .filter(
      (c) =>
        CfnResource.isCfnResource(c) &&
        [
          'AWS::Cognito::UserPool',
          'AWS::Cognito::IdentityPool',
          'AWS::Cognito::UserPoolClient',
          'AWS::Cognito::IdentityPoolRoleAttachment',
          'AWS::Cognito::UserPoolGroup',
        ].includes(c.cfnResourceType)
    )) {
    (cfnResource as CfnResource).addOverride('UpdateReplacePolicy', 'Retain');
    (cfnResource as CfnResource).addOverride('DeletionPolicy', 'Retain');
  }
}
