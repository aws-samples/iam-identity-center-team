import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')

policies_table_name = os.environ.get('POLICIES_TABLE_NAME')
approvers_table_name = os.environ.get('APPROVERS_TABLE_NAME')


def handler(event, context):
    """
    Batch delete approver groups with validation.
    Checks if each group is used in any policy before deletion.
    Returns which were deleted and which failed (with reasons).
    """
    print(f"Event: {json.dumps(event)}")

    ids = event.get('arguments', {}).get('ids', [])

    if not ids:
        return {
            'deleted': [],
            'failed': [],
            'message': 'No IDs provided'
        }

    if not policies_table_name or not approvers_table_name:
        return {
            'deleted': [],
            'failed': [],
            'message': 'Table names not configured'
        }

    policies_table = dynamodb.Table(policies_table_name)
    approvers_table = dynamodb.Table(approvers_table_name)

    # Load all policies once to check usage
    all_policies = []
    scan_kwargs = {}
    while True:
        response = policies_table.scan(**scan_kwargs)
        all_policies.extend(response.get('Items', []))
        if 'LastEvaluatedKey' in response:
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        else:
            break

    # Build a map of approver group ID -> list of policy IDs using it
    usage_map = {}
    for policy in all_policies:
        policy_id = policy.get('id', 'unknown')
        approver_group_ids = policy.get('approverGroupIds', [])
        for group in approver_group_ids:
            if isinstance(group, dict):
                group_id = group.get('id')
                if group_id:
                    if group_id not in usage_map:
                        usage_map[group_id] = []
                    usage_map[group_id].append(policy_id)

    deleted = []
    failed = []

    for approver_id in ids:
        try:
            # Check if approver group exists
            response = approvers_table.get_item(Key={'id': approver_id})
            if 'Item' not in response:
                failed.append({
                    'id': approver_id,
                    'reason': f'Approver group "{approver_id}" not found',
                    'usedIn': []
                })
                continue

            # Check if used in any policy
            used_in_policies = usage_map.get(approver_id, [])
            if used_in_policies:
                failed.append({
                    'id': approver_id,
                    'reason': 'Used in policies',
                    'usedIn': used_in_policies
                })
                continue

            # Safe to delete
            approvers_table.delete_item(Key={'id': approver_id})
            deleted.append(approver_id)

        except Exception as e:
            print(f"Error processing {approver_id}: {str(e)}")
            failed.append({
                'id': approver_id,
                'reason': str(e),
                'usedIn': []
            })

    return {
        'deleted': deleted,
        'failed': failed,
        'message': f'Deleted {len(deleted)}, failed {len(failed)}'
    }
