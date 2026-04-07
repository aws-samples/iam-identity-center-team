/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getRequests = /* GraphQL */ `
  query GetRequests($id: ID!) {
    getRequests(id: $id) {
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
      policyId
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const listRequests = /* GraphQL */ `
  query ListRequests(
    $filter: ModelRequestsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listRequests(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
        policyId
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const requestByEmailAndStatus = /* GraphQL */ `
  query RequestByEmailAndStatus(
    $email: String!
    $status: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelrequestsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    requestByEmailAndStatus(
      email: $email
      status: $status
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
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
        policyId
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const requestByApproverAndStatus = /* GraphQL */ `
  query RequestByApproverAndStatus(
    $approverId: String!
    $status: ModelStringKeyConditionInput
    $sortDirection: ModelSortDirection
    $filter: ModelrequestsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    requestByApproverAndStatus(
      approverId: $approverId
      status: $status
      sortDirection: $sortDirection
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
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
        policyId
        createdAt
        updatedAt
        owner
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getSessions = /* GraphQL */ `
  query GetSessions($id: ID!) {
    getSessions(id: $id) {
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
export const listSessions = /* GraphQL */ `
  query ListSessions(
    $filter: ModelSessionsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listSessions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
      __typename
    }
  }
`;
export const getApprovers = /* GraphQL */ `
  query GetApprovers($id: ID!) {
    getApprovers(id: $id) {
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
export const listApprovers = /* GraphQL */ `
  query ListApprovers(
    $filter: ModelApproversFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listApprovers(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
      __typename
    }
  }
`;
export const getSettings = /* GraphQL */ `
  query GetSettings($id: ID!) {
    getSettings(id: $id) {
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
      allowLegacyEligibility
      useOUCache
      supportContacts {
        key
        value
        __typename
      }
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listSettings = /* GraphQL */ `
  query ListSettings(
    $filter: ModelSettingsFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listSettings(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
        allowLegacyEligibility
        useOUCache
        supportContacts {
          key
          value
          __typename
        }
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getEligibility = /* GraphQL */ `
  query GetEligibility($id: ID!) {
    getEligibility(id: $id) {
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
      policyIds
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
export const listEligibilities = /* GraphQL */ `
  query ListEligibilities(
    $filter: ModelEligibilityFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listEligibilities(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
        policyIds
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
      nextToken
      __typename
    }
  }
`;
export const getPolicies = /* GraphQL */ `
  query GetPolicies($id: ID!) {
    getPolicies(id: $id) {
      id
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
      approvalRequired
      approverGroupIds {
        name
        id
        __typename
      }
      duration
      modifiedBy
      createdAt
      updatedAt
      __typename
    }
  }
`;
export const listPolicies = /* GraphQL */ `
  query ListPolicies(
    $filter: ModelPoliciesFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPolicies(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
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
        approvalRequired
        approverGroupIds {
          name
          id
          __typename
        }
        duration
        modifiedBy
        createdAt
        updatedAt
        __typename
      }
      nextToken
      __typename
    }
  }
`;
export const getAccounts = /* GraphQL */ `
  query GetAccounts {
    getAccounts {
      name
      id
      __typename
    }
  }
`;
export const getOUs = /* GraphQL */ `
  query GetOUs {
    getOUs
  }
`;
export const getOU = /* GraphQL */ `
  query GetOU($id: String) {
    getOU(id: $id) {
      Id
      __typename
    }
  }
`;
export const getPermissions = /* GraphQL */ `
  query GetPermissions {
    getPermissions {
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
export const getMgmtPermissions = /* GraphQL */ `
  query GetMgmtPermissions {
    getMgmtPermissions {
      permissions
      __typename
    }
  }
`;
export const getIdCGroups = /* GraphQL */ `
  query GetIdCGroups {
    getIdCGroups {
      GroupId
      DisplayName
      __typename
    }
  }
`;
export const getUsers = /* GraphQL */ `
  query GetUsers {
    getUsers {
      UserName
      UserId
      __typename
    }
  }
`;
export const getLogs = /* GraphQL */ `
  query GetLogs($queryId: String) {
    getLogs(queryId: $queryId) {
      eventName
      eventSource
      eventID
      eventTime
      __typename
    }
  }
`;
export const getUserPolicy = /* GraphQL */ `
  query GetUserPolicy($userId: String, $groupIds: [String]) {
    getUserPolicy(userId: $userId, groupIds: $groupIds) {
      id
      policy {
        accounts {
          name
          id
          __typename
        }
        permissions {
          name
          id
          __typename
        }
        approvalRequired
        duration
        policyIds
        approverGroupIds {
          name
          id
          __typename
        }
        __typename
      }
      username
      __typename
    }
  }
`;
export const listGroups = /* GraphQL */ `
  query ListGroups($groupIds: [String]) {
    listGroups(groupIds: $groupIds) {
      members
      __typename
    }
  }
`;
export const updateRequestData = /* GraphQL */ `
  query UpdateRequestData {
    updateRequestData {
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
      policyId
      createdAt
      updatedAt
      owner
      __typename
    }
  }
`;
export const validateRequest = /* GraphQL */ `
  query ValidateRequest(
    $accountId: String!
    $roleId: String!
    $userId: String!
    $groupIds: [String]!
    $policyId: String
  ) {
    validateRequest(
      accountId: $accountId
      roleId: $roleId
      userId: $userId
      groupIds: $groupIds
      policyId: $policyId
    ) {
      valid
      reason
      __typename
    }
  }
`;
export const getOUAccounts = /* GraphQL */ `
  query GetOUAccounts($ouIds: [String]!) {
    getOUAccounts(ouIds: $ouIds) {
      results {
        ouId
        accounts {
          name
          id
          __typename
        }
        cached
        __typename
      }
      __typename
    }
  }
`;
export const listPoliciesWithAccounts = /* GraphQL */ `
  query ListPoliciesWithAccounts {
    listPoliciesWithAccounts {
      id
      accounts {
        name
        id
        __typename
      }
      resolvedAccounts {
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
      approvalRequired
      approverGroupIds {
        name
        id
        __typename
      }
      duration
      modifiedBy
      __typename
    }
  }
`;
