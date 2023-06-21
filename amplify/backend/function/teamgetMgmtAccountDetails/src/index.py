# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
from botocore.exceptions import ClientError

client = boto3.client('sso-admin')

def list_existing_sso_instances():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]
    except ClientError as e:
        print(e.response['Error']['Message'])

sso_instance = list_existing_sso_instances()

def get_mgmt_account_id():
    org_client = boto3.client('organizations')
    try:
        response = org_client.describe_organization()
        return response['Organization']['MasterAccountId']
    except ClientError as e:
        print(e.response['Error']['Message'])

mgmt_account_id = get_mgmt_account_id()


def get_mgmt_ps():
    try:
        p = client.get_paginator('list_permission_sets_provisioned_to_account')
        paginator = p.paginate(
            InstanceArn=sso_instance['InstanceArn'],
            AccountId=mgmt_account_id,)
        all_permissions = []
        for page in paginator:
            all_permissions.extend(page["PermissionSets"])
        return all_permissions
    except ClientError as e:
        print(e.response['Error']['Message'])

def handler(event, context):
    permissions = get_mgmt_ps()
    print(permissions)
    return {"permissions":permissions}