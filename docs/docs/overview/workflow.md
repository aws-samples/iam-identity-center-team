---
layout: default
title: Solution workflow
nav_order: 2
parent: Solution overview
---

# Solution workflow

TEAM uses IAM Identity Center groups synchronized into Cognito to provide group based authorization for managing access to the TEAM application. It is important to understand the TEAM application personas and groups before describing the TEAM solution workflow.

A TEAM user’s persona is determined by their group memberships in IAM Identity Center.

## TEAM personas and groups
Below is a description of the four personas and access patterns for the TEAM application

1. **Requester** - This persona can raise a request for temporary elevated access for eligible accounts and permissions.  A requester can also view details of previous requests and sessions raised by the user.

2. **Approver** - This persona is a member of an IAM Identity Center group responsible for approving or rejecting TEAM requests to an account or a group of accounts within an organization unit which has been delegated to them by an Admin. They can view historical details and session logs of requests actioned by them or by other approvers for accounts delegated to them.
An approver can also request for elevated access but cannot approve or reject their own request.

3. **Auditor** - This persona is a member of a **team auditor** group in AWS IAM Identity Center. An auditor can view historical data of all TEAM sessions, approval information (justification/comments) and audit logs of all actions performed by a requester within the duration of elevated access to the AWS environments.

4. **Admin** - This persona is a member of a **team admin** group in AWS IAM Identity Center. An admin user is responsible for:
- Managing application wide settings such as ***max duration settings***, ***approval settings*** and ***form mandatory fields***
- Managing [approval policies]({% link docs/overview/policies.md %}) that delegates approver groups responsible for approving or rejecting elevated access requests for accounts and Organizational Units.
- Managing [eligibility policies]({% link docs/overview/policies.md %}) that defines accounts and permission sets a user or group is allowed to request access for.

## TEAM workflow

A typical use case for TEAM is for performing operational tasks that require elevated access to your AWS environment. For example, you might need to fix a broken deployment pipeline or perform some operational tasks as part of a planned change.

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/architecture/workflow.png" alt="Solution worklow">


The following steps below describes a walkthrough of the TEAM solution workflow:
### Step 1: Access the AWS access portal in IAM Identity Center
To access the TEAM application, a requester needs to login to the IAM Identity Center AWS access portal.
### Step 2: Access the TEAM application
The TEAM application is onboarded as a Custom SAML 2.0 application on IAM Identity Center. The requester can single sign-on into the TEAM application by clicking on the TEAM SAML application.

### Step 3: Request elevated access
The requester performs the following actions to request elevated access on the TEAM application UI:
  - The requester completes a request form that provides a list of accounts and permissions the requester is eligible to request access to.

The requester or a group they belong to in IAM Identity Center must have an associated eligibility policy configured by the admin persona
{: .important}
  - The requester selects an account and a role that provides sufficient permissions to perform the task
  - Enter a start date and time, duration and a valid business justification.

> The duration specified in a request determines the time window for which elevated access will be active, if the request is approved. During this time window, the requester can invoke sessions to access the AWS target environment. It does not affect the duration of each session. Session duration is configured independently for each permission set by an IAM Identity Center administrator, and determines the time period for which IAM temporary credentials are valid for all sessions using that permission set. Be aware that sessions invoked just before elevated access ends might remain valid beyond the end of the elevated access period. If this is a concern, consider minimizing the session duration configured in your permission sets, for example by setting them to 1 hour.
{: .warning }
- Requester submits elevated access request

### Step 4: Approve elevated access
After the requester submits the request, a group of approvers are notified. Approver groups for an account or groups of accounts are defined by approval policy created by the admin persona.
- An approver logs in to the TEAM application to either approve or reject an elevated access request.
- TEAM notifies the requester that their request is approved and elevated access will be active at the start date and time specified in the request.


### Step 5: Activate elevated access
After a request is approved, the TEAM application waits until the start date and time specified in the request and then automatically activates access.
To activate elevated access:
- TEAM orchestration workflow creates a temporary permission set assignment, which links the requester’s user identity in IAM Identity Center with the permission set and account in their request.
- TEAM notifies the requester that their request is active

### Step 6: Invoke elevated access
During the time period in which elevated access is active, a requester can invoke sessions to access the AWS target environment with the scope (permission set and AWS account) approved in the request.

### Step 7: Log session activity
Actions performed by the requester during the period of elevated access in the AWS target environment are recorded and logged as auditable events based on the [log delivery times provided by AWS CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/how-cloudtrail-works.html).

### Step 8: End elevated access
Elevated access ends when either the requested duration elapses or it is explicitly revoked in the TEAM application. Either the requester or an approver can revoke elevated access within the requested duration.

When elevated access is ended:
- TEAM orchestration workflow automatically deletes the temporary permission set assignment for the request. This unlinks the permission set, the AWS account, and the user in IAM Identity Center
- The requester can no longer invoke new elevated access sessions to the AWS account using the elevated permission

Active sessions invoked during the period of elevated access might remain active until the session duration configured for the permission set in IAM Identity Center expires. Consider minimizing the session duration configured in your permission sets, for example by setting them to the default **1 hour**.
{: .warning }

### Step 9: Review request details and session activity logs
You can view request details and session activity logs for current and historical requests from within the TEAM application.
- Requesters can inspect elevated access and session activity logs requested by them.
- Approvers can inspect elevated access and session activity logs that fall within the scope of what they are authorized to approve.
- Auditors can inspect all elevated access and session activity logs globally

TEAM assumes that the permission set session duration is configured as the default 1 hour.
To accommodate for possible lag between elevated access expiry and the configured permission set session duration, session activities are logged for all actions performed within the elevated access duration plus an additional 1 hour.
{: .note}
