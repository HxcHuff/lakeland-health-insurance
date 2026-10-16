#!/usr/bin/env node
/**
 * Rendered layout gate for PR A (Playwright metrics, not class names).
 * Runs measure-sitewide-pr-a.mjs on the PR A route set and fails on regressions.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ROUTES = [
  '/advantage-guard/',
  '/accident-wise/',
  '/critical-guard/',
  '/hospital-wise/',
  '/hospital-safeguard-gi/',
  '/supplemental-insurance/',
  '/medicare-broker-lakeland-fl/',
  '/tampa-health-insurance/',
  '/davenport-health-insurance/',
  '/brandon-health-insurance/',
  '/clearwater-health-insurance/',
  '/haines-city-health-insurance/',
  '/lake-alfred-health-insurance/',
  '/largo-health-insurance/',
  '/new-port-richey-health-insurance/',
  '/riverview-health-insurance/',
  '/st-petersburg-health-insurance/',
  '/wesley-chapel-health-insurance/',
  '/winter-haven-health-insurance/',
  '/carriers/ambetter-aca-2026/',
  '/carriers/molina-aca-2026/',
  '/carriers/oscar-aca-2026/',
  '/carriers/unitedhealthcare-aca-2026/',
  '/carriers/wellpoint-aca-2026/',
  '/health-protector-guard/',
  '/short-term-medical/',
  '/learning/',
  '/life-insurance-dime-method/',
  '/blog/orlando-health-lakeland-quality-approval-2026.html',
  '/blog/orlando-health-polk-county-expansion-2026.html',
  '/blog/orlando-health-watson-clinic-insurance-2026.html',
  '/blog/medicare-for-dummies.html',
  '/blog/aca-subsidy-tax-return-clawback.html',
  '/blog/life-change-health-insurance-60-day-window-florida.html',
  '/blog/'
];

const child = spawnSync(
  process.execPath,
  ['scripts/measure-sitewide-pr-a.mjs', '--json', '--no-fail', ...ROUTES],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      PLAYWRIGHT_CHROME_EXECUTABLE_PATH:
        process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH || '/usr/local/bin/google-chrome'
    },
    maxBuffer: 20 * 1024 * 1024
  }
);

if (child.status !== 0) {
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  process.exit(child.status ?? 1);
}

const report = JSON.parse(child.stdout);
const failures = report.filter(
  (r) =>
    r.footerBeforeH1 ||
    (r.viewport === '390' && r.h1Y != null && r.h1Y > 450) ||
    (r.viewport === '390' && r.headerWidth != null && r.headerWidth > 392) ||
    (r.viewport === '390' && r.scrollWidth != null && r.scrollWidth > 392 && !r.route.includes('/blog/')) ||
    (r.viewport === '1280' && r.overflowPx > 12) ||
    (r.viewport === '1280' &&
      r.route.includes('health-insurance') &&
      r.formLeftPct != null &&
      r.formLeftPct < 52 &&
      !r.route.includes('blog')) ||
    (r.viewport === '1280' &&
      r.deferredVisible &&
      r.leftColumnToFormGapPx != null &&
      r.leftColumnToFormGapPx > 120 &&
      r.leftColumnToFormGapPx < 250 &&
      !r.route.includes('/blog/')) ||
    (r.viewport === '1280' && (r.callTextOverflowPx ?? 0) > 1)
);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: report.length }, null, 2));
process.exit(0);
