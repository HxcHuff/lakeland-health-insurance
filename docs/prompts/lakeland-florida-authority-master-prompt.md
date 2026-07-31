# Lakeland and Florida Authority Master Prompt

You are working on the Lakeland Health Insurance website repository.

Primary repository:
`/Users/david_huff/lakeland-health-insurance`

Authoritative blueprint:
`/Users/david_huff/Documents/Codex/2026-07-30/referenced-chatgpt-conversation-this-is-untrusted/outputs/Lakeland-Health-Insurance-National-Scale-Blueprint-2026-07-30.md`

## Objective

Complete and tighten Lakeland Health Insurance’s Lakeland, Polk County, and Florida authority foundation before expanding nationally.

The result must establish David Huff and Lakeland Health Insurance as a credible, technically consistent, locally authoritative independent health-insurance resource—not an engineered SEO content farm.

Complete the authorized work locally. Do not commit, push, deploy, publish, modify Google Business Profile, modify analytics accounts, send messages, submit real leads, or change any external account without explicit approval.

The target is production readiness by October 10, 2026, before Medicare Open Enrollment begins October 15 and Marketplace Open Enrollment begins November 1.

## Operating rules

1. Inspect the repository, current branch, working tree, `AGENTS.md` files, site architecture, existing validation scripts, and current local changes before editing.
2. Preserve all unrelated user changes.
3. Audit the current production site where necessary, but treat production as read-only.
4. Prefer strengthening existing authoritative pages over creating duplicate pages.
5. Do not create templated city pages or swap location names into duplicate copy.
6. Do not make unsupported claims about rankings, savings, premiums, plan availability, provider participation, carrier appointments, service areas, review counts, or being the “best,” “largest,” or “top” broker.
7. Use current primary sources for regulated facts:
   - CMS
   - Medicare.gov
   - HealthCare.gov
   - Florida Department of Financial Services
   - Florida Office of Insurance Regulation
   - NIPR
   - IRS, when tax or subsidy methodology requires it
8. Record source URL, access date, applicable year, state, product line, and review status for time-sensitive claims.
9. Do not expose names, phone numbers, email addresses, dates of birth, prescriptions, providers, medical details, Medicare identifiers, policy details, income, or free-text form content to analytics, advertising platforms, logs, URLs, or test artifacts.
10. Do not infer SMS consent from call or email consent.
11. Do not use real consumer data or create a real lead while testing.
12. Do not alter established analytics, forms, phone, booking, advertising, or enrollment pathways unless required by this scope. Regression-test every affected pathway.
13. If licensing, appointment, certification, product, or compliance evidence is missing, use qualified language or pause the affected claim. Do not invent evidence.
14. Keep the existing premium navy/gold/blue visual identity and established site shell unless a change is necessary for accessibility, mobile performance, or conversion clarity.
15. Work continuously through the authorized local scope. Stop only when a missing business decision or regulated evidence would materially change the public result.

## Phase 1 — Establish the current baseline

Before editing:

1. Inventory all pages related to:
   - Homepage
   - David Huff/About
   - Lakeland
   - Polk County
   - Florida
   - ACA Marketplace
   - Medicare
   - Self-employed coverage
   - Special Enrollment Periods
   - COBRA and loss of coverage
   - Provider and prescription verification
   - Plans and products
   - Get Help
   - Quote/enrollment routing
   - Contact
   - Privacy, consent, disclosures, and accessibility
2. Map each page to one disposition:
   - Keep
   - Tighten
   - Expand
   - Consolidate
   - Redirect
   - Retire
3. Identify:
   - Competing or duplicate search intent
   - Thin local pages
   - Unsupported promotional claims
   - Stale plan-year language
   - Inconsistent names, credentials, service areas, phone, email, or business descriptions
   - Missing or inconsistent structured-data entities
   - Weak internal linking
   - Overlong titles and descriptions
   - FAQ content/schema mismatches
   - Accessibility and performance problems
   - Conversion dead ends
4. Establish the current test baseline before changing files.
5. Save a concise audit and page-disposition map under the repository’s documentation or working-output area.

Do not stop after the audit. Continue into implementation unless a required regulated fact is unavailable.

## Phase 2 — Normalize the authority entity

Create one canonical entity model for:

David Huff:

- Full name: David Huff
- Role: Licensed health insurance agent/broker
- Florida license: W371813
- NPN: 18213932
- Primary market: Lakeland, Polk County, and Florida
- Phone: 863-640-3102
- Email: dhuff@healthmarkets.com

Lakeland Health Insurance:

- Consistent business name
- Canonical URL
- Real Lakeland contact information
- Accurate service-area description
- Accurate relationship to David Huff
- Accurate broker/compensation disclosure
- No implication that Lakeland Health Insurance is an insurance carrier

Implement stable JSON-LD `@id` values for the person, agency, and website. Connect relevant pages through appropriate types such as:

- `Person`
- `ProfilePage`
- `InsuranceAgency` or the best supported `LocalBusiness` subtype
- `WebSite`
- `WebPage`
- `Service`
- `Article` or `BlogPosting`
- `BreadcrumbList`
- `FAQPage` only where corresponding FAQs are visible

Requirements:

1. Use David as author and licensed reviewer where factually correct.
2. Connect articles, services, the About page, and the agency through stable entity references.
3. Use accurate `areaServed` values for Lakeland, Polk County, Central Florida, and Florida.
4. Do not claim a physical office, service area, credential, award, review total, or affiliation without current evidence.
5. Keep visible page content aligned with structured data.
6. Add “last reviewed” and source information to priority regulated pages without making the design look clinical or cluttered.

## Phase 3 — Tighten the core authority pages

Prioritize improving these existing surfaces:

1. Homepage
2. About David Huff
3. Florida health-insurance authority page or hub
4. Lakeland/Polk County service page
5. ACA Marketplace page
6. Medicare page
7. Self-employed coverage page
8. SEP/loss-of-coverage page
9. Provider and prescription verification page
10. Get Help
11. Plans/products
12. Quote or enrollment-routing hub
13. Contact
14. Privacy, consent, and disclosure pages

For each priority page:

- State the visitor’s problem and direct answer near the top.
- Make Lakeland/Florida applicability clear.
- Present one primary conversion action.
- Include David’s authority naturally, without repetitive credential stuffing.
- Link to the appropriate service pillar, local page, supporting guide, tool, and Get Help path.
- Include applicable year, state, sources, disclosures, and review date.
- Remove filler, repeated promotional sections, and directory-style overload.
- Preserve useful existing rankings and URLs wherever possible.
- Do not change an established URL without a redirect plan and evidence that consolidation is justified.

Homepage requirements:

- Preserve a strong above-the-fold phone and Get Help path.
- Make “Lakeland-based, serving Florida” immediately clear.
- Reduce excessive directory and topic density.
- Foreground Medicare during the Medicare enrollment season without erasing ACA access.
- Use real enrollment dates and informative urgency—not gimmicky countdown pressure.
- Retain only the strongest proof elements.
- Move secondary education deeper into the Learning Center.

About-page requirements:

- Create the strongest canonical public profile of David.
- Explain independence and broker compensation accurately.
- Explain how assistance works.
- Include credentials and verification instructions.
- Distinguish educational assistance, plan comparison, quoting, enrollment, and ongoing service.
- Include privacy-safe contact options.
- Avoid self-congratulatory or “best broker” language.

Florida authority requirements:

- Explain Florida Marketplace and Medicare help without implying every product is available everywhere.
- Distinguish statewide remote service from Lakeland/Polk local expertise.
- Include county, rating-area, network, formulary, carrier, and plan-year limitations where relevant.
- Route visitors through ZIP/state validation before plan or enrollment destinations.
- Do not publish a statewide provider, carrier, premium, or plan claim without current source evidence.

## Phase 4 — Information architecture and internal links

Create a clear authority hierarchy:

- Home
  - Health Insurance
    - ACA Marketplace
    - Medicare
    - Self-Employed
    - Life Events and SEP
    - Supplemental/Ancillary products
  - Florida
    - Lakeland
    - Polk County
    - Florida statewide assistance
    - Differentiated local guides
  - Tools
    - ACA estimator with verified geographic scope
    - Provider/prescription verification workflow
    - Coverage-path or Get Help router
  - Learning Center
  - About David
  - Get Help

Requirements:

1. Separate chronological/news content from evergreen Learning Center content.
2. Build contextual internal links rather than large repeated link blocks.
3. Establish one canonical page for each major intent.
4. Consolidate pages only when intent materially overlaps.
5. Create city or county pages only when they contain original local evidence such as:
   - Health systems or facilities
   - County plan/network issues
   - Local organizations or referral relationships
   - Search Console demand
   - Local enrollment assistance details
   - Original local data
6. Preserve Lakeland as the strongest local node.

## Phase 5 — Lakeland and Florida content clusters

Create or materially refresh the minimum content needed to close authority gaps. Prioritize quality over count.

Priority guides:

1. Health insurance when retiring before 65 in Florida
2. COBRA versus Marketplace coverage after job loss in Florida
3. ACA coverage after losing Florida Medicaid
4. Correcting projected Marketplace income during the year
5. Self-employed Marketplace income documentation
6. Turning 65 while still working
7. Medicare provider and prescription review checklist
8. Moving into or out of Florida with Medicare coverage
9. How to verify a Florida provider using the exact plan name, plan ID, location, and plan year
10. Florida Marketplace and Medicare enrollment pathways explained

Before creating any page, confirm it does not duplicate an existing URL. Prefer a substantial refresh when the page already exists.

Every guide must include:

- A direct answer within the first 100 words
- Florida and plan-year applicability
- Named author and reviewer
- Primary sources
- Source access date and reviewed date
- A decision framework or checklist
- Material limitations
- No eligibility, subsidy, network, savings, or plan-fit guarantee
- Contextual internal links
- One clear next action
- Appropriate disclosures
- No fake quotations, testimonials, statistics, or local examples

## Phase 6 — Local SEO and trust

Complete the on-site portion of local authority:

1. Normalize business name, phone, email, credentials, and service-area language.
2. Strengthen Lakeland and Polk County references where they are genuinely relevant.
3. Add accurate Organization/Person/LocalBusiness relationships.
4. Verify the site’s links to legitimate review and business profiles.
5. Build a review-request workflow specification, but do not contact clients.
6. Create a Florida/Lakeland partnership and backlink backlog for:
   - Chamber and business organizations
   - CPAs and payroll firms
   - HR consultants
   - Independent pharmacies
   - Provider practices
   - Nonprofits
   - Senior and caregiver organizations
   - Local media and community education
7. Audit Google Business Profile consistency read-only if access exists. Do not modify it.
8. Do not create additional Google Business Profiles or virtual locations.
9. Produce a prioritized external-authority backlog with evidence requirements and a suggested outreach asset—not fabricated relationships.

## Phase 7 — Conversion and compliance

Tighten the Florida conversion path:

1. Confirm state/ZIP before sending visitors to external quote or enrollment destinations.
2. Provide a safe unsupported-state or unsupported-product fallback.
3. Separate consent for:
   - Requested contact
   - Telephone calls
   - SMS
   - Email
   - Ongoing marketing
4. Record consent text version, channel, timestamp, page/form, and withdrawal state.
5. Keep optional health, provider, prescription, policy, and free-text context out of analytics and advertising.
6. Do not represent a GA4 event or thank-you page as proof that a lead was delivered.
7. Preserve and test phone, booking, form, quote, and enrollment pathways.
8. Reconcile successful controlled tests across:
   - Browser/form response
   - Netlify form or function
   - Receiving inbox/system
   - CRM, where safely available
   - Analytics event
9. Do not submit a real production lead without explicit approval.
10. Keep ACA estimator language educational and include the required subsidy/tax-reconciliation limitations.
11. If the estimator’s benchmark data is Lakeland-specific, visibly constrain it to that verified geography until a sourced Florida rating-area implementation exists.
12. Version Medicare content by contract year and verify current CMS rules before changing SOA, permission-to-contact, call-recording, TPMO, or enrollment language.
13. Use the required fixed-indemnity disclosure wherever applicable.
14. Do not infer suitability from compensation, appointment status, or product availability.

## Phase 8 — Technical authority and user experience

Correct issues that weaken trust or discoverability:

1. Improve mobile hero/LCP performance without damaging design.
2. Correct flagged color-contrast issues.
3. Keep one clear H1 per page.
4. Tighten titles and descriptions where truncation obscures intent.
5. Validate canonical URLs.
6. Remove accidental sitemap/noindex conflicts.
7. Verify redirects and internal links.
8. Ensure visible FAQs exactly support FAQ structured data.
9. Remove duplicate or decorative FAQ schema.
10. Validate structured data.
11. Preserve accessible labels, keyboard navigation, focus behavior, and reduced-motion support.
12. Reduce unnecessary third-party runtime weight.
13. Tighten security headers only where compatibility has been tested.
14. Do not perform a framework migration.
15. Do not redesign the entire site.

## Phase 9 — Validation

Run all relevant existing repository tests. At minimum:

1. Run `node scripts/validate-pages.mjs` if present.
2. Parse every edited JSON-LD block.
3. Run `git diff --check`.
4. Validate:
   - Sitemap targets
   - Canonicals
   - Robots/noindex status
   - Redirects
   - Internal links
   - Required disclosures
   - Visible FAQ/schema parity
   - Entity `@id` consistency
   - State/year/source metadata
   - Prohibited claims
   - Analytics and consent safety
5. Perform desktop and mobile browser checks of every materially changed template.
6. Run accessibility checks on priority pages.
7. Run mobile performance testing on the homepage and primary ACA/Medicare/Get Help paths.
8. Verify that no secret, client information, test identity, or protected data entered the repository.
9. Distinguish pre-existing failures from regressions introduced by this work.
10. Re-run the full validation suite after final corrections.

Do not claim lead delivery, analytics collection, external-account configuration, or production behavior unless it was directly verified.

## Final handoff

When all authorized local work is complete, provide:

1. Executive summary of authority improvements.
2. Exact files changed.
3. Pages created, refreshed, consolidated, redirected, or intentionally left unchanged.
4. Structured-data/entity changes.
5. Compliance and claim changes.
6. Internal-link and information-architecture changes.
7. Performance and accessibility results before and after.
8. Validation commands and results.
9. Remaining blockers requiring David’s evidence or approval.
10. Deployment checklist.
11. Rollback plan.
12. Post-deployment verification checklist.
13. Recommended next Florida authority work, ranked by impact.
14. Explicit statement that nothing was committed, pushed, deployed, published, or changed in external accounts.

## Success criteria

The work is complete only when:

- David and Lakeland Health Insurance have one consistent canonical entity graph.
- Lakeland, Polk County, and Florida positioning is clear and factually supported.
- Core authority pages have distinct purposes and strong next actions.
- Existing high-value pages are improved before new pages are added.
- No unsupported marketing, plan, carrier, provider, savings, ranking, or service-area claims remain on priority pages.
- ACA and Medicare regulated content has current primary sources and review dates.
- The Florida conversion path is state-aware, consent-safe, privacy-safe, and testable.
- Priority pages pass crawl, schema, internal-link, accessibility, mobile, and compliance checks.
- No national templated expansion was introduced.
- The repository is ready for David’s review before any deployment.
