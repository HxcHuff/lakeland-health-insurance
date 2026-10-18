# Meta website-audience page inventory

Reviewed: 2026-10-17
Dataset/Pixel ID: `1480756087079484`
Browser event: standard `PageView` only on reviewed routes (default-on until opt-out)

This inventory is the reviewed browser-tracking boundary. A page must appear below, carry `<meta name="meta-audience-eligible" content="pageview">`, and pass the shared URL, referrer, privacy, hostname, and configuration gates before the Meta browser library can load. Conversion routes never inject an automatic Meta preference prompt on unreviewed paths.

## Eligible landing routes

- `/`
- `/get-help/`
- `/quote/`
- `/medicare/`
- `/medicare-broker-lakeland-fl/`
- `/aca-health-insurance-lakeland-fl/`
- `/medicare-2027-check/`
- `/plans/`
- `/thanks.html`
- `/blog/orlando-health-watson-clinic-2027-plan.html`
- `/blog/orlando-health-watson-clinic-insurance-2026.html`

These routes are eligible only under the isolation boundary: the loader sends a load-time standard `PageView` after privacy gates pass (default-allow until opt-out), never reads or listens to form fields, and Meta automatic matching, automatic events, and automatic configuration remain disabled. Denied, uncertain, GPC, and DNT states remain fail-closed.

Approved query parameters on eligible routes include `fbclid`, `gclid`, `gbraid`, `wbraid`, `msclkid`, and sanitized `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, and `utm_id`. Values are captured for first-party attribution when applicable; the Meta PageView reports origin and pathname only.

## Explicit browser-tracking denylist

- About, our-approach, learning, blog index, geographic brand pages, and general educational articles that are not listed above.
- Newsletter, booking/chat pages, all `/lp/` pages, and any confirmation surface other than `/thanks.html`.

`/book/` remains outside this audience-PageView inventory. Completed Calendly bookings on that page send a separate standard Meta `Schedule` conversion. See [`docs/meta-booked-appointment-conversion.md`](meta-booked-appointment-conversion.md).
- Estimators, calculators, applications, enrollment, current-client, post-enrollment, policy-service, referral, and other operational workflows.
- Medicaid status pages; provider, prescription, condition, mental-health, pre-existing-condition, claim, and hospital-bill pages.
- Income, subsidy, employment, coverage-loss, retirement, student, self-employed, or other life-event/status pages that are not listed above.
- Product- and plan-intent routes other than `/plans/`, including `/carriers/` and carrier children, dental/vision, supplemental, private medical, short-term medical, and Health ProtectorGuard pages.
- Privacy, SMS, consent, 404, offline, verification, and other utility pages.
- `/links/`, which redirects to `/learning/` and is not a production landing page for this pixel.
- `/contact/` and other general contact surfaces without the reviewed marker.
- Any target or referring URL with a fragment, an unapproved non-UTM query key/value, duplicate parameters, malformed encoding, or user-entered/sensitive data. Sanitized `utm_*` values are not limited to a campaign allowlist. Raw `utm_campaign`, `utm_term`, and `utm_content` values still fail closed when they look health-sensitive. After first-party capture, PageView reports origin + pathname only.

An accepted request can produce a server-side standard `Lead` only after Netlify Forms acceptance and only when the separate server gates pass. Browser pages never send a `Lead` event.
