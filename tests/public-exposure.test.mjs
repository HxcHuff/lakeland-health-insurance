import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REDIRECTS = readFileSync(join(ROOT, '_redirects'), 'utf8');
const ROBOTS = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const PLANS = readFileSync(join(ROOT, 'plans/index.html'), 'utf8');
const QUOTE = readFileSync(join(ROOT, 'quote/index.html'), 'utf8');
const ACA = readFileSync(join(ROOT, 'aca-health-insurance-lakeland-fl/index.html'), 'utf8');
const PRIVATE_MEDICAL = readFileSync(join(ROOT, 'private-medical-insurance/index.html'), 'utf8');
const SITE_TEMPLATE = readFileSync(join(ROOT, 'js/site-template.js'), 'utf8');
const SERVICE_WORKER = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const HOME = readFileSync(join(ROOT, 'index.html'), 'utf8');
const BLOG = readFileSync(join(ROOT, 'blog/index.html'), 'utf8');
const NETLIFY_IGNORE = readFileSync(join(ROOT, '.netlifyignore'), 'utf8');
const SITE_TEMPLATE_LOADER = '/js/site-template.js?v=20260816-coverage-options';

const RETIRED_FILES = [
  'blog/ads-manager-setup-checklist.html',
  'blog/campaign-funnel-ab-test.html',
  'blog/facebook-ad-copy-ab-test.html',
  'health-protector-guard/internal-link-anchor-suggestions.txt',
  'health-protector-guard/nav-snippet.html',
  'newsletter/email-newsletter.html',
];

const RETIRED_URL_PARTS = [
  'ads-manager-setup-checklist.html',
  'campaign-funnel-ab-test.html',
  'facebook-ad-copy-ab-test.html',
  'internal-link-anchor-suggestions.txt',
  'nav-snippet.html',
  'search-engine-from-zip',
  'email-newsletter.html',
];

function findDeployableFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) findDeployableFiles(full, out);
    else out.push(relative(ROOT, full));
  }
  return out;
}

function findDiscoveryFiles(dir, out = []) {
  const skippedDirs = new Set(['.git', '.claude', '.netlify', 'docs', 'netlify', 'node_modules', 'scripts', 'tests']);
  for (const name of readdirSync(dir)) {
    if (skippedDirs.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      findDiscoveryFiles(full, out);
      continue;
    }
    if (['.html', '.js', '.jsx'].includes(extname(name)) || name === 'sitemap.xml') out.push(full);
  }
  return out;
}

function createServiceWorkerFetchHarness(fetchImpl, cachedResponse) {
  let fetchHandler;
  const fetchCalls = [];
  const putCalls = [];
  const sandbox = {
    URL,
    fetch: async (...args) => {
      fetchCalls.push(args);
      return fetchImpl(...args);
    },
    caches: {
      match: async () => cachedResponse,
      open: async () => ({
        addAll: async () => {},
        put: async (...args) => putCalls.push(args),
      }),
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      location: { origin: 'https://lakelandhealthinsurance.com' },
      addEventListener: (type, handler) => {
        if (type === 'fetch') fetchHandler = handler;
      },
      skipWaiting: () => {},
      clients: { claim: () => {} },
    },
  };

  runInNewContext(SERVICE_WORKER, sandbox);

  return {
    fetchCalls,
    putCalls,
    dispatch: async () => {
      let responsePromise;
      const request = {
        method: 'GET',
        url: `https://lakelandhealthinsurance.com${SITE_TEMPLATE_LOADER}`,
        headers: { get: () => 'application/javascript' },
      };
      fetchHandler({ request, respondWith: (promise) => { responsePromise = promise; } });
      return responsePromise;
    },
  };
}

test('retired operational and newsletter files are absent from the public tree', () => {
  for (const rel of RETIRED_FILES) assert.equal(existsSync(join(ROOT, rel)), false, rel);
  assert.deepEqual(findDeployableFiles(join(ROOT, 'search-engine-from-zip')), []);
});

test('retired operational pages return 410', () => {
  for (const url of [
    '/blog/ads-manager-setup-checklist.html',
    '/blog/campaign-funnel-ab-test.html',
    '/blog/facebook-ad-copy-ab-test.html',
  ]) {
    assert.match(REDIRECTS, new RegExp(`^${url.replaceAll('.', '\\.') }\\s+/404\\.html\\s+410$`, 'm'));
  }
});

test('quote-engine routes consolidate to Get Help while obsolete assets return 404', () => {
  for (const url of [
    '/search-engine-from-zip',
    '/search-engine-from-zip/',
    '/search-engine-from-zip/dist',
    '/search-engine-from-zip/dist/',
  ]) {
    assert.match(REDIRECTS, new RegExp(`^${url}\\s+/get-help/\\s+301!$`, 'm'));
  }
  assert.match(REDIRECTS, /^\/search-engine-from-zip\/\*\s+\/404\.html\s+404!$/m);
  assert.ok(existsSync(join(ROOT, 'get-help/index.html')));
  assert.ok(existsSync(join(ROOT, '404.html')));
});

test('retired newsletter artifact redirects to the public newsletter route', () => {
  assert.match(REDIRECTS, /^\/newsletter\/email-newsletter\.html\s+\/newsletter\/\s+301!$/m);
  assert.ok(existsSync(join(ROOT, 'newsletter/index.html')));
});

test('retired Health ProtectorGuard internal fragments return 404', () => {
  for (const url of [
    '/health-protector-guard/nav-snippet.html',
    '/health-protector-guard/internal-link-anchor-suggestions.txt',
  ]) {
    assert.match(REDIRECTS, new RegExp(`^${url.replaceAll('.', '\\.') }\\s+/404\\.html\\s+404!$`, 'm'));
    assert.ok(NETLIFY_IGNORE.split(/\r?\n/).includes(url.slice(1)), `${url} is excluded from deploy uploads`);
  }
});

test('robots permits crawlers to observe retirement responses', () => {
  for (const part of RETIRED_URL_PARTS) assert.doesNotMatch(ROBOTS, new RegExp(part.replaceAll('.', '\\.')));
});

test('retired URLs are absent from public discovery files and the sitemap', () => {
  for (const file of findDiscoveryFiles(ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const part of RETIRED_URL_PARTS) {
      assert.equal(source.includes(part), false, `${relative(ROOT, file)} references ${part}`);
    }
  }
  for (const part of RETIRED_URL_PARTS) assert.equal(SITEMAP.includes(part), false, part);
});

test('plans presents five one-click coverage choices with relevant limitations', () => {
  assert.equal((PLANS.match(/data-coverage-choice=/g) || []).length, 5);
  assert.match(PLANS, /data-coverage-choice="individual-family" href="\/aca-health-insurance-lakeland-fl\/"/);
  assert.match(PLANS, /data-coverage-choice="medicare" href="\/medicare\/"/);
  assert.match(PLANS, /data-coverage-choice="coverage-loss" href="\/losing-coverage\/"/);
  assert.match(PLANS, /data-coverage-choice="additional-coverage" href="\/supplemental-insurance\/"/);
  assert.match(PLANS, /data-coverage-choice="not-sure" href="\/get-help\/"/);
  assert.doesNotMatch(PLANS, /href="\/quote\/"/);
  assert.match(PLANS, /This is a fixed indemnity policy, NOT health insurance\./);

  const cmsFactSheet = 'https://www.cms.gov/newsroom/fact-sheets/short-term-limited-duration-insurance-and-independent-noncoordinated-excepted-benefits-coverage-cms';
  assert.match(PLANS, new RegExp(cmsFactSheet));
  assert.doesNotMatch(PLANS, /fixed-indemnity-excepted-benefits-coverage-notice\.pdf/);
  assert.match(PLANS, /"dateModified": "2026-08-16"/);
  assert.match(SITEMAP, /<loc>https:\/\/lakelandhealthinsurance\.com\/plans\/<\/loc>\s*<lastmod>2026-08-16<\/lastmod>/);
});

test('quote presents three direct actions without a routing form or plans detour', () => {
  assert.equal((QUOTE.match(/data-quote-action=/g) || []).length, 3);
  assert.match(QUOTE, /data-quote-action="aca-self-service"[^>]+href="https:\/\/www\.healthsherpa\.com\/\?_agent_id=david-huff-ngdu8q"/);
  assert.match(QUOTE, /data-funnel-external-quote data-analytics-label="quote_aca_self_service_compare"/);
  assert.doesNotMatch(QUOTE, /does not display every available qualified health plan/i);
  assert.match(QUOTE, /data-quote-action="medicare-review" href="\/get-help\/\?intent=medicare"/);
  assert.match(QUOTE, /data-quote-action="broker-review" href="\/get-help\/"/);
  assert.doesNotMatch(QUOTE, /<form\b|routerZip|routerCoverage|ZIP-prefix|coverage router|routing gate|verified pathway|verified next steps/i);
  assert.doesNotMatch(QUOTE, /href="\/plans\/"/);
  assert.equal(existsSync(join(ROOT, 'js/quote-router.js')), false);
  assert.match(QUOTE, /"dateModified": "2026-08-16"/);
  assert.match(SITEMAP, /<loc>https:\/\/lakelandhealthinsurance\.com\/quote\/<\/loc>\s*<lastmod>2026-08-16<\/lastmod>/);
});

test('ACA pricing CTA reaches the quote actions without legacy router language', () => {
  assert.match(ACA, /href="\/quote\/">Get pricing or start a review<\/a>/);
  assert.doesNotMatch(ACA, /coverage router/i);
  assert.match(ACA, /"dateModified": "2026-08-16"/);
  assert.match(SITEMAP, /<loc>https:\/\/lakelandhealthinsurance\.com\/aca-health-insurance-lakeland-fl\/<\/loc>\s*<lastmod>2026-08-16<\/lastmod>/);
});

test('private medical insurance route separates product categories and keeps intake privacy-minimized', () => {
  assert.match(PRIVATE_MEDICAL, /<link rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/private-medical-insurance\/">/);
  assert.match(PRIVATE_MEDICAL, /<h1>Private medical insurance options in Florida<\/h1>/);
  assert.match(PRIVATE_MEDICAL, /A plan purchased outside the Marketplace may still meet ACA standards\./);
  assert.match(PRIVATE_MEDICAL, /name="get-help"[^>]+data-sitelink-lead-form[^>]+data-funnel-track/);
  assert.match(PRIVATE_MEDICAL, /name="product_interest" value="comprehensive-private-coverage" required/);
  assert.match(PRIVATE_MEDICAL, /name="consent_request" value="yes" required/);
  assert.doesNotMatch(PRIVATE_MEDICAL, /name="(?:health|medical|diagnosis|condition|prescription|policy_number|payment)"/i);
  assert.match(SITEMAP, /<loc>https:\/\/lakelandhealthinsurance\.com\/private-medical-insurance\/<\/loc>\s*<lastmod>2026-08-21<\/lastmod>/);
});

test('coverage pages preserve canonicals, schema identifiers, analytics, and shared navigation naming', () => {
  assert.match(PLANS, /<link rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/plans\/">/);
  assert.match(QUOTE, /<link rel="canonical" href="https:\/\/lakelandhealthinsurance\.com\/quote\/">/);
  assert.match(PLANS, /https:\/\/lakelandhealthinsurance\.com\/plans\/#webpage/);
  assert.match(QUOTE, /https:\/\/lakelandhealthinsurance\.com\/quote\/#webpage/);
  assert.match(PLANS, /\/js\/analytics\.js\?v=20260821-lead-reconciliation/);
  assert.match(QUOTE, /\/js\/analytics\.js\?v=20260821-lead-reconciliation/);
  assert.equal((SITE_TEMPLATE.match(/\['\/plans\/', 'Coverage Options'\]/g) || []).length, 2);
  assert.match(SITE_TEMPLATE, /<a href="\/plans\/">Coverage Options<\/a>/);
  assert.doesNotMatch(SITE_TEMPLATE, /['"]Plan Types['"]/);
  assert.doesNotMatch(HOME, /<a href="\/plans\/">Plan Types<\/a>/);
  assert.doesNotMatch(BLOG, /<a href="\/plans\/">Plan Types<\/a>/);

  const templateConsumers = findDiscoveryFiles(ROOT).filter((file) => {
    return extname(file) === '.html' && readFileSync(file, 'utf8').includes('/js/site-template.js');
  });
  assert.equal(templateConsumers.length, 149);
  for (const file of templateConsumers) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes(SITE_TEMPLATE_LOADER), true, `${relative(ROOT, file)} uses the current shared-template release`);
    assert.equal(source.includes('/js/site-template.js?v=20260803-brand-release'), false, `${relative(ROOT, file)} does not use the retired shared-template release`);
  }
  for (const rel of ['lp/aca/index.html', 'lp/medicare/index.html']) {
    const source = readFileSync(join(ROOT, rel), 'utf8');
    assert.equal(source.includes('/js/site-template.js'), false, `${rel} owns focused paid-page chrome`);
  }

  assert.match(SERVICE_WORKER, /const CACHE_NAME = 'lhi-20260816-coverage-options';/);
  assert.match(SERVICE_WORKER, /const SITE_TEMPLATE_URL = '\/js\/site-template\.js\?v=20260816-coverage-options';/);
  assert.match(SERVICE_WORKER, /requestUrl\.pathname === '\/js\/site-template\.js'/);
  assert.match(SERVICE_WORKER, /fetchSharedTemplate\(request\)/);
});

test('shared-template fetch uses cached navigation for HTTP and network failures', async () => {
  const cachedResponse = { source: 'cache' };
  const httpErrorHarness = createServiceWorkerFetchHarness(async () => ({ ok: false, status: 503 }), cachedResponse);
  assert.equal(await httpErrorHarness.dispatch(), cachedResponse);
  assert.equal(httpErrorHarness.fetchCalls[0][1].cache, 'no-cache');

  const rejectedHarness = createServiceWorkerFetchHarness(async () => { throw new Error('offline'); }, cachedResponse);
  assert.equal(await rejectedHarness.dispatch(), cachedResponse);

  const networkResponse = { ok: true, clone: () => ({ source: 'network-clone' }) };
  const successHarness = createServiceWorkerFetchHarness(async () => networkResponse, cachedResponse);
  assert.equal(await successHarness.dispatch(), networkResponse);
  assert.equal(successHarness.putCalls.length, 1);
});

test('audit source and runtime evidence stay outside the public Netlify boundary', () => {
  for (const path of ['audit/', '.audit-data/']) {
    assert.ok(NETLIFY_IGNORE.split(/\r?\n/).includes(path), `${path} is excluded from deploy uploads`);
  }
  assert.match(REDIRECTS, /^\/audit\/\*\s+\/404\.html\s+404!$/m);
  assert.match(REDIRECTS, /^\/\.audit-data\/\*\s+\/404\.html\s+404!$/m);
});
