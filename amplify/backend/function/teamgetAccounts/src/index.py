# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
from botocore.exceptions import ClientError
client = boto3.client('organizations')

def get_mgmt_account_id():
    org_client = boto3.client('organizations')
    try:
        response = org_client.describe_organization()
        return response['Organization']['MasterAccountId']
    except ClientError as e:
        print(e.response['Error']['Message'])
        
mgmt_account_id = get_mgmt_account_id()
        
def handler(event, context):
    account = []
    try:
        p = client.get_paginator('list_accounts')
        paginator = p.paginate()

        for page in paginator:
            for acct in page['Accounts']:
                if acct['Id'] != mgmt_account_id:
                    account.extend([{"name": acct['Name'], 'id':acct['Id']}])
        return account
    except ClientError as e:
        print(e.response['Error']['Message'])
