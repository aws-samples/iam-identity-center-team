---
layout: default
title: Policy overview
nav_order: 3
parent: Solution overview
---
# TEAM Policies

{: .no_toc}

TEAM policies are configuration settings that define how the solution is utilised by an end user. They are managed by an [admin persona]({% link docs/overview/workflow.md %}). TEAM policies include **eligibility** and **approval** policies described below:

## Eligibility policy

**Eligibility policies** determine who can request temporary elevated access with a given scope. You typically define eligibility policies to ensure that people in specific teams can only request the access you anticipate they’ll need as part of their job function.

Each eligibility policy has five main parts:

- **Entity type and name**: A named Identity Center user or group
- **AWS accounts or OUs**: One or more AWS accounts and/or [AWS Organizations](https://docs.aws.amazon.com/organizations/) organizational units (OUs).
- **Permissions**: One or more Identity Center [permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html) (representing [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)).
- **Maximum duration**: Determines the maximum elevated access duration in hours (between 1 - 8000 hours / ~ 1 year) that can be requested by an entity.
- **Approval required**: Determines if approval is required for elevated access requested by an entity

Each eligibility policy allows the specified Identity Center user, or any member of the specified group, to log into TEAM and request temporary elevated access using the specified permission set(s) in the specified AWS account(s).

When choosing permission sets, you can either use a predefined permission set provided by Identity Center, or you can create your own permission sets using custom permissions in order to provide least-privilege access for particular operational tasks.

> Where an eligibility policy specifies an OU, TEAM includes all the AWS accounts directly in that OU. It does not include those in its child OUs.
{: .note}

## Approver policy

**Approver policies** work in a similar way to eligibility policies, except they authorize users to approve temporary elevated access requests, rather than create them.

An approval policy has two main parts:

- **Id, Name, and Type**: Identifiers for an account or OU 
- **Approver groups**: One or more IAM Identity Center groups


If a specific AWS account is referenced in an eligibility policy that is configured to require approval, then there must be a corresponding approval policy for the same account. If there is no corresponding approval policy - or if one exists but its groups have no members - then TEAM won’t allow users to request temporary elevated access to that account, because no-one can approve it. The exception to this is in the case that the approval required setting is turned off global in the TEAM settings.

Each approval policy allows a member of a specified group to log in to TEAM and approve temporary elevated access requests for the specified account, or all accounts under the specified OU.

> If you use the same group for both eligibility and approval, then it means approvers can be in the same team as requesters. This can be a valid approach, and is sometimes known as *peer approval*. In any case, **TEAM does not allow an individual to approve their own request**. If you prefer requesters and approvers to be in different teams, specify different groups for eligibility and approval.
{: .note}