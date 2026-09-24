import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_TEMPLATE = readFileSync(resolve(ROOT, 'js/site-template.js'), 'utf8');
const GET_HELP_HTML = readFileSync(resolve(ROOT, 'get-help/index.html'), 'utf8');
const GET_HELP_JS = readFileSync(resolve(ROOT, 'js/get-help-intake.js'), 'utf8');
const HOME = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const COVERAGE_CENTER = readFileSync(resolve(ROOT, 'coverage-center/index.html'), 'utf8');
const ACA = readFileSync(resolve(ROOT, 'aca-health-insurance-lakeland-fl/index.html'), 'utf8');
const POLK_ACA = readFileSync(resolve(ROOT, 'aca-health-insurance-agent-polk-county-fl/index.html'), 'utf8');
const MEDICARE = readFileSync(resolve(ROOT, 'medicare/index.html'), 'utf8');
const TPMO = 'We do not offer every plan available in your area. Currently we represent 10 organizations which offer 73 products in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options.';
const HEALTHSHERPA = 'https://www.healthsherpa.com/?_agent_id=david-huff-ngdu8q';
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'search-engine-from-zip',
  '.ai-worker-local',
  'output',
  '.netlify',
  '.playwright-mcp',
  '.playwright-cli'
]);
const IN_WINDOW = new Date('2026-10-15T16:00:00.000Z');

function loadChrome(options = {}) {
  const sandbox = {
    Intl: options.Intl || globalThis.Intl,
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: { getAttribute() { return ''; } }
    },
    location: { pathname: options.pathname || '/', search: options.search || '' },
    localStorage: options.localStorage || {
      getItem() { return null; },
      setItem() {}
    },
    window: {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SITE_TEMPLATE, sandbox, { filename: 'site-template.js' });
  return sandbox.LHISiteChrome;
}

function fileToPublicPath(rel) {
  const normalized = rel.replace(/\\/g, '/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) return `/${normalized.slice(0, -'index.html'.length)}`;
  return `/${normalized}`;
}

function walkHtmlFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkHtmlFiles(full, out);
      continue;
    }
    if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

function isMedicareIntentPage(rel, html, chrome) {
  if (/<meta\s+name=["']lhi-chrome-intent["']\s+content=["']medicare["']/i.test(html)) return true;
  return chrome.resolveIntent(fileToPublicPath(rel)) === 'medicare';
}

test('shared chrome maps Medicare, under-65, and losing-coverage pages to intent-aware Get Help URLs', () => {
  const chrome = loadChrome();
  assert.equal(chrome.resolveIntent('/medicare/'), 'medicare');
  assert.equal(chrome.resolveIntent('/medicare-broker-lakeland-fl/'), 'medicare');
  assert.equal(chrome.resolveIntent('/blog/turning-65-medicare-checklist-florida.html'), 'medicare');
  assert.equal(chrome.resolveIntent('/blog/aep-2026-polk-county-checklist.html'), 'medicare');
  assert.equal(chrome.resolveIntent('/blog/medigap-plan-g-vs-plan-n.html'), 'medicare');
  assert.equal(chrome.resolveIntent('/blog/medicare-advantage-lakeland-2026.html'), 'medicare');
  assert.equal(chrome.resolveIntent('/blog/florida-insurance-guide.html'), 'medicare');
  assert.equal(chrome.resolveIntent('/advantage-guard/'), '');
  assert.equal(chrome.resolveIntent('/aca-health-insurance-lakeland-fl/'), 'under-65');
  assert.equal(chrome.resolveIntent('/tampa-health-insurance/'), 'under-65');
  assert.equal(chrome.resolveIntent('/quote/'), '');
  assert.equal(chrome.resolveIntent('/losing-coverage/'), 'losing-coverage');
  assert.equal(chrome.resolveIntent('/'), '');
  assert.equal(chrome.resolveIntent('/coverage-center/'), '');
  assert.equal(chrome.resolveIntent('/get-help/', undefined, '?intent=medicare'), 'medicare');
  assert.equal(chrome.resolveIntent('/get-help/', undefined, '?intent=under-65'), 'under-65');
  const metaDoc = {
    querySelector(sel) {
      if (sel === 'meta[name="lhi-chrome-intent"]') {
        return { getAttribute() { return 'medicare'; } };
      }
      return null;
    },
    body: { getAttribute() { return ''; } }
  };
  assert.equal(chrome.resolveIntent('/blog/how-to-read-insurance-card.html', metaDoc), 'medicare');
  assert.equal(chrome.getHelpHref('medicare'), '/get-help/?intent=medicare');
  assert.equal(chrome.getHelpHref('under-65'), '/get-help/?intent=under-65');
  assert.equal(chrome.getHelpHref('losing-coverage'), '/get-help/?intent=losing-coverage');
  assert.equal(chrome.getHelpHref(''), '/get-help/');
});

test('HealthSherpa stays out of Medicare chrome and paid landing paths', () => {
  const chrome = loadChrome();
  assert.equal(chrome.shouldShowHealthSherpa('/medicare/', 'medicare'), false);
  assert.equal(chrome.shouldShowHealthSherpa('/lp/aca/', ''), false);
  assert.equal(chrome.shouldShowHealthSherpa('/aca-health-insurance-lakeland-fl/', 'under-65'), true);
  assert.equal(chrome.shouldShowHealthSherpa('/', ''), true);
});

test('seasonal banner is AEP-dated, dismissible, and avoids enrollment guarantees', () => {
  const chrome = loadChrome();
  assert.equal(chrome.bannerTimezone, 'America/New_York');
  assert.equal(chrome.bannerWindowStart.month, 10);
  assert.equal(chrome.bannerWindowStart.day, 1);
  assert.equal(chrome.bannerWindowEnd.month, 12);
  assert.equal(chrome.bannerWindowEnd.day, 7);
  assert.equal(chrome.shouldShowSeasonalBanner('/lp/medicare/', { now: IN_WINDOW, intent: 'medicare' }), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/', { now: IN_WINDOW }), true);
  assert.equal(chrome.shouldShowSeasonalBanner('/coverage-center/', { now: IN_WINDOW }), true);
  assert.equal(chrome.shouldShowSeasonalBanner('/medicare/', { now: IN_WINDOW, intent: 'medicare' }), true);
  assert.equal(chrome.shouldShowSeasonalBanner('/get-help/', { now: IN_WINDOW, intent: '' }), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/get-help/', { now: IN_WINDOW, intent: 'medicare' }), true);
  assert.equal(chrome.shouldShowSeasonalBanner('/aca-health-insurance-lakeland-fl/', { now: IN_WINDOW, intent: 'under-65' }), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/tampa-health-insurance/', { now: IN_WINDOW, intent: 'under-65' }), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/carriers/', { now: IN_WINDOW, intent: '' }), false);
  assert.match(SITE_TEMPLATE, /Medicare Annual Enrollment is <strong>Oct 15–Dec 7<\/strong>/);
  assert.match(SITE_TEMPLATE, /A review is not enrollment/);
  assert.match(SITE_TEMPLATE, /See Medicare enrollment dates/);
  assert.match(SITE_TEMPLATE, /href="\/medicare\/"/);
  assert.match(SITE_TEMPLATE, /seasonal-banner-dismiss/);
  assert.match(SITE_TEMPLATE, /lhi-seasonal-banner-aep-' \+ parts\.year \+ '-v1/);
  assert.equal(chrome.bannerStorageKey(IN_WINDOW), 'lhi-seasonal-banner-aep-2026-v1');
  const bannerCopy = SITE_TEMPLATE.slice(SITE_TEMPLATE.indexOf('createSeasonalBanner'), SITE_TEMPLATE.indexOf('function createFloatingActions'));
  assert.doesNotMatch(bannerCopy, /guarantee|enrolled automatically|Florida Blue/i);
  assert.doesNotMatch(bannerCopy, /#1\b/);
  assert.doesNotMatch(bannerCopy, /Request a Medicare review|Medicare review dates/);
});

test('seasonal banner dismiss key is scoped to the current AEP year', () => {
  const chrome = loadChrome();
  assert.equal(chrome.bannerStorageKey(new Date('2026-10-15T16:00:00.000Z')), 'lhi-seasonal-banner-aep-2026-v1');
  assert.equal(chrome.bannerStorageKey(new Date('2027-11-01T16:00:00.000Z')), 'lhi-seasonal-banner-aep-2027-v1');
  const dismissed = {
    getItem(key) { return key === 'lhi-seasonal-banner-aep-2026-v1' ? 'dismissed' : null; },
    setItem() {}
  };
  const dismissedChrome = loadChrome({ localStorage: dismissed });
  assert.equal(dismissedChrome.shouldShowSeasonalBanner('/', { now: new Date('2026-10-15T16:00:00.000Z') }), false);
  assert.equal(dismissedChrome.shouldShowSeasonalBanner('/', { now: new Date('2027-10-15T16:00:00.000Z') }), true);
});

test('seasonal banner date helpers hide the banner if timezone formatting fails', () => {
  const chrome = loadChrome({
    Intl: {
      DateTimeFormat() {
        throw new Error('timezone unavailable');
      }
    }
  });
  assert.equal(chrome.isWithinSeasonalBannerWindow(IN_WINDOW), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/', { now: IN_WINDOW }), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/medicare/', { now: IN_WINDOW, intent: 'medicare' }), false);
  assert.equal(chrome.bannerStorageKey(IN_WINDOW), '');
});

test('seasonal banner date window is Oct 1 through Dec 7 America/New_York', () => {
  const chrome = loadChrome();
  const samples = [
    ['2026-09-30T23:30:00-04:00', false],
    ['2026-10-01T00:30:00-04:00', true],
    ['2026-12-07T23:30:00-05:00', true],
    ['2026-12-08T00:30:00-05:00', false]
  ];
  for (const [iso, expected] of samples) {
    const now = new Date(iso);
    assert.equal(chrome.isWithinSeasonalBannerWindow(now), expected, `${iso} window`);
    assert.equal(chrome.shouldShowSeasonalBanner('/', { now }), expected, `${iso} homepage`);
    assert.equal(chrome.shouldShowSeasonalBanner('/medicare/', { now, intent: 'medicare' }), expected, `${iso} medicare`);
  }
});

test('homepage publishes Person JSON-LD and a compact NAP proof strip', () => {
  assert.match(HOME, /"@type": "Person"/);
  assert.match(HOME, /"@id": "https:\/\/lakelandhealthinsurance.com\/about\/#david-huff"/);
  assert.match(HOME, /"jobTitle": "Licensed health insurance agent and broker"/);
  assert.match(HOME, /Florida License #W371813/);
  assert.match(HOME, /"postalCode": "33805"/);
  assert.doesNotMatch(HOME, /"@type": "AggregateRating"|reviewCount|"ratingValue"/);
  assert.match(HOME, /class="lhi-proof-strip"/);
  assert.match(HOME, /Licensed Florida health agent W371813/);
  assert.match(SITE_TEMPLATE, /Licensed Florida health agent #W371813/);
  assert.match(HOME, /Lakeland, FL 33805 · By appointment/);
  assert.doesNotMatch(HOME, /2298 Lakeland Hills|33801/);
  assert.doesNotMatch(HOME, /The official website for Lakeland Health Insurance/);
});

test('Coverage Center keeps a proof strip, shorter hero, and secondary HealthSherpa only on the under-65 lane', () => {
  assert.match(COVERAGE_CENTER, /class="lhi-proof-strip"/);
  assert.match(COVERAGE_CENTER, /Licensed Florida health agent W371813/);
  assert.match(COVERAGE_CENTER, /class="hs-secondary"/);
  assert.match(COVERAGE_CENTER, /Secondary self-service during Marketplace Open Enrollment/);
  assert.match(COVERAGE_CENTER, new RegExp(HEALTHSHERPA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const under65 = COVERAGE_CENTER.slice(COVERAGE_CENTER.indexOf('id="under-65"'));
  const medicare = COVERAGE_CENTER.slice(COVERAGE_CENTER.indexOf('id="medicare"'), COVERAGE_CENTER.indexOf('id="under-65"'));
  assert.match(under65, /healthsherpa.com/);
  assert.doesNotMatch(medicare, /healthsherpa.com/);
  assert.match(COVERAGE_CENTER, new RegExp(TPMO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Get Help is a 3-step who/details/contact flow with preserved fields and SMS consent', () => {
  assert.match(GET_HELP_HTML, /1. Who \/ what/);
  assert.match(GET_HELP_HTML, /2. Details/);
  assert.match(GET_HELP_HTML, /3. Contact &amp; consent/);
  assert.match(GET_HELP_HTML, /Who is this request for\?/);
  assert.match(GET_HELP_HTML, /What details should David review\?/);
  assert.match(GET_HELP_HTML, /How should David follow up\?/);
  assert.match(GET_HELP_HTML, /Start my request/);
  assert.match(GET_HELP_HTML, /Book a time/);
  assert.match(GET_HELP_HTML, /863-640-3102/);
  assert.match(GET_HELP_HTML, /Reply STOP to cancel or HELP for help/);
  assert.match(GET_HELP_HTML, /name="consent_request"/);
  assert.match(GET_HELP_HTML, /name="need_timing"/);
  assert.match(GET_HELP_HTML, /id="optionalFields"/);
  assert.match(GET_HELP_HTML, /Optional details David can review before following up/);
  assert.match(GET_HELP_HTML, /id="optionalPrivacyNote"/);
  assert.doesNotMatch(GET_HELP_HTML, /id="optionalPrivacyNote" hidden/);
  assert.match(GET_HELP_JS, /privacyNote.hidden = false/);
  assert.match(GET_HELP_HTML, /id="healthSherpaSecondary"/);
  assert.match(GET_HELP_HTML, new RegExp(TPMO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(GET_HELP_HTML, /href="\/coverage-center\/">Coverage Center<\/a>/);
  assert.match(GET_HELP_JS, /HEALTHSHERPA_INTENTS/);
  assert.match(GET_HELP_JS, /healthSherpa.hidden = !hasOwn\(HEALTHSHERPA_INTENTS, intentKey\)/);
  const focusableStepHeadings = GET_HELP_HTML.match(/<h2[^>]*tabindex="-1"[^>]*>/g) || [];
  assert.equal(focusableStepHeadings.length, 3);
});

test('HealthSherpa is labeled secondary on under-65 and ACA surfaces, not as a Medicare enrollment path', () => {
  for (const [label, html] of [
    ['homepage', HOME],
    ['coverage center', COVERAGE_CENTER],
    ['ACA Lakeland', ACA],
    ['Polk ACA agent', POLK_ACA],
    ['Get Help', GET_HELP_HTML]
  ]) {
    assert.match(html, /healthsherpa.com\/\?_agent_id=david-huff-ngdu8q/, `${label} includes the existing agent link`);
    assert.match(html, /not Medicare enrollment/, `${label} says HealthSherpa is not Medicare enrollment`);
    assert.match(html, /HealthSherpa is a private enrollment site, not HealthCare\.gov\./, `${label} names HealthSherpa as private`);
  }
  assert.doesNotMatch(MEDICARE, /class="hs-secondary"/);
  assert.doesNotMatch(MEDICARE, /Open HealthSherpa/);
  assert.doesNotMatch(MEDICARE, /healthsherpa\.com/i);
});

test('Medicare-intent pages never include a HealthSherpa link', () => {
  const chrome = loadChrome();
  const offenders = [];
  for (const rel of walkHtmlFiles(ROOT)) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    if (!isMedicareIntentPage(rel, html, chrome)) continue;
    if (/healthsherpa\.com/i.test(html)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `HealthSherpa found on Medicare-intent pages: ${offenders.join(', ')}`);
  assert.match(readFileSync(resolve(ROOT, 'blog/aep-2026-polk-county-checklist.html'), 'utf8'), /name="lhi-chrome-intent" content="medicare"/);
  assert.match(readFileSync(resolve(ROOT, 'blog/medigap-plan-g-vs-plan-n.html'), 'utf8'), /name="lhi-chrome-intent" content="medicare"/);
  assert.match(readFileSync(resolve(ROOT, 'blog/florida-insurance-guide.html'), 'utf8'), /name="lhi-chrome-intent" content="medicare"/);
});
