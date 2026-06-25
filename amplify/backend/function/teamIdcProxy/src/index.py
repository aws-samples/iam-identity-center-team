import os
import json
import boto3
from botocore.exceptions import ClientError

idc_region = os.getenv('IDC_REGION', os.environ.get('REGION'))
instance_arn = os.getenv('INSTANCE_ARN')

client = boto3.client('sso-admin', region_name=idc_region)


def handler(event, context):
    action = event.get('action')
    params = {
        'InstanceArn': event.get('InstanceArn', instance_arn),
        'PermissionSetArn': event['PermissionSetArn'],
        'PrincipalId': event['PrincipalId'],
        'PrincipalType': event.get('PrincipalType', 'USER'),
        'TargetId': event['TargetId'],
        'TargetType': event.get('TargetType', 'AWS_ACCOUNT'),
    }

    if action == 'createAccountAssignment':
        response = client.create_account_assignment(**params)
        return response.get('AccountAssignmentCreationStatus')
    elif action == 'deleteAccountAssignment':
        response = client.delete_account_assignment(**params)
        return response.get('AccountAssignmentDeletionStatus')
    else:
        raise ValueError(f"Unknown action: {action}")
