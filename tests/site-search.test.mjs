import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const SEARCH_SRC = readFileSync(resolve(ROOT, 'js/site-search.js'), 'utf8');

function loadSearch() {
  const sandbox = {
    document: {
      readyState: 'loading',
      addEventListener() {},
      querySelectorAll() { return []; }
    },
    Event: class Event {},
    window: { location: { href: 'http://localhost/blog/' } }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${SEARCH_SRC}\nglobalThis.TestSiteSearch = SiteSearch;`, sandbox, {
    filename: 'site-search.js'
  });
  return { sandbox, search: new sandbox.TestSiteSearch() };
}

test('ACA subsidy search returns the most relevant current article first', () => {
  const { search } = loadSearch();
  const results = search.search('aca subsidy');

  assert.ok(results.length > 0);
  assert.equal(results[0].url, '/blog/aca-subsidy-wrong-income-florida.html');
});

test('under-65 searches lead with the established ACA authority path', () => {
  const { search } = loadSearch();
  const results = search.search('under 65');

  assert.ok(results.length > 0);
  assert.equal(results[0].url, '/aca-health-insurance-lakeland-fl/');
});

test('individual and family searches lead with the established ACA authority path', () => {
  const { search } = loadSearch();
  const results = search.search('individual family coverage');

  assert.ok(results.length > 0);
  assert.equal(results[0].url, '/aca-health-insurance-lakeland-fl/');
});

test('under-65 life-event searches lead with their established scenario pages', () => {
  const { search } = loadSearch();

  assert.equal(search.search('losing coverage')[0].url, '/losing-coverage/');
  assert.equal(search.search('self-employed')[0].url, '/self-employed-health-insurance/');
  assert.equal(search.search('retiring before 65')[0].url, '/retiring-before-65-florida/');
});

test('Medicare search still leads to the dedicated Medicare journey', () => {
  const { search } = loadSearch();
  const results = search.search('medicare');

  assert.ok(results.length > 0);
  assert.equal(results[0].url, '/lp/medicare/');
});

test('every visible blog search suggestion returns an actionable result', () => {
  const { search } = loadSearch();

  for (const suggestion of [
    'individual family coverage',
    'lost job coverage',
    'self-employed',
    'doctors and networks',
    'prescriptions',
    'medicare'
  ]) {
    assert.ok(search.search(suggestion).length > 0, `${suggestion} returns at least one result`);
  }
});

test('customer-facing coverage labels avoid age-group shorthand', () => {
  const surfaces = [
    'aca-health-insurance-lakeland-fl/index.html',
    'quote/index.html',
    'plans/index.html',
    'health-protector-guard/index.html',
    'short-term-medical/index.html',
    'blog/health-insurance-clearwater-2026.html',
    'blog/college-student-health-insurance-lakeland.html',
    'blog/non-income-based-health-insurance-florida.html',
    'health-protector-guard/guard-5000/index.html',
    'health-protector-guard/guard-6000/index.html',
    'health-protector-guard/preferred-4000/index.html',
    'health-protector-guard/premier-5000/index.html',
    'health-protector-guard/select-2000/index.html'
  ];
  const forbidden = /Under 65 \/ ACA Marketplace|Under 65 major-medical coverage|>Under 65<|residents under 65|primary option under 65|childless adults under 65|Pre-Medicare bridge|Pre-Medicare enrollees|Early retirees pre-65/i;

  for (const surface of surfaces) {
    const source = readFileSync(resolve(ROOT, surface), 'utf8');
    assert.doesNotMatch(source, forbidden, `${surface} uses customer-ready coverage language`);
  }
});

test('Enter opens the first current result when no result is highlighted', () => {
  const { sandbox, search } = loadSearch();
  const resultItems = [
    { getAttribute: () => '/blog/aca-subsidy-wrong-income-florida.html' },
    { getAttribute: () => '/blog/aca-subsidy-tax-return-clawback.html' }
  ];
  const dropdown = {
    dataset: { searchQuery: 'aca subsidy' },
    querySelectorAll: () => resultItems
  };
  let prevented = false;

  search.handleKeyboard(
    { key: 'Enter', preventDefault: () => { prevented = true; } },
    dropdown,
    { value: 'ACA subsidy' }
  );

  assert.equal(prevented, true);
  assert.equal(sandbox.window.location.href, '/blog/aca-subsidy-wrong-income-florida.html');
});

test('a no-match query stays visible with actionable status text', () => {
  const { search } = loadSearch();
  const dropdown = { dataset: {}, style: {}, innerHTML: '' };

  search.handleSearch({ target: { value: 'zzzz-no-matching-article' } }, dropdown);

  assert.equal(dropdown.style.display, 'block');
  assert.match(dropdown.innerHTML, /role="status"/);
  assert.match(dropdown.innerHTML, /Try a broader search/);
});
