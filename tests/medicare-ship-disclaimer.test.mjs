import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OLD_TPMO = 'Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';
const SHIP_TPMO = 'Please contact Medicare.gov, 1-800-MEDICARE, or your local State Health Insurance Program (SHIP) to get information on all of your options.';
const FULL_SHIP = `We do not offer every plan available in your area. Currently we represent 8 organizations which offer 65 products in your area. ${SHIP_TPMO}`;
const SKIP_DIRS = new Set([
  '.ai-worker-local',
  '.git',
  '.netlify',
  '.playwright-cli',
  '.playwright-mcp',
  'node_modules',
  'output',
  'search-engine-from-zip'
]);

const MEDICARE_SHIP_PAGES = [
  'medicare/index.html',
  'medicare/east-polk/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'medicare-part-d-lakeland-fl/index.html',
  'working-past-65-medicare-lakeland-fl/index.html',
  'moving-florida-medicare/index.html',
  'lp/medicare/index.html',
  'local-health-insurance-answers/medicare-plan-help-lakeland/index.html',
  'blog/aep-2026-polk-county-checklist.html',
  'blog/do-i-need-part-b-with-employer-insurance.html',
  'blog/does-medicare-cover-dental-vision-hearing.html',
  'blog/florida-insurance-guide.html',
  'blog/good-shepherd-hospice-lakeland-medicare.html',
  'blog/how-to-read-health-insurance-card-guide.html',
  'blog/how-does-medicare-work-with-an-hsa.html',
  'blog/keep-doctor-switch-medicare-plans-florida.html',
  'blog/lakeland-va-clinic-medicare.html',
  'blog/medicare-advantage-lakeland-2026.html',
  'blog/medicare-advantage-plan-ending-what-now.html',
  'blog/medicare-advantage-vs-medicare-supplement.html',
  'blog/medicare-extra-help-savings-programs-polk-county.html',
  'blog/medicare-for-dummies.html',
  'blog/medicare-part-b-giveback-polk-county.html',
  'blog/city-of-lakeland-retiree-medicare-spouse-premium.html',
  'blog/medicare-supplement-cost-lakeland.html',
  'blog/medicare-vs-aca-central-florida-age-65.html',
  'blog/medigap-plan-g-vs-plan-n.html',
  'blog/orlando-health-polk-county-expansion-2026.html',
  'blog/orlando-health-watson-clinic-insurance-2026.html',
  'blog/penalty-for-signing-up-for-medicare-late.html',
  'blog/switch-medicare-advantage-back-to-original-medicare.html',
  'blog/turning-65-medicare-checklist-florida.html',
  'blog/when-can-i-switch-medicare-plans-florida.html',
  'blog/when-to-sign-up-for-medicare-if-still-working.html',
  'provider-prescription-check/index.html'
];

const NON_MEDICARE_KEEP_OLD = [
  'about/index.html',
  'coverage-center/index.html',
  'davenport-health-insurance/index.html',
  'index.html',
  'privacy-policy.html',
  'quote/index.html',
  'terms/index.html',
  'data-deletion/index.html',
  'blog/zip-code-health-insurance-pricing-florida.html',
  'blog/winter-haven-hospital-insurance.html'
];

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

function loadChrome() {
  const sandbox = {
    Intl,
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: { getAttribute() { return ''; } }
    },
    location: { pathname: '/', search: '' },
    localStorage: { getItem() { return null; }, setItem() {} },
    window: {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source('js/site-template.js'), sandbox, { filename: 'site-template.js' });
  return sandbox.LHISiteChrome;
}

test('Medicare hubs, landers, and Medicare blogs reuse the approved SHIP TPMO sentence', () => {
  for (const rel of MEDICARE_SHIP_PAGES) {
    const html = source(rel);
    assert.ok(html.includes(FULL_SHIP), `${rel} includes the approved SHIP TPMO sentence`);
    assert.ok(html.includes('8 organizations which offer 65 products'), `${rel} keeps 8/65`);
    assert.doesNotMatch(html, /State Health Insurance Assistance Program \(SHIP\)/);
    assert.doesNotMatch(html, /HealthMarkets/i);
  }
});

test('Get Help Medicare form uses SHIP while the mixed footer keeps the older TPMO sentence', () => {
  const html = source('get-help/index.html');
  assert.match(
    html,
    new RegExp(`id="medicareTpmoDisclaimer">${FULL_SHIP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  );
  const footer = html.slice(html.lastIndexOf('<footer'));
  assert.ok(footer.includes(OLD_TPMO), 'mixed Get Help footer keeps the non-SHIP sentence');
  assert.ok(!footer.includes(SHIP_TPMO), 'mixed Get Help footer does not invent SHIP');
});

test('non-Medicare TPMO pages do not invent a SHIP line', () => {
  for (const rel of NON_MEDICARE_KEEP_OLD) {
    const html = source(rel);
    assert.ok(html.includes(OLD_TPMO), `${rel} keeps the non-SHIP TPMO sentence`);
    assert.equal(html.includes(SHIP_TPMO), false, `${rel} does not add SHIP`);
  }
});

test('shared chrome uses SHIP only on Medicare paths', () => {
  const chrome = loadChrome();
  assert.equal(chrome.shouldUseShipDisclaimer('/medicare/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/medicare-broker-lakeland-fl/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/medicare-part-d-lakeland-fl/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/blog/when-can-i-switch-medicare-plans-florida.html'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/blog/do-i-need-part-b-with-employer-insurance.html'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/'), false);
  assert.equal(chrome.shouldUseShipDisclaimer('/coverage-center/'), false);
  assert.equal(chrome.shouldUseShipDisclaimer('/blog/winter-haven-hospital-insurance.html'), false);
  assert.equal(chrome.shouldUseShipDisclaimer('/aca-health-insurance-lakeland-fl/'), false);
});

test('SHIP wording never uses the rejected Assistance Program name', () => {
  for (const rel of walkHtml()) {
    assert.doesNotMatch(
      source(rel),
      /State Health Insurance Assistance Program \(SHIP\)/,
      `${rel} must not use Assistance Program SHIP wording`
    );
  }
});
