# HuffSherpa Netlify lead relay

Status: **implemented in live `submission-created`; configuration-blocked until
production environment variables are provisioned; not yet activated**.

## Event boundary

Netlify invokes `netlify/functions/submission-created.js` only after Forms has
accepted and retained a submission. Two independent downstream paths run:

1. **Hopper** — `get-help` submissions are forwarded with
   `forwardGetHelpToHopper` exactly as production does today. Missing Hopper
   secrets remain a skip, not a throw. A Hopper failure does not block
   HuffSherpa CRM staging.
2. **HuffSherpa CRM** — allowlisted sales/service forms are minimized, written
   to the site-scoped Blob outbox, and posted as a signed envelope to IMPORT
   STAGING. A CRM failure does not undo Hopper.

The CRM relay accepts the legacy `submission-created` event shape and forwards
only these exact sales/service forms:

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
bypass staging. The relay reuses the exact form-specific
allowlists in `lead.js`, then reduces the accepted data to normalized contact,
ZIP, product-interest, current attribution, and first-touch attribution fields.
Consent answers, notes, health or prescription text, honeypots, subjects,
instructions, and unknown fields never enter the signed envelope.

## Signed staging protocol

The relay sends the HuffSherpa version-1 envelope:

- source: `netlify`
- event type: `submission_accepted`
- immutable source key: the lowercase 24-hex Netlify submission ID
- issued-at time: current UTC ISO timestamp
- nonce: 32 cryptographically random bytes, base64url encoded
- signature: base64url HMAC-SHA-256 over recursive-key-sorted canonical JSON

The HMAC secret is read only from
`HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1`. It must be exactly 64 base64url
characters encoding 48 random bytes; whitespace, low-diversity/repeated
patterns, and known placeholder forms are rejected on both ends.
The endpoint is read only from `HUFFSHERPA_LEAD_WEBHOOK_URL_V1` and must be
the exact HTTPS Apps Script deployment path
`https://script.google.com/macros/s/<deployment-id>/exec`.

The first request uses a manual redirect policy. The relay follows exactly one
302/303 ContentService redirect only when it targets the exact HTTPS
`script.googleusercontent.com` host with a bounded opaque path/query and no
credentials, port, or fragment. The follow-up is a bodyless GET with redirects
disabled. The final response must be HTTP 200, bounded to 4096
bytes, JSON, non-explicitly-cacheable, and exactly:

`{"ok":<boolean>,"outcome":<controlled outcome>,"reason":<controlled reason or null>}`

## Attribution and failure rules

- Click IDs remain case-sensitive and are never inferred from source text,
  contact data, UTMs, form names, or campaign IDs. If one touch contains more
  than one click-ID type, its click IDs are removed before storage while its
  bounded campaign context remains informational.
- Both current and `first_*` attribution are signed. Different valid
  first/current IDs are legitimate: HuffSherpa selects the validated current
  touch when present, otherwise first touch. A selected touch with more than
  one click-ID type fails closed.
- A campaign ID without a click ID remains informational. It cannot establish
  Google Ads match eligibility and does not block contact staging.
- Production context is required before the site-scoped Blob store can be
  opened. Deploy previews and branch deploys cannot write or forward records.
- Before network delivery, the function writes only the canonical minimized
  payload to the site-scoped `huffsherpa-lead-relay-outbox-v1` store under a
  one-way digest of the immutable submission ID. It never persists a stale
  signed envelope. A scheduled function retries every 15 minutes, minting a
  fresh issued-at time, nonce, and HMAC for every attempt.
- STAGED and REPLAY_NOOP delete the outbox item immediately. Transient failures
  retry with bounded exponential backoff and a hard 12-attempt ceiling.
  Controlled rejection enters QUARANTINED; exhausted retries enter FAILED.
  Both are alertable through the existing Resend/notification configuration.
- Minimized contact/click data is retained for at most seven days. At expiry it
  is purged and replaced by a PII-free visible FAILED tombstone rather than
  silently disappearing. The original accepted submission remains in Netlify
  Forms for authorized reconciliation.
- An Apps Script rejection, conflict, unsafe redirect, malformed response,
  timeout, missing configuration, or network error rejects the event function
  invocation and writes only fixed metadata fields to Netlify logs:
  event, allowlisted form name, outcome, and controlled reason.
- The original submission remains retained in Netlify Forms. No name, email,
  phone, ZIP, click ID, submission ID, endpoint, signature, secret, or form
  payload is written to logs.

## Required production environment variables

Configure these on the Netlify production (Functions) context only. Do not
place either value in source control, tickets, logs, or preview/branch
contexts.

| Name | Exact requirement |
| --- | --- |
| `HUFFSHERPA_LEAD_WEBHOOK_URL_V1` | Exact HTTPS Apps Script deployment URL `https://script.google.com/macros/s/<deployment-id>/exec` |
| `HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1` | 48 random bytes encoded as 64 unpadded base64url characters; independent of the Google Ads CRM form keys |

Hopper continues to use the existing `HOPPER_INGEST_URL` and
`HOPPER_LEAD_INGEST_SECRET` variables. Optional metadata-only terminal alerts
reuse `RESEND_API_KEY` plus `HUFFSHERPA_RELAY_ALERT_EMAIL` or `NOTIFY_EMAIL`.
The CRM path also requires `CONTEXT=production` and `LHI_SITE_ENV=production`
before it will open the outbox or POST the signed envelope.

## Activation gate

Before deployment:

1. Merge the matching HuffSherpa Apps Script contract that accepts all 18 form
   names, current attribution, the nine `first_*` fields, and informational
   campaign-only context.
2. Deploy the administrator-owned Apps Script web app and record the exact
   `/macros/s/<deployment-id>/exec` endpoint without exposing it in logs.
3. Provision the endpoint and one generated 64-character base64url shared
   secret in the production Netlify environment without placing either value
   in source control. Confirm the existing Resend/notification variables can
   deliver a metadata-only terminal-state alert.
4. Deploy the website so Netlify reprocesses the expanded static form
   blueprints.
5. Confirm `huffsherpa-relay-retry` appears as a scheduled production function,
   the site-scoped Blob context is available, and a live Apps Script redirect
   contract probe passes.
6. With separate approval, submit one clearly synthetic controlled lead and
   reconcile the Netlify submission, event-function outcome, Apps Script
   response, and HuffSherpa staging row.

This relay stages leads only. It does not create a SOLD event, upload a Google
Ads conversion, or change Google Ads bidding, goals, budgets, ads, or campaign
settings.
