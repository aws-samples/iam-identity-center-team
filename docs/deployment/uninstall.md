---
layout: default
title: Uninstall
nav_order: 6
parent: Solution deployment
---

# Uninstall TEAM solution

Run the **destroy.sh** bash script in the **deployment** folder to uninstall the TEAM application and delete all backend resources.

The **destroy.sh** bash script performs the following actions within the **TEAM_ACCOUNT**:

- Deletes the Amplify backend Cloudformation stack
- Deletes the Amplify App Cloudformation stack
- Deletes the CodeCommit repository for the team application
- Deletes Amplify deployment artifacts S3 bucket

  > Ensure that the named profile for the **TEAM Deployment account** has sufficient permissions before executing the **destroy.sh** script

Execute the following command in the root directory to deploy the script

```
cd deployment
./destroy.sh
```
Once the **destroy.sh** script is complete, monitor the Cloudformation UI for the deletion status of the backend stack  to ensure the backend end resources are deleted and cleaned up properly.

Once the cloudformation stack has been deleted, remove the TEAM APP from Identity Center. Follow the steps below to remove the TEAM application from AWS IAM Identity Center:

In AWS IAM Identity Center console >**Application assignment** > **Applications** > **Applications**. Choose the tab **Configured**

- Select the TEAM application and from the **Actions** drop-down menu, choose **Remove**

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/destroy_app.png" alt="IdC App Uninstall">