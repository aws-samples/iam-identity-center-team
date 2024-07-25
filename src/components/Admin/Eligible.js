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
  Select,
  ColumnLayout,
  Toggle,
  Input,
  Spinner
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import Ous from "../Shared/Ous";
import { API, graphqlOperation } from "aws-amplify";
import { onPublishOUs, onPublishPermissions } from "../../graphql/subscriptions";
import {
  fetchAccounts,
  fetchOUs,
  fetchIdCGroups,
  fetchPermissions,
  addPolicy,
  editPolicy,
  delPolicy,
  fetchUsers,
  getAllEligibility,
  getSetting
} from "../Shared/RequestService";
import "../../index.css";

const COLUMN_DEFINITIONS = [
  {
    id: "id",
    sortingField: "id",
    header: "Id",
    cell: (item) => item.id,
    width: 140,
  },
  {
    id: "name",
    sortingField: "name",
    header: "Name",
    cell: (item) => item.name,
    width: 220,
  },
  {
    id: "type",
    sortingField: "type",
    header: "Type",
    cell: (item) => item.type,
    width: 130,
  },
  {
    id: "ticketNo",
    sortingField: "ticketNo",
    header: "TicketNo",
    cell: (item) => item.ticketNo || "-",
    width: 130,
  },
  {
    id: "accounts",
    sortingField: "accounts",
    header: "Accounts",
    cell: (item) => (
      <>{item.accounts.length > 0 ?  <TextContent>
        <ul>
          {item.accounts.map(({name}) => (
            <li>{name}</li>
          ))}
        </ul>
      </TextContent> : <TextContent><ul>-</ul></TextContent>}</>   
    ), 
    width: 200,
  },
  {
    id: "ous",
    sortingField: "ous",
    header: "OUs",
    cell: (item) => (
      <>{item.ous.length > 0 ?  <TextContent>
        <ul>
          {item.ous.map(({name}) => (
            <li>{name}</li>
          ))}
        </ul>
      </TextContent> : <TextContent><ul>-</ul></TextContent>}</>   
    ), 
    width: 200,
  },
  {
    id: "permissions",
    sortingField: "permissions",
    header: "Permissions",
    cell: (item) => (
      <TextContent>
        <ul>
          {item.permissions.map(({name}) => (
            <li>{name}</li>
          ))}
        </ul>
      </TextContent>
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
        title: "Page size",
        options: [
          { value: 10, label: "10 Policy" },
          { value: 30, label: "30 Policy" },
          { value: 50, label: "50 Policy" },
        ],
      }}
      wrapLinesPreference={{
        label: "Wrap lines",
        description: "Check to see all the text and wrap the lines",
      }}
      visibleContentPreference={{
        title: "Select visible columns",
        options: [
          {
            label: "Policy properties",
            options: [
              { id: "id", label: "Id" },
              { id: "name", label: "name" },
              { id: "type", label: "type" },
              { id: "ticketNo", label: "ticketNo" },
              { id: "accounts", label: "accounts" },
              { id: "ous", label: "ous" },
              { id: "permissions", label: "permissions" },
              { id: "duration", label: "duration" },
              { id: "approvalRequired", label: "approvalRequired" },
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

const defaultType = {
  label: "All entities",
  value: "0",
};

function Eligible(props) {
  const [allItems, setAllItems] = useState([]);
  const [preferences, setPreferences] = useState({
    pageSize: 10,
    visibleContent: [
      // "id",
      "name",
      "type",
      "ticketNo",
      "accounts",
      "ous",
      "permissions",
      "duration",
      "approvalRequired",
      "modifiedBy"
    ],
  });

  const [selectedOption, setSelectedOption] = useState(defaultType);
  const selectTypeOptions = prepareSelectOptions("type", defaultType);

  function prepareSelectOptions(field, defaultOption) {
    const optionSet = [];
    // Building a non redundant list of the field passed as parameter.

    allItems.forEach((item) => {
      if (optionSet.indexOf(item[field]) === -1) {
        optionSet.push(item[field]);
      }
    });
    optionSet.sort();

    // The first element is the default one.
    const options = [defaultOption];

    // Adding the other element ot the list.
    optionSet.forEach((item, index) =>
      options.push({ label: item, value: (index + 1).toString() })
    );
    return options;
  }

  function matchesType(item, selectedType) {
    return selectedType === defaultType || item.type === selectedType.label;
  }

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
        if (!matchesType(item, selectedOption)) {
          return false;
        }
        const filteringTextLowerCase = filteringText.toLowerCase();

        return SEARCHABLE_COLUMNS.map((key) => item[key]).some(
          (value) =>
            typeof value === "string" &&
            value.toLowerCase().indexOf(filteringTextLowerCase) > -1
        );
      },
      empty: (
        <EmptyState
          title="No Policy"
          subtitle="No eligibility policy to display."
          action={<Button onClick={handleAdd}>Create eligibility policy</Button>}
        />
      ),
      noMatch: (
        <EmptyState
          title="No matches"
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
  const [visible, setVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [Type, setType] = useState("");
  const [typeError, setTypeError] = useState("");
  const [ticketNo, setTicketNo] = useState("");
  const [duration, setDuration] = useState("9");
  const [durationError, setDurationError] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [ticketError, setTicketError] = useState("");
  const [resource, setResource] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [account, setAccount] = useState([]);
  const [accountError, setAccountError] = useState("");
  const [ou, setOU] = useState([]);
  const [ouError, setOuError] = useState("");
  const [permission, setPermission] = useState([]);
  const [permissionError, setPermissionError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountStatus, setAccountStatus] = useState("finished");

  const [users, setUsers] = useState([]);
  const [userStatus, setUserStatus] = useState("finished");

  const [groups, setGroups] = useState([]);
  const [groupStatus, setGroupStatus] = useState("finished");

  const [ous, setOUs] = useState([]);
  const [ouStatus, setOUStatus] = useState("finished");

  const [permissions, setPermissions] = useState([]);
  const [permissionStatus, setPermissionStatus] = useState("finished");
  const [ticketRequired, setTicketRequired] = useState(true);


  useEffect(() => {
    views();
    props.addNotification([]);
    getOUs()
    getAccounts();
    getPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function views() {
    getAllEligibility().then((items) => {
      setAllItems(items);
      setTableLoading(false);
      setConfirmLoading(false);
      setSubmitLoading(false);
      setVisible(false);
      setDeleteVisible(false);
      handleDismiss();
      getSettings()
    });
  }

  function handleAdd() {
    setVisible(true);
  }

  function getSettings(){
    getSetting("settings").then((data) => {
      if (data !== null) {
        setTicketRequired(data.ticketNo);
        setDuration(data.duration)
        }
    });
  }

  function handleSelect(data) {
    if (data.detail.id === "delete") {
      setDeleteVisible(true);
    } else handleEdit();
  }

  function handleDelete() {
    selectedItems.forEach((item) => {
      setConfirmLoading(true);
      const data = {
        id: item.id,
      };
      delPolicy(data).then(() => {
        views();
        props.addNotification([
          {
            type: "success",
            content: `Eligibility policy deleted successfully`,
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          },
        ]);
      });
    });
  }

  function handleConfirmEdit() {
    let action = "edit";
    validate(action).then((valid) => {
      if (valid) {
        setConfirmLoading(true);
        const data = {
          id: selectedItems[0].id,
          accounts: account.map(({ value, label }) => ({name: label, id: value})),
          permissions: permission.map(({ value,label }) => ({name: label, id: value})),
          ous: ou.map(({ value,label }) => ({name: label, id: value})),
          ticketNo: ticketNo,
          approvalRequired: approvalRequired,
          duration: duration
        };
        editPolicy(data).then(() => {
          views();
          props.addNotification([
            {
              type: "success",
              content: `Eligibility policy updated successfully`,
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
      selectedItems[0].accounts.map((data) => {
        return {
          label: data.name,
          value: data.id,
          description: data.id,
        };
      })
    );
    setOU(
      selectedItems[0].ous.map((data) => {
        return {
          label: data.name,
          value: data.id,
          description: data.id,
        };
      })
    );
    setPermission(
      selectedItems[0].permissions.map((data) => {
        return {
          label: data.name,
          value: data.id,
          description: data.id,
        };
      })
    );
    setApprovalRequired(
      selectedItems[0].approvalRequired 
    );
    setDuration(
      selectedItems[0].duration 
    );
    setEditVisible(true);
  }

  const onTypeChange = (value) => {
    setResource([]);
    setType(value);
    value.value === "User" ? getUsers() : getGroups();
  };

  function getUsers() {
    setUserStatus("loading");
    fetchUsers().then((data) => {
      setUsers(data);
      setUserStatus("finished");
    });
  }

  function getGroups() {
    setGroupStatus("loading");
    fetchIdCGroups().then((data) => {
      setGroups(data);
      setGroupStatus("finished");
    });
  }

  function getOUs() {
    setOUStatus("loading");
    fetchOUs().then(() =>{
      const subscription = API.graphql(
        graphqlOperation(onPublishOUs)
      ).subscribe({
        next: (result) => {
          const data = result.value.data.onPublishOUs.ous
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
      setAccounts(data);
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

  const onResourceChange = (value) => {
    setResource(value);
  };

  async function validate(action) {
    let valid = true;
    if (permission.length < 1 ) {
      valid = false;
      setPermissionError("Select permission set");
    }
    if (ou.length < 1 && account.length < 1) {
      valid = false;
      setOuError("Select OUs and/or Accounts");
      setAccountError("Select OUs and/or Accounts");
    }
    if ((!ticketNo && ticketRequired) || !(/^[a-zA-Z0-9]+$/.test(ticketNo[0]))) {
      setTicketError("Enter valid change management ticket number");
      valid = false;
    }
    if (!duration || isNaN(duration) || Number(duration ) > 8000 || Number(duration ) < 1) {
      setDurationError(`Enter number between 1-8000`);
      valid = false;
    }
    if (!resource && action === "submit") {
      setResourceError("Select a valid entity");
      valid = false;
    }
    if (!Type && action === "submit") {
      setTypeError("Select a valid entity type");
      valid = false;
    }
    return valid;
  }

  function handleSubmit(event) {
    let action = "submit";
    setSubmitLoading(true);
    validate(action).then((valid) => {
      if (valid) {
        event.preventDefault();
        resource.forEach((item) => {
          const data = {
            type: Type.value,
            name: item.label,
            accounts: account.map(({ value, label }) => ({name: label, id: value})),
            permissions: permission.map(({ value,label }) => ({name: label, id: value})),
            ous: ou.map(({ value,label }) => ({name: label, id: value})),
            id: item.value,
            ticketNo: ticketNo,
            approvalRequired: approvalRequired,
            duration: duration
          };
          addPolicy(data).then(() => {
            views();
            props.addNotification([
              {
                type: "success",
                content: "Eligibility policy added successfully",
                dismissible: true,
                onDismiss: () => props.addNotification([]),
              },
            ]);
          });
        });
      }
    });
  }

  function handleDismiss() {
    setVisible(false);
    setDeleteVisible(false);
    setEditVisible(false);
    setType("");
    setTypeError("");
    setResource("");
    setResourceError("");
    setAccount([]);
    setAccountError("");
    setOU([]);
    setOuError("");
    setPermission([]);
    setPermissionError("");
    setTicketNo("");
    setTicketError("");
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
        loadingText="Fetching eligibility policy"
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
                <Button iconName="refresh" />
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
          >
            Eligibility policy
          </Header>
        }
        filter={
          <div className="input-container">
            <TextFilter
              {...filterProps}
              filteringPlaceholder="Find policy"
              countText={filteredItemsCount}
              className="input-filter"
            />
            <Select
              {...filterProps}
              className="select-filter engine-filter"
              selectedAriaLabel="Selected"
              options={selectTypeOptions}
              selectedOption={selectedOption}
              onChange={({ detail }) =>
                setSelectedOption(detail.selectedOption)
              }
              ariaDescribedby={null}
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
      <Modal
        onDismiss={() => handleDismiss()}
        visible={visible}
        closeAriaLabel="Close modal"
        size="large"
        header="Policy"
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                type="submit"
                onClick={handleSubmit}
                className="buttons"
              >
                Add eligibility policy
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              label="Entity type"
              stretch
              description="User or Group"
              errorText={typeError}
            >
              <Select
                selectedAriaLabel="Selected"
                options={[
                  {
                    label: "User",
                    value: "User",
                  },
                  {
                    label: "Group",
                    value: "Group",
                  },
                ]}
                selectedOption={Type}
                onChange={(event) => {
                  setTypeError();
                  onTypeChange(event.detail.selectedOption);
                }}
              />
            </FormField>
            {Type.value === "User" && (
              <FormField
                label="User"
                stretch
                description="User eligibility policy"
                errorText={resourceError}
              >
                <Multiselect
                  statusType={userStatus}
                  placeholder="Select Users"
                  loadingText="Loading users"
                  filteringType="auto"
                  empty="No options"
                  options={users.map((user) => ({
                    label: user.UserName,
                    value: user.UserId,
                    description: user.UserId,
                    disabled: allItems.map(({ id }) => id).includes(user.UserId),
                  }))}
                  selectedOptions={resource}
                  onChange={(event) => {
                    setResourceError();
                    onResourceChange(event.detail.selectedOptions);
                  }}
                  selectedAriaLabel="selected"
                  deselectAriaLabel={(e) => `Remove ${e.label}`}
                />
              </FormField>
            )}
            {Type.value === "Group" && (
              <FormField
                label="Group"
                stretch
                description="Group eligibility policy"
                errorText={resourceError}
              >
                <Multiselect
                  statusType={groupStatus}
                  placeholder="Select Groups"
                  loadingText="Loading Groups"
                  filteringType="auto"
                  empty="No options"
                  options={groups.map((group) => ({
                    label: group.DisplayName,
                    value: group.GroupId,
                    description: group.GroupId,
                    disabled: allItems.map(({ id }) => id).includes(group.GroupId),
                  }))}
                  selectedOptions={resource}
                  onChange={(event) => {
                    setResourceError();
                    onResourceChange(event.detail.selectedOptions);
                  }}
                  selectedAriaLabel="selected"
                  deselectAriaLabel={(e) => `Remove ${e.label}`}
                />
              </FormField>
            )}
            <FormField
              label="Ticket No"
              stretch
              description="Change Management system ticket system number"
              errorText={ticketError}
            >
              <Input
                value={ticketNo}
                onChange={(event) => {
                  setTicketError();
                  setTicketNo(event.detail.value);
                }}
              />
            </FormField>
            <FormField
              label="Accounts"
              stretch
              description="List of Eligible Accounts"
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
                  setAccountError();
                  setAccount(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
            <FormField
              label="OUs"
              stretch
              description="List of Eligible OUs"
              errorText={ouError}
            >
                {ous.length === 1 ? (<Ous
                  options={ous}
                  setResource={setOU}
                  resource={ou}
                  />) : <Spinner size="large"/>}

              {/* <Multiselect
                statusType={ouStatus}
                placeholder="Select OUs"
                loadingText="Loading OUs"
                filteringType="auto"
                empty="No options"
                options={ous.map((ou) => ({
                  label: ou.Name,
                  value: ou.Id,
                  description: ou.Id,
                }))}
                selectedOptions={ou}
                onChange={({ detail }) => {
                  setOuError();
                  setOU(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              /> */}
            </FormField>
            <FormField
              label="Permission"
              stretch
              description="List of Eligible Permissions"
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
                  setPermissionError();
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
              placeholder={`Enter number between 1-8000`}
            >
              <Input
                value={duration}
                onChange={(event) => {
                  setDurationError();
                  event.detail.value > 8000
                    ? setDurationError(
                        `Enter a number between 1 and 8000`
                      )
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
          </SpaceBetween>
        </Form>
      </Modal>
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
                onClick={() => {
                  setDeleteVisible(false);
                }}
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
        header="Delete eligibility policy"
      >
        Are you sure you want to delete policy ?
      </Modal>
      {selectedItems.length > 0 && (
        <Modal
          onDismiss={() => handleDismiss()}
          visible={editVisible}
          closeAriaLabel="Close modal"
          size="large"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={() => {
                    handleDismiss();
                  }}
                >
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
            <ColumnLayout columns={3} variant="text-grid">
              <ValueWithLabel label="Entity type">
                {selectedItems[0].type}
              </ValueWithLabel>
              <ValueWithLabel label="Name">
                {selectedItems[0].name}
              </ValueWithLabel>
              <ValueWithLabel label="Id">{selectedItems[0].id}</ValueWithLabel>
            </ColumnLayout>
            <FormField
              label="Ticket No"
              stretch
              description="Change Management system ticket system number"
              errorText={ticketError}
            >
              <Input
                value={ticketNo}
                onChange={(event) => {
                  setTicketError();
                  setTicketNo(event.detail.value);
                }}
              />
            </FormField>
            <FormField
              label="Account"
              stretch
              description="List of Eligible Accounts"
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
                  setAccountError();
                  setAccount(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
            <FormField
              label="OU"
              stretch
              description="List of Eligible OUs"
              errorText={ouError}
            >
              {ous.length === 1 ? (<Ous
                  options={ous}
                  setResource={setOU}
                  resource={ou}
                  />) : <Spinner size="large"/>}
              {/* <Multiselect
                statusType={ouStatus}
                placeholder="Select OUs"
                loadingText="Loading OUs"
                filteringType="auto"
                empty="No options"
                options={ous.map((ou) => ({
                  label: ou.Name,
                  value: ou.Id,
                  description: ou.Id,
                }))}
                selectedOptions={ou}
                onChange={({ detail }) => {
                  setOuError();
                  setOU(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              /> */}
            </FormField>
            <FormField
              label="Permission"
              stretch
              description="List of Eligible Permissions"
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
                  setPermissionError();
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
              placeholder={`Enter number between 1-8000`}
            >
              <Input
                value={duration}
                onChange={(event) => {
                  setDurationError();
                  event.detail.value > 8000
                    ? setDurationError(
                        `Enter a number between 1 and 8000`
                      )
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
          </SpaceBetween>
        </Modal>
      )}
    </div>
  );
}

export default Eligible;
