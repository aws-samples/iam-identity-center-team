// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React from "react";
import {
  Box,
  Button,
  Container,
  Header,
  Table,
  StatusIndicator,
  Alert,
  SpaceBetween,
  ColumnLayout,
} from "@awsui/components-react";

/**
 * Safely parse an AWSJSON field.
 * Returns the parsed object or null if parsing fails.
 */
function parseJsonField(field) {
  if (!field) return null;
  if (typeof field === "object") return field;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
}

/**
 * Activity Summary section.
 * Displays a description and a service breakdown table.
 */
function ActivitySummary({ summary }) {
  if (!summary) return null;

  const serviceBreakdown = summary.serviceBreakdown || [];

  return (
    <Container header={<Header variant="h3">Activity Summary</Header>}>
      <SpaceBetween size="m">
        {summary.description && (
          <Box variant="p">{summary.description}</Box>
        )}
        <ColumnLayout columns={3} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Total events</Box>
            <Box>{summary.totalEvents ?? "-"}</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Write events</Box>
            <Box>{summary.writeEvents ?? "-"}</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">Read events</Box>
            <Box>{summary.readEvents ?? "-"}</Box>
          </div>
        </ColumnLayout>
        {serviceBreakdown.length > 0 && (
          <Table
            columnDefinitions={[
              {
                id: "service",
                header: "Service",
                cell: (item) => item.service,
                sortingField: "service",
              },
              {
                id: "actions",
                header: "Actions",
                cell: (item) =>
                  Array.isArray(item.actions)
                    ? item.actions.join(", ")
                    : item.actions || "-",
              },
              {
                id: "count",
                header: "Count",
                cell: (item) => item.count,
                sortingField: "count",
              },
            ]}
            items={serviceBreakdown}
            variant="embedded"
            header={
              <Header variant="h4" counter={`(${serviceBreakdown.length})`}>
                Service breakdown
              </Header>
            }
          />
        )}
      </SpaceBetween>
    </Container>
  );
}

/**
 * Coherence Check section.
 * Displays the coherence status and any findings.
 * Handles "insufficient_justification" with an informational message.
 */
function CoherenceCheck({ coherenceCheck }) {
  if (!coherenceCheck) return null;

  const { status, findings = [], reasoning } = coherenceCheck;

  const statusConfig = {
    consistent: { type: "success", label: "Consistent" },
    inconsistent: { type: "warning", label: "Inconsistent" },
    insufficient_justification: { type: "info", label: "Insufficient justification" },
  };

  const config = statusConfig[status] || { type: "info", label: status || "Unknown" };

  return (
    <Container header={<Header variant="h3">Coherence Check</Header>}>
      <SpaceBetween size="m">
        <StatusIndicator type={config.type}>{config.label}</StatusIndicator>
        {status === "insufficient_justification" && (
          <Alert type="info">
            The session justification lacks sufficient detail to perform a meaningful
            comparison against the actions performed. A more specific justification
            would enable coherence analysis.
          </Alert>
        )}
        {reasoning && (
          <Box variant="p" color="text-body-secondary">
            {reasoning}
          </Box>
        )}
        {status === "inconsistent" && findings.length > 0 && (
          <Table
            columnDefinitions={[
              {
                id: "action",
                header: "Action",
                cell: (item) => item.action,
              },
              {
                id: "explanation",
                header: "Explanation",
                cell: (item) => item.explanation,
              },
            ]}
            items={findings}
            variant="embedded"
            header={
              <Header variant="h4" counter={`(${findings.length})`}>
                Findings
              </Header>
            }
          />
        )}
      </SpaceBetween>
    </Container>
  );
}

/**
 * Security Review section.
 * Displays security findings table with eventName, resource, and description.
 */
function SecurityReview({ securityReview }) {
  if (!securityReview) return null;

  const findings = securityReview.findings || [];

  return (
    <Container header={<Header variant="h3">Security Review</Header>}>
      <SpaceBetween size="m">
        {findings.length === 0 ? (
          <StatusIndicator type="success">
            No high-criticality security findings detected
          </StatusIndicator>
        ) : (
          <Table
            columnDefinitions={[
              {
                id: "eventName",
                header: "Event name",
                cell: (item) => item.eventName,
                sortingField: "eventName",
              },
              {
                id: "resource",
                header: "Resource",
                cell: (item) => item.resource,
              },
              {
                id: "description",
                header: "Description",
                cell: (item) => item.description,
              },
            ]}
            items={findings}
            variant="embedded"
            header={
              <Header
                variant="h4"
                counter={`(${findings.length})`}
              >
                <StatusIndicator type="error">
                  {findings.length} security {findings.length === 1 ? "finding" : "findings"}
                </StatusIndicator>
              </Header>
            }
          />
        )}
      </SpaceBetween>
    </Container>
  );
}

/**
 * AnalysisReport component.
 * Renders the full AI analysis report with Activity Summary, Coherence Check,
 * and Security Review sections.
 *
 * Props:
 * - report: The AnalysisReport object from GraphQL (with AWSJSON fields)
 * - onRetry: Callback function to retry the analysis on failure
 */
function AnalysisReport({ report, onRetry }) {
  if (!report) return null;

  // Handle error/failed status
  if (report.status === "failed") {
    return (
      <Alert
        type="error"
        header="Analysis failed"
        action={
          <Button onClick={onRetry}>Retry</Button>
        }
      >
        {report.error || "An unknown error occurred during analysis."}
      </Alert>
    );
  }

  // Parse AWSJSON fields
  const summary = parseJsonField(report.summary);
  const coherenceCheck = parseJsonField(report.coherenceCheck);
  const securityReview = parseJsonField(report.securityReview);

  return (
    <SpaceBetween size="l">
      <Box variant="small" color="text-body-secondary">
        Analyzed at: {report.analyzedAt ? new Date(report.analyzedAt).toLocaleString() : "-"}
      </Box>
      <ActivitySummary summary={summary} />
      <CoherenceCheck coherenceCheck={coherenceCheck} />
      <SecurityReview securityReview={securityReview} />
    </SpaceBetween>
  );
}

export default AnalysisReport;
