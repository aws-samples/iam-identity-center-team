// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState, useEffect } from "react";
import Box from "@awsui/components-react/box";
import SpaceBetween from "@awsui/components-react/space-between";
import Container from "@awsui/components-react/container";
import Header from "@awsui/components-react/header";
import ColumnLayout from "@awsui/components-react/column-layout";
import Button from "@awsui/components-react/button";
import Select from "@awsui/components-react/select";
import params from "../../parameters.json";
import {
  ContentLayout,
  Modal,
  Toggle,
  Form,
  FormField,
  Input,
  Spinner,
} from "@awsui/components-react";
import StatusIndicator from "@awsui/components-react/status-indicator";
import { Divider } from "antd";
import "../../index.css";
import {
  getSetting,
  createSetting,
  updateSetting,
  fetchIdCGroups,
} from "../Shared/RequestService";

function Settings(props) {
  const [duration, setDuration] = useState(null);
  const [durationError, setDurationError] = useState("");
  const [expiry, setExpiry] = useState(null);
  const [expiryError, setExpiryError] = useState("");
  const [comments, setComments] = useState(null);
  const [ticketNo, setTicketNo] = useState(null);
  const [approval, setApproval] = useState(null);
  const [sesNotificationsEnabled, setSesNotificationsEnabled] = useState(null);
  const [snsNotificationsEnabled, setSnsNotificationsEnabled] = useState(null);
  const [slackNotificationsEnabled, setSlackNotificationsEnabled] =
    useState(null);
  const [slackToken, setSlackToken] = useState("");
  const [slackTokenError, setSlackTokenError] = useState("");
  const [slackAuditNotificationsChannel, setSlackAuditNotificationsChannel] = useState(null);
  const [sesSourceEmail, setSesSourceEmail] = useState(null);
  const [sesSourceEmailError, setSesSourceEmailError] = useState("");
  const [sesSourceArn, setSesSourceArn] = useState(null);
  const [sesSourceArnError, setSesSourceArnError] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [item, setItem] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupStatus, setGroupStatus] = useState("");
  const [teamAdminGroup, setTeamAdminGroup] = useState("");
  const [teamAuditorGroup, setTeamAuditorGroup] = useState("");

  function getGroups() {
    setGroupStatus("loading");
    fetchIdCGroups().then((data) => {
      setGroups(data);
      setGroupStatus("finished");
    });
  }

  const slackAppManifest = {
    display_information: {
      name: "TEAM",
      description: "Temporary Elevated Access Management for AWS IAM Identity Center",
      background_color: "#252F3E",
    },
    features: {
      bot_user: {
        display_name: "TEAM",
        always_online: false,
      },
    },
    oauth_config: {
      scopes: {
        bot: [
          "channels:read",
          "chat:write",
          "groups:read",
          "im:write",
          "usergroups:read",
          "users:read",
          "users.profile:read",
          "users:read.email",
        ],
      },
    },
    settings: {
      org_deploy_enabled: false,
      socket_mode_enabled: false,
      token_rotation_enabled: false,
    },
  };
  const encodedSlackAppManifest = encodeURIComponent(
    JSON.stringify(slackAppManifest)
  );
  const baseSlackAppUrl = "https://api.slack.com/apps?new_app=1&manifest_json=";
  const slackAppInstallUrl = baseSlackAppUrl + encodedSlackAppManifest;

  useEffect(() => {
    views();
  }, []);

  function views() {
    getGroups();
    setVisible(false);
    setSubmitLoading(false);
    getSettings();
  }

  async function validate() {
    let error = false;
    const emailRegex = /\S+@\S+\.\S+/;

    if (
      !duration ||
      isNaN(duration) ||
      Number(duration) > 8000 ||
      Number(duration) < 1
    ) {
      setDurationError(`Enter valid duration as a number between 1 - 8000`);
      error = true;
    }
    if (
      !expiry ||
      isNaN(expiry) ||
      Number(expiry) > 8000 ||
      Number(expiry) < 1
    ) {
      setExpiryError(`Enter valid expiry timeout as a number between 1 - 8000`);
      error = true;
    }
    if (sesNotificationsEnabled && !emailRegex.test(sesSourceEmail)) {
      setSesSourceEmailError(`Enter a valid email address`);
      error = true;
    }
    if (
      sesNotificationsEnabled &&
      !(sesSourceArn === "" || sesSourceArn.startsWith("arn:"))
    ) {
      setSesSourceArnError(
        `Enter a valid ARN for an SES identity, or leave blank if using an identity in the TEAM account`
      );
      error = true;
    }
    if (slackNotificationsEnabled) {
      if (!slackToken.startsWith("xoxb")) {
        setSlackTokenError(`Enter a valid Slack bot token`);
        error = true;
      } else if (slackToken.length < 10) {
        setSlackTokenError(`Enter a complete OAuth token`);
        error = true;
      }
    }
    return error;
  }

  function handleEdit() {
    setVisible(true);
  }
  function handleDismiss() {
    // Reset item states
    if (item) {
      setDuration(item.duration ?? "9");
      setExpiry(item.expiry ?? "3");
      setComments(item.comments ?? true);
      setTicketNo(item.ticketNo ?? true);
      setApproval(item.approval ?? true);
      setSesNotificationsEnabled(item.sesNotificationsEnabled ?? false);
      setSnsNotificationsEnabled(item.snsNotificationsEnabled ?? false);
      setSlackNotificationsEnabled(item.slackNotificationsEnabled ?? false);
      setSesSourceEmail(item.sesSourceEmail ?? "");
      setSesSourceArn(item.sesSourceArn ?? "");
      setSlackToken(item.slackToken ?? "");
      setTeamAdminGroup(item.teamAdminGroup ?? params.teamAdminGroup);
      setTeamAuditorGroup(item.teamAuditorGroup ?? params.teamAuditorGroup);
    }
    setVisible(false);
  }
  async function handleSubmit() {
    setSubmitLoading(true);
    if (!(await validate())) {
      const data = {
        id: "settings",
        duration,
        expiry,
        comments,
        ticketNo,
        approval,
        sesNotificationsEnabled,
        snsNotificationsEnabled,
        slackNotificationsEnabled,
        slackAuditNotificationsChannel,
        sesSourceEmail,
        sesSourceArn,
        slackToken,
        teamAdminGroup,
        teamAuditorGroup,
      };
      const action = item === null ? createSetting : updateSetting;
      action(data).then(() => {
        views();
        props.addNotification([
          {
            type: "success",
            content: "TEAM configuration edited successfully",
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          },
        ]);
      });
    } else setSubmitLoading(false);
  }

  function getSettings() {
    getSetting("settings").then((data) => {
      setItem(data ?? null);
      setDuration(data?.duration ?? "9");
      setExpiry(data?.expiry ?? "3");
      setComments(data?.comments ?? true);
      setTicketNo(data?.ticketNo ?? true);
      setApproval(data?.approval ?? true);
      setSesNotificationsEnabled(data?.sesNotificationsEnabled ?? false);
      setSnsNotificationsEnabled(data?.snsNotificationsEnabled ?? false);
      setSlackNotificationsEnabled(data?.slackNotificationsEnabled ?? false);
      setSlackAuditNotificationsChannel(data?.slackAuditNotificationsChannel ?? "");
      setSesSourceEmail(data?.sesSourceEmail ?? "");
      setSesSourceArn(data?.sesSourceArn ?? "");
      setSlackToken(data?.slackToken ?? "");
      setTeamAdminGroup(data?.teamAdminGroup ?? params.teamAdminGroup);
      setTeamAuditorGroup(data?.teamAuditorGroup ?? params.teamAuditorGroup);
    });
  }

  return (
    <div className="container">
      <ContentLayout>
        <Container
          header={
            <Header
              variant="h2"
              description="Custom configuration settings for TEAM application"
              actions={
                <Button variant="primary" onClick={handleEdit}>
                  Edit
                </Button>
              }
            >
              Configuration settings
            </Header>
          }
        >
          <ColumnLayout columns={3} variant="text-grid">
            <SpaceBetween size="l">
              <div>
                <Box variant="h3">Request settings</Box>
                <Box variant="small">
                  Elevated access request settings
                </Box>
                <Divider style={{ marginBottom: "7px", marginTop: "7px" }} />
              </div>
              <div>
                <Box variant="awsui-key-label">Approval workflow</Box>
                <>
                  {" "}
                  {approval !== null ? (
                    <div>
                      <StatusIndicator
                        type={approval === true ? "success" : "stopped"}
                      >
                        {approval === true ? "Enabled (Managed in eligibility policy)" : "Disabled"}
                      </StatusIndicator>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              <div>
                <Box variant="awsui-key-label">Comments</Box>
                <>
                  {" "}
                  {comments !== null ? (
                    <div>
                      <StatusIndicator
                        type={comments === true ? "success" : "stopped"}
                      >
                        {comments === true ? "Required" : "Not required"}
                      </StatusIndicator>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              <div>
                <Box variant="awsui-key-label">Ticket number</Box>
                <>
                  {" "}
                  {ticketNo !== null ? (
                    <div>
                      <StatusIndicator
                        type={ticketNo === true ? "success" : "stopped"}
                      >
                        {ticketNo === true ? "Required" : "Not required"}
                      </StatusIndicator>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              <div>
                <Box variant="awsui-key-label">Maximum request duration</Box>
                <>
                  {" "}
                  {duration !== null ? (
                    <div>{duration} hours</div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              <div>
                <Box variant="awsui-key-label">Request expiry timeout</Box>
                <>
                  {" "}
                  {expiry !== null ? <div>{expiry} hours</div> : <Spinner />}
                </>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="h3">Group settings</Box>
                <Box variant="small">TEAM admin and auditor group settings</Box>
                <Divider style={{ marginBottom: "7px", marginTop: "7px" }} />
              </div>
              <div>
                <Box variant="awsui-key-label">TEAM admin group</Box>
                <>
                  {" "}
                  {teamAdminGroup !== null ? (
                    <div>{teamAdminGroup}</div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              <div>
                <Box variant="awsui-key-label">TEAM auditor group</Box>
                <>
                  {" "}
                  {teamAuditorGroup !== null ? (
                    <div>{teamAuditorGroup}</div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="h3">Notification settings</Box>
                <Box variant="small">
                  Notification settings for request and approval events
                </Box>
                <Divider style={{ marginBottom: "7px", marginTop: "7px" }} />
              </div>
              <div>
                <Box variant="awsui-key-label">Email notifications</Box>
                <>
                  {" "}
                  {sesNotificationsEnabled !== null ? (
                    <div>
                      <StatusIndicator
                        type={
                          sesNotificationsEnabled === true
                            ? "success"
                            : "stopped"
                        }
                      >
                        {sesNotificationsEnabled === true
                          ? sesSourceEmail
                          : "Disabled"}
                      </StatusIndicator>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              {sesNotificationsEnabled === "SES" && (
                <div>
                  <Box variant="awsui-key-label">SES source email</Box>
                  <>
                    {" "}
                    {sesSourceEmail !== null ? (
                      <div>{sesSourceEmail}</div>
                    ) : (
                      <Spinner />
                    )}
                  </>
                  <br />
                  <Box variant="awsui-key-label">SES source ARN</Box>
                  <>
                    {" "}
                    {sesSourceArn !== null ? (
                      <div>{sesSourceArn}</div>
                    ) : (
                      <Spinner />
                    )}
                  </>
                </div>
              )}
              <div>
                <Box variant="awsui-key-label">SNS notifications</Box>
                <>
                  {" "}
                  {snsNotificationsEnabled !== null ? (
                    <div>
                      <StatusIndicator
                        type={
                          snsNotificationsEnabled === true
                            ? "success"
                            : "stopped"
                        }
                      >
                        {snsNotificationsEnabled === true
                          ? "Enabled"
                          : "Disabled"}
                      </StatusIndicator>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              <div>
                <Box variant="awsui-key-label">Slack notifications</Box>
                <>
                  {" "}
                  {slackNotificationsEnabled !== null ? (
                    <div>
                      <StatusIndicator
                        type={
                          slackNotificationsEnabled === true
                            ? "success"
                            : "stopped"
                        }
                      >
                        {slackNotificationsEnabled === true
                          ? "Enabled"
                          : "Disabled"}
                      </StatusIndicator>
                    </div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>
              {slackNotificationsEnabled === true && <div>
                <Box variant="awsui-key-label">Slack Audit Channel</Box>
                <>
                  {" "}
                  {slackAuditNotificationsChannel !== null ? (
                    <div>{slackAuditNotificationsChannel || "<not set>"}</div>
                  ) : (
                    <Spinner />
                  )}
                </>
              </div>}
            </SpaceBetween>
          </ColumnLayout>
        </Container>
        <Modal
          onDismiss={() => handleDismiss()}
          visible={visible}
          closeAriaLabel="Close modal"
          size="large"
          header="Edit configuration settings"
        >
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={handleDismiss}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  onClick={handleSubmit}
                  loading={submitLoading}
                >
                  Submit
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween direction="vertical" size="l">
              <div>
                <Box variant="h3">Group settings</Box>
                <Box variant="small">TEAM admin and auditor group settings</Box>
                <Divider style={{ marginBottom: "1px", marginTop: "7px" }} />
              </div>
              <FormField
                label="TEAM admin Group"
                stretch
                description="Group of users responsible for managing TEAM administrative configurations"
              >
                <Select
                  statusType={groupStatus}
                  placeholder="Select Group"
                  loadingText="Loading Groups"
                  filteringType="auto"
                  empty="No groups found"
                  options={groups.map((group) => ({
                    label: group.DisplayName,
                    value: group.GroupId,
                    description: group.GroupId,
                  }))}
                  selectedOption={{ label: teamAdminGroup }}
                  onChange={({ detail }) => {
                    setTeamAdminGroup(detail.selectedOption.label);
                  }}
                  selectedAriaLabel="selected"
                />
              </FormField>
              <FormField
                label="TEAM auditor Group"
                stretch
                description="Group of users allowed to audit TEAM elevated access requests"
              >
                <Select
                  statusType={groupStatus}
                  placeholder="Select Group"
                  loadingText="Loading Groups"
                  filteringType="auto"
                  empty="No groups found"
                  options={groups.map((group) => ({
                    label: group.DisplayName,
                    value: group.GroupId,
                    description: group.GroupId,
                  }))}
                  selectedOption={{ label: teamAuditorGroup }}
                  onChange={({ detail }) => {
                    setTeamAuditorGroup(detail.selectedOption.label);
                  }}
                  selectedAriaLabel="selected"
                />
              </FormField>
              <div>
                <Box variant="h3">Request settings</Box>
                <Box variant="small">Controls access request requirements</Box>
                <Divider style={{ marginBottom: "1px", marginTop: "7px" }} />
              </div>
              <div>
                <FormField
                  label="Approval workflow"
                  stretch
                  description="If disabled, approval will not be required for all elevated access requests. If enabled, approval requirement is managed in eligibility policy configuration"
                >
                  <Toggle
                    onChange={({ detail }) => setApproval(detail.checked)}
                    checked={approval}
                  >
                    {approval ? "Enabled" : "Disabled"}
                  </Toggle>
                </FormField>
                <br />
                <FormField
                  label="Comments"
                  stretch
                  description="Determines if comment field is mandatory for all elevated access requests"
                >
                  <Toggle
                    onChange={({ detail }) => setComments(detail.checked)}
                    checked={comments}
                  >
                    {comments ? "Required" : "Not required"}
                  </Toggle>
                </FormField>
                <br />
                <FormField
                  label="Ticket number"
                  stretch
                  description="Determines if ticket number field is mandatory for elevated access requests"
                >
                  <Toggle
                    onChange={({ detail }) => setTicketNo(detail.checked)}
                    checked={ticketNo}
                  >
                    {ticketNo ? "Required" : "Not required"}
                  </Toggle>
                </FormField>
                <br />
                <FormField
                  label="Maximum request duration"
                  stretch
                  description="Default maximum request duration in hours"
                  errorText={durationError}
                >
                  <Input
                    value={duration}
                    onChange={(event) => {
                      setDurationError();
                      setDuration(event.detail.value);
                    }}
                    type="number"
                  />
                </FormField>
                <br />
                <FormField
                  label="Request expiry timeout"
                  stretch
                  description="Number of time in hours before an unapproved TEAM request expires"
                  errorText={expiryError}
                >
                  <Input
                    value={expiry}
                    onChange={(event) => {
                      setExpiryError();
                      setExpiry(event.detail.value);
                    }}
                    type="number"
                  />
                </FormField>
              </div>
              <div>
                <Box variant="h3">Notification settings</Box>
                <Box variant="small">
                  Notification settings for request and approval events
                </Box>
                <Divider style={{ marginBottom: "1px", marginTop: "7px" }} />
              </div>
              <FormField
                label="Email notifications"
                stretch
                description="Send notifications via Amazon SES"
              >
                <Toggle
                  onChange={({ detail }) => {
                    setSesNotificationsEnabled(detail.checked);
                  }}
                  checked={sesNotificationsEnabled}
                >
                  Send email notifications
                </Toggle>
              </FormField>
              {sesNotificationsEnabled && (
                <div>
                  <FormField
                    label="Source email"
                    stretch
                    description="Email address to send notifications from. Must be verified in SES."
                    errorText={sesSourceEmailError}
                  >
                    <Input
                      value={sesSourceEmail}
                      onChange={(event) => {
                        setSesSourceEmailError();
                        setSesSourceEmail(event.detail.value);
                      }}
                    >
                      Source email
                    </Input>
                  </FormField>
                  <br />
                  <FormField
                    label="Source ARN (Optional, for cross-account SES identities)"
                    stretch
                    description="ARN of a verified SES identity in another AWS account. Must be configured to authorize sending mail from the TEAM account."
                    errorText={sesSourceArnError}
                  >
                    <Input
                      value={sesSourceArn}
                      onChange={(event) => {
                        setSesSourceArnError();
                        setSesSourceArn(event.detail.value);
                      }}
                    >
                      Source email
                    </Input>
                  </FormField>
                </div>
              )}
              <FormField
                label="SNS notifications"
                stretch
                description="Send notifications via Amazon SNS. Once enabled, create a subscription to the SNS topic (TeamNotifications-main) in the TEAM account."
              >
                <Toggle
                  onChange={({ detail }) => {
                    setSnsNotificationsEnabled(detail.checked);
                  }}
                  checked={snsNotificationsEnabled}
                >
                  Send SNS notifications
                </Toggle>
              </FormField>
              <FormField
                label="Slack notifications"
                stretch
                description="Send notifications directly to users in Slack via a Slack bot app."
              >
                <Toggle
                  onChange={({ detail }) => {
                    setSlackNotificationsEnabled(detail.checked);
                  }}
                  checked={slackNotificationsEnabled}
                >
                  Send Slack notifications
                </Toggle>
              </FormField>
              {slackNotificationsEnabled && (
                <div>
                  <Button
                    ariaLabel="Install Slack App (opens new tab)"
                    href={slackAppInstallUrl}
                    iconAlign="right"
                    iconName="external"
                    target="_blank"
                  >
                    Install Slack App
                  </Button>
                  <br />
                  <br />
                  <FormField
                    label="Slack OAuth token"
                    stretch
                    description="Slack OAuth token associated with the installed app."
                    errorText={slackTokenError}
                  >
                    <Input
                      value={slackToken}
                      onChange={(event) => {
                        setSlackTokenError();
                        setSlackToken(event.detail.value);
                      }}
                      type="password"
                    >
                      Slack token
                    </Input>
                  </FormField>
                  <FormField
                    label="Slack Audit Channel"
                    stretch
                    description="(Optional) Channel to post notifications about all requests and approvals"
                  >
                    <Input value={slackAuditNotificationsChannel}
                      onChange={(event) => {
                        setSlackAuditNotificationsChannel(event.detail.value);
                      }}
                      type="text"
                    >
                      #channel-name
                    </Input>
                  </FormField>
                </div>
              )}
            </SpaceBetween>
          </Form>
        </Modal>
      </ContentLayout>
    </div>
  );
}

export default Settings;
