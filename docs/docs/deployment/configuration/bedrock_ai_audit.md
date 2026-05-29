---
layout: default
title: Bedrock AI Audit
nav_order: 8
parent: Configuration
grand_parent: Solution deployment
---

# Bedrock AI Audit
{: .no_toc}

> This feature requires Athena audit mode. It is not available when using CloudTrail Lake mode.
{: .important}

TEAM supports optional AI-powered analysis of session activity using Amazon Bedrock. When enabled, it provides automated session analysis (activity summary, coherence check against justification, security review), visual indicators for flagged sessions in the audit list, and an advisory justification quality check at request creation time.

## Deployment

Add the following parameters to `deployment/parameters.sh`:

```sh
# Bedrock AI Audit parameters
BEDROCK_AUDIT_ENABLED=true
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_REGION=$REGION
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BEDROCK_AUDIT_ENABLED` | `false` | Set to `true` to deploy Bedrock AI audit infrastructure. |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-haiku-20240307-v1:0` | Bedrock foundation model identifier. |
| `BEDROCK_REGION` | Same as `REGION` | Override only if the model is not available in your deployment region. |

Run the standard deployment (`./deploy.sh`) after updating parameters.

> When `BEDROCK_AUDIT_ENABLED` is `false`, no Bedrock-related IAM permissions, Lambda functions, or UI elements are deployed. Existing functionality is unaffected.
{: .note}

## Configuration

After deployment, configure runtime behavior from the **Settings** page (visible only when the feature is enabled and Athena mode is active):

- **Auto-analysis** — Automatically analyze sessions when they end or are revoked. Disabled by default.
- **Justification quality check** — Evaluate justification text via AI at request creation (advisory only, never blocks submission). Disabled by default.
- **Auto-analysis delay** — Minutes to wait before triggering analysis (minimum 5, default 15). Allows CloudTrail events to propagate.

## Model Selection

The default model (Claude 3 Haiku) is recommended as a cost-effective option for structured analysis. To use a different model, update `BEDROCK_MODEL_ID` in `parameters.sh`:

```sh
BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
```

Check [Amazon Bedrock model availability](https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html) for region support. If your deployment region does not support the model, set `BEDROCK_REGION` to a supported region.

## Disabling

Set `BEDROCK_AUDIT_ENABLED=false` in `parameters.sh` and redeploy to remove all Bedrock-related resources. Alternatively, disable only runtime features (auto-analysis, justification check) from the Settings UI without removing infrastructure.
