# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
from botocore.exceptions import ClientError

client = boto3.client('organizations')


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
    OUs[0]["Children"] = ou_tree
    return OUs
