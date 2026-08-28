# Lakeland Health Insurance — Analytics & Tracking Environment

## Project Context
- **Site:** https://lakelandhealthinsurance.com
- **Business:** HealthMarkets - David (Lead Generation)
- **Platform:** Netlify (static site with deploy previews at `*.netlify.app`)
- **GA4 Property:** `a357914498` / `p492431963`
- **Last read-only audit:** 2026-08-21

---

## GA4 Property

| Setting | Value |
|---|---|
| Measurement ID | `G-W45RMKHXV0` |
| Stream ID | `11326517457` |
| Stream Name | Main Website |
| Stream URL | https://lakelandhealthinsurance.com/ |
| Google Tag IDs | `G-W45RMKHXV0`, `GT-K4LKHVFH`, `AW-300112445` |
| Google Ads Account | David — `788-008-5811` |
| OpenAI Ads | Browser Pixel + server CAPI use `OPENAI_ADS_PIXEL_ID`; server CAPI also requires `OPENAI_ADS_CAPI_KEY` |

---

## Tracking Architecture

### Tag Implementation
- Google Tag (`gtag.js`) fires `page_view` directly — **Enhanced Measurement page view toggle is intentionally disabled** to prevent double-counting
- All other Enhanced Measurement events are active: Scrolls, Outbound Clicks, Site Search, Form Interactions, Video Engagement, File Downloads
- Tag sends to two destinations: GA4 (Main Website) + Google Ads (David)

### GTM / Tag Notes
- One blog page confirmed **untagged**: `/blog/lost-job-health...` (partial URL from tag coverage scan)
- Root cause TBD — check GTM trigger conditions or CMS template for that post type

---

## Read-Only Lead Audit Snapshot

### Google Ads — July 22 through August 20, 2026

| Conversion action | Count | Actual meaning |
|---|---:|---|
| Google-hosted Lead form - Submit | 10 | Google-hosted form submissions; the website and GA4 do not participate |
| LHI Lead Form Submit | 1 | Website conversion action associated with the site lead path |
| Calls from ads, 60 seconds or longer | 1 | Confirmed ad-call conversion |
| Website call action | 0 | No qualifying website-call conversion in this range |

### GA4 — July 24 through August 20, 2026

| Event | Events | Users | Status |
|---|---:|---:|---|
| `generate_lead` | 107 | 42 | Key event; only two events carried the current canonical `content_name`, `step`, and `page_type` contract |
| `form_submit` | 5 | 2 | Enhanced-measurement form interaction; not proof of Forms acceptance |
| `ads_conversion_Form_1` | 5 | 2 | Custom-event copy of `form_submit`; unsafe as a sales-lead count |
| `phone_call_click` | 9 | 6 | Key event; click intent, not a completed or qualified call |
| `qualify_lead` | 0 | 0 | No event source exists; therefore the Generate leads overview correctly shows Qualified leads = 0 |

The 107 `generate_lead` events are not 107 known business leads. The audited window crosses a historical implementation in which both GTM and `/thanks.html` could emit `generate_lead`; that thank-you emission was removed on July 31, 2026. Older events also used nested or different parameters. Those historical paths and a possible GTM parameter-mapping gap are consistent with the 105 events without the current canonical fields; the aggregate report cannot assign each event to one cause. Any remaining post-release events without all canonical fields must be traced to GTM/custom-event mapping before they are treated as accepted website leads.

The zero under Qualified leads is not a Google Ads lead count and not evidence that Ads missed real leads. That GA4 card counts users who triggered the distinct recommended event `qualify_lead`. No authenticated human/CRM qualification transition currently emits it.

---

## GA4 Event Policy

Goal: optimize site measurement for qualified Medicare/ACA leads, not raw clicks or generic engagement.

### Mark as Key Events
| Event | Purpose | Quality Rule |
|---|---|
| `generate_lead` | Netlify Forms-accepted lead request | Fires from GTM's single `Lead` trigger only after `/api/lead` returns `ok: true`, `forms: true`, and an approved server event ID. It is not proof of inbox, broker, or CRM delivery. |
| `phone_call_click` | Click-to-call intent | Contact-intent key event only; validate quality against call logs, voicemail, duration, and reachable number. |
| `messenger_click` | Messenger contact intent | Contact-intent key event only; validate quality against actual Messenger threads/messages. |

### Keep as Secondary Diagnostics
| Event | Purpose | Key Event? |
|---|---|---|
| `StartLead` | Form friction and source/page intent | No |
| `medicare_content_view` | View of a registered Medicare selection or transaction page | No |
| `medicare_cta_click` | Click on a registered CTA from either Medicare page | No |
| `medicare_intake_start` | First meaningful interaction with the Medicare Get Help intake | No |
| `lead_receipt_view` | Fresh same-session confirmation-page view after an accepted lead | No |
| `normalized_intent` | `/get-help/` intent segmentation property | No |
| `line_of_business` | Lead segmentation property | No |
| `lead_submit` | Legacy submit helper on older/local pages | No |
| `phone_call`, `phone_click` | Legacy aliases | No |
| `external_quote_click` | Outbound self-service quote/application intent | No |
| `page_view`, `scroll`, `click`, `user_engagement` | UX/content diagnostics | No |
| `Subscriber` | Audience-building, not sales lead | No |

### Current Lead-Funnel Guardrails
- `/js/funnel.js` fires explicit `StartLead` once per wired form as a diagnostic event and `medicare_intake_start` once when the allowlisted Medicare intake context is present.
- Explicit outbound quote/application links marked with `data-funnel-external-quote` fire `external_quote_click`; `content_name` distinguishes the CTA using a non-sensitive static label.
- Data-funnel lead and newsletter forms POST to `/api/lead`; 4xx validation/bot rejections do not fall back to native submit and do not retain a thank-you lead marker.
- Newsletter forms fire `Subscriber`, never `Lead`, Google Ads lead conversion, or Meta CAPI Lead.
- Browser acceptance requires all three response conditions: `ok: true`, `forms: true`, and an approved server `event_id`. A malformed or incomplete HTTP 200 does not fire `Lead`, redirect, or retain a thank-you marker.
- The public `Lead` tracker fails closed unless both `acceptance_status=forms_accepted` and an approved server `event_id` are supplied, and it emits each accepted ID at most once per page lifecycle.
- Every parsed `data-funnel-track` form requests the delivery bus immediately. City pages no longer retain page-local `lead_submit` or direct Forms POST handlers that could bypass `/api/lead`.
- `/api/lead` accepts only registered form names and form-specific scalar fields, with a 64 KB request limit and an 8 KB per-field limit. Unknown keys, objects, arrays, and oversized values fail closed or are discarded before Forms forwarding.
- Get Help request consent is required. Consent timestamps, evidence version, page, withdrawal state, and channel states are derived server-side; client-authored consent-state fields are not authoritative.
- `/api/lead` returns non-200 when Netlify Forms forwarding fails, so GA does not count a failed Forms forward as `generate_lead`.
- Meta CAPI, Ads/OpenAI CAPI, and Mailchimp run only after Netlify Forms accepts the request. The PHI-free function log records the opaque `event_id` and component outcomes for reconciliation.
- 5xx/API failures can fall back to native Netlify submit, but that fallback does not set the GA Forms-accepted marker before Netlify acceptance is proven.
- GTM owns the only `Lead` → `generate_lead` conversion path. `/thanks.html` consumes the same-session marker and emits only `lead_receipt_view`; direct visits and refreshes do not create a conversion.
- OpenAI Ads `lead_created` fires only for sales/service `Lead` submissions after `/api/lead` confirms Netlify Forms forwarding. Browser Pixel and server CAPI share the same server event ID for deduplication.
- OpenAI Ads CAPI reads raw `__oppref` and `__obref` cookies when present, strips query strings/fragments from `source_url`, and sends only approved conversion context: event ID, timestamp, path-only source URL, and OpenAI attribution cookies. It does not send raw names, email, phone, ZIP, providers, prescriptions, or notes.
- Primary lead quality is validated outside GA4 by matching event timestamps to Netlify Forms, `/api/lead` logs, Google lead forms, call logs, Messenger threads, and CRM outcomes.

### Medicare Attribution Contract

The complete registry, privacy contract, acceptance semantics, and scorecard schedule are documented in [`docs/medicare-attribution-measurement.md`](docs/medicare-attribution-measurement.md).

| Page | `page_key` | `page_role` | `content_cluster` |
|---|---|---|---|
| `/best-medicare-broker-lakeland-fl/` | `best_medicare_broker_lakeland_fl` | `selection` | `lakeland_medicare_broker` |
| `/medicare-broker-lakeland-fl/` | `medicare_broker_lakeland_fl` | `transaction` | `lakeland_medicare_broker` |
| `/get-help/?intent=medicare...` | `get_help` | `intake` | `lakeland_medicare_broker` |

The browser accepts only registry-derived page roles, cluster names, and CTA keys. It does not trust `source_page_role` or `content_cluster` from a URL or hidden field. Campaign parameters are limited to validated `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content`; contact-like values are rejected. Google Ads Final URL suffixes use `utm_campaign=cid_{campaignid}` so platform campaign IDs remain distinguishable from phone-like numeric values. `utm_term` is limited to the bounded Google Ads ValueTrack `{keyword}` value (the matched advertiser keyword, not the user's raw Search Terms query). Raw query strings, referrer URLs, `gclid`, and `fbclid` are not copied into the Get Help attribution record.

Allowed analytics fields are version and event ID, registered page/role/CTA/cluster values, `intent=medicare`, bounded event/content/step tokens, normalized source path, and `acceptance_status=forms_accepted`. Names, email, phone, ZIP, DOB/age, Medicare or policy identifiers, providers, facilities, prescriptions, income, health/coverage answers, and free text are prohibited.

Measurement boundaries are intentionally separate:

1. Content, CTA, and intake events measure visitor behavior.
2. `Lead` and the resulting `generate_lead` mean Netlify Forms accepted the request.
3. Downstream readable delivery to the broker/inbox/CRM is not yet measured by this browser contract and must not be inferred from GA4.

### Lead Function Environment Variables
| Variable | Surface | Required | Notes |
|---|---|---:|---|
| `LEAD_FORMS_ORIGIN` | Server only | No | Fixed origin used for Netlify Forms forwarding. Defaults through `DEPLOY_URL`, `DEPLOY_PRIME_URL`, `URL`, then the production site. Never derive it from the request `Host`. |
| `LEAD_ALLOWED_ORIGINS` | Server only | No | Additional comma-separated CORS/source origins. Production, `URL`, `DEPLOY_PRIME_URL`, and `DEPLOY_URL` are included when configured. |

### Google Ads Lead-Form Webhook Controls

- Google delivery is not exactly once. The webhook validates and bounds the payload, authenticates the exact approved form with its unique Google key, and atomically creates a minimized site-scoped Netlify Blobs outbox record before any CRM delivery attempt.
- The outbox key is a domain-separated SHA-256 digest of Google's opaque `lead_id`, independent of all authentication secrets. While pending, the record contains only approved contact fields and Google attribution identifiers. Successful delivery immediately removes that payload and retains a metadata-only tombstone for replay suppression.
- Exact replays return 200 without another CRM delivery. A changed payload under the same `lead_id` is quarantined. A write/read-confirmation outage returns 503 before downstream delivery so Google can retry.
- The only downstream path is a versioned HMAC-signed envelope to the pinned Apps Script CRM receiver. Customer.io, Lob, email, SMS, Mailchimp, and other marketing or messaging providers are not part of this Google-hosted lead workflow.
- A bounded 15-minute scheduled function retries pending deliveries and performs best-effort privacy maintenance. Operational logs and alerts contain controlled reason codes and counts only, never lead IDs, click IDs, contact data, Blob keys, payloads, or secrets. See `docs/google-ads-crm-relay-runbook.md` for retry, retention, and activation details.

| Variable | Surface | Required | Notes |
|---|---|---:|---|
| `GOOGLE_ADS_ACCOUNT_ID` | Server only | Yes | Must be exact approved routing account `7880085811`; the raw Google webhook does not supply or prove this account identity. |
| `GOOGLE_LEAD_FORM_ID_ALLOWLIST` | Server only | Yes | Must be exactly `357496832026,398917236265` in that order. |
| `GOOGLE_LEAD_WEBHOOK_KEY_357496832026` | Server only | Yes | Unique high-entropy Google key for the approved ACA form. Never expose, persist, or log it. |
| `GOOGLE_LEAD_WEBHOOK_KEY_398917236265` | Server only | Yes | Different unique high-entropy Google key for the approved Medicare form. Never expose, persist, or log it. |
| `HUFFSHERPA_LEAD_WEBHOOK_URL_V1` | Server only | Yes | Pinned production Apps Script `/exec` receiver URL. |
| `HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1` | Server only | Yes | Independent 48-byte random secret encoded as 64 unpadded base64url characters. |

### OpenAI Ads Environment Variables
| Variable | Surface | Required | Notes |
|---|---|---:|---|
| `OPENAI_ADS_PIXEL_ID` | Browser config + server CAPI | Yes | Public Pixel ID from OpenAI Ads Manager. Same value must be used by Pixel and CAPI for dedupe. |
| `OPENAI_ADS_CAPI_KEY` | Server only | Yes | Secret key from OpenAI Ads Manager. Never expose in browser-visible env vars, source, logs, or docs. |
| `OPENAI_ADS_VALIDATE_ONLY` | Server only | No | Set to `true` only for validation smoke tests; leave blank/false for production collection. |
| `OPENAI_ADS_ALLOWED_ORIGINS` | Server only | No | Comma-separated trusted origins. Defaults to `https://lakelandhealthinsurance.com,https://www.lakelandhealthinsurance.com`. |

### Custom And Downstream Event Status
| Event | Status | Notes |
|---|---|---|
| `ads_conversion_Form_1` | Firing: 5 events / 2 users | Broad copy of `form_submit`; diagnostic only and not a reliable lead conversion |
| `form_submit` | Firing: 5 events / 2 users | Browser-detected form interaction; diagnostic only |
| `ads_conversion_Request_quote_1` | Not observed | Rule points to an obsolete thank-you path; retire only after confirming no Ads dependency |
| `qualify_lead` | Not implemented | Reserve for an authenticated human/CRM qualification transition |
| `close_convert_lead` | Not implemented | Reserve for a confirmed customer/enrollment outcome |

### Also Firing
- `click`, `first_visit`, `page_view`, `scroll`, `session_start`, `timing_complete`, `user_engagement`

---

## Data Collection Settings

| Setting | Value |
|---|---|
| Event data retention | 14 months |
| User data retention | 14 months |
| Reset on new user activity | On |
| Google Signals | On (307/307 regions) |
| Granular location & device data | On |
| User-provided data collection | Acknowledged |
| Attribution model | Data-driven |
| Acquisition key event lookback | 30 days |
| All other key events lookback | 90 days |

---

## Data Filters

| Filter | Type | Operation | State |
|---|---|---|---|
| Internal Traffic | Internal Traffic | Exclude | **Active** |

---

## Cross-Domain Configuration

**Included domains (production only):**
- `lakelandhealthinsurance.com` (exactly matches)

**Unwanted referrals (blocked):**
- `netlify.app` (contains) — covers all Netlify deploy preview subdomains

---

## Known Issues & Open TODOs

### Must Fix in Codebase
1. **Untagged blog page** — `/blog/lost-job-health...` is missing the Google Tag. Check GTM trigger exclusions or CMS template for that post type. Verify the fix with Tag Assistant.
2. **GTM readback after release** — confirm one accepted server event ID produces one outbound `generate_lead` carrying top-level `content_name=first_party_lead`, `step=submit`, `page_type`, `acceptance_status=forms_accepted`, and `event_id`.

### Investigate
3. **`page_view` source** — confirm `page_view` fires from the intended Google tag path and remains singular.
4. **Custom-event cleanup** — after confirming no bidding dependency, archive/unmark `ads_conversion_Form_1` and the obsolete `ads_conversion_Request_quote_1` rule. Do not map either to `qualify_lead`.
5. **Outcome infrastructure** — select an authenticated CRM/admin identity and durable outcome ledger before implementing `qualify_lead` or Ads offline qualified-lead uploads.

### Resolved In This Release Candidate
6. **Google-hosted lead durability and deduplication** — resolved locally with a minimized atomic Netlify Blobs outbox keyed from Google `lead_id`, immediate first delivery, bounded scheduled retry, changed-replay quarantine, and metadata-only terminal tombstones.
7. **Downstream scope review** — resolved fail-closed. This workflow calls only the pinned signed Apps Script CRM receiver. It does not call Customer.io, Lob, Mailchimp, email, SMS, or another customer-messaging provider.

---

## Funnel Event Map (As Currently Firing)

```
Registered Medicare content view
  ↓
Registered Medicare CTA click
  ↓
StartLead + medicare_intake_start
  ↓
Semantic /api/lead success + Netlify Forms accepted
  ↓
One Lead trigger → one generate_lead
  ↓
lead_receipt_view (diagnostic only)

Side channels: phone_call_click / messenger_click / external_quote_click
```

This map ends at Forms acceptance. `medicare_delivery_confirmed`, secure-intake completion, case readiness, and completed review require a separate authenticated downstream reconciliation source.

---

## Environment Notes for Claude Code

- Site is hosted on **Netlify** — deploy previews are `[hash]--lhi.netlify.app`
- Netlify previews should **not** receive production GA4 tracking — ensure tag only fires in production environment (`window.location.hostname === 'lakelandhealthinsurance.com'`)
- If using environment variables, tag IDs above should be referenced via `.env` and not hardcoded
- The untagged blog post may be a content type that lacks the tag include — check the blog post template separately from other page templates
