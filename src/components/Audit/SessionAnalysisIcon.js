import React from "react";
import Icon from "@awsui/components-react/icon";
import { getAnalysisIcon } from "./analysisIconUtils";

/**
 * Renders a visual indicator icon for a session based on its analysis report.
 *
 * - Red shield: security findings present
 * - Orange warning: coherence findings only
 * - Green checkmark: analysis complete with no findings
 * - Nothing rendered when auto-analysis is disabled or report not available
 */
function SessionAnalysisIcon({ report, autoAnalysisEnabled }) {
  const iconType = getAnalysisIcon(report, autoAnalysisEnabled);

  if (!iconType) {
    return null;
  }

  switch (iconType) {
    case "red-shield":
      return (
        <span title="Security findings detected">
          <Icon name="security" variant="error" />
        </span>
      );
    case "orange-warning":
      return (
        <span title="Coherence findings detected">
          <Icon name="status-warning" variant="warning" />
        </span>
      );
    case "green-checkmark":
      return (
        <span title="Analysis complete - no findings">
          <Icon name="status-positive" variant="success" />
        </span>
      );
    default:
      return null;
  }
}

export default SessionAnalysisIcon;
