---
layout: default
title: Approver guide
nav_order: 5
parent: Guides
---

# Approver Guides
{: .no_toc}
<details open markdown="block">
  <summary>
    Table of contents
  </summary>
  {: .text-delta }
- TOC
{:toc}
</details>

When a user requests elevated access to an account, if you are a member of the approver group for that account/OU, you will receive an email prompting you to log into the TEAM app and either approve or reject the elevated access request.
## Approve Elevated Access Request
1. Log into the application.
2. In the left-hand menu go to *Approvals* &rarr; *Approve requests*.
3. You will see all of the requests that are pending your approval. Tick the request and click on *View details*.
4. Review the information, including the *Justification* field if provided. Close the pop-up window.
5. With the request still ticked, click on *Actions*, and either *Approve* or *Reject* the request. 
6. You might be required to provide a *Comment* with the reason when approving/rejecting the request.

### Approve elevated access demo
{: .no_toc}
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/approver_guides/approve_request.mov">
</video>


## Inspect Session Activity & Revoke Access
At any point during an active session, an approver has access to the session logs. The approver can revoke access from the user if the actions performed by the user are suspicious.

  1. In the left-hand menu go to *Elevated access* &rarr; *Active access*.
  2. Tick the session you are interested in and click *View details*.
  3. Review the details of the request.
  4. Click on dropdown *Session activity logs*.
  5. You can view all of the [CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html) logs (API calls made by the user) since the start of the session.
  6. You can use the search bar to search the logs.
  7. To revoke access from the user, click *Revoke*.
   
### Inspect/revoke elevated access demo
{: .no_toc}  
<video width="750" height="420" frameborder="0" allowfullscreen controls>
<source src="https://d3f99z5n3ls8r1.cloudfront.net/videos/approver_guides/approver_revoke.mov">
</video>