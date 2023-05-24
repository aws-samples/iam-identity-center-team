// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React from "react";
import { Box, SpaceBetween, ColumnLayout } from "@awsui/components-react";
import { Divider } from "antd";
import Status from "./Status";
import Timer from "../Sessions/Timer";
import "../../index.css";
import "antd/dist/antd.css";

function convertAwsDateTime(awsDateTime) {
  // Parse AWS datetime string into a Date object
  const date = new Date(awsDateTime);
  // Format date in user-friendly format
  const options = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  };
  const userFriendlyFormat = date.toLocaleString('en-US', options);
  return userFriendlyFormat
}

function Details(props) {
  const ValueWithLabel = ({ label, children }) => (
    <div>
      <div className="headings">
        <Box color="inherit" fontSize="body-m">
          {label}
        </Box>
      </div>
      <div>{children}</div>
    </div>
  );

  const startTime = convertAwsDateTime(props.item.startTime)

  return (
    <SpaceBetween size="s">
      <ColumnLayout columns={3} variant="text-grid">
        <SpaceBetween size="l">
          <ValueWithLabel label="Requester" children={`${props.item.email}`} />
          <ValueWithLabel label="Status">
            <Status status={props.item.status} />
          </ValueWithLabel>
          <ValueWithLabel
            label="Justification"
            children={`${props.item.justification}`}
          />
        </SpaceBetween>
        <SpaceBetween size="l">
          <ValueWithLabel
            label="Account"
            children={`${props.item.accountName} (${props.item.accountId})`}
          />
          <ValueWithLabel label="Role" children={`${props.item.role}`} />
          <ValueWithLabel
            label="Ticket no"
            children={`${props.item.ticketNo}`}
          />
        </SpaceBetween>
        <SpaceBetween size="l">
          <ValueWithLabel
            label="Start time"
            children={`${startTime}`}
          />
          <ValueWithLabel
            label="Duration"
            children={`${props.item.duration} Hours`}
          />
          <Timer item={props.item} expiry={props.expiry}/>
        </SpaceBetween>
      </ColumnLayout>

      <div>
        {props.item.approver && (
          <div>
            <Divider style={{ marginBottom: "10px", marginTop: "10px" }} />
            <ColumnLayout columns={3}>
              <SpaceBetween size="m">
                <ValueWithLabel
                  label="Approved by"
                  children={`${props.item.approver}`}
                />
                <ValueWithLabel
                  label="Comments"
                  children={`${props.item.comment}`}
                />
              </SpaceBetween>
            </ColumnLayout>
          </div>
        )}
      </div>
    </SpaceBetween>
  );
}

export default Details;
