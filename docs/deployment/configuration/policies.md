---
layout: default
title: Policy configuration
nav_order: 3
parent: Configuration
grand_parent: Solution deployment
---
# Policy configuration
{: .no_toc}

Before users can request temporary elevated access in TEAM, a user with the **admin** persona needs to set up the application. This includes defining eligibility and approval policies. A user takes on the **admin** persona if they are a member of a named Identity Center group that is specified during TEAM deployment.
{: .important}

## Eligibility policy configuration

**Eligibility policies** determine who can request temporary elevated access with a given scope. You typically define eligibility policies to allow specific people in specific teams to request temporary elevated access that you anticipate they will need to perform operational tasks as part of their job function.

To manage eligibility policies, in the left-hand menu go to *Administration* -> *Eligibility policies*.

~~As shown in the screenshot above,~~ each eligibility policy has three main parts:

- **Entity type and name**: A named Identity Center user or group
- **AWS accounts or OUs**: One or more AWS accounts and/or [AWS Organizations](https://docs.aws.amazon.com/organizations/) organizational units (OUs).
- **Permissions**: One or more Identity Center [permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html) (representing [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)).

You can also specify in each eligibility policy whether elevated access requests require approval or not.

Each eligibility policy allows the specified Identity Center user, or any member of the specified group, to log into TEAM and request temporary elevated access using the specified permission set(s) in the specified AWS account(s).

When choosing permission sets, you can either use a predefined permission set provided by Identity Center, or you can create your own permission sets using custom permissions in order to provide least-privilege access for particular operational tasks.

> Where an eligibility policy specifies an OU, TEAM includes all the AWS accounts directly in that OU. It does not include those in its child OUs.
{: .note}

## Approver policy configuration

**Approver policies** work in a similar way to eligibility policies, except they authorize users to approve temporary elevated access requests, rather than create them.

If a specific AWS account is referenced in an eligibility policy that is configured to require approval, then there must be a corresponding approval policy for the same account. If there is no corresponding approval group - or if there is an approval group, but it has no members - then TEAM won’t allow users to request temporary elevated access to that account, because no-one can approve it.

To manage approval policies, go to *Administration* -> *Approver policy*.

Each approval policy allows any member of the specified groups to log into TEAM and approve any temporary elevated access requests to the specified AWS account(s), **regardless of permission set**.

> If you use the same group for both eligibility and approval, then it means approvers can be in the same team as requesters. This is a valid approach, and is sometimes known as *peer approval*. In any case, **TEAM does not allow an individual to approve their own request**. If you prefer requesters and approvers to be in different teams, specify different groups for eligibility and approval.
{: .note}


Now that the admin persona has defined eligibility and approval policies, TEAM is ready for use.

### 🚀 Next Steps: Follow an [end-to-end TEAM walkthrough]({% link docs/guides/walkthrough.md %}).
{: .no_toc}