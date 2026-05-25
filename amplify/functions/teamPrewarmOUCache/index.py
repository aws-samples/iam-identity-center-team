# Pre-warm OU cache by refreshing all OUs from all policies
import os
import boto3
from concurrent.futures import ThreadPoolExecutor, as_completed
from team_cache import OUCache

dynamodb = boto3.resource("dynamodb")
org_client = boto3.client("organizations")
policies_table = dynamodb.Table(os.environ["POLICIES_TABLE_NAME"])
cache_table_name = os.environ["CACHE_TABLE_NAME"]
CACHE_TTL = int(os.environ.get("CACHE_TTL", "604800"))
ACCOUNT_ID = os.environ.get("ACCOUNT_ID", "")

ou_cache = OUCache(dynamodb, cache_table_name, CACHE_TTL, ACCOUNT_ID, org_client)


def get_all_ou_ids():
    """Scan all policies and collect unique OU IDs"""
    all_ou_ids = set()
    scan_kwargs = {}

    while True:
        response = policies_table.scan(**scan_kwargs)
        for item in response.get("Items", []):
            for ou in item.get("ous", []) or []:
                if ou and ou.get("id"):
                    all_ou_ids.add(ou["id"])

        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return all_ou_ids


def handler(event, context):
    print("Starting OU cache pre-warm")

    # Get all unique OUs from policies
    all_ou_ids = get_all_ou_ids()
    print(f"Found {len(all_ou_ids)} unique OUs to pre-warm")

    if not all_ou_ids:
        return {
            "message": "No OUs found in policies",
            "refreshed": 0,
            "failed": 0
        }

    # Refresh cache for each OU (parallel)
    refreshed = []
    failed = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_ou = {
            executor.submit(ou_cache.populate_cache, ou_id): ou_id
            for ou_id in all_ou_ids
        }
        for future in as_completed(future_to_ou):
            ou_id = future_to_ou[future]
            try:
                accounts = future.result()
                refreshed.append(ou_id)
                print(f"Refreshed OU {ou_id}: {len(accounts)} accounts")
            except Exception as e:
                failed.append(ou_id)
                print(f"Failed to refresh OU {ou_id}: {e}")

    message = f"Pre-warm complete: {len(refreshed)} refreshed, {len(failed)} failed"
    print(message)

    return {
        "message": message,
        "refreshed": len(refreshed),
        "failed": len(failed),
        "ou_ids": list(all_ou_ids)
    }
