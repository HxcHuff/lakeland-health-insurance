# Lakeland Health Insurance — Analytics & Tracking Environment

## Project Context
- **Site:** https://lakelandhealthinsurance.com
- **Business:** HealthMarkets - David (Lead Generation)
- **Platform:** Netlify (static site with deploy previews at `*.netlify.app`)
- **GA4 Property:** `a357914498` / `p492431963`

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

### OpenAI Ads Environment Variables
| Variable | Surface | Required | Notes |
|---|---|---:|---|
| `OPENAI_ADS_PIXEL_ID` | Browser config + server CAPI | Yes | Public Pixel ID from OpenAI Ads Manager. Same value must be used by Pixel and CAPI for dedupe. |
| `OPENAI_ADS_CAPI_KEY` | Server only | Yes | Secret key from OpenAI Ads Manager. Never expose in browser-visible env vars, source, logs, or docs. |
| `OPENAI_ADS_VALIDATE_ONLY` | Server only | No | Set to `true` only for validation smoke tests; leave blank/false for production collection. |
| `OPENAI_ADS_ALLOWED_ORIGINS` | Server only | No | Comma-separated trusted origins. Defaults to `https://lakelandhealthinsurance.com,https://www.lakelandhealthinsurance.com`. |

### Defined But Not Firing
| Event | Status | Notes |
|---|---|---|
| `ads_conversion_Form_1` | No stream data | Likely GTM trigger broken or name mismatch |
| `ads_conversion_Request_quote_1` | No stream data | Likely GTM trigger broken or name mismatch |
| `close_convert_lead` | No stream data | Likely GTM trigger broken or name mismatch |
| `form_submit` | No stream data | Likely GTM trigger broken or name mismatch |
| `qualify_lead` | No stream data | Likely GTM trigger broken or name mismatch |

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
1. **Untagged blog page** — `/blog/lost-job-health...` is missing the Google Tag. Check GTM trigger exclusions or CMS template. Verify fix with Tag Assistant.
2. **5 silent key events** — `ads_conversion_Form_1`, `ads_conversion_Request_quote_1`, `close_convert_lead`, `form_submit`, `qualify_lead` are all marked as conversions in GA4 but no stream data in 28 days. GTM trigger names likely don't match GA4 event names. Audit GTM → Tags → GA4 Event tags for each.

### Investigate
3. **`page_view` source** — Confirm `page_view` fires via `gtag('event', 'page_view')` in the tag snippet or GTM config tag, NOT via enhanced measurement. If it ever stops appearing in real-time, re-enable the enhanced measurement toggle.
4. **Legacy `lead_submit` cleanup** — Older local SEO pages may still emit `lead_submit`; keep it unmarked as a key event unless it is replaced by the canonical `generate_lead` path.

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
