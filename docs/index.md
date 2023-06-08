---
title: About
layout: about
nav_order: 1
---
IAM Identity Center
{: .fs-2 .mt-0 .mb-0 .text-right}
# Temporary elevated access management (TEAM)
{: .fs-7 .fw-700 .mt-0 .mb-0}

Automated, approval based workflow for managing time-bound elevated access to your multi-account AWS environment
{: .fs-2 .fw-300}

<span class="fs-4">
[Get started]({% link docs/deployment/index.md %}){: .btn .btn-purple }
</span>
<span class="fs-4">
[View on GitHub](https://github.com/aws-samples/iam-identity-center-team){: .btn }
</span>

TEAM is an open source solution that integrates with AWS IAM Identity Center and allows you to manage and monitor time-bound elevated access to your multi-account AWS environment at scale.

The solution is a custom application that allows users to request access to an AWS account only when it is needed and only for a specific period of time. Approvers can review requests before deciding whether to grant access. Once the time period has elapsed, elevated access is automatically removed.

<video width="800" height="500" frameborder="0" autoplay loop allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/requestor_guides/create_request.mov" type="video/mp4">
</video>

## Benefits
Temporary elevated access management (TEAM) enables organizations to implement the principle of least privilege in a more effective and granular way, reducing the need for persistent, always-on access. By providing temporary access, organizations can ensure that users are only given access to resources when they need it and for the minimum amount of time required, thereby reducing the risk of unauthorized access and improving overall security posture.

## Features
- **Ease of deployment** -  Straightforward deployment with [AWS Amplify](https://aws.amazon.com/amplify/).
- **Centralized management** - Centralized management console for creating, approving, managing and monitoring elevated access requests.
- **Rich authorization model** - Enhanced application security with [Amazon Cognito](https://aws.amazon.com/cognito/) group-based authorization and SAML Integration with [AWS IAM Identity Center](https://aws.amazon.com/iam/identity-center/).
- **Ability to use managed user identities and groups**. User identities, groups, and group memberships can be managed directly in IAM Identity Center or synced from an external identity provider into IAM Identity Center, which allows you to use your existing access governance processes and tools.
- **Auditing and visibility** - Session logs recording enables auditing and easy correlation of elevated request justification with session activity.
- **Monitoring and Reporting** - Single dashboard for centralized monitoring and reporting of all elevated access request and approval history.
- **Alert and notification** - Automatic notification of TEAM request, approval and session status.
- **Solution autonomy** - TEAM solution is agnostic and has no dependence on third party integrations with external applications or identity providers.

## Security and resiliency considerations
Review the [security and resiliency considerations]({% link docs/overview/security.md %}) section before deploying the TEAM solution.

## Getting started
The best way to get started with TEAM is to [deploy the solution]({% link docs/deployment/index.md %}) in your environment and follow the [end-to-end example scenario]({% link docs/guides/walkthrough.md %}) which will take you through all functionalities from requesting access to auditing the session logs.

## Authors
TEAM was created by [Taiwo Awoyinfa](https://github.com/tawoyinfa) and has been enhanced with major contributions from [Varvara Semenova](https://github.com/astrovar) and [James Greenwood](https://github.com/jmsgwd) and technical inputs from [Jeremy Ware](https://github.com/Hero104FH) and [Abhishek Pande](https://github.com/ahpande).

#### Additional contributors can be seen on GitHub.

<ul class="list-style-none">
{% for contributor in site.github.contributors %}
  <li class="d-inline-block mr-1">
     <a href="{{ contributor.html_url }}"><img src="{{ contributor.avatar_url }}" width="32" height="32" alt="{{ contributor.login }}"></a>
  </li>
{% endfor %}
</ul>

## License

Temporary Elevated Access Management (TEAM) is distributed by an [MIT-0 License](https://github.com/aws-samples/aws-iam-identity-center-temporary-elevated-access-management/blob/main/LICENSE).

## Contributing
Thank you for your interest in contributing to our project. Whether it's a bug report, new feature, correction, or additional documentation, we greatly value feedback and contributions from our community.

Please read through [this document](https://github.com/aws-samples/iam-identity-center-team/blob/main/CONTRIBUTING.md#contributing-guidelines) before submitting any issues or pull requests to ensure we have all the necessary information to effectively respond to your bug report or contribution.

## Code of Conduct
This project has adopted the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct).
For more information see the [Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact
opensource-codeofconduct@amazon.com with any additional questions or comments.
