# OU Accounts Cache utility module
# Shared between teamgetEntitlement, teamListPoliciesWithAccounts, teamgetOUAccounts

import json
import time
from decimal import Decimal
from botocore.exceptions import ClientError


class OUCache:
    """Cache for OU to accounts mapping"""

    def __init__(self, dynamodb_resource, table_name, ttl, account_id, org_client):
        self.dynamodb = dynamodb_resource
        self.table = dynamodb_resource.Table(table_name) if table_name else None
        self.ttl = ttl
        self.account_id = account_id
        self.org_client = org_client
        self._mgmt_account_id = None

    @property
    def mgmt_account_id(self):
        """Lazy load management account ID"""
        if self._mgmt_account_id is None:
            try:
                response = self.org_client.describe_organization()
                self._mgmt_account_id = response["Organization"]["MasterAccountId"]
            except ClientError as e:
                print(f"Error getting management account ID: {e}")
                self._mgmt_account_id = ""
        return self._mgmt_account_id

    def get_cached_accounts(self, ou_id):
        """Get cached accounts for an OU from DynamoDB"""
        if not self.table:
            return None
        try:
            response = self.table.get_item(Key={"ou_id": ou_id})
            if "Item" in response:
                item = response["Item"]
                if item.get("status") == "ready":
                    accounts_data = item.get("accounts")
                    if isinstance(accounts_data, str):
                        return json.loads(accounts_data)
                    return accounts_data if accounts_data else []
            return None
        except ClientError as e:
            print(f"Error reading cache: {e}")
            return None

    def list_accounts_for_ou(self, ou_id):
        """List accounts for an OU from Organizations API"""
        deployed_in_mgmt = self.account_id == self.mgmt_account_id
        accounts = []

        try:
            paginator = self.org_client.get_paginator("list_accounts_for_parent")
            for page in paginator.paginate(ParentId=ou_id):
                for acct in page["Accounts"]:
                    if not deployed_in_mgmt and acct["Id"] == self.mgmt_account_id:
                        continue
                    accounts.append({"name": acct["Name"], "id": acct["Id"]})
            return accounts
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ["ParentNotFoundException", "OrganizationalUnitNotFoundException", "TargetNotFoundException"]:
                print(f"OU {ou_id} not found (deleted or moved)")
            else:
                print(f"Error listing accounts for OU {ou_id}: {e}")
            return []

    def populate_cache(self, ou_id):
        """Populate cache for an OU"""
        if not self.table:
            return self.list_accounts_for_ou(ou_id)

        current_time = int(time.time())
        ttl = current_time + self.ttl

        try:
            self.table.update_item(
                Key={"ou_id": ou_id},
                UpdateExpression="SET #status = :populating, cached_at = :time",
                ConditionExpression="attribute_not_exists(ou_id) OR #status <> :populating",
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={
                    ":populating": "populating",
                    ":time": Decimal(str(current_time))
                },
                ReturnValues="ALL_NEW"
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                time.sleep(0.5)
                cached = self.get_cached_accounts(ou_id)
                return cached if cached is not None else []
            raise

        try:
            accounts = self.list_accounts_for_ou(ou_id)
            self.table.put_item(
                Item={
                    "ou_id": ou_id,
                    "accounts": json.dumps(accounts),
                    "cached_at": Decimal(str(current_time)),
                    "ttl": Decimal(str(ttl)),
                    "status": "ready"
                }
            )
            return accounts
        except Exception as e:
            print(f"Error populating cache for OU {ou_id}: {e}")
            try:
                self.table.delete_item(Key={"ou_id": ou_id})
            except Exception as cleanup_error:
                print(f"Error cleaning up stuck cache: {cleanup_error}")
            return []

    def get_accounts(self, ou_id):
        """Get accounts for an OU, using cache if available"""
        cached = self.get_cached_accounts(ou_id)
        if cached is not None:
            print(f"OU {ou_id}: {len(cached)} accounts (cached)")
            return cached
        accounts = self.populate_cache(ou_id)
        print(f"OU {ou_id}: {len(accounts)} accounts (fetched)")
        return accounts

    def invalidate(self, ou_id):
        """Invalidate cache for an OU"""
        if not self.table:
            return False
        try:
            self.table.delete_item(Key={"ou_id": ou_id})
            return True
        except ClientError as e:
            print(f"Error invalidating cache for OU {ou_id}: {e}")
            return False
