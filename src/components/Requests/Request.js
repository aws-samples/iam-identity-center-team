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
} from "../Shared/RequestService";
import { useHistory } from "react-router-dom";
import { API, graphqlOperation } from "aws-amplify";
import { onPublishPolicy } from "../../graphql/subscriptions";
import params from "../../parameters.json";

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

  const [submitLoading, setSubmitLoading] = useState(false);

  const [mgmtPs, setMgmtPs] = useState([]);

  const [maxDuration, setMaxDuration] = useState(9);
  const [ticketRequired, setTicketRequired] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);

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

  async function getPermissions(accountId) {
    let permissionData = [];
    setRole([]);
    const permissions = item.map((data) => {
      data.accounts.map((account) => {
        if (account.id == accountId) {
          permissionData = permissionData.concat(data.permissions);
        }
      });
    });
    setPermissions(concatenatePermissions(permissionData));
    return permissionData;
  }

  const getPolicy = () => {
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
        if (policy?.length > 0) {
          setItem(policy);
          setAccounts(concatenateAccounts(policy));
        }
        setAccountStatus("finished");
        setPermissionStatus("finished");
        subscription.unsubscribe();
      },
      error: (error) => {
        console.warn(error);
        subscription.unsubscribe();
      }
    });
    
    // Return the subscription to allow external cleanup if needed
    return subscription;
  }

  function getSettings() {
    getSetting("settings").then((data) => {
      if (data !== null) {
        setMaxDuration(parseInt(data.duration));
        setTicketRequired(data.ticketNo);
        setApprovalRequired(data.approval);
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
    getPolicy();
    props.addNotification([]);
    getMgmtPs();
    setTime(moment().format());
    publishEvent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sendRequest() {
    const data = {
      accountId: account.value,
      accountName: account.label,
      role: role.label,
      roleId: role.value,
      duration: duration,
      startTime: time,
      justification: justification,
      ticketNo: ticketNo,
    };
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
    props.addNotification([
      {
        type: "error",
        content: `No approver for Account - ${account.label}`,
        dismissible: true,
        onDismiss: () => props.addNotification([]),
      },
    ]);
    setSubmitLoading(false);
  }

  async function validate() {
    let error = false;
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
    if (await checkApprovalNotRequired(account, role)) {
      return true;
    }
    const account_approvers = await fetchApprovers(account, "Account");
    if (account_approvers) {
      const data = await getGroupMemberships(account_approvers.groupIds);
      const requesterIsApprover = checkGroupMembership(
        props.groupIds,
        account_approvers.groupIds
      );
      // If the requester is also an approver, then we need at least 2 approvers to exist (i.e. at
      // least one person who didn't make the request). Otherwise we only need a single approver to exist.
      const approverGroupMembersRequired = requesterIsApprover ? 2 : 1;

      if (data.members.length >= approverGroupMembersRequired) {
        return true;
      }
    }
    const ou = await fetchOU(account);
    const ou_approvers = await fetchApprovers(ou.Id, "OU");
    if (ou_approvers) {
      const data = await getGroupMemberships(ou_approvers.groupIds);
      const requesterIsApprover = checkGroupMembership(
        props.groupIds,
        ou_approvers.groupIds
      );
      // If the requester is also an approver, then we need at least 2 approvers to exist (i.e. at
      // least one person who didn't make the request). Otherwise we only need a single approver to exist.
      const approverGroupMembersRequired = requesterIsApprover ? 2 : 1;

      if (data.members.length >= approverGroupMembersRequired) {
        return true;
      }
    }
    return false;
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
                  getPermissions(event.detail.selectedOption.value);
                  getDuration(event.detail.selectedOption.value);
                }}
                selectedAriaLabel="selected"
              />
            </FormField>
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
