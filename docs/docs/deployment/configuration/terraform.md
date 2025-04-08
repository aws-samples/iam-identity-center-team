---
layout: default
title: Terraform
nav_order: 8
parent: Configuration
grand_parent: Solution deployment
---

# IAM Identity Center Configuration with Terraform

You must perform the following configuration steps to start configuring TEAM using Terraform:
1. [Configuration Prerequisites]({% link docs/deployment/configuration/index.md %})
2. [Configure Cognito Machine Authentication]({% link docs/deployment/configuration/cognito_machine_auth.md %})

### Using the Terraform Provider

Explore the community-supported [Terraform provider designed for awsteam](https://registry.terraform.io/providers/awsteam-contrib/awsteam/latest), enabling seamless configuration management through Terraform. Machine authentication credentials are required to use the provider.

> The Terraform provider is maintained independently of the aws-samples community, and the TEAM authors do not assume responsibility for its maintenance.
{: .important}
