# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import os
import boto3
import requests
from requests_aws_sign import AWSV4Sign
from botocore.exceptions import ClientError

policy_table_name = os.getenv("POLICY_TABLE_NAME")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
policy_table = dynamodb.Table(policy_table_name)
settings_table = dynamodb.Table(settings_table_name)

ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")


def get_mgmt_account_id():
    """Get the management account ID from Organizations"""
    org_client = boto3.client("organizations")
    try:
        response = org_client.describe_organization()
        return response["Organization"]["MasterAccountId"]
    except ClientError as e:
        print(f"Error getting management account ID: {e}")
        return None


mgmt_account_id = get_mgmt_account_id()


def get_settings():
    """Get settings from DynamoDB"""
    try:
        response = settings_table.get_item(Key={"id": "settings"})
        return response.get("Item", {})
    except ClientError as e:
        print(f"Error getting settings: {e}")
        return {}


def publishPolicy(result):
    session = boto3.session.Session()
    credentials = session.get_credentials()
    credentials = credentials.get_frozen_credentials()
    region = session.region_name

    query = """
        mutation PublishPolicy($result: PolicyInput) {
            publishPolicy(result: $result) {
            id
            policy {
                accounts {
                name
                id
                }
                permissions {
                name
                id
                }
                approvalRequired
                duration
            }
            username
            }
        }
            """

    endpoint = os.environ.get("API_TEAM_GRAPHQLAPIENDPOINTOUTPUT", None)
    headers = {"Content-Type": "application/json"}
    payload = {"query": query, "variables": {"result": result}}

    appsync_region = region
    auth = AWSV4Sign(credentials, appsync_region, "appsync")

    try:
        response = requests.post(
            endpoint, auth=auth, json=payload, headers=headers
        ).json()
        if "errors" in response:
            print("Error attempting to query AppSync")
            print(response["errors"])
        else:
            print("Mutation successful")
            print(response)
    except Exception as exception:
        print("Error with Query")
        print(exception)

    return result


def get_ou_accounts(ou_ids):
    """Get accounts for multiple OUs using cached GraphQL query"""
    if not ou_ids:
        return []
    
    session = boto3.session.Session()
    credentials = session.get_credentials()
    credentials = credentials.get_frozen_credentials()
    region = session.region_name

    query = """
        query GetOUAccounts($ouIds: [String]!) {
            getOUAccounts(ouIds: $ouIds) {
                results {
                    ouId
                    accounts {
                        name
                        id
                    }
                    cached
                }
            }
        }
    """

    endpoint = os.environ.get("API_TEAM_GRAPHQLAPIENDPOINTOUTPUT", None)
    headers = {"Content-Type": "application/json"}
    appsync_region = region
    auth = AWSV4Sign(credentials, appsync_region, "appsync")
    
    all_accounts = []
    batch_size = 20
    
    # Process in batches of 20
    for i in range(0, len(ou_ids), batch_size):
        batch = ou_ids[i:i + batch_size]
        payload = {"query": query, "variables": {"ouIds": batch}}
        
        try:
            response = requests.post(
                endpoint, auth=auth, json=payload, headers=headers
            ).json()
            if "errors" in response:
                print(f"Error querying OU accounts batch {i//batch_size + 1}")
                print(response["errors"])
                continue
            
            results = response.get("data", {}).get("getOUAccounts", {}).get("results", [])
            
            # Flatten accounts from this batch
            for result in results:
                accounts = result.get("accounts", [])
                all_accounts.extend(accounts)
                cached_status = "cached" if result.get("cached") else "fetched"
                print(f"OU {result.get('ouId')}: {len(accounts)} accounts ({cached_status})")
        
        except Exception as exception:
            print(f"Error calling getOUAccounts batch {i//batch_size + 1}")
            print(exception)
            continue
    
    return all_accounts


def list_account_for_ou(ou_id):
    """
    Original implementation: Direct Organizations API call for OU accounts.
    Used when useOUCache feature flag is disabled.
    """
    deployed_in_mgmt = True if ACCOUNT_ID == mgmt_account_id else False
    accounts = []
    client = boto3.client("organizations")
    
    try:
        paginator = client.get_paginator("list_accounts_for_parent")
        page_iterator = paginator.paginate(ParentId=ou_id)

        for page in page_iterator:
            for acct in page["Accounts"]:
                # Skip management account if not deployed in management account
                if not deployed_in_mgmt and acct["Id"] == mgmt_account_id:
                    continue
                accounts.append({"name": acct["Name"], "id": acct["Id"]})
        
        print(f"OU {ou_id}: {len(accounts)} accounts (direct API)")
        return accounts
    except ClientError as e:
        print(f"Error listing accounts for OU {ou_id}: {e}")
        return []


def get_entitlements(id):
    response = policy_table.get_item(Key={"id": id})
    return response


def handler(event, context):
    userId = event["userId"]
    groupIds = event["groupIds"]
    username = event["username"]
    eligibility = []
    maxDuration = 0
    
    print("Id: ", event["id"])
    
    # Get feature flag setting
    settings = get_settings()
    use_ou_cache = settings.get("useOUCache", True)  # Default to True (cached)
    print(f"Using OU cache: {use_ou_cache}")

    for id in [userId] + groupIds:
        if not id:
            continue
        entitlement = get_entitlements(id)
        print(entitlement)
        if "Item" not in entitlement.keys():
            continue
        duration = entitlement["Item"]["duration"]
        if int(duration) > maxDuration:
            maxDuration = int(duration)
        policy = {}
        policy["accounts"] = entitlement["Item"]["accounts"]

        # Get OU accounts based on feature flag
        ou_ids = [ou["id"] for ou in entitlement["Item"]["ous"]]
        
        if ou_ids:
            if use_ou_cache:
                # New implementation: Use cached GraphQL query
                ou_accounts = get_ou_accounts(ou_ids)
                policy["accounts"].extend(ou_accounts)
            else:
                # Original implementation: Direct Organizations API calls
                for ou_id in ou_ids:
                    ou_accounts = list_account_for_ou(ou_id)
                    policy["accounts"].extend(ou_accounts)

        policy["permissions"] = entitlement["Item"]["permissions"]
        policy["approvalRequired"] = entitlement["Item"]["approvalRequired"]
        policy["duration"] = str(maxDuration)
        eligibility.append(policy)
    result = {"id": event["id"], "policy": eligibility, "username":username}
    print(result)

    return publishPolicy(result)
