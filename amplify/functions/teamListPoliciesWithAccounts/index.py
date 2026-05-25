# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http://aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

import json
import os
import time
import boto3
from botocore.exceptions import ClientError
from concurrent.futures import ThreadPoolExecutor, as_completed
from team_cache import OUCache

dynamodb = boto3.resource("dynamodb")
policies_table = dynamodb.Table(os.environ["POLICIES_TABLE_NAME"])
settings_table = dynamodb.Table(os.environ["SETTINGS_TABLE_NAME"])
org_client = boto3.client("organizations")
CACHE_TTL = int(os.environ.get("CACHE_TTL", "604800"))
ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")
cache_table_name = os.environ.get("CACHE_TABLE_NAME")

ou_cache = OUCache(dynamodb, cache_table_name, CACHE_TTL, ACCOUNT_ID, org_client)


def get_settings():
    """Get settings from DynamoDB"""
    try:
        response = settings_table.get_item(Key={"id": "settings"})
        return response.get("Item", {})
    except ClientError as e:
        print(f"Error getting settings: {e}")
        return {}


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
    print(f"Settings loaded: {settings}")

    # Handle both boolean and string values for useOUCache
    raw_value = settings.get("useOUCache", False)
    if isinstance(raw_value, bool):
        use_ou_cache = raw_value
    elif isinstance(raw_value, str):
        use_ou_cache = raw_value.lower() in ("true", "1", "yes")
    else:
        use_ou_cache = bool(raw_value)

    print(f"Using OU cache: {use_ou_cache} (raw value: {raw_value}, type: {type(raw_value).__name__})")

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
    resolve_fn = ou_cache.get_accounts if use_ou_cache else ou_cache.list_accounts_for_ou
    ou_accounts_map = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_ou = {executor.submit(resolve_fn, ou_id): ou_id for ou_id in all_ou_ids}
        for future in as_completed(future_to_ou):
            ou_id = future_to_ou[future]
            result = future.result()
            ou_accounts_map[ou_id] = result if result else []

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
