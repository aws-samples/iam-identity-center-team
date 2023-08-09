---
layout: default
title: Notification configuration
nav_order: 4
parent: Configuration
grand_parent: Solution deployment
---
# Notification configuration
{: .no_toc}

TEAM supports email notification via Amazon SES, Slack notification via a custom Slack app, and custom notificatons via Amazon SNS. The notification type can be configured after deployment from the **Settings page**.

## Notification Types
### Email notification via Amazon SES
TEAM supports email notifications via Amazon SES either in the TEAM deployment account, or in another AWS account if authorized.
- To use Amazon SES in the **TEAM deployment account**, enable it, and for production use cases, move SES out of **sandbox mode** - [Moving out of the Amazon SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- Designate a verified email address in Amazon SES for originating approval and TEAM workflow notifications - [Verifying identities in Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html)
  > If your SES account is in sandbox mode, and for testing, make sure all requester, approver and notification email addresses are verified in SES otherwise TEAM notification would not function as expected.
  {: .note}
- As a TEAM administrator, navigate to the Settings page. Set the notification service to Amazon SES and enter the notification source email address. If using an SES identity in another account, set the SES Source ARN, otherwise leave it blank.

### Slack notifications
- As a TEAM administrator, navigate to the Settings page. 
- **Install the Slack app** to your Slack workspace by clicking the provided link. 
- In the Slack website, **generate a Slack OAuth token** for the app. 
- In the TEAM Settings page, set the notification service to Slack and enter the Slack OAuth token.

> The Slack app creates a Bot user with several permission _scopes_. Review these before installation. The permissions include viewing email addresses of Slack users, viewing user profile details, starting direct messages with people, and sending messages as the bot user. **Protect the generated OAuth token** as it retains these permissions and should be considered a secret.
{: .important}

### Custom notifications via Amazon SNS
TEAM creates an SNS topic in the **TEAM deployment account**. You may create subscriptions to this topic that will receive the full event details when notifications are generated.
- As a TEAM administrator, navigate to the Settings page. 
- Set the notification service to Amazon SNS.
- In the **TEAM deployment account**, create an SNS subscription to the TEAM notification topic.
- Configure your subscription target as desired to handle messages delivered via Amazon SNS.

## 🚀 Next Steps: Follow an [end-to-end TEAM walkthrough]({% link docs/guides/walkthrough.md %}).
{: .no_toc}