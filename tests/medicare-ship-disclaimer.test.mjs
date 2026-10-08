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
  'blog/baycare-medicare-advantage-plans-2027-polk-county.html',
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
  'provider-prescription-check/index.html',
  'index.html'
];

const NON_MEDICARE_KEEP_OLD = [
  'about/index.html',
  'davenport-health-insurance/index.html',
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

function relToPathname(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function isMultiState(rel) {
  return rel === 'states/index.html' || /^health-insurance-(alabama|arizona|georgia|iowa|indiana|louisiana|maryland|michigan|missouri|mississippi|north-carolina|nebraska|new-jersey|ohio|south-carolina|tennessee|texas|virginia|washington|west-virginia)\/index\.html$/.test(rel);
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

test('homepage keeps SHIP TPMO in static bottom disclosures and sticky bar stays CTA-only', () => {
  const html = source('index.html');
  const disclosures = html.match(/class="site-page-disclosures"[\s\S]*?<\/section>/);
  assert.ok(disclosures, 'homepage exposes a bottom disclosure block');
  assert.ok(disclosures[0].includes(FULL_SHIP), 'homepage static disclosures use the approved SHIP TPMO sentence');
  assert.doesNotMatch(html, /class="tpmo-cta-disclaimer"/, 'homepage removes inline TPMO near CTAs');

  const sticky = html.match(/class="home-sticky-cta"[\s\S]*?<\/div>/);
  assert.ok(sticky, 'home sticky CTA block exists');
  assert.ok(!sticky[0].includes('tpmo-cta-disclaimer'), 'sticky bar does not duplicate TPMO disclaimer');
  assert.ok(sticky[0].includes('Review my coverage'), 'sticky bar keeps the coverage review CTA');
});

test('Get Help keeps Medicare TPMO in the bottom disclosure block', () => {
  const html = source('get-help/index.html');
  const disclosures = html.match(/class="site-page-disclosures"[\s\S]*?<\/section>/);
  assert.ok(disclosures, 'get-help exposes a bottom disclosure block');
  assert.match(
    disclosures[0],
    new RegExp(`id="medicareTpmoDisclaimer">${FULL_SHIP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  );
  assert.doesNotMatch(html, /class="tpmo-cta-disclaimer"/, 'get-help removes inline tpmo-cta-disclaimer class');
});

test('non-Medicare TPMO pages do not invent a SHIP line', () => {
  for (const rel of NON_MEDICARE_KEEP_OLD) {
    const html = source(rel);
    assert.ok(html.includes(OLD_TPMO), `${rel} keeps the non-SHIP TPMO sentence`);
    assert.equal(html.includes(SHIP_TPMO), false, `${rel} does not add SHIP`);
  }
});

test('shared chrome uses SHIP on Medicare and compliance HOLD paths', () => {
  const chrome = loadChrome();
  assert.equal(chrome.shouldUseShipDisclaimer('/medicare/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/medicare-broker-lakeland-fl/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/medicare-part-d-lakeland-fl/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/blog/when-can-i-switch-medicare-plans-florida.html'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/blog/do-i-need-part-b-with-employer-insurance.html'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/book/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/get-help/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/coverage-center/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/plans/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/lp/gap/'), true);
  assert.equal(chrome.shouldUseShipDisclaimer('/local-health-insurance-answers/'), true);
  assert.equal(
    chrome.shouldUseShipDisclaimer('/local-health-insurance-answers/watson-clinic-insurance-network-help/'),
    true
  );
  assert.equal(chrome.shouldUseShipDisclaimer('/blog/winter-haven-hospital-insurance.html'), false);
  assert.equal(chrome.shouldUseShipDisclaimer('/aca-health-insurance-lakeland-fl/'), false);
});

test('every static page mentioning Medicare includes the approved SHIP TPMO sentence', () => {
  const chrome = loadChrome();
  const skip = new Set(NON_MEDICARE_KEEP_OLD);
  for (const rel of walkHtml()) {
    if (skip.has(rel) || isMultiState(rel)) continue;
    const html = source(rel);
    if (!/\bMedicare\b/.test(html)) continue;
    if (!chrome.shouldUseShipDisclaimer(relToPathname(rel))) continue;
    assert.ok(html.includes(FULL_SHIP), `${rel} includes the approved SHIP TPMO sentence in static HTML`);
  }
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
