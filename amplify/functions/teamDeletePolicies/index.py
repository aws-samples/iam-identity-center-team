import json
import os
import boto3

dynamodb = boto3.resource('dynamodb')

eligibility_table_name = os.environ.get('ELIGIBILITY_TABLE_NAME')
policies_table_name = os.environ.get('POLICIES_TABLE_NAME')
eligibility_table = dynamodb.Table(eligibility_table_name)
policies_table = dynamodb.Table(policies_table_name)

def handler(event, context):
    """
    Batch delete policies with validation.
    Checks if each policy is used in any eligibility before deletion.
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

    if not eligibility_table_name or not policies_table_name:
        return {
            'deleted': [],
            'failed': [],
            'message': 'Table names not configured'
        }

    # Load all eligibilities once to check usage
    all_eligibilities = []
    scan_kwargs = {}
    while True:
        response = eligibility_table.scan(**scan_kwargs)
        all_eligibilities.extend(response.get('Items', []))
        if 'LastEvaluatedKey' in response:
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        else:
            break

    # Build a map of policy ID -> list of eligibility names using it
    usage_map = {}
    for eligibility in all_eligibilities:
        eligibility_name = eligibility.get('name', eligibility.get('id', 'unknown'))
        policy_ids = eligibility.get('policyIds', [])
        for policy_id in policy_ids:
            if policy_id:
                if policy_id not in usage_map:
                    usage_map[policy_id] = []
                usage_map[policy_id].append(eligibility_name)

    deleted = []
    failed = []

    for policy_id in ids:
        try:
            # Check if policy exists
            response = policies_table.get_item(Key={'id': policy_id})
            if 'Item' not in response:
                failed.append({
                    'id': policy_id,
                    'reason': f'Policy "{policy_id}" not found',
                    'usedIn': []
                })
                continue

            # Check if used in any eligibility
            used_in_eligibilities = usage_map.get(policy_id, [])
            if used_in_eligibilities:
                failed.append({
                    'id': policy_id,
                    'reason': 'Used in eligibilities',
                    'usedIn': used_in_eligibilities
                })
                continue

            # Safe to delete
            policies_table.delete_item(Key={'id': policy_id})
            deleted.append(policy_id)

        except Exception as e:
            print(f"Error processing {policy_id}: {str(e)}")
            failed.append({
                'id': policy_id,
                'reason': str(e),
                'usedIn': []
            })

    return {
        'deleted': deleted,
        'failed': failed,
        'message': f'Deleted {len(deleted)}, failed {len(failed)}'
    }
