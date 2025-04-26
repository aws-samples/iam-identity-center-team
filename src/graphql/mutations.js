/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createRequests = /* GraphQL */ `
  mutation CreateRequests(
    $input: CreateRequestsInput!
    $condition: ModelRequestsConditionInput
  ) {
    createRequests(input: $input, condition: $condition) {
      id
      email
      accountId
      accountName
      role
      roleId
      startTime
      duration
      justification
      status
      comment
      username
      approver
      approverId
      approvers
      approver_ids
      revoker
      revokerId
      endTime
      ticketNo
      revokeComment
      session_duration
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const updateRequests = /* GraphQL */ `
  mutation UpdateRequests(
    $input: UpdateRequestsInput!
    $condition: ModelRequestsConditionInput
  ) {
    updateRequests(input: $input, condition: $condition) {
      id
      email
      accountId
      accountName
      role
      roleId
      startTime
      duration
      justification
      status
      comment
      username
      approver
      approverId
      approvers
      approver_ids
      revoker
      revokerId
      endTime
      ticketNo
      revokeComment
      session_duration
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const deleteRequests = /* GraphQL */ `
  mutation DeleteRequests(
    $input: DeleteRequestsInput!
    $condition: ModelRequestsConditionInput
  ) {
    deleteRequests(input: $input, condition: $condition) {
      id
      email
      accountId
      accountName
      role
      roleId
      startTime
      duration
      justification
      status
      comment
      username
      approver
      approverId
      approvers
      approver_ids
      revoker
      revokerId
      endTime
      ticketNo
      revokeComment
      session_duration
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const createSessions = /* GraphQL */ `
  mutation CreateSessions(
    $input: CreateSessionsInput!
    $condition: ModelSessionsConditionInput
  ) {
    createSessions(input: $input, condition: $condition) {
      id
      startTime
      endTime
      username
      accountId
      role
      approver_ids
      queryId
      expireAt
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const updateSessions = /* GraphQL */ `
  mutation UpdateSessions(
    $input: UpdateSessionsInput!
    $condition: ModelSessionsConditionInput
  ) {
    updateSessions(input: $input, condition: $condition) {
      id
      startTime
      endTime
      username
      accountId
      role
      approver_ids
      queryId
      expireAt
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const deleteSessions = /* GraphQL */ `
  mutation DeleteSessions(
    $input: DeleteSessionsInput!
    $condition: ModelSessionsConditionInput
  ) {
    deleteSessions(input: $input, condition: $condition) {
      id
      startTime
      endTime
      username
      accountId
      role
      approver_ids
      queryId
      expireAt
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const createApprovers = /* GraphQL */ `
  mutation CreateApprovers(
    $input: CreateApproversInput!
    $condition: ModelApproversConditionInput
  ) {
    createApprovers(input: $input, condition: $condition) {
      id
      name
      type
      approvers
      groupIds
      ticketNo
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateApprovers = /* GraphQL */ `
  mutation UpdateApprovers(
    $input: UpdateApproversInput!
    $condition: ModelApproversConditionInput
  ) {
    updateApprovers(input: $input, condition: $condition) {
      id
      name
      type
      approvers
      groupIds
      ticketNo
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteApprovers = /* GraphQL */ `
  mutation DeleteApprovers(
    $input: DeleteApproversInput!
    $condition: ModelApproversConditionInput
  ) {
    deleteApprovers(input: $input, condition: $condition) {
      id
      name
      type
      approvers
      groupIds
      ticketNo
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const createSettings = /* GraphQL */ `
  mutation CreateSettings(
    $input: CreateSettingsInput!
    $condition: ModelSettingsConditionInput
  ) {
    createSettings(input: $input, condition: $condition) {
      id
      duration
      expiry
      comments
      ticketNo
      approval
      modifiedBy
      sesNotificationsEnabled
      snsNotificationsEnabled
      slackNotificationsEnabled
      slackAuditNotificationsChannel
      sesSourceEmail
      sesSourceArn
      slackToken
      teamAdminGroup
      teamAuditorGroup
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateSettings = /* GraphQL */ `
  mutation UpdateSettings(
    $input: UpdateSettingsInput!
    $condition: ModelSettingsConditionInput
  ) {
    updateSettings(input: $input, condition: $condition) {
      id
      duration
      expiry
      comments
      ticketNo
      approval
      modifiedBy
      sesNotificationsEnabled
      snsNotificationsEnabled
      slackNotificationsEnabled
      slackAuditNotificationsChannel
      sesSourceEmail
      sesSourceArn
      slackToken
      teamAdminGroup
      teamAuditorGroup
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteSettings = /* GraphQL */ `
  mutation DeleteSettings(
    $input: DeleteSettingsInput!
    $condition: ModelSettingsConditionInput
  ) {
    deleteSettings(input: $input, condition: $condition) {
      id
      duration
      expiry
      comments
      ticketNo
      approval
      modifiedBy
      sesNotificationsEnabled
      snsNotificationsEnabled
      slackNotificationsEnabled
      slackAuditNotificationsChannel
      sesSourceEmail
      sesSourceArn
      slackToken
      teamAdminGroup
      teamAuditorGroup
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const createEligibility = /* GraphQL */ `
  mutation CreateEligibility(
    $input: CreateEligibilityInput!
    $condition: ModelEligibilityConditionInput
  ) {
    createEligibility(input: $input, condition: $condition) {
      id
      name
      type
      accounts {
        name
        id
        __typename
      }
      ous {
        name
        id
        __typename
      }
      permissions {
        name
        id
        __typename
      }
      ticketNo
      approvalRequired
      duration
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const updateEligibility = /* GraphQL */ `
  mutation UpdateEligibility(
    $input: UpdateEligibilityInput!
    $condition: ModelEligibilityConditionInput
  ) {
    updateEligibility(input: $input, condition: $condition) {
      id
      name
      type
      accounts {
        name
        id
        __typename
      }
      ous {
        name
        id
        __typename
      }
      permissions {
        name
        id
        __typename
      }
      ticketNo
      approvalRequired
      duration
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const deleteEligibility = /* GraphQL */ `
  mutation DeleteEligibility(
    $input: DeleteEligibilityInput!
    $condition: ModelEligibilityConditionInput
  ) {
    deleteEligibility(input: $input, condition: $condition) {
      id
      name
      type
      accounts {
        name
        id
        __typename
      }
      ous {
        name
        id
        __typename
      }
      permissions {
        name
        id
        __typename
      }
      ticketNo
      approvalRequired
      duration
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const publishPolicy = /* GraphQL */ `
  mutation PublishPolicy($result: PolicyInput) {
    publishPolicy(result: $result) {
      id
      policy {
        approvalRequired
        duration
        __typename
      }
      username
      __typename
    }
  }
`;
export const publishOUs = /* GraphQL */ `
  mutation PublishOUs($result: OUsInput) {
    publishOUs(result: $result) {
      ous
      __typename
    }
  }
`;
export const publishPermissions = /* GraphQL */ `
  mutation PublishPermissions($result: PermissionInput) {
    publishPermissions(result: $result) {
      id
      permissions {
        Name
        Arn
        Duration
        __typename
      }
      __typename
    }
  }
`;
