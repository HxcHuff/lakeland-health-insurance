# Lakeland and Florida Authority Baseline

Baseline date: July 31, 2026
Repository: `/Users/david_huff/lakeland-health-insurance`
Starting branch/commit: `codex/auditandtighten` at `2035bb0`
Production review: read-only; no form submission or external-account mutation

## Evidence labels

- **Verified fact**: confirmed from a current primary source or direct repository readback.
- **Local observation**: present in the checked-out source; it is not a production claim.
- **Production observation**: returned by a read-only request to the public URL on July 31, 2026.
- **Assumption**: reasonable working interpretation that is not treated as public proof.
- **Missing evidence**: information that must not be claimed until a current source is available.

## Pre-change validation baseline

This work package began with the existing authority-foundation commit already checked out. The only working-tree item was the untracked controlling prompt at `docs/prompts/01-lakeland-florida-authority-foundation.md`; it was preserved.

| Check | Pre-change result |
|---|---|
| `node scripts/validate-pages.mjs` | Passed: 153 HTML files |
| `node scripts/validate-authority.mjs` | Passed: 14 priority pages plus entity, link, source, claim, FAQ, consent, and privacy checks |
| `node --test tests/*.test.mjs` | Passed: 24 tests, 0 failed |
| `git diff --check` | Passed |
| Branch convention | Existing review branch retained; no branch switch, commit, reset, stash, or discard operation |

## Verified identity and regulated facts

| Fact | Status | Primary evidence | Accessed | Boundary |
|---|---|---|---|---|
| David Huff; Florida license W371813; NPN 18213932 | Verified | [Florida DFS Licensee Search](https://licenseesearch.fldfs.com/) direct search and current license-detail readback | 2026-07-31 | The record lists the health-related license as valid. No carrier identity, product availability, or county availability is inferred. |
| NPN definition and public lookup | Verified | [NIPR NPN lookup](https://nipr.com/licensing-center/look-up-a-national-producer-number) | 2026-07-31 | NPN is an identifier, not proof of a particular appointment or product. |
| General broker role and compensation model | Verified as a general rule | [HealthCare.gov agent and broker glossary](https://www.healthcare.gov/glossary/agent/) | 2026-07-31 | Brokers may represent several companies and commonly receive carrier commissions; the source warns that a broker may not sell plans from companies the broker does not represent. |
| Federal-platform Marketplace OEP for plan year 2027 | Verified | [CMS 2025 Marketplace Integrity and Affordability Final Rule fact sheet](https://www.cms.gov/newsroom/fact-sheets/2025-marketplace-integrity-and-affordability-final-rule) | 2026-07-31 | November 1 through December 15 preceding plan year 2027 for Exchanges on the federal platform; future operational changes still require re-review. |
| Medicare Annual/Open Enrollment | Verified | [Medicare.gov Open Enrollment](https://www.medicare.gov/health-drug-plans/open-enrollment) | 2026-07-31 | October 15 through December 7; no plan availability is inferred. |

## Required surface inventory

All canonical URLs below returned HTTP 200 in the read-only production check. Titles, H1s, schema, CTAs, and link counts in this table describe the **pre-change local checkout** unless the production column says otherwise.

### Intent, title, H1, geography, product, and CTA

| Surface | Canonical URL | Primary intent | Geographic scope | Product scope | Local title | Local H1 | Primary CTA |
|---|---|---|---|---|---|---|---|
| Homepage | `https://lakelandhealthinsurance.com/` | Local authority and coverage-lane entry | Lakeland, Polk County, Florida | ACA, Medicare, supplemental, dental, vision, life, temporary coverage paths | Lakeland Health Insurance Broker \| ACA & Medicare Help | Health Insurance Doesn't Have to Be Complicated. | Talk to David → `/get-help/`; phone is also above the fold |
| About David | `https://lakelandhealthinsurance.com/about/` | Canonical broker profile and trust | Lakeland, Polk County, Florida | Education, comparison, quoting, enrollment support, service | David Huff \| Lakeland, FL Health Insurance Broker | Meet David “The Insurance Dude” Huff | Start a Plan Review → `/get-help/` |
| Local Answers hub | `https://lakelandhealthinsurance.com/local-health-insurance-answers/` | Direct-answer directory | Lakeland, Polk County | Mixed | Local Health Insurance Answers in Lakeland, FL \| Lakeland Health Insurance | Direct answers for local health insurance questions. | Start a plan review → `/get-help/?intent=local-answer-hub` |
| Lakeland broker answer | `https://lakelandhealthinsurance.com/local-health-insurance-answers/health-insurance-broker-lakeland-fl/` | Answer who provides local help | Lakeland | Mixed | Who Helps Compare Health Insurance in Lakeland, FL? \| Lakeland Health Insurance | Who helps compare health insurance in Lakeland, FL? | Start a plan review → `/get-help/?intent=local-broker-answer` |
| ACA Lakeland | `https://lakelandhealthinsurance.com/aca-health-insurance-lakeland-fl/` | ACA decision and enrollment help | Lakeland, Polk County, Florida | ACA Marketplace | ACA Health Insurance Help in Lakeland, FL \| 2027 Enrollment | Start with eligibility, projected income, network fit, and the enrollment window. | Start an ACA review → `/get-help/?intent=aca` |
| Medicare | `https://lakelandhealthinsurance.com/medicare/` | Canonical local Medicare review | Lakeland, Polk County | Medicare Advantage, Medigap, Part D | Medicare Help in Lakeland, FL \| 2027 Plan Review | Compare the exact 2027 plan around your care—not a mailer headline. | Start a Medicare review → `/get-help/?intent=medicare` |
| Medicare broker | `https://lakelandhealthinsurance.com/medicare-broker-lakeland-fl/` | Seasonal Medicare broker landing | Lakeland | Medicare | Medicare Broker Lakeland FL \| 2026 AEP Plan Review | Get your Lakeland Medicare plan reviewed before AEP gets busy. | Call David → `tel:+18636403102` |
| “Best” Medicare broker | `https://lakelandhealthinsurance.com/best-medicare-broker-lakeland-fl/` | Broker-selection framework | Lakeland | Medicare | Best Medicare Broker Lakeland FL? How to Choose One | The best Medicare broker in Lakeland is the one who checks the details that affect your care. | Call → `tel:+18636403102` |
| Self-employed | `https://lakelandhealthinsurance.com/self-employed-health-insurance/` | Projected-income coverage guide | Florida | ACA and alternatives | Self-Employed Health Insurance in Florida \| ACA Guide | Start with projected household income—not a business label. | Start a self-employed review → `/get-help/?intent=self-employed` |
| Losing coverage | `https://lakelandhealthinsurance.com/losing-coverage/` | COBRA/Marketplace decision after coverage loss | Florida | COBRA, ACA, SEP | COBRA vs Marketplace After Losing Coverage in Florida | Compare the deadline, effective date, network, and full cost before choosing COBRA or Marketplace coverage. | Start a coverage-loss review → `/get-help/?intent=lost-coverage` |
| Provider/Rx | `https://lakelandhealthinsurance.com/provider-prescription-check/` | Verification workflow | Florida | ACA and Medicare networks/formularies | Verify Florida Providers & Prescriptions by Plan ID and Year | Verify the exact provider, location, plan ID, and plan year. | Request a provider or Rx review → `/get-help/?intent=provider-check` |
| Get Help | `https://lakelandhealthinsurance.com/get-help/` | First-party structured intake | Florida | Mixed | Get Health Insurance Help in Lakeland, FL \| David Huff | Get the right insurance next step without a long intake. | Call David; staged form is the primary interaction |
| Plans | `https://lakelandhealthinsurance.com/plans/` | Coverage-path chooser | Florida | Mixed | Florida Health Insurance Paths \| ACA, Medicare & More | Choose a coverage-review path before comparing products. | Florida coverage router → `/quote/` |
| Quote | `https://lakelandhealthinsurance.com/quote/` | ZIP/product router | Florida with official fallback | ACA, Medicare, other assistance | Florida Health Insurance Quote & Enrollment Router | Confirm ZIP code and coverage type before leaving this site. | In-page router; no external destination before state/product choice |
| Contact | `https://lakelandhealthinsurance.com/contact/` | Privacy-safe contact options | Lakeland, Florida | Mixed | Contact David Huff \| Lakeland Health Insurance | Contact David Huff | Consent-controlled form → `/get-help/` |
| Privacy | `https://lakelandhealthinsurance.com/privacy-policy.html` | Data-use disclosure | Florida website users | All | Privacy Policy \| Lakeland Health Insurance | Privacy Policy | Contact details → `/contact/` |
| SMS terms | `https://lakelandhealthinsurance.com/sms-policy.html` | SMS consent and opt-out terms | Florida website users | All | SMS Terms \| Lakeland Health Insurance | SMS Terms | Get Help form → `/get-help/` |
| Our approach | `https://lakelandhealthinsurance.com/our-approach.html` | Review methodology | Lakeland, Florida | Mixed | Our Approach: How We Fix Broken Health Insurance \| Lakeland Health Insurance | How We Fix Broken Health Insurance | Talk to David → `/get-help/` |
| Learning Center | `https://lakelandhealthinsurance.com/learning/` | Evergreen education and tools | Mixed; primarily Florida | Mixed | Your Health Insurance Learning Hub \| Lakeland Health Insurance | Your Health Insurance Learning Hub | Talk to David → `/get-help/` |
| Blog index | `https://lakelandhealthinsurance.com/blog/` | Chronological updates and article discovery | Mixed; Florida emphasis | Mixed | Florida Health Insurance Blog \| ACA & Medicare Guidance | Health Insurance Season Starts Here | Talk to David → `/get-help/` |

### Schema, identity, sources, internal links, disposition, and priority

Link counts are source-level local `href` counts across the active checkout. Shared navigation/footer links are included; counts are inventory signals, not performance metrics.

| Surface | Structured-data types and material IDs | David/agency presentation | Source/review status | Local internal links out / in | Disposition | Issues |
|---|---|---|---|---:|---|---|
| Homepage | `WebSite`, `InsuranceAgency`, `FAQPage`, `WebPage`, navigation list; `#website`, `#agency`, `/about/#david-huff`, `#webpage` | David-led independent broker; phone, email, license, NPN | Regulated FAQ date sources added in this work package; reviewed 2026-07-31 | 62 / 115 | Tighten | **P1 fixed:** pre-change schema listed unsupported localities and product Offers; copied review excerpts, exact temporary-coverage duration, named fixed-indemnity variants, and volatile operational/BBB claims lacked durable current evidence and were removed or generalized. **P2:** topic density remains high and is deferred. |
| About | `Person`, `ProfilePage`, breadcrumb; `/about/#david-huff`, `/about/#profile`, `#website`, `#agency` | Canonical public profile; works-for/DBA relationship; license and NPN | FL DFS and NIPR verification links; reviewed 2026-07-31 | 12 / 80 | Expand | **P1 fixed:** repeated agency graph and unverified `founder` title removed. **P2:** long page can be density-tested later. |
| Local Answers hub | `CollectionPage`, `WebSite`, `InsuranceAgency`; no stable entity IDs | Generic agency identity | No standard source/review block | 6 / 0 | Retire from expansion | **P1:** zero local inbound links found and directory-style intent overlaps stronger canonicals; do not redirect without Search Console/backlink evidence. |
| Lakeland broker answer | `FAQPage`; no stable IDs | David and local broker answer | No standard source/review block | 2 / 1 | Tighten later | **P1:** weak entity linkage and thin support; keep pending performance evidence. |
| ACA Lakeland | `WebPage`, `Service`, `FAQPage`; page IDs plus canonical entity references | David as author/reviewer; agency provider | Primary CMS/IRS sources and reviewed date present | 7 / 17 | Expand | **P1:** confirm future annual source freshness; no local regression found. |
| Medicare | `WebPage`, `Service`, `FAQPage`; page IDs plus canonical entity references | David as author/reviewer; agency provider | Medicare/CMS sources and reviewed date present | 3 / 32 | Expand | **P1:** legacy supporting Medicare URLs still compete for broker intent. |
| Medicare broker | `WebPage`, `Service`, `InsuranceAgency`, `Offer`, `FAQPage`; no stable canonical entity IDs | Legacy David/agency graph | 2026 seasonal language; no standardized review record | 12 / 6 | Consolidate later | **P1:** stale-year risk, duplicate intent, legacy address/Offer schema. |
| “Best” Medicare broker | `WebPage`, `InsuranceAgency`, `Person`, `FAQPage`; no stable canonical entity IDs | Legacy person/agency graph | No standardized review record | 9 / 5 | Consolidate later | **P1:** “best” search framing and legacy address graph require evidence review; no redirect without performance data. |
| Self-employed | `Article`, `Service`; stable article/service and canonical entity refs | David author/reviewer | Primary sources and reviewed date present | 6 / 2 | Expand | **P1:** low inbound link count; strengthen contextual links in later IA package. |
| Losing coverage | `Article`, `Service`; stable article/service and canonical entity refs | David author/reviewer | Primary sources and reviewed date present | 2 / 3 | Expand | **P1:** low link depth; supporting job-loss articles overlap. |
| Provider/Rx | `Article`, `Service`; stable article/service and canonical entity refs | David author/reviewer | Primary sources, scope, and reviewed date present | 4 / 6 | Expand | **P1:** workflow remains human-reviewed; no provider/formulary guarantee or automated lookup should be inferred. |
| Get Help | `WebPage`, `Service`, breadcrumb; canonical entity refs | David and agency contact path | Consent version is code-controlled; policy approval remains external | 3 / 128 | Tighten | **P1:** legal/business approval of final consent language remains missing; do not submit a real lead during QA. |
| Plans | `WebPage`, `Service`; canonical entity refs | Agency provider, David reviewer | Product limitations visible; no plan inventory claim | 9 / 75 | Consolidate | **P2:** continue reducing duplicated product copy only with conversion evidence. |
| Quote | `WebPage`, `Service`; canonical entity refs | Florida assistance router | State/product constraints visible | 1 / 41 | Consolidate | **P1:** exact license/appointment registry is still needed before any multistate route. |
| Contact | `ContactPage`, `ContactPoint`; canonical entity refs | David direct contact; agency boundary | No regulated claims; privacy-safe warning | 6 / 43 | Tighten | No Work Package 01 regression found. |
| Privacy | `WebPage`; canonical entity refs | Agency controller/contact | Reviewed date and operational boundaries present | 4 / 97 | Tighten | **P1:** authenticated vendor/retention/account settings remain unverified. |
| SMS terms | `WebPage`; canonical entity refs | Agency SMS terms | Version/withdrawal boundaries present | 3 / 4 | Tighten | **P1:** business/legal approval and downstream STOP-state verification remain missing. |
| Our approach | `WebPage`, `InsuranceAgency`, breadcrumb; no stable IDs | Legacy agency explanation | No standard source/review block | 9 / 7 | Keep | **P2:** tone and metadata should be aligned in a later copy package. |
| Learning Center | Breadcrumb only; no stable entity IDs | Shared shell identity | No standard review metadata | 21 / 38 | Keep | **P2:** clarify evergreen taxonomy and normalize entity references later. |
| Blog index | `CollectionPage`, `Organization`, `FAQPage`, breadcrumb; no stable entity IDs | Shared agency identity | No standard review metadata | 88 / 112 | Keep | **P1:** pre-change description still said nationwide; broader index/schema cleanup belongs in Work Package 02. |

## Read-only production observations

Production was not treated as release proof. On July 31, 2026, all inventoried URLs returned 200, but most priority pages still served a different, older title/H1/schema set than the local review candidate.

| Surface | Production title | Production H1 | Comparison with pre-change local checkout |
|---|---|---|---|
| Homepage | Lakeland Medicare & Health Insurance Broker \| Lakeland Health Insurance | Health Insurance Doesn't Have to Be Complicated. | Different title and entity graph; production included legacy address/schema breadth |
| About | About David Huff \| Licensed Health Insurance Broker in Lakeland, FL | Meet David “The Insurance Dude” Huff | Different title; production lacked `ProfilePage` and stable entity IDs |
| ACA | Under-65 ACA Health Insurance Help in Lakeland, FL \| Lakeland Health Insurance | Need coverage before Medicare? | Older production copy and schema |
| Medicare | Compare Medicare Plans in Lakeland, FL \| Advantage, Supplement & Part D | Compare Medicare Advantage, Supplement, and Part D before you switch. | Older production copy and schema |
| Self-employed | Self-Employed Health Insurance Review in Florida \| Lakeland Health Insurance | Self-employed coverage should start with income, household, and network fit. | Older production copy; no JSON-LD found in the production response |
| Losing coverage | Losing Health Coverage or Reviewing COBRA in Florida \| Lakeland Health Insurance | Do not wait until COBRA or lost coverage becomes a scramble. | Older production copy; no JSON-LD found |
| Provider/Rx | Provider and Prescription Coverage Check \| Lakeland Health Insurance | Provider and prescription checks need current plan details. | Older production copy; no JSON-LD found |
| Get Help | Get Health Insurance Help in Lakeland, FL \| Lakeland Health Insurance | Get the right insurance next step without a long intake. | Same H1, different entity graph |
| Plans | Compare Health Insurance Plans in Florida \| Lakeland Health Insurance | Need help choosing a Medicare plan? Review your options before you switch. | Older page and Offer-heavy schema |
| Quote | Get an Instant Quote — Self-Quoting Tools \| Lakeland Health Insurance | Get an Instant Quote | Older ungated positioning |
| Contact | Contact Lakeland Health Insurance \| David Huff | Contact Lakeland Health Insurance | Older identity/address graph |
| Privacy | Privacy Policy \| Lakeland Health Insurance | Privacy Policy | Different legacy organization ID `#organization` |
| SMS | SMS Terms of Service & Privacy Policy \| Lakeland Health Insurance | SMS Terms of Service & Privacy Policy | Older copy |
| Our approach | Our Approach to Health Insurance \| Lakeland Health Insurance | A Disciplined Health Insurance Review | Production differs from local checkout |
| Learning | Health Insurance Learning Center \| Lakeland, Florida | Health Insurance Learning Center | Production differs from local checkout |
| Blog | Health Insurance Blog \| ACA, Medicare & Nationwide Plan Guidance | Health Insurance Season Starts Here | Production still used unsupported nationwide positioning |

The Local Answers hub, Lakeland broker answer, Medicare broker, and “Best” Medicare broker title/H1 combinations matched local source at the time of review. Matching content does not establish that the local commit is the deployed production commit.

## Assumptions and missing evidence

### Assumptions used safely

- “Lakeland Health Insurance” is treated as David Huff's public-facing DBA/site identity based on repository instructions and the established site presentation. It is not represented as a carrier or a separately verified insurance company.
- Remote assistance across Florida is retained as a business-service statement, but every product and plan remains subject to ZIP, county, eligibility, appointment, certification, and plan-year validation.

### Missing evidence; no public inference permitted

- Current carrier appointments by state, product, county, ZIP, and plan year.
- Marketplace registration/certification status beyond public general licensing evidence.
- Exact plan, premium, savings, subsidy, provider, formulary, network, rating, or review-total claims.
- A verified physical consumer-facing office, office hours, or statewide in-person service footprint.
- Search Console, backlinks, GA4, CRM, or lead-delivery evidence needed for redirects and consolidation.
- Authenticated Google Business Profile, analytics, advertising, Netlify, inbox, CRM, or carrier-platform state.

## Work Package 01 disposition summary

- **Keep:** Contact, Privacy, SMS, Our Approach, Learning Center, Blog index, existing city and support URLs pending evidence.
- **Tighten:** Homepage, Get Help, local-answer surfaces, annual source/review metadata.
- **Expand:** About, ACA, Medicare, self-employed, losing-coverage, provider/Rx canonical pages.
- **Consolidate later:** Medicare broker variants, self-employed variants, job-loss variants, Plans/Quote overlap; no redirect is authorized without query/backlink/conversion evidence.
- **Retire from expansion:** engineered Local Answers template program; retain current URLs until evidence supports a redirect or retirement decision.
- **Redirect/retire now:** none.

No P0 local defect remained in the homepage/About Work Package 01 scope after the credential readback and safe claim reductions. Remaining P1 items belong to Work Package 02 or require evidence/approval identified above.

## Post-change local validation record

| Check | Result |
|---|---|
| `node scripts/validate-authority.mjs` | Passed: 14 priority pages, links, canonical entities, sources, claims, FAQ parity, and consent/privacy contracts |
| `node scripts/validate-pages.mjs` | Passed: 153 HTML files, including edited JSON-LD |
| `node --test tests/*.test.mjs` | Passed: 24 tests, 0 failed |
| `node --check scripts/validate-authority.mjs` | Passed |
| `git diff --check` | Passed |
| Desktop browser QA at 1440 × 1000 | Homepage and About: one H1, no horizontal overflow, no browser-console/page errors |
| Mobile browser QA at 360 × 800 | Homepage and About: one H1, no horizontal overflow, no browser-console/page errors; homepage menu opened by keyboard after four Tab presses and Enter |
| Lighthouse accessibility | Homepage 1.00; About 1.00; contrast, link names, button names, and main-landmark checks passed |

All checks used the local server. No form was submitted, and no commit, push, deploy, publication, communication, or external-account mutation was performed.
