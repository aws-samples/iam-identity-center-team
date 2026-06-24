# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
import os
from botocore.exceptions import ClientError
from operator import itemgetter
client = boto3.client('organizations')

ACCOUNT_ID = os.environ['ACCOUNT_ID']


def get_mgmt_account_id():
    """Get the management account ID from Organizations. Fails fast if unavailable."""
    org_client = boto3.client('organizations')
    try:
        response = org_client.describe_organization()
        return response['Organization']['MasterAccountId']
    except ClientError as e:
        raise RuntimeError(f"Cannot retrieve management account ID: {e}") from e


# Lazy init - not called at module level to avoid cold start failures
_mgmt_account_id = None


def ensure_mgmt_account_id():
    """Lazy init for mgmt_account_id. Retries on each invocation if previously failed."""
    global _mgmt_account_id
    if _mgmt_account_id is None:
        _mgmt_account_id = get_mgmt_account_id()
    return _mgmt_account_id


def handler(event, context):
    account = []
    mgmt_account_id = ensure_mgmt_account_id()
    deployed_in_mgmt = True if ACCOUNT_ID == mgmt_account_id else False
    try:
        p = client.get_paginator('list_accounts')
        paginator = p.paginate()

        for page in paginator:
            for acct in page['Accounts']:
                if not deployed_in_mgmt:
                    if acct['Id'] != mgmt_account_id:
                        account.extend(
                            [{"name": acct['Name'], 'id':acct['Id']}])
                else:
                    account.extend([{"name": acct['Name'], 'id':acct['Id']}])
        return sorted(account, key=itemgetter('name'))
    except ClientError as e:
        print(e.response['Error']['Message'])
