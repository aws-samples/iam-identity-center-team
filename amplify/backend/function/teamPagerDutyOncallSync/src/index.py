"""Sync PagerDuty on-call responders into an IAM Identity Center group.

Runs on a schedule (every 12 hours by default). Each run:
  1. resolves who is on call for the configured PagerDuty schedule(s) between
     now and now + LOOKAHEAD_HOURS (48h, i.e. "today and tomorrow"),
  2. matches those responders to IAM Identity Center users by email,
  3. adds the matched users to the target Identity Center group,
  4. removes every other member of that group.

The target group is treated as owned by this function: anybody in it who is not
on call gets removed. Nothing is written until all PagerDuty calls have
succeeded and at least one responder has been matched, so a PagerDuty outage or
a wholesale matching failure can never empty the group.
"""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

PAGERDUTY_API = "https://api.pagerduty.com"
PAGERDUTY_PAGE_SIZE = 100
PAGERDUTY_TIMEOUT = 15
# Bounds the pagination loop in case the API keeps reporting more pages.
PAGERDUTY_MAX_PAGES = 50
# Keys accepted when the secret holds JSON rather than a bare token.
SECRET_TOKEN_KEYS = ("token", "api_token", "pagerduty_token", "PAGERDUTY_TOKEN")

session = boto3.Session()

_token_cache = None


class SyncError(Exception):
    """Raised when the sync cannot be completed safely."""


def flag(name, default):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes")


def load_config(event):
    schedule_ids = [
        s.strip()
        for s in os.environ.get("PAGERDUTY_SCHEDULE_IDS", "").split(",")
        if s.strip()
    ]
    group_name = os.environ.get("IDC_GROUP_NAME", "").strip()
    group_id = os.environ.get("IDC_GROUP_ID", "").strip()
    secret_id = os.environ.get("PAGERDUTY_TOKEN_SECRET", "").strip()

    missing = []
    if not schedule_ids:
        missing.append("PAGERDUTY_SCHEDULE_IDS")
    if not group_name and not group_id:
        missing.append("IDC_GROUP_NAME or IDC_GROUP_ID")
    if not secret_id:
        missing.append("PAGERDUTY_TOKEN_SECRET")
    if missing:
        raise SyncError("missing configuration: %s" % ", ".join(missing))

    # A dry_run key on the invocation event overrides the environment, so the
    # function can be exercised by hand without redeploying.
    dry_run = flag("DRY_RUN", "true")
    if isinstance(event, dict) and "dry_run" in event:
        dry_run = bool(event["dry_run"])

    return {
        "schedule_ids": schedule_ids,
        "group_name": group_name,
        "group_id": group_id,
        "secret_id": secret_id,
        "lookahead_hours": int(os.environ.get("LOOKAHEAD_HOURS", "48")),
        "dry_run": dry_run,
    }


def get_pagerduty_token(secret_id):
    global _token_cache
    if _token_cache:
        return _token_cache

    client = session.client("secretsmanager")
    try:
        secret = client.get_secret_value(SecretId=secret_id)["SecretString"]
    except ClientError as e:
        raise SyncError(
            "could not read the PagerDuty token from secret %s: %s"
            % (secret_id, e.response["Error"]["Message"])
        ) from e

    token = secret.strip()
    try:
        parsed = json.loads(secret)
    except ValueError:
        parsed = None

    if isinstance(parsed, dict):
        token = ""
        for key in SECRET_TOKEN_KEYS:
            if parsed.get(key):
                token = str(parsed[key]).strip()
                break
        if not token:
            raise SyncError(
                "secret %s holds JSON but none of the keys %s"
                % (secret_id, ", ".join(SECRET_TOKEN_KEYS))
            )

    if not token:
        raise SyncError("secret %s is empty" % secret_id)

    _token_cache = token
    return token


def pagerduty_get(path, params, token):
    url = "%s%s?%s" % (
        PAGERDUTY_API,
        path,
        urllib.parse.urlencode(params, doseq=True),
    )
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": "Token token=%s" % token,
            "Accept": "application/vnd.pagerduty+json;version=2",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=PAGERDUTY_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:500]
        raise SyncError(
            "PagerDuty GET %s returned %s: %s" % (path, e.code, body)
        ) from e
    except urllib.error.URLError as e:
        raise SyncError("PagerDuty GET %s failed: %s" % (path, e.reason)) from e


def get_oncall_responders(schedule_ids, lookahead_hours, token):
    """Return the distinct responders on call within the lookahead window.

    /oncalls returns every on-call period overlapping the window and already
    accounts for overrides, so both the current and the next-up responder show
    up in one call.
    """
    now = datetime.now(timezone.utc)
    until = now + timedelta(hours=lookahead_hours)
    responders = {}
    offset = 0

    for _ in range(PAGERDUTY_MAX_PAGES):
        payload = pagerduty_get(
            "/oncalls",
            {
                "schedule_ids[]": schedule_ids,
                "include[]": "users",
                "since": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "until": until.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "time_zone": "UTC",
                "limit": PAGERDUTY_PAGE_SIZE,
                "offset": offset,
            },
            token,
        )
        for entry in payload.get("oncalls", []):
            user = entry.get("user") or {}
            email = (user.get("email") or "").strip()
            if not email:
                logger.warning(
                    "PagerDuty on-call entry has no email, skipping: %s",
                    user.get("summary") or user.get("id") or "unknown user",
                )
                continue
            responders[email.lower()] = {
                "pagerduty_id": user.get("id"),
                "name": user.get("name") or user.get("summary") or email,
                "email": email,
            }
        if not payload.get("more"):
            break
        offset += PAGERDUTY_PAGE_SIZE
    else:
        logger.warning(
            "stopped paginating /oncalls after %s pages", PAGERDUTY_MAX_PAGES
        )

    return list(responders.values())


def get_identity_store_id():
    client = session.client("sso-admin")
    try:
        instances = client.list_instances().get("Instances", [])
    except ClientError as e:
        raise SyncError(
            "could not list IAM Identity Center instances: %s"
            % e.response["Error"]["Message"]
        ) from e
    if not instances:
        raise SyncError(
            "no IAM Identity Center instance found in this account and region"
        )
    return instances[0]["IdentityStoreId"]


def resolve_group_id(identitystore, store_id, config):
    if config["group_id"]:
        return config["group_id"]
    try:
        return identitystore.get_group_id(
            IdentityStoreId=store_id,
            AlternateIdentifier={
                "UniqueAttribute": {
                    "AttributePath": "displayName",
                    "AttributeValue": config["group_name"],
                }
            },
        )["GroupId"]
    except identitystore.exceptions.ResourceNotFoundException as e:
        raise SyncError(
            "Identity Center group '%s' does not exist" % config["group_name"]
        ) from e


def find_user_by_username(identitystore, store_id, email):
    """Look up a user whose userName is the email. Returns None if there is none."""
    try:
        return identitystore.get_user_id(
            IdentityStoreId=store_id,
            AlternateIdentifier={
                "UniqueAttribute": {
                    "AttributePath": "userName",
                    "AttributeValue": email,
                }
            },
        )["UserId"]
    except identitystore.exceptions.ResourceNotFoundException:
        return None
    except identitystore.exceptions.ValidationException:
        return None


def build_email_index(identitystore, store_id):
    """Map every known email of every Identity Center user to its user id.

    Only built when a responder's email is not also their userName.
    """
    index = {}
    paginator = identitystore.get_paginator("list_users")
    for page in paginator.paginate(IdentityStoreId=store_id):
        for user in page["Users"]:
            user_id = user["UserId"]
            username = (user.get("UserName") or "").strip().lower()
            if username:
                index.setdefault(username, user_id)
            for email in user.get("Emails") or []:
                value = (email.get("Value") or "").strip().lower()
                if value:
                    index.setdefault(value, user_id)
    logger.info("indexed %s Identity Center email addresses", len(index))
    return index


def match_responders(identitystore, store_id, responders):
    """Split responders into {identity_center_user_id: responder} and unmatched."""
    matched = {}
    unmatched = []
    index = None

    for responder in responders:
        user_id = find_user_by_username(identitystore, store_id, responder["email"])
        if not user_id:
            if index is None:
                index = build_email_index(identitystore, store_id)
            user_id = index.get(responder["email"].lower())
        if user_id:
            matched[user_id] = responder
        else:
            unmatched.append(responder)

    return matched, unmatched


def get_group_members(identitystore, store_id, group_id):
    """Map the group's current user members to their membership ids."""
    members = {}
    paginator = identitystore.get_paginator("list_group_memberships")
    for page in paginator.paginate(IdentityStoreId=store_id, GroupId=group_id):
        for membership in page["GroupMemberships"]:
            user_id = (membership.get("MemberId") or {}).get("UserId")
            if user_id:
                members[user_id] = membership["MembershipId"]
    return members


def describe_user(identitystore, store_id, user_id):
    """Best-effort user name for log lines; never fails the sync."""
    try:
        user = identitystore.describe_user(
            IdentityStoreId=store_id, UserId=user_id
        )
        return user.get("UserName") or user_id
    except ClientError:
        return user_id


def add_members(identitystore, store_id, group_id, matched, user_ids):
    added, failures = [], []
    for user_id in user_ids:
        responder = matched[user_id]
        try:
            identitystore.create_group_membership(
                IdentityStoreId=store_id,
                GroupId=group_id,
                MemberId={"UserId": user_id},
            )
        except identitystore.exceptions.ConflictException:
            # Already a member — another run or an operator got there first.
            logger.info("%s is already a member of the group", responder["email"])
            continue
        except ClientError as e:
            logger.error(
                "could not add %s to the group: %s",
                responder["email"],
                e.response["Error"]["Message"],
            )
            failures.append(responder["email"])
            continue
        logger.info("added %s (%s) to the group", responder["email"], user_id)
        added.append(responder["email"])
    return added, failures


def remove_members(identitystore, store_id, memberships):
    removed, failures = [], []
    for user_id, membership_id in memberships.items():
        name = describe_user(identitystore, store_id, user_id)
        try:
            identitystore.delete_group_membership(
                IdentityStoreId=store_id, MembershipId=membership_id
            )
        except identitystore.exceptions.ResourceNotFoundException:
            logger.info("membership for %s was already gone", name)
            continue
        except ClientError as e:
            logger.error(
                "could not remove %s from the group: %s",
                name,
                e.response["Error"]["Message"],
            )
            failures.append(name)
            continue
        logger.info("removed %s (%s) from the group", name, user_id)
        removed.append(name)
    return removed, failures


def handler(event, context):
    config = load_config(event)
    token = get_pagerduty_token(config["secret_id"])

    # All PagerDuty work happens before the first write, so a failure here
    # aborts the run without touching group membership.
    responders = get_oncall_responders(
        config["schedule_ids"], config["lookahead_hours"], token
    )
    if not responders:
        raise SyncError(
            "PagerDuty reported nobody on call for schedule(s) %s in the next %sh; "
            "refusing to change group membership"
            % (", ".join(config["schedule_ids"]), config["lookahead_hours"])
        )
    logger.info(
        "on call in the next %sh: %s",
        config["lookahead_hours"],
        ", ".join(sorted(r["email"] for r in responders)),
    )

    store_id = get_identity_store_id()
    identitystore = session.client("identitystore")
    group_id = resolve_group_id(identitystore, store_id, config)

    matched, unmatched = match_responders(identitystore, store_id, responders)
    for responder in unmatched:
        logger.warning(
            "no Identity Center user matches on-call responder %s <%s>",
            responder["name"],
            responder["email"],
        )
    if not matched:
        raise SyncError(
            "none of the %s on-call responders matched an Identity Center user; "
            "refusing to change group membership" % len(responders)
        )

    current = get_group_members(identitystore, store_id, group_id)
    to_add = [user_id for user_id in matched if user_id not in current]
    to_remove = {
        user_id: membership_id
        for user_id, membership_id in current.items()
        if user_id not in matched
    }

    summary = {
        "group": config["group_name"] or group_id,
        "groupId": group_id,
        "dryRun": config["dry_run"],
        "onCall": sorted(r["email"] for r in responders),
        "unmatched": sorted(r["email"] for r in unmatched),
        "currentMemberCount": len(current),
        "added": [],
        "removed": [],
    }

    if config["dry_run"]:
        summary["wouldAdd"] = sorted(matched[user_id]["email"] for user_id in to_add)
        summary["wouldRemove"] = sorted(to_remove)
        logger.info("DRY_RUN, no changes applied: %s", json.dumps(summary))
        return summary

    added, add_failures = add_members(
        identitystore, store_id, group_id, matched, to_add
    )
    removed, remove_failures = remove_members(identitystore, store_id, to_remove)
    summary["added"] = sorted(added)
    summary["removed"] = sorted(removed)

    logger.info("sync complete: %s", json.dumps(summary))

    failures = add_failures + remove_failures
    if failures:
        raise SyncError(
            "sync finished with errors for: %s" % ", ".join(sorted(failures))
        )
    return summary
