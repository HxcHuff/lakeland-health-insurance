#!/usr/bin/env node
/**
 * Apply blog audit fixes: lead form variant from CSV topic, remove duplicate TPMO blocks.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { buildLeadHeroHtml } from './lib/lead-hero-html.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CSV_CANDIDATES = [
  '/cursor/stores/self/internal/blog-audit-20261015.csv',
  join(ROOT, '.ai-worker-local/blog-audit-20261015.csv')
];
const CSV_PATH = process.env.BLOG_AUDIT_CSV || CSV_CANDIDATES.find((p) => existsSync(p)) || CSV_CANDIDATES[0];
const LEAD_RE = /<section class="lhi-lead-hero"[\s\S]*?<\/section>\s*/i;
const DISCLOSURE_RE = /<section class="site-page-disclosures"[\s\S]*?<\/section>\s*/gi;
const EMPTY_CARD_RE = /<section class="card">\s*<\/section>\s*/gi;

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/^([^,]+),([^,]+),([^,]+),/);
    if (!m) continue;
    const url = m[1].trim();
    const topic = m[2].trim().toLowerCase();
    const forms = m[3].trim();
    if (!url.includes('/blog/')) continue;
    let path = url.replace('https://lakelandhealthinsurance.com', '');
    if (path.endsWith('/blog/')) path = '/blog/index.html';
    rows.push({ path, topic, forms });
  }
  return rows;
}

const MEDICARE_SLUG =
  /\b(medicare|medigap|aep-|turning-65|part-d|part-b-giveback|advantage-vs|advantage-plan|advantage-lakeland|baycare-medicare|lakeland-va-clinic-medicare|good-shepherd-hospice-lakeland-medicare|does-medicare|do-i-need-part-b|when-can-i-switch-medicare|when-to-sign-up-for-medicare|penalty-for-signing-up-for-medicare|switch-medicare|how-does-medicare|city-of-lakeland-retiree-medicare|keep-doctor-switch-medicare)\b/;

function resolveTopic(path, auditTopic) {
  const slug = path.toLowerCase();
  if (MEDICARE_SLUG.test(slug)) return 'medicare';
  return auditTopic === 'medicare' ? 'medicare' : 'aca';
}

function topicVariant(path, auditTopic) {
  return resolveTopic(path, auditTopic) === 'medicare' ? 'medicare' : 'aca';
}

function idPrefixFromPath(path) {
  const base = basename(path, '.html').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
  return base || 'blogLead';
}

function extractLeadMeta(html) {
  const block = html.match(LEAD_RE)?.[0] ?? '';
  const formName = block.match(/name="(site-(?:medicare|aca)-lead)"/)?.[1];
  const sourcePage = block.match(/name="source_page" value="([^"]*)"/)?.[1];
  const funnel = block.match(/data-funnel-name="([^"]*)"/)?.[1];
  return { formName, sourcePage, funnel };
}

function replaceLead(html, path, variant) {
  if (!html.match(LEAD_RE)) return html;
  const meta = extractLeadMeta(html);
  const isMedicare = variant === 'medicare';
  const expectedForm = isMedicare ? 'site-medicare-lead' : 'site-aca-lead';
  const hasExpected =
    meta.formName === expectedForm &&
    html.includes(`data-variant="${isMedicare ? 'medicare' : 'aca'}"`) &&
    html.includes(isMedicare ? 'site-medicare-2026-10-v1' : 'site-aca-2026-10-v1');
  if (hasExpected) return html;

  const sourcePage =
    meta.sourcePage ||
    (path === '/blog/index.html' ? '/blog/' : path.startsWith('/') ? path : `/${path}`);
  const idPrefix = idPrefixFromPath(sourcePage);
  const heroHtml = buildLeadHeroHtml({
    variant,
    formName: expectedForm,
    sourceTemplate: 'blog_post',
    sourcePage,
    idPrefix,
    funnelName: meta.funnel || (isMedicare ? 'site_blog_medicare_lead' : 'site_blog_aca_lead')
  }).trim();

  return html.replace(LEAD_RE, `${heroHtml}\n\n`);
}

const auditRows = parseCsv(readFileSync(CSV_PATH, 'utf8'));
const auditByPath = new Map(auditRows.map((r) => [r.path, r]));

let formSwaps = 0;
let tpmoRemoved = 0;
let emptyCards = 0;

for (const name of readdirSync(join(ROOT, 'blog'))) {
  if (!name.endsWith('.html')) continue;
  const file = join(ROOT, 'blog', name);
  const path = name === 'index.html' ? '/blog/index.html' : `/blog/${name}`;
  let html = readFileSync(file, 'utf8');
  const original = html;

  const audit = auditByPath.get(path) || auditByPath.get(path.replace('/blog/index.html', '/blog/'));
  const variant = topicVariant(path, audit?.topic ?? 'aca');

  const afterLead = replaceLead(html, path, variant);
  if (afterLead !== html) {
    html = afterLead;
    formSwaps += 1;
  }

  if (DISCLOSURE_RE.test(html)) {
    html = html.replace(DISCLOSURE_RE, '');
    tpmoRemoved += 1;
  }

  const emptied = (html.match(EMPTY_CARD_RE) || []).length;
  if (emptied) {
    html = html.replace(EMPTY_CARD_RE, '');
    emptyCards += emptied;
  }

  if (html !== original) writeFileSync(file, html);
}

console.log(JSON.stringify({ formSwaps, tpmoRemovedPages: tpmoRemoved, emptyCardsRemoved: emptyCards }, null, 2));
