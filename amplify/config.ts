// Shared configuration for Amplify backend
// AWS_APP_ID is required - set by Amplify Hosting CI/CD or manually before deploy

export const appId = process.env.AWS_APP_ID;
if (!appId) {
    throw new Error('AWS_APP_ID environment variable is required. Create Amplify app first and export the ID.');
}
export const appIdLower = appId.toLowerCase();
export const branchName = process.env.AWS_BRANCH ?? 'sandbox';

// App URL for email links
// Uses custom domain if set, otherwise falls back to default Amplify URL
const customDomain = process.env.AMPLIFY_CUSTOM_DOMAIN;
const defaultAppUrl = `https://${branchName}.${appIdLower}.amplifyapp.com`;
export const appUrl = customDomain ? `https://${customDomain}` : defaultAppUrl;

// SSM parameter path for Settings table name (used by preToken Lambda)
export const settingsTableSsmPath = `/team/${appIdLower}/${branchName}/settings-table-name`;
