---
layout: default
title: Prerequisites
nav_order: 2
parent: Solution deployment
---

# Prerequisites & Setup

## Prerequisites

- [AWS Organizations](https://aws.amazon.com/organizations/) managed multi account environment with [AWS IAM Identity Center](https://aws.amazon.com/iam/identity-center/) federated account access
  > TEAM cannot be used to perform the following task:
    - Grant temporary access to the management account 
    - Manage permission sets provisioned in the management account
    Read the [security considerations]({% link docs/overview/security.md %}) section for more information.
    {: .note}
- [Permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html) configured in IAM Identity center.    
  > You can either use a predefined permission set provided by Identity Center, or you can create your own permission sets using custom permissions in order to provide least-privilege access for particular operational tasks.
   {: .note}
- Dedicated AWS account for deploying TEAM Application
  > As per AWS best practice, it is not recommended to deploy resources in the organization management account. Designate a dedicated account for deploying the TEAM solution.
  {: .note}
- Create groups within AWS IAM Identity center for **TEAM admins** and **TEAM auditors**. These groups can be created locally (In Identity center) or synchronised from an external identity provider following your organisation's group membership review and attestation process   
-  Enable Amazon SES in the **TEAM deployment account**. For production use case, move SES account out of **sandbox mode**  - [Moving out of the Amazon SES sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- Designate a verified email address in Amazon SES for originating approval and TEAM workflow notifications - [Verifying identities in Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html)
  > For testing and if your SES account is in sandbox mode, make sure all requester, approver and notification email addresses are verified in SES otherwise TEAM notification would not function as expected.
  {: .note}

## Development environment setup
- Setup [awscli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and install [git-remote-codecommit](https://docs.aws.amazon.com/codecommit/latest/userguide/setting-up-git-remote-codecommit.html) on local workstation

- Install [jq](https://github.com/stedolan/jq/wiki/Installation) on local workstation

- Setup [named profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html) for AWS CLI with sufficient permissions for the **Organisation management account**

- Setup named profile for AWS CLI with sufficient permissions for the **AWS account where the TEAM Application would be deployed in**

### 🚀 You can now [Deploy the Application]({% link docs/deployment/deployment_process.md %}).
