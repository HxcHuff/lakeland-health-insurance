import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local']);

function walkHtml(dir = join(ROOT, 'blog'), out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

test('blog lead hero follows page H1 in DOM order', () => {
  for (const rel of walkHtml()) {
    if (rel === 'blog/index.html') continue;
    const html = readFileSync(resolve(ROOT, rel), 'utf8');
    if (!html.includes('class="lhi-lead-hero"')) continue;
    const h1 = html.search(/<h1\b/i);
    const lead = html.search(/class="lhi-lead-hero"/i);
    assert.ok(h1 >= 0, `${rel} includes an H1`);
    assert.ok(lead > h1, `${rel} renders lhi-lead-hero after the H1`);
  }
});
