import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TPMO_SNIPPET = '8 organizations which offer 65 products';
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

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

function isMultiState(rel) {
  return rel === 'states/index.html' || /^health-insurance-(alabama|arizona|georgia|iowa|indiana|louisiana|maryland|michigan|missouri|mississippi|north-carolina|nebraska|new-jersey|ohio|south-carolina|tennessee|texas|virginia|washington|west-virginia)\/index\.html$/.test(rel);
}

function bottomZoneIndex(html) {
  const footer = html.search(/<footer[\s>]/i);
  const disclosures = html.search(/class="site-page-disclosures"/);
  const footerTpmo = html.search(/class="footer-tpmo"/);
  const candidates = [footer, disclosures, footerTpmo].filter((idx) => idx >= 0);
  return candidates.length ? Math.min(...candidates) : html.length;
}

test('TPMO and compliance blocks are not duplicated inline near hero CTAs', () => {
  for (const rel of walkHtml()) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    if (!html.includes(TPMO_SNIPPET) || isMultiState(rel)) continue;

    assert.doesNotMatch(
      html,
      /class="tpmo-cta-disclaimer"/,
      `${rel} must not keep inline tpmo-cta-disclaimer (footer/bottom block only)`
    );

    const bottomStart = bottomZoneIndex(html);
    const tpmoIndexes = [];
    let searchFrom = 0;
    while (true) {
      const at = html.indexOf(TPMO_SNIPPET, searchFrom);
      if (at < 0) break;
      tpmoIndexes.push(at);
      searchFrom = at + 1;
    }
    assert.ok(tpmoIndexes.length >= 1, `${rel} keeps TPMO wording`);
    for (const at of tpmoIndexes) {
      assert.ok(
        at >= bottomStart,
        `${rel} renders TPMO in the bottom disclaimer zone, not inline with CTAs`
      );
    }
  }
});

test('local answer snippet links use high-contrast rules in shared CSS', () => {
  const css = readFileSync(join(ROOT, 'css/answer-pages.css'), 'utf8');
  assert.match(css, /\.answer-snippet a\s*{[^}]*color:\s*var\(--navy/s);
  for (const rel of [
    'local-health-insurance-answers/medicare-plan-help-lakeland/index.html',
    'local-health-insurance-answers/index.html',
    'local-health-insurance-answers/watson-clinic-insurance-network-help/index.html'
  ]) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    assert.match(html, /answer-pages\.css\?v=20261008-answer-snippet-hero-contrast/);
    assert.match(html, /class="answer-snippet"/);
  }
});

test('shared chrome strips inline TPMO duplicates at runtime', () => {
  const js = readFileSync(join(ROOT, 'js/site-template.js'), 'utf8');
  assert.match(js, /stripInlineDisclaimerDuplicates/);
  assert.match(js, /site-page-disclosures/);
});
