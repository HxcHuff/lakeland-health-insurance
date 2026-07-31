# Work Package 02 Handoff — Core Authority Pages and Information Architecture

Status: local review candidate
Review date: July 31, 2026
Branch: `codex/core-authority-information-architecture`

## Release precondition and pre-change state

- Work Package 01 release commit: `2d3722692b7c4f71dd0cf3ea29f74864ac7f7da6`.
- `HEAD`, `origin/main`, and the released Work Package 01 branch resolved to that exact commit before Package 2 edits.
- Netlify production deploy: `6a6ccf7561223000086e96d4`, state `ready`, published July 31, 2026 at 16:38:35.950Z, commit `2d3722692b7c4f71dd0cf3ea29f74864ac7f7da6`.
- Production homepage/About cache-busted responses contained the approved title/canonical and `#agency`, `#website`, `/about/#david-huff`, `/about/#profile`, and July 31, 2026 review markers.
- Pre-change working tree contained only the untracked Package 1 and Package 2 prompt files; both were preserved.
- Package 2 branch was created locally from the verified release commit. No stage, commit, push, merge, or deploy occurred.

## Pre-change validation

| Command | Result |
|---|---|
| `node scripts/validate-authority.mjs` | Passed: 14 priority pages and existing authority contracts |
| `node scripts/validate-pages.mjs` | Passed: 153 HTML files |
| `node --test tests/*.test.mjs` | Passed: 24 tests, 0 failed |
| `node --check scripts/validate-authority.mjs` | Passed |
| `git diff --check` | Passed |

## Pages reviewed and changed

Reviewed canonical core pages: ACA, Medicare, self-employed, losing coverage, provider/prescription, Get Help, Plans, Quote, and Contact. Their Package 1 implementation already had distinct roles, accurate Florida/Lakeland scope, canonical entity references, current primary sources where regulated, visible limitations, and established conversion behavior. They were intentionally not rewritten without a directly observed defect.

Changed legacy/index pages:

- `/local-health-insurance-answers/`
- `/local-health-insurance-answers/health-insurance-broker-lakeland-fl/`
- `/medicare-broker-lakeland-fl/`
- `/best-medicare-broker-lakeland-fl/`
- `/our-approach.html`
- `/learning/`
- `/blog/`

## Entity and schema corrections

- Applied the canonical IDs `#website`, `#agency`, and `/about/#david-huff` to every Package 2 surface.
- Removed repeated full agency and Person graphs from legacy pages.
- Removed unevidenced `PostalAddress`, `Offer`, price, founder, medical-organization mention, and decorative FAQ schema from the affected legacy Medicare/blog/answer surfaces.
- Removed a duplicate pair of floating contact controls from the legacy “best broker” page; the shared site shell remains the single accessible floating-contact implementation.
- Retained `WebPage`, `CollectionPage`, `Service`, and `BreadcrumbList` only where visible content supports them.
- Extended `scripts/validate-authority.mjs` to enforce the 16-page Package 2 contract offline: canonical/indexability/H1, stable entity refs, duplicate graph prohibition, prohibited schema types, excluded carriers, national/free language, fixed-indemnity limitations, review dates, Medicare source/disclosure, and required documentation.

## Claims removed, qualified, retained, or blocked

Removed or qualified:

- Nationwide/across-the-United-States service framing on the Blog index.
- Free/zero-price and same-premium broker claims.
- Unverified office address, headquarters, and opening hours.
- Broad provider/network participation language.
- Stale `2026 AEP plan review` positioning where the visitor decision is for 2027 coverage.
- Implicit ranking language: the legacy “best” URL is explicitly a neutral checklist, not a ranking claim.

Retained with limitations:

- Medicare Annual Enrollment dates, supported by Medicare.gov and reviewed for the 2027 contract year.
- Broker compensation explanation using the approved entity-contract language.
- Lakeland/Polk local assistance and remote Florida assistance, always subject to product, appointment/certification, county/ZIP, eligibility, and plan-year verification.
- Required statement that not every Medicare plan available in the area is offered.

Blocked for evidence:

- Redirecting, retiring, deleting, or canonicalizing away any Medicare broker, Local Answers, self-employed, job-loss, or Florida-guide URL.
- Any carrier, plan, provider, formulary, price, savings, rating, review, address, appointment, or certification claim without current page-specific evidence.

## Information architecture and internal links

- Clarified Blog as the dated/current channel and Learning Center as the evergreen/task-based channel.
- Added restrained contextual paths from Local Answers to canonical ACA, Medicare, provider/prescription, Plans, Learning, and Get Help surfaces.
- Preserved Plans as education/path selection and Quote as state/product routing.
- Preserved primary navigation, canonical URLs, forms, phone links, booking, analytics, Meta Pixel, and conversion loaders.
- Added the missing Blog `main` landmark and corrected legacy breadcrumb, table, footer, and link contrast without changing the design system.
- Created `docs/authority/core-authority-page-map.md` with current facts, dispositions, overlap inventory, and explicit evidence gates.

## Current sources

| Source | Purpose | Access/review date |
|---|---|---|
| Medicare.gov Open Enrollment | October 15–December 7 enrollment period | July 31, 2026 |
| Existing Package 1 source registry (`data/regulated-claims.json`) | ACA, Medicare, IRS, Marketplace claims | July 31, 2026 registry review |
| Florida DFS and NIPR verification paths in the entity contract/About page | License and NPN verification | July 31, 2026 |

No source establishes a particular carrier appointment, plan/provider/formulary availability, price, savings, rating, or review count.

## Final validation record

| Check | Final result |
|---|---|
| `node scripts/validate-authority.mjs` | Passed: 14 priority pages plus 16 Work Package 02 surfaces and the expanded offline contracts |
| `node scripts/validate-pages.mjs` | Passed: 153 HTML files, including every edited JSON-LD block |
| `node --test tests/*.test.mjs` | Passed: 24 tests, 0 failed |
| `node --check scripts/validate-authority.mjs` | Passed |
| `git diff --check` | Passed |
| Desktop browser, 1440 × 1000 | Seven changed templates: one H1, one main landmark, correct canonical, no horizontal overflow, no unnamed control, keyboard focus reached an anchor, no console/page errors |
| Mobile browser, 360 × 800 | Same seven templates and checks passed; reduced-motion emulation passed |
| Lighthouse accessibility | 1.00 on all seven changed templates; contrast, link distinction, target size, names, and landmarks passed |

No form was submitted. Screenshot and Lighthouse artifacts are in `output/playwright/wp02/`, with `-desktop.png` and `-mobile.png` captures for every changed page.

## Remaining priorities

- P0: none identified in the authorized local scope.
- P1: obtain Search Console, backlink, GA4, CRM, and conversion evidence before consolidation; obtain legal/business approval for final consent language and verify downstream SMS STOP state; maintain annual ACA/Medicare source freshness.
- P2: density-test the Blog/Learning/Our Approach indexes; evaluate article-level refresh/consolidation only after performance evidence; consider a later homepage-density package.

## Deployment checklist

1. Review the local diff and page map; approve or reject each public-copy change.
2. Confirm all local validation, desktop/mobile checks, Lighthouse accessibility, and screenshot review remain green.
3. Stage only the intended Package 2 files; exclude controlling prompts unless David explicitly wants them versioned.
4. Commit with a scoped message on the Package 2 branch.
5. Push the branch and create an exact-commit Netlify preview.
6. Re-run the 16-page validator/crawl and browser checks on that preview without form submission.
7. Obtain an explicit go/no-go before merging or publishing.

## Rollback plan

Before deployment, rollback is simply to decline or selectively revise the uncommitted local diff. After an approved deployment, restore the prior production commit `2d3722692b7c4f71dd0cf3ea29f74864ac7f7da6` through the normal Git/Netlify release workflow; do not rely on HTTP 200 as rollback proof.

## Post-deployment verification

1. Tie the production deploy ID to the approved commit and production branch.
2. Fetch cache-busted production HTML for all 16 Package 2 surfaces.
3. Confirm titles, canonicals, indexability, one H1, canonical entity IDs, review/source markers, and prohibited-schema absence.
4. Run link/CTA checks without submitting a form.
5. Confirm phone, email, Get Help, booking, state/product router, analytics, Meta Pixel, and consent loaders are present.
6. Run desktop/mobile console, overflow, keyboard, reduced-motion, contrast, and Lighthouse accessibility checks.
7. Monitor production errors and preserve the prior-commit rollback path.

## Recommended Work Package 03

1. Evidence package for Search Console/backlinks/GA4/CRM URL consolidation decisions, using aggregate PHI-free data.
2. Consent/business approval and downstream delivery/STOP-state verification without real consumer data.
3. Source freshness and claim registry expansion for dated Medicare/ACA articles.
4. Evidence-led Blog/Learning taxonomy and density cleanup; no broad rewriting or redirecting without item 1.

Nothing in Work Package 02 has been staged, committed, pushed, merged, deployed, published, submitted, communicated, or changed in an external account.
