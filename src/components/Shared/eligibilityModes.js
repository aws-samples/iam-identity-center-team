// © 2023 Amazon Web Services, Inc. or its affiliates. All Rights Reserved.
// This AWS Content is provided subject to the terms of the AWS Customer Agreement available at
// http://aws.amazon.com/agreement or other written agreement between Customer and either
// Amazon Web Services, Inc. or Amazon Web Services EMEA SARL or both.

/**
 * Eligibility modes for access requests.
 * - LEGACY: Direct access - user selects account, permissions, duration directly
 * - POLICY_BASED: Policy-based access - user selects from predefined policy templates
 */
export const EligibilityMode = Object.freeze({
  LEGACY: "legacy",
  POLICY_BASED: "policy-based"
});

/**
 * Default eligibility mode
 */
export const DEFAULT_ELIGIBILITY_MODE = EligibilityMode.POLICY_BASED;

/**
 * Radio group options for eligibility mode selection in forms
 */
export const ELIGIBILITY_MODE_OPTIONS = Object.freeze([
  {
    value: EligibilityMode.LEGACY,
    label: "Legacy",
    description: "Define accounts, OUs, permissions, and duration directly"
  },
  {
    value: EligibilityMode.POLICY_BASED,
    label: "Policy-based",
    description: "Select from predefined policy templates"
  }
]);

/**
 * Radio group options for request flow selection
 */
export const REQUEST_FLOW_OPTIONS = Object.freeze([
  {
    value: EligibilityMode.LEGACY,
    label: "Direct access (select account and role directly)"
  },
  {
    value: EligibilityMode.POLICY_BASED,
    label: "Policy-based access (select from predefined policies)"
  }
]);
