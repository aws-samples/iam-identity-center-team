import json
import os
import re
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
cache_table = dynamodb.Table(os.environ["CACHE_TABLE_NAME"])

# OU ID format validation
OU_ID_PATTERN = re.compile(r'^ou-[a-z0-9]{4,32}-[a-z0-9]{8,32}$')


def invalidate_cache(ou_id):
    try:
        cache_table.delete_item(Key={"ou_id": ou_id})
        print(f"Invalidated cache for OU: {ou_id}")
        return True
    except ClientError as e:
        print(f"Error invalidating cache for OU {ou_id}: {e}")
        return False


def handle_eventbridge_event(event):
    """Handle EventBridge Organizations events"""
    detail = event.get("detail", {})
    event_name = detail.get("eventName", "")
    
    ou_ids_to_invalidate = set()
    
    if event_name == "MoveAccount":
        source_parent = detail.get("requestParameters", {}).get("sourceParentId")
        dest_parent = detail.get("requestParameters", {}).get("destinationParentId")
        if source_parent:
            ou_ids_to_invalidate.add(source_parent)
        if dest_parent:
            ou_ids_to_invalidate.add(dest_parent)
    
    elif event_name in ["CreateAccount", "CloseAccount", "RemoveAccountFromOrganization"]:
        response_elements = detail.get("responseElements", {})
        request_params = detail.get("requestParameters", {})
        
        parent_id = (
            response_elements.get("createAccountStatus", {}).get("organizationalUnitId") or
            request_params.get("parentId") or
            request_params.get("accountId")
        )
        
        if parent_id:
            ou_ids_to_invalidate.add(parent_id)
    
    elif event_name == "DeleteOrganizationalUnit":
        ou_id = detail.get("requestParameters", {}).get("organizationalUnitId")
        if ou_id:
            ou_ids_to_invalidate.add(ou_id)
    
    results = []
    for ou_id in ou_ids_to_invalidate:
        success = invalidate_cache(ou_id)
        results.append({"ouId": ou_id, "success": success})
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": f"Processed {event_name}",
            "invalidated": results
        })
    }


def handle_graphql_request(event):
    """Handle manual GraphQL mutation from admins"""
    ou_ids = event["arguments"].get("ouIds", [])
    
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
        if not OU_ID_PATTERN.match(ou_id):
            failed.append(ou_id)
            continue
        
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


def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    
    # Detect event source
    if "detail-type" in event and event.get("source") == "aws.organizations":
        # EventBridge event
        return handle_eventbridge_event(event)
    elif "arguments" in event:
        # GraphQL mutation
        return handle_graphql_request(event)
    else:
        print("Unknown event type")
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Unknown event type"})
        }
