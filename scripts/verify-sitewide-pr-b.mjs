#!/usr/bin/env node
/** PR B gate: all blog lead-hero routes pass rendered homepage-match metrics. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const child = spawnSync(process.execPath, ['scripts/measure-sitewide-pr-b.mjs', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    PLAYWRIGHT_CHROME_EXECUTABLE_PATH:
      process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
  },
  maxBuffer: 40 * 1024 * 1024
});

if (child.status !== 0 && !child.stdout) {
  if (child.stderr) process.stderr.write(child.stderr);
  process.exit(child.status ?? 1);
}

const report = JSON.parse(child.stdout || '[]');
const failures = report.filter((r) => !r.ok);
const byRoute = new Map();
for (const row of failures) {
  if (!byRoute.has(row.route)) byRoute.set(row.route, []);
  byRoute.get(row.route).push(`${row.viewport}: ${row.issues.join(', ')}`);
}

console.log(
  JSON.stringify(
    {
      totalChecks: report.length,
      failedChecks: failures.length,
      failedRoutes: byRoute.size,
      failures: [...byRoute.entries()].map(([route, issues]) => ({ route, issues }))
    },
    null,
    2
  )
);

process.exit(byRoute.size ? 1 : 0);
