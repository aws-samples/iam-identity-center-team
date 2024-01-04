---
layout: default
title: Cognito Machine Authentication Configuration 
nav_order: 6
parent: Configuration
grand_parent: Solution deployment
---

# Cognito Machine Authentication Configuration 

The TEAM Cognito machine authentication configuration is an optional configuration make the TEAM graph api accessible programmatically.

### Run Api Machine Authentication configuration script
The **api-machine-auth.sh** bash script in the **deployment** folder performs the following actions within the **TEAM_ACCOUNT**:

- Creates a Resource Server with an id of `api` on the Cognito User Pool with a custom scope of `admin`.
- Creates a User Pool Client on the Cognito User Pool with client secret generation enabled along with the other needed configuration for machine auth flows and allows it access to the `api/admin` custom scope.

> Ensure that the named profile for the **TEAM Deployment account** has sufficient permissions before executing the **cognito.sh** script
{: .important}

Execute the following command in the root directory to deploy the script

```sh
cd deployment
./api-machine-auth.sh
```
The **api-machine-auth.sh** script should be deployed successfully without any errors.

The configuration to enable machine authentication against your AWS TEAM api is now complete.

### Using Machine Authentication with the Graph API

In order to use machine authentication on the Graph API, you need:
1. Obtain the client Id and Secret from the Cognito User Pool Client named `machine_auth`. 
2. Use these to obtain a token from the token endpoint for the Cognito User Pool. This process is detailed in the [AWS Cognito Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html).
3. Use this token in the `Authorization` header when making calls to the TEAM Graph API. 

<!-- ### Using The Terraform Provider

Documentation to come with the release of the terraform provider. -->