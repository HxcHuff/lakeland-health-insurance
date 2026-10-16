#!/usr/bin/env node
/** PR B gate: all blog lead-hero routes pass rendered homepage-match metrics. */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MEASURE_JSON =
  process.env.PR_B_MEASURE_JSON ||
  '/cursor/stores/self/media/sitewide-b/blog-measure-all.json';

const warmColors = spawnSync(process.execPath, ['scripts/check-warm-alert-colors.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024
});
if (warmColors.stderr) process.stderr.write(warmColors.stderr);
if (warmColors.status !== 0) {
  process.exit(warmColors.status ?? 1);
}

const htmlNest = spawnSync(process.execPath, ['scripts/check-blog-html-nesting.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    PLAYWRIGHT_CHROME_EXECUTABLE_PATH:
      process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  },
  maxBuffer: 8 * 1024 * 1024
});
if (htmlNest.stderr) process.stderr.write(htmlNest.stderr);
if (htmlNest.status !== 0) {
  process.exit(htmlNest.status ?? 1);
}

const preserve = spawnSync(process.execPath, ['scripts/check-content-preservation-pr-b.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    PLAYWRIGHT_CHROME_EXECUTABLE_PATH:
      process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  },
  maxBuffer: 8 * 1024 * 1024
});
if (preserve.stderr) process.stderr.write(preserve.stderr);
if (preserve.status !== 0) {
  process.exit(preserve.status ?? 1);
}

const child = spawnSync(process.execPath, ['scripts/measure-sitewide-pr-b.mjs'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    PR_B_MEASURE_JSON: MEASURE_JSON,
    PLAYWRIGHT_CHROME_EXECUTABLE_PATH:
      process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  },
  maxBuffer: 8 * 1024 * 1024
});

if (child.stderr) process.stderr.write(child.stderr);

if (!existsSync(MEASURE_JSON)) {
  console.error(`missing measure output: ${MEASURE_JSON}`);
  process.exit(child.status ?? 1);
}

let report;
try {
  const payload = JSON.parse(readFileSync(MEASURE_JSON, 'utf8'));
  report = Array.isArray(payload) ? payload : payload.rows;
} catch (err) {
  console.error(`failed to read ${MEASURE_JSON}:`, err.message);
  process.exit(1);
}

if (!Array.isArray(report)) {
  console.error('measure JSON missing rows array');
  process.exit(1);
}

const failures = report.filter((r) => !r.ok);
const byRoute = new Map();
for (const row of failures) {
  if (!byRoute.has(row.route)) byRoute.set(row.route, []);
  byRoute.get(row.route).push(`${row.viewport}: ${row.issues.join(', ')}`);
}

let preserveSummary = null;
const PRESERVE_JSON =
  process.env.PR_B_PRESERVE_JSON ||
  '/cursor/stores/self/media/sitewide-b/content-preservation.json';
if (existsSync(PRESERVE_JSON)) {
  try {
    preserveSummary = JSON.parse(readFileSync(PRESERVE_JSON, 'utf8'));
  } catch {
    preserveSummary = null;
  }
}

console.log(
  JSON.stringify(
    {
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
      failures: [...byRoute.entries()].map(([route, issues]) => ({ route, issues }))
    },
    null,
    2
  )
);

process.exit(byRoute.size > 0 ? 1 : child.status ?? 0);
