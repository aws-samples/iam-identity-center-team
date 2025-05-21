#!/bin/bash

# Adds backup related tags to TEAM DynamoDB tables

# Load parameters from parameters.sh
source ./parameters.sh

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "AWS CLI is not installed. Please install it and try again."
  exit 1
fi

export AWS_PROFILE=$TEAM_ACCOUNT_PROFILE
export AWS_REGION=$REGION

# Define the new tags to apply
ADD_TAGS="Key=backup-plan,Value=dynamodb-daily"

# Find and tag DynamoDB tables
echo "Finding DynamoDB tables with tags matching: $TAGS"
TABLES=$(aws dynamodb list-tables --region "$REGION" --query "TableNames[]" --output text)

echo "Found tables: $TABLES"

for TABLE in $TABLES; do
    echo "Tagging table: $TABLE"
    aws dynamodb tag-resource \
      --resource-arn "arn:aws:dynamodb:$REGION:$TEAM_ACCOUNT:table/$TABLE" \
      --tags "$ADD_TAGS"
done

echo "Tagging complete."
