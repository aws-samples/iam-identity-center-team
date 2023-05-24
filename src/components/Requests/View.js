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
  Modal,
  Select,
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import { getUserRequests, updateStatus, getSetting } from "../Shared/RequestService";
import { API, graphqlOperation } from "aws-amplify";
import { onUpdateRequests, onCreateRequests} from "../../graphql/subscriptions";
import Status from "../Shared/Status";
import Details from "../Shared/Details";
import "../../index.css";
import { useHistory } from "react-router-dom";

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

const COLUMN_DEFINITIONS = [
  {
    id: "id",
    sortingField: "id",
    header: "Id",
    cell: (item) => item.id,
    width: 50,
  },
  {
    id: "email",
    sortingField: "email",
    header: "Requester",
    cell: (item) => item.email,
    minWidth: 160,
  },
  {
    id: "account",
    sortingField: "account",
    header: "Account",
    cell: (item) => item.accountName,
    minWidth: 10,
  },
  {
    id: "role",
    sortingField: "role",
    header: "Role",
    cell: (item) => item.role,
    minWidth: 10,
  },
  {
    id: "startTime",
    sortingField: "startTime",
    header: "StartTime",
    cell: (item) => convertAwsDateTime(item.startTime),
    minWidth: 160,
  },
  {
    id: "duration",
    sortingField: "duration",
    header: "Duration",
    cell: (item) => `${item.duration} hours`,
    maxWidth: 120,
  },
  {
    id: "justification",
    sortingField: "justification",
    header: "Justification",
    cell: (item) => item.justification,
    maxWidth: 200,
  },
  {
    id: "ticketNo",
    sortingField: "ticketNo",
    header: "TicketNo",
    cell: (item) => item.ticketNo || "-",
    minWidth: 10,
  },
  {
    id: "status",
    sortingField: "status",
    header: "Status",
    cell: (item) => <Status status={item.status} />,
    minWidth: 10,
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
              // { id: "id", label: "Id", editable: false },
              { id: "email", label: "Requester" },
              { id: "account", label: "Account" },
              { id: "role", label: "Role" },
              { id: "duration", label: "Duration" },
              { id: "startTime", label: "StartTime" },
              { id: "justification", label: "Justification" },
              { id: "ticketNo", label: "TicketNo" },
              { id: "status", label: "Status" },
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

const defaultStatus = {
  label: "All status",
  value: "0",
};

function View(props) {
  const [allItems, setAllItems] = useState([]);
  const [preferences, setPreferences] = useState({
    pageSize: 10,
    visibleContent: [
      "email",
      "account",
      "role",
      "duration",
      "startTime",
      "justification",
      "ticketNo",
      "status",
    ],
  });

  const [selectedOption, setSelectedOption] = useState(defaultStatus);
  const selectStatusOptions = prepareSelectOptions("status", defaultStatus);

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

  function matchesStatus(item, selectedStatus) {
    return (
      selectedStatus === defaultStatus || item.status === selectedStatus.label
    );
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
        if (!matchesStatus(item, selectedOption)) {
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
          title="No requests"
          subtitle="No requests to display."
          action={<Button onClick={handleCreate}>Create Request</Button>}
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
  const [tableLoading, setTableLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [expand, setExpand] = useState(false);
  const [expiry, setExpiry] = useState(3)
  const history = useHistory();

  useEffect(() => {
    views();
    props.addNotification([]);
    approveEvent();
    getSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getSettings(){
    getSetting("settings").then((data) => {
      if (data !== null) {
        setExpiry(parseInt(data.expiry));
        }
    });
  }

  async function updateItems(items) {
    items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    const data = items.map((item) => {
      if (
        item.status === "ended" ||
        item.status === "revoked" ||
        item.status === "in progress" ||
        item.status === "scheduled"
      ) {
        item.status = "approved";
      }
      return item;
    });
    return data;
  }

  function views() {
    getUserRequests(props.user).then((items) => {
      updateItems(items).then((items) => {
        setAllItems(items);
        setTableLoading(false);
        setRefreshLoading(false);
        setConfirmLoading(false);
        setVisible(false);
        setCancelVisible(false);
      });
    });
  }

  function approveEvent() {
    API.graphql(graphqlOperation(onUpdateRequests)).subscribe({
      next: () => {
       views();
      },
      error: (error) => console.warn(error),
    });
  }

  function handleRefresh() {
    setRefreshLoading(true);
    setTableLoading(true);
    views();
  }

  function handleCreate() {
    history.push("/requests/request");
    props.setActiveHref("/requests/request");
  }

  function handleCancel() {
    setCancelVisible(true);
  }
  function handleSelect() {
    setVisible(true);
    setExpand(false);
  }

  function cancelRequest() {
    setConfirmLoading(true);
    const data = {
      id: selectedItems[0].id,
      status: "cancelled",
    };
    updateStatus(data).then(() => {
      views();
      props.addNotification([
        {
          type: "success",
          content: "TEAM request cancelled",
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
    });
  }
  return (
    <div className="container">
      <Table
        {...collectionProps}
        resizableColumns="true"
        loading={tableLoading}
        loadingText="Fetching requests"
        // sortingColumn={SORT_COLUMN}
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
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={handleSelect}
                  variant="primary"
                >
                  View details
                </Button>
              </SpaceBetween>
            }
            description="Elevated access requested by you"
          >
            Requests
          </Header>
        }
        filter={
          <div className="input-container">
            <TextFilter
              {...filterProps}
              filteringPlaceholder="Find request"
              countText={filteredItemsCount}
              className="input-filter"
            />
            <Select
              {...filterProps}
              className="select-filter engine-filter"
              selectedAriaLabel="Selected"
              options={selectStatusOptions}
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
        selectionType="single"
      />
      <div>
        {selectedItems.length ? (
          <>
            <Modal
              onDismiss={() => {
                setVisible(false);
                setExpand(true);
              }}
              visible={visible}
              closeAriaLabel="Close modal"
              size="large"
              footer={
                <Box float="right">
                  <SpaceBetween direction="horizontal" size="s">
                  <Button
                      onClick={() => {
                        setVisible(false);
                        setExpand(true);
                      }}
                    >
                      Ok
                    </Button>
                    {selectedItems[0].status == "pending" && (
                      <Button
                        disabled={selectedItems[0].status !== "pending"}
                        onClick={handleCancel}
                        variant="primary"
                      >
                        Cancel request
                      </Button>
                    )}
                  </SpaceBetween>
                </Box>
              }
              header="Request details"
            >
              <Details item={selectedItems[0]} status={expand} expiry={expiry} />
            </Modal>
            <Modal
              onDismiss={() => setCancelVisible(false)}
              visible={cancelVisible}
              closeAriaLabel="Close modal"
              size="medium"
              footer={
                <Box float="right">
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      variant="link"
                      onClick={() => {
                        setCancelVisible(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={cancelRequest}
                      loading={confirmLoading}
                    >
                      Confirm
                    </Button>
                  </SpaceBetween>
                </Box>
              }
              header="Cancel Request"
            >
              Are you sure you want to cancel request?
            </Modal>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default View;
