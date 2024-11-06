# © 2024 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import os
from botocore.exceptions import ClientError
import boto3
import json

team_admin_group = os.getenv("TEAM_ADMIN_GROUP")
team_auditor_group = os.getenv("TEAM_AUDITOR_GROUP")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
dynamodb = boto3.resource('dynamodb')
settings_table = dynamodb.Table(settings_table_name)

def get_settings():
    response = settings_table.get_item(
        Key={
            'id': 'settings'
        }
    )
    return response

def get_team_groups():
    try:
        settings = get_settings()
        item_settings = settings.get("Item", {})
        team_admin_group = item_settings.get("teamAdminGroup", os.getenv("TEAM_ADMIN_GROUP"))
        team_auditor_group = item_settings.get("teamAuditorGroup", os.getenv("TEAM_AUDITOR_GROUP"))
    except Exception as e:
        print(f"Error retrieving TEAM settings from database: {e}")
    return team_admin_group, team_auditor_group


def get_identity_store_id():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]['IdentityStoreId']
    except ClientError as e:
        print(e.response['Error']['Message'])


sso_instance = get_identity_store_id()


def get_user(username):
    try:
        client = boto3.client('identitystore')
        response = client.get_user_id(
            IdentityStoreId=sso_instance,
            AlternateIdentifier={
                'UniqueAttribute': {
                    'AttributePath': 'userName',
                    'AttributeValue': username
                },
            }
        )
        return response['UserId']
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_group(group):
    try:
        client = boto3.client('identitystore')
        response = client.get_group_id(
            IdentityStoreId=sso_instance,
            AlternateIdentifier={
                'UniqueAttribute': {
                    'AttributePath': 'DisplayName',
                    'AttributeValue': group
                }
            }
        )
        return response['GroupId']
    except ClientError as e:
        print(e.response['Error']['Message'])

# Paginate

def list_idc_group_membership(userId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_group_memberships_for_member')
        paginator = p.paginate(IdentityStoreId=sso_instance,
            MemberId={
                'UserId': userId
            })
        all_groups = []
        for page in paginator:
            all_groups.extend(page["GroupMemberships"])
        return all_groups
    except ClientError as e:
        print(e.response['Error']['Message'])


def handler(event, context):
    team_admin_group, team_auditor_group = get_team_groups()
    
    user = event["userName"].split("_", 1)[1]
    userId = get_user(user)
    admin = get_group(team_admin_group)
    auditor = get_group(team_auditor_group)
    groups = []
    groupIds = str()

    groupData = list_idc_group_membership(userId)
    
    for group in groupData:
        groupIds += group["GroupId"] + ","
        if group["GroupId"] == admin:
            # add_user_to_group(user, "Admin")
            groups.append("Admin")
        elif group["GroupId"] == auditor:
            # add_user_to_group(user, "Auditors")
            groups.append("Auditors")

    event["response"] = {
        "claimsOverrideDetails": {
            "claimsToAddOrOverride": {
                "userId": userId,
                "groupIds": groupIds,
                "groups": ",".join(groups)
            },
            "groupOverrideDetails": {
                "groupsToOverride": groups,
            },
        }
    }

    return event