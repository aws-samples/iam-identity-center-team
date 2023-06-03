// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Header,
  Pagination,
  Table,
  TextFilter,
  CollectionPreferences,
  SpaceBetween
} from "@awsui/components-react";
import { useCollection } from "@awsui/collection-hooks";
import { getSessionLogs, fetchLogs, getSession, deleteSessionLogs } from "../Shared/RequestService";
import { API, graphqlOperation } from "aws-amplify";
import {
  onUpdateSessions,
} from "../../graphql/subscriptions";
import "../../index.css";
import { CSVLink } from "react-csv";

const COLUMN_DEFINITIONS = [
  {
    id: "eventID",
    sortingField: "eventID",
    header: "eventID",
    cell: (item) => item.eventID,
    minWidth: 180,
  },
  {
    id: "eventName",
    sortingField: "eventName",
    header: "eventName",
    cell: (item) => item.eventName,
    minWidth: 200,
  },
  {
    id: "eventSource",
    sortingField: "eventSource",
    header: "eventSource",
    cell: (item) => item.eventSource,
    minWidth: 200,
  },
  {
    id: "eventTime",
    sortingField: "eventTime",
    header: "eventTime",
    cell: (item) => item.eventTime,
    minWidth: 180,
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
          { value: 10, label: "10 Logs" },
          { value: 30, label: "30 Logs" },
          { value: 50, label: "50 Logs" },
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
            label: "Log properties",
            options: [
              { id: "eventID", label: "eventID" },
              { id: "eventName", label: "eventName" },
              { id: "eventSource", label: "eventSource" },
              { id: "eventTime", label: "eventTime" },
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

function Logs(props) {
  const [allItems, setAllItems] = useState([]);
  const csvLink = useRef();
  const [preferences, setPreferences] = useState({
    pageSize: 10,
    visibleContent: ["eventID", "eventName", "eventSource", "eventTime"],
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
      empty: <EmptyState title="No logs" subtitle="No logs to display" />,
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
  const [refreshLoading, setRefreshLoading] = useState(false);

  useEffect(() => {
    views();
    updateEvent()
    setRefreshLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRefresh() {
    setRefreshLoading(true);
    setTableLoading(true);
    views();
  }

  async function addMeta(items) {
    // eslint-disable-next-line array-callback-return
    items.map((item) => {
      item.username = props.item.email;
      item.accountName = props.item.accountName;
      item.accountId = props.item.accountId;
    });
    return items;
  }

  function AddSessionLogs(expiry,endTime,username) {
    const data = {
      id: props.item.id,
      startTime: props.item.startTime,
      endTime: endTime,
      username: username,
      accountId: props.item.accountId,
      role: props.item.role,
      approver_ids: props.item.approver_ids,
      expireAt: expiry
    };
    getSessionLogs(data)
  }

  function getQueryId(){
    const username = props.item.username
    if (props.item.status === "in progress") {
        const expiry = Math.floor(Date.now() / 1000);
        const endTime = new Date().toISOString();
        const args = {
          id: props.item.id,
        };
        deleteSessionLogs(args).then(() => {
          AddSessionLogs(expiry,endTime,username)
        })
    } else {
      getSession(props.item.id).then((data) => {
        if (data !== null) {
          getLogs(data.queryId);
        } else {
          const expiry = Math.floor(Date.now() / 1000) + 432000 
          // Add an extra hour to end time to compensate PS session duration
          const endTime = new Date(Date.parse(props.item.endTime) + 60 * 60 * 1000).toISOString()
          AddSessionLogs(expiry,endTime,username)
        }
      })
    }
  }
  
  function getLogs(queryId) {
    let args = {
      queryId: queryId,
    };
    fetchLogs(args).then((items) => {
      if (items) {
        addMeta(items).then((items) => {
          setAllItems(items);
        });
      }
      setTableLoading(false);
      setRefreshLoading(false)
    });
  }


  function views() {
    getQueryId()
  }

  function updateEvent() {
    API.graphql(
      graphqlOperation(onUpdateSessions, {
        filter: {
          id: { eq: props.item.id },
        },
      })
    ).subscribe({
      next: ({ value }) => {
        getLogs(value.data.onUpdateSessions.queryId);
      },
      error: (error) => console.warn(error),
    });
  }

  function handleDownload() {
    csvLink.current.link.click();
  }

  return (
    <div className="container">
      <Table
        {...collectionProps}
        resizableColumns="true"
        loading={tableLoading}
        loadingText="Fetching session logs"
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${allItems.length})`
                : `(${allItems.length})`
            }
            description="Session activity logs are delivered in near real time"
            actions={
              <SpaceBetween size="s" direction="horizontal">
              {props.item.status === "in progress" &&
                <Button
                  iconName="refresh"
                  onClick={handleRefresh}
                  loading={refreshLoading}
                />
                }
                
                <div>
                  <Button
                    disabled={allItems.length === 0}
                    variant="primary"
                    onClick={handleDownload}
                    iconName="download"
                    iconAlign="left"
                  >
                    Download
                  </Button>
                  <CSVLink
                    data={allItems}
                    filename="session_logs.csv"
                    className="hidden"
                    ref={csvLink}
                    target="_blank"
                  />
                </div>
              </SpaceBetween>
            }
          >
            Session activity logs
          </Header>
        }
        filter={
          <div className="input-container">
            <TextFilter
              {...filterProps}
              filteringPlaceholder="Search Logs"
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
      />
    </div>
  );
}

export default Logs;
