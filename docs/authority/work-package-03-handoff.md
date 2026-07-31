# Work Package 03 Handoff — Regulated Florida Guides and Source Freshness

Status: local release candidate
Review date: July 31, 2026
Branch: `codex/regulated-content-and-source-freshness`

## Outcome

Work Package 03 closes the highest-confidence regulated-guide gaps without creating duplicate city templates or redirecting existing authority URLs. It adds canonical Florida guides for retiring before 65, Medicaid/CHIP loss, and Medicare moves; refreshes the existing income-correction and working-at-65 articles in place; and installs a claim-to-source-to-page freshness gate used by the normal authority validator.

Preview packaging review also found that repository documentation and operational files could be served because the repository root is the static publish directory. `.netlifyignore` now excludes documentation, source registries, tests, validation scripts, function source, local tooling, spreadsheets, and Word files from deployment; `_redirects` adds forced-404 defense-in-depth boundaries for internal directories. The authority validator enforces the critical exclusions.

## Created public pages

- `/retiring-before-65-florida/`
- `/losing-medicaid-florida/`
- `/moving-florida-medicare/`

Each page has a direct answer, Florida/year applicability, one canonical URL and H1, canonical entity references, David Huff as author/reviewer, primary sources with access date, limitations, contextual links, a private Get Help path, phone path, and no plan/carrier/provider/savings guarantee.

## Refreshed existing pages

- `/aca-health-insurance-lakeland-fl/`
- `/medicare/`
- `/self-employed-health-insurance/`
- `/losing-coverage/`
- `/provider-prescription-check/`
- `/aca-subsidy-estimator/`
- `/blog/aca-subsidy-wrong-income-florida.html`
- `/blog/medicare-vs-aca-central-florida-age-65.html`
- `/learning/`

The core regulated pages now show July 31, 2026 review/source metadata. The self-employed guide cites current Marketplace net-income and ledger guidance. The coverage-loss guide distinguishes the current Medicaid/CHIP workflow from the general job-loss timing. The two existing long-form articles retain their URLs, reference the canonical entity graph, use current sources, and remove unsupported duplicate/decorative entity markup. Invisible FAQ schema was removed from the Medicare/ACA article.

## Source-freshness enforcement

- `data/regulated-claims.json` contains 13 claim records with source URL, access date, applicable year, state, product line, review status, cadence, and every public page using the claim.
- `scripts/check-regulated-claims.mjs` rejects missing fields, duplicate IDs, invalid dates, stale reviews, unapproved hosts, missing pages, and pages that do not cite the exact registered source.
- `--online` performs read-only source probes and fails on unreachable primary sources.
- `scripts/validate-authority.mjs` runs the offline claim check as part of the normal release gate.
- Tests prove the current registry passes and duplicate/stale records fail.

## Information architecture

- Learning Center links the three new evergreen guides.
- Sitemap includes the new canonical URLs and current last-modified dates.
- The exact-plan provider workflow remains one canonical page rather than being duplicated.
- Plans remains the education/path-selection hub; Quote remains the state/product router.
- Existing article and legacy URLs remain unchanged pending aggregate evidence.

## Accessibility and browser verification

- Desktop 1440 × 1000 and mobile 360 × 800 checks passed on the three new guides, two refreshed article templates, and Learning Center.
- Every checked page returned 200, rendered one H1 and one main landmark, had no horizontal overflow or unnamed controls, reached an anchor by keyboard, respected reduced motion, and emitted no console/page errors.
- Lighthouse accessibility: 1.00 on all six materially changed templates after correcting legacy breadcrumb, CTA, shared blog-footer link, and BBB-copy contrast.
- Mobile Lighthouse on the three new guides: Performance 98/99/98, Accessibility 100/100/100, Best Practices 100/100/100, SEO 100/100/100; LCP 1.7/1.1/1.1 seconds and CLS 0.067/0.067/0.093.
- Full-page desktop/mobile screenshots for the three new guides are stored in ignored local QA output under `output/playwright/wp03/`.
- No form was submitted.

## Validation record

```text
node scripts/check-regulated-claims.mjs --as-of 2026-07-31
node scripts/check-regulated-claims.mjs --as-of 2026-07-31 --online
LHI_VALIDATION_DATE=2026-07-31 node scripts/validate-authority.mjs
node scripts/validate-pages.mjs
node --test tests/*.test.mjs
node --check scripts/check-regulated-claims.mjs
node --check scripts/validate-authority.mjs
git diff --check
```

Expected release result: 13 current/cited claims; all 13 live source probes pass; 14 priority pages, 16 Package 2 surfaces, and 5 Package 3 guide surfaces pass authority validation; 156 HTML files pass; 26 tests pass; syntax and whitespace checks pass.

Preview release additionally requires 404 responses for `/docs/`, `/data/`, `/scripts/`, `/tests/`, `/netlify/`, `/run/`, root Markdown, Word, and spreadsheet artifacts.

## Explicit evidence gates

`docs/authority/external-evidence-gates.md` defines the PHI-free aggregate packet required before URL consolidation and the approval/reconciliation packet required before a controlled production lead or downstream STOP test. No redirect, external-account change, real/synthetic production lead, message, profile edit, or review request is included in this package.

## Release and rollback

Stage only the Package 03 implementation and documentation; keep the two untracked controlling prompts excluded. Commit and push the task branch, create an exact-commit Netlify draft/preview, repeat the crawl and six-template browser gate there, then release only the verified commit to `main`. Prove production with the Netlify deploy ID, exact `commit_ref`, cache-busted HTML markers, source registry behavior, and desktop/mobile browser checks.

Rollback is the immediately prior production commit `4ef97d4ec0d294f0e24d5090ae2d36ac2afbf482`, restored through the normal Git/Netlify release workflow. HTTP 200 alone is not rollback proof.
