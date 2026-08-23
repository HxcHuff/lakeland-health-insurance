#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { checkRegistry } from './check-regulated-claims.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const registry = JSON.parse(readFileSync(resolve(ROOT, 'data/authority-entities.json'), 'utf8'));
const regulatedClaims = JSON.parse(readFileSync(resolve(ROOT, 'data/regulated-claims.json'), 'utf8'));
const priorityPages = [
  'index.html',
  'about/index.html',
  'aca-health-insurance-lakeland-fl/index.html',
  'medicare/index.html',
  'self-employed-health-insurance/index.html',
  'losing-coverage/index.html',
  'provider-prescription-check/index.html',
  'aca-subsidy-estimator/index.html',
  'get-help/index.html',
  'plans/index.html',
  'quote/index.html',
  'contact/index.html',
  'privacy-policy.html',
  'sms-policy.html'
];
const regulatedPages = [
  'aca-health-insurance-lakeland-fl/index.html',
  'medicare/index.html',
  'self-employed-health-insurance/index.html',
  'losing-coverage/index.html',
  'provider-prescription-check/index.html',
  'aca-subsidy-estimator/index.html',
  'retiring-before-65-florida/index.html',
  'losing-medicaid-florida/index.html',
  'moving-florida-medicare/index.html'
];
const workPackageThreePages = [
  'retiring-before-65-florida/index.html',
  'losing-medicaid-florida/index.html',
  'moving-florida-medicare/index.html',
  'blog/aca-subsidy-wrong-income-florida.html',
  'blog/medicare-vs-aca-central-florida-age-65.html'
];
const workPackageTwoPages = [
  'aca-health-insurance-lakeland-fl/index.html',
  'medicare/index.html',
  'self-employed-health-insurance/index.html',
  'losing-coverage/index.html',
  'provider-prescription-check/index.html',
  'get-help/index.html',
  'plans/index.html',
  'quote/index.html',
  'contact/index.html',
  'local-health-insurance-answers/index.html',
  'local-health-insurance-answers/health-insurance-broker-lakeland-fl/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'best-medicare-broker-lakeland-fl/index.html',
  'our-approach.html',
  'learning/index.html',
  'blog/index.html'
];
const workPackageTwoReviewedPages = [
  'local-health-insurance-answers/index.html',
  'local-health-insurance-answers/health-insurance-broker-lakeland-fl/index.html',
  'medicare-broker-lakeland-fl/index.html',
  'best-medicare-broker-lakeland-fl/index.html',
  'our-approach.html',
  'learning/index.html',
  'blog/index.html'
];
const prohibitedSchemaTypes = new Set([
  'Offer',
  'OfferCatalog',
  'AggregateRating',
  'Rating',
  'Review',
  'PostalAddress'
]);
const excludedCarrierPattern = /\b(?:Aetna|FL\s*Blue|Florida\s+Blue|Capital\s+(?:HP|Health\s+Plan)|Bright\s+Health|Medica|Wellmark|FL\s+Health)\b/i;
const siteTemplateLoaderPattern = /src=["']\/js\/site-template\.js(?:\?[^"']*)?["']/i;
const forbiddenClaims = [
  /coverage across the nation/i,
  /serving most of the united states/i,
  /serving families and businesses across the nation/i,
  /largest annual allowances/i
];
const forbiddenAuthorityCopy = [
  /TriTerm/i,
  /36 months/i,
  /Health ProtectorGuard/i,
  /Health Protector Guard/i,
  /Usually replies fast/i,
  /David answers personally/i,
  /BBB Accredited Business/i,
  /Active Florida LLC/i,
  /BBB Accredited since/i
];
const issues = [];
const requiredAuthorityDocs = [
  'docs/authority/lakeland-florida-authority-baseline.md',
  'docs/authority/entity-contract.md',
  'docs/authority/core-authority-page-map.md',
  'docs/authority/external-evidence-gates.md',
  'docs/authority/regulated-guide-map.md',
  'docs/authority/work-package-02-handoff.md',
  'docs/authority/work-package-03-handoff.md'
];
const requiredDeployExclusions = [
  '.audit-data/',
  'audit/',
  'data/',
  'docs/',
  'netlify/',
  'run/',
  'scripts/',
  'tests/',
  'AGENTS.md',
  '*.md',
  '*.mjs',
  '*.docx',
  '*.xlsx'
];

function flatten(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flatten(item, out));
  } else if (value && typeof value === 'object') {
    out.push(value);
    Object.values(value).forEach((item) => flatten(item, out));
  }
  return out;
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCurrentDateModified(html) {
  const dates = [...html.matchAll(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/g)].map((match) => match[1]);
  return dates.some((date) => date >= registry.reviewedDate);
}

function hasCurrentRegulatedSource(rel) {
  return regulatedClaims.claims.some((claim) =>
    claim.usedBy?.includes(rel) &&
    claim.sourceUrl &&
    claim.accessDate >= registry.reviewedDate &&
    ['approved', 'qualified'].includes(claim.reviewStatus)
  );
}

function expectedCanonical(rel) {
  if (rel === 'index.html') return 'https://lakelandhealthinsurance.com/';
  if (rel.endsWith('/index.html')) {
    return `https://lakelandhealthinsurance.com/${rel.slice(0, -'index.html'.length)}`;
  }
  return `https://lakelandhealthinsurance.com/${rel}`;
}

function hrefToLocalFile(rawHref) {
  if (!rawHref || /^(?:#|mailto:|tel:|sms:|javascript:)/i.test(rawHref)) return null;
  let url;
  try {
    url = new URL(rawHref, 'https://lakelandhealthinsurance.com/');
  } catch {
    return { error: `invalid href "${rawHref}"` };
  }
  if (url.origin !== 'https://lakelandhealthinsurance.com') return null;
  let pathname;
  try {
    pathname = decodeURI(url.pathname);
  } catch {
    return { error: `invalid encoded href "${rawHref}"` };
  }
  const clean = pathname.replace(/^\/+/, '');
  if (!clean) return { file: resolve(ROOT, 'index.html') };
  if (clean.endsWith('/')) return { file: resolve(ROOT, clean, 'index.html') };
  const extension = extname(clean).toLowerCase();
  if (!extension) return { file: resolve(ROOT, clean, 'index.html') };
  if (extension === '.html') return { file: resolve(ROOT, clean) };
  return null;
}

for (const rel of priorityPages) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  const text = visibleText(html);
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const graph = [];
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].replace(/&amp;/g, '&').trim() || '';
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (canonical !== expectedCanonical(rel)) {
    issues.push(`${rel}: canonical is "${canonical || 'missing'}"; expected "${expectedCanonical(rel)}"`);
  }
  if (title.length > 65) issues.push(`${rel}: title is ${title.length} characters (maximum 65)`);
  if (h1Count !== 1) issues.push(`${rel}: expected one H1; found ${h1Count}`);

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(match[1])) {
      issues.push(`${rel}: image missing alt attribute`);
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const target = hrefToLocalFile(match[1]);
    if (!target) continue;
    if (target.error) {
      issues.push(`${rel}: ${target.error}`);
    } else if (!existsSync(target.file) || !statSync(target.file).isFile()) {
      issues.push(`${rel}: internal link target does not exist (${match[1]})`);
    }
  }

  scripts.forEach((match, index) => {
    try {
      flatten(JSON.parse(match[1]), graph);
    } catch (error) {
      issues.push(`${rel}: JSON-LD block ${index + 1} is invalid (${error.message})`);
    }
  });

  const ids = new Set(graph.map((node) => node['@id']).filter(Boolean));
  const serialized = scripts.map((match) => match[1]).join('\n');
  if (!serialized.includes(registry.website['@id'])) {
    issues.push(`${rel}: missing canonical WebSite @id reference`);
  }
  if (!serialized.includes(registry.agency['@id'])) {
    issues.push(`${rel}: missing canonical agency @id reference`);
  }
  if (!serialized.includes(registry.person['@id'])) {
    issues.push(`${rel}: missing canonical David Huff @id reference`);
  }

  for (const pattern of forbiddenClaims) {
    if (pattern.test(text)) issues.push(`${rel}: unsupported claim matches ${pattern}`);
  }

  const faqNodes = graph.filter((node) => node['@type'] === 'Question' && node.name);
  for (const question of faqNodes) {
    if (!text.includes(question.name)) {
      issues.push(`${rel}: FAQ schema question is not visible: "${question.name}"`);
    }
  }

  if (rel === 'index.html' && !ids.has(registry.website['@id'])) {
    issues.push(`${rel}: homepage must define the canonical WebSite node`);
  }
  if (rel === 'index.html' && !ids.has(registry.agency['@id'])) {
    issues.push(`${rel}: homepage must define the canonical agency node`);
  }
  if (rel === 'about/index.html' && !ids.has(registry.person['@id'])) {
    issues.push(`${rel}: About page must define the canonical Person node`);
  }
}

for (const rel of requiredAuthorityDocs) {
  if (!existsSync(resolve(ROOT, rel))) issues.push(`${rel}: required authority document is missing`);
}

const netlifyIgnore = readFileSync(resolve(ROOT, '.netlifyignore'), 'utf8');
for (const exclusion of requiredDeployExclusions) {
  if (!netlifyIgnore.split(/\r?\n/).includes(exclusion)) {
    issues.push(`.netlifyignore: missing repository-internal deploy exclusion ${exclusion}`);
  }
}
const redirects = readFileSync(resolve(ROOT, '_redirects'), 'utf8');
for (const internalPath of ['/audit/*', '/.audit-data/*', '/docs/*', '/data/*', '/scripts/*', '/tests/*', '/netlify/*', '/run/*']) {
  if (!redirects.includes(`${internalPath} /404.html 404!`)) {
    issues.push(`_redirects: missing forced 404 boundary for ${internalPath}`);
  }
}
for (const internalFile of [
  '/AGENTS.md',
  '/ANALYTICS-TRACKING.md',
  '/MARKETING-ANALYSIS.md',
  '/README.md',
  '/SEO_INDEXING_CHANGELOG_2026-02-19.md',
  '/GA4-Audit-Correction-Plan.docx',
  '/UTM-Parameters-Final.xlsx',
  '/UTM-Parameters-Lead-Data.xlsx',
  '/netlify.toml'
]) {
  if (!redirects.includes(`${internalFile} /404.html 404!`)) {
    issues.push(`_redirects: missing forced 404 boundary for ${internalFile}`);
  }
}

if (registry.reviewedDate !== '2026-07-31') {
  issues.push('data/authority-entities.json: reviewedDate must match the current entity review');
}
if (registry.agency.relationshipToDavid !== 'Public-facing DBA led by David Huff') {
  issues.push('data/authority-entities.json: agency relationship to David is missing or inconsistent');
}
if (registry.agency.notInsuranceCarrier !== true) {
  issues.push('data/authority-entities.json: non-carrier boundary is missing');
}

const home = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const homeGraph = [];
for (const match of home.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  flatten(JSON.parse(match[1]), homeGraph);
}
const homeAgency = homeGraph.find((node) => node['@id'] === registry.agency['@id'] && node['@type'] === 'InsuranceAgency');
const homeAreaNames = (homeAgency?.areaServed || []).map((place) => place.name).sort();
const requiredAreaNames = ['Florida', 'Lakeland', 'Polk County'];
if (JSON.stringify(homeAreaNames) !== JSON.stringify(requiredAreaNames)) {
  issues.push(`index.html: canonical agency areaServed must be ${requiredAreaNames.join(', ')}`);
}
if (homeGraph.some((node) => ['Offer', 'OfferCatalog'].includes(node['@type']))) {
  issues.push('index.html: unverified Offer or OfferCatalog schema is prohibited on the canonical agency graph');
}
if (!hasCurrentDateModified(home)) {
  issues.push('index.html: homepage regulated FAQ needs a current machine-readable dateModified');
}
if (/David is my healthcare savior|David did all the legwork for me/i.test(visibleText(home))) {
  issues.push('index.html: copied review excerpts remain without direct current-source evidence');
}
for (const required of [
  'href="tel:+18636403102"',
  'href="mailto:dhuff@healthmarkets.com"',
  'href="/get-help/"',
  'src="/js/analytics.js?v=20260823-meta-pageview-sitewide"'
]) {
  if (!home.includes(required)) issues.push(`index.html: required contact, CTA, or tracking integration is missing (${required})`);
}
if (!siteTemplateLoaderPattern.test(home)) {
  issues.push('index.html: required contact, CTA, or tracking integration is missing (site template loader)');
}
if (!home.includes('Fixed-indemnity coverage is not comprehensive health insurance or ACA minimum essential coverage.')) {
  issues.push('index.html: visible fixed-indemnity limitation is missing');
}

const about = readFileSync(resolve(ROOT, 'about/index.html'), 'utf8');
const aboutGraph = [];
for (const match of about.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
  flatten(JSON.parse(match[1]), aboutGraph);
}
const aboutPerson = aboutGraph.find((node) => node['@id'] === registry.person['@id'] && node['@type'] === 'Person');
const aboutProfile = aboutGraph.find((node) => node['@id'] === 'https://lakelandhealthinsurance.com/about/#profile');
if (aboutPerson?.worksFor?.['@id'] !== registry.agency['@id']) {
  issues.push('about/index.html: Person must reference the canonical agency with worksFor');
}
if (aboutProfile?.mainEntity?.['@id'] !== registry.person['@id']) {
  issues.push('about/index.html: ProfilePage mainEntity must reference canonical David Huff');
}
if (aboutProfile?.publisher?.['@id'] !== registry.agency['@id']) {
  issues.push('about/index.html: ProfilePage publisher must reference the canonical agency');
}
if (aboutGraph.some((node) => node['@type'] === 'InsuranceAgency' && node['@id'] === registry.agency['@id'])) {
  issues.push('about/index.html: About must reference, not repeat, the full canonical agency graph');
}
if (!about.includes('https://nipr.com/licensing-center/look-up-a-national-producer-number')) {
  issues.push('about/index.html: current official NIPR verification URL is missing');
}
if (!hasCurrentDateModified(about)) {
  issues.push('about/index.html: current machine-readable profile dateModified is missing');
}
for (const required of [
  'href="tel:+18636403102"',
  'href="mailto:dhuff@healthmarkets.com"',
  'href="/get-help/"',
  'src="/js/analytics.js?v=20260823-meta-pageview-sitewide"'
]) {
  if (!about.includes(required)) issues.push(`about/index.html: required contact, CTA, or tracking integration is missing (${required})`);
}
if (!siteTemplateLoaderPattern.test(about)) {
  issues.push('about/index.html: required contact, CTA, or tracking integration is missing (site template loader)');
}

for (const rel of ['index.html', 'about/index.html', 'js/bbb-seal.js', 'js/site-template.js']) {
  const source = readFileSync(resolve(ROOT, rel), 'utf8');
  for (const pattern of forbiddenAuthorityCopy) {
    if (pattern.test(source)) issues.push(`${rel}: unsupported or volatile authority copy matches ${pattern}`);
  }
}

for (const rel of regulatedPages) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  if (!hasCurrentDateModified(html)) {
    issues.push(`${rel}: missing current machine-readable dateModified`);
  }
  if (!/Primary sources/i.test(html)) {
    issues.push(`${rel}: missing visible primary-source section`);
  }
  if (!hasCurrentRegulatedSource(rel)) {
    issues.push(`${rel}: missing current regulated-claim source access metadata`);
  }
}

for (const rel of workPackageTwoPages) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  const text = visibleText(html);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const robots = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1] || '';
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const graph = [];
  for (const [index, match] of [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
    try {
      flatten(JSON.parse(match[1]), graph);
    } catch (error) {
      issues.push(`${rel}: Work Package 02 JSON-LD block ${index + 1} is invalid (${error.message})`);
    }
  }

  if (canonical !== expectedCanonical(rel)) {
    issues.push(`${rel}: Work Package 02 canonical is "${canonical || 'missing'}"; expected "${expectedCanonical(rel)}"`);
  }
  if (/\bnoindex\b/i.test(robots)) issues.push(`${rel}: Work Package 02 page must remain indexable`);
  if (h1Count !== 1) issues.push(`${rel}: Work Package 02 page must have one H1; found ${h1Count}`);

  const serialized = JSON.stringify(graph);
  for (const id of [registry.website['@id'], registry.agency['@id'], registry.person['@id']]) {
    if (!serialized.includes(id)) issues.push(`${rel}: missing Work Package 02 canonical entity reference ${id}`);
  }
  if (graph.some((node) => node['@id'] === registry.agency['@id'] && node['@type'] === 'InsuranceAgency')) {
    issues.push(`${rel}: repeats the full canonical agency graph instead of referencing it`);
  }
  if (graph.some((node) => node['@id'] === registry.person['@id'] && node['@type'] === 'Person')) {
    issues.push(`${rel}: repeats the full canonical Person graph instead of referencing it`);
  }
  for (const node of graph) {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    for (const type of types) {
      if (prohibitedSchemaTypes.has(type)) issues.push(`${rel}: prohibited unevidenced schema type ${type}`);
    }
  }

  if (/\b(?:nationwide|across the United States|coverage across the nation)\b/i.test(text)) {
    issues.push(`${rel}: unsupported national-service language remains`);
  }
  if (excludedCarrierPattern.test(text)) issues.push(`${rel}: excluded carrier appears on a public Work Package 02 surface`);
  if (/\bfixed[- ]indemnity\b/i.test(text) && !/(?:not health insurance|not a substitute for minimum essential coverage|does not replace comprehensive major-medical coverage)/i.test(text)) {
    issues.push(`${rel}: fixed-indemnity content lacks a prominent coverage limitation`);
  }
}

for (const rel of workPackageTwoReviewedPages) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  if (!hasCurrentDateModified(html)) {
    issues.push(`${rel}: missing current machine-readable Work Package 02 dateModified`);
  }
}

for (const rel of workPackageThreePages) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  const text = visibleText(html);
  const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  const mainCount = (html.match(/<main\b/gi) || []).length;
  const graph = [];
  for (const [index, match] of [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
    try {
      flatten(JSON.parse(match[1]), graph);
    } catch (error) {
      issues.push(`${rel}: Work Package 03 JSON-LD block ${index + 1} is invalid (${error.message})`);
    }
  }

  if (canonical !== expectedCanonical(rel)) issues.push(`${rel}: Work Package 03 canonical is invalid`);
  if (h1Count !== 1) issues.push(`${rel}: Work Package 03 page must have one H1; found ${h1Count}`);
  if (mainCount !== 1) issues.push(`${rel}: Work Package 03 page must have one main landmark; found ${mainCount}`);
  const serialized = JSON.stringify(graph);
  for (const id of [registry.website['@id'], registry.agency['@id'], registry.person['@id']]) {
    if (!serialized.includes(id)) issues.push(`${rel}: missing Work Package 03 canonical entity reference ${id}`);
  }
  if (graph.some((node) => node['@id'] === registry.agency['@id'] && node['@type'] === 'InsuranceAgency')) {
    issues.push(`${rel}: repeats the full canonical agency graph instead of referencing it`);
  }
  if (graph.some((node) => node['@id'] === registry.person['@id'] && node['@type'] === 'Person')) {
    issues.push(`${rel}: repeats the full canonical Person graph instead of referencing it`);
  }
  if (!/Direct answer:/i.test(text)) issues.push(`${rel}: direct answer is missing`);
  if (!/Primary sources/i.test(text)) issues.push(`${rel}: primary-source section is missing`);
  if (!hasCurrentDateModified(html)) issues.push(`${rel}: current machine-readable dateModified is missing`);
  if (!html.includes('href="/get-help/')) issues.push(`${rel}: Get Help action is missing`);
  if (!html.includes('href="tel:+18636403102"')) issues.push(`${rel}: phone action is missing`);
  const expectedAnalyticsLoader = 'src="/js/analytics.js?v=20260821-lead-reconciliation"';
  if (!html.includes(expectedAnalyticsLoader)) issues.push(`${rel}: analytics loader is missing`);
  if (!siteTemplateLoaderPattern.test(html)) issues.push(`${rel}: shared site shell is missing`);
  if (/\b(?:nationwide|across the United States|coverage across the nation)\b/i.test(text)) {
    issues.push(`${rel}: prohibited national-service language remains`);
  }
  if (excludedCarrierPattern.test(text)) issues.push(`${rel}: excluded carrier appears on a public Work Package 03 surface`);
}

const movingMedicare = visibleText(readFileSync(resolve(ROOT, 'moving-florida-medicare/index.html'), 'utf8'));
if (!/We do not offer every plan available in your area/i.test(movingMedicare)) {
  issues.push('moving-florida-medicare/index.html: required Medicare plan-availability limitation is missing');
}

for (const rel of ['medicare-broker-lakeland-fl/index.html', 'best-medicare-broker-lakeland-fl/index.html']) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  if (!html.includes('https://www.medicare.gov/health-drug-plans/open-enrollment')) {
    issues.push(`${rel}: current official Medicare enrollment source is missing`);
  }
  if (!/We do not offer every plan available in your area/i.test(visibleText(html))) {
    issues.push(`${rel}: required Medicare plan-availability limitation is missing`);
  }
}

const getHelp = readFileSync(resolve(ROOT, 'get-help/index.html'), 'utf8');
for (const field of [
  'consent_request',
  'consent_call',
  'consent_sms',
  'consent_email',
  'consent_marketing_email',
  'consent_text_version',
  'consent_recorded_at',
  'consent_request_state',
  'consent_call_state',
  'consent_sms_state',
  'consent_email_state',
  'consent_marketing_email_state',
  'consent_withdrawal_state'
]) {
  if (!getHelp.includes(`name="${field}"`)) issues.push(`get-help/index.html: missing ${field}`);
}

const funnel = readFileSync(resolve(ROOT, 'js/funnel.js'), 'utf8');
if (/gtag\(['"]set["'],\s*["']user_data["']/i.test(funnel)) {
  issues.push('js/funnel.js: advertising user_data transmission is still enabled');
}

const analytics = readFileSync(resolve(ROOT, 'js/analytics.js'), 'utf8');
if (/allow_enhanced_conversions\s*:\s*true/i.test(analytics)) {
  issues.push('js/analytics.js: enhanced conversions are still enabled');
}

const lead = readFileSync(resolve(ROOT, 'netlify/functions/lead.js'), 'utf8');
for (const key of [
  'userData.em',
  'userData.ph',
  'userData.fn',
  'userData.ln',
  'userData.zp',
  'userData.client_ip_address',
  'userData.client_user_agent'
]) {
  if (lead.includes(key)) issues.push(`netlify/functions/lead.js: advertising identity field still present (${key})`);
}

const claimCheck = await checkRegistry({
  root: ROOT,
  registry: regulatedClaims,
  asOf: process.env.LHI_VALIDATION_DATE || new Date().toISOString().slice(0, 10)
});
claimCheck.issues.forEach((issue) => issues.push(`data/regulated-claims.json: ${issue}`));

if (issues.length) {
  console.error(`FAIL — ${issues.length} authority issue(s):`);
  issues.forEach((issue) => console.error(`  - ${issue}`));
  process.exit(1);
}

console.log(`OK — validated ${priorityPages.length} priority pages, ${workPackageTwoPages.length} Work Package 02 surfaces, and ${workPackageThreePages.length} Work Package 03 guides, including links, canonical entities, sources, claims, FAQ parity, accessibility contracts, and consent/privacy controls`);
