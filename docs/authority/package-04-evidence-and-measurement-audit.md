# Work Package 04 — Evidence and Measurement Integrity Audit

Review date: August 2, 2026
Status: production measurement readback complete; no redirect, form submission, or external-account mutation performed

## Executive decision

No URL consolidation is authorized yet. Repository, Netlify, direct and linked Search Console, GA4, and GTM evidence is strong enough to define the comparison set and identify measurement defects. Search Console reports zero external links for the property, while QA-excluded conversion and function-delivery aggregates remain unavailable. CRM evidence is explicitly not applicable to this package by owner direction. Missing data is recorded as **unavailable** or **not returned**, never as zero.

The safest current action is to preserve every compared URL, repair measurement integrity in a separate controlled package, obtain the missing aggregate reports, and then make one evidence-backed redirect decision per intent cluster.

## Evidence collected

### Repository and production

- Production is Netlify project `lhi`, site ID `b6ad2d8f-d771-44f4-89b5-7ab30350950e`.
- The current production deploy is `6a6e6f24d87096000870dda4`, state `ready`, context `production`, branch `main`, commit `4d3aa00c8caf4bfc6ffa2a3a21a3092953630d39`.
- The deploy reports 192 redirect rules, 15 header rules, four functions, no edge functions, and no secret-scan matches.
- Netlify's deploy Lighthouse summary for `/` is Performance 97, Accessibility 100, Best Practices 100, SEO 99, and PWA 100.
- The compared URL inventory, sitemap status, and exact internal-link counts are in `url-consolidation-evidence.csv`. Counts mean the number of repository HTML files containing an exact root-relative `href` for that URL; they are not traffic or backlink counts.

### Netlify Forms aggregate

The read-only Forms inventory returned 20 forms, all with honeypot enabled and none with reCAPTCHA enabled. It returned 16 currently retained submissions:

| Form | Retained count | Last submission timestamp |
|---|---:|---|
| `get-help` | 12 | 2026-07-27 15:50:01 UTC |
| `newsletter-signup` | 2 | 2026-07-27 16:01:36 UTC |
| `homepage-newsletter` | 1 | 2026-07-29 21:48:06 UTC |
| `aca-lakeland-lead` | 1 | 2026-07-27 14:36:06 UTC |

Six additional forms reported a last-submission timestamp on July 27 while their retained count was zero: `haines-city-health-insurance`, `winter-haven-health-insurance`, `tampa-health-insurance`, `lp-medicare-lead`, `lp-gap-lead`, and `lp-aca-lead`. This inconsistency may reflect deleted, spam-filtered, or test records, but the cause was not directly verified and must not be inferred.

No individual submission or payload was opened. Retained Forms counts do not prove successful downstream delivery, CRM receipt, analytics collection, or advertising suppression.

### Direct Search Console, linked Search Console, and GA4 aggregates

The Search Console landing-page report linked inside GA4 was available for April 1, 2025 through July 30, 2026. It reported 87 clicks, 71,140 impressions, 0.12% CTR, average position 41.60, 162 active users, 153 engaged sessions, 1,682 events, and 178 all key events across the property.

Direct Search Console access was subsequently confirmed for the URL-prefix property `https://lakelandhealthinsurance.com/`. The overview reported 61 web-search clicks in its current overview window, 88 indexed pages, 38 not-indexed pages, 59 HTTPS pages, zero non-HTTPS pages, 37 valid breadcrumb items, three valid review snippets, and zero unparsable structured-data items.

The direct Links report reported:

- External links: **0 total**, with no linked pages, linking sites, or linking text returned.
- Internal links: **728 total** across 41 reported target pages.
- Selected targets: `/plans/` 59, `/medicare/` 12, `/medicare-broker-lakeland-fl/` 6, `/best-medicare-broker-lakeland-fl/` 5, `/blog/florida-aca-enrollment-and-benefits-2026.html` 20, `/blog/florida-insurance-guide.html` 7, `/blog/health-insurance-self-employed-tax-deductions.html` 5, and `/blog/lost-job-health-insurance-lakeland.html` 5.

The zero external-link result removes Search Console-observed backlink equity as a blocker for the compared URLs. It does not claim that no link exists anywhere on the web or replace a third-party backlink index.

Selected clean-path rows with the report's key-event selector set to `generate_lead`:

| Landing path | Clicks | Impressions | CTR | Avg. position | Active users | Engaged sessions | Raw `generate_lead` |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/medicare/` | 0 | 3,544 | 0% | 46.85 | 13 | 5 | 2 |
| `/medicare-broker-lakeland-fl/` | 0 | 12,962 | 0% | 56.24 | 2 | 3 | 1 |
| `/best-medicare-broker-lakeland-fl/` | 1 | 11,506 | <0.01% | 44.97 | 8 | 4 | 0 |
| `/blog/when-can-i-switch-medicare-plans-florida.html` | 1 | 136 | 0.74% | 18.84 | 1 | 1 | 0 |
| `/blog/health-insurance-self-employed-tax-deductions.html` | 0 | 1,144 | 0% | 83.05 | 0 | 0 | 0 |
| `/blog/self-employed-tax-deductions-ichra-guide.html` | 0 | 121 | 0% | 42.30 | 5 | 5 | 0 |
| `/blog/lost-job-health-insurance-lakeland.html` | 0 | 160 | 0% | 44.09 | 0 | 0 | 0 |
| `/plans/` | 1 | 1,270 | 0.08% | 66.00 | 47 | 23 | 2 |
| `/blog/florida-insurance-guide` | 1 | 71 | 1.41% | 23.59 | 0 | 0 | 0 |
| `/blog/florida-insurance-guide.html` | 0 | 637 | 0% | 41.14 | 0 | 0 | 0 |
| `/blog/florida-aca-enrollment-and-benefits-2026.html` | 0 | 234 | 0% | 53.33 | 0 | 0 | 0 |

`/self-employed-health-insurance/` and `/losing-coverage/` were not returned by their linked-report filters; that is not evidence of zero impressions or traffic. GA4's raw `generate_lead` values above are not delivery-validated and were not adjusted for internal, preview, localhost, or Tag Assistant activity. The apparent engaged-session/user anomalies are retained as report output rather than normalized by inference.

### GTM configuration readback

The authenticated web container is `GTM-W6MZ7XT6`. Workspace 16 had zero pending changes at the August 2 readback. Version 15, `GA4 generate_lead event parameters`, is live and was published July 27, 2026. The workspace reports container quality **Urgent** with two diagnostics; both were opened read-only and neither suggested change was added to the workspace.

- Custom event trigger `CE - Lead Form Submit` listens for event name `Lead` and fires both `GA4 Event - Generate Lead` and `Google Ads - Lead Form Conversion`.
- The GA4 tag emits `generate_lead` and reads non-identity data-layer variables including lead priority, coverage status, timing, normalized intent, line of business, content name, step, and page type.
- The live consent initialization tag defaults `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`, functionality, personalization, and security storage to `granted`, with a 500 ms update window. No consent update or CMP was verified.
- Because both Google conversion tags share the `Lead` trigger, the local site must emit exactly one delivery-gated `Lead` event and must not also fire direct GA4 or Google Ads lead conversions.
- The first diagnostic proposes modifying the Conversion Linker for additional detected domains. The interface did not identify the domains in the read-only summary, so the proposal was not accepted. Domain ownership and business purpose must be verified before any cross-domain configuration change.
- The second diagnostic recommends adding another active administrator to reduce account-lockout risk. This is an external access-control decision and was not changed.

### GA4 configuration readback

The authenticated GA4 property is `lakelandhealthinsurance.com` (`p492431963`). The August 2 readback confirmed:

- The `Internal Traffic` data filter is configured to **Exclude** and is **Active**.
- `generate_lead`, `messenger_click`, and `phone_call_click` are configured as key events for the Main Website stream and were present among events received in the last 28 days.
- `schedule_appointment`, `form_start`, `form_submit`, and the Google Ads-generated events were also present among recent events, but were not reclassified or edited.
- The Home report's last-30-day card showed 231 new users, 232 active users, 2.2K events, and 55 seconds average engagement time per session. These aggregate interface values are observational and are not delivery-validated lead counts.

### Unavailable external evidence

| Source | Current result | Required next readback |
|---|---|---|
| Search Console | Direct property and Links reports plus linked landing-page aggregates were read; no person-level query export was created | Optional country/device/date export only if required for a final redirect decision |
| Backlink index | Search Console reports zero external links; no third-party backlink provider was connected | Optional third-party confirmation; not required to establish that Search Console reports no known external link equity |
| GA4 | Authenticated linked landing-page rows and raw `generate_lead` counts were read; the active internal-traffic exclusion and recent key-event receipt were verified; delivery reconciliation remains unavailable | Landing path, sessions, engaged sessions, validated conversions, and source/medium after excluding QA, localhost, preview, and Tag Assistant traffic |
| CRM/system of record | Not applicable to this package by owner direction; no CRM surface or consumer record was opened | None unless scope is explicitly changed later |
| Function observability | Aggregate success/error counts were not exposed by the safe read-only connector | Daily `/api/lead` invocation count, Forms-forward success, 4xx/5xx count, and form version; no request body, IP, user agent, or identity |
| GTM/Google Ads | Trigger, GA4 lead tag, Ads lead tag, consent default, live version, and both container diagnostics were read; no workspace change was created | Verify detected domains before any Conversion Linker change; separately decide whether to add a second administrator; reconcile Ads outcomes and consent updates without publishing unreviewed changes |

## Measurement integrity findings

### Resolved P0 — legacy indexable form emitted `generate_lead` before delivery

At the original readback, `/get-help/index-v2.html` was publicly reachable with HTTP 200, declared `index, follow`, canonicalized to `/get-help/`, and called `gtag('event', 'generate_lead', ...)` during client-side submission handling without a verified delivery gate. That path could contaminate the canonical GA4 lead event when reached or tested.

Production status: the direct `generate_lead` call was removed. The legacy surface now emits only after a successful Forms response. Any redirect, retirement, or indexing change remains separately gated by URL evidence.

### Resolved P0 — duplicate canonical lead architecture

The primary funnel correctly reaches its conversion boundary only after `/api/lead` returns success, and `/api/lead` returns 200 only when the Netlify Forms forward succeeds. Before this repair, the same successful delivery could activate the GTM `Lead` trigger, a direct Google Ads conversion, and a thank-you-page `generate_lead`. The GTM readback confirmed that the `Lead` trigger itself already owns both GA4 `generate_lead` and Google Ads conversion tags.

Production status: the primary funnel emits one top-level, non-identifying `Lead` data-layer event after successful delivery, GTM owns both Google conversions, the server event ID is retained for reconciliation, and the thank-you page is presentation-only.

### P1 — consent defaults granted without a verified update path

The production analytics loader starts GTM, GA4, and Google Ads after first interaction, browser idle time, or a 2.5-second fallback. The authenticated GTM container has a Consent Initialization custom HTML tag that defaults all advertising and analytics consent signals to `granted`. No repository consent update, GTM update tag, or consent-management platform was verified.

Owner decision: retain the current US-visitor default-granted posture. This decision does not authorize expanding tracking outside the United States or collecting identity, health, policy, provider, prescription, income, or free-text data in analytics. Document the posture in the privacy notice and revisit it if targeting, jurisdiction, vendor behavior, or applicable law changes.

### Resolved P1 — persistent QA override could contaminate reporting

Production status: the QA override uses tab-scoped session storage, supports explicit clearing with `?analytics_test=0`, and marks GA4 debug mode. The GA4 internal-traffic exclusion is active. Preview, localhost, and Tag Assistant exclusion still requires operational discipline and periodic aggregate reconciliation.

### P1 — attribution cookies start without an observed consent gate

`js/funnel.js` creates `lhi_sid` for 365 days and `lhi_attr` for 90 days. The latter can store UTM parameters plus `fbclid` and `gclid`. Both are JavaScript-readable, first-party, `SameSite=Lax` cookies without an explicit `Secure` attribute, and they are initialized during normal funnel boot without an observed consent state.

The lead function also reads `_fbp` and `_fbc` when present and may pass them to Meta Conversions API. Browser cookie state was not inspected, so actual third-party cookie creation or transmission is not claimed here.

Required remediation: classify each cookie by purpose, minimize lifetime, add secure attributes where technically applicable, gate nonessential attribution consistently with the approved consent design, and document deletion/withdrawal behavior.

### P1 — aggregate delivery reconciliation is not currently reproducible

The lead function returns component results (`forms`, `capi`, `ads_capi`, and `mailchimp`) to the browser, but the safe aggregate connector exposes only retained Forms counts. There is no PHI-free daily delivery/error ledger available in this audit. Forms counts, GA4 events, advertising conversions, Mailchimp state, and CRM state therefore cannot yet be reconciled.

Required remediation: emit a bounded structured operational metric containing only date bucket, form/version, HTTP outcome, component outcome, and synthetic/production flag. Never log form payloads, contact data, ZIP, provider, prescription, policy, income, IP, user agent, or free text.

## URL cluster decisions

| Cluster | Current evidence | Decision |
|---|---|---|
| Medicare | All three core pages have material impressions; `/medicare/` has the best repository support and two raw leads, while the two broker pages retain distinct framing and over 11,000 impressions each; Search Console reports zero property external links | Preserve all URLs until QA-excluded conversions and delivery evidence are compared; backlink equity is no longer a blocker |
| Self-employed | Two tax articles were returned with different search/engagement patterns; the canonical guide was not returned, and older articles have materially deeper internal support | Preserve all URLs; improve measurement and internal architecture before considering consolidation |
| Job loss / SEP | The dated local guide had 160 impressions; `/losing-coverage/` was not returned, while dated and Local Answers pages retain separate timing/local framing | Preserve all URLs; distinguish evergreen task ownership from dated updates after full evidence readback |
| Florida guide | `/plans/` has broad navigation authority and two raw leads; Search Console reports both extensionless and `.html` variants of the Florida guide, showing path fragmentation | Preserve content roles; validate canonical/redirect handling and QA-excluded conversions before any consolidation |

## Release gate for a future redirect package

For each proposed URL action, record:

1. The 16-month comparison window and exact source export date.
2. Page-level Search Console clicks, impressions, CTR, and average position.
3. Search Console external-link evidence and, when material, optional third-party referring-domain evidence.
4. GA4 sessions, engaged sessions, and validated conversions after QA/internal exclusions.
5. Aggregate delivery outcomes without consumer data; CRM is optional unless explicitly restored to scope.
6. Distinct visitor task and content that would be lost.
7. Proposed destination, redirect type, internal links to update, sitemap change, rollback target, and validation result.

A lack of traffic alone is not sufficient. A URL with a distinct visitor task or meaningful backlink value may remain independent even when traffic is low.

## Next controlled package

Complete the remaining measurement evidence before making redirects:

1. Keep the single delivery-gated `Lead` path under regression coverage.
2. Preserve session-bounded QA/debug behavior and the active internal-traffic exclusion.
3. Retain the owner-selected US default-granted consent posture unless legal, jurisdictional, targeting, or vendor changes require revision.
4. Expose the existing PHI-free delivery ledger through a safe aggregate readback.
5. Use one separately approved production reconciliation test only if aggregate evidence cannot establish delivery parity.
6. Re-run GA4, GTM, Ads, Netlify, and receiving-system reconciliation before publishing a redirect plan.

## Production repair status

The following reversible repairs are present in current production commit `4d3aa00c8caf4bfc6ffa2a3a21a3092953630d39`:

- `/get-help/index-v2.html` now emits its lead event only after a successful Forms response and never calls `generate_lead` directly.
- `js/funnel.js` now emits one top-level `Lead` data-layer event at the successful `/api/lead` boundary using the server event ID; the verified GTM trigger owns the single GA4 and Google Ads conversions.
- `thanks.html` consumes the completion marker for receipt presentation only and does not emit GA4 or Ads lead events.
- The analytics QA override uses tab-scoped session storage, supports `?analytics_test=0` clearing, and marks GA4 debug mode.
- First-party attribution cookies add `Secure` on HTTPS.
- The lead function writes a PHI-free `lead_delivery_outcome_v1` operational record and no longer includes Mailchimp response bodies in returned/logged errors.
- All analytics-loader references use cache version `20260731-measurement-integrity`.

These repairs do not by themselves supply downstream-delivery evidence. Direct Search Console evidence and its zero-external-link report are documented, the GA4 internal-traffic filter is active, recent key-event receipt is verified, CRM is out of scope, and the owner selected the US default-granted consent posture. URL consolidation remains blocked until the aggregate conversion and delivery evidence is reconciled.
