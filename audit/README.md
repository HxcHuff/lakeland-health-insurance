# Read-only audit operations

This directory defines the production architecture, schemas, configuration, and
data contracts. Runtime evidence is written to `.audit-data/` and is intentionally
excluded from Git.

## Environment contract

No credential is required for repository collection, fixture tests, report
generation, or the live GET-only crawler.

| Variable | Required for | Contract |
| --- | --- | --- |
| `LHI_GSC_ACCESS_TOKEN` | GSC Search Analytics and URL Inspection | Short-lived OAuth token with `https://www.googleapis.com/auth/webmasters.readonly`; never stored or logged |
| `LHI_GA4_ACCESS_TOKEN` | GA4 Data API | Short-lived OAuth token with `https://www.googleapis.com/auth/analytics.readonly`; never stored or logged |
| `LHI_AUDIT_ENCRYPTION_KEY` | Local encrypted evidence | Exactly 32 random bytes encoded as 64 hex characters or base64; never stored in the repository or scheduler |
| `LHI_AUDIT_ALERT_WEBHOOK` | Approval-gated external failure alert | Optional HTTPS endpoint; ignored while external alerts remain disabled |

Configuration contains property identifiers, not secrets. The repository's
current analytics record identifies GA4 property `492431963`; confirm access and
property scope before any authenticated collection. Do not place service-account
JSON, refresh tokens, API keys, or copied browser credentials in this repository.

## Local commands

```sh
node scripts/audit/collect-repository.mjs
node scripts/audit/crawl-live.mjs --max-pages 200 --concurrency 2
node scripts/audit/build-report.mjs
node --test tests/audit-system.test.mjs
node scripts/audit/collect-google.mjs preflight
npm --prefix audit install
npm --prefix audit exec playwright install chromium
node audit/browser/collect-render.mjs --max-pages 10
node scripts/audit/dashboard-server.mjs
```

Each browser run compares matching URL/profile screenshots with the most recent
prior run from the same live or localhost dataset. Exact matches, tolerated
anti-alias differences, and material changes are recorded separately. Material
changes create review-only findings and never update the website or a baseline.

The crawl is a live read-only request stream, not a deployment or mutation. To run
repository collection plus report generation without a network crawl:

```sh
node scripts/audit/run-read-only.mjs
```

Add `--live` only when a current live crawl is desired.

## Google collection

Validate all three functional connector paths before collection. This command
retains only a capability envelope and never retains token values or probe rows:

```sh
node scripts/audit/collect-google.mjs preflight
node scripts/audit/collect-google.mjs validate
```

Use explicit dates. Run page and query Search Console collection independently:

```sh
LHI_GSC_ACCESS_TOKEN='short-lived-token' node scripts/audit/collect-google.mjs gsc-pages --start 2026-07-01 --end 2026-07-31
LHI_GSC_ACCESS_TOKEN='short-lived-token' node scripts/audit/collect-google.mjs gsc-queries --start 2026-07-01 --end 2026-07-31
LHI_GSC_ACCESS_TOKEN='short-lived-token' node scripts/audit/collect-google.mjs gsc-query-pages --start 2026-07-01 --end 2026-07-31
LHI_GSC_ACCESS_TOKEN='short-lived-token' node scripts/audit/collect-google.mjs inspect
LHI_GA4_ACCESS_TOKEN='short-lived-token' node scripts/audit/collect-google.mjs ga4 --start 2026-07-01 --end 2026-07-31
```

Search Analytics API imports retain Google's final/fresh state and top-row
limitation. Use `--expected-rows` only when the expected minimum is known from the
export contract. If pagination reaches the configured cap or retrieved rows are
below the expectation, collection fails without writing the dataset.

The query-by-page command creates a third drilldown dataset. It does not replace,
join into, or supply totals for the independent page and query datasets. Missing
query/page mappings remain unknown because Search Analytics returns top rows.

## Offline CSV/JSON import

Every offline file requires a JSON sidecar matching
`audit/schemas/import-sidecar.schema.json`.

```sh
node scripts/audit/import-data.mjs --file /approved/path/export.csv --sidecar /approved/path/export.meta.json
```

The sidecar must identify the exact property, reporting window, filters,
dimensions, final/fresh state, export time, exact row count, completeness status,
and SHA-256 checksum. Imports with unapproved columns, mismatched counts/checksums,
incomplete status, sensitive query parameter names, credentials, emails, or phone
numbers are rejected.

## BigQuery Search Console export

Bulk export setup is not performed by this system. If it already exists, export
the two datasets separately:

```sql
-- Page-level visibility. Keep separate from query/property rows.
SELECT
  url AS page,
  SUM(clicks) AS clicks,
  SUM(impressions) AS impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr,
  SAFE_DIVIDE(SUM(sum_position), SUM(impressions)) + 1 AS position
FROM `PROJECT.DATASET.searchdata_url_impression`
WHERE data_date BETWEEN @start_date AND @end_date
  AND search_type = 'WEB'
GROUP BY page;

-- Query/property visibility. Never join or label as page-level rows.
SELECT
  query,
  is_anonymized_query,
  SUM(clicks) AS clicks,
  SUM(impressions) AS impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) AS ctr,
  SAFE_DIVIDE(SUM(sum_top_position), SUM(impressions)) + 1 AS position
FROM `PROJECT.DATASET.searchdata_site_impression`
WHERE data_date BETWEEN @start_date AND @end_date
  AND search_type = 'WEB'
GROUP BY query, is_anonymized_query;
```

Before marking either export complete, verify successful coverage for each table
and date in `ExportLog`. Preserve anonymized-query flags and do not infer hidden
query rows.

## Operational gates

- `run-read-only.mjs`: local evidence only.
- Preview deployment: separate approval and separate workflow.
- Production deployment: separate approval and reviewed paths only.
- Live readback: GET-only verification after an approved production deployment.
- Visual QA: separate browser evidence; forms are not submitted.
- Weekly runner: dry-run by default; `--execute` is one local run and does not
  install a scheduler.
- Encrypted evidence: local only; a 32-byte environment key is required.
- Retention: preview with `node scripts/audit/prune-retention.mjs`; deletion occurs
  only with its explicit `--execute` flag and a valid encryption key that verifies
  each candidate bundle manifest before deletion.
- Dashboard: loopback only at `http://127.0.0.1:4178` by default.
- External schedule, storage, and alerting remain disabled pending approval.

The weekly report always includes a do-not-change-automatically section. Findings
are recommendations, not executable change instructions.

## Weekly local run

The previous complete Monday-Sunday UTC window is used for GSC and GA4. Review the
plan without running anything:

```sh
node scripts/audit/run-weekly.mjs
```

After short-lived Google tokens and the encryption key are present in the process
environment, one approved local execution is:

```sh
node scripts/audit/run-weekly.mjs --execute
```

The checked-in launchd file is disabled and must not be installed or enabled until
the scheduler host, short-lived credential broker, retention duration, encrypted
storage destination, and alert destination are approved.
