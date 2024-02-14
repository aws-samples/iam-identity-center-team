---
layout: default
title: Update
nav_order: 5
parent: Solution deployment
---

# Update TEAM solution

Ensure that the **parameters.sh** in the **deployment** folder is up to date before updating the TEAM solution
{: .note}

Run the **update.sh** bash script in the **deployment** folder to update the TEAM application to the latest version.

The **update.sh** bash script performs the following actions:

- Adds the AWS samples github repo as a git remote
- Pulls the latest version of the TEAM code
- Push the latest version to the TEAM code commit repo which triggers the amplify build and deployment 
- Removes the AWS samples github repo as a git remote

  > Ensure that the named profile for the **TEAM Deployment account** has sufficient permissions before executing the **update.sh** script

Execute the following command in the root directory to deploy the script

```
cd deployment
./update.sh
```

Once the upgrade script has completed execution, go to the AWS Amplify console to monitor the status of the TEAM application build and deployment.

## If upgrading to v1.1.2 (Cloudformation import fixes)

This version changes how the SNS Notification Arn is passed in order to unblock Issue #152. Deploying this version requires a few manual steps:

Three cloudformation stacks will need to be manually updated before running the update.sh script to trigger an amplify deployment.

You can list these stacks using the AWS CLI like shown below:

aws cloudformation list-imports --export-name NotificationTopicArn
{
    "Imports": [
        "amplify-teamidcapp-main-180021-customstepfunctions-SDFGSFGYHSFTUY",
        "amplify-teamidcapp-main-180021-functionteamRouter-SFGHSFGSDFG",
        "amplify-teamidcapp-main-180021-functionteamNotifications-SDFGSDFGSDFH"
    ]
}

You can find the corresponding cloudformation template json in the ./amplify/backend/custom and ./amplify/backend/function directories.

When updating the stacks, you'll have to specify a new Parameter customsnsNotificationTopicArnOutput. You can obtain the value using the AWS CLI:

aws cloudformation list-exports --query 'Exports[?Name==`NotificationTopicArn`]' 
[
    {
        "ExportingStackId": "arn:aws:cloudformation:us-east-2:123412341234:stack/amplify-teamidcapp-main-180021-customsns-T20ZX7BMXSWW/8b79b450-bed3-11ee-b95d-0a1a1cd14f73",
        "Name": "NotificationTopicArn",
        "Value": "arn:aws:sns:us-east-2:123412341234:TeamNotifications-main"
    }
]

You should now be able to run deploy/update.sh to deploy the application normally

## If upgrading to v1.1.1 (Custom Domain)
> This step is optional and required only if you intend to use a custom domain for your TEAM deployment instead of the default amplify generated domain name.

TEAM v1.1.1 introduces the use of custom domain instead of the default amplify generated domain name.
To use a custom domain, ensure to update the **parameters.sh** in the **deployment** folder with **UI_DOMAIN** key and your custom domain name before running the **./update.sh** script.

Follow the steps below to integrate your custom domain with amplify once the update deployment is complete.

### Custom domain integration (If Using Custom Domain)

Go to Amplify console: AWS AMPLIFY → All Apps → TEAM-IDC-APP → Domain Management → Add domain.
![custom](../assets/images/custom.png)

Follow instructions in Amplify documentation for more details on [setting up custom domains](https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html)

Execute the **integration.sh** script and update the applicationstartURL in AWS IAM Identity Center for your TEAM application

Execute the **cognito.sh** script 

> Ensure your custom domain is reflected in  Allowed Callback URLs and Allowed sign-out URLs 
Amazon Cognito → User pools → $(User Pool Name) → App Integration → $(ClientWeb) → HostedUI


## Verify app deployment
Go to Amplify console: **AWS Amplify -> All apps -> TEAM-IDC-APP -> Hosting environments**. On the **Hosting environments** tab, click on the application URL to confirm that it was deployed successfully and you can access the TEAM application landing page as shown in the video below:

<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/deployment/successful_app_deployment.mov" type="video/mp4">
</video>

{: .no_toc}