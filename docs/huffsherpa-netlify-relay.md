# HuffSherpa Netlify lead relay

Status: **retired for website leads**. HuffSherpa is no longer the CRM
destination for Netlify Forms. Allowlisted website submissions, including
`get-help`, post to `{LEAD_BRIDGE_URL}/website/lead`. That Vercel bridge
writes HubSpot portal 247504188. Hopper is not called. A failed bridge call
is logged, queued in `website-lead-bridge-outbox-v1`, retried by
`lead-bridge-retry`, and the Forms function invocation is rejected so the
failure is visible. The leftover HuffSherpa Apps Script contract below is
historical. Do not schedule `huffsherpa-relay-retry`.

## Event boundary

Netlify invokes `netlify/functions/submission-created.js` only after Forms has
accepted and retained a submission. Allowlisted sales/service forms are
minimized and posted to the Vercel website-lead bridge. HuffSherpa is not
called. Hopper is not called. Mailchimp and Meta CAPI stay on `/api/lead`
and do not depend on this file.

Delivery order:

1. **Website lead bridge (primary CRM)** — after production context is
   confirmed, allowlisted Forms events POST `{LEAD_BRIDGE_URL}/website/lead`
   with `x-bridge-key: {LEAD_BRIDGE_KEY}`. Missing `LEAD_BRIDGE_URL` /
   `LEAD_BRIDGE_KEY` on the production Forms hot path is a visible failure
   (`bridge_configuration_missing`). A failed bridge POST is logged, written
   to `website-lead-bridge-outbox-v1` when Blobs is available, retried by
   `lead-bridge-retry`, and the function invocation is rejected so the
   failure is visible. This path never texts or emails a lead.
2. **Retired HuffSherpa path** — the Forms handler no longer reads
   `HUFFSHERPA_*` env vars and never POSTs the Apps Script envelope.
   `huffsherpa-relay-retry` remains deployed as a no-op
   (`SKIPPED` / `huffsherpa_retired`) and is not scheduled.

Preview, branch, and `dev` `CONTEXT` values stay fail-closed and never POST
to the bridge.

The leftover HMAC envelope helpers and fixture below are historical. They
are not used by the website-lead handlers.

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
  contact data, UTMs, form names, or campaign IDs. Each valid click-ID type
  (`gclid`, `gbraid`, `wbraid`) is kept in its own field. Malformed or
  suspicious values are dropped. If a downstream consumer can store only one
  ID, choose `gclid`, then `gbraid`, then `wbraid`.
- Both current and `first_*` attribution are signed. Different valid
  first/current IDs are legitimate: HuffSherpa should select the validated
  current touch when present, otherwise first touch. Multiple valid types on
  the same touch are preserved; they are not treated as ambiguous.
- A campaign ID without a click ID remains informational. It cannot establish
  Google Ads match eligibility and does not block contact staging.
- Production context is required before the signed envelope can be posted.
  `LHI_SITE_ENV=production` is the runtime gate. Netlify Forms event
  functions (and the scheduled retry) often omit `CONTEXT`; an empty or missing
  `CONTEXT` is allowed only when `LHI_SITE_ENV=production`. Explicit
  `deploy-preview`, `branch-deploy`, or `dev` `CONTEXT` values still fail
  closed and cannot forward records.
- Forms event functions and `huffsherpa-relay-retry` use Lambda-compatibility
  `exports.handler`. The Forms hot path does not call `getStore` or `store.set`.
  Scheduled retry still uses the outbox factory, which calls
  `connectLambda(event)` immediately before `getStore`, then falls back to
  explicit `siteID` / `token` from Netlify-provided `SITE_ID` /
  `NETLIFY_SITE_ID` / `NETLIFY_BLOBS_CONTEXT` (or the event `blobs` token).
  If the store cannot open, retry fails closed with `outbox_unavailable` plus
  a controlled `cause` of the error name/code only — never the token, URL, or
  payload. Forms events do not wait on that store.
- Leftover outbox keys, when present, store only the canonical minimized
  payload in the site-scoped `huffsherpa-lead-relay-outbox-v1` store under a
  one-way digest of the immutable submission ID. The scheduled function
  retries every 15 minutes, minting a fresh issued-at time, nonce, and HMAC
  for every attempt. It never persists a stale signed envelope.
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
  event, allowlisted form name, outcome, controlled reason, and when present a
  controlled `cause`.
- The original submission remains retained in Netlify Forms. No name, email,
  phone, ZIP, click ID, submission ID, endpoint, signature, secret, or form
  payload is written to logs.

## Required production environment variables

Configure these on the Netlify production (Functions) context only. Do not
place either value in source control, tickets, logs, or preview/branch
contexts.

| Name | Exact requirement |
| --- | --- |
| `LEAD_BRIDGE_URL` | HTTPS origin of the Vercel lead bridge. The function posts `{LEAD_BRIDGE_URL}/website/lead`. |
| `LEAD_BRIDGE_KEY` | Shared bridge key sent as `x-bridge-key`. Placeholder values are rejected. |

Website Forms no longer read these leftover HuffSherpa variables. Do not
delete them in Netlify until David says so:

| Name | Status |
| --- | --- |
| `HUFFSHERPA_LEAD_WEBHOOK_URL_V1` | Unused in this repo. Website Forms and the Google-hosted webhook no longer read it. |
| `HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1` | Unused in this repo. Same as above. |
| `HUFFSHERPA_RELAY_ALERT_EMAIL` | Unused for website leads. The website Forms path no longer emails on CRM failure. |

The CRM path requires `LHI_SITE_ENV=production` before it will POST the
bridge. `CONTEXT=production` is accepted when present. Netlify Forms event
functions may omit `CONTEXT`; that omission is allowed only alongside
`LHI_SITE_ENV=production`. Explicit `deploy-preview`, `branch-deploy`, or
`dev` `CONTEXT` values are still rejected.

## Activation gate

Before deployment:

1. Merge and deploy the matching Vercel bridge first:
   `HxcHuff/google-ads-lead-relay#7`. That receiver already writes HubSpot
   portal 247504188 and accepts the click-ID / HubSpot attribution fields.
2. Confirm production Netlify already has `LEAD_BRIDGE_URL` and
   `LEAD_BRIDGE_KEY`. Do not delete leftover `HUFFSHERPA_*` variables in
   this change.
3. Deploy this website PR so Forms events post only to the bridge and
   `huffsherpa-relay-retry` is unscheduled.
4. Confirm `lead-bridge-retry` remains a scheduled production function.
5. With separate approval, submit one clearly synthetic controlled lead and
   reconcile the Netlify submission, event-function outcome, and HubSpot
   contact in portal 247504188.

This relay stages leads only. It does not create a SOLD event, upload a Google
Ads conversion, or change Google Ads bidding, goals, budgets, ads, or campaign
settings.
