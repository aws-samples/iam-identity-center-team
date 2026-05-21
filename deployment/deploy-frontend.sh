#!/usr/bin/env bash

# Copyright 2026 Vertice
# Frontend deployment script for AWS Amplify Hosting

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load parameters
. "$SCRIPT_DIR/parameters.sh"

# Configuration
APP_NAME="TEAM-IDC-APP"
BRANCH_NAME="main"
PROFILE="${AWS_PROFILE:-$ORG_MASTER_PROFILE}"

echo "=== TEAM-IDC Frontend Deployment ==="
echo "Region: $REGION"
echo "Profile: $PROFILE"
echo ""

cd "$PROJECT_ROOT"

# Check if app exists, if not create it
APP_ID=$(aws amplify list-apps --region "$REGION" --profile "$PROFILE" --output json | jq -r ".apps[] | select(.name==\"$APP_NAME\") | .appId")

if [ -z "$APP_ID" ]; then
    echo "Creating Amplify app..."
    APP_ID=$(aws amplify create-app --name "$APP_NAME" --region "$REGION" --profile "$PROFILE" --platform WEB --output json | jq -r '.app.appId')
    echo "Created app: $APP_ID"
else
    echo "Using existing app: $APP_ID"
fi

# Check if branch exists, if not create it
BRANCH_EXISTS=$(aws amplify list-branches --app-id "$APP_ID" --region "$REGION" --profile "$PROFILE" --output json | jq -r ".branches[] | select(.branchName==\"$BRANCH_NAME\") | .branchName")

if [ -z "$BRANCH_EXISTS" ]; then
    echo "Creating branch: $BRANCH_NAME"
    aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --region "$REGION" --profile "$PROFILE" > /dev/null
else
    echo "Using existing branch: $BRANCH_NAME"
fi

# Build frontend
echo ""
echo "Building frontend..."
npm run build

# Create ZIP
echo "Creating deployment archive..."
cd dist
rm -f ../deploy.zip
zip -r ../deploy.zip . > /dev/null
cd ..

# Create deployment and get upload URL
echo "Creating deployment..."
DEPLOY=$(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --region "$REGION" --profile "$PROFILE" --output json)
URL=$(echo "$DEPLOY" | jq -r '.zipUploadUrl')
JOB_ID=$(echo "$DEPLOY" | jq -r '.jobId')

# Upload ZIP
echo "Uploading archive..."
curl -s -H "Content-Type: application/zip" --upload-file deploy.zip "$URL" > /dev/null

# Start deployment
echo "Starting deployment..."
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH_NAME" --job-id "$JOB_ID" --region "$REGION" --profile "$PROFILE" > /dev/null

# Get domain
DOMAIN=$(aws amplify get-app --app-id "$APP_ID" --region "$REGION" --profile "$PROFILE" --output json | jq -r '.app.defaultDomain')

echo ""
echo "=== Deployment started ==="
echo "App ID: $APP_ID"
echo "Job ID: $JOB_ID"
echo "URL: https://$BRANCH_NAME.$DOMAIN"
echo ""
echo "Check status:"
echo "  aws amplify get-job --app-id $APP_ID --branch-name $BRANCH_NAME --job-id $JOB_ID --region $REGION --profile $PROFILE"

# Cleanup
rm -f deploy.zip
