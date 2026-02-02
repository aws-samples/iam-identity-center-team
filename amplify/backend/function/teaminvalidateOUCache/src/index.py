import json
import os
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
cache_table = dynamodb.Table(os.environ["CACHE_TABLE_NAME"])


def invalidate_cache(ou_id):
    try:
        cache_table.delete_item(Key={"ou_id": ou_id})
        print(f"Invalidated cache for OU: {ou_id}")
        return True
    except ClientError as e:
        print(f"Error invalidating cache for OU {ou_id}: {e}")
        return False


def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # Handle GraphQL mutation
    ou_ids = event.get("arguments", {}).get("ouIds", [])
    
    if not ou_ids:
        return {
            "invalidated": [],
            "failed": [],
            "message": "No OU IDs provided"
        }
    
    # Validate and invalidate
    invalidated = []
    failed = []
    
    for ou_id in ou_ids:
        if invalidate_cache(ou_id):
            invalidated.append(ou_id)
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

