---
layout: default
title: End-to-end Scenario
nav_order: 2
parent: Guides
---
# TEAM Walkthrough
{: .no_toc}

Go through an end-to-end scenario in which a developer requests, and is granted temporary elevated access. The actions taken by the developer are audited after the session expires. 👩‍💻
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>
    Table of contents
  </summary>
  {: .text-delta }
- TOC
{:toc}
</details>

### Before we begin
{: .no_toc}
- You successfully followed the instructions to [deploy TEAM application](./deployment/index.md).
- The admin persona configured an [eligibility and an approver policy](./deployment/policies.md).

In this walkthrough, you will assume 3 different personas:
- Requestor (typically a developer) 🦓
- Approver (project lead/account owner) 🦁
- Auditor (security) 🦒

[Requestor guide]({% link docs/guides/user.md %}){: .btn .btn-purple }
[Approver guide]({% link docs/guides/approver.md %}){: .btn .btn-blue }
[Auditor guide]({% link docs/guides/auditor.md %}){: .btn .btn-green }
[Admin guide]({% link docs/guides/admin.md %}){: .btn .btn }
## Start the process
To begin with, imagine yourself a **requester** 🦓.

You need to perform a task that requires temporary elevated access to your AWS target environment. For example, you might need to fix a broken deployment pipeline or perform some operational tasks as part of a planned change.

As a requester, you already belong to a group used in at least one *eligibility policy* configured by the admin persona.

## 🦓 Step 1: Access the TEAM application
1. First, access Identity Center’s AWS access portal as described earlier, using the AWS access portal URL.
2. Next, select **TEAM IDC APP** to open the TEAM application as described earlier.


## 🦓 Step 2: Request elevated access
1. To request elevated access, select *Create request* in the left-hand navigation pane. A form appears.
2. To complete the form, select the AWS account where you need to perform your task, then select a permission set (representing an IAM role) that will give you sufficient permissions to perform the task. When you create a request, you can specify exactly one AWS account and one permission set.
   > You can only select an AWS account and permission set combination for which you are eligible based on the eligibility policies defined earlier.
   {: .note}
3. Provide a business justification, a start date and time, a duration, and a ticket ID (typically representing a change ticket or incident ticket related to your task).
   > When you complete your request, try to apply the [principle of least privilege](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege) by selecting a permission set with the least privilege, and a time window with the least duration, that will allow you to complete your task safely.
   {: .note}
4. Finally, click **Submit**.

<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/requestor_guides/create_request.mov">
</video>

> The duration specified in a request determines the time window for which elevated access will be active, if the request is approved. During this time window, the requester can invoke sessions to access the AWS target environment. It does not affect the duration of each session. Session duration is [configured independently for each permission set](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html) by an Identity Center administrator, and determines the time period for which IAM temporary credentials are valid when any user invokes a session using that permission set. Be aware that sessions invoked just before elevated access ends may remain valid beyond the end of the elevated access period. If this is a concern, consider minimizing the session duration configured in your permission sets, for example by setting them to 1 hour.
{: .note}

## 🦁 Step 3: Approve elevated access
Once you submit your request, approvers are notified. Approvers are notified when any request is created which falls within the scope of what they are authorized to approve, based on the *approval policies* defined earlier.

Now we’ll switch to the **approver** persona. As an approver, you access the TEAM application in exactly the same way as the other personas.

Once in the TEAM application, choose **Approve requests** in the left-hand navigation pane under **Approvals**. TEAM displays requests awaiting your review.

You can open a pending request to view the information provided by the requester, and decide whether you want to approve or reject it, as shown below.

<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/approver_guides/approve_request.mov">
</video>

Once you approve or reject a request, the original requester is notified.

### 🦓 Step 3.1: View approved/rejected requests

Now we’ll switch back to the **requester** persona. As a requester, you can see the status of your open requests in the TEAM application by selecting **My requests** in the left-hand navigation pane. You can see the requests view with one approved request.

## 🦓 Step 4: Activate elevated access
After a request is approved, the TEAM application waits until the start date and time specified in the request and then automatically activates access.

> To activate access, the TEAM orchestration workflow creates a temporary [permission set assignment](https://docs.aws.amazon.com/singlesignon/latest/userguide/useraccess.html), which links the requester’s user identity in Identity Center with the permission set and AWS account specified in their request. Following this, TEAM notifies the requester that their request is now active.
{: .note}

To see all active requests, select **Active access** in the left-hand navigation under **Elevated access**. You can choose **View details** to view details for an active request.

## 🦓 Step 5: Access AWS Environment with elevated permissions

During the time period in which elevated access is active, you can invoke sessions to access the AWS target environment with the scope (that is, permission set and AWS account) approved in your request.

Access Identity Center using the AWS access portal URL. From the AWS access portal you can select an AWS account and permission set that is currently active You’ll also see AWS accounts and permission sets you’ve been assigned statically in Identity Center, independently of TEAM. From here, you can:
- Select **Management Console** to federate to [AWS Management Console]()
- Select **Command line or programmatic access** to copy-and-paste temporary credentials

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/account_access.png" alt="IdC portal with account access">

> You can also initiate access directly from the command line using the AWS CLI. To use this method, you first need to configure [AWS CLI to integrate with Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/integrating-aws-cli.html). This provides a smooth user experience for AWS CLI users, since you do not need to copy-and-paste temporary credentials to the command line, and it also avoids exposing temporary credentials to your clipboard.
{: .note}


Whichever way you invoke access, Identity Center provides temporary credentials for the IAM role and AWS account that
was specified in your request, which allows you to assume that role in that account. The temporary credentials are valid for the [duration specified in the permission set](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html), defined by an Identity Center administrator.

Now you can complete the operational tasks you need to perform in the AWS target environment. During the period in which your elevated access is active, you can invoke multiple sessions if necessary. 👩‍💻

### 🦓 Step 5.1: Log session activity

When you access the AWS target environment, your activity is logged to [AWS CloudTrail](https://aws.amazon.com/cloudtrail/). Actions you perform in the AWS control plane are recorded as [CloudTrail events](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-concepts.html#cloudtrail-concepts-events).

> Each CloudTrail event contains the unique identifier of the user who performed the action, which provides traceability back to the human individual who invoked temporary elevated access.
{: .note}
### 🦓 Step 5.2: End elevated access
Elevated access ends when either:
1. The requested duration elapses, or
2. Access is explicitly revoked in the TEAM application.

> Either the requester or an approver can revoke elevated access. See [Revoke access guide](approver.md/#revoke-elevated-access).
{: .note}

When elevated access ends or is revoked, the TEAM orchestration workflow automatically deletes the temporary permission set assignment for this request. This unlinks the permission set, the AWS account, and the user in Identity center.

The requester is then notified that their elevated access has ended.

## 🦒 Step 9: View session activity logs

You can view request details and session activity for current and historical requests from within the TEAM application. Each persona can see the following information:
- *Requesters* can inspect elevated access requested by them
- *Approvers* can inspect elevated access that falls within the scope of what they are authorized to approve
- *Auditors* can inspect all elevated access globally

> Session activity is streamed to the TEAM application in near real time, which means you can view session activity while a session is in progress.
{: .note}

Logging in as **auditor** persona, you can go to **Audit** section. To review all past approvals/rejections go to **Approval history**. You can download all records as a CSV file.

To see the current and past elevated access session, go to **Elevated access**. From here, you can inspect the session logs, search them for particular actions and download all logs as a CSV file.

<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/auditor_guides/auditor_inspect.mov">
</video>
