---
layout: default
title: Deployment
nav_order: 3
parent: Solution deployment
---

# Deployment Process
{: .no_toc}

<details open markdown="block">
  <summary>
    Table of contents
  </summary>
  {: .text-delta }
- TOC
{:toc}
</details>

--- 

## Clone TEAM CodeCommit repo
To clone the TEAM amplify fullstack project, execute the following command inside an empty directory

```sh
git clone https://github.com/aws-samples/aws-iam-identity-center-temporary-elevated-access-management.git
```

This creates a directory named **team-idc-app** in your current directory.

--- 

## Update deployment parameters

Update the parameters in the **parameters.sh** file in the **deployment** folder of the application root directory

**Parameters**

- **EMAIL_SOURCE** - Verified Email address for originating TEAM notifications
- **IDC_LOGIN_URL** - AWS IAM Identity Center Login URL
- **REGION** - AWS region where the application will be deployed. 
    > This must be the same region AWS IAM Identity Center is deployed in
    {: .important}
- **TEAM_ACCOUNT** - ID of AWS Account into which TEAM application will be deployed
- **ORG_MASTER_PROFILE** - Named profile for Organisation master account
- **TEAM_ACCOUNT_PROFILE** - Named profile for TEAM Application deployment Account

For example:

```sh
EMAIL_SOURCE=notification@team.awsapps.com
IDC_LOGIN_URL=https://d-12345678.awsapps.com/start
REGION=us-east-1
TEAM_ACCOUNT=123456789101
ORG_MASTER_PROFILE=OrgMAsterProfileName
TEAM_ACCOUNT_PROFILE=TeamAccountProfileName
TEAM_ADMIN_GROUP=team_admin_group_name
TEAM_AUDITOR_GROUP=team_auditor_group_name
```

--- 

## Run Initialisation Script
The **init.sh** bash script in the **deployment** folder configures the following prerequisites required for deploying the TEAM application within the **Organisation Management account** :

- Configures the **TEAM_ACCOUNT** as a delegated admin for account management
- Configures the **TEAM_ACCOUNT** as a delegated admin for cloudtrail management
- Configures the **TEAM_ACCOUNT** as a delegated admin for AWS IAM Identity Center Management
  > Ensure that the named profile for the **Organisation Management account** has sufficient permissions before executing the **init.sh** script
  {: .note}

Execute the following command in the root directory to deploy the script

```sh
$ cd deployment
$ ./init.sh
```

If the init.sh script is deployed successfully, the output should be similar as shown below

```
$ 123456789101 configured as delegated Admin for AWS Account Manager
$ 123456789101 configured as delegated Admin for cloudtrail
$ 123456789101 configured as delegated Admin for IAM Identity Center
```

--- 

## Run Deployment Script
The **deploy.sh** bash script in the **deployment** folder performs the following actions within the **TEAM_ACCOUNT** :

- Creates a CodeCommit repository and copies the TEAM application directory content to the repository.
- Deploys a cloudformation template that creates an amplify hosted application and CI/CD pipeline for deploying the TEAM application.

> Ensure that the named profile for the **TEAM Deployment account** has sufficient permissions before executing the **deploy.sh** script
{: .note}

Execute the following command in the root directory to deploy the script

```sh
$ cd deployment
$ ./deploy.sh
```

Once the deployment script is complete and the cloudformation stack is created successfully, go to the AWS Amplify console to monitor the status of the TEAM application deployment.

> It takes about 20 mins to complete the build and deployment of the Amplify application stack
{: .note}

## Verify app deployment
Go to Amplify console: **AWS Amplify -> All apps -> TEAM-IDC-APP -> Hosting environments**. On the **Hosting environments** tab, click on the application URL to confirm that it was deployed successfully and you can access the TEAM application landing page as shown in the video below:

<video width="750" height="420" frameborder="0" autoplay loop allowfullscreen>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/deployment/successful_app_deployment.mov">
</video>


### 🚀 Next Step: [Configure TEAM Application]({% link docs/deployment/configuration/index.md %})
{: .no_toc}