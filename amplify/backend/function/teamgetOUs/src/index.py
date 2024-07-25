# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
import os
from botocore.exceptions import ClientError


def handler(event, context):
    lambda_client = boto3.client('lambda')

    invoke_params = {
        'FunctionName': os.environ['FUNCTION_TEAMPUBLISHOUS_NAME'],  
        'InvocationType': 'Event'
        }

    lambda_client.invoke(**invoke_params)

    return "invoked"