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
- Website funnel events are documented in `FUNNEL-EVENT-DICTIONARY.md`
- `js/funnel.js` owns `Lead`, `Subscriber`, `Schedule`, `PhoneClick`, `MessengerClick`, and `SelfServiceQuoteClick` dataLayer events
- Newsletter and guide opt-in forms must use `Subscriber`; they are not sales leads
- `thanks.html` may fire the legacy `generate_lead` event only after a same-session `Lead` marker exists

### GTM / Tag Notes
- One blog page confirmed **untagged**: `/blog/lost-job-health...` (partial URL from tag coverage scan)
- Root cause TBD — check GTM trigger conditions or CMS template for that post type

---

## Key Events (Conversions)

### Active & Firing
| Event | Purpose |
|---|---|
| `generate_lead` | Lead generated |
| `lead_step_1_complete` | Funnel step 1 complete |
| `lead_step_2_complete` | Funnel step 2 complete |
| `messenger_click` | Messenger engagement |
| `phone_call_click` | Phone call click |
| `ads_conversion_Blog_Views_1` | Blog content conversion (Google Ads) |

### Defined But Not Firing
| Event | Status | Notes |
|---|---|---|
| `ads_conversion_Form_1` | No stream data | Likely GTM trigger broken or name mismatch |
| `ads_conversion_Request_quote_1` | No stream data | Likely GTM trigger broken or name mismatch |
| `close_convert_lead` | No stream data | Likely GTM trigger broken or name mismatch |
| `form_submit` | No stream data | Likely GTM trigger broken or name mismatch |
| `qualify_lead` | No stream data | Likely GTM trigger broken or name mismatch |

### Also Firing (Not Yet Marked as Key Events)
- `form_start`, `click`, `first_visit`, `page_view`, `scroll`, `session_start`, `timing_complete`, `user_engagement`

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
4. **`form_start` not a key event** — Currently firing but not tracked as a conversion. Consider marking it as a key event for top-of-funnel visibility.

---

## Funnel Event Map (As Currently Firing)

```
Entry
  ↓
form_start
  ↓
Step 1 → lead_step_1_complete
  ↓
Step 2 → lead_step_2_complete
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
