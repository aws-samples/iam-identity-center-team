// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Header,
  Pagination,
  Table,
  TextFilter,
  SpaceBetween,
  CollectionPreferences,
  Multiselect,
  TextContent,
  Modal,
  FormField,
  ButtonDropdown,
  Form,
  ColumnLayout,
  Toggle,
  Input,
  Spinner,
  Grid
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import Ous from "../Shared/Ous";
import { API, graphqlOperation } from "aws-amplify";
import { onPublishOUs, onPublishPermissions } from "../../graphql/subscriptions";
import {
  fetchAccounts,
  fetchOUs,
  fetchPermissions,
  getAllPolicies,
  addPolicyTemplate,
  editPolicyTemplate,
  delPolicyTemplate,
  getSetting,
  getAllApprovers,
  getPolicyUsage
} from "../Shared/RequestService";
import "../../index.css";

const COLUMN_DEFINITIONS = [
  {
    id: "id",
    sortingField: "id",
    header: "Name",
    cell: (item) => item.id,
    width: 200,
  },
  {
    id: "accounts",
    sortingField: "accounts",
    header: "Accounts",
    cell: (item) => (
      <>{item.accounts && item.accounts.length > 0 ? (
        <TextContent>
          <ul>
            {item.accounts.map(({ name }) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </TextContent>
      ) : (
        <TextContent><ul>-</ul></TextContent>
      )}</>
    ),
    width: 200,
  },
  {
    id: "ous",
    sortingField: "ous",
    header: "OUs",
    cell: (item) => (
      <>{item.ous && item.ous.length > 0 ? (
        <TextContent>
          <ul>
            {item.ous.map(({ name }) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </TextContent>
      ) : (
        <TextContent><ul>-</ul></TextContent>
      )}</>
    ),
    width: 200,
  },
  {
    id: "permissions",
    sortingField: "permissions",
    header: "Permissions",
    cell: (item) => (
      <>{item.permissions && item.permissions.length > 0 ? (
        <TextContent>
          <ul>
            {item.permissions.map(({ name }) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </TextContent>
      ) : (
        <TextContent><ul>-</ul></TextContent>
      )}</>
    ),
    width: 200,
  },
  {
    id: "duration",
    sortingField: "duration",
    header: "Max duration",
    cell: (item) => `${item.duration} hours`,
    width: 120,
  },
  {
    id: "approvalRequired",
    sortingField: "approvalRequired",
    header: "Approval required",
    cell: (item) => item.approvalRequired ? "Yes" : "No",
    width: 130,
  },
  {
    id: "approverGroupIds",
    sortingField: "approverGroupIds",
    header: "Approver Groups",
    cell: (item) => (
      <>{item.approverGroupIds && item.approverGroupIds.length > 0 ? (
        <TextContent>
          <ul>
            {item.approverGroupIds.map(({ name }) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </TextContent>
      ) : (
        <TextContent><ul>-</ul></TextContent>
      )}</>
    ),
    width: 200,
  },
];

const MyCollectionPreferences = ({ preferences, setPreferences }) => {
  return (
    <CollectionPreferences
      title="Preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: "Page size",
        options: [
          { value: 10, label: "10 Policies" },
          { value: 30, label: "30 Policies" },
          { value: 50, label: "50 Policies" },
        ],
      }}
      wrapLinesPreference={{
        label: "Wrap lines",
        description: "Check to see all the text and wrap the lines",
      }}
      visibleContentPreference={{
        title: "Select visible columns",
        options: [
          {
            label: "Policy properties",
            options: [
              { id: "id", label: "Name" },
              { id: "accounts", label: "Accounts" },
              { id: "ous", label: "OUs" },
              { id: "permissions", label: "Permissions" },
              { id: "duration", label: "Max duration" },
              { id: "approvalRequired", label: "Approval required" },
              { id: "approverGroupIds", label: "Approver Groups" },
            ],
          },
        ],
      }}
    />
  );
};

function EmptyState({ title, subtitle, action }) {
  return (
    <Box textAlign="center">
      <Box variant="strong">{title}</Box>
      <Box variant="p" padding={{ bottom: "s" }}>
        {subtitle}
      </Box>
      {action}
    </Box>
  );
}

function Policies(props) {
  const [allItems, setAllItems] = useState([]);
  const [preferences, setPreferences] = useState({
    pageSize: 10,
    visibleContent: [
      "id",
      "accounts",
      "ous",
      "permissions",
      "duration",
      "approvalRequired",
      "approverGroupIds"
    ],
  });

  const SEARCHABLE_COLUMNS = COLUMN_DEFINITIONS.map((item) => item.id);

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    filterProps,
    paginationProps,
  } = useCollection(allItems, {
    filtering: {
      filteringFunction: (item, filteringText) => {
        const filteringTextLowerCase = filteringText.toLowerCase();
        return SEARCHABLE_COLUMNS.map((key) => item[key]).some(
          (value) =>
            typeof value === "string" &&
            value.toLowerCase().indexOf(filteringTextLowerCase) > -1
        );
      },
      empty: (
        <EmptyState
          title="No Policies"
          subtitle="No policy templates to display."
          action={<Button onClick={handleAdd}>Create policy</Button>}
        />
      ),
      noMatch: (
        <EmptyState
          title="No matches"
          subtitle="Your search didn't return any records."
          action={
            <Button onClick={() => actions.setFiltering("")}>
              Clear filter
            </Button>
          }
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: {},
    selection: {},
  });

  const { selectedItems } = collectionProps;
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);

  const [policyName, setPolicyName] = useState("");
  const [policyNameError, setPolicyNameError] = useState("");
  const [duration, setDuration] = useState("9");
  const [durationError, setDurationError] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [account, setAccount] = useState([]);
  const [accountError, setAccountError] = useState("");
  const [ou, setOU] = useState([]);
  const [ouError, setOuError] = useState("");
  const [permission, setPermission] = useState([]);
  const [permissionError, setPermissionError] = useState("");
  const [approverGroup, setApproverGroup] = useState([]);
  const [approverGroupError, setApproverGroupError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountStatus, setAccountStatus] = useState("finished");

  const [groups, setGroups] = useState([]);
  const [groupStatus, setGroupStatus] = useState("finished");

  const [ous, setOUs] = useState([]);
  const [ouStatus, setOUStatus] = useState("finished");

  const [permissions, setPermissions] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState("finished");

  useEffect(() => {
    views();
    props.addNotification([]);
    getOUs();
    getAccounts();
    getPermissions();
    getApproverGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function views() {
    getAllPolicies().then((items) => {
      if (items.error) {
        setAllItems([]);
        props.addNotification([
          {
            type: "error",
            content: items.error.message,
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          }
        ])
      } else {
        setAllItems(items);
      }
      setTableLoading(false);
      setRefreshLoading(false);
      setConfirmLoading(false);
      setSubmitLoading(false);
      setVisible(false);
      setDeleteVisible(false);
      handleDismiss();
      getSettings();
    });
  }

  function handleRefresh() {
    setRefreshLoading(true);
    setTableLoading(true);
    props.addNotification([]);
    views();
  }

  function getSettings() {
    getSetting("settings").then((data) => {
      if (data !== null) {
        setDuration(data.duration);
      }
    });
  }

  function handleAdd() {
    setVisible(true);
  }

  function handleSelect(data) {
    if (data.detail.id === "delete") {
      setDeleteVisible(true);
    } else {
      handleEdit();
    }
  }

  async function handleDelete() {
    setConfirmLoading(true);
    for (const item of selectedItems) {
      // Check if policy is used in any eligibility
      const usedInEligibilities = await getPolicyUsage(item.id);
      if (usedInEligibilities.length > 0) {
        setConfirmLoading(false);
        setDeleteVisible(false);
        props.addNotification([
          {
            type: "error",
            content: `Cannot delete policy "${item.id}" - it is used in ${usedInEligibilities.length} eligibility/eligibilities. Remove it from eligibilities first.`,
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          },
        ]);
        return;
      }
      const data = {
        id: item.id,
      };
      await delPolicyTemplate(data);
    }
    views();
    setConfirmLoading(false);
    setDeleteVisible(false);
    props.addNotification([
      {
        type: "success",
        content: "Policy deleted successfully",
        dismissible: true,
        onDismiss: () => props.addNotification([]),
      },
    ]);
  }

  function handleConfirmEdit() {
    validate("edit").then((valid) => {
      if (valid) {
        setConfirmLoading(true);
        const data = {
          id: selectedItems[0].id,
          accounts: account.map(({ value, label }) => ({ name: label, id: value })),
          permissions: permission.map(({ value, label }) => ({ name: label, id: value })),
          ous: ou.map(({ value, label }) => ({ name: label, id: value })),
          approvalRequired: approvalRequired,
          approverGroupIds: approverGroup.map(({ value, label }) => ({ name: label, id: value })),
          duration: duration
        };
        editPolicyTemplate(data)
          .then(() => {
            views();
            props.addNotification([
              {
                type: "success",
                content: "Policy updated successfully",
                dismissible: true,
                onDismiss: () => props.addNotification([]),
              },
            ]);
          })
          .catch((err) => {
            const errorMessage = err?.errors?.[0]?.message || "Failed to update policy";
            props.addNotification([
              {
                type: "error",
                content: errorMessage,
                dismissible: true,
                onDismiss: () => props.addNotification([]),
              },
            ]);
          });
      }
    });
  }

  function handleEdit() {
    setAccount(
      selectedItems[0].accounts?.map((data) => ({
        label: data.name,
        value: data.id,
        description: data.id,
      })) || []
    );
    setOU(
      selectedItems[0].ous?.map((data) => ({
        label: data.name,
        value: data.id,
        description: data.id,
      })) || []
    );
    setPermission(
      selectedItems[0].permissions?.map((data) => ({
        label: data.name,
        value: data.id,
        description: data.id,
      })) || []
    );
    setApprovalRequired(selectedItems[0].approvalRequired);
    setDuration(selectedItems[0].duration);
    // Set selected approver groups from existing data
    setApproverGroup(
      selectedItems[0].approverGroupIds?.map((data) => ({
        label: data.name,
        value: data.id,
        description: groups.find(g => g.id === data.id)
          ? `Approver groups: ${groups.find(g => g.id === data.id)?.approvers?.join(', ') || '-'}`
          : data.id,
      })) || []
    );
    setEditVisible(true);
  }

  function getApproverGroups() {
    setGroupStatus("loading");
    return getAllApprovers().then((data) => {
      if (data.error) {
        setApproverGroupError(data.error.message);
        setGroups([]);
        return [];
      } else {
        const filtered = data.filter((item) => item.type === "Group");
        setGroups(filtered);
        return filtered;
      }
    }).finally(() => {
      setGroupStatus("finished");
    });
  }

  function getOUs() {
    setOUStatus("loading");
    fetchOUs().then(() => {
      const subscription = API.graphql(
        graphqlOperation(onPublishOUs)
      ).subscribe({
        next: (result) => {
          const data = result.value.data.onPublishOUs.ous;
          setOUs(JSON.parse(data));
          setOUStatus("finished");
          subscription.unsubscribe();
        },
      });
    });
  }

  function getAccounts() {
    setAccountStatus("loading");
    fetchAccounts().then((data) => {
      setAccounts(data || []);
      setAccountStatus("finished");
    });
  }

  function getPermissions() {
    setPermissionStatus("loading");
    fetchPermissions().then((data) => {
      const subscription = API.graphql(
        graphqlOperation(onPublishPermissions)
      ).subscribe({
        next: (result) => {
          if (result.value.data.onPublishPermissions.id === data.id) {
            setPermissions(result.value.data.onPublishPermissions.permissions);
            setPermissionStatus("finished");
            subscription.unsubscribe();
          }
        },
      });
    });
  }

  async function validate(action) {
    let valid = true;
    if (permission.length < 1) {
      valid = false;
      setPermissionError("Select permission set");
    }
    if (ou.length < 1 && account.length < 1) {
      valid = false;
      setOuError("Select OUs and/or Accounts");
      setAccountError("Select OUs and/or Accounts");
    }
    if (!duration || isNaN(duration) || Number(duration) > 8000 || Number(duration) < 1) {
      setDurationError("Enter number between 1-8000");
      valid = false;
    }
    if (!policyName && action === "submit") {
      setPolicyNameError("Enter a policy name");
      valid = false;
    }
    if (action === "submit" && policyName) {
      if (!/^[a-zA-Z0-9\-_#]+$/.test(policyName.trim())) {
        setPolicyNameError("Policy name can only contain alphanumeric characters, hyphens, underscores and #");
        valid = false;
      } else if (policyName.trim().length > 2048) {
        setPolicyNameError("Policy name exceeds maximum length of 2048 characters");
        valid = false;
      } else {
        // Check if policy name already exists
        const nameExists = allItems.some(
          (item) => item.id.toLowerCase() === policyName.toLowerCase()
        );
        if (nameExists) {
          setPolicyNameError("Policy with this name already exists");
          valid = false;
        }
      }
    }
    if (approvalRequired && approverGroup.length < 1) {
      setApproverGroupError("Select approver groups when approval is required");
      valid = false;
    }
    return valid;
  }

  function handleSubmit(event) {
    setSubmitLoading(true);
    validate("submit").then((valid) => {
      if (valid) {
        event.preventDefault();
        const data = {
          id: policyName,
          accounts: account.map(({ value, label }) => ({ name: label, id: value })),
          permissions: permission.map(({ value, label }) => ({ name: label, id: value })),
          ous: ou.map(({ value, label }) => ({ name: label, id: value })),
          approvalRequired: approvalRequired,
          approverGroupIds: approverGroup.map(({ value, label }) => ({ name: label, id: value })),
          duration: duration
        };
        addPolicyTemplate(data)
          .then(() => {
            views();
            props.addNotification([
              {
                type: "success",
                content: "Policy added successfully",
                dismissible: true,
                onDismiss: () => props.addNotification([]),
              },
            ]);
          })
          .catch((err) => {
            setSubmitLoading(false);
            const errorMessage = err?.errors?.[0]?.message || "Failed to create policy";
            props.addNotification([
              {
                type: "error",
                content: errorMessage,
                dismissible: true,
                onDismiss: () => props.addNotification([]),
              },
            ]);
          });
      } else {
        setSubmitLoading(false);
      }
    });
  }

  function handleDismiss() {
    setVisible(false);
    setDeleteVisible(false);
    setEditVisible(false);
    setPolicyName("");
    setPolicyNameError("");
    setAccount([]);
    setAccountError("");
    setOU([]);
    setOuError("");
    setPermission([]);
    setPermissionError("");
    setApproverGroup([]);
    setApproverGroupError("");
    setDurationError("");
    setSubmitLoading(false);
  }

  const ValueWithLabel = ({ label, children }) => (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <div>{children}</div>
    </div>
  );

  return (
    <div className="container">
      <Table
        {...collectionProps}
        resizableColumns="true"
        loading={tableLoading}
        loadingText="Fetching policies"
        wrapLines
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${allItems.length})`
                : `(${allItems.length})`
            }
            actions={
              <SpaceBetween size="s" direction="horizontal">
                <Button
                  iconName="refresh"
                  onClick={handleRefresh}
                  loading={refreshLoading}
                />
                <ButtonDropdown
                  items={[
                    {
                      text: "Edit",
                      id: "edit",
                      disabled:
                        selectedItems.length === 0 || selectedItems.length > 1,
                    },
                    {
                      text: "Delete",
                      id: "delete",
                      disabled: selectedItems.length === 0,
                    },
                  ]}
                  onItemClick={(props) => handleSelect(props)}
                >
                  Actions
                </ButtonDropdown>
                <Button variant="primary" onClick={handleAdd}>
                  Add policy
                </Button>
              </SpaceBetween>
            }
            description="Reusable policy templates that can be assigned to users and groups"
          >
            Eligibility policies
          </Header>
        }
        filter={
          <div className="input-container">
            <TextFilter
              {...filterProps}
              filteringPlaceholder="Find policy"
              countText={filteredItemsCount}
              className="input-filter"
            />
          </div>
        }
        columnDefinitions={COLUMN_DEFINITIONS}
        visibleColumns={preferences.visibleContent}
        pagination={<Pagination {...paginationProps} />}
        preferences={
          <MyCollectionPreferences
            preferences={preferences}
            setPreferences={setPreferences}
          />
        }
        items={items}
        selectionType="multi"
      />
      {/* Add Policy Modal */}
      <Modal
        onDismiss={() => handleDismiss()}
        visible={visible}
        closeAriaLabel="Close modal"
        size="large"
        header="Create Policy Template"
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
                Create policy
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              label="Policy Name"
              stretch
              description="Unique name for this policy template"
              errorText={policyNameError}
            >
              <Input
                value={policyName}
                onChange={(event) => {
                  setPolicyNameError("");
                  setPolicyName(event.detail.value);
                }}
              />
            </FormField>
            <FormField
              label="Accounts"
              stretch
              description="List of eligible accounts"
              errorText={accountError}
            >
              <Multiselect
                statusType={accountStatus}
                placeholder="Select accounts"
                loadingText="Loading accounts"
                filteringType="auto"
                empty="No options"
                options={accounts.map((account) => ({
                  label: account.name,
                  value: account.id,
                  description: account.id,
                }))}
                selectedOptions={account}
                onChange={({ detail }) => {
                  setAccountError("");
                  setAccount(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
            <FormField
              label="OUs"
              stretch
              description="List of eligible OUs"
              errorText={ouError}
            >
              {ous.length === 1 ? (
                <Ous
                  options={ous}
                  setResource={setOU}
                  resource={ou}
                />
              ) : (
                <Spinner size="large" />
              )}
            </FormField>
            <FormField
              label="Permissions"
              stretch
              description="List of eligible permission sets"
              errorText={permissionError}
            >
              <Multiselect
                statusType={permissionStatus}
                placeholder="Select Permissions"
                loadingText="Loading Permissions"
                filteringType="auto"
                empty="No options"
                options={permissions.map((permission) => ({
                  label: permission.Name,
                  value: permission.Arn,
                  description: permission.Arn,
                }))}
                selectedOptions={permission}
                onChange={({ detail }) => {
                  setPermissionError("");
                  setPermission(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
            <FormField
              label="Max duration"
              stretch
              description="Maximum elevated access request duration in hours"
              errorText={durationError}
            >
              <Input
                value={duration}
                onChange={(event) => {
                  setDurationError("");
                  event.detail.value > 8000
                    ? setDurationError("Enter a number between 1 and 8000")
                    : setDuration(event.detail.value);
                }}
                type="number"
              />
            </FormField>
            <FormField
              label="Approval required"
              stretch
              description="Determines if approval is required for elevated access"
            >
              <Toggle
                onChange={({ detail }) => setApprovalRequired(detail.checked)}
                checked={approvalRequired}
              >
                Approval required
              </Toggle>
            </FormField>
            {approvalRequired && (
              <FormField
                label="Approver Groups"
                stretch
                description="Groups that can approve requests using this policy"
                errorText={approverGroupError}
              >
                <SpaceBetween direction="vertical" size="xs">
                  <Grid gridDefinition={[{ colspan: 11 }, { colspan: 1 }]}>
                    <Multiselect
                      statusType={groupStatus}
                      placeholder="Select approver groups"
                      loadingText="Loading groups"
                      filteringType="auto"
                      empty="No options"
                      options={groups.map((group) => ({
                        label: group.id,
                        value: group.id,
                        description: `Approver groups: ${group.approvers?.join(', ') || '-'}`,
                      }))}
                      selectedOptions={approverGroup}
                      onChange={({ detail }) => {
                        setApproverGroupError("");
                        setApproverGroup(detail.selectedOptions);
                      }}
                      selectedAriaLabel="selected"
                      deselectAriaLabel={(e) => `Remove ${e.label}`}
                    />
                    <Button
                      iconName="refresh"
                      onClick={getApproverGroups}
                      loading={groupStatus === "loading"}
                    />
                  </Grid>
                  <Button
                    iconName="external"
                    iconAlign="right"
                    variant="link"
                    onClick={() => window.open("/admin/approvers", "_blank")}
                  >
                    Create new approver group
                  </Button>
                </SpaceBetween>
              </FormField>
            )}
          </SpaceBetween>
        </Form>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal
        onDismiss={() => setDeleteVisible(false)}
        visible={deleteVisible}
        closeAriaLabel="Close modal"
        size="medium"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setDeleteVisible(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDelete}
                loading={confirmLoading}
              >
                Confirm
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete policy"
      >
        Are you sure you want to delete the selected policy template(s)?
      </Modal>
      {/* Edit Policy Modal */}
      {selectedItems.length > 0 && (
        <Modal
          onDismiss={() => handleDismiss()}
          visible={editVisible}
          closeAriaLabel="Close modal"
          size="large"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={handleDismiss}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmEdit}
                  loading={confirmLoading}
                >
                  Confirm
                </Button>
              </SpaceBetween>
            </Box>
          }
          header="Edit policy"
        >
          <SpaceBetween size="l">
            <ColumnLayout columns={1} variant="text-grid">
              <ValueWithLabel label="Policy Name">
                {selectedItems[0].id}
              </ValueWithLabel>
            </ColumnLayout>
            <FormField
              label="Accounts"
              stretch
              description="List of eligible accounts"
              errorText={accountError}
            >
              <Multiselect
                statusType={accountStatus}
                placeholder="Select accounts"
                loadingText="Loading accounts"
                filteringType="auto"
                empty="No options"
                options={accounts.map((account) => ({
                  label: account.name,
                  value: account.id,
                  description: account.id,
                }))}
                selectedOptions={account}
                onChange={({ detail }) => {
                  setAccountError("");
                  setAccount(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
            <FormField
              label="OUs"
              stretch
              description="List of eligible OUs"
              errorText={ouError}
            >
              {ous.length === 1 ? (
                <Ous
                  options={ous}
                  setResource={setOU}
                  resource={ou}
                />
              ) : (
                <Spinner size="large" />
              )}
            </FormField>
            <FormField
              label="Permissions"
              stretch
              description="List of eligible permission sets"
              errorText={permissionError}
            >
              <Multiselect
                statusType={permissionStatus}
                placeholder="Select Permissions"
                loadingText="Loading Permissions"
                filteringType="auto"
                empty="No options"
                options={permissions.map((permission) => ({
                  label: permission.Name,
                  value: permission.Arn,
                  description: permission.Arn,
                }))}
                selectedOptions={permission}
                onChange={({ detail }) => {
                  setPermissionError("");
                  setPermission(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
            <FormField
              label="Max duration"
              stretch
              description="Maximum elevated access request duration in hours"
              errorText={durationError}
            >
              <Input
                value={duration}
                onChange={(event) => {
                  setDurationError("");
                  event.detail.value > 8000
                    ? setDurationError("Enter a number between 1 and 8000")
                    : setDuration(event.detail.value);
                }}
                type="number"
              />
            </FormField>
            <FormField
              label="Approval required"
              stretch
              description="Determines if approval is required for elevated access"
            >
              <Toggle
                onChange={({ detail }) => setApprovalRequired(detail.checked)}
                checked={approvalRequired}
              >
                Approval required
              </Toggle>
            </FormField>
            {approvalRequired && (
              <FormField
                label="Approver Groups"
                stretch
                description="Groups that can approve requests using this policy"
                errorText={approverGroupError}
              >
                <SpaceBetween direction="vertical" size="xs">
                  <Grid gridDefinition={[{ colspan: 11 }, { colspan: 1 }]}>
                    <Multiselect
                      statusType={groupStatus}
                      placeholder="Select approver groups"
                      loadingText="Loading groups"
                      filteringType="auto"
                      empty="No options"
                      options={groups.map((group) => ({
                        label: group.id,
                        value: group.id,
                        description: `Approver groups: ${group.approvers?.join(', ') || '-'}`,
                      }))}
                      selectedOptions={approverGroup}
                      onChange={({ detail }) => {
                        setApproverGroupError("");
                        setApproverGroup(detail.selectedOptions);
                      }}
                      selectedAriaLabel="selected"
                      deselectAriaLabel={(e) => `Remove ${e.label}`}
                    />
                    <Button
                      iconName="refresh"
                      onClick={getApproverGroups}
                      loading={groupStatus === "loading"}
                    />
                  </Grid>
                  <Button
                    iconName="external"
                    iconAlign="right"
                    variant="link"
                    onClick={() => window.open("/admin/approvers", "_blank")}
                  >
                    Create new approver group
                  </Button>
                </SpaceBetween>
              </FormField>
            )}
          </SpaceBetween>
        </Modal>
      )}
    </div>
  );
}

export default Policies;
