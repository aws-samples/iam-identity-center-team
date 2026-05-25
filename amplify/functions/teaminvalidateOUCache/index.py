import json
import os
import boto3
from team_cache import OUCache

dynamodb = boto3.resource("dynamodb")
org_client = boto3.client("organizations")
cache_table_name = os.environ["CACHE_TABLE_NAME"]

ou_cache = OUCache(dynamodb, cache_table_name, 0, "", org_client)


def handler(event, context):
    print(f"Received event: {json.dumps(event)}")

    ou_ids = event.get("arguments", {}).get("ouIds", [])

    if not ou_ids:
        return {
            "invalidated": [],
            "failed": [],
            "message": "No OU IDs provided"
        }

    invalidated = []
    failed = []

    for ou_id in ou_ids:
        if ou_cache.invalidate(ou_id):
            invalidated.append(ou_id)
            print(f"Invalidated cache for OU: {ou_id}")
        else:
            failed.append(ou_id)

    message = f"Invalidated {len(invalidated)} cache entries"
    if failed:
        message += f", {len(failed)} failed"

    return {
        "invalidated": invalidated,
        "failed": failed,
        "message": message
    }
