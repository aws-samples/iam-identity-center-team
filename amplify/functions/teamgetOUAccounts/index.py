import os
import boto3
from team_cache import OUCache

dynamodb = boto3.resource("dynamodb")
org_client = boto3.client("organizations")
cache_table_name = os.environ["CACHE_TABLE_NAME"]
CACHE_TTL = int(os.environ.get("CACHE_TTL", "604800"))
ACCOUNT_ID = os.environ["ACCOUNT_ID"]

ou_cache = OUCache(dynamodb, cache_table_name, CACHE_TTL, ACCOUNT_ID, org_client)


def handler(event, context):
    ou_ids = event["arguments"].get("ouIds", [])

    if not ou_ids:
        return {"results": []}

    print(f"Processing {len(ou_ids)} OUs")

    results = []
    for ou_id in ou_ids:
        cached = ou_cache.get_cached_accounts(ou_id)
        if cached is not None:
            results.append({
                "ouId": ou_id,
                "accounts": cached,
                "cached": True
            })
        else:
            accounts = ou_cache.populate_cache(ou_id)
            results.append({
                "ouId": ou_id,
                "accounts": accounts,
                "cached": False
            })

    return {"results": results}
