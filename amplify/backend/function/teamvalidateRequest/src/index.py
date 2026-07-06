import json
import os
import time
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
organizations = boto3.client("organizations")

eligibility_table = dynamodb.Table(os.environ["ELIGIBILITY_TABLE_NAME"])
policies_table_name = os.environ["POLICIES_TABLE_NAME"]


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
        request_items = {table_name: {"Keys": batch_keys}}
        no_progress_count = 0
        batch_start = time.time()

        while request_items:
            response = dynamodb.batch_get_item(RequestItems=request_items)
            items = response.get("Responses", {}).get(table_name, [])
            all_items.extend(items)
            request_items = response.get("UnprocessedKeys", {})

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


def get_policies(policy_ids):
    """Get policies by IDs from DynamoDB using batch_get_item"""
    policy_keys = [{"id": pid} for pid in policy_ids if pid]
    return batch_get_with_backoff(policies_table_name, policy_keys)


def get_account_parent_ou(account_id):
    """Get the parent OU ID for an account from Organizations API"""
    try:
        response = organizations.list_parents(ChildId=account_id)
        parents = response.get("Parents", [])
        
        if not parents:
            print(f"No parent found for account {account_id}")
            return None
        
        return parents[0].get("Id")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "AccountNotFoundException":
            print(f"Account {account_id} not found in Organizations")
            return None
        print(f"Error getting parent for account {account_id}: {e}")
        raise


def get_user_eligibility(user_id, group_ids):
    """Get all eligibility entries for user and their groups"""
    eligibility_entries = []
    
    # Get user's direct eligibility
    try:
        response = eligibility_table.get_item(Key={"id": user_id})
        if "Item" in response:
            eligibility_entries.append(response["Item"])
    except ClientError as e:
        print(f"Error getting eligibility for user {user_id}: {e}")
    
    # Get group eligibilities
    for group_id in group_ids:
        if not group_id:
            continue
        try:
            response = eligibility_table.get_item(Key={"id": group_id})
            if "Item" in response:
                eligibility_entries.append(response["Item"])
        except ClientError as e:
            print(f"Error getting eligibility for group {group_id}: {e}")
    
    return eligibility_entries


def check_entry_for_access(entry, account_id, permission_set_id, parent_ou):
    """Check if an entry (eligibility or policy) grants access to the account/permission"""
    # Check direct account grants
    accounts = entry.get("accounts", [])
    print(f"Checking entry - accounts: {accounts}, ous: {entry.get('ous', [])}, permissions: {entry.get('permissions', [])}")
    print(f"Looking for account_id: {account_id}, permission_set_id: {permission_set_id}")
    for account in accounts:
        if account.get("id") == account_id:
            permissions = entry.get("permissions", [])
            for perm in permissions:
                if perm.get("id") == permission_set_id:
                    return True, "Direct account grant"

    # Check OU-based grants
    ous = entry.get("ous", [])
    if ous and parent_ou:
        for ou in ous:
            if ou.get("id") == parent_ou:
                permissions = entry.get("permissions", [])
                for perm in permissions:
                    if perm.get("id") == permission_set_id:
                        return True, f"OU-based grant (OU: {parent_ou})"

    return False, None


def validate_request(account_id, permission_set_id, user_id, group_ids, policy_id=None):
    """
    Validate that the user is eligible to request access to the account/permission set.
    If policy_id is provided, validate only against that specific policy.
    Returns (is_valid, reason)
    """
    eligibility_entries = get_user_eligibility(user_id, group_ids)

    if not eligibility_entries:
        return False, "No eligibility entries found for user"

    # Get parent OU once for all checks
    parent_ou = get_account_parent_ou(account_id)

    # If specific policy_id provided, validate against that policy only
    if policy_id:
        # Check if user has access to this policy through any eligibility
        user_has_policy = False
        for entry in eligibility_entries:
            if policy_id in entry.get("policyIds", []):
                user_has_policy = True
                break

        if not user_has_policy:
            return False, f"User does not have access to policy {policy_id}"

        # Fetch and validate against the specific policy
        policies = get_policies([policy_id])
        if not policies:
            return False, f"Policy {policy_id} not found"

        policy = policies[0]
        is_valid, reason = check_entry_for_access(policy, account_id, permission_set_id, parent_ou)
        if is_valid:
            return True, f"Policy-based grant (policy: {policy_id})"
        return False, "Account/permission not in the selected policy"

    # Collect all policy IDs from policy-based eligibilities
    all_policy_ids = []
    for entry in eligibility_entries:
        entry_policy_ids = entry.get("policyIds", [])
        if entry_policy_ids:
            all_policy_ids.extend(entry_policy_ids)

    # Fetch all policies at once
    policies_map = {p["id"]: p for p in get_policies(all_policy_ids)} if all_policy_ids else {}

    # Check each eligibility entry
    for entry in eligibility_entries:
        entry_policy_ids = entry.get("policyIds", [])

        if entry_policy_ids:
            # Policy-based: check each policy
            for pid in entry_policy_ids:
                policy = policies_map.get(pid)
                if policy:
                    is_valid, reason = check_entry_for_access(policy, account_id, permission_set_id, parent_ou)
                    if is_valid:
                        return True, f"Policy-based grant (policy: {pid})"
        else:
            # Legacy: check eligibility directly
            is_valid, reason = check_entry_for_access(entry, account_id, permission_set_id, parent_ou)
            if is_valid:
                return True, reason

    return False, "Account not in user's eligible accounts or OUs"


def handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    # Extract request details from GraphQL mutation arguments
    arguments = event.get("arguments", {})

    account_id = arguments.get("accountId")
    role_id = arguments.get("roleId")
    user_id = arguments.get("userId")
    group_ids = arguments.get("groupIds", [])
    policy_id = arguments.get("policyId")

    if not account_id or not role_id:
        return {
            "valid": False,
            "reason": "Missing accountId or roleId"
        }

    if not user_id:
        return {
            "valid": False,
            "reason": "Missing userId"
        }
    
    # Validate the request
    is_valid, reason = validate_request(account_id, role_id, user_id, group_ids, policy_id)

    print(f"Validation result for user {user_id}, account {account_id}, role {role_id}, policy {policy_id}: {is_valid} - {reason}")
    
    return {
        "valid": is_valid,
        "reason": reason
    }
