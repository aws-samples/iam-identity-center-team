# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
from botocore.exceptions import ClientError
import boto3

def get_identiy_store_id():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]['IdentityStoreId']
    except ClientError as e:
        print(e.response['Error']['Message'])


sso_instance = get_identiy_store_id()


def list_idc_groups(IdentityStoreId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_groups')
        paginator = p.paginate(IdentityStoreId=IdentityStoreId)
        for page in paginator:
            return page["Groups"]
    except ClientError as e:
        print(e.response['Error']['Message'])


def handler(event, context):
    return list_idc_groups(sso_instance)

