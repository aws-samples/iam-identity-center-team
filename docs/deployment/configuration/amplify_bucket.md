---
layout: default
title: Amplify Bucket configuration
nav_order: 1
parent: Configuration
grand_parent: Solution deployment
---

# Amplify bucket configuration

The TEAM Amplify app creates an S3 bucket. Run the **configure-amplify-bucket.sh** script in the **deployment** folder that configures this bucket by performing the following actions:

- Enables bucket versioning
- Creates a bucket policy that only allows operations that use secure transport

> It is recommended to enable **Server access logging** for the bucket. However, each organization has its own directives on how this must be achieved. E.g. some organizations mandate that the server access logs be sent to a bucket in a central log archive account which entails additional cross-account permissions. Please refer to [Enabling Amazon S3 server access logging](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enable-server-access-logging.html) for an explanation on how this can be achieved.
{: .important}