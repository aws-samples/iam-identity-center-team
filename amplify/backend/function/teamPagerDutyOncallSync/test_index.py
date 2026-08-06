"""Tests for the PagerDuty on-call to IAM Identity Center group sync.

Stdlib only, no test runner needed:

    python3 amplify/backend/function/teamPagerDutyOncallSync/test_index.py
"""

import io
import json
import os
import sys
import unittest
import urllib.error
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

import index  # noqa: E402

STORE_ID = "d-1234567890"
GROUP_ID = "group-oncall"

BASE_ENV = {
    "PAGERDUTY_SCHEDULE_IDS": "PSCHED1",
    "PAGERDUTY_TOKEN_SECRET": "team/pagerduty/api-token",
    "IDC_GROUP_NAME": "AWS-OnCall",
    "IDC_GROUP_ID": "",
    "LOOKAHEAD_HOURS": "48",
    "DRY_RUN": "false",
}


class ResourceNotFoundException(Exception):
    pass


class ValidationException(Exception):
    pass


class ConflictException(Exception):
    pass


class FakeExceptions:
    ResourceNotFoundException = ResourceNotFoundException
    ValidationException = ValidationException
    ConflictException = ConflictException


class FakePaginator:
    def __init__(self, pages):
        self._pages = pages

    def paginate(self, **kwargs):
        return iter(self._pages)


class FakeIdentityStore:
    """Minimal stand-in for the identitystore client."""

    exceptions = FakeExceptions()

    def __init__(self, users, memberships, groups=None):
        # users: [{"UserId":..., "UserName":..., "Emails":[{"Value":...}]}]
        self.users = users
        # memberships: {membership_id: user_id}
        self.memberships = dict(memberships)
        self.groups = groups if groups is not None else {"AWS-OnCall": GROUP_ID}
        self.created = []
        self.deleted = []
        self._next_membership = 100

    def get_group_id(self, IdentityStoreId, AlternateIdentifier):
        name = AlternateIdentifier["UniqueAttribute"]["AttributeValue"]
        if name not in self.groups:
            raise ResourceNotFoundException(name)
        return {"GroupId": self.groups[name], "IdentityStoreId": IdentityStoreId}

    def get_user_id(self, IdentityStoreId, AlternateIdentifier):
        value = AlternateIdentifier["UniqueAttribute"]["AttributeValue"]
        for user in self.users:
            if user.get("UserName") == value:
                return {"UserId": user["UserId"], "IdentityStoreId": IdentityStoreId}
        raise ResourceNotFoundException(value)

    def describe_user(self, IdentityStoreId, UserId):
        for user in self.users:
            if user["UserId"] == UserId:
                return dict(user)
        raise ResourceNotFoundException(UserId)

    def get_paginator(self, name):
        if name == "list_users":
            return FakePaginator([{"Users": self.users}])
        if name == "list_group_memberships":
            return FakePaginator(
                [
                    {
                        "GroupMemberships": [
                            {"MembershipId": mid, "MemberId": {"UserId": uid}}
                            for mid, uid in self.memberships.items()
                        ]
                    }
                ]
            )
        raise AssertionError("unexpected paginator %s" % name)

    def create_group_membership(self, IdentityStoreId, GroupId, MemberId):
        user_id = MemberId["UserId"]
        if user_id in self.memberships.values():
            raise ConflictException(user_id)
        self._next_membership += 1
        membership_id = "m-%s" % self._next_membership
        self.memberships[membership_id] = user_id
        self.created.append(user_id)
        return {"MembershipId": membership_id}

    def delete_group_membership(self, IdentityStoreId, MembershipId):
        if MembershipId not in self.memberships:
            raise ResourceNotFoundException(MembershipId)
        self.deleted.append(self.memberships.pop(MembershipId))
        return {}


class FakeSSOAdmin:
    def __init__(self, instances=None):
        self.instances = (
            instances
            if instances is not None
            else [{"IdentityStoreId": STORE_ID, "InstanceArn": "arn:aws:sso:::instance/ins-1"}]
        )

    def list_instances(self):
        return {"Instances": self.instances}


class FakeSecretsManager:
    def __init__(self, secret="pd-token-abc"):
        self.secret = secret

    def get_secret_value(self, SecretId):
        return {"SecretString": self.secret}


class FakeSession:
    def __init__(self, identitystore, secret="pd-token-abc", instances=None):
        self._clients = {
            "identitystore": identitystore,
            "sso-admin": FakeSSOAdmin(instances),
            "secretsmanager": FakeSecretsManager(secret),
        }

    def client(self, name, **kwargs):
        return self._clients[name]


def oncall_payload(users, more=False):
    return {
        "oncalls": [{"user": user} for user in users],
        "more": more,
    }


def fake_urlopen(*payloads):
    """Return a urlopen replacement that yields the given JSON payloads in order."""
    bodies = [json.dumps(p).encode("utf-8") for p in payloads]
    calls = {"n": 0}

    def _urlopen(request, timeout=None):
        index_ = min(calls["n"], len(bodies) - 1)
        calls["n"] += 1
        body = bodies[index_]

        class _Response:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return body

        return _Response()

    _urlopen.calls = calls
    return _urlopen


class SyncTestCase(unittest.TestCase):
    def setUp(self):
        index._token_cache = None

    def run_handler(self, identitystore, payloads, env=None, event=None):
        merged = dict(BASE_ENV)
        merged.update(env or {})
        session = FakeSession(identitystore)
        with mock.patch.dict(os.environ, merged, clear=False), mock.patch.object(
            index, "session", session
        ), mock.patch("urllib.request.urlopen", fake_urlopen(*payloads)):
            return index.handler(event if event is not None else {}, None)


class TestHappyPath(SyncTestCase):
    def test_adds_oncall_and_removes_everyone_else(self):
        identitystore = FakeIdentityStore(
            users=[
                {"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []},
                {"UserId": "u-bob", "UserName": "bob@capmo.de", "Emails": []},
                {"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []},
            ],
            # bob is already in the group and stays; stale must go.
            memberships={"m-1": "u-bob", "m-2": "u-stale"},
        )
        payload = oncall_payload(
            [
                {"id": "PD1", "name": "Alice", "email": "alice@capmo.de"},
                {"id": "PD2", "name": "Bob", "email": "bob@capmo.de"},
            ]
        )

        summary = self.run_handler(identitystore, [payload])

        self.assertEqual(identitystore.created, ["u-alice"])
        self.assertEqual(identitystore.deleted, ["u-stale"])
        self.assertEqual(summary["added"], ["alice@capmo.de"])
        self.assertEqual(summary["removed"], ["stale@capmo.de"])
        self.assertEqual(summary["unmatched"], [])
        self.assertFalse(summary["dryRun"])
        self.assertEqual(summary["groupId"], GROUP_ID)
        # bob's membership is untouched, not churned.
        self.assertEqual(identitystore.memberships["m-1"], "u-bob")

    def test_no_changes_when_already_in_sync(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={"m-1": "u-alice"},
        )
        payload = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
        )

        summary = self.run_handler(identitystore, [payload])

        self.assertEqual(identitystore.created, [])
        self.assertEqual(identitystore.deleted, [])
        self.assertEqual(summary["added"], [])
        self.assertEqual(summary["removed"], [])

    def test_matches_by_email_when_username_differs(self):
        identitystore = FakeIdentityStore(
            users=[
                {
                    "UserId": "u-carol",
                    "UserName": "carol.smith",
                    "Emails": [{"Value": "Carol@Capmo.de"}],
                }
            ],
            memberships={},
        )
        payload = oncall_payload(
            [{"id": "PD3", "name": "Carol", "email": "carol@capmo.de"}]
        )

        summary = self.run_handler(identitystore, [payload])

        self.assertEqual(identitystore.created, ["u-carol"])
        self.assertEqual(summary["unmatched"], [])

    def test_deduplicates_repeated_oncall_entries(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
        )
        # Same responder appears for today and again for tomorrow.
        payload = oncall_payload(
            [
                {"id": "PD1", "name": "Alice", "email": "alice@capmo.de"},
                {"id": "PD1", "name": "Alice", "email": "alice@capmo.de"},
            ]
        )

        summary = self.run_handler(identitystore, [payload])

        self.assertEqual(identitystore.created, ["u-alice"])
        self.assertEqual(summary["onCall"], ["alice@capmo.de"])

    def test_paginates_oncalls(self):
        identitystore = FakeIdentityStore(
            users=[
                {"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []},
                {"UserId": "u-bob", "UserName": "bob@capmo.de", "Emails": []},
            ],
            memberships={},
        )
        page1 = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}], more=True
        )
        page2 = oncall_payload([{"id": "PD2", "name": "Bob", "email": "bob@capmo.de"}])

        summary = self.run_handler(identitystore, [page1, page2])

        self.assertEqual(summary["onCall"], ["alice@capmo.de", "bob@capmo.de"])
        self.assertEqual(sorted(identitystore.created), ["u-alice", "u-bob"])


class TestDryRun(SyncTestCase):
    def test_reports_plan_without_touching_the_group(self):
        identitystore = FakeIdentityStore(
            users=[
                {"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []},
                {"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []},
            ],
            memberships={"m-2": "u-stale"},
        )
        payload = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
        )

        summary = self.run_handler(identitystore, [payload], env={"DRY_RUN": "true"})

        self.assertEqual(identitystore.created, [])
        self.assertEqual(identitystore.deleted, [])
        self.assertTrue(summary["dryRun"])
        self.assertEqual(summary["wouldAdd"], ["alice@capmo.de"])
        self.assertEqual(summary["wouldRemove"], ["u-stale"])

    def test_dry_run_defaults_to_true(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
        )
        payload = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
        )
        env = dict(BASE_ENV)
        del env["DRY_RUN"]
        session = FakeSession(identitystore)
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(
            index, "session", session
        ), mock.patch("urllib.request.urlopen", fake_urlopen(payload)):
            summary = index.handler({}, None)

        self.assertTrue(summary["dryRun"])
        self.assertEqual(identitystore.created, [])

    def test_event_overrides_environment(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
        )
        payload = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
        )

        summary = self.run_handler(
            identitystore, [payload], env={"DRY_RUN": "false"}, event={"dry_run": True}
        )

        self.assertTrue(summary["dryRun"])
        self.assertEqual(identitystore.created, [])


class TestFailClosed(SyncTestCase):
    def assert_untouched(self, identitystore):
        self.assertEqual(identitystore.created, [])
        self.assertEqual(identitystore.deleted, [])

    def test_empty_oncall_never_empties_the_group(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []}],
            memberships={"m-2": "u-stale"},
        )

        with self.assertRaises(index.SyncError) as ctx:
            self.run_handler(identitystore, [oncall_payload([])])

        self.assertIn("nobody on call", str(ctx.exception))
        self.assert_untouched(identitystore)

    def test_pagerduty_http_error_aborts_before_any_write(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []}],
            memberships={"m-2": "u-stale"},
        )

        def raising_urlopen(request, timeout=None):
            raise urllib.error.HTTPError(
                "https://api.pagerduty.com/oncalls",
                401,
                "Unauthorized",
                {},
                io.BytesIO(b'{"error":{"message":"Invalid credentials"}}'),
            )

        session = FakeSession(identitystore)
        with mock.patch.dict(os.environ, BASE_ENV, clear=False), mock.patch.object(
            index, "session", session
        ), mock.patch("urllib.request.urlopen", raising_urlopen):
            with self.assertRaises(index.SyncError) as ctx:
                index.handler({}, None)

        self.assertIn("401", str(ctx.exception))
        self.assert_untouched(identitystore)

    def test_pagerduty_network_error_aborts_before_any_write(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []}],
            memberships={"m-2": "u-stale"},
        )

        def raising_urlopen(request, timeout=None):
            raise urllib.error.URLError("connection timed out")

        session = FakeSession(identitystore)
        with mock.patch.dict(os.environ, BASE_ENV, clear=False), mock.patch.object(
            index, "session", session
        ), mock.patch("urllib.request.urlopen", raising_urlopen):
            with self.assertRaises(index.SyncError):
                index.handler({}, None)

        self.assert_untouched(identitystore)

    def test_no_match_at_all_aborts_before_any_write(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []}],
            memberships={"m-2": "u-stale"},
        )
        payload = oncall_payload(
            [{"id": "PD9", "name": "Contractor", "email": "nobody@example.com"}]
        )

        with self.assertRaises(index.SyncError) as ctx:
            self.run_handler(identitystore, [payload])

        self.assertIn("matched an Identity Center user", str(ctx.exception))
        self.assert_untouched(identitystore)

    def test_partial_match_still_syncs_and_reports_the_gap(self):
        identitystore = FakeIdentityStore(
            users=[
                {"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []},
                {"UserId": "u-stale", "UserName": "stale@capmo.de", "Emails": []},
            ],
            memberships={"m-2": "u-stale"},
        )
        payload = oncall_payload(
            [
                {"id": "PD1", "name": "Alice", "email": "alice@capmo.de"},
                {"id": "PD9", "name": "Contractor", "email": "nobody@example.com"},
            ]
        )

        summary = self.run_handler(identitystore, [payload])

        self.assertEqual(identitystore.created, ["u-alice"])
        self.assertEqual(identitystore.deleted, ["u-stale"])
        self.assertEqual(summary["unmatched"], ["nobody@example.com"])

    def test_missing_group_is_reported(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
            groups={},
        )
        payload = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
        )

        with self.assertRaises(index.SyncError) as ctx:
            self.run_handler(identitystore, [payload])

        self.assertIn("does not exist", str(ctx.exception))

    def test_responder_without_email_is_skipped(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
        )
        payload = oncall_payload(
            [
                {"id": "PD1", "name": "Alice", "email": "alice@capmo.de"},
                {"id": "PD8", "name": "No Email", "email": ""},
            ]
        )

        summary = self.run_handler(identitystore, [payload])

        self.assertEqual(summary["onCall"], ["alice@capmo.de"])


class TestConfig(SyncTestCase):
    def test_missing_configuration_is_reported(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(index.SyncError) as ctx:
                index.load_config({})

        message = str(ctx.exception)
        self.assertIn("PAGERDUTY_SCHEDULE_IDS", message)
        self.assertIn("IDC_GROUP_NAME or IDC_GROUP_ID", message)
        self.assertIn("PAGERDUTY_TOKEN_SECRET", message)

    def test_group_id_takes_precedence_over_name(self):
        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
            groups={},  # name lookup would fail
        )
        payload = oncall_payload(
            [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
        )

        summary = self.run_handler(
            identitystore, [payload], env={"IDC_GROUP_ID": "explicit-group"}
        )

        self.assertEqual(summary["groupId"], "explicit-group")
        self.assertEqual(identitystore.created, ["u-alice"])

    def test_multiple_schedules_are_parsed(self):
        with mock.patch.dict(
            os.environ,
            dict(BASE_ENV, PAGERDUTY_SCHEDULE_IDS=" PS1 , PS2 ,"),
            clear=False,
        ):
            config = index.load_config({})

        self.assertEqual(config["schedule_ids"], ["PS1", "PS2"])


class TestToken(SyncTestCase):
    def read_token(self, secret):
        session = FakeSession(FakeIdentityStore([], {}), secret=secret)
        with mock.patch.object(index, "session", session):
            return index.get_pagerduty_token("team/pagerduty/api-token")

    def test_plain_string_secret(self):
        self.assertEqual(self.read_token("  pd-token-abc  "), "pd-token-abc")

    def test_json_secret(self):
        self.assertEqual(
            self.read_token(json.dumps({"token": "pd-token-json"})), "pd-token-json"
        )

    def test_json_secret_alternate_key(self):
        self.assertEqual(
            self.read_token(json.dumps({"api_token": "pd-token-alt"})), "pd-token-alt"
        )

    def test_json_secret_without_a_known_key(self):
        with self.assertRaises(index.SyncError):
            self.read_token(json.dumps({"unexpected": "value"}))

    def test_empty_secret(self):
        with self.assertRaises(index.SyncError):
            self.read_token("   ")


class TestRequestShape(SyncTestCase):
    def test_oncalls_request_carries_window_and_schedules(self):
        captured = {}

        def capturing_urlopen(request, timeout=None):
            captured["url"] = request.full_url
            captured["headers"] = dict(request.header_items())
            body = json.dumps(
                oncall_payload(
                    [{"id": "PD1", "name": "Alice", "email": "alice@capmo.de"}]
                )
            ).encode("utf-8")

            class _Response:
                def __enter__(self):
                    return self

                def __exit__(self, *args):
                    return False

                def read(self):
                    return body

            return _Response()

        identitystore = FakeIdentityStore(
            users=[{"UserId": "u-alice", "UserName": "alice@capmo.de", "Emails": []}],
            memberships={},
        )
        session = FakeSession(identitystore)
        with mock.patch.dict(
            os.environ, dict(BASE_ENV, PAGERDUTY_SCHEDULE_IDS="PS1,PS2"), clear=False
        ), mock.patch.object(index, "session", session), mock.patch(
            "urllib.request.urlopen", capturing_urlopen
        ):
            index.handler({}, None)

        url = captured["url"]
        self.assertIn("schedule_ids%5B%5D=PS1", url)
        self.assertIn("schedule_ids%5B%5D=PS2", url)
        self.assertIn("include%5B%5D=users", url)
        self.assertIn("since=", url)
        self.assertIn("until=", url)
        headers = {k.lower(): v for k, v in captured["headers"].items()}
        self.assertEqual(headers["Authorization".lower()], "Token token=pd-token-abc")
        self.assertIn("version=2", headers["Accept".lower()])

    def test_window_is_lookahead_hours_wide(self):
        captured = {}

        def capturing_urlopen(request, timeout=None):
            captured["url"] = request.full_url
            raise urllib.error.URLError("stop here")

        session = FakeSession(FakeIdentityStore([], {}))
        with mock.patch.dict(
            os.environ, dict(BASE_ENV, LOOKAHEAD_HOURS="48"), clear=False
        ), mock.patch.object(index, "session", session), mock.patch(
            "urllib.request.urlopen", capturing_urlopen
        ):
            with self.assertRaises(index.SyncError):
                index.handler({}, None)

        from datetime import datetime
        from urllib.parse import parse_qs, urlparse

        query = parse_qs(urlparse(captured["url"]).query)
        since = datetime.strptime(query["since"][0], "%Y-%m-%dT%H:%M:%SZ")
        until = datetime.strptime(query["until"][0], "%Y-%m-%dT%H:%M:%SZ")
        self.assertEqual((until - since).total_seconds(), 48 * 3600)


if __name__ == "__main__":
    unittest.main(verbosity=2)
