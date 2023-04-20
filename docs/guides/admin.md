---
layout: default
title: Admin guides
nav_order: 3
parent: Guides
---

# Administrator Guides
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

[What are eligibility & approver policies?]({% link docs/deployment/configuration/policies.md %}){: .btn .btn-outline }
## Configure Eligibility Policies

1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Eligibility policy*.
3. Click on *Create eligibility policy* or tick the eligibility policy you would like edited and choose *Actions* &rarr; *Edit*. 
4. Choose an entity type: either *User* or *Group*. This will auto-populate the form with users/groups from Identity Centre.
5. In the dropdown, tick all the users/groups relevant to the eligibility policy.
6. Provide a *Ticket No*, used for issue-tracking purposes.
7. In the dropdowns, tick all the *Accounts* and/or *OUs* that the specified users/groups should be allow to request temporary elevated access to.
   > Where an eligibility policy specifies an OU, TEAM includes all the AWS accounts directly in that OU. It does not include those in its child OUs.
    {: .note}
8. In *Permissions* dropdown, select all the permission sets that users/groups should be allowed to request for accounts/OUs.
   > You can either use a predefined permission set provided by Identity Center, or you can create your own permission sets using custom permissions in order to provide least-privilege access for particular operational tasks.
   {: .note}
9. Use *Approval required* tickbox to specify whether the requests specified by the elgibility policy require approval.
10. Click on *Add eligibiliy policy*.

### Eligibility policies demo
{: .no_toc}
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/admin_guides/eligibility_policy.mov">
</video>

## Configure Approver Policies

1. Log into the application as TEAM admin.
2. In the left-hand menu go to *Administration* &rarr; *Approver policy*.
3. Click on *Create approver policy* or tick the approver policy you would like edited and choose *Actions* &rarr; *Edit*.
4. Choose an entity type: either *Account* or *OU*. This will auto-populate the form with the available accounts and OUs.
5. In the dropdown, tick the accounts/OUs relevant to this approver policy.
6. Provide a *Ticket No*, used for issue-tracking purposes.
7. In *Approver Groups* tick the Identity Centre group whose users should be allowed to approve temaporary elevated access requests for the accounts/OUs.
8. Click *Add approver policy*.
### Approver policies demo
{: .no_toc}
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/admin_guides/approver_policy.mov">
</video>

## Change Request Settings

### Available request settings
{: .no_toc}
Administrator can adjust the overall TEAM application request settings, such as:
- Timer settings
  - **Maximum request duration**: What is the longest duration of elevated access that can be requested by the users.
  - **Request expiry timeout**: How long does the request remain active for. If the requets is not approved/rejected by an approver in this time, the request expires and will need to be resubmitted.
- Mandatory fields
  - **Comments required**: Are the users required to provide a comment explaining why they require elevated access.
  - **Ticket number required**: Are the users required to provide a ticket number for issue tracking when making an elevated access request.
- Workflow settings
  - **Approval required**: Are the approvals required fo elevated access request by default.
    > Approval requirement is also specified as a part of the eligibility policy. CLARIFY 

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

