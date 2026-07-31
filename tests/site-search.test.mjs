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
