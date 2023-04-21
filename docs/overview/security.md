---
layout: default
title: Security
nav_order: 4
parent: Solution overview
---

# Security considerations

## Access control
The TEAM solution controls access to your AWS environment and must be treated with extreme care in order to prevent unauthorized access. Special care should be taken to protect the integrity of the solution code and configuration.

## Elevated access and session duration
TEAM solution workflow operates by attaching and removing permission set from a user entity within the duration of the requested elevated access. The duration specified in a request determines the time window for which elevated access is active, if the request is approved. During this time window, the requester can invoke sessions to access the AWS target environment. It does not affect the duration of each session. Session duration is configured independently for each permission set by an IAM Identity Center administrator, and determines the time period for which IAM temporary credentials are valid for all sessions using that permission set. Be aware that sessions invoked just before elevated access ends will remain valid beyond the end of the elevated access period. Consider minimizing the session duration configured in your permission sets, for example by setting them as the default **1 hour** in IAM Identity Center.

## Availability
While most of the services that the TEAM app leverages are highly available by default, Amazon Cognito and AWS IAM Identity Center are regional services. TEAM's dependence on these regional services indicates that it cannot be used as a break glass solution for granting temporary access to your AWS environment in the event of a failure of the region where your IAM Identity center is deployed.

## Identity and access management
The TEAM solution is not a replacement for proper Identity and Access management. While it has delegated access to manage your AWS IAM Identity Center environment, it does not ensure proper configurations or access controls are implemented; nor does it assume proper controls and configuration of the roles you enable users to request within the TEAM app. Please familiarize yourself with the SLA and product pages for the leveraged AWS services for more information.