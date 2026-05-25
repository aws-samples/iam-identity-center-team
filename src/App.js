// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useEffect, useState } from "react";
import { signInWithRedirect, fetchAuthSession } from "aws-amplify/auth";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { Layout } from "antd";
import Nav from "./components/Navigation/Nav";
import "./index.css";
import { Button, Spinner } from "@awsui/components-react";

const { Header, Content } = Layout;

function Home() {
  return (
    <Layout className="site-layout">
      <Header className="site-layout-background" style={{ padding: 0 }} />
      <Content className="layout">
        <Button
          className="homebutton"
          variant="primary"
          onClick={async () => {
            await signInWithRedirect({ provider: { custom: 'IDC' } });
          }}
        >
          Federated Sign In
        </Button>
        <img src="/Home.svg" alt="Homepage" className="home" />
      </Content>
    </Layout>
  );
}

function App() {
  const { user, authStatus } = useAuthenticator();
  const [groups, setGroups] = useState(null);
  const [cognitoGroups, setcognitoGroups] = useState([]);
  const [userId, setUserId] = useState(null);
  const [groupIds, setGroupIds] = useState(null);
  const [email, setEmail] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Wait for CSS to be applied before showing content (two frames for safety)
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsReady(true);
      });
    });
  }, []);

  useEffect(() => {
    // Handle auto-login from Access Portal (only if not already authenticated)
    if (sessionStorage.getItem('auto-login-pending') === 'true' && authStatus !== "authenticated") {
      // Don't remove flag until redirect completes - keeps spinner showing
      signInWithRedirect({ provider: { custom: 'IDC' } });
    }
    // Clear flag only when authenticated
    if (authStatus === "authenticated") {
      sessionStorage.removeItem('auto-login-pending');
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      loadUserData();
    }
  }, [authStatus]);

  async function loadUserData() {
    console.log("loadUserData() called, authStatus:", authStatus);
    try {
      const session = await fetchAuthSession();
      console.log("fetchAuthSession:", session);
      const payload = session.tokens?.idToken?.payload;
      console.log("payload:", payload);

      if (payload) {
        console.log("Setting user data from payload...");
        const groupsValue = (payload.groups || "").split(",");
        console.log("groups value:", groupsValue);
        setcognitoGroups(payload["cognito:groups"]);
        setUserId(payload.userId);
        setGroupIds((payload.groupIds || "").split(","));
        setGroups(groupsValue);
        setEmail(payload.email || payload["cognito:username"]?.replace("idc_", ""));
        console.log("User data set complete");
      }
    } catch (error) {
      console.log("Error loading user data:", error);
    }
  }

  // Show loading spinner while Amplify is configuring or CSS not ready
  if (authStatus === "configuring" || !isReady) {
    return (
      <div className="loading-container">
        <Spinner size="large" />
      </div>
    );
  }

  // Not authenticated - show login page
  if (authStatus !== "authenticated") {
    return <Home />;
  }

  // Authenticated but data not loaded yet
  if (!groups) {
    console.log("Waiting for groups, current value:", groups);
    return (
      <div className="loading-container">
        <Spinner size="large" />
      </div>
    );
  }
  console.log("Rendering Nav with groups:", groups);

  // Authenticated and data loaded
  return (
    <Nav
      user={user}
      email={email}
      groupIds={groupIds}
      userId={userId}
      groups={groups}
      cognitoGroups={cognitoGroups}
    />
  );
}

export default App;
