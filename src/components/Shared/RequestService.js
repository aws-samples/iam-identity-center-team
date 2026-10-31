// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import { generateClient } from "aws-amplify/api";
import {
  getAccounts,
  getPermissions,
  getApprovers,
  listRequests,
  getRequests,
  getSessions,
  listApprovers,
  getLogs,
  getOUs,
  getOU,
  requestByEmailAndStatus,
  getIdCGroups,
  getUsers,
  listEligibilities,
  getEligibility,
  listGroups,
  getSettings,
  getMgmtPermissions,
  getUserPolicy,
  requestByStatus
} from "../../graphql/queries";
import {
  createRequests,
  createSessions,
  deleteSessions,
  updateRequests,
  createApprovers,
  deleteApprovers,
  updateApprovers,
  createEligibility,
  deleteEligibility,
  updateEligibility,
  createSettings,
  updateSettings
} from "../../graphql/mutations";

const client = generateClient();

export async function fetchAccounts() {
  try {
    const accounts = await client.graphql({ query: getAccounts });
    const data = await accounts.data.getAccounts;
    return data;
  } catch (err) {
    console.log("error fetching accounts");
  }
}

export async function fetchPermissions() {
  try {
    const permissions = await client.graphql({ query: getPermissions });
    const data = await permissions.data.getPermissions;
    return data;
  } catch (err) {
    console.log("error fetching permissions", err);
  }
}

export async function getMgmtAccountPs() {
  try {
    const permissions = await client.graphql({ query: getMgmtPermissions });
    const data = await permissions.data.getMgmtPermissions;
    return data;
  } catch (err) {
    console.log("error fetching permissions");
  }
}

export async function getUserRequests(email) {
  let nextToken = null;
  let data = [];
  try {
    do {
    const requests = await client.graphql({
      query: requestByEmailAndStatus,
      variables: {
        email: email,nextToken
      }
    });
    data = data.concat(requests.data.requestByEmailAndStatus.items);
    nextToken = requests.data.requestByEmailAndStatus.nextToken;
  } while (nextToken);
    return data;
  } catch (err) {
    console.log("error fetching requests");
    return {"error":err}
  }
}

export async function fetchOUs() {
  try {
    const OU = await client.graphql({ query: getOUs });
    const data = await OU.data.getOUs;
    return data;
  } catch (err) {
    console.log("error fetching OUs");
    return {"error":err}
  }
}

export async function fetchOU(id) {
  try {
    const OU = await client.graphql({
      query: getOU,
      variables: {
        id: id,
      }
    });
    const data = await OU.data.getOU;
    return data;
  } catch (err) {
    console.log("error fetching OU");
  }
}
export async function getGroupMemberships(id) {
  try {
    const members = await client.graphql({
      query: listGroups,
      variables: {
        groupIds: id,
      }
    });
    const data = await members.data.listGroups;
    return data;
  } catch (err) {
    console.log("error fetching members");
  }
}

export async function fetchIdCGroups() {
  try {
    const groups = await client.graphql({ query: getIdCGroups });
    const data = await groups.data.getIdCGroups;
    return data;
  } catch (err) {
    console.log("error fetching IdC Groups");
  }
}

export async function fetchUsers() {
  try {
    const groups = await client.graphql({ query: getUsers });
    const data = await groups.data.getUsers;
    return data;
  } catch (err) {
    console.log("error fetching IdC Groups");
  }
}

export async function getSessionList() {
  let nextToken = null;
  let data = [];
  try {
    do {
    const request = await client.graphql({
      query: listRequests,
      variables: { nextToken }
    });
    data = data.concat(request.data.listRequests.items);
    nextToken = request.data.listRequests.nextToken;
  } while (nextToken);
    return data;
  } catch (err) {
    console.log("error fetching sessions");
    return {"error":err}
  }
}

// Query the requests table by `status` using the byStatus GSI instead of
// scanning the whole table via listRequests. `status` may be a single value
// or an array of statuses (each queried and merged). This keeps reads scoped
// to the small, current status partitions (e.g. pending / in progress).
// An optional `filter` is passed through to AppSync so it is applied by
// DynamoDB rather than in the browser.
export async function getRequestsByStatus(status, filter) {
  const statuses = Array.isArray(status) ? status : [status];
  let data = [];
  try {
    for (const s of statuses) {
      let nextToken = null;
      do {
        const variables = { status: s, nextToken };
        if (filter) variables.filter = filter;
        const requests = await client.graphql({
          query: requestByStatus,
          variables
        });
        data = data.concat(requests.data.requestByStatus.items);
        nextToken = requests.data.requestByStatus.nextToken;
      } while (nextToken);
    }
    return data;
  } catch (err) {
    console.log("error fetching requests by status", err);
    return { error: err };
  }
}

// Active sessions for the given user: the "scheduled" and "in progress"
// partitions, limited to rows the user owns or can approve.
export async function getActiveSessions(user) {
  return getRequestsByStatus(["scheduled", "in progress"], {
    or: [{ email: { eq: user } }, { approvers: { contains: user } }],
  });
}

export async function getRequest(id) {
  try {
    const request = await client.graphql({
      query: getRequests,
      variables: {
        id: id,
      }
    });
    const data = await request.data.getRequests;
    return data;
  } catch (err) {
    console.log("error fetching request");
  }
}

export async function getAllApprovers() {
  let nextToken = null;
  let data = [];
  try {
    do{
    const request = await client.graphql({ query: listApprovers, variables: {nextToken} });
    data = data.concat(request.data.listApprovers.items);
    nextToken = request.data.listApprovers.nextToken;
    } while (nextToken);
    return data;
  } catch (err) {
    console.log("error fetching approvers");
    return {"error":err}
  }
}

export async function sessions(filter) {
  let nextToken = null;
  let data = [];
  try {
    do {
    const request = await client.graphql({
      query: listRequests,
      variables: { filter: filter, nextToken }
    });
    data = data.concat(request.data.listRequests.items);
    nextToken = request.data.listRequests.nextToken;
  } while (nextToken);
    return data;
  } catch (err) {
    console.log("error fetching sessions");
    return {"error":err}
  }
}

// Pending approvals queue for the given approver: the "pending" partition,
// limited to requests the user did not raise but is an eligible approver for.
export async function getPendingRequests(userEmail) {
  return getRequestsByStatus("pending", {
    and: [
      { email: { ne: userEmail } },
      { approvers: { contains: userEmail } },
    ],
  });
}

export async function fetchLogs(args) {
  try {
    const logs = await client.graphql({ query: getLogs, variables: args });
    const data = await logs.data.getLogs;
    return data;
  } catch (err) {
    console.log("error fetching logs");
  }
}

export async function fetchPolicy(args) {
  try {
    const entitlement = await client.graphql({ query: getUserPolicy, variables: args });
    const data = await entitlement.data.getUserPolicy;
    return data;
  } catch (err) {
    console.log("error fetching Entitlement");
  }
}


// Mutations
export async function updateStatus(data) {
  try {
    const req = await client.graphql({
      query: updateRequests,
      variables: { input: data }
    });
    return req.data.updateRequests;
  } catch (err) {
    console.log("error updating status");
  }
}

export async function requestTeam(data) {
  try {
    const req = await client.graphql({
      query: createRequests,
      variables: { input: data }
    });
    return req.data.createRequests.id;
  } catch (err) {
    console.log("error creating request");
  }
}
export async function getSessionLogs(data) {
  try {
    const req = await client.graphql({
      query: createSessions,
      variables: { input: data }
    });
    return req.data.createSessions.id;
  } catch (err) {
    console.log("error creating session Logs");
  }
}

export async function deleteSessionLogs(data) {
  try {
    const req = await client.graphql({
      query: deleteSessions,
      variables: { input: data }
    });
    return req.data.deleteSessions;
  } catch (err) {
    console.log("error deleting session log");
  }
}

export async function getSession(id) {
  try {
    const request = await client.graphql({
      query: getSessions,
      variables: {
        id: id,
      }
    });
    const data = await request.data.getSessions;
    return data;
  } catch (err) {
    console.log("error fetching session log");
  }
}

export async function addApprovers(data) {
  try {
    const req = await client.graphql({
      query: createApprovers,
      variables: { input: data }
    });
    return req.data.createApprovers.Id;
  } catch (err) {
    console.log("error adding Approvers");
  }
}

export async function delApprover(data) {
  try {
    const req = await client.graphql({
      query: deleteApprovers,
      variables: { input: data }
    });
    return req.data.deleteApprovers;
  } catch (err) {
    console.log("error deleting approver");
  }
}

export async function editApprover(data) {
  try {
    const req = await client.graphql({
      query: updateApprovers,
      variables: { input: data }
    });
    return req.data.updateApprovers;
  } catch (err) {
    console.log("error updating approver");
  }
}

export async function fetchApprovers(id, type) {
  try {
    const approver = await client.graphql({
      query: getApprovers,
      variables: {
        id: id,
        type: type,
      }
    });
    const data = await approver.data.getApprovers;
    return data;
  } catch (err) {
    console.log("error fetching approvers");
  }
}

export async function addPolicy(data) {
  try {
    const req = await client.graphql({
      query: createEligibility,
      variables: { input: data }
    });
    return req.data.createEligibility.id;
  } catch (err) {
    console.log("error creating policy");
  }
}

export async function delPolicy(data) {
  try {
    const req = await client.graphql({
      query: deleteEligibility,
      variables: { input: data }
    });
    return req.data.deleteEligibility;
  } catch (err) {
    console.log("error deleting policy");
  }
}

export async function editPolicy(data) {
  try {
    const req = await client.graphql({
      query: updateEligibility,
      variables: { input: data }
    });
    return req.data.updateEligibility;
  } catch (err) {
    console.log("error updating policy");
  }
}

export async function fetchEligibility(id) {
  try {
    const approver = await client.graphql({
      query: getEligibility,
      variables: {
        id: id,
      }
    });
    const data = await approver.data.getEligibility;
    return data;
  } catch (err) {
    console.log("error fetching eligibility");
  }
}

export async function getAllEligibility() {
  let nextToken = null;
  let data = [];
  try {
    do {
    const request = await client.graphql({
      query: listEligibilities,
      variables: { nextToken }
    });
    data = data.concat(request.data.listEligibilities.items);
    nextToken = request.data.listEligibilities.nextToken;
  } while (nextToken);
    return data;
  } catch (err) {
    console.log("error fetching eligibility");
    return {"error":err}
  }
}

export async function getSetting(id) {
  try {
    const request = await client.graphql({
      query: getSettings,
      variables: {
        id: id,
      }
    });
    let data = await request.data.getSettings;
    return data;
  } catch (err) {
    // Non-admin users are not authorized to read admin-only Settings fields
    // (e.g. slackToken). AppSync returns the remaining Settings fields together
    // with a field-level authorization error, which the Amplify client surfaces
    // as a thrown response. Return that partial data so the request/approval UI
    // keeps working while the restricted field stays hidden (null).
    if (err?.data?.getSettings) {
      return err.data.getSettings;
    }
    console.log("error fetching settings");
    return null;
  }
}

export async function createSetting(data) {
  try {
    const req = await client.graphql({
      query: createSettings,
      variables: { input: data }
    });
    return req.data.createSettings.id;
  } catch (err) {
    console.log("error creating settings");
  }
}
export async function updateSetting(data) {
  try {
    const req = await client.graphql({
      query: updateSettings,
      variables: { input: data }
    });
    return req.data.updateSettings;
  } catch (err) {
    console.log("error updating settings");
  }
}

export async function revokePim(data) {
  try {
    updateRequests(data).then(() => {});
  } catch (err) {
    console.log("error revoking request");
  }
}

export async function invalidateOUCache(ouIds) {
  try {
    const mutation = `
      mutation InvalidateOUCache($ouIds: [String]!) {
        invalidateOUCache(ouIds: $ouIds) {
          invalidated
          failed
          message
        }
      }
    `;
    const response = await client.graphql({
      query: mutation,
      variables: { ouIds }
    });
    return response.data.invalidateOUCache;
  } catch (err) {
    console.log("error invalidating OU cache", err);
    throw err;
  }
}

export async function validateRequest(accountId, roleId, userId, groupIds) {
  try {
    const mutation = `
      mutation ValidateRequest($accountId: String!, $roleId: String!, $userId: String!, $groupIds: [String]!) {
        validateRequest(accountId: $accountId, roleId: $roleId, userId: $userId, groupIds: $groupIds) {
          valid
          reason
        }
      }
    `;
    const response = await client.graphql({
      query: mutation,
      variables: { accountId, roleId, userId, groupIds }
    });
    return response.data.validateRequest;
  } catch (err) {
    console.log("error validating request", err);
    throw err;
  }
}
