import json
import os
import time
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
cache_table = dynamodb.Table(os.environ["CACHE_TABLE_NAME"])
org_client = boto3.client("organizations")
CACHE_TTL = int(os.environ.get("CACHE_TTL", "604800"))
ACCOUNT_ID = os.environ["ACCOUNT_ID"]


def get_mgmt_account_id():
    try:
        response = org_client.describe_organization()
        return response["Organization"]["MasterAccountId"]
    except ClientError as e:
        print(f"Error getting management account: {e}")
        return None


mgmt_account_id = get_mgmt_account_id()


def list_accounts_for_ou(ou_id):
    deployed_in_mgmt = ACCOUNT_ID == mgmt_account_id
    accounts = []
    
    try:
        paginator = org_client.get_paginator("list_accounts_for_parent")
        for page in paginator.paginate(ParentId=ou_id):
            for acct in page["Accounts"]:
                if not deployed_in_mgmt and acct["Id"] == mgmt_account_id:
                    continue
                accounts.append({"name": acct["Name"], "id": acct["Id"]})
        return accounts
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code in ["ParentNotFoundException", "OrganizationalUnitNotFoundException", "TargetNotFoundException"]:
            print(f"OU {ou_id} not found (deleted or moved)")
        else:
            print(f"Error listing accounts for OU {ou_id}: {e}")
        return []  # Return empty for this OU, continue with others


def get_cached_accounts(ou_id):
    try:
        response = cache_table.get_item(Key={"ou_id": ou_id})
        if "Item" in response:
            item = response["Item"]
            if item.get("status") == "ready":
                accounts_data = item.get("accounts")
                # Handle both JSON string and native list
                if isinstance(accounts_data, str):
                    return json.loads(accounts_data)
                return accounts_data if accounts_data else []
        return None
    except ClientError as e:
        print(f"Error reading cache: {e}")
        return None


def populate_cache(ou_id):
    current_time = int(time.time())
    ttl = current_time + CACHE_TTL
    
    try:
        # Check if another process is populating
        cache_table.update_item(
            Key={"ou_id": ou_id},
            UpdateExpression="SET #status = :populating, cached_at = :time",
            ConditionExpression="attribute_not_exists(ou_id) OR #status <> :populating",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":populating": "populating",
                ":time": Decimal(str(current_time))
            },
            ReturnValues="ALL_NEW"
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            # Another process is populating - check if stuck
            try:
                item = cache_table.get_item(Key={"ou_id": ou_id}).get("Item", {})
                if item.get("status") == "populating":
                    cached_at = int(item.get("cached_at", 0))
                    # If stuck for more than 30 seconds, force refresh
                    if current_time - cached_at > 30:
                        print(f"Cache stuck in populating state for OU {ou_id}, forcing refresh")
                        cache_table.delete_item(Key={"ou_id": ou_id})
                        return populate_cache(ou_id)
            except Exception as check_error:
                print(f"Error checking stuck cache: {check_error}")
            
            # Wait and retry read
            time.sleep(0.5)
            cached = get_cached_accounts(ou_id)
            return cached if cached is not None else []
        raise
    
    try:
        # Fetch accounts from Organizations API
        accounts = list_accounts_for_ou(ou_id)
        
        # Store as JSON string for AWSJSON type (even if empty)
        cache_table.put_item(
            Item={
                "ou_id": ou_id,
                "accounts": json.dumps(accounts),
                "cached_at": Decimal(str(current_time)),
                "ttl": Decimal(str(ttl)),
                "status": "ready"
            }
        )
        
        return accounts
    except Exception as e:
        # Ensure we don't leave cache in populating state
        print(f"Error populating cache for OU {ou_id}: {e}")
        try:
            cache_table.delete_item(Key={"ou_id": ou_id})
        except Exception as cleanup_error:
            print(f"Error cleaning up stuck cache: {cleanup_error}")
        return []


def get_accounts_for_ous(ou_ids):
    results = {}
    
    for ou_id in ou_ids:
        # Try cache first
        cached = get_cached_accounts(ou_id)
        if cached is not None:
            results[ou_id] = {"accounts": cached, "cached": True}
        else:
            # Cache miss - populate
            accounts = populate_cache(ou_id)
            results[ou_id] = {"accounts": accounts, "cached": False}
    
    return results


def handler(event, context):
    ou_ids = event["arguments"].get("ouIds", [])
    
    if not ou_ids:
        return {"results": []}
    
    print(f"Processing {len(ou_ids)} OUs")
    
    # Get accounts for all OUs
    ou_results = get_accounts_for_ous(ou_ids)
    
    # Format response
    results = []
    for ou_id, data in ou_results.items():
        results.append({
            "ouId": ou_id,
            "accounts": data["accounts"],
            "cached": data["cached"]
        })
    
    return {"results": results}
