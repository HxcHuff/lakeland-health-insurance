import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { checkRegistry } from '../scripts/check-regulated-claims.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const registry = JSON.parse(readFileSync(resolve(ROOT, 'data/regulated-claims.json'), 'utf8'));

test('regulated claim registry is current and every claim is cited', async () => {
  const result = await checkRegistry({ root: ROOT, registry, asOf: '2026-07-31' });
  assert.deepEqual(result.issues, []);
});

test('regulated claim checker rejects duplicate and stale claims', async () => {
  const fixture = structuredClone(registry);
  fixture.claims = [structuredClone(registry.claims[0]), structuredClone(registry.claims[0])];
  fixture.claims[0].accessDate = '2025-01-01';
  const result = await checkRegistry({ root: ROOT, registry: fixture, asOf: '2026-07-31' });
  assert.ok(result.issues.some((issue) => issue.includes('source review is stale')));
  assert.ok(result.issues.some((issue) => issue.includes('duplicate claim ID')));
});
