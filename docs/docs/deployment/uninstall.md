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
- Deletes the CodeCommit repository for the TEAM application (unless the **parameters.sh** file has a SECRET_NAME parameter.)

  > Ensure that the named profile for the **TEAM Deployment account** has sufficient permissions before executing the **destroy.sh** script

Execute the following command in the root directory to deploy the script

```
cd deployment
./destroy.sh
```
Once the **destroy.sh** script is complete, monitor the Cloudformation UI for the deletion status of the backend stack to ensure the backend end resources are deleted and cleaned up properly.
  > This process does not remove existing permission policy templates or delegated admin configuration in order to prevent negatively impacting your environment if utilized outside of TEAM. AWS recommends following your existing internal review process to address these assets.
  {: .note}


## Delete TEAM app in IAM Identity center
Follow the steps below to delete TEAM as a SAML application in IAM Identity Center:

- In AWS IAM Identity Center console >**Application assignment** > **Applications** > **Applications**. Choose the tab **Configured**

- Select the TEAM application and from the **Actions** drop-down menu, choose **Remove**

<img src="https://d3f99z5n3ls8r1.cloudfront.net/images/destroy_app.png" alt="IdC App Uninstall">

## Delete Amplify deployment artifacts S3 bucket
The Amplify deployment S3 bucket has versioning enabled. As such you cannot empty or delete the bucket using the AWS CLI.

The format of the amplify s3 bucket name is **amplify-teamidcapp-main-xxxx-deployment**

[Empty](https://docs.aws.amazon.com/AmazonS3/latest/userguide/empty-bucket.html) and [delete](https://docs.aws.amazon.com/AmazonS3/latest/userguide/delete-bucket.html) the Amplify S3 bucket using the s3 console.
