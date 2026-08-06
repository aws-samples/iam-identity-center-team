# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
from botocore.exceptions import ClientError
import boto3
from datetime import date, datetime
from operator import itemgetter


def get_identiy_store_id():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]['IdentityStoreId']
    except ClientError as e:
        print(e.response['Error']['Message'])


sso_instance = get_identiy_store_id()


def jsonify(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [jsonify(item) for item in obj]
    if isinstance(obj, dict):
        return {key: jsonify(value) for key, value in obj.items()}
    return obj


def list_idc_users(IdentityStoreId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_users')
        paginator = p.paginate(IdentityStoreId=IdentityStoreId)
        all_users = []
        for page in paginator:
            all_users.extend(page["Users"])
        return jsonify(sorted(all_users, key=itemgetter('UserName')))
    except ClientError as e:
        print(e.response['Error']['Message'])


def handler(event, context):
    return list_idc_users(sso_instance)
