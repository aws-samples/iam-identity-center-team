// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. // SPDX-License-Identifier: MIT-0
import React, { Suspense } from "react";
import ReactDOM from "react-dom";
import { Amplify } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-react";
import awsconfig from "../amplify_outputs.json";
import "@awsui/global-styles/index.css";
import "./index.css";
import { Spin } from "antd";

// Configure Amplify BEFORE loading App to handle OAuth callback
Amplify.configure(awsconfig);

// Handle auto-login from Access Portal
// When user clicks app in Access Portal, they are redirected here with ?auto_login=true
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('auto_login') === 'true') {
  window.history.replaceState({}, '', window.location.pathname);
  sessionStorage.setItem('auto-login-pending', 'true');
}

// Lazy load App to ensure Amplify is configured first
const App = React.lazy(() => import("./App"));

const LoadingSpinner = () => (
  <div className="loading-container">
    <Spin size="large" />
  </div>
);

ReactDOM.render(
  <React.StrictMode>
    <Authenticator.Provider>
      <Suspense fallback={<LoadingSpinner />}>
        <App />
      </Suspense>
    </Authenticator.Provider>
  </React.StrictMode>,
  document.getElementById("root")
);
