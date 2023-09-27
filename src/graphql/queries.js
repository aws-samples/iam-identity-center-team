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
      createdAt
      updatedAt
      owner
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
        createdAt
        updatedAt
        owner
      }
      nextToken
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
        createdAt
        updatedAt
        owner
      }
      nextToken
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
        createdAt
        updatedAt
        owner
      }
      nextToken
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
      }
      nextToken
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
      }
      nextToken
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
      sesSourceEmail
      sesSourceArn
      slackToken
      teamAdminGroup
      teamAuditorGroup
      createdAt
      updatedAt
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
        sesSourceEmail
        sesSourceArn
        slackToken
        teamAdminGroup
        teamAuditorGroup
        createdAt
        updatedAt
      }
      nextToken
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
      }
      ous {
        name
        id
      }
      permissions {
        name
        id
      }
      ticketNo
      approvalRequired
      duration
      modifiedBy
      createdAt
      updatedAt
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
        }
        ous {
          name
          id
        }
        permissions {
          name
          id
        }
        ticketNo
        approvalRequired
        duration
        modifiedBy
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;
export const getAccounts = /* GraphQL */ `
  query GetAccounts {
    getAccounts {
      name
      id
    }
  }
`;
export const getOUs = /* GraphQL */ `
  query GetOUs {
    getOUs {
      Id
      Arn
      Name
      Children {
        Id
        Arn
        Name
        Children {
          Id
          Arn
          Name
          Children {
            Id
            Arn
            Name
            Children {
              Id
              Arn
              Name
              Children {
                Id
                Arn
                Name
                Children {
                  Id
                  Arn
                  Name
                  Children {
                    Id
                    Arn
                    Name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
export const getOU = /* GraphQL */ `
  query GetOU($id: String) {
    getOU(id: $id) {
      Id
    }
  }
`;
export const getPermissions = /* GraphQL */ `
  query GetPermissions {
    getPermissions {
      Name
      Arn
      Duration
    }
  }
`;
export const getMgmtPermissions = /* GraphQL */ `
  query GetMgmtPermissions {
    getMgmtPermissions {
      permissions
    }
  }
`;
export const getGroups = /* GraphQL */ `
  query GetGroups {
    getGroups {
      groups
      userId
      groupIds
    }
  }
`;
export const getIdCGroups = /* GraphQL */ `
  query GetIdCGroups {
    getIdCGroups {
      GroupId
      DisplayName
    }
  }
`;
export const getUsers = /* GraphQL */ `
  query GetUsers {
    getUsers {
      UserName
      UserId
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
    }
  }
`;
export const getEntitlement = /* GraphQL */ `
  query GetEntitlement($userId: String, $groupIds: [String]) {
    getEntitlement(userId: $userId, groupIds: $groupIds) {
      accounts {
        name
        id
      }
      permissions {
        name
        id
      }
      approvalRequired
      duration
    }
  }
`;
export const listGroups = /* GraphQL */ `
  query ListGroups($groupIds: [String]) {
    listGroups(groupIds: $groupIds) {
      members
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
      createdAt
      updatedAt
      owner
    }
  }
`;
export const validateRequest = /* GraphQL */ `
  query ValidateRequest {
    validateRequest {
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
    }
  }
`;
