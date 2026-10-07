import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { sanitizeAbVariant } from '../netlify/functions/lib/campaign-attribution.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function loadAbVariantHarness() {
  globalThis.window = {
    location: { protocol: 'https:', hostname: 'lakelandhealthinsurance.com', pathname: '/' },
    __LHI_TEST: true
  };
  globalThis.document = {
    cookie: '',
    readyState: 'complete',
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const src = readFileSync(join(ROOT, 'js/ab-variant.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', src)(globalThis.window, globalThis.document);
  return globalThis.window.LHIAbVariant;
}

test('sanitizeAbVariant accepts known ids and rejects junk', () => {
  assert.equal(sanitizeAbVariant('control'), 'control');
  assert.equal(sanitizeAbVariant('home-hero-primary-b'), 'home-hero-primary-b');
  assert.equal(sanitizeAbVariant('FREE!!!'), '');
  assert.equal(sanitizeAbVariant('a'.repeat(80)), '');
});

test('ab-variant resolves control by default and variant B from nf_ab', async () => {
  const mod = await loadAbVariantHarness();
  const t = mod._t;
  globalThis.document.cookie = '';
  assert.equal(t.resolveVariantId(), 'control');
  globalThis.document.cookie = 'nf_ab=split-b';
  assert.equal(t.resolveVariantId(), 'home-hero-primary-b');
});

test('ab-variant resolves variant B from branch deploy hostname', async () => {
  const mod = await loadAbVariantHarness();
  globalThis.window.location.hostname = 'split-b--lakelandhealthinsurance.netlify.app';
  globalThis.document.cookie = '';
  assert.equal(mod._t.resolveVariantId(), 'home-hero-primary-b');
});

test('lead allowlist includes ab_variant on get-help', () => {
  const leadSrc = readFileSync(join(ROOT, 'netlify/functions/lead.js'), 'utf8');
  assert.match(leadSrc, /'ab_variant'/);
  assert.match(leadSrc, /sanitizeAbVariantField/);
});
