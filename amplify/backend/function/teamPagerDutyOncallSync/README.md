# teamPagerDutyOncallSync

Keeps an IAM Identity Center group in sync with a PagerDuty on-call rota.

Every run (12 hours by default) the function:

1. asks PagerDuty who is on call for the configured schedule(s) between now and
   now + `LOOKAHEAD_HOURS` (48h, i.e. today and tomorrow),
2. reads each responder's name and email,
3. matches those responders to IAM Identity Center users by email,
4. adds the matched users to the target group,
5. removes every other member of that group.

The target group is treated as **owned by this function** — anybody in it who is
not on call gets removed. Do not put permanent members in it.

This function is deliberately self-contained: it has no `dependsOn` entries, no
Lambda layers, no external Python packages (stdlib `urllib` for PagerDuty,
`boto3` from the Lambda runtime), and it does not touch the TEAM GraphQL API or
DynamoDB tables. Apart from a single entry in `amplify/backend/backend-config.json`
everything lives in this directory, to keep upstream fork syncs conflict-free.

## Setup

### 1. Create the PagerDuty token secret

Create a read-only PagerDuty REST API key ("General Access", read-only is
enough — the function only calls `GET /oncalls`), then store it in Secrets
Manager in the same account and region as the TEAM deployment:

```bash
aws secretsmanager create-secret \
  --name team/pagerduty/api-token \
  --secret-string '<pagerduty-api-token>'
```

The secret may hold the bare token or JSON with a `token`, `api_token`,
`pagerduty_token`, or `PAGERDUTY_TOKEN` key.

If you use a name outside the `team/pagerduty/*` prefix, update the resource ARN
in `custom-policies.json` as well as `PagerDutyTokenSecretName` — the
CloudFormation template scopes the `secretsmanager:GetSecretValue` grant to the
configured name, but `custom-policies.json` (used when the Amplify CLI
regenerates the template) is prefix-scoped and would otherwise drift.

If the secret is encrypted with a customer-managed KMS key, add `kms:Decrypt` on
that key to `custom-policies.json` and the template's
`CustomLambdaExecutionPolicy`.

### 2. Find the PagerDuty schedule ID

Open the schedule in PagerDuty; the ID is the last path segment of the URL
(`https://<subdomain>.pagerduty.com/schedules/PXXXXXX`).

### 3. Create the Identity Center group

Create the target group in IAM Identity Center and assign it whatever permission
sets the on-call responder needs. Leave it empty — the function fills it.

### 4. Configure and deploy

Edit `parameters.json`:

```json
{
    "PagerDutyScheduleIds": "PXXXXXX",
    "PagerDutyTokenSecretName": "team/pagerduty/api-token",
    "IdCGroupName": "AWS-OnCall",
    "IdCGroupId": "",
    "LookaheadHours": "48",
    "ScheduleExpression": "rate(12 hours)",
    "DryRun": "true"
}
```

Then deploy as usual (`amplify push`, or push to the branch the Amplify app
builds).

`DryRun` ships as `"true"`, so the first deploy changes nothing — it only logs
the membership diff it would apply. Check the CloudWatch logs, then set
`DryRun` to `"false"` and deploy again to let it write.

The EventBridge rule is created **disabled** while `PagerDutyScheduleIds` is
empty, so an unconfigured deployment never fires.

## Parameters

| Parameter | Env var | Default | Meaning |
| --- | --- | --- | --- |
| `PagerDutyScheduleIds` | `PAGERDUTY_SCHEDULE_IDS` | `""` | Comma separated PagerDuty schedule IDs. Empty disables the schedule. |
| `PagerDutyTokenSecretName` | `PAGERDUTY_TOKEN_SECRET` | `team/pagerduty/api-token` | Secrets Manager secret holding the API token. |
| `IdCGroupName` | `IDC_GROUP_NAME` | `""` | Display name of the target group. |
| `IdCGroupId` | `IDC_GROUP_ID` | `""` | Group ID; takes precedence over the name when set. |
| `LookaheadHours` | `LOOKAHEAD_HOURS` | `48` | Width of the on-call window, starting now. |
| `ScheduleExpression` | — | `rate(12 hours)` | EventBridge schedule expression. |
| `DryRun` | `DRY_RUN` | `true` | When true, log the diff without applying it. |

## Safety behaviour

The function makes **no writes at all** — no adds and no removals — when:

- any PagerDuty call fails (HTTP error, network error, bad token),
- PagerDuty reports nobody on call in the window,
- none of the on-call responders match an Identity Center user,
- the target group does not exist.

Each of those raises and the run fails loudly, leaving current membership
untouched. A PagerDuty outage can therefore never empty the group.

If *some* responders match and others do not, the sync proceeds and the
unmatched responders are logged as warnings and returned in the `unmatched`
field of the summary. Watch for those: an unmatched responder is on call
*without* the access this group grants.

Individual add/remove failures are logged per user, the rest of the run still
completes, and the invocation then fails so the error surfaces in CloudWatch
metrics.

## Matching

Responders are matched to Identity Center users by email, case-insensitively:

1. `GetUserId` on `userName` equal to the PagerDuty email — one API call, and the
   common case since Identity Center usernames are normally email addresses;
2. if that misses, all users are listed once and indexed by `UserName` plus every
   address in `Emails`, and the lookup is retried against that index.

The PagerDuty name is used for log lines only.

## Manual invocation

```bash
# dry run regardless of the deployed DRY_RUN setting
aws lambda invoke --function-name teamPagerDutyOncallSync-<env> \
  --payload '{"dry_run": true}' --cli-binary-format raw-in-base64-out /dev/stdout

# apply changes now, outside the schedule
aws lambda invoke --function-name teamPagerDutyOncallSync-<env> \
  --payload '{"dry_run": false}' --cli-binary-format raw-in-base64-out /dev/stdout
```

## Tests

Stdlib only, no runner or AWS credentials needed:

```bash
python3 amplify/backend/function/teamPagerDutyOncallSync/test_index.py
```

## Requirements

The TEAM account must be the IAM Identity Center management account or a
delegated administrator — the function calls `identitystore` directly with its
own execution role, like the other TEAM functions, and does not assume a role
into the management account.
