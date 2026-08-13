# Website Audit and Search Performance System

Status: Phase 2 local implementation. This system does not deploy, publish, submit URLs,
or change Search Console, GA4, Netlify, DNS, robots, sitemap, or indexing state.

## Decisions and boundaries

The repository and a live crawl establish site content and technical behavior.
Search Console establishes Google Search visibility and Google-selected index and
canonical state. GA4 establishes observed site usage and approved key events.
These sources are joined only after ingestion; one source never substitutes for
another. In particular, Search Console clicks are never labeled as views, and
page-level Search Console rows are never mixed with query-level rows.

A query-by-page Search Analytics collection is retained as a third drilldown
dataset. It can identify pages shown for a visible query, but its rows are never
summed into the independent page or query datasets and omitted mappings are never
inferred.

The implementation uses a local, append-only evidence lake under `.audit-data/`:

1. `raw/<source>/` contains immutable source envelopes and payloads.
2. `normalized/<run-id>/` contains URL-normalized observations.
3. `findings/<run-id>.json` contains machine-readable findings.
4. `reports/<run-id>.md` contains the weekly human report.
5. `screenshots/<render-id>/` contains local desktop/mobile browser evidence.
6. `encrypted/<run-id>/` contains AES-256-GCM encrypted evidence plus an
   authenticated manifest and retention expiry.
7. `governance/decisions.jsonl` contains an append-only, hash-chained decision
   ledger for ownership, status, accepted risk, suppression, and resolution.

Each raw envelope records retrieval time, reporting window, property, filters,
dimensions, data state, requested/retrieved row counts, source limitations, and a
SHA-256 checksum of the canonical payload. Existing files are never overwritten.

## Trust and security model

- Google access tokens are accepted only through process environment variables,
  are never logged, and are never persisted. Use short-lived credentials and the
  least-privilege `webmasters.readonly` and `analytics.readonly` scopes.
- The crawler performs GET requests only, never submits forms, respects the
  configured origin and page limit, uses bounded concurrency, retries transient
  failures, and records redirect hops.
- External HTML is untrusted. The crawler extracts bounded technical fields and
  hashes; it does not execute page text, imported recommendations, scripts, or
  forms. Browser-render observations use a separate JSON import contract.
- URL fragments are removed. Query strings are removed by default; approved
  campaign parameter values are SHA-256 hashed. Parameters matching lead,
  applicant, consent, email, phone, name, address, policy, member, or token terms
  make the import fail closed.
- CSV and JSON imports are scanned for credential and direct-identifier patterns.
  Suspect imports are rejected before persistence.
- Raw evidence is local-only and ignored by Git. Production automation should use
  encrypted storage, object retention/versioning, access logs, and workload
  identity instead of long-lived keys.
- Imported text is data, never instructions. Findings are produced by versioned
  local rules only.
- Browser automation blocks every non-GET/HEAD request, overrides form submission
  APIs, performs no clicks or field entry, and stores hashes instead of console
  message text. Screenshots remain local evidence.
- Matching screenshots are compared with the most recent prior observation at
  the same URL and viewport. Tolerated rendering noise is retained as evidence;
  material changes require human review and never trigger a website mutation.
- Encrypted evidence uses a 32-byte environment key, AES-256-GCM per file, HKDF
  key separation, authenticated relative paths, and a manifest HMAC. Encryption
  keys are never written to evidence or scheduler definitions.

## Components

| Component | Responsibility |
| --- | --- |
| `collect-repository.mjs` | File inventory, Git status/log metadata, sitemap, redirects, robots, canonical/schema/claim coverage, and existing-validator results |
| `crawl-live.mjs` | Low-concurrency HTTP crawl, redirects, links/assets/forms, blank-200 and soft-404 evidence |
| `collect-google.mjs` | Separate GSC page, query, and query-by-page drilldown collections, URL Inspection, and GA4 read-only Data API calls |
| `import-data.mjs` | Strict offline contract for fresh GSC/GA4 CSV/JSON exports plus metadata sidecar |
| `build-report.mjs` | Normalization, alias attribution, rules, prioritization, machine findings, and weekly Markdown report |
| `audit/browser/collect-render.mjs` | Passive desktop/mobile browser rendering, screenshots, prior-run pixel comparison, console/page errors, failed assets, DOM/text measures, and enforced no-submit behavior |
| `run-weekly.mjs` | One-time weekly orchestration entry point and failure handling; it does not install a scheduler |
| `run-scheduled-macos.mjs` | macOS launchd entry point; loads the encryption key from Keychain and short-lived Google tokens from an owner-only external credential broker |
| `scheduler-readiness.mjs` | Non-mutating machine gate for schedule configuration, Keychain, broker file boundary, retention execution, and launchd load state |
| `encrypt-evidence.mjs` / `prune-retention.mjs` | Local authenticated encryption and explicit retention execution |
| `dashboard-server.mjs` | Loopback-only findings/evidence/governance dashboard |

The existing `validate-pages.mjs`, `validate-authority.mjs`, and
`check-regulated-claims.mjs` remain primary local controls. Repository collection
captures their exit status and output instead of cloning their logic.

## URL identity and alias attribution

The canonical key is HTTPS, lowercase configured hostname, normalized percent
encoding, no fragment, directory trailing slash where applicable, and no query
string. `_redirects` supplies current aliases. `audit/url-aliases.json` holds
historical or evidence-backed aliases that cannot be inferred safely. An old URL
can be attributed to its destination for performance history while remaining
excluded from current-defect counts. Redirect and removal recommendations must
include repository links, sitemap history, Git history, GSC, and backlink evidence;
otherwise the action is `VERIFICATION REQUIRED`.

## Completeness and fail-closed behavior

Search Analytics API rows are top rows and Google does not guarantee every row.
Collectors paginate until a short page or empty page is observed. A configured
minimum row count that is not met, a full final page at the configured cap, a
missing freshness/finality state, or mismatched requested/retrieved counts rejects
the run. BigQuery bulk export is the preferred full-data path; its contract checks
`ExportLog` coverage before accepting a reporting window.

GA4 reports validate `rowCount` against retrieved rows and paginate to completion.
API requests are restricted to the canonical production hostname so Netlify
preview and other-host traffic is not attributed to production. Page locations
are checked again after retrieval, and GA4 landing dimensions are replaced with
their normalized path before immutable persistence; raw query names and values are
not retained.
CSV imports require a sidecar with source property, exact window, filters,
dimensions, data state, exported time, row count, and original-file SHA-256.

Trend calculations require distinct, complete, contiguous, equal-length Search
Console page windows. The findings and normalized manifests enumerate both the
current and prior checksums so encrypted evidence bundles include every raw period
used by the comparison.

## Finding priority

The base score is:

`risk (1-5) x visibility (1-5) x confidence (0-1) x recency (0.5-1.5)`

It is normalized to 0-100. Confidential-publication findings receive a score
floor of 95; compliance-control findings receive a floor of 85; ordinary SEO,
analytics, and technical findings are capped at 84. This guarantees the required
ordering regardless of traffic while preserving a distinction between confirmed
public exposure and registry-review candidates. Evidence, source observations,
confidence, and required verification travel with every finding.

Actionable-position query findings also require the configured weekly impression
floor. This suppresses recommendation noise from isolated low-volume rows without
dropping or altering the immutable query dataset. Page and query evidence remain
separate, and query-to-page attribution is never inferred from similar wording.

## Deployment and QA gates

1. **Local validation:** repository collectors, existing validators, unit tests,
   fixture report, and optional localhost crawl. No external mutation.
2. **Preview deployment:** separate approval; build-only deploy preview with
   production analytics disabled. No production DNS or indexing change.
3. **Production deployment:** separate approval; scoped reviewed change set only.
4. **Live readback:** read-only HTTP/canonical/schema/asset verification after a
   production deploy. A successful deploy is not proof of correct rendering.
5. **Visual QA:** desktop/mobile browser rendering, console/network errors,
   accessibility, forms without submission, and screenshot evidence.

No report recommendation is applied automatically. URL submission, removal,
redirects, robots/noindex changes, analytics settings, key-event changes, DNS,
Netlify configuration, and content/compliance edits always require approval.

## Google bulk-export contract

For Search Console BigQuery export, query `searchdata_url_impression` for URL-level
data and `searchdata_site_impression` for query/property data as separate datasets.
Always aggregate numeric fields, partition-filter the requested dates, record all
filters and search types, and verify successful table/date coverage in `ExportLog`.
Export query results to newline-delimited JSON or CSV with the metadata sidecar
required by `import-data.mjs`. Setting up or changing bulk export is outside this
prototype and requires separate approval.

## Render-observation contract

HTTP crawling cannot prove client-rendered content. The read-only browser worker
records `url`, `profile`, `retrievedAt`, `finalUrl`, `httpStatus`, DOM/text counts,
console and request failures, `screenshotSha256`, and `visualComparison`. Page text
and screenshot bytes are not stored in raw envelopes. Screenshot bytes remain in
the local evidence tree and are included in encrypted run bundles.

Visual comparison uses the most recent prior observation from the same dataset,
URL, and viewport profile. Exact hashes are unchanged. Same-size PNGs use a
pixel-level anti-alias-aware comparison; a configurable changed-pixel fraction
separates tolerated rendering noise from a material change. Dimension changes are
material. A material difference creates a verification-required finding for human
review; it does not approve, reject, deploy, or overwrite any baseline.

## Connector authentication validation

`collect-google.mjs validate` performs functional read-only probes instead of
placing access tokens in URLs or persisting them. It verifies that the GSC token
can list the configured property, run a one-row Search Analytics query, and inspect
one configured URL. It separately verifies that the GA4 token can run a one-row
Data API report against the configured property. The retained envelope contains
only capability results and property identifiers. Page Search Analytics, query
Search Analytics, query-by-page drilldowns, URL Inspection, and GA4 collection
remain separate datasets.

## Scheduling, storage, retention, and alerts

`run-weekly.mjs` defaults to a dry-run plan. `--execute` performs one local run; it
does not register cron, launchd, GitHub Actions, Netlify, or any other scheduler.
The disabled launchd example is design evidence only. An approved credential
broker must inject short-lived Google tokens at execution time; refresh tokens and
service-account keys must not be embedded in scheduler files.

On macOS, `run-scheduled-macos.mjs` enforces that the credential broker is an
owner-only executable outside the repository, accepts only the documented token
and expiry fields, rejects credentials with less than ten minutes or more than two
hours of remaining lifetime, verifies Google token metadata, rejects every scope
outside `webmasters.readonly` and `analytics.readonly`, loads the AES key from
Keychain, and passes secrets only in the child process environment. It never
prints or persists broker output.

Successful runs are encrypted locally. `prune-retention.mjs` is dry-run unless
`--execute` is supplied. The explicitly executed weekly runner enforces the
configured 90-day retention policy after encryption. Retention authenticates all
bundle manifests and deletes only boundary-validated expired encrypted bundles.
Failures always create a local, redacted record. An external webhook
requires all three of: configuration enabled after approval, the explicit command
flag, and an HTTPS endpoint supplied through the environment. No remote storage
adapter, schedule, or alert is enabled in this phase without separate approval.

## Findings governance dashboard

The dashboard binds only to `127.0.0.1`, reads the latest machine findings, and
supports severity/category/status/owner/search filters plus evidence and full
resolution-history inspection. Governance changes append records; they never edit
findings or prior records. Accepted-risk and suppression actions require a reason
and future expiry, after which the dashboard treats the finding as open again.
Dashboard actions cannot modify the website, Search Console, GA4, Netlify, DNS, or
indexing state.
