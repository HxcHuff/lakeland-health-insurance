#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

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
  'aca-subsidy-estimator/index.html'
];
const forbiddenClaims = [
  /coverage across the nation/i,
  /serving most of the united states/i,
  /serving families and businesses across the nation/i,
  /largest annual allowances/i
];
const issues = [];

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

for (const rel of regulatedPages) {
  const html = readFileSync(resolve(ROOT, rel), 'utf8');
  if (!/Last reviewed:\s*<time[^>]+datetime=["']2026-07-30["']/i.test(html)) {
    issues.push(`${rel}: missing visible 2026-07-30 review date`);
  }
  if (!/Primary sources/i.test(html)) {
    issues.push(`${rel}: missing visible primary-source section`);
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

if (!Array.isArray(regulatedClaims.claims) || regulatedClaims.claims.length === 0) {
  issues.push('data/regulated-claims.json: claims registry is empty');
} else {
  const requiredClaimFields = [
    'id',
    'claim',
    'sourceUrl',
    'accessDate',
    'applicableYear',
    'state',
    'productLine',
    'reviewStatus'
  ];
  regulatedClaims.claims.forEach((claim, index) => {
    requiredClaimFields.forEach((field) => {
      if (!claim[field]) issues.push(`data/regulated-claims.json: claim ${index + 1} missing ${field}`);
    });
    if (claim.accessDate !== regulatedClaims.reviewedAt) {
      issues.push(`data/regulated-claims.json: claim ${claim.id || index + 1} accessDate does not match reviewedAt`);
    }
    if (!/^https:\/\/(?:www\.)?(?:cms\.gov|medicare\.gov|healthcare\.gov|irs\.gov)\//i.test(claim.sourceUrl || '')) {
      issues.push(`data/regulated-claims.json: claim ${claim.id || index + 1} does not use an approved primary-source host`);
    }
  });
}

if (issues.length) {
  console.error(`FAIL — ${issues.length} authority issue(s):`);
  issues.forEach((issue) => console.error(`  - ${issue}`));
  process.exit(1);
}

console.log(`OK — validated ${priorityPages.length} priority pages, links, canonical entities, sources, claims, FAQ parity, and consent/privacy contracts`);
