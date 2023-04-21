---
title: About
layout: about
nav_order: 1
---
IAM Identity Center
{: .fs-2 .mt-0 .mb-0 .text-right}
# Temporary Elevated Access Management (TEAM)
{: .fs-7 .fw-700 .mt-0 .mb-0}

Automated, approval based workflow for managing time-bound elevated access to your multi-account AWS environment
{: .fs-2 .fw-300}

<span class="fs-4">
[Get started]({% link docs/deployment/index.md %}){: .btn .btn-purple }
</span>
<span class="fs-4">
[View on GitHub](https://github.com/aws-samples/iam-identity-center-team){: .btn }
</span>

TEAM is an open source solution that integrates with AWS IAM Identity Center and allows you to manage and monitor, time-bound elevated access to your multi-account AWS environment at scale.

The solution is a ready-to-deploy custom application that allows users to request access to an AWS account only when it is needed and only for a specific period of time. Once the time period has elapsed, elevated access is automatically removed.

<video width="800" height="500" frameborder="0" autoplay loop allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/requestor_guides/create_request.mov" type="video/mp4"> 
</video>

## Benefits
Temporary Elevated Access Management (TEAM) solution helps to:
- Simplify cloud access management
- Meet regulation and compliance requirements
- Reduce risk of breach or exposure
- Improve the security of AWS environment

## Features
- **Ease of deployment** - Simple one click, batteries included deployment with [AWS Amplify](https://aws.amazon.com/amplify/).
- **Centralized Management** - Centralized management console for creating, approving, managing and monitoring elevated access requests.
- **Application Security** - Enhanced application authentication with [Amazon Cognito](https://aws.amazon.com/cognito/) group-based authorization and SAML application Integration with AWS IAM Identity Center
- **Auditing and Visibility** - Session logs recording enables auditing and easy correlation of elevated request justification with session activity.
- **Monitoring and Reporting** - Single dashboard for centralized monitoring and reporting of all elevated access request and approval history
- **Alert and notification** - Automatic notification of TEAM request, approval and session status.
- **Solution Autonomy** - TEAM solution is agnostic and has no dependence on third party integrations with external applications or identity providers.

## Getting started
The best way to get started with TEAM is to [deploy the solution](./deployment/index.md) in your environment and follow the [end-to-end example scenario](./guides/walkthrough.md) which will take through all functionalities from requesting access to auditing the session logs.

## Authors
TEAM was created by [Taiwo Awoyinfa](http://example.com) and has been enhanced with major contributions from [Varvara Semenova](http://example.com) and [James Greenwood](http://example.com) and technical inputs from [Jeremy Ware](http://example.com) and [Abhishek Pande](http://example.com).

#### Thank you to the GitHub contributors of TEAM!

<ul class="list-style-none">
{% for contributor in site.github.contributors %}
  <li class="d-inline-block mr-1">
     <a href="{{ contributor.html_url }}"><img src="{{ contributor.avatar_url }}" width="32" height="32" alt="{{ contributor.login }}"></a>
  </li>
{% endfor %}
</ul>

## License

Temporary Elevated Access Management (TEAM) is distributed by an [MIT-0 License]([www.example.com](https://github.com/aws-samples/aws-iam-identity-center-temporary-elevated-access-management/blob/main/LICENSE)).

## Contributing
Thank you for your interest in contributing to our project. Whether it's a bug report, new feature, correction, or additional documentation, we greatly value feedback and contributions from our community.

Please read through [this document](https://github.com/aws-samples/aws-iam-identity-center-temporary-elevated-access-management/blob/main/CONTRIBUTING.md#security-issue-notifications) before submitting any issues or pull requests to ensure we have all the necessary information to effectively respond to your bug report or contribution.

## Code of Conduct
This project has adopted the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct).
For more information see the [Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact
opensource-codeofconduct@amazon.com with any additional questions or comments.
