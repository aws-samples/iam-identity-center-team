// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import Form from "@awsui/components-react/form";
import FormField from "@awsui/components-react/form-field";
import Input from "@awsui/components-react/input";
import Select from "@awsui/components-react/select";
import Container from "@awsui/components-react/container";
import Header from "@awsui/components-react/header";
import SpaceBetween from "@awsui/components-react/space-between";
import Button from "@awsui/components-react/button";
import Textarea from "@awsui/components-react/textarea";
import RadioGroup from "@awsui/components-react/radio-group";
import StatusIndicator from "@awsui/components-react/status-indicator";
import Box from "@awsui/components-react/box";
import moment from "moment";
import { DatePicker } from "antd";
import "../../index.css";
import React, { useState, useEffect } from "react";
import {
  getGroupMemberships,
  requestTeam,
  fetchApprovers,
  fetchOU,
  getSetting,
  getMgmtAccountPs,
  fetchPolicy,
  validateRequest,
} from "../Shared/RequestService";
import {
  EligibilityMode,
  REQUEST_FLOW_OPTIONS
} from "../Shared/eligibilityModes";
import { useHistory } from "react-router-dom";
import { API, graphqlOperation } from "aws-amplify";
import { onPublishPolicy } from "../../graphql/subscriptions";
import params from "../../parameters.json";

function CopyableContact({ value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "16px" }}>
      <span>{value}</span>
      {copied ? (
        <StatusIndicator type="success">Copied</StatusIndicator>
      ) : (
        <Button
          variant="icon"
          iconName="copy"
          onClick={handleCopy}
          ariaLabel={`Copy ${value}`}
        />
      )}
    </div>
  );
}

function Request(props) {
  const [email, setEmail] = useState("");

  const [item, setItem] = useState([]);

  const [duration, setDuration] = useState("");
  const [durationError, setDurationError] = useState("");

  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState("");

  const [role, setRole] = useState([]);
  const [roleError, setRoleError] = useState("");

  const [account, setAccount] = useState([]);
  const [accountError, setAccountError] = useState("");

  const [time, setTime] = useState("");
  const [timeError, setTimeError] = useState("");

  const [ticketNo, setTicketNo] = useState("");
  const [ticketError, setTicketError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountStatus, setAccountStatus] = useState("loading");

  const [permissions, setPermissions] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState("loading");
  const [eligibilityType, setEligibilityType] = useState(null);
  const [showEligibilityChoice, setShowEligibilityChoice] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [policyMap, setPolicyMap] = useState({});
  const [policiesStatus, setPoliciesStatus] = useState("loading");
  const [policiesError, setPoliciesError] = useState("");
  const [legacyItems, setLegacyItems] = useState([]);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [mgmtPs, setMgmtPs] = useState([]);

  const [maxDuration, setMaxDuration] = useState(9);
  const [ticketRequired, setTicketRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [noEligibility, setNoEligibility] = useState(false);
  const [supportContacts, setSupportContacts] = useState([]);

  const history = useHistory();

  function concatenateAccounts(data) {
    let allAccounts = data.map((item) => item.accounts);
    allAccounts = [].concat.apply([], allAccounts);

    let uniqueAccounts = new Set();
    allAccounts.forEach((account) => {
      uniqueAccounts.add(JSON.stringify(account));
    });

    return Array.from(uniqueAccounts).map((account) => JSON.parse(account));
  }

  function concatenatePermissions(data) {
    let uniquePermissions = new Set();
    data.forEach((permission) => {
      uniquePermissions.add(JSON.stringify(permission));
    });

    return Array.from(uniquePermissions).map((permission) =>
      JSON.parse(permission)
    );
  }

  async function getDuration(accountId) {
    setDuration("");
    const duration = item.map((data) => {
      data.accounts.map((account, index) => {
        if (account.id == accountId) {
          setMaxDuration(data.duration);
        }
      });
    });
  }

  // Handle policy selection for policy-based flow
  function handlePolicySelect(selectedOption) {
    setSelectedPolicy(selectedOption);
    setPoliciesError("");
    setAccount([]);
    setRole([]);
    setDuration("");

    if (selectedOption) {
      const policyData = policyMap[selectedOption.value];
      if (policyData) {
        setAccounts(policyData.accounts || []);
        setPermissions(policyData.permissions || []);
        setMaxDuration(parseInt(policyData.duration));
      }
    } else {
      setAccounts([]);
      setPermissions([]);
    }
  }

  // Handle eligibility type change
  function handleEligibilityTypeChange(value) {
    setEligibilityType(value);
    // Reset selections
    setAccount([]);
    setRole([]);
    setPermissions([]);
    setSelectedPolicy(null);

    if (value === EligibilityMode.LEGACY) {
      setAccounts(concatenateAccounts(legacyItems));
    } else {
      setAccounts([]);
    }
  }

  async function getPermissions(accountId) {
    let permissionData = [];
    setRole([]);
    // Filter items based on eligibility type - legacy items have no policyIds
    const relevantItems = eligibilityType === EligibilityMode.LEGACY
      ? item.filter(data => !data.policyIds || data.policyIds.length === 0)
      : item;
    relevantItems.map((data) => {
      data.accounts.map((account) => {
        if (account.id == accountId) {
          permissionData = permissionData.concat(data.permissions);
        }
      });
    });
    setPermissions(concatenatePermissions(permissionData));
    return permissionData;
  }

  const fetchUserPolicy = () => {
    let args = {
      userId: props.userId,
      groupIds: props.groupIds,
    };
    fetchPolicy(args)
  };

  function publishEvent() {
    const subscription = API.graphql(graphqlOperation(onPublishPolicy)).subscribe({
      next: (result) => {
        const policy = result.value.data.onPublishPolicy.policy;
        if (!policy || policy.length === 0) {
          setNoEligibility(true);
          setInitialLoading(false);
          subscription.unsubscribe();
          return;
        }
        if (policy?.length > 0) {
          setNoEligibility(false);
          setItem(policy);

          // Separate legacy items (have accounts/permissions directly, no policyIds)
          const legacy = policy.filter(item =>
            (item.accounts?.length > 0 || item.permissions?.length > 0) &&
            (!item.policyIds || item.policyIds.length === 0)
          );
          setLegacyItems(legacy);

          // Get policy-based items (have policyIds)
          const policyBasedItems = policy.filter(item => item.policyIds?.length > 0);

          const hasLegacy = legacy.length > 0;
          const hasPolicyBased = policyBasedItems.length > 0;

          if (hasLegacy && hasPolicyBased) {
            setShowEligibilityChoice(true);
            setEligibilityType(EligibilityMode.POLICY_BASED);
          } else if (hasLegacy) {
            setEligibilityType(EligibilityMode.LEGACY);
            setShowEligibilityChoice(false);
            setAccounts(concatenateAccounts(legacy));
          } else if (hasPolicyBased) {
            setEligibilityType(EligibilityMode.POLICY_BASED);
            setShowEligibilityChoice(false);
          } else {
            setEligibilityType(null);
            setShowEligibilityChoice(false);
          }

          // Build policy map directly from subscription data (accounts already resolved by backend)
          if (hasPolicyBased) {
            const map = {};
            const policyList = [];

            policyBasedItems.forEach(item => {
              const policyId = item.policyIds[0]; // Each item has one policyId
              if (policyId && !map[policyId]) {
                map[policyId] = {
                  accounts: item.accounts || [],
                  permissions: item.permissions || [],
                  duration: item.duration,
                  approverGroupIds: item.approverGroupIds || [],
                  approvalRequired: item.approvalRequired
                };
                policyList.push({
                  id: policyId,
                  accounts: item.accounts || [],
                  permissions: item.permissions || []
                });
              }
            });

            setPolicyMap(map);
            setPolicies(policyList);
            setPoliciesStatus("finished");
          }
        }
        setAccountStatus("finished");
        setPermissionStatus("finished");
        setInitialLoading(false);
        subscription.unsubscribe();
      },
      error: (error) => {
        console.warn(error);
        setAccountStatus("error");
        setPermissionStatus("error");
        setPoliciesStatus("error");
        setInitialLoading(false);
        subscription.unsubscribe();
      }
    });

    return subscription;
  }

  function getSettings() {
    getSetting("settings").then((data) => {
      if (data !== null) {
        setMaxDuration(parseInt(data.duration));
        setTicketRequired(data.ticketNo);
        setApprovalRequired(data.approval);
        setSupportContacts(data.supportContacts ?? []);
      }
    });
  }

  function getMgmtPs() {
    getMgmtAccountPs().then((data) => {
      setMgmtPs(data);
    });
  }

  useEffect(() => {
    setEmail(props.user);
    getSettings();
    // getEligibility();
    fetchUserPolicy();
    props.addNotification([]);
    getMgmtPs();
    setTime(moment().format());
    publishEvent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendRequest() {
    const data = {
      accountId: account.value,
      accountName: account.label,
      role: role.label,
      roleId: role.value,
      ...(selectedPolicy && { policyId: selectedPolicy.value }),
      duration: duration,
      startTime: time,
      justification: justification,
      ticketNo: ticketNo,
    };

    // Validate request before creating
    try {
      const validation = await validateRequest(
        account.value,
        role.value,
        props.userId,
        props.groupIds,
        selectedPolicy?.value || null
      );

      if (!validation.valid) {
        props.addNotification([
          {
            type: "error",
            content: `Access request denied: ${validation.reason}`,
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          },
        ]);
        setSubmitLoading(false);
        return;
      }
    } catch (err) {
      props.addNotification([
        {
          type: "error",
          content: "Failed to validate request. Please try again.",
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
      setSubmitLoading(false);
      return;
    }

    requestTeam(data).then(() => {
      setSubmitLoading(false);
      props.addNotification([
        {
          type: "success",
          content: "Request created successfully",
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
      history.push("/requests/view");
      props.setActiveHref("/requests/view");
    });
  }

  function handleCancel() {
    history.push("/");
    props.setActiveHref("/");
    props.addNotification([]);
  }

  function sendError() {
    const errorMessage = eligibilityType === EligibilityMode.POLICY_BASED
      ? `No approver configured for policy - ${selectedPolicy?.label || 'Unknown'}`
      : `No approver for Account - ${account.label}`;
    props.addNotification([
      {
        type: "error",
        content: errorMessage,
        dismissible: true,
        onDismiss: () => props.addNotification([]),
      },
    ]);
    setSubmitLoading(false);
  }

  async function validate() {
    let error = false;
    // Validate policy selection for policy-based flow
    if (eligibilityType === EligibilityMode.POLICY_BASED && !selectedPolicy) {
      setPoliciesError("Select a policy");
      error = true;
    }
    if (
      !duration ||
      isNaN(duration) ||
      Number(duration) > Number(maxDuration) ||
      Number(duration) < 1
    ) {
      setDurationError(`Enter number between 1-${maxDuration}`);
      error = true;
    }
    if (role.length < 1) {
      setRoleError("Select a role");
      error = true;
    }
    if (
      params.DeploymentType == "delegated" &&
      role &&
      mgmtPs.permissions.includes(role.value)
    ) {
      setRoleError(
        "Permission set is assigned to management account and cannot be requested"
      );
      error = true;
    }
    if (!account.label) {
      setAccountError("Select an account");
      error = true;
    }
    if (!time) {
      setTimeError("Select start date");
      error = true;
    }
    if (!justification || !/[\p{L}\p{N}]/u.test(justification[0])) {
      setJustificationError("Enter valid business justification");
      error = true;
    }
    if ((!ticketNo && ticketRequired) || !/^[a-zA-Z0-9]+$/.test(ticketNo[0])) {
      setTicketError("Enter valid change management ticket number");
      error = true;
    }
    return error;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitLoading(true);
    const isValid = await validate();
    if (!isValid) {
      const shouldSendRequest =
        !approvalRequired ||
        (await checkApprovalAndApproverGroups(account.value, role.value));
      shouldSendRequest ? sendRequest() : sendError();
    } else {
      setSubmitLoading(false);
    }
  }

  async function checkApprovalNotRequired(account, role) {
    let approvalNotRequired = false;
    for (const eligibility of item) {
      for (const acct of eligibility.accounts) {
        if (acct.id === account) {
          for (const perm of eligibility.permissions) {
            if (perm.id === role) {
              if (!eligibility.approvalRequired) {
                approvalNotRequired = true;
              }
            }
          }
        }
      }
    }
    return approvalNotRequired;
  }

  function checkGroupMembership(groupIds, groupsIds) {
    for (const groupId of groupIds) {
      if (groupsIds.includes(groupId)) {
        return true;
      }
    }
    return false;
  }
  async function checkApprovalAndApproverGroups(account, role) {
    let approverGroupIds = null;
    let approvalNotRequired = false;

    // Policy-based: load groupIds from policy's approverGroupIds
    if (eligibilityType === EligibilityMode.POLICY_BASED && selectedPolicy) {
      const policyData = policyMap[selectedPolicy.value];
      if (policyData) {
        approvalNotRequired = !policyData.approvalRequired;
        if (policyData.approverGroupIds && policyData.approverGroupIds.length > 0) {
          approverGroupIds = [];
          for (const approverRecord of policyData.approverGroupIds) {
            const approverData = await fetchApprovers(approverRecord.id, null);
            if (approverData && approverData.groupIds) {
              approverGroupIds.push(...approverData.groupIds);
            }
          }
        }
      }
    } else {
      // Legacy: load from account/OU
      approvalNotRequired = await checkApprovalNotRequired(account, role);
      const account_approvers = await fetchApprovers(account, "Account");
      if (account_approvers) {
        approverGroupIds = account_approvers.groupIds;
      } else {
        const ou = await fetchOU(account);
        const ou_approvers = await fetchApprovers(ou.Id, "OU");
        if (ou_approvers) {
          approverGroupIds = ou_approvers.groupIds;
        }
      }
    }

    // Common logic for both flows
    if (approvalNotRequired) {
      return true;
    }
    if (!approverGroupIds || approverGroupIds.length === 0) {
      return false;
    }
    const data = await getGroupMemberships(approverGroupIds);
    const requesterIsApprover = checkGroupMembership(props.groupIds, approverGroupIds);
    // If requester is also an approver, need at least 2 members (someone else to approve)
    const approverGroupMembersRequired = requesterIsApprover ? 2 : 1;
    return data.members.length >= approverGroupMembersRequired;
  }

  if (initialLoading) {
    return (
      <div className="container">
        <Container
          header={
            <Header
              variant="h2"
              description="Request temporary elevated access"
            >
              Elevated access request
            </Header>
          }
        >
          <Box textAlign="center" padding="xxl">
            <StatusIndicator type="loading">
              Loading your eligibility policies...
            </StatusIndicator>
          </Box>
        </Container>
      </div>
    );
  }

  if (noEligibility) {
    return (
      <div className="container">
        <Container
          header={
            <Header
              variant="h2"
              description="Request temporary elevated access"
            >
              Elevated access request
            </Header>
          }
        >
          <Box textAlign="center" padding="xl">
            <SpaceBetween size="l">
              <StatusIndicator type="warning">
                No eligibility assigned
              </StatusIndicator>
              <Box variant="p">
                You are not a member of any eligibility group. You cannot request elevated access to any accounts or permission sets.
              </Box>
              <Box>
                <Box variant="h4" textAlign="center">Contact support to request eligibility:</Box>
                {supportContacts.length > 0 ? (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
                    <div style={{ textAlign: "left" }}>
                      <SpaceBetween size="s">
                        {Object.entries(
                          supportContacts.reduce((acc, contact) => {
                            if (!acc[contact.key]) acc[contact.key] = [];
                            acc[contact.key].push(contact.value);
                            return acc;
                          }, {})
                        ).map(([key, values]) => (
                          <div key={key}>
                            <Box variant="strong">{key}:</Box>
                            {values.map((value, index) => (
                              <CopyableContact key={index} value={value} />
                            ))}
                          </div>
                        ))}
                      </SpaceBetween>
                    </div>
                  </div>
                ) : (
                  <Box variant="p" textAlign="center">Contact your TEAM administrators.</Box>
                )}
              </Box>
            </SpaceBetween>
          </Box>
        </Container>
      </div>
    );
  }

  return (
    <div className="container">
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              onClick={handleSubmit}
              className="buttons"
              loading={submitLoading}
            >
              Submit
            </Button>
          </SpaceBetween>
        }
      >
        <Container
          header={
            <Header
              variant="h2"
              description="Request temporary elevated access"
            >
              Elevated access request
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              label="Email"
              stretch
              description="Elevated access requester username"
            >
              <Input value={email} type="email" />
            </FormField>
            {showEligibilityChoice && (
              <FormField
                label="Eligibility type"
                stretch
                description="Do you want to use the legacy or policy-based flow to request elevated access?"
              >
                <RadioGroup
                  value={eligibilityType}
                  onChange={({ detail }) => handleEligibilityTypeChange(detail.value)}
                  items={REQUEST_FLOW_OPTIONS}
                />
              </FormField>
            )}
            {eligibilityType === EligibilityMode.POLICY_BASED && (
              <FormField
                label="Policy"
                stretch
                description="Select a policy that defines your access"
                errorText={policiesError}
              >
                <Select
                  statusType={policiesStatus}
                  placeholder="Select a policy"
                  loadingText="Loading policies"
                  filteringType="auto"
                  empty="No eligible policies found"
                  options={policies.map((policy) => ({
                    label: policy.id,
                    value: policy.id,
                    description: `Accounts: ${policy.accounts?.length || 0}, Permissions: ${policy.permissions?.length || 0}`,
                  }))}
                  selectedOption={selectedPolicy}
                  onChange={({ detail }) => handlePolicySelect(detail.selectedOption)}
                  selectedAriaLabel="selected"
                />
              </FormField>
            )}
            {(eligibilityType === EligibilityMode.LEGACY || (eligibilityType === EligibilityMode.POLICY_BASED && selectedPolicy)) && (
              <FormField
                label="Account"
                stretch
                description="Target account for elevated access"
                errorText={accountError}
              >
                <Select
                  statusType={accountStatus}
                  placeholder="Select an account"
                  loadingText="Loading accounts"
                  filteringType="auto"
                  empty="No eligible accounts found"
                  options={accounts.map((account) => ({
                    label: account.name,
                    value: account.id,
                    description: account.id,
                  }))}
                  selectedOption={account}
                  onChange={(event) => {
                    setAccountError();
                    setAccount(event.detail.selectedOption);
                    if (eligibilityType === EligibilityMode.LEGACY) {
                      getPermissions(event.detail.selectedOption.value);
                      getDuration(event.detail.selectedOption.value);
                    }
                  }}
                  selectedAriaLabel="selected"
                />
              </FormField>
            )}
            {(eligibilityType === EligibilityMode.LEGACY || (eligibilityType === EligibilityMode.POLICY_BASED && selectedPolicy)) && (
              <FormField
                label="Role"
                stretch
                description="Requested permission set and associated role"
                errorText={roleError}
              >
                <Select
                  statusType={permissionStatus}
                  placeholder="Select a role"
                  loadingText="Loading permissions"
                  filteringType="auto"
                  empty="No eligible permissions found"
                  options={permissions.map((permission) => ({
                    label: permission.name,
                    value: permission.id,
                  }))}
                  selectedOption={role}
                  onChange={(event) => {
                    setRoleError();
                    setRole(event.detail.selectedOption);
                  }}
                  selectedAriaLabel="selected"
                />
              </FormField>
            )}
            <FormField
              label="Start time"
              stretch
              description="Start date and time for elevated access"
              errorText={timeError}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                defaultValue={moment()}
                // disabledDate={disabledDate}
                onChange={(event) => {
                  setTimeError();
                  if (event) {
                    setTime(event._d);
                    console.log(event._d);
                  }
                }}
              />
            </FormField>
            <FormField
              label="Duration"
              stretch
              description="Number of hours for which elevated access is required - Note: This is different from the session duration configured for requested permission set/role"
              errorText={durationError}
              placeholder={`Enter number between 1-${maxDuration}`}
            >
              <Input
                value={duration}
                onChange={(event) => {
                  setDurationError();
                  Number(event.detail.value) > Number(maxDuration)
                    ? setDurationError(
                        `Enter a number between 1 and ${maxDuration}`
                      )
                    : setDuration(event.detail.value);
                }}
                type="number"
              />
            </FormField>
            <FormField
              label="Ticket no"
              stretch
              description="Elevated request ticket system number"
              errorText={ticketError}
            >
              <Input
                value={ticketNo}
                onChange={(event) => {
                  setTicketError();
                  setTicketNo(event.detail.value);
                }}
              />
            </FormField>
            <FormField
              label="Justification"
              stretch
              description="Business justification for requesting elevated access"
              errorText={justificationError}
            >
              <Textarea
                onChange={({ detail }) => {
                  setJustificationError();
                  setJustification(detail.value);
                }}
                value={justification}
                ariaRequired
                placeholder="Business Justification for requesting elevated access"
              />
            </FormField>
          </SpaceBetween>
        </Container>
      </Form>
    </div>
  );
}

export default Request;
