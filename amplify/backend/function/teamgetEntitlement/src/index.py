# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import os
from botocore.exceptions import ClientError
import boto3
import requests
from requests_aws_sign import AWSV4Sign

policy_table_name = os.getenv("POLICY_TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
policy_table = dynamodb.Table(policy_table_name)

ACCOUNT_ID = os.environ["ACCOUNT_ID"]


def get_mgmt_account_id():
    org_client = boto3.client("organizations")
    try:
        response = org_client.describe_organization()
        return response["Organization"]["MasterAccountId"]
    except ClientError as e:
        print(e.response["Error"]["Message"])


mgmt_account_id = get_mgmt_account_id()


def publishPolicy(result):
    session = boto3.session.Session()
    credentials = session.get_credentials()
    credentials = credentials.get_frozen_credentials()
    region = session.region_name

    query = """
        mutation PublishPolicy($result: PolicyInput) {
            publishPolicy(result: $result) {
            id
            policy {
                accounts {
                name
                id
                }
                permissions {
                name
                id
                }
                approvalRequired
                duration
            }
            username
            }
        }
            """

    endpoint = os.environ.get("API_TEAM_GRAPHQLAPIENDPOINTOUTPUT", None)
    headers = {"Content-Type": "application/json"}
    payload = {"query": query, "variables": {"result": result}}

    appsync_region = region
    auth = AWSV4Sign(credentials, appsync_region, "appsync")

    try:
        response = requests.post(
            endpoint, auth=auth, json=payload, headers=headers
        ).json()
        if "errors" in response:
            print("Error attempting to query AppSync")
            print(response["errors"])
        else:
            print("Mutation successful")
            print(response)
    except Exception as exception:
        print("Error with Query")
        print(exception)

    return result


def list_account_for_ou(ouId):
    deployed_in_mgmt = True if ACCOUNT_ID == mgmt_account_id else False
    account = []
    client = boto3.client("organizations")
    try:
        p = client.get_paginator("list_accounts_for_parent")
        paginator = p.paginate(
            ParentId=ouId,
        )

        for page in paginator:
            for acct in page["Accounts"]:
                if not deployed_in_mgmt:
                    if acct["Id"] != mgmt_account_id:
                        account.extend([{"name": acct["Name"], "id": acct["Id"]}])
                else:
                    account.extend([{"name": acct["Name"], "id": acct["Id"]}])
        return account
    except ClientError as e:
        print(e.response["Error"]["Message"])


def get_entitlements(id):
    response = policy_table.get_item(Key={"id": id})
    return response


def handler(event, context):
    userId = event["userId"]
    groupIds = event["groupIds"]
    username = event["username"]
    eligibility = []
    maxDuration = 0
    
    print("Id: ", event["id"])

    for id in [userId] + groupIds:
        if not id:
            continue
        entitlement = get_entitlements(id)
        print(entitlement)
        if "Item" not in entitlement.keys():
            continue
        duration = entitlement["Item"]["duration"]
        if int(duration) > maxDuration:
            maxDuration = int(duration)
        policy = {}
        policy["accounts"] = entitlement["Item"]["accounts"]

        for ou in entitlement["Item"]["ous"]:
            data = list_account_for_ou(ou["id"])
            policy["accounts"].extend(data)

        policy["permissions"] = entitlement["Item"]["permissions"]
        policy["approvalRequired"] = entitlement["Item"]["approvalRequired"]
        policy["duration"] = str(maxDuration)
        eligibility.append(policy)
    result = {"id": event["id"], "policy": eligibility, "username":username}
    print(result)

    return publishPolicy(result)
