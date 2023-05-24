// © 2021 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
/* eslint-disable jsx-a11y/anchor-is-valid */
import React from "react";
import Logout from "./Logout";
import { SpaceBetween, ColumnLayout } from "@awsui/components-react";
import "../../index.css";
import teamlogo from "../../media/teamlogo.png";
import params from "../../parameters.json";
import { useHistory } from "react-router-dom";

function Header(props) {
  const history = useHistory();
  return (
    <div className="header">
      <ColumnLayout columns={2} className="collapse">
        <div>
          <SpaceBetween direction="horizontal">
            {/* <img src={teamlogo} alt="logo" className="topleft" /> */}
            <div className="topleft">
            <a
                onClick={() => {
                  history.push("/");
                  props.setActiveHref("/");
                  props.addNotification([])
                }}
                className="topleft"
              >
                TEAM
              </a>
            </div>
            <div className="pim">
              <a
                onClick={() => {
                  history.push("/");
                  props.setActiveHref("/");
                  props.addNotification([])
                }}
                className="pim"
              >
                Temporary Elevated Access Management
              </a>
            </div>
          </SpaceBetween>
        </div>
        <div className="topright">
          {/* <Box float="right"> */}
          <SpaceBetween direction="horizontal" size="xs">
            <a
              className="a"
              href={params.Login}
              target="_blank"
              rel="noopener noreferrer"
            >
              IAM Identity Center
            </a>
            <div className="separated">
              <Logout user={props.user} />
            </div>
          </SpaceBetween>
          {/* </Box> */}
        </div>
      </ColumnLayout>
    </div>
  );
}

export default Header;
