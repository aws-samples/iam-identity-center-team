---
layout: default
title: Policy configuration
nav_order: 4
parent: Configuration
grand_parent: Solution deployment
---
# Policy configuration
{: .no_toc}

Before users can request temporary elevated access in TEAM, a user with the **admin** persona needs to set up the application. This includes defining eligibility and approval policies. A user takes on the **admin** persona if they are a member of the **TEAM admin** Identity Center group specified during TEAM deployment.
{: .important}

Refer to the [policy overview]({% link docs/overview/policies.md %}) section for more information on TEAM policies 

## Eligibility policy configuration

**Eligibility policies** determine who can request temporary elevated access with a given scope. You typically define eligibility policies to allow specific people in specific teams to request temporary elevated access that you anticipate they will need to perform operational tasks as part of their job function.

[Configuring eligibility policy]({% link docs/guides/admin.md %}){: .btn .btn-outline }

## Approver policy configuration

**Approver policies** work in a similar way to eligibility policies, except they authorize users to approve temporary elevated access requests, rather than create them.

[Configuring approval policy]({% link docs/guides/admin.md %}){: .btn .btn-outline }

Now that the admin persona has defined eligibility and approval policies, TEAM is ready for use.

### 🚀 Next Steps: Configure [notifications]({% link docs/deployment/configuration/notifications.md %}).
{: .no_toc}