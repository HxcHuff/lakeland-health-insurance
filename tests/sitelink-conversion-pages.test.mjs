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

const pages = [
  ['carriers/index.html', '/carriers/', 'not-sure'],
  ['supplemental-insurance/index.html', '/supplemental-insurance/', 'supplemental'],
  ['dental-vision/index.html', '/dental-vision/', 'dental-vision'],
  ['blog/index.html', '/blog/', 'under-65'],
  ['plans/index.html', '/plans/', 'not-sure'],
  ['medicare/index.html', '/medicare/', 'medicare']
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const [file, sourcePage, intent] of pages) {
  test(`${sourcePage} has a direct, consent-controlled lead form`, async () => {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    const match = html.match(/<form class="sitelink-lead-form"[\s\S]*?<\/form>/);
    assert.ok(match, `${file} includes the sitelink lead form`);
    const form = match[0];

    assert.match(form, /name="get-help"/);
    assert.match(form, /method="POST"/);
    assert.match(form, /action="\/thanks\.html"/);
    assert.match(form, /data-sitelink-lead-form/);
    assert.match(form, /data-funnel-event="Lead"/);
    assert.match(form, /name="full_name"[^>]*required/);
    assert.match(form, /name="zip_code"[^>]*required/);
    assert.match(form, /name="phone"/);
    assert.match(form, /name="email"[^>]*type="email"/);
    assert.match(form, /name="preferred_contact_method" value="Phone call" required/);
    assert.match(form, /name="preferred_contact_method" value="Text message"/);
    assert.match(form, /name="preferred_contact_method" value="Email"/);
    assert.match(form, /name="consent_request" value="yes" required/);
    assert.match(form, /name="started_at"/);
    assert.match(form, /name="human_check"/);
    assert.match(form, /name="utm_source"/);
    assert.match(form, /name="utm_medium"/);
    assert.match(form, /name="utm_campaign"/);
    assert.match(form, /name="utm_term"/);
    assert.match(form, /name="utm_content"/);
    assert.match(form, new RegExp(`name="source_page" value="${escapeRegex(sourcePage)}"`));
    assert.match(form, new RegExp(`name="normalized_intent" value="${escapeRegex(intent)}"`));
    assert.doesNotMatch(form, /<textarea/i);
    assert.doesNotMatch(form, /name="(?:notes|providers|prescriptions|current_plan|policy_number|medicare_number)"/i);
    assert.match(form, /Do not enter/i);
    assert.match(form, /Message frequency varies; message and data rates may apply/);
    assert.match(form, /Reply STOP to cancel or HELP for help/);

    assert.match(html, /\/css\/site-template\.css\?v=20260820-sitelink-leads/);
    assert.match(html, /\/js\/funnel\.js\?v=20260821-lead-reconciliation/);
  });
}

test('Medicare direct form preserves the approved hub attribution tuple', async () => {
  const html = await readFile(new URL('../medicare/index.html', import.meta.url), 'utf8');
  const form = html.match(/<form class="sitelink-lead-form"[\s\S]*?<\/form>/)[0];
  assert.match(form, /name="source_page_key" value="medicare"/);
  assert.match(form, /name="source_cta_key" value="start_review_hero"/);
});

test('shared site assets contain the sitelink lead form behavior and styles', async () => {
  const [script, css] = await Promise.all([
    readFile(new URL('../js/funnel.js', import.meta.url), 'utf8'),
    readFile(new URL('../css/site-template.css', import.meta.url), 'utf8')
  ]);
  assert.match(script, /function wireSitelinkLeadForms\(\)/);
  assert.match(script, /validateSitelinkContactPath/);
  assert.match(script, /consent_sms/);
  assert.match(script, /human_check/);
  assert.match(css, /\.sitelink-lead-form\s*{/);
  assert.match(css, /\.sitelink-contact-choice/);
  assert.match(css, /\.carrier-conversion-card\s*{[\s\S]*?grid-column:\s*1 \/ -1/);
  assert.match(css, /\.carrier-conversion-card > \.sitelink-lead-form\s*{[\s\S]*?grid-column:\s*2/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test('every public click-to-call link uses the verified E.164 target and tracked analytics loader', async () => {
  let phoneLinkCount = 0;
  for (const file of await publicHtmlFiles()) {
    const html = await readFile(file, 'utf8');
    const phoneTargets = [...html.matchAll(/href="(tel:[^"]+)"/g)].map((match) => match[1]);
    if (!phoneTargets.length) continue;

    phoneLinkCount += phoneTargets.length;
    for (const target of phoneTargets) assert.equal(target, 'tel:+18636403102', file);
    assert.match(
      html,
      /\/js\/analytics\.js\?v=(?:20260821-lead-reconciliation|20260823-meta-pageview-sitewide)/,
      `${file} loads the canonical phone telemetry and forwarding-number handler`
    );
  }
  assert.ok(phoneLinkCount > 0, 'public site includes click-to-call links');
});
