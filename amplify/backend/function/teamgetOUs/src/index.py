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


def listOUs(id):
    OUs = getOUs(id)
    for OU in OUs:
        OUs.extend(getOUs(OU["Id"]))
    return OUs


def handler(event, context):
    response = client.list_roots()
    rootOU = response['Roots']
    OUs = listOUs(rootOU[0]['Id'])
    return (rootOU + OUs)
