# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http://aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import json
import os
import time
import boto3
from botocore.exceptions import ClientError
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed

dynamodb = boto3.resource("dynamodb")
policies_table = dynamodb.Table(os.environ["POLICIES_TABLE_NAME"])
cache_table = dynamodb.Table(os.environ["CACHE_TABLE_NAME"])
settings_table = dynamodb.Table(os.environ["SETTINGS_TABLE_NAME"])
org_client = boto3.client("organizations")
CACHE_TTL = int(os.environ.get("CACHE_TTL", "604800"))
ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")


def get_mgmt_account_id():
    """Get the management account ID from Organizations"""
    try:
        response = org_client.describe_organization()
        return response["Organization"]["MasterAccountId"]
    except ClientError as e:
        print(f"Error getting management account: {e}")
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


def list_accounts_for_ou(ou_id):
    """List accounts for an OU from Organizations API"""
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
        return []


def get_cached_accounts(ou_id):
    """Get cached accounts for an OU from DynamoDB"""
    try:
        response = cache_table.get_item(Key={"ou_id": ou_id})
        if "Item" in response:
            item = response["Item"]
            if item.get("status") == "ready":
                accounts_data = item.get("accounts")
                if isinstance(accounts_data, str):
                    return json.loads(accounts_data)
                return accounts_data if accounts_data else []
        return None
    except ClientError as e:
        print(f"Error reading cache: {e}")
        return None


def populate_cache(ou_id):
    """Populate cache for an OU"""
    current_time = int(time.time())
    ttl = current_time + CACHE_TTL

    try:
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
            time.sleep(0.5)
            cached = get_cached_accounts(ou_id)
            return cached if cached is not None else []
        raise

    try:
        accounts = list_accounts_for_ou(ou_id)
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
        print(f"Error populating cache for OU {ou_id}: {e}")
        try:
            cache_table.delete_item(Key={"ou_id": ou_id})
        except Exception as cleanup_error:
            print(f"Error cleaning up stuck cache: {cleanup_error}")
        return []


def get_accounts_for_ou(ou_id):
    """Get accounts for an OU, using cache if available"""
    cached = get_cached_accounts(ou_id)
    if cached is not None:
        return cached
    return populate_cache(ou_id)


def scan_segment(segment, total_segments):
    """Scan a single segment of the policies table"""
    items = []
    try:
        response = policies_table.scan(
            Segment=segment,
            TotalSegments=total_segments
        )
        items.extend(response.get("Items", []))

        while "LastEvaluatedKey" in response:
            response = policies_table.scan(
                Segment=segment,
                TotalSegments=total_segments,
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            items.extend(response.get("Items", []))

        return items
    except ClientError as e:
        print(f"Error scanning segment {segment}: {e}")
        return []


def get_all_policies():
    """Parallel scan all policies from DynamoDB"""
    total_segments = 4
    policies = []

    with ThreadPoolExecutor(max_workers=total_segments) as executor:
        futures = [
            executor.submit(scan_segment, segment, total_segments)
            for segment in range(total_segments)
        ]
        for future in as_completed(futures):
            policies.extend(future.result())

    return policies


def handler(event, context):
    print("Fetching policies with resolved accounts")

    # Get settings to check if cache is enabled
    settings = get_settings()
    use_ou_cache = settings.get("useOUCache", False)
    print(f"Using OU cache: {use_ou_cache}")

    # 1. Get all policies
    policies = get_all_policies()
    print(f"Found {len(policies)} policies")

    # 2. Collect all unique OU IDs
    all_ou_ids = set()
    for policy in policies:
        for ou in policy.get("ous", []):
            if ou and ou.get("id"):
                all_ou_ids.add(ou["id"])

    print(f"Found {len(all_ou_ids)} unique OUs to resolve")

    # 3. Resolve all OUs to accounts (parallel)
    # Use cache or direct API based on settings
    resolve_fn = get_accounts_for_ou if use_ou_cache else list_accounts_for_ou
    ou_accounts_map = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_ou = {executor.submit(resolve_fn, ou_id): ou_id for ou_id in all_ou_ids}
        for future in as_completed(future_to_ou):
            ou_id = future_to_ou[future]
            result = future.result()
            ou_accounts_map[ou_id] = result if result else []
            print(f"OU {ou_id}: {len(ou_accounts_map[ou_id])} accounts")

    # 4. Build response with resolved accounts
    result = []
    for policy in policies:
        # Start with directly assigned accounts
        resolved_accounts = list(policy.get("accounts", []) or [])

        # Add accounts from OUs
        for ou in policy.get("ous", []) or []:
            if ou and ou.get("id"):
                ou_accounts = ou_accounts_map.get(ou["id"], [])
                resolved_accounts.extend(ou_accounts)

        # Deduplicate by account id
        seen_ids = set()
        unique_accounts = []
        for account in resolved_accounts:
            if account and account.get("id") and account["id"] not in seen_ids:
                seen_ids.add(account["id"])
                unique_accounts.append(account)

        result.append({
            "id": policy.get("id"),
            "accounts": policy.get("accounts", []),
            "resolvedAccounts": unique_accounts,
            "ous": policy.get("ous", []),
            "permissions": policy.get("permissions", []),
            "approvalRequired": policy.get("approvalRequired"),
            "approverGroupIds": policy.get("approverGroupIds", []),
            "duration": policy.get("duration"),
            "modifiedBy": policy.get("modifiedBy")
        })

    print(f"Returning {len(result)} policies with resolved accounts")
    return result
