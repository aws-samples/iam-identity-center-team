---
layout: default
title: Administrator guide
nav_order: 3
parent: Guides
---

# Administrator Guide
{: .no_toc}

<details open markdown="block">
  <summary>
    Table of contents
  </summary>
  {: .text-delta }
- TOC
{:toc}
</details>

Before TEAM application can be used fully, an administrator is required to configure eligibility and approver policies.

> The *Administration* section in the navigation menu is not visible when logging in as a TEAM admin for the first time. This is due to user and group synchronization between Identity Center and Cognito. The *Administration* section becomes visible upon subsequent logins.
{: .note}

[What are eligibility & approver policies?]({% link docs/deployment/configuration/policies.md %}){: .btn .btn-outline }
## Configure eligibility policy

1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Eligibility policy*.
3. Click on *Create eligibility policy* or tick the eligibility policy you would like edited and choose *Actions* &rarr; *Edit*.
4. Choose an entity type: either *User* or *Group*. This will auto-populate the form with users/groups from Identity Center.
5. In the dropdown, tick all the users/groups relevant to the eligibility policy.
6. Provide a *Ticket No*, used for issue-tracking purposes.
7. In the dropdowns, tick all the *Accounts* and/or *OUs* that the specified users/groups should be allowed to request temporary elevated access to.
   > Where an eligibility policy specifies an OU, TEAM includes all the AWS accounts directly in that OU. It does not include those in its child OUs.
    {: .note}
8. In *Permissions* dropdown, select all the permission sets that users/groups should be allowed to request for accounts/OUs.
   > TEAM cannot be used to perform the following tasks:
    - Grant temporary access to the management account
    - Manage permission sets provisioned in the management account
    Read the [security considerations]({% link docs/overview/security.md %}) section for more information.
    {: .note}
9. Specify a *Max duration* in hours that can be requested by an entity.
  > If a user belongs to multiple groups with different policies, the effective *max duration* is the maximum value across the policies
10. Use *Approval required* tickbox to specify if approval is required or not for elevated access requested. Note: This configuration is disregarded if the approval workflow is disabled globally in the TEAM settings.
  > If a user belongs to multiple groups with different policies, an approval required policy will take precedence over an approval not required policy.
10. Click on *Add eligibiliy policy*.

### Eligibility policy configuration demo
{: .no_toc}
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/admin_guides/eligibility_policy.mov">
</video>

## Configure approver policy

1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Approver policy*.
3. Click on *Create approver policy* or tick the approver policy you would like edited and choose *Actions* &rarr; *Edit*.
4. Choose an entity type: either *Account* or *OU*. This will auto-populate the form with the available accounts and OUs.
5. In the dropdown, tick the accounts/OUs relevant to this approver policy.
6. Provide a *Ticket No*, used for issue-tracking purposes.
7. In *Approver Groups* tick the Identity Centre group whose users should be allowed to approve temaporary elevated access requests for the accounts/OUs.
8. Click *Add approver policy*.

### Approver policy configuration demo
{: .no_toc}
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/admin_guides/approver_policy.mov">
</video>

## Configure TEAM Settings

### TEAM application settings
{: .no_toc}
An administrator can configure global TEAM application settings, such as:
- TEAM permissions
  - **TEAM admin group**: Deteremines the group of users who can administer the TEAM application.
  - **TEAM auditor group**: Determines the group of users who can audit access request activity in TEAM.
- Request settings
  - **Approval workflow**: Determines if eligibility policies can require request approval.
    > If this setting is disabled, approval will not be required for elevated access if the requester is eligible.
  - **Require justification**: Determines if the **justification** input form field is mandatory when creating a TEAM elevated access request.
  - **Require ticket number**: Determines if users are required to provide a ticket number for issue tracking when making an elevated access request or configuring admin policies.
  - **Maximum request duration**: Determines the maximum elevated access duration in hours (between 1-8000 hours / ~ 1 year) that can be requested by all users.
    > The maximum request duration configured in an eligibility policy for an entity (user or group) overrides this setting.
  - **Request expiry timeout**: Determines how long a TEAM request remains in the pending state. If the request is not approved/rejected by an approver in this time, the request expires and will need to be resubmitted. Default expiry timeout is ***3 hours***
- Notification settings
  - **Send email notifications**: Determines if email notifications via Amazon SES are enabled.
    - **Source email**: Determines the source email address.
    - **Source ARN** (Optional): If using an SES identity in an AWS account other than the TEAM deployment account, provide the ARN of the identity here. SES must be configured to allow the TEAM deployment account to send mail using this identity.
- **Send SNS notifications**: Determines if notifications via Amazon SNS are enabled.
- **Send Slack notifications**: Determines if notifications via Slack are enabled.
  - **Slack OAuth token**: If using Slack notifications, sets the token giving TEAM permission to your Slack workspace as a bot user.

### Step-by-step
{: .no_toc}
1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Settings*.
3. Review the settings displayed and click *Edit* in the top right.
4. Make changes to the parameters displayed (outlined above).
5. Click *Submit*.

### Request settings demo
{: .no_toc}
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/admin_guides/admin_settings.mov">
</video>

## OU account cache management

Due to limits on AWS Organizations APIs TEAM caches the mapping of accounts to organizational units (OUs) to improve performance when loading the list of accounts that a user can request access for. This section explains how to manage the cache behavior and manually invalidate cache entries when needed.

### Cache behavior feature flag

Administrators can control whether TEAM uses cached OU account data or queries AWS Organizations API directly:

1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Settings*.
3. Choose **Edit** to modify settings.
4. Scroll to the **OU account cache** toggle.
5. Toggle the setting:
   - **Enabled (cached)** - Uses cached OU account data for faster loading. Cache entries expire after 1 week by default (configurable via `CACHE_TTL` deployment parameter).
   - **Disabled (direct API)** - Queries AWS Organizations API directly. May be slower and subject to API throttling in large organizations where eligibility is mapped to OUs.
6. Choose **Submit** to save changes.

> **Note:** The cache is disabled by default. 

### Manual cache invalidation

If the state of accounts changes within an existing OU (added or removed) the cache will need to first be invalidated otherwise it will show an innacurate list of accounts to users. TEAM provides a way to manually do this in the UI. 
For organizations with frequent or automated account changes (creation, deletion, move between OUs) it's recommended to add a cache clearing component to your automation. 

Instructions to invalidate an entry:

1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Settings*.
3. Scroll to the **OU Cache Management** section.
4. Enter one or more OU IDs in the text box (one per line or comma-separated).
   - OU IDs have the format: `ou-xxxx-xxxxxxxx`
   - Example: `ou-1234-12345678`
5. Choose **Invalidate Cache**.
   > The cache will be repopulated automatically the next time those OUs are accessed.

> **Tip:** You can find OU IDs in the AWS Organizations console or by using the AWS CLI command: `aws organizations list-organizational-units-for-parent --parent-id <root-or-parent-ou-id>`

