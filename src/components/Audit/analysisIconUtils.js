/**
 * Determines the appropriate visual indicator icon for a session based on its analysis report.
 *
 * Icon determination logic (Property 9):
 * - "red-shield" when hasSecurityFindings is true (regardless of coherence findings)
 * - "orange-warning" when hasCoherenceFindings is true AND hasSecurityFindings is false
 * - "green-checkmark" when both hasSecurityFindings and hasCoherenceFindings are false
 * - null when report is not available or auto-analysis is disabled
 *
 * @param {Object|null} report - The analysis report object (or null if not available)
 * @param {boolean} report.hasSecurityFindings - Whether the report contains security findings
 * @param {boolean} report.hasCoherenceFindings - Whether the report contains coherence findings
 * @param {string} report.status - The report status (e.g., "completed", "failed")
 * @param {boolean} autoAnalysisEnabled - Whether auto-analysis is enabled in settings
 * @returns {string|null} The icon type or null if no icon should be shown
 */
export function getAnalysisIcon(report, autoAnalysisEnabled) {
  // No icon when auto-analysis is disabled or report not available
  if (!autoAnalysisEnabled || !report) {
    return null;
  }

  // No icon for failed or non-completed reports
  if (report.status !== "completed") {
    return null;
  }

  // Red shield: security findings present (regardless of coherence)
  if (report.hasSecurityFindings === true) {
    return "red-shield";
  }

  // Orange warning: coherence findings only (no security findings)
  if (report.hasCoherenceFindings === true) {
    return "orange-warning";
  }

  // Green checkmark: analysis complete with no findings
  return "green-checkmark";
}
