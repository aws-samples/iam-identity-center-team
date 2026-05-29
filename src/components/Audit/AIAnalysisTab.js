// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  SpaceBetween,
  StatusIndicator,
} from "@awsui/components-react";
import { API, graphqlOperation } from "aws-amplify";
import { analyzeSession } from "../../graphql/queries";

function AIAnalysisTab({ item }) {
  const [loading, setLoading] = useState(false);
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

  return (
    <SpaceBetween size="l">
      <Box variant="h4">AI Analysis Report</Box>
      <Box variant="small" color="text-body-secondary">
        Analyzed at: {report.analyzedAt}
      </Box>
    </SpaceBetween>
  );
}

export default AIAnalysisTab;
