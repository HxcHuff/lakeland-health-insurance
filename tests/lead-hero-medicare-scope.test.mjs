import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import {
  acaLeadFormIncludesMedicareCoverageOptions,
  extractSiteAcaLeadFormHtml,
  shouldShowOutOfStateMedicareNote,
  MEDICARE_SCOPE_NOTE_MARKUP
} from '../scripts/lib/lead-hero-medicare-scope.mjs';
import { buildLeadHeroHtml } from '../scripts/lib/lead-hero-html.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local']);

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(ROOT, full).replace(/\\/g, '/'));
  }
  return out;
}

test('mixed ACA lead generator includes Medicare scope note markup', () => {
  const html = buildLeadHeroHtml({
    variant: 'aca',
    formName: 'site-aca-lead',
    sourceTemplate: 'blog_post',
    sourcePage: '/blog/example.html',
    idPrefix: 'example',
    funnelName: 'site_blog_aca_lead',
    coverageOptions: 'aca_medicare_mixed'
  });
  assert.match(html, /name="site-aca-lead"/);
  assert.match(html, /value="medicare_advantage"/);
  assert.match(html, /id="outOfStateMedicareNote"/);
});

test('shouldShowOutOfStateMedicareNote respects mixed-form Medicare selection', () => {
  assert.equal(
    shouldShowOutOfStateMedicareNote({
      coverageValue: 'individual_marketplace',
      stateCode: 'CA',
      hasMixedMedicareMarketplaceOptions: true
    }),
    false
  );
  assert.equal(
    shouldShowOutOfStateMedicareNote({
      coverageValue: 'medicare_advantage',
      stateCode: 'CA',
      hasMixedMedicareMarketplaceOptions: true
    }),
    true
  );
  assert.equal(
    shouldShowOutOfStateMedicareNote({
      coverageValue: '',
      stateCode: 'CA',
      hasMixedMedicareMarketplaceOptions: false
    }),
    true
  );
  assert.equal(
    shouldShowOutOfStateMedicareNote({
      coverageValue: 'medicare_advantage',
      stateCode: 'FL',
      hasMixedMedicareMarketplaceOptions: true
    }),
    false
  );
});

test('lead-hero.js wires Medicare coverage selection for mixed site-aca-lead forms', () => {
  const source = readFileSync(resolve(ROOT, 'js/lead-hero.js'), 'utf8');
  assert.match(source, /wireMedicareScopeCoverageSelects/);
  assert.match(source, /formHasMixedMedicareMarketplaceOptions/);
  assert.match(source, /select\[name="coverage_status"\]/);
});

test('every qualifying site-aca-lead page includes Medicare scope note markup', () => {
  const qualifying = [];
  for (const rel of walkHtml()) {
    const page = readFileSync(resolve(ROOT, rel), 'utf8');
    if (!page.includes('name="site-aca-lead"')) continue;
    const form = extractSiteAcaLeadFormHtml(page);
    if (!acaLeadFormIncludesMedicareCoverageOptions(form)) continue;
    qualifying.push(rel);
    assert.match(
      form,
      /id="outOfStateMedicareNote"/,
      `${rel} site-aca-lead form with Medicare options missing outOfStateMedicareNote`
    );
    assert.ok(form.includes(MEDICARE_SCOPE_NOTE_MARKUP.trim()), `${rel} missing canonical scope note copy`);
  }
  assert.ok(
    qualifying.includes('blog/orlando-health-watson-clinic-insurance-2026.html'),
    'Watson insurance blog must be in qualifying ACA+Medicare lead list'
  );
});
