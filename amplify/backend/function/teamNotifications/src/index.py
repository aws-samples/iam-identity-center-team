# © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
# This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
# http: // aws.amazon.com/agreement or other written agreement between Customer and either
# Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
from slack_sdk import WebClient
import os
import json
import boto3
from datetime import datetime, timezone
from dateutil import parser, tz

session = boto3.Session()


def parse_arn(arn):
    # http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
    elements = arn.split(":")
    result = {
        "arn": elements[0],
        "partition": elements[1],
        "service": elements[2],
        "region": elements[3],
        "account": elements[4],
    }
    if len(elements) == 7:
        result["resourcetype"], result["resource"] = elements[5:]
    elif "/" not in elements[5]:
        result["resource"] = elements[5]
        result["resourcetype"] = None
    else:
        result["resourcetype"], result["resource"] = elements[5].split("/")
    return result


def send_ses_notification(
    source_email, source_arn, subject, message_html, to_addresses, cc_addresses
):
    try:
        # Providing a source arn enables using an SES identity in another account
        if source_arn:
            ses_region = parse_arn(source_arn)["region"]
            ses_client = session.client("ses", region_name=ses_region)

            ses_client.send_email(
                Source=source_email,
                SourceArn=source_arn,
                Destination={"ToAddresses": to_addresses, "CcAddresses": cc_addresses},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {"Html": {"Data": message_html, "Charset": "UTF-8"}},
                },
            )
        else:
            ses_client = session.client("ses")
            ses_client.send_email(
                Source=source_email,
                Destination={"ToAddresses": to_addresses, "CcAddresses": cc_addresses},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {"Html": {"Data": message_html, "Charset": "UTF-8"}},
                },
            )
    except Exception as e:
        print(f"Error sending email via SES: {e}")


def send_sns_notification(notification_topic_arn, message, subject):
    sns_client = session.client("sns")
    try:
        sns_client.publish(
            TopicArn=notification_topic_arn,
            Message=message,
            Subject=subject,
        )
    except Exception as e:
        print(f"Error publishing message to SNS: {e}")


def send_slack_notifications(
    recipients,
    message,
    audit_message,
    login_url,
    request_start_time,
    role,
    account,
    duration_hours,
    justification,
    ticket,
):
    try:
        dynamodb = session.resource("dynamodb")
        settings_table_name = os.getenv("SETTINGS_TABLE_NAME")
        settings_table = dynamodb.Table(settings_table_name)
        settings = settings_table.get_item(Key={"id": "settings"})
        item_settings = settings.get("Item", {})
        slack_token = item_settings.get("slackToken", "")
        slack_audit_notifications_channel = item_settings.get(
            "slackAuditNotificationsChannel", ""
        )
        if slack_token:
            slack_client = WebClient(token=slack_token)
    except Exception as error:
        print(
            f"Error retrieving Slack OAuth token, cannot send Slack notifications: {error}"
        )
        return

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

    # send audit notifications to channel if defined
    if slack_audit_notifications_channel and audit_message:
        try:
            slack_client.chat_postMessage(
                channel=slack_audit_notifications_channel,
                text="AWS Access Request Audit Notification",
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": f"*{audit_message}*",
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
                ],
            )
        except Exception as error:
            print(
                f"Error posting audit message to channel {slack_audit_notifications_channel} (ensure bot is invited to the channel): {error}"
            )


def lambda_handler(event: dict, context):
    ses_notifications_enabled = event.get("ses_notifications_enabled", "")
    ses_source_email = event.get("ses_source_email", "")
    ses_source_arn = event.get("ses_source_arn", "")
    sns_notifications_enabled = event.get("sns_notifications_enabled", "")
    notification_topic_arn = event.get("notification_topic_arn", "")
    slack_notifications_enabled = event.get("slack_notifications_enabled", "")
    if not (
        (ses_notifications_enabled and ses_source_email)
        or (sns_notifications_enabled and notification_topic_arn)
        or (slack_notifications_enabled)
    ):
        # Notifications are disabled or configuration is invalid
        return

    approval_required = event["approvalRequired"]
    request_status = event["status"]
    granted = (
        event.get("grant", {})
        .get("AccountAssignmentCreationStatus", {})
        .get("Status", "")
        == "IN_PROGRESS"
    )
    ended = (
        event.get("revoke", {})
        .get("AccountAssignmentDeletionStatus", {})
        .get("Status", "")
        == "IN_PROGRESS"
    )
    # These statuses are updated in the DDB table after the event is generated, so we update it here
    if ended:
        request_status = "ended"
    if (
        (request_status == "approved" or request_status == "pending")
        and granted
        and not ended
    ):
        request_status = "granted"
    if not granted and not approval_required:
        request_status = "scheduled"
    event.update(
        {
            "status": request_status,
        }
    )

    requester = event["email"]
    approvers = event.get("approvers", "")
    account = f'{event["accountName"]} ({event["accountId"]})'
    role = event["role"]
    request_start_time = event["startTime"]
    duration_hours = event["time"]
    justification = event.get("justification", "No justification provided")
    ticket = event.get("ticketNo", "No ticket provided")
    login_url = event["sso_login_url"]
    sns_message = json.dumps(event)
    slack_audit_message = ""

    match request_status:
        case "pending":
            if approval_required:
                # Notify approvers pending request
                slack_recipients = approvers
                slack_message = f"<mailto:{requester}|{requester}> requests access to AWS, please approve or reject this request in TEAM."
                slack_audit_message = (
                    f"<mailto:{requester}|{requester}> has requested access to AWS"
                )
                email_to_addresses = approvers
                email_cc_addresses = [requester]
                subject = f"Access request to AWS account - {account}"
                email_message_html = f'<html><body><p><b>{requester}</b> requests access to AWS, please <b>approve or reject this request</b> in <a href="{login_url}">TEAM</a>.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "scheduled":
            # Don't need to send a notification if the request start time has already passed
            if datetime.now(timezone.utc) > parser.parse(request_start_time).astimezone(
                timezone.utc
            ):
                return
            # Notify requester request scheduled
            slack_recipients = [requester]
            slack_message = f"Your AWS access session is scheduled."
            email_to_addresses = [requester]
            email_cc_addresses = []
            subject = f"Scheduled access session for {account}"
            email_message_html = f'<html><body><p>Your AWS access session is scheduled, please open <a href="{login_url}">TEAM</a> to manage requests.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "expired":
            # Notify requester request expired
            slack_recipients = [requester]
            slack_message = "Your AWS access request has expired."
            email_to_addresses = [requester]
            email_cc_addresses = approvers if approval_required else []
            subject = f"Expired access request for {account}"
            email_message_html = f'<html><body><p>Your AWS access request has expired, please open <a href="{login_url}">TEAM</a> to submit a new request.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "ended":
            # Notify requester ended
            slack_recipients = [requester]
            slack_message = "Your AWS access session has ended."
            email_to_addresses = [requester]
            email_cc_addresses = approvers if approval_required else []
            subject = f"AWS access session ended for {account}"
            email_message_html = f'<html><body><p>Your AWS access session has ended, please open <a href="{login_url}">TEAM</a> to view session activity logs.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "granted":
            # Notify requester access granted
            slack_recipients = [requester]
            slack_message = "Your AWS access session has started."
            email_to_addresses = [requester]
            email_cc_addresses = approvers if approval_required else []
            subject = f"AWS access session started for {account}"
            email_message_html = f'<html><body><p>Your AWS access session has started. Open <a href="{login_url}">TEAM</a> to manage AWS access requests.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "approved":
            # Notify requester request approved
            slack_recipients = approvers + [requester]
            slack_message = f"AWS access request was approved by {event['approver']}."
            email_to_addresses = [requester]
            email_cc_addresses = approvers
            subject = f"AWS access request approved for {account}"
            slack_audit_message = f"AWS access request by <mailto:{requester}|{requester}> was approved by {event['approver']}"
            email_message_html = f'<html><body><p>Your AWS access request has been approved by {event["approver"]}. You will receive a notification when the session has started. Open <a href="{login_url}">TEAM</a> to manage AWS access requests.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "rejected":
            # Notify requester request rejected
            slack_recipients = approvers + [requester]
            slack_message = "AWS access request was rejected."
            slack_audit_message = f"AWS access request by <mailto:{requester}|{requester}> was rejected by {event['approver']}"
            email_to_addresses = [requester]
            email_cc_addresses = approvers
            subject = f"AWS access request rejected for {account}"
            email_message_html = f'<html><body><p>Your AWS access request has been rejected. Open <a href="{login_url}">TEAM</a> to manage AWS access requests.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "cancelled":
            # Notify approvers request cancelled
            slack_recipients = approvers
            slack_message = f"{requester} cancelled this AWS access request."
            email_to_addresses = approvers
            email_cc_addresses = [requester]
            subject = f"AWS access request cancelled for {account}"
            slack_audit_message = (
                f"AWS access request by <mailto:{requester}|{requester}> was cancelled"
            )
            email_message_html = f'<html><body><p>{requester} cancelled an AWS access request. Open <a href="{login_url}">TEAM</a> to manage AWS access requests.</p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case "error":
            # Notify approvers and requester error
            slack_recipients = approvers + [requester]
            slack_message = f"Error handling AWS access for {requester}. Error details: {event.get('statusError')}"
            email_to_addresses = [ses_source_email]
            email_cc_addresses = approvers + [requester]
            subject = f"Error handling AWS access for {account}"
            email_message_html = f'<html><body><p>TEAM encountered an error handling AWS access for {requester}. Please review the Step Function logs to troubleshoot the error and ensure access is properly granted or revoked. Open <a href="{login_url}">TEAM</a> to view additional details.</p><p><b>Error Details:</b> {event.get("statusError")}<br /></p><p><b>Account:</b> {account}<br /><b>Role:</b> {role}<br /><b>Start Time:</b> {request_start_time}<br /><b>Duration:</b> {duration_hours} hours<br /><b>Justification:</b> {justification}<br /><b>Ticket Number:</b> {ticket}<br /></p></body></html>'
        case _:
            print(f"Request status unexpected, exiting: {request_status}")
            return

    if ses_notifications_enabled:
        send_ses_notification(
            source_email=ses_source_email,
            source_arn=ses_source_arn,
            message_html=email_message_html,
            subject=subject,
            to_addresses=email_to_addresses,
            cc_addresses=email_cc_addresses,
        )

    if sns_notifications_enabled:
        send_sns_notification(
            message=sns_message,
            subject=subject,
            notification_topic_arn=notification_topic_arn,
        )

    if slack_notifications_enabled:
        send_slack_notifications(
            recipients=slack_recipients,
            message=slack_message,
            audit_message=slack_audit_message,
            login_url=login_url,
            role=role,
            account=account,
            request_start_time=request_start_time,
            duration_hours=duration_hours,
            justification=justification,
            ticket=ticket,
        )
