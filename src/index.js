// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. // SPDX-License-Identifier: MIT-0
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import "@awsui/global-styles/index.css";
import { Amplify } from "aws-amplify";
import awsconfig from "./aws-exports";

// Amplify JS v6 only redirects to URLs on the current origin, but TEAM can be
// served from a custom domain (deployment/cognito.sh) not listed in aws-exports.
const origin = `${window.location.origin}/`;
Amplify.configure({
  ...awsconfig,
  oauth: {
    ...awsconfig.oauth,
    redirectSignIn: `${awsconfig.oauth.redirectSignIn},${origin}`,
    redirectSignOut: `${awsconfig.oauth.redirectSignOut},${origin}`,
  },
});

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
