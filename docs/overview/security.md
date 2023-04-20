---
layout: default
title: Security
nav_order: 4
parent: Solution overview
---

# Security considerations

The TEAM solution controls access to your AWS environment and must be treated with extreme care in order to prevent unauthorized access. Special care should be taken to protect the integrity of the solution code and configuration.

TEAM solution workflow operates by attaching and removing permission set from a user entity within the duration of the requested elevated access. AWS IAM Identity Center does not currently support instant control-plane revocation of active user sessions. Therefore, permission set session duration should be configured as the default **1 hour** in IAM Identity Center.

While most of the services that the TEAM app leverages are highly available by default, Amazon Cognito and AWS IAM Identity Center are Regional services. This does indicate that if the service were to go down in the deployed Region, you could not architect this app to have failover to another Region for full support today.

The TEAM solution is not a replacement for proper Identity and Access management. While it has delegated access to manage your AWS IAM Identity Center environment, it does not ensure proper configurations or access controls are implemented; nor does it assume proper controls and configuration of the roles you enable users to request within the TEAM app. Please familiarize yourself with the SLA and product pages for the leveraged AWS services for more information.

In order to ensure the security of this applications proper access controls to its resources must be maintained. If unintended access is granted to users the risk of prolonged or elevated access increases. No user should be able to approve their own requests in order to prevent self elevated access.

## IAM Roles