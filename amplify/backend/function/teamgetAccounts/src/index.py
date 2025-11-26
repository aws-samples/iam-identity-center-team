# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import json
import boto3
import os
import time
import threading
from botocore.exceptions import ClientError
from operator import itemgetter

client = boto3.client('organizations')
dynamodb = boto3.resource('dynamodb')

ACCOUNT_ID = os.environ['ACCOUNT_ID']
CACHE_TABLE_NAME = os.environ.get('ACCOUNTS_CACHE_TABLE_NAME', 'team-accounts-cache')
CACHE_TTL_SECONDS = int(os.environ.get('ACCOUNTS_CACHE_TTL', '300'))  # Default 5 minutes


def get_mgmt_account_id():
    org_client = boto3.client('organizations')
    try:
        response = org_client.describe_organization()
        return response['Organization']['MasterAccountId']
    except ClientError as e:
        print(e.response['Error']['Message'])


mgmt_account_id = get_mgmt_account_id()


def get_cached_accounts():
    """Retrieve accounts from DynamoDB cache if available.
    
    Returns:
        tuple: (accounts_data, is_expired) or (None, False) if no cache exists
    """
    try:
        cache_table = dynamodb.Table(CACHE_TABLE_NAME)
        response = cache_table.get_item(
            Key={'cache_key': 'accounts'}
        )
        
        if 'Item' in response:
            item = response['Item']
            current_time = int(time.time())
            ttl = item.get('ttl', 0)
            accounts_data = json.loads(item['accounts_data'])
            is_expired = ttl <= current_time
            
            # Always return cache if it exists (even if expired)
            # We'll update it in the background if expired
            return (accounts_data, is_expired)
        
        return (None, False)
    except ClientError as e:
        # Table might not exist yet, continue without cache
        print(f"Cache read error (table may not exist): {e.response.get('Error', {}).get('Message', 'Unknown error')}")
        return (None, False)
    except Exception as e:
        print(f"Unexpected cache error: {e}")
        return (None, False)


def set_cached_accounts(accounts_data):
    """Store accounts in DynamoDB cache with TTL."""
    try:
        cache_table = dynamodb.Table(CACHE_TABLE_NAME)
        ttl = int(time.time()) + CACHE_TTL_SECONDS
        
        cache_table.put_item(
            Item={
                'cache_key': 'accounts',
                'accounts_data': json.dumps(accounts_data),
                'ttl': ttl
            }
        )
    except ClientError as e:
        # Table might not exist yet, continue without cache
        print(f"Cache write error (table may not exist): {e.response.get('Error', {}).get('Message', 'Unknown error')}")
    except Exception as e:
        print(f"Unexpected cache write error: {e}")


def fetch_accounts_from_organizations():
    """Fetch accounts from AWS Organizations API."""
    account = []
    deployed_in_mgmt = True if ACCOUNT_ID == mgmt_account_id else False
    
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


def update_cache_background():
    """Update cache in background thread."""
    try:
        print("Background: Fetching fresh accounts from Organizations API")
        accounts = fetch_accounts_from_organizations()
        set_cached_accounts(accounts)
        print("Background: Cache updated successfully")
    except Exception as e:
        print(f"Background: Cache update failed (non-critical): {e}")


def handler(event, context):
    try:
        # Try to get from cache first
        cached_accounts, is_expired = get_cached_accounts()
        
        if cached_accounts is not None:
            # We have cache (valid or expired)
            if is_expired:
                print("Returning expired cache, starting background update")
                # Return expired cache immediately for fast response
                # Start background update thread (won't block the response)
                update_thread = threading.Thread(target=update_cache_background, daemon=True)
                update_thread.start()
            else:
                print("Returning valid cached accounts")
            
            return cached_accounts
        
        # No cache exists, fetch from Organizations
        print("No cache found, fetching accounts from Organizations API")
        accounts = fetch_accounts_from_organizations()
        
        # Store in cache
        set_cached_accounts(accounts)
        
        return accounts
    except ClientError as e:
        print(f"Error fetching accounts: {e.response['Error']['Message']}")
        # Try to return expired cache as fallback
        cached_accounts, _ = get_cached_accounts()
        if cached_accounts is not None:
            print("Returning expired cache due to error")
            return cached_accounts
        raise
