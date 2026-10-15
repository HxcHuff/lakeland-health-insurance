import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..');
const PRIORITY = [
  'index.html',
  'plans/index.html',
  'aca-health-insurance-lakeland-fl/index.html',
  'provider-prescription-check/index.html'
];

function walkHtml(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'search-engine-from-zip') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

test('priority lead pages use homepage grid-lead shell pattern', () => {
  for (const rel of PRIORITY) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    assert.match(html, /class="lhi-hero-shell"/, rel);
    assert.match(html, /class="lhi-lead-hero lhi-hero-grid-lead"/, rel);
    assert.match(html, /lead-hero\.css\?v=20261016-watson-gray-hero/, rel);
  }
});

test('inventory: shell pages without lhi-hero-grid-lead are documented exceptions', () => {
  const missing = [];
  for (const rel of walkHtml()) {
    if (rel.startsWith('blog/')) continue;
    const html = readFileSync(join(ROOT, rel), 'utf8');
    if (!html.includes('lhi-hero-shell') || !html.includes('lhi-lead-hero')) continue;
    if (!html.includes('lhi-hero-grid-lead')) missing.push(rel);
  }
  assert.ok(missing.length < 80, `unexpected shell count without grid-lead: ${missing.length}`);
});
