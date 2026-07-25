# Lakeland Health Insurance Funnel Event Dictionary

This file documents the website-owned funnel events. Google Tag Manager and
platform-side conversion actions should map from these events instead of adding
new page-specific event names.

## Event Ownership

| Event | Owner | Fires When | Sales Lead? | Notes |
| --- | --- | --- | --- | --- |
| `PageView` | `js/funnel.js` | A page loads after the funnel bus initializes | No | Internal funnel stream and GTM/dataLayer segmentation by `page_type`. Direct Google page views remain owned by the Google tag setup. |
| `FunnelStart` | `js/funnel.js` or page UI | A multi-step intake begins | No | Use for meaningful first interaction, not raw page views. |
| `FunnelStep` | `js/funnel.js` or page UI | A visitor completes a meaningful intake step | No | Do not send personal or health details to ad payloads. |
| `Lead` | `js/funnel.js` | A sales/contact form is submitted | Yes | Exactly one website Lead event per form submission. `js/funnel.js` also stores the thank-you marker and owns the Google Ads lead conversion dispatch. |
| `Subscriber` | `js/funnel.js` | A newsletter or guide subscription form is submitted | No | Must not be counted as a sales lead. Preserve topic preference when present. |
| `ServiceRequest` | `js/funnel.js` | An existing client asks for annual review or post-enrollment help | No | Separate from net-new leads. Cross-sell interest is context, not a completed sale. |
| `Schedule` | `js/funnel.js` | Calendly link click or confirmed scheduled event | Usually yes | Clicks and confirmed bookings are separate by `cta_name` / `schedule_state`. |
| `PhoneClick` | `js/funnel.js`; legacy `phone_call_click` in `js/analytics.js` | A `tel:` CTA is clicked | Contact intent | `phone_call_click` remains for existing GA4/Ads continuity. |
| `MessengerClick` | `js/funnel.js`; legacy `messenger_click` where present | Messenger CTA clicked | Contact intent | Central event includes source path and attribution. |
| `SelfServiceQuoteClick` | `js/funnel.js` | HealthSherpa, HealthCare.gov, quote engine, or self-service quote CTA clicked | No | Tracks self-service intent, not a delivered lead. |
| `QualifiedLead` | Offline/downstream only unless qualification is authoritative on-site | A lead is verified as qualified | Yes | Do not fire from basic form submit alone. |
| `Enrollment` | Offline/downstream only | Enrollment is confirmed in authoritative records | No website event | The static site does not currently hold enrollment authority. |

## Google / GTM Ownership Model

- `js/analytics.js` loads GTM, Google Ads `gtag.js`, and `js/funnel.js`, with
  production-host gating and the existing QA override.
- `js/funnel.js` owns non-pageview funnel events and pushes them to
  `window.dataLayer`.
- `js/funnel.js` owns website Lead dedupe by intercepting
  `form[data-funnel-track]` submissions in capture phase and forwarding Lead
  forms to `/api/lead`.
- `thanks.html` fires legacy `generate_lead` only when a same-session Lead marker
  exists, then consumes the marker to prevent refresh double counts.
- Newsletter forms must use `Subscriber`, not `Lead` or `generate_lead`.
- Current-client review and post-enrollment setup forms use `ServiceRequest`,
  not `Lead`.

## Business Inputs Still Required

Lead value numbers are intentionally not invented in code. Update the documented
configuration in `js/funnel.js` only after David has approved authoritative
relative or dollar values for each funnel type.
