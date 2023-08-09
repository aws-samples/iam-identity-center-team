# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
from slack_sdk import WebClient
import os
import boto3
from dateutil import parser, tz


try:
    dynamodb = boto3.resource("dynamodb")
    settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
    settings_table = dynamodb.Table(settings_table_name)
    settings = settings_table.get_item(Key={"id": "settings"})
    item_settings = settings.get("Item", {})
    slack_token = item_settings.get("slackToken")
    slack_client = WebClient(token=slack_token)
except Exception as error:
    print(f"Error retrieving Slack OAuth token, cannot continue: {error}")
    exit


def send_slack_notifications(
    recipients: list,
    message,
    login_url,
    request_start_time,
    role,
    account,
    duration_hours,
    justification="",
    ticket="",
):
    parsed_date = parser.parse(request_start_time)

    for recipient in recipients:
        try:
            recipient_slack_user = slack_client.users_lookupByEmail(email=recipient)
            recipient_slack_id = recipient_slack_user["user"]["id"]
            recipient_timezone = tz.gettz(name=recipient_slack_user["user"]["tz"])
        except Exception as error:
            print(f"Error getting Slack user info for {recipient}: {error}")
            continue

        # Format date, localized to recipient's timezone
        localized_date = parsed_date.astimezone(recipient_timezone)
        formatted_date = localized_date.strftime("%B %d, %Y at %I:%M %p %Z")

        # Build message using Slack blocks
        message_blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{message}*",
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Open TEAM",
                    },
                    "url": login_url,
                    "action_id": "button-action",
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Account:*\n{account}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Start time:*\n{formatted_date}",
                    },
                    {"type": "mrkdwn", "text": f"*Role:*\n{role}"},
                    {
                        "type": "mrkdwn",
                        "text": f"*Duration:*\n{duration_hours} hours",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Justification:*\n{justification}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Ticket Number:*\n{ticket}",
                    },
                ],
            },
        ]

        # Send message to user
        try:
            slack_client.chat_postMessage(
                channel=recipient_slack_id,
                blocks=message_blocks,
                text="AWS Access Request Notification",
            )
        except Exception as error:
            print(
                f"Error posting chat message to channel/user id {recipient_slack_id}: {error}"
            )


def lambda_handler(event: dict, context):
    request_status = event["status"]
    granted = (
        event.get("grant", {})
        .get("AccountAssignmentCreationStatus", {})
        .get("Status", "")
        == "IN_PROGRESS")
    ended = (
        event.get("revoke", {})
        .get("AccountAssignmentDeletionStatus", {})
        .get("Status", "")
        == "IN_PROGRESS")
    requester = event["email"]
    approvers = event.get("approvers", "")
    account = f'{event["accountName"]} ({event["accountId"]})'
    role = event["role"]
    request_start_time = event["startTime"]
    duration_hours = event["time"]
    justification = event.get("justification", "No justification provided")
    ticket = event.get("ticketNo", "No ticket provided")
    login_url = event["sso_login_url"]

    match request_status:
        case "pending":
            # Notify approvers pending request
            send_slack_notifications(
                recipients=approvers,
                message=f"<mailto:{requester}|{requester}> requests access to AWS, please approve or reject this request in TEAM.",
                login_url=login_url,
                role=role,
                account=account,
                request_start_time=request_start_time,
                duration_hours=duration_hours,
                justification=justification,
                ticket=ticket,
            )
        case "expired":
            # Notify requester request expired
            send_slack_notifications(
                recipients=[requester],
                message="Your AWS access request has expired.",
                login_url=login_url,
                role=role,
                account=account,
                request_start_time=request_start_time,
                duration_hours=duration_hours,
                justification=justification,
                ticket=ticket,
            )
        case "approved":
            if ended:
                # Notify requester ended
                send_slack_notifications(
                    recipients=[requester],
                    message="Your AWS access session has ended.",
                    login_url=login_url,
                    role=role,
                    account=account,
                    request_start_time=request_start_time,
                    duration_hours=duration_hours,
                    justification=justification,
                    ticket=ticket,
                )
            elif granted and not ended:
                # Notify requester access granted
                send_slack_notifications(
                    recipients=[requester],
                    message="Your AWS access session has started.",
                    login_url=login_url,
                    role=role,
                    account=account,
                    request_start_time=request_start_time,
                    duration_hours=duration_hours,
                    justification=justification,
                    ticket=ticket,
                )
            else:
                # Notify requester request approved
                send_slack_notifications(
                    recipients=[requester],
                    message=f"Your AWS access request was approved by {event['approver']}.",
                    login_url=login_url,
                    role=role,
                    account=account,
                    request_start_time=request_start_time,
                    duration_hours=duration_hours,
                    justification=justification,
                    ticket=ticket,
                )
        case "rejected":
            # Notify requester request rejected
            send_slack_notifications(
                recipients=[requester],
                message="Your AWS access request was rejected.",
                login_url=login_url,
                role=role,
                account=account,
                request_start_time=request_start_time,
                duration_hours=duration_hours,
                justification=justification,
                ticket=ticket,
            )
        case "cancelled":
            # Notify approvers request cancelled
            send_slack_notifications(
                recipients=[approvers],
                message=f"{requester} cancelled this AWS access request.",
                login_url=login_url,
                role=role,
                account=account,
                request_start_time=request_start_time,
                duration_hours=duration_hours,
                justification=justification,
                ticket=ticket,
            )
        case "error":
            # Notify approvers and requester error
            send_slack_notifications(
                recipients=approvers + [requester],
                message="Error with AWS access request.",
                login_url=login_url,
                role=role,
                account=account,
                request_start_time=request_start_time,
                duration_hours=duration_hours,
                justification=justification,
                ticket=ticket,
            )
        case _:
            print(f"Request status unexpected: {request_status}")
