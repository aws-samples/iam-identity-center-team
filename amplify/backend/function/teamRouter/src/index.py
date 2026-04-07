# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import os
import json
import time
import boto3
import requests
from botocore.exceptions import ClientError
from requests_aws_sign import AWSV4Sign
import asyncio
from botocore.config import Config
    
policy_table_name = os.getenv("POLICY_TABLE_NAME")
settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
approver_table_name = os.getenv("APPROVER_TABLE_NAME")
requests_table_name = os.getenv("REQUESTS_TABLE_NAME")
policies_table_name = os.getenv("POLICIES_TABLE_NAME")
user_pool_id = os.getenv("AUTH_TEAM06DBB7FC_USERPOOLID")
dynamodb = boto3.resource('dynamodb')
approver_table = dynamodb.Table(approver_table_name)
policy_table = dynamodb.Table(policy_table_name)
settings_table = dynamodb.Table(settings_table_name)
policies_table = dynamodb.Table(policies_table_name)

grant = os.getenv("GRANT_SM")
revoke = os.getenv("REVOKE_SM")
reject = os.getenv("REJECT_SM")
schedule = os.getenv("SCHEDULE_SM")
approval = os.getenv("APPROVAL_SM")
notification_topic_arn = os.getenv("NOTIFICATION_TOPIC_ARN")
sso_login_url = os.getenv("SSO_LOGIN_URL")
fn_teamstatus_arn = os.getenv("FN_TEAMSTATUS_ARN")
fn_teamnotifications_arn = os.getenv("FN_TEAMNOTIFICATIONS_ARN")
team_config = {
    "sso_login_url": sso_login_url,
    "requests_table": requests_table_name,
    "revoke_sm": revoke,
    "grant_sm": grant,
    "fn_teamstatus_arn": fn_teamstatus_arn,
    "fn_teamnotifications_arn": fn_teamnotifications_arn,
}


def batch_get_with_backoff(table_name, keys, batch_size=100, max_no_progress=10, max_time_per_batch=30):
    """
    Perform DynamoDB batch_get_item with exponential backoff for UnprocessedKeys.

    Fails if no progress made after max_no_progress retries or max_time_per_batch seconds.

    Args:
        table_name: Name of the DynamoDB table
        keys: List of key dictionaries (e.g., [{'id': 'key1'}, {'id': 'key2'}])
        batch_size: Maximum items per batch (default 100, DynamoDB limit)
        max_no_progress: Max retries without progress before failing (default 10)
        max_time_per_batch: Max seconds per batch before failing (default 30)

    Returns:
        List of all retrieved items

    Raises:
        Exception: If unable to fetch all items due to persistent throttling
    """
    if not keys:
        return []

    all_items = []

    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i + batch_size]
        request_items = {table_name: {'Keys': batch_keys}}
        no_progress_count = 0
        batch_start = time.time()

        while request_items:
            response = dynamodb.batch_get_item(RequestItems=request_items)
            items = response.get('Responses', {}).get(table_name, [])
            all_items.extend(items)
            request_items = response.get('UnprocessedKeys', {})

            if request_items:
                if items:
                    no_progress_count = 0
                else:
                    no_progress_count += 1

                elapsed = time.time() - batch_start
                if no_progress_count >= max_no_progress or elapsed >= max_time_per_batch:
                    raise Exception(f"DynamoDB throttling: unable to fetch all items after {elapsed:.1f}s")

                time.sleep(min(0.05 * (2 ** no_progress_count), 2))

    return all_items


def list_account_for_ou(ouId):
    account = []
    client = boto3.client('organizations')
    try:
        p = client.get_paginator('list_accounts_for_parent')
        paginator = p.paginate(ParentId=ouId,)

        for page in paginator:
            for acct in page['Accounts']:
                account.extend([{"name": acct['Name'], 'id':acct['Id']}])
        return account
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_entitlements(id):
    response = policy_table.get_item(
        Key={
            'id': id
        }
    )
    return response


def get_settings():
    response = settings_table.get_item(
        Key={
            'id': 'settings'
        }
    )
    return response

def getEntitlements(userId, groupIds):
    eligibility = []
    maxDuration = 0
    for id in [userId] + groupIds:
        if not id:
            continue
        entitlement = get_entitlements(id)
        if "Item" not in entitlement.keys():
            continue
        duration = entitlement['Item']['duration']
        if int(duration) > maxDuration:
            maxDuration = int(duration)
        policy = {}
        policy['accounts'] = entitlement['Item']['accounts']
        
        for ou in entitlement["Item"]["ous"]:
            data = list_account_for_ou(ou["id"])
            policy['accounts'].extend(data)
            
        policy['permissions'] = entitlement['Item']['permissions']
        policy['approvalRequired'] = entitlement['Item']['approvalRequired']
        policy['duration'] = str(maxDuration)
        policy['policyIds'] = entitlement['Item'].get("policyIds", [])
        
        eligibility.append(policy)

    return eligibility

def list_idc_group_membership(userId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_group_memberships_for_member')
        paginator = p.paginate(IdentityStoreId=sso_instance['IdentityStoreId'],
            MemberId={
                'UserId': userId
            })
        all_idc_groups = []
        for page in paginator:
            all_idc_groups.extend(page["GroupMemberships"])
        return all_idc_groups
    except ClientError as e:
        print(e.response['Error']['Message'])
        return []

def updateRequest(input):
    session = boto3.session.Session()
    credentials = session.get_credentials()
    credentials = credentials.get_frozen_credentials()
    region = session.region_name

    input = input
    query = """
        mutation UpdateRequests(
            $input: UpdateRequestsInput!
            $condition: ModelRequestsConditionInput
        ) {
            updateRequests(input: $input, condition: $condition) {
            id
            email
            accountId
            accountName
            role
            roleId
            startTime
            duration
            justification
            status
            comment
            username
            approver
            approverId
            approvers
            approver_ids
            revoker
            revokerId
            endTime
            ticketNo
            revokeComment
            createdAt
            updatedAt
            owner
            }
        }
    """

    endpoint = os.environ.get('API_TEAM_GRAPHQLAPIENDPOINTOUTPUT', None)
    headers = {"Content-Type": "application/json"}
    payload = {"query": query, 'variables': {'input': input}}

    appsync_region = region
    auth = AWSV4Sign(credentials, appsync_region, 'appsync')

    try:
        response = requests.post(
            endpoint,
            auth=auth,
            json=payload,
            headers=headers
        ).json()
        if 'errors' in response:
            print('Error attempting to query AppSync')
            print(response['errors'])
        else:
            print(response)
            return response
    except Exception as exception:
        print('Error with Query')
        print(exception)

    return None


def list_existing_sso_instances():
    client = boto3.client('sso-admin')
    try:
        response = client.list_instances()
        return response['Instances'][0]
    except ClientError as e:
        print(e.response['Error']['Message'])


def get_user(username):
    try:
        client = boto3.client('identitystore')
        response = client.get_user_id(
            IdentityStoreId=sso_instance['IdentityStoreId'],
            AlternateIdentifier={
                'UniqueAttribute': {
                    'AttributePath': 'userName',
                    'AttributeValue': username
                },
            }
        )
        if response['UserId']:
            return response['UserId']
        else:
            return
    except ClientError as e:
        print(e.response['Error']['Message'])


def invoke_approval_sm(request, sm_arn, notification_config, team_config):
    sfn_client = boto3.client('stepfunctions')
    try:
        response = sfn_client.start_execution(
            stateMachineArn=sm_arn,
            name=request["id"],
            input=(json.dumps({**request, **notification_config, **team_config})))
    except ClientError as e:
        print(e.response['Error']['Message'])
    else:
        sfn_arn = response.get('executionArn')
        return sfn_arn


sso_instance = list_existing_sso_instances()


def get_request_data(data, expire, approval_required):
    request = {
        "email": data.get("email", {}).get("S"),
        "username": data["username"]["S"],
        "duration": str(int(data["duration"]["S"]) * 60 * 60),
        "accountId": data["accountId"]["S"],
        "status": data["status"]["S"],
        "accountName": data["accountName"]["S"],
        "id": data["id"]["S"],
        "role": data["role"]["S"],
        "roleId": data["roleId"]["S"],
        "time": data["duration"]["S"],
        "startTime": data["startTime"]["S"],
        "justification": data["justification"]["S"],
        "ticketNo": data.get("ticketNo", {}).get("S"),
        "approver": data.get("approver", {}).get("S"),
        "revoker": data.get("revoker", {}).get("S"),
        "instanceARN": sso_instance['InstanceArn'],
        "approvers": [approver["S"] for approver in data.get("approvers", {}).get("L",[]) if approver["S"] != data.get("email", {}).get("S")],
        "expire": expire,
        "approvalRequired": approval_required
    }
    policy_id = data.get("policyId", {}).get("S")
    if policy_id:
        request["policyId"] = data["policyId"]["S"]
    return request

def eligibility_error(request):
    print("Error - Invalid Eligibility")
    input = {
            'id': request["id"],
            'status': 'error'
            }
    updateRequest(input)

def get_eligibility_policy(policy_id):
    try:
        response = policies_table.get_item(
            Key={
                'id': policy_id
            }
        )
    except ClientError as e:
        print(e.response['Error']['Message'])
        return {}
    else:
        return response.get("Item", {})
    
def get_eligibility(request, userId, policy_id_data):
    eligible = False
    # Initially assume approval is required
    approvalRequired = True
    groupIds = [group['GroupId'] for group in list_idc_group_membership(userId)]
    entitlement = getEntitlements(userId=userId, groupIds=groupIds)
    print(entitlement)
    max_duration_error = True
    # For policy-based requests, verify the policy is assigned to at least one of the user's eligibility groups
    if policy_id_data:
        if not any(policy_id_data["id"] in eligibility["policyIds"] for eligibility in entitlement):
            return eligibility_error(request)
        # Resolve OUs to accounts for policy
        policy_accounts = list(policy_id_data.get("accounts", []))
        for ou in policy_id_data.get("ous", []):
            ou_accounts = list_account_for_ou(ou["id"])
            if ou_accounts:
                policy_accounts.extend(ou_accounts)
        policy_id_data["accounts"] = policy_accounts
        # User is eligible for this policy; use policy data for validation instead of full entitlements
        entitlement = [policy_id_data]

    for eligibility in entitlement:
        if int(request["time"]) <= int(eligibility["duration"]):
            max_duration_error = False
        for account in eligibility["accounts"]:
            if request["accountId"] ==  account["id"]:
                for permission in eligibility["permissions"]:
                    if request["roleId"] == permission["id"]:
                        eligible = True
                        # Only need a single eligibility to not require approval to
                        # bypass approval for this request.
                        if not eligibility["approvalRequired"]:
                            approvalRequired = False

    if max_duration_error:
        print("Error - Invalid Duration")
        return eligibility_error(request) 
    if eligible:
        return {"approval": approvalRequired}
    else:
        return eligibility_error(request)          

def check_settings():
    settings = get_settings()
    item_settings = settings.get("Item", {})
    approval_required = item_settings.get("approval", True)
    expiry = int(item_settings.get("expiry", 3)) * 60 * 60
    max_duration = item_settings.get("duration", "9")
    ses_notifications_enabled = item_settings.get("sesNotificationsEnabled", False)
    sns_notifications_enabled = item_settings.get("snsNotificationsEnabled", False)
    slack_notifications_enabled = item_settings.get("slackNotificationsEnabled", False)
    ses_source_email = item_settings.get("sesSourceEmail", "")
    ses_source_arn = item_settings.get("sesSourceArn", "")
    notification_config = {
        "ses_notifications_enabled": ses_notifications_enabled,
        "sns_notifications_enabled": sns_notifications_enabled,
        "slack_notifications_enabled": slack_notifications_enabled,
        "ses_source_email": ses_source_email,
        "ses_source_arn": ses_source_arn,
        "notification_topic_arn": notification_topic_arn,
    }
    return {
        "approval_required": approval_required, 
        "expiry": expiry, 
        "max_duration": max_duration,
        "notification_config": notification_config,
    }

        
def invoke_workflow(request, approval_required, notification_config, team_config):
    workflow = None
    if approval_required and request["status"] == "pending":
        print("sending approval")
        workflow = approval
    elif approval_required and request["status"] == "approved" and request["email"] != request["approver"]:
        print("scheduling session")
        workflow = schedule
    elif approval_required and request["status"] == "rejected" and request["email"] != request["approver"]:
        print("rejecting request")
        workflow = reject
    elif request["status"] == "revoked":
        print("revoking session")
        workflow = revoke
    elif request["status"] == "pending" and not approval_required:
        print("scheduling session - approval not required")
        workflow = schedule
    elif request["status"] == "cancelled":
        print("cancelling request")
        workflow = reject
    elif approval_required and request["status"] in ["approved","rejected"] and request["email"] == request["approver"]:
        print("Error: Invalid Approver")
        input = {
                'id': request["id"],
                'status': 'error'
                }
        updateRequest(input)
    else:
        print("no action")
    if workflow:
        invoke_approval_sm(request, workflow, notification_config, team_config)

def get_email(username):
    cognito = boto3.client('cognito-idp', config=Config(user_agent_extra="team-idc"))
    next_page = None
    kwargs = {
        'UserPoolId': user_pool_id,
        "Filter": f"username = \"{username}\"",
        "AttributesToGet": [
            "email"
        ],
    }
    users_remain = True
    while(users_remain):
        if next_page:
            kwargs['PaginationToken'] = next_page
        response = cognito.list_users(**kwargs)
        next_page = response.get('PaginationToken', None)
        users_remain = next_page is not None

    email_id = response['Users'][0]['Attributes'][0]['Value']
    return email_id

def get_ou(id):
    client = boto3.client('organizations')
    try:
        response = client.list_parents(
            ChildId=id
        )
        return response["Parents"][0]
    except ClientError as e:
        print(e.response['Error']['Message'])

async def getPsDuration(ps):
    client = boto3.client('sso-admin')
    response = client.describe_permission_set(
    InstanceArn=sso_instance['InstanceArn'],
    PermissionSetArn=ps
    )
    return response['PermissionSet']['SessionDuration']

def list_approvers(ids):
    try:
        if isinstance(ids, list):
            approver_keys = [{"id": approver_id} for approver_id in ids]
            all_items = batch_get_with_backoff(approver_table_name, approver_keys)
            return list(set(group_id for item in all_items for group_id in item.get("groupIds", [])))
        else:
            response = approver_table.get_item(
                Key={
                    'id': ids
                }
            )
            return response.get("Item", {}).get("groupIds", [])
    except ClientError as e:
        print(e.response['Error']['Message'])
        return []
        
def get_approver_group_ids(account_id, approver_group_ids):
    approvers = []
    if approver_group_ids:
        return list_approvers(approver_group_ids)
    approvers.extend(list_approvers(account_id))
    ou = get_ou(account_id)
    if ou:
        approvers.extend(list_approvers(ou["Id"]))
    return approvers

def get_approvers(userId):
    client = boto3.client('identitystore')
    response = client.describe_user(
        IdentityStoreId=sso_instance['IdentityStoreId'],
        UserId=userId
    )
    approver_id = "idc_" + response['UserName']
    for email in response['Emails']:
        if email:
            approver = email["Value"]
            break
    return {"approver_id": approver_id, "approver": approver}

def list_group_membership(groupId):
    try:
        client = boto3.client('identitystore')
        p = client.get_paginator('list_group_memberships')
        paginator = p.paginate(IdentityStoreId=sso_instance['IdentityStoreId'],
        GroupId=groupId,
        )
        all_groups = []
        for page in paginator:
            all_groups.extend(page["GroupMemberships"])
        return all_groups
    except ClientError as e:
        print(e.response['Error']['Message'])
        
async def get_approvers_details(account_id, approver_group_ids):
    approver_groups = get_approver_group_ids(account_id, approver_group_ids)
    approvers = []
    approver_ids = []
    if approver_groups:
        for group in approver_groups:
            approvers_data = [get_approvers(result["MemberId"]["UserId"])
                for result in list_group_membership(group)]
            for data in approvers_data:
                if data["approver"] not in approvers:
                    approvers.append(data["approver"])
                    approver_ids.append(data["approver_id"].lower())
    return {"approvers":approvers, "approver_ids":approver_ids}

async def updateRequestDetails(request_id, username, accountId, roleId, policy_based):
    email = get_email(username)
    approver_details = await get_approvers_details(accountId, policy_based.get("approverGroupIds", None))
    approver_ids = approver_details["approver_ids"]
    approvers = approver_details["approvers"]
    session_duration = policy_based.get("duration") or await getPsDuration(roleId)
    
    input = {
        'id': request_id,
        'email': email,
        'approvers': approvers,
        'approver_ids': approver_ids,
        'session_duration': session_duration        
    }
    
    updateRequest(input)

def updateApproverDetails(request_id,username):
    approver = get_email(username)
    input = {
            'id': request_id,
            'approver': approver
            }
    updateRequest(input)

def updateRevokerDetails(request_id,username):
    revoker = get_email(username)
    input = {
            'id': request_id,
            'revoker': revoker
            }
    updateRequest(input)

def request_is_updated(status,data,username,request_id,policy_id_data):
    updated = False
    policy_based = {}
    if policy_id_data:
        policy_based["approverGroupIds"] = [approver_group_id["id"] for approver_group_id in policy_id_data["approverGroupIds"]]
        policy_based["duration"] = policy_id_data["duration"]
    if status in ["error", "ended"]:
        return updated
    elif status == "pending" and "email" not in data.keys():
        asyncio.run(updateRequestDetails(request_id, username, data["accountId"]["S"], data["roleId"]["S"], policy_based))
        print("updating request details")
    elif status in ["approved","rejected"] and "approver" not in data.keys():
        updateApproverDetails(request_id,data["approverId"]["S"])
    elif status == "revoked" and "revoker" not in data.keys():
        updateRevokerDetails(request_id,data["revokerId"]["S"])
    else:
        updated = True
    return updated

def handler(event, context):
    data = event["Records"].pop()["dynamodb"]["NewImage"]
    print("Checking if request is updated")
    status = data["status"]["S"]
    username = data["username"]["S"]
    request_id = data["id"]["S"]
    policy_id_data = {}
    if "policyId" in data.keys():
        policy_id_data = get_eligibility_policy(data["policyId"]["S"])
    if request_is_updated(status,data,username,request_id,policy_id_data):
        settings = check_settings()
        approval_required = settings["approval_required"]
        notification_config = settings["notification_config"]
        expiry_time = settings["expiry"]
        request = get_request_data(data, expiry_time, approval_required)
        if int(request["time"]) > int(settings["max_duration"]):
            print("Error: Invalid Duration")
            input = {
                    'id': request["id"],
                    'status': 'error'
                    }
            return updateRequest(input)
        print("Received event: %s" % json.dumps(request))
        userId = get_user((data["username"]["S"])[4:])
        request["userId"] = userId
        eligible = get_eligibility(request, userId, policy_id_data)
        if eligible:
            if approval_required:
                approval_required = eligible["approval"]
                request["approvalRequired"] = eligible["approval"]
            invoke_workflow(request, approval_required, notification_config, team_config)
    else:
        print("Request not updated")
        
