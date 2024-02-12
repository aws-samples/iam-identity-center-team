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

## If upgrading to v1.1.1 (Custom Domain)
TEAM v1.1.1 introduces the use of custom domain instead of the default amplify generated domain name.
To use a custom domain, ensure to update the **parameters.sh** in the **deployment** folder with **UI_DOMAIN** key and your custom domain name before running the **./update.sh** script.

Follow the steps below to integrate your custom domain with amplify once the update deployment is complete.

### Custom domain integration (If Using Custom Domain)
Go to Amplify console: AWS AMPLIFY → All Apps → TEAM-IDC-APP → Domain Management → Add domain.
Follow https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html

Execute the **integration.sh** script and update the applicationstartURL in AWS IAM Identity Center

Execute the **cognito.sh** script 

> Ensure your custom domain is reflected in  Allowed Callback URLs and Allowed sign-out URLs 
Amazon Cognito → User pools → $(User Pool Name) → App Integration → $(ClientWeb) → HostedUI


## Verify app deployment
Go to Amplify console: **AWS Amplify -> All apps -> TEAM-IDC-APP -> Hosting environments**. On the **Hosting environments** tab, click on the application URL to confirm that it was deployed successfully and you can access the TEAM application landing page as shown in the video below:

<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/deployment/successful_app_deployment.mov" type="video/mp4">
</video>

{: .no_toc}