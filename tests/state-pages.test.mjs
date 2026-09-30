import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://lakelandhealthinsurance.com';
const SITEMAP = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const SITEMAP_INDEX = readFileSync(join(ROOT, 'sitemap_index.xml'), 'utf8');
const SITE_TEMPLATE = readFileSync(join(ROOT, 'js/site-template.js'), 'utf8');
const TPMO = 'We do not offer every plan available in your area. Currently we represent 10 organizations which offer 73 products in your area.';

const LIVE = [
  ['states/index.html', '/states/'],
  ['health-insurance-texas/index.html', '/health-insurance-texas/'],
  ['health-insurance-north-carolina/index.html', '/health-insurance-north-carolina/'],
  ['health-insurance-south-carolina/index.html', '/health-insurance-south-carolina/'],
  ['health-insurance-tennessee/index.html', '/health-insurance-tennessee/'],
  ['health-insurance-alabama/index.html', '/health-insurance-alabama/']
];

const ALL_STATE_HTML = [
  ...LIVE,
  ['health-insurance-georgia/index.html', '/health-insurance-georgia/']
];

function source(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1]));
}

test('sitemap index is a real XML index pointing at sitemap.xml, not a 404 page', () => {
  assert.match(SITEMAP_INDEX, /<sitemapindex\b/);
  assert.match(SITEMAP_INDEX, /<loc>https:\/\/lakelandhealthinsurance.com\/sitemap.xml<\/loc>/);
  assert.doesNotMatch(SITEMAP_INDEX, /<html\b/i);
  assert.doesNotMatch(SITEMAP_INDEX, /\b404\b/);
  assert.match(readFileSync(join(ROOT, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/lakelandhealthinsurance.com\/sitemap.xml/);
  assert.match(readFileSync(join(ROOT, '_headers'), 'utf8'), /\/sitemap_index\.xml/);
});

test('live hub and published FFE pages are indexable and listed in sitemap.xml', () => {
  for (const [rel, url] of LIVE) {
    const html = source(rel);
    assert.match(html, /<meta name="robots" content="index, follow">/);
    assert.match(SITEMAP, new RegExp(`<loc>${ORIGIN}${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>`));
    assert.equal(existsSync(join(ROOT, rel)), true);
  }
});

test('Georgia stays noindex, out of the sitemap, and unlinked from the hub, About, and site search', () => {
  const html = source('health-insurance-georgia/index.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(SITEMAP, /health-insurance-georgia/);
  assert.match(readFileSync(join(ROOT, '_headers'), 'utf8'), /\/health-insurance-georgia\/\n\s+X-Robots-Tag: noindex, nofollow/);
  assert.doesNotMatch(source('states/index.html'), /href="\/health-insurance-georgia\//);
  assert.doesNotMatch(source('about/index.html'), /href="\/health-insurance-georgia\//);
  assert.doesNotMatch(source('js/site-search.js'), /\/health-insurance-georgia\//);
  assert.doesNotMatch(source('states/index.html'), /Wave 1|Draft Georgia|Pending certification|page not live yet/i);
  assert.doesNotMatch(source('about/index.html'), /drafted page pending|Wave 1/);
});

test('shipped state pages, hub, About, and get-help do not contain visible [TODO placeholders', () => {
  for (const rel of [
    'states/index.html',
    'about/index.html',
    'get-help/index.html',
    'js/get-help-intake.js',
    'js/site-search.js',
    ...ALL_STATE_HTML.map(([rel]) => rel)
  ]) {
    assert.doesNotMatch(source(rel), /\[TODO|before publishing/, `${rel} still contains a placeholder or internal note`);
    assert.doesNotMatch(source(rel), /ffe_py2027_registration|individual_market_appointments|Confirmed September 30, 2026 from public NIPR/, `${rel} still contains an internal compliance comment`);
  }
});

test('state pages and the hub are ACA/under-65 only and do not ship Florida Medicare TPMO copy', () => {
  for (const [rel] of ALL_STATE_HTML) {
    const html = source(rel);
    assert.doesNotMatch(html, new RegExp(TPMO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(html, /footer-tpmo/);
    assert.doesNotMatch(html, /Medicare Advantage|Medigap|Part D|1-800-MEDICARE/i);
    assert.doesNotMatch(html, /HealthMarkets|Florida Blue/i);
    assert.doesNotMatch(html, /33801|2298 Lakeland Hills/);
    assert.doesNotMatch(html, /href="\/provider-prescription-check\//);
    assert.doesNotMatch(html, /I hold a Alabama/);
    assert.match(html, /licensed health agent/i);
    assert.match(html, /Lakeland, FL 33805/);
    assert.match(html, /under 65 who are not on Medicare/i);
  }
});

const STATE_LICENSES = [
  ['health-insurance-texas/index.html', 'Texas', '2414025'],
  ['health-insurance-north-carolina/index.html', 'North Carolina', '18213932'],
  ['health-insurance-south-carolina/index.html', 'South Carolina', '18213932'],
  ['health-insurance-tennessee/index.html', 'Tennessee', '2489827'],
  ['health-insurance-alabama/index.html', 'Alabama', '3000811681'],
  ['health-insurance-georgia/index.html', 'Georgia', '3329737']
];

test('state-page JSON-LD includes InsuranceAgency, Service areaServed, breadcrumbs, and matching FAQPage text', () => {
  for (const [rel, url] of ALL_STATE_HTML) {
    if (rel.startsWith('states/')) continue;
    const html = source(rel);
    const blocks = jsonLdBlocks(html);
    const graphDoc = blocks.find((block) => Array.isArray(block['@graph']));
    const faqDoc = blocks.find((block) => block['@type'] === 'FAQPage');
    assert.ok(graphDoc, `${rel} has an @graph block`);
    const types = graphDoc['@graph'].flatMap((node) => [].concat(node['@type']));
    assert.ok(types.includes('InsuranceAgency'), `${rel} includes InsuranceAgency`);
    assert.ok(types.includes('Person'), `${rel} includes Person`);
    const service = graphDoc['@graph'].find((node) => node['@type'] === 'Service');
    assert.equal(service?.areaServed?.['@type'], 'State');
    assert.ok(graphDoc['@graph'].some((node) => node['@type'] === 'BreadcrumbList'));
    assert.ok(faqDoc, `${rel} includes FAQPage`);
    for (const question of faqDoc.mainEntity) {
      const name = question.name;
      const text = question.acceptedAnswer.text;
      assert.ok(html.includes(name), `${rel} visible FAQ is missing ${name}`);
      assert.ok(html.includes(text), `${rel} FAQPage text does not match visible copy for ${name}`);
    }
    const georgiaService = service?.areaServed?.name === 'Georgia';
    if (georgiaService) {
      assert.equal(service.areaServed.sameAs, 'https://en.wikipedia.org/wiki/Georgia_(U.S._state)');
    }
    assert.match(html, new RegExp(`<link rel="canonical" href="${ORIGIN}${url}">`));
  }
});

test('state pages show the verified license, pair the brand with David Huff, and keep review CTAs', () => {
  for (const [rel, name, license] of STATE_LICENSES) {
    const html = source(rel);
    const pairing = `Lakeland Health Insurance, David Huff, licensed health agent, ${name} nonresident license #${license}.`;
    assert.match(html, new RegExp(`Licensed in ${name} \\(#${license}\\)\\.`));
    assert.ok(html.includes(pairing), `${rel} is missing the brand + licensed-name pairing`);
    assert.equal(html.split(pairing).length - 1, 2, `${rel} should pair brand and licensee in the byline and disclosure`);
    assert.match(html, new RegExp(`${name} nonresident license #${license} · NPN 18213932`));
    assert.match(html, new RegExp(`I hold an? ${name} nonresident license #${license}\\.`));
    assert.match(html, /Request a plan review/);
    assert.doesNotMatch(html, /Lakeland Health Insurance · Licensed in /);
    assert.doesNotMatch(html, /Restore a license|If this state has no individual-market|\[TODO|before publishing/);
    assert.doesNotMatch(html, /registered with HealthCare\.gov for plan year 2027|PY2027 HealthCare\.gov registration claim/);

    const graphDoc = jsonLdBlocks(html).find((block) => Array.isArray(block['@graph']));
    const person = graphDoc['@graph'].find((node) => node['@type'] === 'Person');
    const agency = graphDoc['@graph'].find((node) => node['@type'] === 'InsuranceAgency');
    const webpage = graphDoc['@graph'].find((node) => node['@type'] === 'WebPage');
    assert.equal(person?.name, 'David Huff');
    assert.equal(person?.jobTitle, 'Licensed health agent');
    assert.equal(person?.hasCredential?.['@type'], 'EducationalOccupationalCredential');
    assert.equal(person?.hasCredential?.name, `${name} nonresident license #${license}`);
    assert.equal(person?.identifier?.value, license);
    assert.match(webpage?.description || '', new RegExp(`#${license}`));
    assert.equal(agency?.hasCredential, undefined, `${rel} must not attach the license to the brand alone`);
  }
});

test('hub lists all 22 licensed states and routes Florida to existing pages', () => {
  const html = source('states/index.html');
  for (const name of [
    'Alabama', 'Arizona', 'Florida', 'Georgia', 'Iowa', 'Indiana', 'Kansas', 'Louisiana',
    'Maryland', 'Michigan', 'Missouri', 'Mississippi', 'North Carolina', 'Nebraska',
    'New Jersey', 'Ohio', 'South Carolina', 'Tennessee', 'Texas', 'Virginia',
    'Washington', 'West Virginia'
  ]) {
    assert.match(html, new RegExp(name));
  }
  assert.match(html, /href="\/aca-health-insurance-lakeland-fl\/"/);
  assert.match(html, /href="\/aca-health-insurance-agent-polk-county-fl\/"/);
  assert.doesNotMatch(html, /Medicare \(Florida only\)/);
  assert.doesNotMatch(html, /Medicare help remains on the Florida Medicare page/);
  assert.match(html, /This hub is for ACA Marketplace coverage for people under 65 who are not on Medicare/);
  assert.doesNotMatch(html, /href="\/health-insurance-florida\//);
  assert.doesNotMatch(html, /href="\/health-insurance-arizona\//);
  assert.doesNotMatch(html, /href="\/health-insurance-kansas\//);
  assert.doesNotMatch(html, /page not live yet|not live yet|PAGE NOT LIVE/i);
  const graph = jsonLdBlocks(html).find((block) => Array.isArray(block['@graph']));
  const collection = graph['@graph'].find((node) => node['@type'] === 'CollectionPage');
  assert.equal(collection.areaServed.length, 22);
  assert.ok(collection.areaServed.some((state) => state.name === 'Kansas'));
});

test('shared chrome skips TPMO and HealthSherpa on multi-state pages without changing Florida-only license wording', () => {
  const sandbox = {
    document: { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, body: { getAttribute() { return ''; } } },
    location: { pathname: '/', search: '' },
    window: {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SITE_TEMPLATE, sandbox, { filename: 'site-template.js' });
  const chrome = sandbox.LHISiteChrome;
  assert.equal(chrome.isMultiStatePage('/states/'), true);
  assert.equal(chrome.isMultiStatePage('/health-insurance-texas/'), true);
  assert.equal(chrome.isMultiStatePage('/health-insurance-broker-lakeland-fl/'), false);
  assert.equal(chrome.shouldShowTpmoDisclaimer('/health-insurance-alabama/'), false);
  assert.match(SITE_TEMPLATE, /States I'm licensed in/);
  assert.match(SITE_TEMPLATE, /Licensed Florida health agent #W371813/);
  assert.match(SITE_TEMPLATE, /Remote assistance across Florida/);
  assert.match(SITE_TEMPLATE, /Lakeland-based health insurance assistance for Florida residents/);
});

test('APTC, Medicaid-gap, and NC work-requirement copy match the approved verdict text', () => {
  const aptcFfe = 'For 2026 and 2027 coverage, premium tax credits are generally available only when household income is between 100% and 400% of the federal poverty level, and there is no cap on repaying excess advance credits at tax time. HealthCare.gov determines your eligibility.';
  const aptcGa = 'For 2026 and 2027 coverage, premium tax credits are generally available only when household income is between 100% and 400% of the federal poverty level, and there is no cap on repaying excess advance credits at tax time. Georgia Access determines your eligibility.';
  const repay = 'If your actual income is higher than your estimate, you must repay the excess advance credit when you file; for 2026 and later there is no repayment cap.';
  const ncWork = 'Federal law enacted in 2025 requires expansion states to add work or community-engagement requirements and more frequent eligibility checks for many expansion adults, beginning as early as January 2027. Check medicaid.ncdhhs.gov for how and when North Carolina applies them.';
  for (const rel of [
    'health-insurance-texas/index.html',
    'health-insurance-north-carolina/index.html',
    'health-insurance-south-carolina/index.html',
    'health-insurance-tennessee/index.html',
    'health-insurance-alabama/index.html'
  ]) {
    assert.ok(source(rel).includes(aptcFfe), `${rel} is missing the approved APTC sentence`);
    assert.doesNotMatch(source(rel), /full ACA Medicaid expansion|full Medicaid expansion/);
  }
  const texas = source('health-insurance-texas/index.html');
  const georgia = source('health-insurance-georgia/index.html');
  assert.ok(texas.includes(repay));
  assert.ok(georgia.includes(repay));
  assert.ok(georgia.includes(aptcGa));
  assert.ok(source('health-insurance-north-carolina/index.html').includes(ncWork));
  const medicaidFinal = 'Your state Medicaid agency makes the final eligibility decision.';
  for (const rel of [
    'health-insurance-texas/index.html',
    'health-insurance-north-carolina/index.html',
    'health-insurance-south-carolina/index.html',
    'health-insurance-tennessee/index.html',
    'health-insurance-alabama/index.html'
  ]) {
    assert.ok(source(rel).includes(medicaidFinal), `${rel} is missing the Medicaid agency final-decision source note`);
  }
  assert.ok(georgia.includes('Secondary source; Georgia DCH makes the final eligibility decision.'));
  for (const rel of [
    'health-insurance-texas/index.html',
    'health-insurance-north-carolina/index.html',
    'health-insurance-south-carolina/index.html',
    'health-insurance-tennessee/index.html',
    'health-insurance-alabama/index.html',
    'health-insurance-georgia/index.html'
  ]) {
    assert.doesNotMatch(source(rel), /None flagged in the September 30, 2026 Marketplace pass/);
    assert.doesNotMatch(source(rel), /as of August 21, 2026 \(secondary\)/);
    assert.doesNotMatch(source(rel), /Confirm NC Medicaid details before relying/);
  }
  assert.match(texas, /some adults with very low income may qualify for neither/);
  assert.match(source('health-insurance-alabama/index.html'), /some adults with very low income may qualify for neither/);
  assert.match(source('health-insurance-south-carolina/index.html'), /some adults with very low income may qualify for neither/);
  assert.match(source('health-insurance-tennessee/index.html'), /some adults with very low income may qualify for neither/);
});

test('hub cites official exchange sources and omits the unverified Maryland deadline', () => {
  const html = source('states/index.html');
  assert.match(html, /marketplace\.virginia\.gov\/how-enroll/);
  assert.match(html, /georgiaaccess\.gov\/wp-content\/uploads/);
  assert.match(html, /nj\.gov\/getcoverednj/);
  assert.match(html, /wahealthplanfinder\.org\/us\/en\/tools-and-resources\/health-care-education\/enrollment-periods\.html/);
  assert.match(html, /See Maryland Health Connection for 2027 dates/);
  assert.doesNotMatch(html, /Maryland Health Connection\. 2027 enrollment ends January 15, 2027/);
  assert.match(html, /I'm licensed in the states listed below\. The plans I can review depend on which insurers I'm appointed with in your state, which may not include every Marketplace insurer\./);
  assert.doesNotMatch(html, /appointed to discuss|appointed in the state where you live|I compare plans from the insurers I'm licensed in the states listed below/);
});

test('Georgia FAQ states the Access certification requirement without claiming David is certified', () => {
  const html = source('health-insurance-georgia/index.html');
  const required = 'An agent needs a Georgia license and Georgia Access certification for the plan year to help with a Georgia Access application. I hold a Georgia nonresident license #3329737. Reviews happen by phone and screen share. You keep your account login, and you approve any application or plan change.';
  assert.equal(html.split(required).length - 1, 2);
  assert.doesNotMatch(html, /Yes, as long as the agent holds a Georgia license\./);
  assert.doesNotMatch(html, /I am a Georgia Access-certified agent|I completed Georgia Access certification/i);
});

test('get-help allowlists coverage_state and treats non-Florida visitors as out-of-state', () => {
  const GET_HELP = source('js/get-help-intake.js');
  const sandbox = {
    document: {
      referrer: 'https://lakelandhealthinsurance.com/health-insurance-texas/',
      addEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    location: {
      pathname: '/get-help/',
      search: '?state=TX&intent=under-65',
      origin: 'https://lakelandhealthinsurance.com'
    },
    window: {},
    URL,
    URLSearchParams,
    String,
    Object,
    Date,
    btoa: (value) => Buffer.from(value).toString('base64')
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GET_HELP, sandbox, { filename: 'get-help-intake.js' });
  const intake = sandbox.LHIGetHelpIntake;
  assert.equal(intake.allowlistedCoverageState('TX'), 'TX');
  assert.equal(intake.allowlistedCoverageState('KS'), 'KS');
  assert.equal(intake.allowlistedCoverageState('ks'), 'KS');
  assert.equal(intake.allowlistedCoverageState('fl'), 'FL');
  assert.equal(intake.allowlistedCoverageState('XX'), '');
  assert.equal(intake.isNonFloridaCoverageState('TX'), true);
  assert.equal(intake.isNonFloridaCoverageState('KS'), true);
  assert.equal(intake.isNonFloridaCoverageState('FL'), false);
  assert.equal(intake.resolveCoverageState(new URLSearchParams('state=TX')), 'TX');
  assert.equal(intake.resolveCoverageState(new URLSearchParams('state=KS')), 'KS');
  assert.equal(intake.resolveCoverageState(new URLSearchParams('')), 'TX');
  assert.equal(intake.coverageStateFromReferrer('https://lakelandhealthinsurance.com/health-insurance-north-carolina/'), 'NC');
  assert.equal(intake.resolveCoverageState(new URLSearchParams('state=FL')), 'FL');
  assert.match(source('get-help/index.html'), /id="outOfStateMedicareNote"/);
  assert.match(source('get-help/index.html'), /id="floridaTpmoInventoryNote"/);
  assert.match(source('get-help/index.html'), /name="consent_text_version" value="get-help-2026-09-29-v2"/);
  assert.match(source('get-help/index.html'), /\.footer-tpmo\[hidden\] \{ display: none; \}/);
  assert.match(source('get-help/index.html'), /<p class="form-tpmo" id="outOfStateMedicareNote" hidden>Medicare reviews are available for Florida residents only\.<\/p>/);
});

test('public copy and search index say 22 licensed states and include Kansas', () => {
  assert.match(source('about/index.html'), /Licensed in 22 states for ACA Marketplace reviews/);
  assert.match(source('about/index.html'), /See all 22 states/);
  assert.match(source('about/index.html'), /Iowa, Indiana, Kansas, Louisiana/);
  assert.match(source('get-help/index.html'), /Licensed in 22 states/);
  assert.match(source('js/site-search.js'), /licensed in 22 states/);
  assert.match(source('index.html'), /licensed in 21 more states/);
  for (const rel of [
    'about/index.html',
    'get-help/index.html',
    'js/site-search.js',
    'index.html',
    'states/index.html',
    'js/site-template.js'
  ]) {
    assert.doesNotMatch(source(rel), /21 states|twenty-one|twenty one/i, `${rel} still says 21 states`);
  }
});
