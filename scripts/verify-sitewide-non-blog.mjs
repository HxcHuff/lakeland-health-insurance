#!/usr/bin/env node
/** Non-blog sitewide gate orchestrator. NON_BLOG_SCOPE=b|c|all */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const scope = process.env.NON_BLOG_SCOPE || 'all';
const MEDIA = '/cursor/stores/self/media/sitewide-c';
const MEASURE_JSON = process.env.NON_BLOG_MEASURE_JSON || `${MEDIA}/non-blog-measure-${scope}.json`;
const PRESERVE_JSON = process.env.NON_BLOG_PRESERVE_JSON || `${MEDIA}/content-preservation-${scope}.json`;

const envBase = {
  ...process.env,
  NON_BLOG_SCOPE: scope,
  NON_BLOG_MEASURE_JSON: MEASURE_JSON,
  NON_BLOG_PRESERVE_JSON: PRESERVE_JSON,
  PLAYWRIGHT_CHROME_EXECUTABLE_PATH:
    process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
};

const warmColors = spawnSync(process.execPath, ['scripts/check-warm-alert-colors.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024
});
if (warmColors.stderr) process.stderr.write(warmColors.stderr);
if (warmColors.status !== 0) process.exit(warmColors.status ?? 1);

const preserve = spawnSync(process.execPath, ['scripts/check-content-preservation-non-blog.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: envBase,
  maxBuffer: 8 * 1024 * 1024
});
if (preserve.stderr) process.stderr.write(preserve.stderr);

const measure = spawnSync(process.execPath, ['scripts/measure-sitewide-non-blog.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: envBase,
  maxBuffer: 8 * 1024 * 1024
});
if (measure.stderr) process.stderr.write(measure.stderr);

if (!existsSync(MEASURE_JSON)) {
  console.error(`missing measure output: ${MEASURE_JSON}`);
  process.exit(measure.status ?? 1);
}

let report;
try {
  const payload = JSON.parse(readFileSync(MEASURE_JSON, 'utf8'));
  report = Array.isArray(payload) ? payload : payload.rows;
} catch (err) {
  console.error(`failed to read ${MEASURE_JSON}:`, err.message);
  process.exit(1);
}

const failures = report.filter((r) => !r.ok);
const byRoute = new Map();
for (const row of failures) {
  if (!byRoute.has(row.route)) byRoute.set(row.route, []);
  byRoute.get(row.route).push(`${row.viewport}: ${row.issues.join(', ')}`);
}

let preserveSummary = null;
if (existsSync(PRESERVE_JSON)) {
  try {
    preserveSummary = JSON.parse(readFileSync(PRESERVE_JSON, 'utf8'));
  } catch {
    preserveSummary = null;
  }
}

const gateSummary = {
  scope,
  measureJson: MEASURE_JSON,
  contentPreservationJson: PRESERVE_JSON,
  contentPreservation: preserveSummary
    ? {
        routesChecked: preserveSummary.routesChecked,
        totalMissingBlocks: preserveSummary.totalMissingBlocks,
        routesWithMissing: preserveSummary.routesWithMissing
      }
    : null,
  totalChecks: report.length,
  failedChecks: failures.length,
  failedRoutes: byRoute.size,
  failures: [...byRoute.entries()].map(([route, issues]) => ({ route, issues })),
  preserveExit: preserve.status,
  measureExit: measure.status
};

console.log(JSON.stringify(gateSummary, null, 2));
const hardFail = byRoute.size > 0 || preserve.status !== 0;
process.exit(hardFail ? 1 : measure.status ?? 0);
