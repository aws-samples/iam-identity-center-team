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
  Textarea,
  FormField,
  ColumnLayout,
  ExpandableSection,
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import { useHistory } from "react-router-dom";
import { sessions, updateStatus, getSetting} from "../Shared/RequestService";
import { API, graphqlOperation } from "aws-amplify";
import { onUpdateRequests } from "../../graphql/subscriptions";
import Status from "../Shared/Status";
import Details from "../Shared/Details";
import "../../index.css";
import { Divider } from "antd";
import Logs from "../Sessions/Logs"
import Timer from "../Sessions/Timer";

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
    header: "Ticket no",
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
          { value: 10, label: "10 Sessions" },
          { value: 30, label: "30 Sessions" },
          { value: 50, label: "50 Sessions" },
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
            label: "Sessions properties",
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

function Active(props) {
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
          title="No elevated access"
          subtitle="No elevated access to display."
          action={<Button onClick={handleCreate}>Create request</Button>}
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
  const history = useHistory();
  const [tableLoading, setTableLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [revokeVisible, setrevokeVisible] = useState(false);
  const [comment, setComment] = useState();
  const [commentError, setCommentError] = useState();
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [expand, setExpand] = useState(false);
  const [viewLogs, setViewLogs] = useState(false);
  const [commentRequired, setCommentRequired] = useState(true);

  useEffect(() => {
    views();
    props.addNotification([]);
    approveEvent();
    getSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function views() {
    let filter = {
      and: [
        {or: [{ status: { eq: "scheduled" } }, { status: { eq: "in progress" } }]},
        {or: [{ email: { eq: props.user } }, { approvers: { contains: props.user } }]}
      ]
    };
    sessions(filter).then((items) => {
      items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      setAllItems(items);
      setTableLoading(false);
      setRefreshLoading(false);
      setRevokeLoading(false);
      setVisible(false);
      setrevokeVisible(false);
      setComment()
    });
  }

  function getSettings(){
    getSetting("settings").then((data) => {
      if (data !== null) {
        setCommentRequired(data.comments);
        }
    });
  }

  function approveEvent() {
    API.graphql(graphqlOperation(onUpdateRequests)).subscribe({
      next: ({ value }) => {
        // eslint-disable-next-line default-case
        switch (value.data.onUpdateRequests.status) {
          case "in progress":
          case "ended":
          case "revoked":
            views();
        }
      },
      error: (error) => console.warn(error),
    });
  }

  function handleRefresh() {
    setRefreshLoading(true);
    setTableLoading(true);
    views();
  }

  function handleSelect() {
    setVisible(true);
    setExpand(false);
    setViewLogs(true);
  }

  const ValueWithLabel = ({ label, children }) => (
    <div>
      <div className="headings">
        <Box color="inherit" fontSize="body-m">
          {label}
        </Box>
      </div>
      <div>{children}</div>
    </div>
  );


  function handleCreate() {
    history.push("/requests/request");
    props.setActiveHref("/requests/request");
  }

  function revoke() {
    setRevokeLoading(true);
    const data = {
      id: selectedItems[0].id,
      status: "revoked",
      revokeComment: comment,
    };
    updateStatus(data).then(() => {
      views();
      props.addNotification([
        {
          type: "success",
          content: "Elevated access revoked",
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
    });
  }
  function handleRevoke() {
    (!comment && commentRequired) || (comment && !(/[\p{L}\p{N}]/u.test(comment[0]))) ? setCommentError("Enter valid reason for revoking elevated access") : revoke();
  }

  return (
    <div className="container">
      <Table
        {...collectionProps}
        resizableColumns="true"
        loading={tableLoading}
        loadingText="Fetching elevated access"
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
                  // variant="primary"
                  onClick={() => {
                    setrevokeVisible(true)
                    }}
                  disabled={selectedItems.length === 0}
                >
                  Revoke
                </Button>
                <Button
                  disabled={selectedItems.length === 0}
                  variant="primary"
                  onClick={handleSelect}
                >
                  View details
                </Button>
              </SpaceBetween>
            }
            description="Scheduled or in-progress elevated access requests"
          >
            Elevated access
          </Header>
        }
        filter={
          <div className="input-container">
            <TextFilter
              {...filterProps}
              filteringPlaceholder="Find elevated access"
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
          <Modal
            onDismiss={() => {
              setVisible(false);
              setExpand(true);
              setViewLogs(false);
            }}
            visible={visible}
            closeAriaLabel="Close modal"
            size="large"
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="s">
                  <Button
                    variant="link"
                    onClick={() => {
                      setViewLogs(false);
                      setVisible(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setrevokeVisible(true)}
                    disabled={selectedItems.length === 0 && (props.user===selectedItems[0].email || selectedItems[0].approvers.includes(props.user))}
                  >
                    Revoke
                  </Button>
                </SpaceBetween>
              </Box>
            }
            header="Elevated access details"
          >
            <SpaceBetween size="s">
              <ColumnLayout columns={3} variant="text-grid">
                <SpaceBetween size="l">
                  <ValueWithLabel
                    label="Requester"
                    children={`${selectedItems[0].email}`}
                  />
                  <ValueWithLabel label="Status">
                    <Status status={selectedItems[0].status} />
                  </ValueWithLabel>
                  <ValueWithLabel
                    label="Justification"
                    children={`${selectedItems[0].justification}`}
                  />
                </SpaceBetween>
                <SpaceBetween size="l">
                  <ValueWithLabel
                    label="Account"
                    children={`${selectedItems[0].accountName} (${selectedItems[0].accountId})`}
                  />
                  <ValueWithLabel
                    label="Role"
                    children={`${selectedItems[0].role}`}
                  />
                  <ValueWithLabel
                    label="TicketNo"
                    children={`${selectedItems[0].ticketNo}`}
                  />
                </SpaceBetween>
                <SpaceBetween size="l">
                  <ValueWithLabel
                    label="Start time"
                    children={convertAwsDateTime(selectedItems[0].startTime)}
                  />
                  <ValueWithLabel
                    label="Duration"
                    children={`${selectedItems[0].duration} Hours`}
                  />
                  <Timer item={selectedItems[0]} />
                </SpaceBetween>
              </ColumnLayout>

              <div>
                {selectedItems[0].approver && (
                  <div>
                    <Divider
                      style={{ marginBottom: "10px", marginTop: "10px" }}
                    />
                    <ColumnLayout columns={3}>
                      <SpaceBetween size="m">
                        <ValueWithLabel
                          label="Approved by"
                          children={`${selectedItems[0].approver}`}
                        />
                        <ValueWithLabel
                          label="Comments"
                          children={`${selectedItems[0].comment}`}
                        />
                      </SpaceBetween>
                    </ColumnLayout>
                  </div>
                )}
              </div>
              {selectedItems[0].status === "in progress" && (
                <div>
                  <ExpandableSection
                    variant="footer"
                    header="Session activity logs"
                    className="expanded"
                  >
                    <div>{viewLogs && <Logs item={selectedItems[0]} />}</div>
                  </ExpandableSection>
                </div>
              )}
            </SpaceBetween>
          </Modal>
        ) : null}
      </div>
      <div>
        {selectedItems.length ? (
          <Modal
            onDismiss={() => {
              setrevokeVisible(false);
              setComment()
            }}
            visible={revokeVisible}
            closeAriaLabel="Close modal"
            size="large"
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="s">
                  <Button
                    variant="link"
                    onClick={() => {
                      setrevokeVisible(false);
                      setComment()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleRevoke}
                    loading={revokeLoading}
                  >
                    Confirm
                  </Button>
                </SpaceBetween>
              </Box>
            }
            header="Revoke elevated access"
          >
            <SpaceBetween size="m">
              <Details item={selectedItems[0]} status={expand} />
              <Divider style={{ marginBottom: "10px", marginTop: "10px" }} />
              <FormField
                label="Revoke Comments"
                stretch
                description="Revoked elevated access prevents users from invoking new session. Active sessions might remain valid until session duration expires"
                errorText={commentError}
              >
                <Textarea
                  onChange={({ detail }) => {
                    setCommentError();
                    setComment(detail.value);
                  }}
                  value={comment}
                />
              </FormField>
            </SpaceBetween>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}

export default Active;
