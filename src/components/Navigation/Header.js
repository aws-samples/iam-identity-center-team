// © 2021 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState } from "react";
import Alert from "@awsui/components-react/alert";
import "../../index.css";
import params from "../../parameters.json";
import { Auth } from "aws-amplify";
import TopNavigation from "@awsui/components-react/top-navigation";
import { useHistory } from "react-router-dom";

function Header(props) {
  const history = useHistory();
  const [visible, setVisible] = useState(false);

  async function signOut() {
    try {
      await Auth.signOut();
    } catch (error) {
      console.log("error signing out");
    }
  }

  function Notification() {
    return (
      <Alert
        dismissible
        statusIconAriaLabel="Info"
        header="Feature announcement"
        visible={visible}
        onDismiss={() => setVisible(false)}
      >
        🚀 TEAM v1.2.0 introduces support for the use of external repositories due to CodeCommit deprecation 
      </Alert>
    );
  }

  return (
    <div>
      <TopNavigation
        identity={{
          href: "/",
          logo: {
            src: "data:image/png;base64,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",
            alt: "TEAM",
          },
        }}
        utilities={[
          {
            type: "button",
            text: "IAM Identity Center",
            href: `${params.Login}`,
            external: true,
            externalIconAriaLabel: " (opens in a new tab)",
          },
          {
            type: "button",
            iconName: "notification",
            title: "Notifications",
            ariaLabel: "Notifications (unread)",
            badge: true,
            disableUtilityCollapse: false,
            onClick: () => setVisible(true),
          },
          {
            type: "button",
            text: "v1.4.1",
            href: "https://github.com/aws-samples/iam-identity-center-team/releases/tag/v1.4.1",
            external: true,
            externalIconAriaLabel: " (opens in a new tab)",
          },
          {
            type: "menu-dropdown",
            text: `${props.user}`,
            description: `${props.user}`,
            iconName: "user-profile",
            onItemClick: ({ detail }) => {
              if (detail.id === "signout") {
                signOut().then(() => history.push("/"));
              }
            },
            items: [
              { id: "signout", text: "Sign out" },
              {
                id: "support-group",
                text: "Support",
                items: [
                  {
                    id: "documentation",
                    text: "Documentation",
                    href: "https://aws-samples.github.io/iam-identity-center-team/",
                    external: true,
                    externalIconAriaLabel: " (opens in new tab)",
                  },
                  { id: "support", text: "Support" },
                  {
                    id: "feedback",
                    text: "Feedback",
                    href: "https://pulse.aws/survey/PZDTVK85",
                    external: true,
                    externalIconAriaLabel: " (opens in new tab)",
                  },
                  {
                    id: "bug",
                    text: "Report Bug",
                    href: "https://github.com/aws-samples/iam-identity-center-team/issues",
                    external: true,
                    externalIconAriaLabel: " (opens in new tab)",
                  },
                ],
              },
            ],
          },
        ]}
        onFollow={() => {
          history.push("/");
          props.setActiveHref("/");
          props.addNotification([]);
        }}
      />
      <Notification />
    </div>
  );
}

export default Header;
