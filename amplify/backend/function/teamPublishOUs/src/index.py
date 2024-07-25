# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import os
import boto3
from botocore.exceptions import ClientError
import requests
from requests_aws_sign import AWSV4Sign

client = boto3.client('organizations')

def publishOUs(result):
    session = boto3.session.Session()
    credentials = session.get_credentials()
    credentials = credentials.get_frozen_credentials()
    region = session.region_name

    query = """
        mutation PublishOUs($result: OUsInput) {
            publishOUs(result: $result) {
            ous
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

def getOUs(id):
    try:
        response = client.list_organizational_units_for_parent(
            ParentId=id,
        )
        results = response["OrganizationalUnits"]
        while "NextToken" in response:
            response = client.list_organizational_units_for_parent(ParentId=id, NextToken=response["NextToken"])
            results.extend(response["OrganizationalUnits"])
        return results
    except ClientError as e:
        print(e.response['Error']['Message'])
        
def get_ou_tree(ou_id):
    ou_list = []
    ous = getOUs(ou_id)
    for ou in ous:
        sub_ous = get_ou_tree(ou["Id"])
        ou["Children"] = sub_ous
        ou_list.append(ou)
    return ou_list

def handler(event, context):
    OUs = client.list_roots().get('Roots')
    root_ou_id = OUs[0].get('Id')
    ou_tree = get_ou_tree(root_ou_id)
    del OUs[0]["PolicyTypes"]
    OUs[0]["Children"] = ou_tree
    
    OUs = {"ous": json.dumps(OUs)}
    
    print(OUs)
    
    return publishOUs(OUs)