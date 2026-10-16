# Website form lead bridge

Status: **implemented in live `submission-created`**. Allowlisted Netlify
Forms submissions, including `get-help`, are posted to
`{LEAD_BRIDGE_URL}/website/lead`. A failed bridge call is logged, queued in
`website-lead-bridge-outbox-v1`, and the visitor still receives HTTP 200.
Missing `LEAD_BRIDGE_URL` or `LEAD_BRIDGE_KEY` is logged as an error and
queued the same way. It is not a silent skip.

## Event boundary

Netlify invokes `netlify/functions/submission-created.js` only after Forms has
accepted and retained a submission. The function minimizes allowlisted
sales/service forms and posts them to the Vercel lead bridge.

Delivery:

1. **Website lead bridge** — after production context is confirmed, allowlisted
   Forms events POST `{LEAD_BRIDGE_URL}/website/lead` with
   `x-bridge-key: {LEAD_BRIDGE_KEY}`. A failed POST is logged, written to
   `website-lead-bridge-outbox-v1`, and the handler returns HTTP 200
   `ACCEPTED` so the visitor is not shown an error and the lead is not lost.
   Missing `LEAD_BRIDGE_URL` or `LEAD_BRIDGE_KEY` is logged as an error
   (`FAILED` / `missing_configuration`), and the lead is queued for retry
   when the outbox is available. It is not skipped. The visitor still
   receives HTTP 200 `ACCEPTED`. This path never texts or emails a lead.
   HuffSherpa, Hopper, and Apps Script are not called.
2. **Scheduled bridge outbox drain** — `lead-bridge-retry` lists and retries
   leftover keys in the website-lead-bridge Blob store. If bridge
   configuration is still missing, the run logs that error and leaves queued
   records untouched. It does not delete them or spend their retry budget.
3. **Google-hosted Ads forms** — a separate webhook,
   `/api/google-lead-webhook`, posts accepted leads to `{LEAD_BRIDGE_URL}/`
   with the same `x-bridge-key`. That path also writes HubSpot portal
   247504188 and does not call HuffSherpa or Apps Script. See
   `docs/google-ads-crm-relay-runbook.md`.

Preview, branch, and `dev` `CONTEXT` values stay fail-closed and never POST
the bridge payload.

The Forms event function accepts the legacy `submission-created` event shape
and forwards only these exact sales/service forms:

- `get-help`
- `aca-lakeland-lead`
- `lp-aca-lead`
- `lp-medicare-lead`
- `lp-gap-lead`
- `subsidy-estimator-lead`
- `tampa-health-insurance`
- `winter-haven-health-insurance`
- `haines-city-health-insurance`
- `lake-alfred-health-insurance`
- `davenport-health-insurance`
- `brandon-health-insurance`
- `clearwater-health-insurance`
- `largo-health-insurance`
- `new-port-richey-health-insurance`
- `riverview-health-insurance`
- `st-petersburg-health-insurance`
- `wesley-chapel-health-insurance`

`homepage-newsletter` and `newsletter-signup` are skipped without network
access. An unknown form fails visibly so a new production form cannot silently
bypass the bridge. The relay reuses the exact form-specific allowlists in
`lead.js`, then reduces the accepted data to normalized contact, ZIP, intent,
insurance type, current attribution, and first-touch attribution fields.
Consent answers are forwarded as booleans. Notes, health or prescription text,
honeypots, subjects, instructions, and unknown fields never enter the bridge
payload.

## Attribution and failure rules

- Production context is required before the bridge can be posted.
  `LHI_SITE_ENV=production` is the runtime gate. Netlify Forms event
  functions often omit `CONTEXT`; an empty or missing `CONTEXT` is allowed
  only when `LHI_SITE_ENV=production`. Explicit `deploy-preview`,
  `branch-deploy`, or `dev` `CONTEXT` values still fail closed.
- A failed bridge POST, and a missing `LEAD_BRIDGE_URL` or `LEAD_BRIDGE_KEY`,
  are written to the site-scoped `website-lead-bridge-outbox-v1` store under
  a one-way digest of the immutable submission ID. The scheduled function
  retries every 15 minutes once configuration is present. Missing
  configuration is an error log, not a silent skip. The Forms response to
  the visitor remains HTTP 200 `ACCEPTED`.
- The original submission remains retained in Netlify Forms. No name, email,
  phone, ZIP, click ID, submission ID, endpoint, secret, or form payload is
  written to logs.

## Required production environment variables

Configure these on the Netlify production (Functions) context only. Do not
place either value in source control, tickets, logs, or preview/branch
contexts.

| Name | Exact requirement |
| --- | --- |
| `LEAD_BRIDGE_URL` | HTTPS origin or exact `{origin}/website/lead` path for the Vercel bridge |
| `LEAD_BRIDGE_KEY` | Shared key sent as `x-bridge-key`; 16–256 characters, not a placeholder |

The bridge path requires `LHI_SITE_ENV=production` before it will POST.
`CONTEXT=production` is accepted when present. Netlify Forms event functions
may omit `CONTEXT`; that omission is allowed only alongside
`LHI_SITE_ENV=production`. Explicit `deploy-preview`, `branch-deploy`, or
`dev` `CONTEXT` values are still rejected.

This relay forwards website leads only. It does not create a SOLD event,
upload a Google Ads conversion, or change Google Ads bidding, goals, budgets,
ads, or campaign settings.

## Leftover environment variables

These names may still exist in Netlify. This repository does not read them.
Do not delete them until David says so.

| Name | Status |
| --- | --- |
| `HUFFSHERPA_LEAD_WEBHOOK_URL_V1` | Unused. Previously the Apps Script receiver URL. |
| `HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1` | Unused. Previously the HMAC envelope secret. |
| `HUFFSHERPA_RELAY_ALERT_EMAIL` | Unused. Previously the HuffSherpa alert address. |
| `APPS_SCRIPT_LEAD_WEBHOOK_URL_V1` | Unused. Renamed Apps Script receiver URL. |
| `APPS_SCRIPT_LEAD_WEBHOOK_HMAC_SECRET_V1` | Unused. Renamed Apps Script HMAC secret. |
