import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'output']);

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

test('page H1 precedes lhi-lead-hero in DOM order on every lead page', () => {
  for (const rel of walkHtml()) {
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    if (!html.includes('class="lhi-lead-hero"')) continue;
    const h1 = html.search(/<h1\b/i);
    const lead = html.search(/<section class="lhi-lead-hero[\s"]/i);
    assert.ok(h1 >= 0, `${rel} includes an H1`);
    assert.ok(lead > h1, `${rel} renders lhi-lead-hero after the H1`);
  }
});

test('non-blog lead pages with a hero shell keep hero before the form block', () => {
  for (const rel of walkHtml()) {
    if (rel.startsWith('blog/') && rel !== 'blog/index.html') continue;
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    const shellIdx = html.indexOf('lhi-hero-shell');
    if (shellIdx < 0) continue;
    const fromShell = html.slice(shellIdx);
    const hero = fromShell.search(
      /<section\b[^>]*class="[^"]*\b(?:home-hero|answer-hero)\b|<section class="hero\b/i,
    );
    const lead = fromShell.search(/<section class="lhi-lead-hero\b/i);
    if (lead < 0) continue;
    assert.ok(hero >= 0 && lead > hero, `${rel} hero shell orders page hero before lead form`);
  }
});
