# Lakeland and Florida Authority Foundation Handoff

Prepared: July 30, 2026  
Branch: `codex/lakeland-florida-authority-foundation`  
State: local review candidate; nothing committed, pushed, deployed, published, or changed in an external account

## Executive summary

The local repository now has a Florida-first authority foundation centered on David Huff, Lakeland Health Insurance, Lakeland, Polk County, and Florida. The work normalizes the canonical entity graph, materially rebuilds the highest-value authority and conversion surfaces, removes unsupported national service-area claims, versions regulated ACA/Medicare facts, constrains the ACA estimator to its actual Lakeland assumption, and minimizes third-party measurement data.

The primary conversion path is now state-aware and channel-consent-aware. The Get Help form records explicit channel states, consent version, timestamp, page, and initial withdrawal state. The quote router confirms a Florida ZIP prefix before exposing a coverage path. Outside-Florida users receive only official federal destinations.

No new city-template program, national expansion, redirect migration, framework migration, or external-account mutation was introduced.

## Primary pages refreshed

- `/`
- `/about/`
- `/aca-health-insurance-lakeland-fl/`
- `/medicare/`
- `/self-employed-health-insurance/`
- `/losing-coverage/`
- `/provider-prescription-check/`
- `/aca-subsidy-estimator/`
- `/get-help/`
- `/plans/`
- `/quote/`
- `/contact/`
- `/privacy-policy.html`
- `/sms-policy.html`

No public URL was changed. No redirect was added. The existing Florida guide, Learning Center, blog, local-answer hub, broker pages, and city pages remain at their current URLs. Selected supporting pages received only service-area or privacy-safety normalization.

## Structured data and entity changes

- Canonical WebSite: `https://lakelandhealthinsurance.com/#website`
- Canonical agency: `https://lakelandhealthinsurance.com/#agency`
- Canonical person: `https://lakelandhealthinsurance.com/about/#david-huff`
- Homepage defines the WebSite and InsuranceAgency nodes.
- About defines Person and ProfilePage.
- Priority WebPage, Article, Service, ContactPage, and WebApplication nodes reference the canonical entities.
- Decorative FAQ schema was removed from the estimator; remaining priority FAQ questions are checked against visible content.
- `data/authority-entities.json` is the canonical identity registry.
- `data/regulated-claims.json` records source URL, access date, applicable year, state, product line, and review status.

## Compliance and claim changes

- Florida service scope replaces unsupported nationwide/national service language.
- Unverified address, office-hours, rating, review-count, carrier, price, provider, savings, and plan-availability assertions were removed from priority pages.
- 2027 federal-platform Marketplace Open Enrollment is November 1–December 15.
- Medicare Open Enrollment remains October 15–December 7.
- Contract-year 2027 Medicare Scope of Appointment language reflects removal of the former 48-hour waiting period and retains the documented appointment/call-recording requirements.
- Provider and prescription content requires the exact plan, plan ID, location, formulary, pharmacy, and plan year.
- Fixed-indemnity content remains clearly separated from comprehensive major-medical coverage.
- Broker compensation is described as generally carrier-paid with no separate broker fee, without implying product neutrality or availability.
- The estimator now states that its $450 age-21 Lakeland benchmark is an illustration, not a live SLCSP quote.

## Conversion and privacy changes

- `/quote/` keeps the ZIP in-browser, checks Florida prefixes 320–349, and provides official HealthCare.gov/Medicare.gov fallback outside Florida.
- `/get-help/` separately records request, call, SMS, service email, and marketing email authorization.
- Consent evidence includes text version, timestamp, page, explicit per-channel state, and `not_withdrawn_at_submission`.
- Preferred contact must match an authorized channel and a corresponding phone number or email.
- Sales leads enter Mailchimp only when separate marketing-email authorization is present; new subscriptions remain pending confirmation.
- Google enhanced-conversion user data is disabled.
- Client tracking strips identity, contact, ZIP, income, health status, coverage status, timing, provider, prescription, intent, line of business, lead priority, and free text.
- Server ad events omit contact identity, ZIP, IP address, user agent, intent, line of business, and lead priority.
- Estimator inputs remain in-browser and are not placed in the Get Help URL, an embedded lead form, or analytics.
- Analytics/thank-you behavior is not represented as delivery proof.

## Information architecture and links

- Home → ACA, Medicare, Plans, Learning, About, and Get Help.
- ACA and Medicare pages own their respective service intent.
- Self-employed, loss-of-coverage, and provider/Rx pages own their specific decision intent.
- Plans is a coverage-path hub.
- Quote is a geography/product router.
- Get Help is the canonical first-party intake.
- Blog remains chronological; Learning remains evergreen.
- Internal links on all priority pages are locally resolved by `scripts/validate-authority.mjs`.
- Sitemap last-modified dates were updated for material changes and `/sms-policy.html` was added.

## Performance and accessibility

Mobile Lighthouse, local HTTP server:

| Page | Metric | Before | After |
|---|---|---:|---:|
| Home | Performance | 91 | 91 |
| Home | Accessibility | 96 | 100 |
| Home | LCP | 3.5 s | 3.5 s |
| ACA | Performance | 98 | 98 |
| ACA | Accessibility | 88 | 100 |
| ACA | LCP | 2.1 s | 2.0 s |
| Medicare | Performance | 97 | 98 |
| Medicare | Accessibility | 96 | 100 |
| Medicare | LCP | 2.5 s | 1.8 s |
| Get Help | Performance | 98 | 98 |
| Get Help | Accessibility | 96 | 100 |
| Get Help | LCP | 2.3 s | 2.1 s |

Best Practices and SEO scored 100 on all four before and after. Final CLS was 0 on Home, 0.069 on ACA, 0.069 on Medicare, and 0.066 on Get Help.

Playwright desktop and mobile checks covered all 14 primary pages/tools. Each returned 200 locally, rendered one H1, had the expected canonical, produced no console/page errors, and had no horizontal overflow.

## Validation

Final commands:

```text
node scripts/validate-authority.mjs
node scripts/validate-pages.mjs
node --test tests/*.test.mjs
node --check js/analytics.js
node --check js/funnel.js
node --check js/get-help-intake.js
node --check js/quote-router.js
node --check netlify/functions/lead.js
node --check netlify/functions/lib/ads-capi.js
git diff --check
```

Final result:

- Authority validator: 14 priority pages passed.
- Static-site validator: 153 HTML files passed, including all JSON-LD blocks and 136 sitemap targets.
- Unit tests: 24 passed, 0 failed.
- JavaScript syntax checks: passed.
- `git diff --check`: passed.
- Prohibited national-service and deprecated identity-tracking scans: no implementation matches.

The repository has no framework build command; `scripts/validate-pages.mjs` is the existing static-site release gate.

The synthetic browser form test was intercepted locally. It did not call Netlify or create a real lead. The payload recorded request/call as granted, SMS/service-email/marketing-email as not granted, version `get-help-2026-07-30-v1`, timestamp, page, and initial withdrawal state before redirecting locally to the thank-you page.

## Exact files changed

Core pages and shared presentation:

```text
about/index.html
aca-health-insurance-lakeland-fl/index.html
aca-subsidy-estimator/index.html
contact/index.html
css/answer-pages.css
css/site-template.css
get-help/index.html
index.html
losing-coverage/index.html
medicare/index.html
plans/index.html
privacy-policy.html
provider-prescription-check/index.html
quote/index.html
self-employed-health-insurance/index.html
sms-policy.html
```

Data, scripts, functions, and tests:

```text
data/authority-entities.json
data/regulated-claims.json
js/analytics.js
js/funnel.js
js/get-help-intake.js
js/quote-router.js
js/site-template.js
netlify/functions/lead.js
netlify/functions/lib/ads-capi.js
scripts/validate-authority.mjs
scripts/validate-pages.mjs
sitemap.xml
tests/funnel.test.mjs
```

Supporting pages normalized for unsupported service-area or dormant identity-tracking language:

```text
blog/3-things-changing-florida-health-insurance-may-2026.html
blog/5-critical-health-insurance-mistakes.html
blog/aca-2026-subsidy-expiration-florida-impact.html
blog/aca-open-enrollment-deadline.html
blog/aca-subsidy-cliff.html
blog/aca-subsidy-tax-return-clawback.html
blog/aca-vs-short-term-plans.html
blog/cigna-exiting-aca-marketplace-polk-county-2026.html
blog/dental-insurance-guide.html
blog/fixed-indemnity-analysis.html
blog/florida-aca-premiums-up-31-percent-2026.html
blog/florida-insurance-guide.html
blog/how-to-read-insurance-card.html
blog/index.html
blog/lost-job-health-insurance-lakeland.html
blog/medicaid-work-requirements-florida-coverage-2026.html
blog/mental-health-awareness-month-therapy-benefit-lakeland-2026.html
blog/no-your-agent-doesnt-hate-you.html
blog/non-income-based-health-insurance-florida.html
blog/real-cost-going-without-health-insurance.html
blog/short-term-medical-guide.html
chat.html
davenport-health-insurance/index.html
dental-vision/index.html
get-help/index-v2.html
haines-city-health-insurance/index.html
health-protector-guard/index.html
lake-alfred-health-insurance/index.html
learning/index.html
links/index.html
lp/aca/index.html
lp/gap/index.html
lp/medicare/index.html
newsletter/index.html
new-port-richey-health-insurance/index.html
our-approach.html
winter-haven-health-insurance/index.html
```

Documentation:

```text
docs/authority-foundation-audit-2026-07-30.md
docs/authority-foundation-handoff-2026-07-30.md
docs/local-authority-backlog-2026-07-30.md
```

The pre-existing untracked `docs/prompts/` directory was not modified and is not part of this handoff.

## Remaining blockers requiring evidence or approval

1. David/legal/compliance approval of Privacy Policy, SMS Terms, consent text, record retention, and the operational withdrawal workflow.
2. A CRM/system-of-record design that updates withdrawal status after submission; the website can record only the initial state.
3. Current authorized licensing/business-entity evidence before any service scope beyond Florida.
4. Current carrier appointment, certification, product, county/ZIP availability, premium, provider, and formulary evidence before public plan-specific claims.
5. Current Google Business Profile, review destination, and review totals before profile/rating claims or review outreach.
6. Search Console, backlink, and GA4 landing-page evidence before redirects or duplicate-page consolidation.
7. A sourced current Lakeland SLCSP benchmark before the estimator can become geography-accurate rather than illustrative.
8. Explicit approval for one controlled production lead test and access to verify Netlify, receiving inbox/system, CRM, and analytics separately.
9. Authenticated consent-mode, tag-manager, Google Ads, Meta, OpenAI Ads, cookie, and retention-setting audit. Local code is minimized, but external configuration was not verified.

## Deployment checklist

1. Review the branch diff and confirm the unrelated `docs/prompts/` files remain excluded.
2. Approve the entity registry, claim registry, page copy, sources, privacy/SMS terms, and consent version.
3. Decide whether the illustrative estimator remains published or receives a sourced current benchmark.
4. Run the complete validation command set.
5. Create a Netlify deploy preview; do not publish directly from this uncommitted state.
6. Re-run the 14-page desktop/mobile browser matrix on the preview URL.
7. Inspect network requests for form values in analytics/ad calls.
8. Confirm environment variables without printing secrets.
9. With explicit approval, submit one clearly synthetic controlled production test and verify Netlify/function response, receiving inbox/system, CRM, and analytics as separate checkpoints.
10. Confirm rollback owner and release timestamp, then obtain explicit deployment approval.

## Rollback plan

1. Before staging, save a patch of only the files in this handoff and preserve the unrelated untracked directory separately.
2. Deploy from a reviewed commit so Netlify can roll back to the immediately previous production deploy.
3. If consent, form, navigation, tracking, or regulated-copy behavior regresses, restore the previous Netlify deploy first.
4. Revert the reviewed task commit; do not use a workspace-wide hard reset.
5. Re-run the static validator and smoke-test the previous production version.
6. Record the failed check, affected URL/pathway, rollback time, and whether any controlled test data requires cleanup.

## Post-deployment verification

1. Cache-bust and confirm all 14 primary URLs, title, canonical, robots state, H1, source/review block, and schema.
2. Confirm sitemap URL and last-modified entries and no sitemap/noindex conflict.
3. Test Florida and outside-Florida router outcomes without opening an unsupported enrollment path.
4. Test invalid/mismatched consent locally or in preview without submission.
5. With explicit approval, perform one controlled end-to-end production submission and reconcile browser, Netlify/function, receiving system, CRM, and analytics separately.
6. Confirm no identity, ZIP, income, provider, prescription, health status, policy detail, or free text appears in analytics/ad requests.
7. Verify phone and booking links independently.
8. Run production Lighthouse on Home, ACA, Medicare, and Get Help.
9. Inspect Search Console URL status after recrawl; do not infer indexing from sitemap submission.
10. Monitor errors and lead counts without treating analytics events as delivery proof.

## Recommended next Florida authority work

1. Source and publish/refresh the pre-65 retirement, Florida Medicaid-loss, projected-income, turning-65-while-working, and interstate Medicare-move guides.
2. Convert the existing Florida guide into the canonical state hub after resolving its intent against the ACA, Medicare, and Plans pages.
3. Implement a source-freshness monitor backed by `data/regulated-claims.json`.
4. Complete Search Console/backlink-led consolidation of duplicate Medicare, self-employed, and job-loss URLs.
5. Implement CRM withdrawal-state handling and audited neutral review requests.
6. Build only evidence-backed Lakeland/Polk partnerships and local guides described in `docs/local-authority-backlog-2026-07-30.md`.

Nothing was committed, pushed, deployed, published, sent, submitted to production, or changed in Google Business Profile, analytics, advertising, CRM, carrier, Marketplace, or other external accounts.
