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
  Textarea,
  FormField,
  ButtonDropdown,
  ColumnLayout,
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import { API, graphqlOperation } from "aws-amplify";
import {
  onUpdateRequests,
  onCreateRequests,
} from "../../graphql/subscriptions";
import { updateStatus, sessions, getRequest, getSetting } from "../Shared/RequestService";
import { useHistory } from "react-router-dom";
import Status from "../Shared/Status";
import "../../index.css";

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
    cell: (item) => item.startTime,
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

function Approvals(props) {
  const [allItems, setAllItems] = useState([]);
  const [preferences, setPreferences] = useState({
    pageSize: 10,
    visibleContent: [
      // "id",
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
  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    filterProps,
    paginationProps,
  } = useCollection(allItems, {
    filtering: {
      empty: (
        <EmptyState
          title="No approvals"
          subtitle="No approvals to display."
          action={<Button onClick={handleView}>View all sessions</Button>}
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
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [action, setAction] = useState();
  const [comment, setComment] = useState();
  const [commentError, setCommentError] = useState();
  const [modalHeader, setmodalHeader] = useState("TEAM");
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
      and: [{ email: { ne: props.user } }, { status: { eq: "pending" } }, { approvers: { contains: props.user } }],
    };
    sessions(filter).then((items) => {
      items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setAllItems(items);
      setTableLoading(false);
      setConfirmLoading(false);
      setVisible(false);
      setRefreshLoading(false);
      setComment();
    });
  }
  function getSettings(){
    getSetting("settings").then((data) => {
      if (data !== null) {
        setCommentRequired(data.comments);
        if (data.approval) {
          createEvent();
        }
        }
      else {
        createEvent();
      }
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

  function createEvent() {
    API.graphql(graphqlOperation(onCreateRequests)).subscribe({
      next: ({ value }) => {
        views();
      },
      error: (error) => console.warn(error),
    });
  }

  function handleView() {
    history.push("/sessions/active");
    props.setActiveHref("/sessions/active");
  }

  function handleSelect(data) {
    setVisible(true);
    setAction(data.detail.id);
    data.detail.id === "approved"
      ? setmodalHeader("Approve")
      : setmodalHeader("Reject");
  }

  function handleRefresh() {
    setRefreshLoading(true);
    setTableLoading(true);
    props.addNotification([]);
    views();
  }

  function submit() {
    setConfirmLoading(true);
    getRequest(selectedItems[0].id).then((item) => {
      if (item.status !== "pending") {
        views();
        props.addNotification([
          {
            type: "info",
            content: `TEAM request expired or actioned by another approver`,
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          },
        ]);
      } else {
        const data = {
          id: selectedItems[0].id,
          status: action,
          comment: comment,
        };
        updateStatus(data).then(() => {
          views();
          props.addNotification([
            {
              type: "success",
              content: `TEAM request ${action}`,
              dismissible: true,
              onDismiss: () => props.addNotification([]),
            },
          ]);
        });
      }
    });
  }

  function handleAction() {
    (!comment && commentRequired) || (comment && !(/[\p{L}\p{N}]/u.test(comment[0]))) ? setCommentError("Enter valid reason for approving or rejecting request") : submit();
  }

  return (
    <div className="container">
      <Table
        {...collectionProps}
        resizableColumns="true"
        loading={tableLoading}
        loadingText="Fetching requests"
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
                      text: "Approve",
                      id: "approved",
                      disabled: selectedItems.length === 0,
                    },
                    {
                      text: "Reject",
                      id: "rejected",
                      disabled: selectedItems.length === 0,
                    },
                  ]}
                  onItemClick={(props) => handleSelect(props)}
                >
                  Actions
                </ButtonDropdown>
                <Button
                  disabled={selectedItems.length === 0}
                  onClick={() => setVisible(true)}
                >
                  View details
                </Button>
              </SpaceBetween>
            }
            description="Approve or reject elevated access requests"
          >
            Approval Requests
          </Header>
        }
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="Find request..."
            countText={filteredItemsCount}
          />
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
              setAction("");
              setmodalHeader("PIM");
            }}
            visible={visible}
            closeAriaLabel="Close modal"
            size="large"
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="link"
                    onClick={() => {
                      setVisible(false);
                      setAction("");
                      setmodalHeader("PIM");
                    }}
                  >
                    Cancel
                  </Button>
                  <>
                    {action && (
                      <Button
                        variant="primary"
                        loading={confirmLoading}
                        onClick={() => handleAction()}
                      >
                        Confirm
                      </Button>
                    )}
                  </>
                </SpaceBetween>
              </Box>
            }
            header={`${modalHeader} Request`}
          >
            <SpaceBetween size="l">
              <ColumnLayout columns={3} variant="text-grid">
                <SpaceBetween size="l">
                  <ValueWithLabel
                    label="Requester"
                    children={`${selectedItems[0].email}`}
                  />
                  <ValueWithLabel label="Status">
                    <Status status={selectedItems[0].status} />
                  </ValueWithLabel>
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
                    label="Ticket no"
                    children={`${selectedItems[0].ticketNo}`}
                  />
                </SpaceBetween>
                <SpaceBetween size="l">
                  <ValueWithLabel
                    label="Start time"
                    children={`${selectedItems[0].startTime}`}
                  />
                  <ValueWithLabel
                    label="Duration"
                    children={`${selectedItems[0].duration}`}
                  />
                  <ValueWithLabel
                    label="Justification"
                    children={`${selectedItems[0].justification}`}
                  />
                </SpaceBetween>
              </ColumnLayout>
              <>
                {action && (
                  <FormField
                    label="Comment"
                    stretch
                    description="Reason for approving or rejecting elevated access request"
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
                )}
              </>
            </SpaceBetween>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}

export default Approvals;
