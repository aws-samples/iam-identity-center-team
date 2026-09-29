"""Unit tests for the PreTokenGeneration Cognito trigger.

These tests verify that the trigger fails closed for non-federated users
(for example self-registered Cognito accounts) and only assigns TEAM
authorization claims for users federated through the external identity
provider. They stub boto3 so the module can be imported without any AWS calls.
"""
import importlib.util
import os
import unittest
from unittest import mock

INDEX_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "amplify",
    "backend",
    "function",
    "team06dbb7fcPreTokenGeneration",
    "src",
    "index.py",
)


def load_index():
    os.environ.setdefault("TEAM_ADMIN_GROUP", "team-admin")
    os.environ.setdefault("TEAM_AUDITOR_GROUP", "team-auditor")
    os.environ.setdefault("SETTINGS_TABLE_NAME", "settings-table")
    # Stub boto3 so importing the module performs no AWS calls.
    with mock.patch("boto3.client"), mock.patch("boto3.resource"):
        spec = importlib.util.spec_from_file_location("index", INDEX_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


index = load_index()


def federated_event():
    return {
        "userName": "IDC_alice@example.com",
        "request": {
            "userAttributes": {
                "email": "alice@example.com",
                "identities": '[{"providerName":"IDC","userId":"alice@example.com"}]',
            }
        },
    }


def native_event(user_name="d2e5d444-a061-70cb-ab77-9cd73bec7d55"):
    return {
        "userName": user_name,
        "request": {"userAttributes": {"email": "attacker@example.com"}},
    }


class FederatedIdentifierTests(unittest.TestCase):
    def test_native_user_without_identities_is_denied(self):
        with self.assertRaises(index.UnauthorizedError):
            index.get_federated_identifier(native_event())

    def test_native_user_with_underscore_but_no_identities_is_denied(self):
        # Even if the username happens to contain an underscore, a user that is
        # not federated must be rejected: authorization must not rely on the
        # username string shape.
        event = native_event(user_name="idc_attacker@example.com")
        with self.assertRaises(index.UnauthorizedError):
            index.get_federated_identifier(event)

    def test_federated_user_returns_identifier(self):
        self.assertEqual(
            index.get_federated_identifier(federated_event()),
            "alice@example.com",
        )


class HandlerTests(unittest.TestCase):
    def test_handler_denies_non_federated_user(self):
        with self.assertRaises(index.UnauthorizedError):
            index.handler(native_event(), None)

    def test_handler_assigns_admin_claim_for_federated_admin(self):
        groups_by_name = {"team-admin": "g-admin", "team-auditor": "g-aud"}
        with mock.patch.object(
            index, "get_team_groups", return_value=("team-admin", "team-auditor")
        ), mock.patch.object(
            index, "get_user", return_value="user-123"
        ), mock.patch.object(
            index, "get_group", side_effect=lambda g: groups_by_name[g]
        ), mock.patch.object(
            index,
            "list_idc_group_membership",
            return_value=[{"GroupId": "g-admin"}],
        ):
            result = index.handler(federated_event(), None)

        claims = result["response"]["claimsOverrideDetails"]
        self.assertEqual(claims["claimsToAddOrOverride"]["groups"], "Admin")
        self.assertEqual(claims["claimsToAddOrOverride"]["userId"], "user-123")
        self.assertIn(
            "Admin", claims["groupOverrideDetails"]["groupsToOverride"]
        )

    def test_handler_assigns_no_privileged_claim_for_federated_non_member(self):
        with mock.patch.object(
            index, "get_team_groups", return_value=("team-admin", "team-auditor")
        ), mock.patch.object(
            index, "get_user", return_value="user-456"
        ), mock.patch.object(
            index, "get_group", side_effect=lambda g: {"team-admin": "g-admin", "team-auditor": "g-aud"}[g]
        ), mock.patch.object(
            index,
            "list_idc_group_membership",
            return_value=[{"GroupId": "g-other"}],
        ):
            result = index.handler(federated_event(), None)

        claims = result["response"]["claimsOverrideDetails"]
        self.assertEqual(claims["claimsToAddOrOverride"]["groups"], "")
        self.assertEqual(claims["groupOverrideDetails"]["groupsToOverride"], [])


if __name__ == "__main__":
    unittest.main()
