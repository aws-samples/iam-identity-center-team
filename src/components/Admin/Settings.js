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
import { ContentLayout, Modal, Toggle, Form, FormField, Input, Spinner } from "@awsui/components-react";
import StatusIndicator from "@awsui/components-react/status-indicator";
import { Divider } from "antd";
import "../../index.css";
import { getSetting, createSetting, updateSetting } from "../Shared/RequestService";

function Settings(props) {
  const [duration, setDuration] = useState(null);
  const [durationError, setDurationError] = useState("")
  const [expiry, setExpiry] = useState(null);
  const [expiryError, setExpiryError] = useState("")
  const [comments, setComments] = useState(null);
  const [ticketNo, setTicketNo] = useState(null);
  const [approval, setApproval] = useState(null);
  const [visible, setVisible] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [item, setItem] = useState(null);

  useEffect(() => {
    views();
  }, []);

  function views() {
      setVisible(false);
      setSubmitLoading(false);
      getSettings()
    };
  
    async function validate() {
      let error = false;
      if (!duration || isNaN(duration) || Number(duration) > 8000 ||  Number(duration) < 1) {
        setDurationError(`Enter valid duration as a number between 1 - 8000`);
        error = true;
      }
      if (!expiry || isNaN(expiry) || Number(expiry) > 8000 || Number(expiry) < 1) {
        setExpiryError(`Enter valid expiry timeout as a number between 1 - 8000`);
        error = true;
      }
      return error;
    }

  function handleEdit() {
    setVisible(true);
  }
  function handleDismiss() {
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
  }
  else setSubmitLoading(false)
  }

  function getSettings(){
    getSetting("settings").then((data) => {
      if (data !== null) {
        setItem(data);
        setDuration(data.duration);
        setExpiry(data.expiry);
        setComments(data.comments);
        setTicketNo(data.ticketNo);
        setApproval(data.approval);
      } else {
        setDuration("9");
        setExpiry("3");
        setComments(true);
        setTicketNo(true);
        setApproval(true);
      }
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
                <Box variant="h3">Timer settings</Box>
                <Box variant="small">Request Form timer settings</Box>
                <Divider style={{ marginBottom: "7px", marginTop: "7px" }} />
              </div>
              <div>
                <Box variant="awsui-key-label">Max request duration</Box>
               <> {duration !== null ?  <div>{duration} hours</div> : <Spinner />  }</>
              </div>
              <div>
                <Box variant="awsui-key-label">Request expiry timeout</Box>
                <> {expiry !== null ? <div>{expiry} hours</div> : <Spinner /> }</>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="h3">Mandatory fields</Box>
                <Box variant="small">Request Form mandatory fields</Box>
                <Divider style={{ marginBottom: "7px", marginTop: "7px" }} />
              </div>
              <div>
                <Box variant="awsui-key-label">Comments</Box>
                <> {comments !== null ? <div>{comments === true ? "On" : "Off"}</div> : <Spinner /> }</>
              </div>
              <div>
                <Box variant="awsui-key-label">Ticket number</Box>
                <> {ticketNo !== null ? <div>{ticketNo === true ? "On" : "Off"}</div> : <Spinner /> }</>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              <div>
                <Box variant="h3">Workflow settings</Box>
                <Box variant="small">Request approval workflow settings</Box>
                <Divider style={{ marginBottom: "7px", marginTop: "7px" }} />
              </div>
              <div>
                <Box variant="awsui-key-label">Approval required</Box>
                <> {approval !== null ? 
                <div>
                  <StatusIndicator type={approval === true ? "success" : "error"}>
                    {approval === true ? "Yes" : "No"}
                  </StatusIndicator>
                </div>
                :<Spinner /> 
                }</>
              </div>
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
                <Button
                  variant="link"
                  onClick={handleDismiss}
                >
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
                <Box variant="h3">Timer settings</Box>
                <Box variant="small">Request Form timer settings</Box>
                <Divider style={{ marginBottom: "1px", marginTop: "7px" }} />
              </div>
              <FormField
                label="Max request duration"
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
              <div>
                <Box variant="h3">Mandatory fields</Box>
                <Box variant="small">Request Form mandatory fields</Box>
                <Divider style={{ marginBottom: "1px", marginTop: "7px" }} />
              </div>
              <FormField
                label="Comments"
                stretch
                description="Determines if comment field is mandatory"
              >
                <Toggle
                  onChange={({ detail }) => setComments(detail.checked)}
                  checked={comments}
                >
                  Comments
                </Toggle>
              </FormField>
              <FormField
                label="Ticket number"
                stretch
                description="Determines if ticket number field is mandatory"
              >
                <Toggle
                  onChange={({ detail }) => setTicketNo(detail.checked)}
                  checked={ticketNo}
                >
                  Ticket number
                </Toggle>
              </FormField>
              <div>
                <Box variant="h3">Workflow Settings</Box>
                <Box variant="small">Request approval workflow settings</Box>
                <Divider style={{ marginBottom: "1px", marginTop: "7px" }} />
              </div>
              <FormField
                label="Approval required"
                stretch
                description="Turn on/off approval workflow for all elevated access request"
              >
                <Toggle
                  onChange={({ detail }) => setApproval(detail.checked)}
                  checked={approval}
                >
                  Approval required
                </Toggle>
              </FormField>
            </SpaceBetween>
          </Form>
        </Modal>
      </ContentLayout>
    </div>
  );
}

export default Settings;
