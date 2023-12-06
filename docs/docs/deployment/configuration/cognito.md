---
layout: default
title: Cognito configuration
nav_order: 3
parent: Configuration
grand_parent: Solution deployment
---

# Cognito user pool configuration

The TEAM Cognito user pool configuration needs to be updated to complete the deployment process and make the TEAM application accessible via the AWS IAM Identity Center sign-in portal.

### Update configuration parameters

- Create a new file named **details.json** in the **deployment** directory. 
- Copy the contents of the file **details-template.json** to the new file. 
- Replace the **MetadataURL** in the **details.json** file with the value of **AWS IAM Identity Center SAML metadata file URL** copied from the [previous section]({% link docs/deployment/configuration/idc.md %}).

For example:

```json
{
    "MetadataURL": "https://portal.sso.us-east-1.amazonaws.com/saml/metadata/ODQzNTUxMTgwNTcyX2lucy04NGM3MThiMzkyY2Y2YTM1"
}
```

### Run Cognito configuration script
The **cognito.sh** bash script in the **deployment** folder performs the following actions within the **TEAM_ACCOUNT**:

- Configures AWS IAM Identity Center as a SAML provider for the TEAM Cognito user pool
- Updates the TEAM application client configuration to make use of the configured AWS IAM Identity Center SAML provider

> Ensure that the named profile for the **TEAM Deployment account** has sufficient permissions before executing the **cognito.sh** script
{: .important}

Execute the following command in the root directory to deploy the script

```sh
cd deployment
./cognito.sh
```
The **cognito.sh** script should be deployed successfully without any errors.

The application deployment, configuration and integration is now complete! The users can log into the TEAM application via the [Identity Center access portal](https://docs.aws.amazon.com/singlesignon/latest/userguide/using-the-portal.html), as shown below. 
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/deployment/finished_config.mov" type="video/mp4">
</video>

The TEAM administrators can now configure your organization-specific policies and settings for requesting and granting elevated access.
{: .no_toc}
### 🚀 Next Step: Set up [Eligibility & Approval Policies]({% link docs/deployment/configuration/policies.md %}) to start using TEAM.
{: .no_toc}
