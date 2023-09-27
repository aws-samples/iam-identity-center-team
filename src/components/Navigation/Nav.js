// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useEffect, useState } from "react";
import AppLayout from "@awsui/components-react/app-layout";
import Navigation from "./Navigation";
import ToolsDrawer from "./ToolsDrawer";
import { BrowserRouter, Switch, Route } from "react-router-dom";
import Flashbar from "@awsui/components-react/flashbar";
import Request from "../Requests/Request";
import Approvals from "../Approvals/Approvals";
import Approvers from "../Admin/Approvers";
import Settings from "../Admin/Settings";
import View from "../Requests/View";
import Review from "../Approvals/Review";
import AuditApprovals from "../Audit/AuditApprovals";
import AuditSessions from "../Audit/AuditSessions";
import "../../index.css";
import Landing from "./Landing";
import Header from "./Header";
import Eligible from "../Admin/Eligible";
import Active from "../Sessions/Active";
import Audit from "../Sessions/Audit";
import { Amplify } from "aws-amplify";
import awsExports from "../../aws-exports";
Amplify.configure(awsExports);

function Nav(props) {
  const [notifications, setNotifications] = useState([]);
  const [activeHref, setActiveHref] = useState("/");
  const [cognitoGroups,setCognitoGroups] = useState([])
  const [User, setUser] = useState();
  const [group, setGroup] = useState();

  async function fetchUser() {
    try {
      setUser(props.user.attributes.email);
      setGroup(
        props.groups
      )
      setCognitoGroups(props.cognitoGroups);
    } catch (err) {
      console.log("error fetching user data");
    }
  }

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {User ? (
        <BrowserRouter>
          <div id="b">
            <div id="h">
              <Header
                user={User}
                setActiveHref={setActiveHref}
                addNotification={setNotifications}
              />
            </div>
          </div>
          <AppLayout
            className="main"
            notifications={<Flashbar items={notifications} />}
            navigation={
              <Navigation
                setActiveHref={setActiveHref}
                active={activeHref}
                user={User}
                group={group}
                cognitoGroups={cognitoGroups}
              />
            }
            tools={<ToolsDrawer></ToolsDrawer>}
            content={
              <Switch>
                <Route
                  path="/"
                  exact={true}
                  component={Landing}
                  setActiveHref={setActiveHref}
                />
                <Route path="/requests/request">
                  <Request
                    addNotification={setNotifications}
                    setActiveHref={setActiveHref}
                    user={User}
                    group={group}
                    userId={props.userId}
                    groupIds={props.groupIds}
                  />
                </Route>
                <Route path="/approvals/approve">
                  <Approvals
                    addNotification={setNotifications}
                    setActiveHref={setActiveHref}
                    user={User}
                    group={group}
                  />
                </Route>
                <Route path="/approvals/view">
                  <Review
                    addNotification={setNotifications}
                    setActiveHref={setActiveHref}
                    user={User}
                    group={group}
                  />
                </Route>
                <Route path="/requests/view">
                  <View
                    addNotification={setNotifications}
                    setActiveHref={setActiveHref}
                    user={User}
                    group={group}
                  />
                </Route>
                <Route path="/sessions/audit">
                  <Audit
                    addNotification={setNotifications}
                    setActiveHref={setActiveHref}
                    user={User}
                    group={group}
                  />
                </Route>
                <Route path="/sessions/active">
                  <Active
                    addNotification={setNotifications}
                    setActiveHref={setActiveHref}
                    user={User}
                    group={group}
                  />
                </Route>
                {group && group.includes("Admin") ? (
                  <Route path="/admin/approvers">
                    <Approvers
                      addNotification={setNotifications}
                      setActiveHref={setActiveHref}
                      user={User}
                      group={group}
                    />
                  </Route>
                ) : null}
                {group && group.includes("Admin") ? (
                  <Route path="/admin/policy">
                    <Eligible
                      addNotification={setNotifications}
                      setActiveHref={setActiveHref}
                      user={User}
                      group={group}
                    />
                  </Route>
                ) : null}
                {group && group.includes("Admin") ? (
                  <Route path="/admin/settings">
                    <Settings
                      addNotification={setNotifications}
                      setActiveHref={setActiveHref}
                      user={User}
                      group={group}
                    />
                  </Route>
                ) : null}
                {group && group.includes("Auditors") ? (
                  <Route path="/audit/approvals">
                    <AuditApprovals
                      addNotification={setNotifications}
                      setActiveHref={setActiveHref}
                      user={User}
                      group={group}
                    />
                  </Route>
                ) : null}
                {group && group.includes("Auditors") ? (
                  <Route path="/audit/sessions">
                    <AuditSessions
                      addNotification={setNotifications}
                      setActiveHref={setActiveHref}
                      user={User}
                      group={group}
                    />
                  </Route>
                ) : null}
              </Switch>
            }
          />
        </BrowserRouter>
      ) : (
        <> loading </>
      )}
    </div>
  );
}

// export default withAuthenticator(App);
export default Nav;
