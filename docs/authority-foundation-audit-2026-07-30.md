# Lakeland and Florida Authority Foundation Audit

Audit date: July 30, 2026  
Scope: local repository and read-only production review  
Release state: local working tree only; no commit, push, deploy, publication, lead submission, or external-account change

## Baseline

- The repository is a static Netlify site, not a Next.js application. It has no `package.json` or framework build command.
- `scripts/validate-pages.mjs` covered 153 HTML files and passed before editing.
- The Node test suite passed 28 tests before editing. The final suite was intentionally reduced where dormant enhanced-conversion hashing tests were removed and expanded with privacy/consent contracts.
- The sitemap contained 135 URLs before this work. One indexable SMS policy URL was missing.
- Production was used only to compare current public claims and layout. Authenticated Google Business Profile, analytics, CRM, inbox, carrier, and enrollment systems were not changed or treated as evidence.
- Pre-change mobile Lighthouse results:

| Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| Home | 91 | 96 | 100 | 100 | 3.5 s | 0 |
| ACA | 98 | 88 | 100 | 100 | 2.1 s | 0.066 |
| Medicare | 97 | 96 | 100 | 100 | 2.5 s | 0 |
| Get Help | 98 | 96 | 100 | 100 | 2.3 s | 0 |

Baseline accessibility failures were low-contrast text on the shared license line and home hero, plus an undersized floating target on the prior ACA page.

## Page disposition map

| Surface | Canonical URL | Disposition | Local implementation |
|---|---|---|---|
| Homepage | `/` | Tighten | Florida-first hero, reduced unsupported proof, primary phone/Get Help actions, 2027 dates, stable entity graph |
| David Huff profile | `/about/` | Expand | Canonical Person/ProfilePage, verification instructions, qualified independence and compensation language |
| Florida authority | `/blog/florida-insurance-guide.html` | Keep | Existing URL retained; unsupported nationwide footer language removed; full state-hub redesign deferred |
| Lakeland/Polk service authority | `/aca-health-insurance-lakeland-fl/`, `/medicare/` | Expand | Distinct ACA and Medicare service intent, local limitations, primary sources, reviewed dates |
| ACA Marketplace | `/aca-health-insurance-lakeland-fl/` | Expand | 2027 federal-platform dates, eligibility workflow, income/network limitations, direct action |
| Medicare | `/medicare/` | Expand | 2027 contract-year framing, AEP, plan/provider/Rx checklist, current SOA and call-recording language |
| Self-employed | `/self-employed-health-insurance/` | Expand | Canonical Florida guide with tax-professional boundary and projected-income framework |
| SEP, COBRA, loss of coverage | `/losing-coverage/` | Expand | Consolidated decision framework including job loss, COBRA, Medicaid/CHIP transition, documents, timing |
| Provider/prescription verification | `/provider-prescription-check/` | Expand | Exact-plan, plan-ID, location, formulary, pharmacy, year, and verification-state workflow |
| ACA estimator | `/aca-subsidy-estimator/` | Tighten | Fixed Lakeland benchmark scope, no arbitrary ZIP claim, no estimate values in URLs/analytics, embedded lead form removed |
| Plans/products | `/plans/` | Consolidate | Rebuilt as a coverage-path hub; unsupported prices, carrier claims, and Offer markup removed |
| Get Help | `/get-help/` | Tighten | Separate request/call/SMS/service-email/marketing-email consent and versioned evidence |
| Quote/enrollment router | `/quote/` | Consolidate | Florida ZIP prefix gate, official outside-Florida fallback, coverage-path routing |
| Contact | `/contact/` | Tighten | Florida-only business contact, no unverified office address or nationwide scope |
| Privacy | `/privacy-policy.html` | Tighten | Rewritten to match current first-party forms, processors, measurement minimization, consent, security, and retention boundaries |
| SMS terms | `/sms-policy.html` | Tighten | Separate SMS opt-in, STOP/HELP, no-sale/no-third-party-marketing language, variable retention boundary |
| Learning Center | `/learning/` | Keep | Evergreen role retained; unsupported service-area footer language removed |
| Blog | `/blog/` | Keep | Chronological role retained; Florida positioning normalized |
| Local Answers hub | `/local-health-insurance-answers/` | Retire from expansion | URL left unchanged pending Search Console and redirect evidence; do not add more engineered answer templates |
| Secondary city pages | Existing city URLs | Keep | No new city templates; unsupported national service-area claims removed from existing affected pages |
| Duplicate Medicare broker URLs | `/medicare-broker-lakeland-fl/`, `/best-medicare-broker-lakeland-fl/` | Consolidate later | No redirect without query, backlink, and Search Console evidence |
| Duplicate self-employed/local-answer URLs | Blog and Local Answers variants | Consolidate later | Canonical service guide strengthened first; supporting URLs retained pending evidence |
| Duplicate job-loss URLs | Existing blog variants | Keep as support | Canonical decision page owns transactional intent; blog URLs remain educational until performance evidence supports consolidation |
| Accessibility statement | None | Keep absent | No standalone page required for this release; accessibility implementation and testing are documented here |

No established URL was changed and no redirect was added.

## Findings and actions

### Entity and trust

- The site lacked a stable, connected Person/Agency/WebSite graph. Canonical IDs are now:
  - `https://lakelandhealthinsurance.com/#website`
  - `https://lakelandhealthinsurance.com/#agency`
  - `https://lakelandhealthinsurance.com/about/#david-huff`
- Unverified physical-address, office-hours, nationwide-service, rating-total, and review-count claims were removed from priority surfaces.
- Public Florida DFS, NIPR, and BBB profile links are presented as verification destinations, not as static award/rating claims.
- `data/authority-entities.json` is the canonical identity registry.

### Regulated facts and claims

- 2027 federal-platform Marketplace Open Enrollment is stated as November 1 through December 15.
- Medicare Open Enrollment is stated as October 15 through December 7.
- Medicare Scope of Appointment language is contract-year 2027 specific and no longer repeats the removed 48-hour waiting rule.
- Priority ACA/Medicare guides include visible sources, access date, applicable year, state/product context, reviewer, and review date.
- `data/regulated-claims.json` records source URL, access date, applicable year, state, product line, and review status for high-risk claims.
- Sitewide unsupported national service-area phrases covered by the new validator were removed. Product-network uses of “nationwide” were left only where they describe a plan concept, not David's service area.

### Conversion, privacy, and measurement

- The Florida router does not submit its ZIP and does not expose external plan/enrollment links until a five-digit Florida-prefix ZIP and coverage path are chosen.
- Outside-Florida routing goes only to HealthCare.gov and Medicare.gov.
- Get Help consent is separated by channel and records text version, page, timestamp, explicit channel state, and initial withdrawal state.
- The form blocks submission when the preferred channel lacks matching authorization or contact information.
- Sales leads are not added to marketing email unless the separate marketing-email checkbox is selected; new subscriptions use pending confirmation.
- Google enhanced-conversion user data was disabled. Client-side tracking no longer exposes identity helpers or form identity, ZIP, income, provider, prescription, health-status, timing, or free text.
- Server-side advertising events no longer include raw contact data, ZIP, IP address, user agent, line of business, intent, or lead priority. Only pseudonymous platform references and a generic lead event remain.
- The ACA estimator no longer creates a lead, places estimate values into a URL, or emits those values to analytics.
- A thank-you page or analytics event remains evidence of a browser event only, not proof of Netlify delivery, inbox receipt, or CRM creation.

### Accessibility and performance

- Shared license text and home trust text contrast were corrected.
- New authority templates include visible focus treatment, reduced-motion behavior, one H1, responsive border-box sizing, source-link wrapping, and no mobile horizontal overflow.
- The quote router result receives keyboard focus for valid, invalid, Florida, and outside-Florida outcomes.
- Desktop and mobile browser checks covered all 14 materially changed priority/tool pages with 200 responses, one H1, valid canonicals, no console errors, rendered footers, and no horizontal overflow.

## Duplicate intent and remaining consolidation evidence

Do not redirect or retire an existing indexed URL until these are reviewed:

1. Google Search Console queries, clicks, impressions, and selected canonical.
2. Backlinks and referring domains.
3. GA4 landing-page sessions and assisted conversions.
4. Current ranking/search-result intent.
5. Internal-link and sitemap dependencies.

Highest-overlap sets are Medicare (`/medicare/`, broker URLs, local-answer URL), self-employed (canonical guide, blog guides, local-answer URL), and job loss (canonical decision page plus two blog variants).

## Evidence not available

- Current authenticated Google Business Profile values and categories.
- Search Console/GA4 performance evidence for redirects or canonical consolidation.
- Current carrier appointments, county/ZIP product availability, plan pricing, provider participation, formularies, or review totals.
- A sourced current second-lowest-cost Silver benchmark for ZIP 33805. The estimator therefore remains explicitly illustrative.
- Business/legal approval of privacy, SMS, consent text, retention implementation, and withdrawal workflow.
- Controlled end-to-end production lead delivery across Netlify, receiving inbox/system, CRM, and analytics.
