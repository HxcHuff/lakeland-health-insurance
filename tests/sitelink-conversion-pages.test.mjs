import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXCLUDED_DIRECTORIES = new Set([
  '.ai-worker-local',
  '.git',
  '.netlify',
  'node_modules',
  'output',
  'search-engine-from-zip'
]);

async function publicHtmlFiles(directory = ROOT) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) files.push(...await publicHtmlFiles(join(directory, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

const sitelinkPages = [
  ['medicare/index.html', '/medicare/', 'medicare']
];

const leadHeroPages = [
  ['carriers/index.html', '/carriers/', 'site-aca-lead', 'site-aca-2026-10-v1'],
  ['supplemental-insurance/index.html', '/supplemental-insurance/', 'site-aca-lead', 'site-aca-2026-10-v1'],
  ['dental-vision/index.html', '/dental-vision/', 'site-aca-lead', 'site-aca-2026-10-v1'],
  ['blog/index.html', '/blog/', 'site-aca-lead', 'site-aca-2026-10-v1'],
  ['plans/index.html', '/plans/', 'site-aca-lead', 'site-aca-2026-10-v1']
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [file, sourcePage, intent] of sitelinkPages) {
  test(`${sourcePage} keeps the sitelink lead form`, async () => {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const match = html.match(/<form class="sitelink-lead-form"[\s\S]*?<\/form>/);
    assert.ok(match, `${file} includes the sitelink lead form`);
    const form = match[0];

    assert.match(form, /name="get-help"/);
    assert.match(form, /data-sitelink-lead-form/);
    assert.match(form, /name="consent_text_version" value="get-help-2026-07-30-v1"/);
    assert.match(form, new RegExp(`name="source_page" value="${escapeRegex(sourcePage)}"`));
    assert.match(form, new RegExp(`name="normalized_intent" value="${escapeRegex(intent)}"`));
  });
}

for (const [file, sourcePage, formName, consentVersion] of leadHeroPages) {
  test(`${sourcePage} has a site lead hero form`, async () => {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const match = html.match(/<form class="lhi-lead-hero__form"[\s\S]*?<\/form>/);
    assert.ok(match, `${file} includes the site lead hero form`);
    const form = match[0];
    assert.match(form, new RegExp(`name="${formName}"`));
    assert.match(form, /data-lhi-site-lead-form/);
    assert.match(form, /data-funnel-event="Lead"/);
    assert.match(form, /name="full_name"[^>]*required/);
    assert.match(form, /name="phone"[^>]*required/);
    assert.match(form, /name="zip_code"[^>]*required/);
    assert.match(form, /name="coverage_status"[^>]*required/);
    assert.match(form, new RegExp(`name="consent_text_version" value="${consentVersion}"`));
    assert.match(form, new RegExp(`name="source_page" value="${escapeRegex(sourcePage)}"`));
    assert.match(form, /Reply STOP to cancel or HELP for help/);
    assert.doesNotMatch(form, /\bfree\b/i);
    assert.doesNotMatch(form, /no cost/i);
    assert.doesNotMatch(form, /\$0/);
    assert.match(html, /\/css\/lead-hero\.css\?v=20261021-hscroll-fix/);
    assert.match(html, /\/js\/lead-hero\.js\?v=20261021-hscroll-fix/);
  });
}

const acaSitelinkPages = [
  ['aca-health-insurance-lakeland-fl/index.html', '/aca-health-insurance-lakeland-fl/', 'aca_lakeland', 'aca'],
  ['aca-health-insurance-agent-polk-county-fl/index.html', '/aca-health-insurance-agent-polk-county-fl/', 'aca_polk_county', 'aca']
];

for (const [file, sourcePage, sourcePageKey, defaultIntent] of acaSitelinkPages) {
  test(`${sourcePage} has the short ACA sitelink lead form`, async () => {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const match = html.match(/<form class="sitelink-lead-form"[\s\S]*?<\/form>/);
    assert.ok(match, `${file} includes the sitelink lead form`);
    const form = match[0];

    assert.match(form, /name="get-help"/);
    assert.match(form, /data-sitelink-lead-form/);
    assert.match(form, /data-sitelink-coverage-choice/);
    assert.match(form, /name="consent_text_version" value="get-help-2026-07-30-v1"/);
    assert.match(form, new RegExp(`name="source_page" value="${escapeRegex(sourcePage)}"`));
    assert.match(form, new RegExp(`name="source_page_key" value="${escapeRegex(sourcePageKey)}"`));
    assert.match(form, new RegExp(`name="normalized_intent" value="${escapeRegex(defaultIntent)}"`));
    assert.doesNotMatch(form, /<textarea/i);
    assert.doesNotMatch(form, /tips and updates/i);
    assert.doesNotMatch(form, /\bfree\b/i);
    assert.doesNotMatch(form, /no cost/i);
    assert.doesNotMatch(form, /\$0/);
    assert.match(html, /Do not enter/i);
    assert.match(
      form,
      /<p class="sitelink-lead-privacy" data-sitelink-medicare-florida-note hidden>Medicare reviews are available for residents of Arizona, Florida, Texas, North Carolina, South Carolina, Kansas, Tennessee, Alabama and Georgia\.<\/p>/
    );

    assert.match(html, /\/js\/funnel\.js\?v=20261015-v6merge2/);
    assert.match(html, /\/css\/site-template\.css\?v=20261021-hscroll-fix/);
  });
}

test('funnel.js maps ACA sitelink coverage choices to intent fields', async () => {
  const script = await readFile(new URL('../js/funnel.js', import.meta.url), 'utf8');
  assert.match(script, /SITELINK_COVERAGE_MAP/);
  assert.match(script, /syncSitelinkCoverageChoice/);
  assert.match(script, /data-sitelink-coverage-choice/);
});

test('Medicare direct form preserves the approved hub attribution tuple', async () => {
  const html = await readFile(new URL('../medicare/index.html', import.meta.url), 'utf8');
  const form = html.match(/<form class="sitelink-lead-form"[\s\S]*?<\/form>/)[0];
  assert.match(form, /name="source_page_key" value="medicare"/);
  assert.match(form, /name="source_cta_key" value="start_review_hero"/);
});

test('shared site assets contain the sitelink lead form behavior and styles', async () => {
  const [script, css, leadCss] = await Promise.all([
    readFile(new URL('../js/funnel.js', import.meta.url), 'utf8'),
    readFile(new URL('../css/site-template.css', import.meta.url), 'utf8'),
    readFile(new URL('../css/lead-hero.css', import.meta.url), 'utf8')
  ]);
  assert.match(script, /function wireSitelinkLeadForms\(\)/);
  assert.match(script, /validateSitelinkContactPath/);
  assert.match(css, /\.sitelink-lead-form\s*{/);
  assert.match(leadCss, /\.lhi-lead-hero__fields/);
});

test('every public click-to-call link uses the verified E.164 target and tracked analytics loader', async () => {
  let phoneLinkCount = 0;
  for (const file of await publicHtmlFiles()) {
    const html = await readFile(file, 'utf8');
    const phoneTargets = [...html.matchAll(/href="(tel:[^"]+)"/g)].map((match) => match[1]);
    if (!phoneTargets.length) continue;

    phoneLinkCount += phoneTargets.length;
    const allowedPhoneTargets = new Set(['tel:+18636403102', 'tel:+18636403102']);
    for (const target of phoneTargets) {
      assert.ok(allowedPhoneTargets.has(target), `${file}: unexpected tel target ${target}`);
    }
    assert.match(
      html,
      /\/js\/analytics\.js\?v=20261015-v6merge2/,
      `${file} loads the canonical phone telemetry and forwarding-number handler`
    );
  }
  assert.ok(phoneLinkCount > 0, 'public site includes click-to-call links');
});
