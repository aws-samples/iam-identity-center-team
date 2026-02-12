// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.
import React, { useState } from "react";
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  FormField,
  Textarea,
  Alert,
  Box,
} from "@awsui/components-react";
import { invalidateOUCache } from "../Shared/RequestService";

function CacheManagement(props) {
  const [ouIds, setOuIds] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function handleInvalidate() {
    setError("");
    setResult(null);
    
    const ids = ouIds
      .split(/[\n,]/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (ids.length === 0) {
      setError("Please enter at least one OU ID");
      return;
    }

    // Validate OU ID format: ou-xxxx-xxxxxxxx or root: r-xxxx
    const invalidIds = ids.filter(id => 
      !id.match(/^ou-[a-z0-9]{4,32}-[a-z0-9]{8,32}$/) && 
      !id.match(/^r-[a-z0-9]{4}$/)
    );
    if (invalidIds.length > 0) {
      setError(`Invalid OU ID format: ${invalidIds.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      const response = await invalidateOUCache(ids);
      setResult(response);
      if (response.invalidated.length > 0) {
        props.addNotification([
          {
            type: "success",
            content: `Successfully invalidated ${response.invalidated.length} cache entries`,
            dismissible: true,
            onDismiss: () => props.addNotification([]),
          },
        ]);
      }
    } catch (err) {
      setError(`Failed to invalidate cache: ${err.message}`);
      props.addNotification([
        {
          type: "error",
          content: "Failed to invalidate cache",
          dismissible: true,
          onDismiss: () => props.addNotification([]),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setOuIds("");
    setResult(null);
    setError("");
  }

  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Manually clear cached OU account data when organizational structure changes"
        >
          OU Cache Management
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Alert type="info">
          Use this to clear cached account data for specific Organizational Units (OUs) 
          after making changes in AWS Organizations, such as moving accounts between OUs 
          or modifying OU structure.
        </Alert>

        <FormField
          label="OU IDs"
          description="Enter one or more OU IDs (one per line or comma-separated). Format: ou-xxxx-xxxxxxxx"
          errorText={error}
        >
          <Textarea
            value={ouIds}
            onChange={({ detail }) => setOuIds(detail.value)}
            placeholder="ou-1234-12345678&#10;ou-5678-87654321"
            rows={5}
          />
        </FormField>

        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={handleInvalidate}
            loading={loading}
            disabled={!ouIds.trim()}
          >
            Invalidate Cache
          </Button>
          <Button onClick={handleClear} disabled={loading}>
            Clear
          </Button>
        </SpaceBetween>

        {result && (
          <Alert
            type={result.failed.length > 0 ? "warning" : "success"}
            header={result.message}
          >
            <SpaceBetween size="xs">
              {result.invalidated.length > 0 && (
                <Box>
                  <strong>Invalidated:</strong> {result.invalidated.join(", ")}
                </Box>
              )}
              {result.failed.length > 0 && (
                <Box>
                  <strong>Failed:</strong> {result.failed.join(", ")}
                </Box>
              )}
            </SpaceBetween>
          </Alert>
        )}
      </SpaceBetween>
    </Container>
  );
}

export default CacheManagement;
