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
| `generate_lead` | Delivered lead request | Count as a real web lead only after `/api/lead` confirms Netlify Forms forwarding; reconcile against Netlify Forms, inbox delivery, Google lead form, or CRM records. |
| `phone_call_click` | Click-to-call intent | Contact-intent key event only; validate quality against call logs, voicemail, duration, and reachable number. |
| `messenger_click` | Messenger contact intent | Contact-intent key event only; validate quality against actual Messenger threads/messages. |

### Keep as Secondary Diagnostics
| Event | Purpose | Key Event? |
|---|---|---|
| `StartLead` | Form friction and source/page intent | No |
| `normalized_intent` | `/get-help/` intent segmentation property | No |
| `line_of_business` | Lead segmentation property | No |
| `lead_submit` | Legacy submit helper on older/local pages | No |
| `phone_call`, `phone_click` | Legacy aliases | No |
| `page_view`, `scroll`, `click`, `user_engagement` | UX/content diagnostics | No |
| `Subscriber` | Audience-building, not sales lead | No |

### Current Lead-Funnel Guardrails
- `/js/funnel.js` fires explicit `StartLead` once per wired form as a diagnostic event.
- Data-funnel lead and newsletter forms POST to `/api/lead`; 4xx validation/bot rejections do not fall back to native submit and do not retain a thank-you lead marker.
- Newsletter forms fire `Subscriber`, never `Lead`, Google Ads lead conversion, or Meta CAPI Lead.
- `/api/lead` returns non-200 when Netlify Forms forwarding fails, so GA does not count failed form delivery as `generate_lead`.
- 5xx/API failures can fall back to native Netlify submit, but that fallback does not set the GA delivered-lead marker before Netlify/inbox capture is proven.
- `generate_lead` fires from `/thanks.html` only when same-session submission storage contains a fresh `Lead` marker.
- Primary lead quality is validated outside GA4 by matching event timestamps to Netlify Forms, `/api/lead` logs, Google lead forms, call logs, Messenger threads, and CRM outcomes.

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
Entry
  ↓
StartLead
  ↓
Step 1 -> normalized intent selected
  ↓
Step 2 -> timing selected
  ↓
Conversion → generate_lead

Side channels: phone_call_click / messenger_click
```

---

## Environment Notes for Claude Code

- Site is hosted on **Netlify** — deploy previews are `[hash]--lhi.netlify.app`
- Netlify previews should **not** receive production GA4 tracking — ensure tag only fires in production environment (`window.location.hostname === 'lakelandhealthinsurance.com'`)
- If using environment variables, tag IDs above should be referenced via `.env` and not hardcoded
- The untagged blog post may be a content type that lacks the tag include — check the blog post template separately from other page templates
