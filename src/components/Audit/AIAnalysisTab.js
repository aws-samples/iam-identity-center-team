// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  ColumnLayout,
  ExpandableSection,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextContent,
} from "@awsui/components-react";
import { API, graphqlOperation } from "aws-amplify";
import { analyzeSession } from "../../graphql/queries";

function AIAnalysisTab({ item }) {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    triggerAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function triggerAnalysis() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const response = await API.graphql(
        graphqlOperation(analyzeSession, {
          sessionId: item.id,
          requestId: item.id,
        })
      );
      const data = response.data.analyzeSession;
      if (data.status === "failed") {
        setError(data.error || "Analysis failed");
      } else {
        setReport(data);
      }
    } catch (err) {
      console.error("Error triggering AI analysis:", err);
      setError(
        err.errors?.[0]?.message || "An error occurred while analyzing the session"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Box textAlign="center" padding={{ vertical: "l" }}>
        <SpaceBetween size="s" alignItems="center">
          <StatusIndicator type="loading">
            Analyzing session activity with AI. This may take a moment...
          </StatusIndicator>
        </SpaceBetween>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" padding={{ vertical: "l" }}>
        <SpaceBetween size="s" alignItems="center">
          <StatusIndicator type="error">{error}</StatusIndicator>
          <Button onClick={triggerAnalysis}>Retry</Button>
        </SpaceBetween>
      </Box>
    );
  }

  if (!report) {
    return null;
  }

  const summary = parseJSON(report.summary);
  const coherenceCheck = parseJSON(report.coherenceCheck);
  const securityReview = parseJSON(report.securityReview);
  const isPartial = report.status === "partial";

  return (
    <SpaceBetween size="l">
      <Box variant="small" color="text-body-secondary">
        Analyzed at: {new Date(report.analyzedAt).toLocaleString()}
        {isPartial && (
          <StatusIndicator type="in-progress">
            {" "}CloudTrail logs may still be propagating.
          </StatusIndicator>
        )}
      </Box>

      {isPartial && (
        <Button onClick={triggerAnalysis} loading={loading}>Refresh Analysis</Button>
      )}

      {/* Summary Section */}
      {summary && (
        <ExpandableSection headerText="Activity Summary" defaultExpanded>
          <SpaceBetween size="m">
            {summary.description && (
              <TextContent><p>{summary.description}</p></TextContent>
            )}
            {summary.serviceBreakdown && summary.serviceBreakdown.length > 0 && (
              <Table
                columnDefinitions={[
                  { id: "service", header: "Service", cell: (i) => i.service },
                  { id: "count", header: "Events", cell: (i) => i.count },
                  { id: "actions", header: "Actions", cell: (i) => (i.actions || []).join(", ") },
                ]}
                items={summary.serviceBreakdown}
                variant="embedded"
              />
            )}
          </SpaceBetween>
        </ExpandableSection>
      )}

      {/* Coherence Check Section */}
      {coherenceCheck && (
        <ExpandableSection headerText="Coherence Check" defaultExpanded>
          <SpaceBetween size="m">
            <ColumnLayout columns={2}>
              <div>
                <Box variant="awsui-key-label">Status</Box>
                <StatusIndicator type={getCoherenceStatusType(coherenceCheck.status)}>
                  {formatCoherenceStatus(coherenceCheck.status)}
                </StatusIndicator>
              </div>
            </ColumnLayout>
            {coherenceCheck.reasoning && (
              <TextContent><p>{coherenceCheck.reasoning}</p></TextContent>
            )}
            {coherenceCheck.findings && coherenceCheck.findings.length > 0 && (
              <Table
                columnDefinitions={[
                  { id: "action", header: "Action", cell: (i) => i.action },
                  { id: "explanation", header: "Explanation", cell: (i) => i.explanation },
                ]}
                items={coherenceCheck.findings}
                variant="embedded"
              />
            )}
          </SpaceBetween>
        </ExpandableSection>
      )}

      {/* Security Review Section */}
      {securityReview && securityReview.findings && securityReview.findings.length > 0 && (
        <ExpandableSection headerText={`Security Findings (${securityReview.findings.length})`} defaultExpanded>
          <Table
            columnDefinitions={[
              { id: "severity", header: "Severity", cell: (i) => (
                <StatusIndicator type="error">{i.severity}</StatusIndicator>
              )},
              { id: "eventName", header: "Event", cell: (i) => i.eventName },
              { id: "resource", header: "Resource", cell: (i) => i.resource },
              { id: "description", header: "Description", cell: (i) => i.description },
            ]}
            items={securityReview.findings}
            variant="embedded"
          />
        </ExpandableSection>
      )}

      {/* No security findings */}
      {securityReview && (!securityReview.findings || securityReview.findings.length === 0) && (
        <Box>
          <StatusIndicator type="success">No security findings</StatusIndicator>
        </Box>
      )}
    </SpaceBetween>
  );
}

function parseJSON(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    let parsed = JSON.parse(value);
    // Handle double-stringified AWSJSON (stored as JSON.stringify(obj) then returned as AWSJSON string)
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

function getCoherenceStatusType(status) {
  switch (status) {
    case "consistent": return "success";
    case "inconsistent": return "error";
    case "insufficient_justification": return "warning";
    case "pending": return "in-progress";
    default: return "info";
  }
}

function formatCoherenceStatus(status) {
  switch (status) {
    case "consistent": return "Consistent with justification";
    case "inconsistent": return "Inconsistent with justification";
    case "insufficient_justification": return "Insufficient justification detail";
    case "pending": return "Pending - waiting for logs";
    default: return status || "Unknown";
  }
}

export default AIAnalysisTab;
