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

TEAM supports optional AI-powered analysis of session activity using Amazon Bedrock. When enabled, it provides automated session analysis (activity summary, coherence check against justification, security review) and a justification quality check at request creation time.

## Deployment

Add the following parameters to `deployment/parameters.sh`:

```sh
# Bedrock AI Audit parameters
BEDROCK_AUDIT_ENABLED=true
BEDROCK_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_REGION=$REGION
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BEDROCK_AUDIT_ENABLED` | `false` | Set to `true` to deploy Bedrock AI audit infrastructure. |
| `BEDROCK_MODEL_ID` | `anthropic.claude-haiku-4-5-20251001-v1:0` | Bedrock model identifier (base ID without geo prefix). |
| `BEDROCK_REGION` | Same as `REGION` | Override only if needed. |

Run `./deploy.sh` after updating parameters.

## Anthropic Model Access (First-Time Setup)

Required one-time per account when using Anthropic models. Not needed for Amazon models (Nova).

**Step 1 — Submit Anthropic use case:**

```sh
aws bedrock put-use-case-for-model-access \
  --region $REGION \
  --profile $TEAM_ACCOUNT_PROFILE \
  --form-data "$(printf '%s' '{
    "companyName": "Your Company Name",
    "companyWebsite": "https://your-company.com",
    "intendedUsers": "0",
    "industryOption": "Technology",
    "otherIndustryOption": "",
    "useCases": "Internal elevated access management with AI-powered session analysis and justification quality check."
  }' | base64)"
```

**Step 2 — Create model agreement:**

```sh
aws bedrock create-foundation-model-agreement \
  --model-id anthropic.claude-haiku-4-5-20251001-v1:0 \
  --offer-token "$(aws bedrock list-foundation-model-agreement-offers \
    --model-id anthropic.claude-haiku-4-5-20251001-v1:0 \
    --region $REGION \
    --profile $TEAM_ACCOUNT_PROFILE \
    --query 'offers[0].offerToken' --output text)" \
  --region $REGION \
  --profile $TEAM_ACCOUNT_PROFILE
```

## Configuration

After deployment, configure runtime behavior from the **Settings** page:

- **Auto-analysis** — Automatically analyze sessions when they end. Disabled by default.
- **Justification quality check** — Blocks submission when justification is inadequate. Disabled by default.
- **Auto-analysis delay** — Minutes to wait before analysis (minimum 5, default 15).

## Model Selection

The default model is Claude Haiku 4.5. The geo prefix for cross-region inference is added automatically at runtime.

To use a different model, update `BEDROCK_MODEL_ID` in `parameters.sh` and redeploy:

| Model | ID |
|-------|-----|
| Claude Haiku 4.5 (default) | `anthropic.claude-haiku-4-5-20251001-v1:0` |
| Amazon Nova Lite | `amazon.nova-lite-v1:0` |

Amazon models (Nova) do not require the Anthropic model access steps above.

These are examples — verify latest available model versions in the [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.html).

## Disabling

Set `BEDROCK_AUDIT_ENABLED=false` in `parameters.sh` and redeploy, or disable individual features from the Settings UI.
