# Meta website-audience page inventory

Reviewed: 2026-08-24
Dataset/Pixel ID: `1480756087079484`
Browser event: standard `PageView` only, after a confirmed site preference

This inventory is the reviewed browser-tracking boundary. A page must appear below, carry `<meta name="meta-audience-eligible" content="pageview">`, and pass the shared URL, referrer, privacy, hostname, and configuration gates before the Meta browser library can load.

## Eligible landing routes

- `/get-help/`
- `/quote/`
- `/medicare/`
- `/medicare-broker-lakeland-fl/`
- `/aca-health-insurance-lakeland-fl/`
- `/contact/`
- `/plans/`
- `/thanks.html`

These routes are eligible only under the isolation boundary: the loader sends a load-time standard `PageView`, never reads or listens to form fields, and Meta automatic matching, automatic events, and automatic configuration remain disabled.

## Explicit browser-tracking denylist

- Homepage, about, our-approach, learning, blog index, geographic brand pages, and general educational articles that are not listed above.
- Newsletter, booking/chat pages, all `/lp/` pages, and any confirmation surface other than `/thanks.html`.
- Estimators, calculators, applications, enrollment, current-client, post-enrollment, policy-service, referral, and other operational workflows.
- Medicaid status pages; provider, prescription, condition, mental-health, pre-existing-condition, claim, and hospital-bill pages.
- Income, subsidy, employment, coverage-loss, retirement, student, self-employed, or other life-event/status pages that are not listed above.
- Product- and plan-intent routes other than `/plans/`, including `/carriers/` and carrier children, dental/vision, supplemental, private medical, short-term medical, and Health ProtectorGuard pages.
- Privacy, SMS, consent, 404, offline, verification, and other utility pages.
- `/links/`, which redirects to `/learning/` and is not a production landing page for this pixel.
- Any target or referring URL with a fragment, an unapproved query key/value, duplicate parameters, malformed encoding, or user-entered/sensitive data.

An accepted request can produce a server-side standard `Lead` only after Netlify Forms acceptance and only when the separate server gates pass. Browser pages never send a `Lead` event.
