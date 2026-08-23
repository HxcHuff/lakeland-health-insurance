# Meta website-audience page inventory

Reviewed: 2026-08-23
Dataset/Pixel ID: `1480756087079484`
Browser event: standard `PageView` only, after a confirmed site preference

This inventory is the reviewed browser-tracking boundary. A page must appear below, carry `<meta name="meta-audience-eligible" content="pageview">`, and pass the shared URL, referrer, privacy, hostname, and configuration gates before the Meta browser library can load.

## Eligible neutral routes

### Core public pages

- `/`
- `/about/`
- `/our-approach.html`
- `/learning/`
- `/blog/`

### Neutral geographic brand pages

- `/brandon-health-insurance/`
- `/clearwater-health-insurance/`
- `/davenport-health-insurance/`
- `/haines-city-health-insurance/`
- `/lake-alfred-health-insurance/`
- `/largo-health-insurance/`
- `/new-port-richey-health-insurance/`
- `/riverview-health-insurance/`
- `/st-petersburg-health-insurance/`
- `/tampa-health-insurance/`
- `/wesley-chapel-health-insurance/`
- `/winter-haven-health-insurance/`

### General educational and market articles

- `/blog/3-things-changing-florida-health-insurance-may-2026.html`
- `/blog/5-critical-health-insurance-mistakes.html`
- `/blog/aca-premiums-2026-lakeland.html`
- `/blog/central-florida-health-insurance-competition.html`
- `/blog/florida-aca-premiums-up-31-percent-2026.html`
- `/blog/health-insurance-brandon-2026.html`
- `/blog/health-insurance-checkup-every-age.html`
- `/blog/health-insurance-clearwater-2026.html`
- `/blog/health-insurance-largo-2026.html`
- `/blog/health-insurance-new-port-richey-2026.html`
- `/blog/health-insurance-riverview-2026.html`
- `/blog/health-insurance-st-petersburg-2026.html`
- `/blog/health-insurance-tampa-2026.html`
- `/blog/health-insurance-wesley-chapel-2026.html`
- `/blog/hmo-vs-ppo-vs-epo-explained.html`
- `/blog/lakeland-growth-health-insurance-impact.html`
- `/blog/understanding-out-of-pocket-maximum.html`
- `/blog/why-florida-health-insurance-premiums-increased-2026.html`
- `/blog/zip-code-health-insurance-pricing-florida.html`

The homepage, blog index, and 12 geographic brand pages contain forms. They are eligible only under the revised isolation boundary: the loader sends a load-time standard `PageView`, never reads or listens to form fields, and Meta automatic matching, automatic events, and automatic configuration remain disabled.

## Explicit browser-tracking denylist

- Intake, contact, and request processing: `/get-help/`, `/contact/`, `/quote/`, `/newsletter/`, `/thanks.html`, booking/chat pages, all `/lp/` pages, and any confirmation surface.
- Estimators, calculators, applications, enrollment, current-client, post-enrollment, policy-service, referral, and other operational workflows.
- Medicare or Medicaid status pages; provider, prescription, condition, mental-health, pre-existing-condition, claim, and hospital-bill pages.
- Income, subsidy, employment, coverage-loss, retirement, student, self-employed, or other life-event/status pages.
- Product- and plan-intent routes, including `/plans/`, `/carriers/` and carrier children, dental/vision, supplemental, private medical, short-term medical, and Health ProtectorGuard pages.
- Privacy, SMS, consent, 404, offline, verification, and other utility pages.
- `/links/`, which redirects to the eligible `/learning/` route and is not a separate production page.
- Any target or referring URL with a fragment, an unapproved query key/value, duplicate parameters, malformed encoding, or user-entered/sensitive data.

An accepted request can produce a server-side standard `Lead` only after Netlify Forms acceptance and only when the separate server gates pass. Browser pages never send a `Lead` event.
