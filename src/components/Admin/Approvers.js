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
  Input,
  Spinner
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import Ous from "../Shared/Ous";
import { API, graphqlOperation } from "aws-amplify";
import { onPublishOUs } from "../../graphql/subscriptions";
import {
  getAllApprovers,
  fetchAccounts,
  fetchOUs,
  addApprovers,
  delApprover,
  editApprover,
  fetchIdCGroups,
  getSetting
} from "../Shared/RequestService";
import "../../index.css";

const COLUMN_DEFINITIONS = [
  {
    id: "id",
    sortingField: "id",
    header: "Id",
    cell: (item) => item.id,
    width: 220,
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
    width: 200,
  },
  {
    id: "ticketNo",
    sortingField: "ticketNo",
    header: "Ticket no",
    cell: (item) => item.ticketNo || "-",
    width: 200,
  },
  {
    id: "approvers",
    sortingField: "approvers",
    header: "Approver groups",
    cell: (item) => (
      <TextContent>
        <ul>
          {item.approvers.map((data) => (
            <li>{data}</li>
          ))}
        </ul>
      </TextContent>
    ),
    width: 300,
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
          { value: 10, label: "10 Requests" },
          { value: 30, label: "30 Requests" },
          { value: 50, label: "50 Requests" },
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
            label: "Request properties",
            options: [
              { id: "id", label: "Id", editable: false },
              { id: "name", label: "name" },
              { id: "type", label: "type" },
              { id: "ticketNo", label: "ticketNo" },
              { id: "approvers", label: "approvers" },
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

function Approvers(props) {
  const [allItems, setAllItems] = useState([]);
  const [preferences, setPreferences] = useState({
    pageSize: 10,
    visibleContent: [
      "id",
      "name",
      "type",
      "ticketNo",
      "approvers",
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
          title="No approver"
          subtitle="No approvers to display."
          action={<Button onClick={handleAdd}>Create approver</Button>}
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
  const [tableLoading, setTableLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [Type, setType] = useState("");
  const [typeError, setTypeError] = useState("");
  // const [approvers, setApprovers] = useState("");
  const [approverError, setApproverError] = useState("");
  const [ticketNo, setTicketNo] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [resource, setResource] = useState("");
  const [resourceError, setResourceError] = useState("");

  const [accounts, setAccounts] = useState([]);
  const [accountStatus, setAccountStatus] = useState("finished");

  const [ous, setOUs] = useState([]);
  const [ouStatus, setOUStatus] = useState("finished");

  const [approverList, setApproverList] = useState([]);
  const [approverStatus, setApproverStatus] = useState("finished");

  const [approver, setApprover] = useState([]);
  const [ticketRequired, setTicketRequired] = useState(true);


  useEffect(() => {
    views();
    props.addNotification([]);
    getGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function views() {
    getAllApprovers().then((items) => {
      setAllItems(items);
      setTableLoading(false);
      setConfirmLoading(false);
      setVisible(false);
      setDeleteVisible(false);
      handleDismiss();
      getSettings();
    });
  }

  function handleAdd() {
    setVisible(true);
  }

  function getSettings(){
    getSetting("settings").then((data) => {
      if (data !== null) {
        setTicketRequired(data.ticketNo);
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
      delApprover(data).then(() => {
        views();
        props.addNotification([
          {
            type: "success",
            content: `Approvers deleted successfully`,
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
          approvers: approver.map(({ label }) => label),
          groupIds: approver.map(({ value }) => value),
          ticketNo: ticketNo,
        };
        editApprover(data).then(() => {
          views();
          props.addNotification([
            {
              type: "success",
              content: `Approvers edited successfully`,
              dismissible: true,
              onDismiss: () => props.addNotification([]),
            },
          ]);
        });
      }
    });
  }

  function handleEdit() {
    setApprover(
      selectedItems[0].approvers.map((approver, index) => {
        let groupId = selectedItems[0].groupIds[index]
        return {
          label: approver,
          value: groupId,
          description: groupId,
        };
      })
    );
    setEditVisible(true);
  }

  const onTypeChange = (value) => {
    setResource([]);
    setType(value);
    value.value === "Account" ? getAccounts() : getOUs();
  };

  function getAccounts() {
    setAccountStatus("loading");
    fetchAccounts().then((data) => {
      setAccounts(data);
      setAccountStatus("finished");
    });
  }

  function getGroups() {
    setApproverStatus("loading");
    fetchIdCGroups().then((data) => {
      setApproverList(data);
      setApproverStatus("finished");
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

  const onResourceChange = (value) => {
    setResource(value);
  };

  async function validate(action) {
    let valid = true;
    if (approver.length < 1) {
      valid = false;
      setApproverError("Select Valid Approver email");
    }
    if ((!ticketNo && ticketRequired) || !(/^[a-zA-Z0-9]+$/.test(ticketNo[0]))) {
      setTicketError("Enter valid change management ticket number");
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
    validate(action).then((valid) => {
      if (valid) {
        event.preventDefault();
        resource.forEach((item) => {
          const data = {
            type: Type.value,
            name: item.label,
            approvers: approver.map(({ label }) => label),
            groupIds: approver.map(({ value }) => value),
            id: item.value,
            ticketNo: ticketNo,
          };
          addApprovers(data).then(() => {
            views();
            props.addNotification([
              {
                type: "success",
                content: "Approvers added successfully",
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
    setApprover([]);
    setApproverError("");
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
        loadingText="Fetching approvers"
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
                  Add approvers
                </Button>
              </SpaceBetween>
            }
          >
            Approval policy
          </Header>
        }
        filter={
          <div className="input-container">
            <TextFilter
              {...filterProps}
              filteringPlaceholder="Find approvers"
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
        header="Approvers"
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
                Add approvers
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween direction="vertical" size="l">
            <FormField
              label="Entity type"
              stretch
              description="Account or organisation unit"
              errorText={typeError}
            >
              <Select
                selectedAriaLabel="Selected"
                options={[
                  {
                    label: "Organizational Unit",
                    value: "OU",
                  },
                  {
                    label: "Account",
                    value: "Account",
                  },
                ]}
                selectedOption={Type}
                onChange={(event) => {
                  setTypeError();
                  onTypeChange(event.detail.selectedOption);
                }}
              />
            </FormField>
            {Type.value === "Account" && (
              <FormField
                label="Accounts"
                stretch
                description="Target accounts for approver group management"
                errorText={resourceError}
              >
                <Multiselect
                  statusType={accountStatus}
                  placeholder="Select Accounts"
                  loadingText="Loading accounts"
                  filteringType="auto"
                  empty="No options"
                  options={accounts.map((account) => ({
                    label: account.name,
                    value: account.id,
                    description: account.id,
                    disabled: allItems.map(({ id }) => id).includes(account.id),
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
            {Type.value === "OU" && (
              <FormField
                label="OUs"
                stretch
                description="Organizational Unit"
                errorText={resourceError}
              >
                {ous.length === 1 ? (<Ous
                  options={ous}
                  setResource={setResource}
                  resource={resource}
                  action="create"
                  allItems={allItems}
                  />) : <Spinner size="large"/>}
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
              label="Approver Groups"
              stretch
              description="list of approver groups from IAM IdC"
              errorText={approverError}
            >
              <Multiselect
                statusType={approverStatus}
                placeholder="Select groups"
                loadingText="Loading groups"
                filteringType="auto"
                empty="No options"
                options={approverList.map((approver) => ({
                  label: approver.DisplayName,
                  value: approver.GroupId,
                  description: approver.GroupId,
                }))}
                selectedOptions={approver}
                onChange={({ detail }) => {
                  setApproverError();
                  setApprover(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
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
        header="Delete approvers"
      >
        Are you sure you want to delete approvers ?
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
          header="Edit approvers"
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
              label="Approver Groups"
              stretch
              description="list of approver groups from IAM IdC"
              errorText={approverError}
            >
              <Multiselect
                statusType={approverStatus}
                placeholder="Select groups"
                loadingText="Loading groups"
                filteringType="auto"
                empty="No options"
                options={approverList.map((approver) => ({
                  label: approver.DisplayName,
                  value: approver.GroupId,
                  description: approver.GroupId,
                }))}
                selectedOptions={approver}
                onChange={({ detail }) => {
                  setApproverError();
                  setApprover(detail.selectedOptions);
                }}
                selectedAriaLabel="selected"
                deselectAriaLabel={(e) => `Remove ${e.label}`}
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}
    </div>
  );
}

export default Approvers;
