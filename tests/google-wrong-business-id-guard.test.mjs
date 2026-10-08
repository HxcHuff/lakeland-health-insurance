import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const FORBIDDEN = [
  'CfZarEhiTh1AEBM',
  '4619934976785013494',
  'g.page/r/',
];

const SKIP_DIRS = new Set([
  '.git', '.netlify', '.claude', '.codex', '.playwright-cli',
  '.ai-worker-local', 'node_modules', 'output', 'netlify',
  'scripts', 'tests', 'search-engine-from-zip', 'audit',
]);

function walkHtmlJs(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkHtmlJs(full, out);
      continue;
    }
    const ext = extname(name);
    if (ext === '.html' || ext === '.js') out.push(full);
  }
  return out;
}

test('HTML and JS must not contain wrong Google business identifiers', () => {
  const hits = [];
  for (const file of walkHtmlJs()) {
    const rel = relative(ROOT, file);
    const source = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN) {
      if (source.includes(needle)) hits.push(`${rel}: ${needle}`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `Wrong Google business identifiers found:\n${hits.join('\n')}`
  );
});
