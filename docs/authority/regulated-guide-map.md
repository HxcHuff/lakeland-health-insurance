# Regulated Florida Guide Map

Review date: July 31, 2026
Scope: Work Package 03 regulated guide cluster and source-freshness controls

## Canonical guide dispositions

| Required topic | Canonical surface | Disposition | Reason |
|---|---|---|---|
| Retiring before 65 in Florida | `/retiring-before-65-florida/` | Create | No existing page owned the pre-Medicare retirement decision from coverage end through Medicare timing. |
| COBRA versus Marketplace after job loss | `/losing-coverage/` | Refresh | Existing core page owns the intent and now distinguishes the general job-loss window from the Medicaid/CHIP workflow. |
| ACA coverage after losing Florida Medicaid | `/losing-medicaid-florida/` | Create | Existing coverage-loss content mentioned Medicaid but did not own the current notice, application, and document workflow. |
| Correcting projected Marketplace income | `/blog/aca-subsidy-wrong-income-florida.html` | Refresh | Existing URL has the correct intent and now references the canonical entity graph and current change-reporting source. |
| Self-employed Marketplace income documentation | `/self-employed-health-insurance/` | Refresh | Existing core page owns the intent; current HealthCare.gov ledger guidance is the controlling source. |
| Turning 65 while still working | `/blog/medicare-vs-aca-central-florida-age-65.html` | Refresh | Existing long-form guide owns the intent and now distinguishes current-employment coverage from COBRA, retiree, and Marketplace coverage using current Medicare guidance. |
| Medicare provider and prescription checklist | `/provider-prescription-check/` | Refresh | Existing core workflow already requires exact provider location, plan ID, formulary, pharmacy, and plan year. |
| Moving into or out of Florida with Medicare | `/moving-florida-medicare/` | Create | No existing canonical page owned the service-area and move-SEP workflow. |
| Verify a Florida provider by exact plan details | `/provider-prescription-check/` | Consolidate into existing canonical | Same user task as the Medicare provider/prescription checklist; a second URL would duplicate intent. |
| Florida Marketplace and Medicare pathways | `/plans/` with `/quote/` routing | Keep | Plans owns education/path selection; Quote owns state and product routing. |

## Publication contract

Every created or refreshed regulated guide must have one canonical URL, one H1, canonical entity references, a direct answer near the top, Florida and year applicability, David Huff as author and reviewer, current primary sources with access date, limitations, contextual links, and one primary next action.

`data/regulated-claims.json` is the claim-to-source-to-page registry. Optional `candidateEvidence` mappings bind a reviewed page statement to its SHA-256 fingerprint. Only exact fingerprint matches count as audit coverage; a general page-level `usedBy` mapping does not suppress other candidates on that page. `scripts/check-regulated-claims.mjs` rejects stale source reviews, duplicate IDs, unapproved source hosts, missing pages, missing source citations, stale fingerprints, and duplicate fingerprint ownership. `--online` additionally verifies the current HTTP response for every source without changing an external account.

## Evidence gates

- Do not redirect or retire the older income, Medicare, job-loss, or local-answer URLs without aggregate Search Console, backlink, conversion, and CRM evidence.
- Do not publish carrier, plan, provider, formulary, premium, savings, appointment, review, or ranking claims without current page-specific evidence.
- Do not treat an application, eligibility result, plan selection, payment, thank-you page, or analytics event as proof that coverage or a lead is active or delivered.
- Do not submit a real lead or use consumer data during browser validation.
