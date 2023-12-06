---
layout: default
title: Identity center integration
nav_order: 2
parent: Configuration
grand_parent: Solution deployment
---

# IAM Identity Center Integration


The TEAM application needs to be onboarded as a SAML 2.0 application on AWS IAM Identity Center before it can be fully accessed.


## SAML Configuration Parameters

The following parameters will be required for configuring the TEAM application as a SAML app in AWS Identity Center:

- **applicationStartURL** - AWS IAM Identity Center application properties configuration settings

- **applicationACSURL** - AWS IAM Identity Center application metadata configuration settings

- **applicationSAMLAudience** - URN for the AWS Cognito user pool ID for the TEAM application

The **integration.sh** bash script in the **deployment** folder can be used to obtain the SAML configuration parameters:

Execute the following command in the root directory to deploy the **integration.sh** script:

```sh
cd deployment
./integration.sh
```

The result should be similar to the below:

```sh
applicationStartURL: https://d1s8z5724fsfj7-main.auth.amazoncognito.com/authorize?client_id=2vf6faj4v3t1jdos0misu29i67&response_type=code&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=https://main.d1s8z5724fsfj7-.amplifyapp.com/&idp_identifier=team
applicationACSURL: https://d1s8z5724fsfj7-main.auth.amazoncognito.com/saml2/idpresponse
applicationSAMLAudience: urn:amazon:cognito:sp:us-east-1_GXaUCfcno
```

---

## Configure IAM Identity Center SAML Integration

Follow the steps below to integrate the TEAM application with AWS IAM Identity Center as a SAML application:

In AWS IAM Identity Center console > **Application assignment** > **Applications** > **Add application**

- Select **_Add custom SAML 2.0 Application_** and click on **_Next_**
- Type **TEAM IDC APP** as display name and add a description for the TEAM application under **Configure application** section.
- Copy and save the URL of **AWS IAM Identity Center SAML metadata file URL**. It would be used later for configuring Cognito User pool.
- Enter the value of **_applicationStartURL_** parameter in **_Application start URL_** under the **_Application properties_** section:

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/deployment/idc_app_prop.png" alt="IdC App Properties">

- In the **Application Metadata** section select **_Manually type your metadata values_**.
- Enter the value of **_applicationACSURL_** parameter in **Application ACS URL**.
- Enter the value of **_applicationSAMLAudience_** parameter in **Application SAML audience**.


<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/deployment/idc_app_meta.png" alt="IdC App Metadata">

Click **Submit** to save configuration.

## Configure Attribute Mapping

- Click the **_Actions_** dropdown and select **_Edit attribute mappings_** and add the following values

```
Subject - ${user:subject} - persistent
Email - ${user:email} - basic
```

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/deployment/attribute_mapping.png" alt="IdC Attribute Mapping">

Click **Save changes**


---

## Assign users or groups to TEAM application

Under **Assigned Users** Click the **_Assign users_** and add users. This will grant assigned users and groups access to login to the TEAM application.

> Remember to add the **team-admin** and **team-auditor** group to the team application in addition to other application users and groups
{: .important}

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/deployment/team_users.png" alt="IdC Assign Users">

---

{: .no_toc}
### 🚀 Next Step: [Update Cognito user pool configuration]({% link docs/deployment/configuration/cognito.md %})

{: .no_toc}
