import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { inspectSite } from '../scripts/check-site-integrity.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli',
  '.ai-worker-local', 'node_modules', 'output', 'netlify',
  'scripts', 'tests', 'search-engine-from-zip', 'audit'
]);

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

test('public HTML has no broken internal href or iframe targets', () => {
  const result = inspectSite({ root: ROOT });
  const linkIssues = result.issues.filter((issue) => issue.includes('missing target') || issue.includes('local-reference'));
  assert.deepEqual(linkIssues, [], linkIssues.join('\n'));
});

test('required contextual links and blog-index listings are present', () => {
  const required = [
    ['blog/aca-subsidy-cliff.html', '/aca-health-insurance-lakeland-fl/'],
    ['blog/aca-open-enrollment-deadline.html', '/aca-health-insurance-lakeland-fl/'],
    ['blog/turning-65-medicare-checklist-florida.html', '/medicare/'],
    ['blog/aep-2026-polk-county-checklist.html', '/medicare/'],
    ['blog/short-term-medical-guide.html', '/plans/'],
    ['blog/health-insurance-too-expensive-florida-2026-short-term-options.html', '/short-term-medical/'],
    ['blog/winter-haven-hospital-insurance.html', '/winter-haven-health-insurance/'],
    ['blog/adventhealth-haines-city.html', '/haines-city-health-insurance/'],
    ['blog/elon-health-urgent-care-davenport.html', '/davenport-health-insurance/'],
    ['blog/health-insurance-wesley-chapel-2026.html', '/wesley-chapel-health-insurance/'],
    ['blog/index.html', '/blog/medicare-supplement-cost-lakeland.html'],
    ['blog/index.html', '/blog/when-can-i-switch-medicare-plans-florida.html'],
    ['blog/index.html', '/blog/healthcare-gov-500-refund-checks-florida.html'],
    ['blog/index.html', '/blog/marketplace-plan-ending-2027-what-now.html'],
    ['blog/healthcare-gov-500-refund-checks-florida.html', '/blog/marketplace-plan-ending-2027-what-now.html'],
    ['blog/healthcare-gov-500-refund-checks-florida.html', '/get-help/'],
    ['blog/marketplace-plan-ending-2027-what-now.html', '/get-help/'],
    ['plans/index.html', '/quote/'],
    ['learning/index.html', '/quote/'],
    ['get-help/index.html', '/book/'],
    ['contact/index.html', '/book/']
  ];
  for (const [file, href] of required) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    assert.match(html, new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} links to ${href}`);
  }
});

test('booking page stays on-site and does not expose the third-party account string', () => {
  const html = readFileSync(join(ROOT, 'book/index.html'), 'utf8');
  assert.match(html, /id="booking-frame"/);
  assert.doesNotMatch(html, /src="\/book\/embed"/);
  assert.match(html, /\/js\/calendly-meta-schedule\.js\?v=20261005d/);
  assert.match(html, /Book a time with David/);
  assert.doesNotMatch(html, /healthmarkets/i);
  assert.doesNotMatch(html, /calendly\.com\/dhuff/i);
  assert.doesNotMatch(html, /\bfbq\s*\(|connect\.facebook\.net/i);

  for (const file of walkHtml()) {
    const rel = relative(ROOT, file);
    const source = readFileSync(file, 'utf8');
    const refs = [...source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const ref of refs) {
      assert.doesNotMatch(ref, /healthmarkets/i, `${rel} exposes a HealthMarkets URL`);
    }
  }
});
