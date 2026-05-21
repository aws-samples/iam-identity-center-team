// Shared configuration for Amplify backend
// AWS_APP_ID is required - set by Amplify Hosting CI/CD or manually before deploy

export const appId = process.env.AWS_APP_ID;
if (!appId) {
    throw new Error('AWS_APP_ID environment variable is required. Create Amplify app first and export the ID.');
}
export const appIdLower = appId.toLowerCase();
export const branchName = process.env.AWS_BRANCH ?? 'sandbox';

// SSM parameter path for Settings table name (used by preToken Lambda)
export const settingsTableSsmPath = `/team/${appIdLower}/${branchName}/settings-table-name`;
