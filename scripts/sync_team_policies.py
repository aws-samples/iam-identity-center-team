#!/usr/bin/env python3
"""
Reads eligibility.yaml and approvers.yaml, resolves IDC group IDs and permission set ARNs,
then upserts the resulting policies into TEAM's DynamoDB tables.

For approver policies, explicit entries in approvers.yaml are written first.
If GITHUB_TOKEN is set, OU auto-detection runs on top (reads admin_team_name org tags
+ team-resource-mapping.yaml to set per-OU approvers for production rollout).

Env vars required: ELIGIBILITY_TABLE, APPROVER_TABLE, IDENTITY_STORE_ID
Optional: AWS_REGION, FALLBACK_GROUP_NAME, DRY_RUN, GITHUB_TOKEN, PRODUCTION_OU_IDS

Run with credentials for the account that owns the TEAM DynamoDB tables and can read
Organizations / Identity Store / SSO Admin. GITHUB_TOKEN must have read access to
flexera/team-resource-mapping (Contents: read).

    pip install -r scripts/requirements.txt
    DRY_RUN=true ELIGIBILITY_TABLE=Eligibility-<apiId>-<env> APPROVER_TABLE=Approvers-<apiId>-<env> \
      IDENTITY_STORE_ID=d-xxxxxxxxxx GITHUB_TOKEN=... python scripts/sync_team_policies.py
"""

import json
import os
import sys
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import boto3
import requests
import yaml
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REGION = os.environ.get("AWS_REGION", "us-east-1")
ELIGIBILITY_TABLE = os.environ["ELIGIBILITY_TABLE"]
APPROVER_TABLE = os.environ["APPROVER_TABLE"]
IDENTITY_STORE_ID = os.environ["IDENTITY_STORE_ID"]
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")  # optional — only needed for OU auto-detection
FALLBACK_GROUP_NAME = os.environ.get("FALLBACK_GROUP_NAME", "SGU-CM-TeamCloudEnablement")
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"

PRODUCTION_OU_ID = os.environ.get("PRODUCTION_OU_ID", "ou-c0au-rb7od08q")  # legacy single-OU var
# PRODUCTION_OU_IDS takes precedence when set — comma-separated list of OU IDs to process.
# Add zone OUs here when owner-based routing needs to expand beyond the production OU.
PRODUCTION_OU_IDS: list[str] = [
    ou.strip()
    for ou in os.environ.get("PRODUCTION_OU_IDS", PRODUCTION_OU_ID).split(",")
    if ou.strip()
]
TEAM_RESOURCE_MAPPING_URL = (
    "https://raw.githubusercontent.com/flexera/team-resource-mapping/master/team-resource-mapping.yaml"
)
APPROVERS_YAML_PATH = os.path.join(os.path.dirname(__file__), "..", "approvers.yaml")
ELIGIBILITY_YAML_PATH = os.path.join(os.path.dirname(__file__), "..", "eligibility.yaml")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# AWS clients
# ---------------------------------------------------------------------------

dynamodb = boto3.resource("dynamodb", region_name=REGION)
organizations = boto3.client("organizations", region_name=REGION)
identitystore = boto3.client("identitystore", region_name=REGION)

eligibility_table = dynamodb.Table(ELIGIBILITY_TABLE)
approver_table = dynamodb.Table(APPROVER_TABLE)


def load_approvers_yaml() -> list:
    with open(APPROVERS_YAML_PATH) as f:
        data = yaml.safe_load(f)
    return data.get("approver_mappings", [])


def sync_explicit_approver_policies() -> dict:
    # Writes approver entries from approvers.yaml directly — no tag lookup or team-resource-mapping.
    # Supports both ou_id and account_id. Safe to re-run (put_item is an upsert).
    entries = load_approvers_yaml()
    log.info("Found %d explicit approver entries in approvers.yaml", len(entries))

    idc_group_cache: dict = {}
    written = 0
    skipped = 0

    for entry in entries:
        entity_id = entry.get("ou_id") or entry.get("account_id")
        entity_type = "OU" if "ou_id" in entry else "Account"

        if not entity_id:
            log.warning("Approver entry has no ou_id or account_id — skipping")
            skipped += 1
            continue

        group_names = entry.get("approvers", [])
        if not group_names:
            log.warning("Approver entry for %s has no approvers — skipping", entity_id)
            skipped += 1
            continue

        group_ids = []
        for g in group_names:
            if g not in idc_group_cache:
                idc_group_cache[g] = get_idc_group_id(g)
            gid = idc_group_cache[g]
            if gid:
                group_ids.append(gid)
            else:
                log.warning("IDC group not found: %s — skipping entry for %s", g, entity_id)

        if not group_ids:
            skipped += 1
            continue

        # Resolve name for display
        if entity_type == "OU":
            name = get_ou_name(entity_id)
        else:
            name = get_account_name(entity_id)

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        item = {
            "id": entity_id,
            "name": name,
            "type": entity_type,
            "approvers": group_names,
            "groupIds": group_ids,
            "ticketNo": "true",
            "modifiedBy": "sync-team-policies",
            "createdAt": now,
            "updatedAt": now,
        }

        if DRY_RUN:
            log.info("[DRY RUN] Would write explicit approver policy: %s", json.dumps(item))
        else:
            approver_table.put_item(Item=item)
            log.info("Wrote explicit approver policy: %s=%s group=%s", entity_type, name, group_names)
        written += 1

    return {"explicit_approver_policies_written": written, "explicit_skipped": skipped}


# ---------------------------------------------------------------------------
# team-resource-mapping helpers
# ---------------------------------------------------------------------------


def fetch_team_resource_mapping() -> dict:
    # Private repo — needs a GitHub token with read access to flexera/team-resource-mapping.
    headers = {"Authorization": f"token {GITHUB_TOKEN}"}
    response = requests.get(TEAM_RESOURCE_MAPPING_URL, headers=headers, timeout=30)
    response.raise_for_status()
    raw = yaml.safe_load(response.text)
    return {team["id"]: team for team in raw}


def get_idc_group_id(group_name: str) -> Optional[str]:
    # Looks up by DisplayName — returns None if the group doesn't exist in IDC.
    try:
        response = identitystore.get_group_id(
            IdentityStoreId=IDENTITY_STORE_ID,
            AlternateIdentifier={
                "UniqueAttribute": {
                    "AttributePath": "DisplayName",
                    "AttributeValue": group_name,
                }
            },
        )
        return response["GroupId"]
    except identitystore.exceptions.ResourceNotFoundException:
        log.warning("IDC group not found: %s", group_name)
        return None
    except ClientError as e:
        log.error("Error looking up IDC group %s: %s", group_name, e)
        return None


def get_idc_user_id(email: str) -> Optional[str]:
    # Looks up by email — returns None if no user has that email in IDC.
    try:
        response = identitystore.get_user_id(
            IdentityStoreId=IDENTITY_STORE_ID,
            AlternateIdentifier={
                "UniqueAttribute": {
                    "AttributePath": "emails.value",
                    "AttributeValue": email,
                }
            },
        )
        return response["UserId"]
    except identitystore.exceptions.ResourceNotFoundException:
        log.warning("IDC user not found for email: %s", email)
        return None
    except ClientError as e:
        log.error("Error looking up IDC user %s: %s", email, e)
        return None


# ---------------------------------------------------------------------------
# AWS Organizations helpers
# ---------------------------------------------------------------------------


def list_accounts_in_ou_recursive(ou_id: str) -> list:
    """Recursively return all ACTIVE accounts under an OU."""
    accounts = []
    acct_paginator = organizations.get_paginator("list_accounts_for_parent")
    for page in acct_paginator.paginate(ParentId=ou_id):
        for acct in page["Accounts"]:
            if acct["Status"] == "ACTIVE":
                accounts.append(acct)
    ou_paginator = organizations.get_paginator("list_organizational_units_for_parent")
    for page in ou_paginator.paginate(ParentId=ou_id):
        for child_ou in page["OrganizationalUnits"]:
            accounts.extend(list_accounts_in_ou_recursive(child_ou["Id"]))
    return accounts


def get_account_tags(account_id: str) -> dict:
    """Return tags for an AWS account as a plain dict."""
    try:
        response = organizations.list_tags_for_resource(ResourceId=account_id)
        return {tag["Key"]: tag["Value"] for tag in response["Tags"]}
    except ClientError as e:
        log.warning("Could not get tags for account %s: %s", account_id, e)
        return {}


# ---------------------------------------------------------------------------
# Approver policy sync
# ---------------------------------------------------------------------------


def sync_approver_policies(team_mapping: dict) -> dict:
    # One DynamoDB item per active production account — approver is derived from
    # each account's admin_team_name tag looked up in team-resource-mapping.yaml.
    # Iterates over all OUs in PRODUCTION_OU_IDS (defaults to the single production OU).
    seen_ids: set = set()
    accounts = []
    for ou_id in PRODUCTION_OU_IDS:
        for acct in list_accounts_in_ou_recursive(ou_id):
            if acct["Id"] not in seen_ids:
                seen_ids.add(acct["Id"])
                accounts.append(acct)
    log.info(
        "Found %d active production accounts across %d OU(s): %s",
        len(accounts), len(PRODUCTION_OU_IDS), ", ".join(PRODUCTION_OU_IDS),
    )

    idc_group_cache: dict = {}
    idc_user_cache: dict = {}
    written = 0
    skipped = 0

    for account in accounts:
        account_id = account["Id"]
        account_name = account["Name"]

        tags = get_account_tags(account_id)
        # Tag priority: admin_team_name → team_name → CE fallback
        team_name = tags.get("admin_team_name")
        tag_used = "admin_team_name"
        if not team_name:
            team_name = tags.get("team_name")
            tag_used = "team_name"

        group_name = FALLBACK_GROUP_NAME
        admins: list = []
        if team_name and team_name in team_mapping:
            team = team_mapping[team_name]
            gn = team.get("governance_group_name")
            if gn:
                group_name = gn
                # Approval enforcement stays on the group (IDC only supports GroupId-based
                # membership checks) — display shows just the team lead + manager, not the whole group.
                admins = [a for a in (team.get("team_lead"), team.get("team_manager")) if a]
                log.info("Account %s (%s): %s=%s → group=%s admins=%s", account_name, account_id, tag_used, team_name, group_name, admins)
            else:
                log.warning("Account %s (%s): team %s has no governance_group_name — using CE fallback", account_name, account_id, team_name)
        elif team_name:
            log.warning("Account %s (%s): team %s not in team-resource-mapping — using CE fallback", account_name, account_id, team_name)
        else:
            log.warning("Account %s (%s): no admin_team_name or team_name tag — using CE fallback", account_name, account_id)

        if group_name not in idc_group_cache:
            idc_group_cache[group_name] = get_idc_group_id(group_name)
        group_id = idc_group_cache[group_name]

        if not group_id:
            log.error("Account %s (%s): IDC group %s not found — skipping", account_name, account_id, group_name)
            skipped += 1
            continue

        # Display-only text (not read by any routing logic - actual enforcement always
        # uses individualApproverIds/groupIds below, which reflect the same admins).
        if admins:
            lines = [f"Approvers - {', '.join(admins)}"]
        else:
            lines = ["No Manager/Lead found for the account"]

        # Real per-person enforcement: resolve each admin email to an IDC UserId. The
        # teamRouter uses these directly instead of expanding the whole governance group,
        # falling back to the account-level group when none resolve.
        individual_approver_ids = []
        for email in admins:
            if email not in idc_user_cache:
                idc_user_cache[email] = get_idc_user_id(email)
            uid = idc_user_cache[email]
            if uid:
                individual_approver_ids.append(uid)
            else:
                log.warning("Account %s (%s): IDC user not found for admin email %s", account_name, account_id, email)

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        item = {
            "id": account_id,
            "name": account_name,
            "type": "Account",
            "approvers": lines,
            "groupIds": [group_id],
            "individualApproverIds": individual_approver_ids,
            "ticketNo": "true",
            "modifiedBy": "sync-team-policies",
            "createdAt": now,
            "updatedAt": now,
        }

        if DRY_RUN:
            log.info("[DRY RUN] Would write approver policy: %s", json.dumps(item))
        else:
            approver_table.put_item(Item=item)
            log.info("Wrote approver policy: Account=%s group=%s", account_name, group_name)
        written += 1

    return {"accounts_processed": len(accounts), "approver_policies_written": written, "skipped": skipped}


# ---------------------------------------------------------------------------
# Eligibility policy sync
# ---------------------------------------------------------------------------


def load_eligibility_yaml() -> list:
    with open(ELIGIBILITY_YAML_PATH) as f:
        data = yaml.safe_load(f)
    return data.get("eligibilities", [])


def get_permission_set_arn(permission_set_name: str) -> Optional[str]:
    # Lists all permission sets and matches by name — no direct lookup API exists.
    sso = boto3.client("sso-admin", region_name=REGION)
    instances = sso.list_instances()["Instances"]
    if not instances:
        log.error("No IAM Identity Center instances found")
        return None
    instance_arn = instances[0]["InstanceArn"]

    paginator = sso.get_paginator("list_permission_sets")
    for page in paginator.paginate(InstanceArn=instance_arn):
        for ps_arn in page["PermissionSets"]:
            desc = sso.describe_permission_set(InstanceArn=instance_arn, PermissionSetArn=ps_arn)
            if desc["PermissionSet"]["Name"] == permission_set_name:
                return ps_arn
    log.warning("Permission set not found: %s", permission_set_name)
    return None


def get_ou_name(ou_id: str) -> str:
    if ou_id.startswith("r-"):
        return "Root"
    try:
        response = organizations.describe_organizational_unit(OrganizationalUnitId=ou_id)
        return response["OrganizationalUnit"]["Name"]
    except ClientError:
        return ou_id


def get_account_name(account_id: str) -> str:
    try:
        response = organizations.describe_account(AccountId=account_id)
        return response["Account"]["Name"]
    except ClientError:
        return account_id


def sync_eligibility_policies() -> dict:
    entries = load_eligibility_yaml()
    log.info("Found %d eligibility entries in eligibility.yaml", len(entries))

    permission_set_cache: dict = {}
    idc_group_cache: dict = {}
    written = 0
    skipped = 0

    for entry in entries:
        group_name = None
        entity_id = None

        # Resolve the requestable groups to IDC group IDs
        requestable_by = entry.get("requestable_by", [])
        if not requestable_by:
            log.warning("Eligibility entry for %s has no requestable_by — skipping", entry.get("permission_set"))
            skipped += 1
            continue

        for group in requestable_by:
            if group not in idc_group_cache:
                idc_group_cache[group] = get_idc_group_id(group)
            if idc_group_cache[group]:
                group_name = group
                entity_id = idc_group_cache[group]
                break  # Write one eligibility item per group (loop if multiple groups needed)

        if not entity_id:
            log.warning("Could not resolve any IDC group for eligibility entry — skipping")
            skipped += 1
            continue

        # Support both permission_sets (list) and permission_set (single, backward compat)
        ps_names = entry.get("permission_sets") or [entry["permission_set"]]

        permissions = []
        for ps_name in ps_names:
            if ps_name not in permission_set_cache:
                permission_set_cache[ps_name] = get_permission_set_arn(ps_name)
            ps_arn = permission_set_cache[ps_name]
            if ps_arn:
                permissions.append({"name": ps_name, "id": ps_arn})
            else:
                log.warning("Permission set %s not found in IAM Identity Center — skipping", ps_name)

        if not permissions:
            log.warning("No valid permission sets resolved for eligibility entry — skipping")
            skipped += 1
            continue

        # Resolve accounts
        accounts = []
        if "account_id" in entry:
            account_id = entry["account_id"]
            accounts = [{"name": get_account_name(account_id), "id": account_id}]

        # Resolve OUs
        ous = []
        if "ou_ids" in entry:
            for ou_id in entry["ou_ids"]:
                ous.append({"name": get_ou_name(ou_id), "id": ou_id})

        # Parse duration from ISO 8601 (PT24H → 24)
        raw_duration = entry.get("max_duration", "PT8H")
        try:
            duration_hours = str(int(raw_duration.replace("PT", "").replace("H", "")))
        except ValueError:
            log.warning("Invalid max_duration format %r for entry %s — skipping", raw_duration, ps_names)
            skipped += 1
            continue

        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        item = {
            "id": entity_id,
            "name": group_name,
            "type": "Group",
            "accounts": accounts,
            "ous": ous,
            "permissions": permissions,
            "ticketNo": "true",
            "approvalRequired": entry.get("approval_required", True),
            "duration": duration_hours,
            "modifiedBy": "sync-team-policies",
            "createdAt": now,
            "updatedAt": now,
        }

        if DRY_RUN:
            log.info("[DRY RUN] Would write eligibility policy: %s", json.dumps(item, default=str))
        else:
            eligibility_table.put_item(Item=item)
            log.info(
                "Wrote eligibility policy: group=%s permissions=%s",
                group_name,
                [p["name"] for p in permissions],
            )
        written += 1

        # If multiple requestable groups, write a policy item for each
        for extra_group in requestable_by[1:]:
            if extra_group not in idc_group_cache:
                idc_group_cache[extra_group] = get_idc_group_id(extra_group)
            extra_id = idc_group_cache[extra_group]
            if not extra_id:
                continue
            extra_item = {**item, "id": extra_id, "name": extra_group}
            if DRY_RUN:
                log.info("[DRY RUN] Would write eligibility policy: %s", json.dumps(extra_item, default=str))
            else:
                eligibility_table.put_item(Item=extra_item)
                log.info("Wrote eligibility policy: group=%s permissions=%s", extra_group, [p["name"] for p in permissions])
            written += 1

    return {"eligibility_entries": len(entries), "eligibility_policies_written": written, "skipped": skipped}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    if DRY_RUN:
        log.info("DRY RUN mode — no DynamoDB writes will occur")

    log.info("--- Syncing explicit approver policies from approvers.yaml ---")
    explicit_approver_summary = sync_explicit_approver_policies()

    log.info("--- Syncing eligibility policies from eligibility.yaml ---")
    eligibility_summary = sync_eligibility_policies()

    approver_summary = {"ous_processed": 0, "approver_policies_written": 0, "skipped": 0}
    if GITHUB_TOKEN:
        log.info("--- Syncing OU auto-detection approver policies (team-resource-mapping) ---")
        log.info("Fetching team-resource-mapping.yaml from flexera/team-resource-mapping")
        team_mapping = fetch_team_resource_mapping()
        log.info("Loaded %d teams from team-resource-mapping.yaml", len(team_mapping))
        approver_summary = sync_approver_policies(team_mapping)
    else:
        log.info("GITHUB_TOKEN not set — skipping OU auto-detection (explicit approvers.yaml entries only)")

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dry_run": DRY_RUN,
        **explicit_approver_summary,
        **approver_summary,
        **eligibility_summary,
    }
    log.info("Sync complete: %s", json.dumps(summary))

    total_skipped = (
        explicit_approver_summary["explicit_skipped"]
        + approver_summary["skipped"]
        + eligibility_summary["skipped"]
    )
    if total_skipped > 0:
        log.warning("%d policies could not be written — check warnings above", total_skipped)
        sys.exit(1)


if __name__ == "__main__":
    main()
