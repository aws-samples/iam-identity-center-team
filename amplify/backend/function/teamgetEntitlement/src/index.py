# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.exceptions import ClientError
import boto3
import requests
from requests_aws_sign import AWSV4Sign

eligibility_table_name = os.getenv("POLICY_TABLE_NAME")  # Legacy name for Eligibility table
policies_table_name = os.getenv("POLICIES_TABLE_NAME")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
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


mgmt_account_id = None


def batch_get_with_backoff(table_name, keys, batch_size=100, max_no_progress=5, max_time_per_batch=10):
    """
    Perform DynamoDB batch_get_item with exponential backoff for UnprocessedKeys.

    Fails if no progress made after max_no_progress retries or max_time_per_batch seconds.

    Args:
        table_name: Name of the DynamoDB table
        keys: List of key dictionaries (e.g., [{'id': 'key1'}, {'id': 'key2'}])
        batch_size: Maximum items per batch (default 100, DynamoDB limit)
        max_no_progress: Max retries without progress before failing (default 5)
        max_time_per_batch: Max seconds per batch before failing (default 10)

    Returns:
        List of all retrieved items

    Raises:
        Exception: If unable to fetch all items due to persistent throttling
    """
    if not keys:
        return []

    all_items = []

    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i + batch_size]
        request_items = {table_name: {'Keys': batch_keys}}
        no_progress_count = 0
        batch_start = time.time()

        while request_items:
            response = dynamodb.batch_get_item(RequestItems=request_items)
            items = response.get('Responses', {}).get(table_name, [])
            all_items.extend(items)
            request_items = response.get('UnprocessedKeys', {})

            if request_items:
                if items:
                    no_progress_count = 0
                else:
                    no_progress_count += 1

                elapsed = time.time() - batch_start
                if no_progress_count >= max_no_progress or elapsed >= max_time_per_batch:
                    raise Exception(f"DynamoDB throttling: unable to fetch all items after {elapsed:.1f}s")

                time.sleep(min(0.05 * (2 ** no_progress_count), 2))

    return all_items


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
                policyIds
                approverGroupIds {
                name
                id
                }
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
        return {}

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

    all_accounts = {}
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
                if result.get('ouId'):
                    all_accounts[result.get('ouId')] = result.get("accounts", [])
                    cached_status = "cached" if result.get("cached") else "fetched"
                    print(f"OU {result.get('ouId')}: {len(all_accounts[result.get('ouId')])} accounts ({cached_status})")

        except Exception as exception:
            print(f"Error calling getOUAccounts batch {i//batch_size + 1}")
            print(exception)
            continue

    return all_accounts


def list_account_for_ou(ou_id):
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


def get_entitlements(ids):
    eligibility_keys = [{'id': entity_id} for entity_id in ids if entity_id]
    return batch_get_with_backoff(eligibility_table_name, eligibility_keys)


def get_policies(policy_ids):
    """Fetch policies by IDs from DynamoDB with batching and retry."""
    policy_keys = [{'id': policy_id} for policy_id in policy_ids if policy_id]
    return batch_get_with_backoff(policies_table_name, policy_keys)


def resolve_all_ous_to_accounts(ou_ids):
    """Resolve all unique OUs to accounts map using parallel execution."""
    global mgmt_account_id
    if not ou_ids:
        return {}

    # Initialize mgmt_account_id before parallel execution
    if mgmt_account_id is None:
        mgmt_account_id = get_mgmt_account_id()

    # Use ThreadPoolExecutor for parallel OU resolution
    # max_workers=5 balances parallelism with AWS API rate limits
    ou_accounts_map = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        # Create list of (ou_id, future) pairs
        future_to_ou = {executor.submit(list_account_for_ou, ou_id): ou_id for ou_id in ou_ids}
        for future in as_completed(future_to_ou):
            ou_id = future_to_ou[future]
            result = future.result()
            ou_accounts_map[ou_id] = result if result else []

    return ou_accounts_map


def build_policy_entry(source, ou_accounts_map, policy_id=None):
    """Build policy entry from either Policy or Entitlement data."""
    accounts = list(source.get("accounts", []))

    # Resolve OUs from pre-fetched map
    ous = source.get("ous", [])
    for ou in ous:
        ou_accounts = ou_accounts_map.get(ou["id"], [])
        accounts.extend(ou_accounts)

    # Deduplicate accounts by id (same account can be in both accounts list and OUs)
    seen_ids = set()
    unique_accounts = []
    for account in accounts:
        if account["id"] not in seen_ids:
            seen_ids.add(account["id"])
            unique_accounts.append(account)

    return {
        "accounts": unique_accounts,
        "permissions": source.get("permissions", []),
        "approvalRequired": source.get("approvalRequired", True),
        "duration": str(source.get("duration", 0)),
        "policyIds": [policy_id] if policy_id else [],
        "approverGroupIds": source.get("approverGroupIds", [])
    }


def handler(event, context):
    userId = event["userId"]
    groupIds = event["groupIds"]
    username = event["username"]

    print("Id: ", event["id"])

    entitlements = get_entitlements([userId] + groupIds)

    # Collect and fetch all policies at once
    all_policy_ids = {pid for e in entitlements for pid in e.get("policyIds", [])}
    policies_map = {p["id"]: p for p in get_policies(list(all_policy_ids))} if all_policy_ids else {}

    # Collect all unique OU IDs from entitlements and policies
    all_ou_ids = set()
    for entitlement in entitlements:
        for ou in entitlement.get("ous", []):
            all_ou_ids.add(ou["id"])
    for policy in policies_map.values():
        for ou in policy.get("ous", []):
            all_ou_ids.add(ou["id"])

    # Get feature flag setting
    settings = get_settings()
    use_ou_cache = settings.get("useOUCache", False)  # Default to False (direct API)
    print(f"Using OU cache: {use_ou_cache}")

    # Resolve all OUs at once (parallel)
    if use_ou_cache:
        ou_accounts_map = get_ou_accounts(list(all_ou_ids))
    else:
        ou_accounts_map = resolve_all_ous_to_accounts(all_ou_ids)

    eligibility = []
    for entitlement in entitlements:
        policy_ids = entitlement.get("policyIds", [])

        if policy_ids:
            # Policy-based: entry for each policy
            for policy_id in policy_ids:
                if policy_id in policies_map:
                    eligibility.append(build_policy_entry(policies_map[policy_id], ou_accounts_map, policy_id))
        else:
            # Legacy: entry from entitlement
            eligibility.append(build_policy_entry(entitlement, ou_accounts_map))

    result = {"id": event["id"], "policy": eligibility, "username": username}
    print(result)

    return publishPolicy(result)
