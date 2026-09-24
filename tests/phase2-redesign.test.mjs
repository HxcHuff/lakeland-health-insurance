import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

function loadChrome() {
  const sandbox = {
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: { getAttribute() { return ''; } }
    },
    location: { pathname: '/' },
    localStorage: {
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

test('shared chrome maps Medicare, under-65, and losing-coverage pages to intent-aware Get Help URLs', () => {
  const chrome = loadChrome();
  assert.equal(chrome.resolveIntent('/medicare/'), 'medicare');
  assert.equal(chrome.resolveIntent('/medicare-broker-lakeland-fl/'), 'medicare');
  assert.equal(chrome.resolveIntent('/blog/turning-65-medicare-checklist-florida.html'), 'medicare');
  assert.equal(chrome.resolveIntent('/aca-health-insurance-lakeland-fl/'), 'under-65');
  assert.equal(chrome.resolveIntent('/tampa-health-insurance/'), 'under-65');
  assert.equal(chrome.resolveIntent('/losing-coverage/'), 'losing-coverage');
  assert.equal(chrome.resolveIntent('/'), '');
  assert.equal(chrome.resolveIntent('/coverage-center/'), '');
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
  assert.equal(chrome.shouldShowSeasonalBanner('/lp/medicare/'), false);
  assert.equal(chrome.shouldShowSeasonalBanner('/'), true);
  assert.match(SITE_TEMPLATE, /Medicare Annual Enrollment is <strong>Oct 15–Dec 7<\/strong>/);
  assert.match(SITE_TEMPLATE, /A review is not enrollment/);
  assert.match(SITE_TEMPLATE, /seasonal-banner-dismiss/);
  assert.match(SITE_TEMPLATE, /lhi-seasonal-banner-2026-aep-v1/);
  assert.doesNotMatch(SITE_TEMPLATE, /guarantee|enrolled automatically|#1|Florida Blue/i);
});

test('homepage publishes Person JSON-LD and a compact NAP proof strip', () => {
  assert.match(HOME, /"@type": "Person"/);
  assert.match(HOME, /"@id": "https:\/\/lakelandhealthinsurance.com\/about\/#david-huff"/);
  assert.match(HOME, /"jobTitle": "Licensed health insurance agent and broker"/);
  assert.match(HOME, /Florida License #W371813/);
  assert.match(HOME, /"postalCode": "33805"/);
  assert.doesNotMatch(HOME, /"@type": "AggregateRating"|reviewCount|"ratingValue"/);
  assert.match(HOME, /class="lhi-proof-strip"/);
  assert.match(HOME, /Licensed FL broker W371813/);
  assert.match(HOME, /Lakeland, FL 33805 · By appointment/);
  assert.doesNotMatch(HOME, /2298 Lakeland Hills|33801/);
});

test('Coverage Center keeps a proof strip, shorter hero, and secondary HealthSherpa only on the under-65 lane', () => {
  assert.match(COVERAGE_CENTER, /class="lhi-proof-strip"/);
  assert.match(COVERAGE_CENTER, /Licensed FL broker W371813/);
  assert.match(COVERAGE_CENTER, /class="hs-secondary"/);
  assert.match(COVERAGE_CENTER, /Secondary self-service during Marketplace Open Enrollment/);
  assert.match(COVERAGE_CENTER, new RegExp(HEALTHSHERPA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const under65 = COVERAGE_CENTER.slice(COVERAGE_CENTER.indexOf('id="under-65"'));
  const medicare = COVERAGE_CENTER.slice(COVERAGE_CENTER.indexOf('id="medicare"'), COVERAGE_CENTER.indexOf('id="under-65"'));
  assert.match(under65, /healthsherpa.com/);
  assert.doesNotMatch(medicare, /healthsherpa.com/);
  assert.match(COVERAGE_CENTER, TPMO);
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
  assert.match(GET_HELP_HTML, /id="healthSherpaSecondary"/);
  assert.match(GET_HELP_HTML, TPMO);
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
  }
  assert.doesNotMatch(MEDICARE, /class="hs-secondary"/);
  assert.doesNotMatch(MEDICARE, /Open HealthSherpa/);
});
