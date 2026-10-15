#!/usr/bin/env node
/**
 * Regenerate every embedded lhi-lead-hero block that uses site-medicare-lead.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildLeadHeroHtml } from './lib/lead-hero-html.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const LEAD_RE = /<section class="lhi-lead-hero"[\s\S]*?<\/section>\s*/i;
const SKIP = new Set(['node_modules', '.git', 'search-engine-from-zip']);

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function idPrefixFromBlock(block) {
  const id = block.match(/id="([^"]+)Form"/)?.[1];
  if (id) return id.replace(/Form$/, '');
  return 'siteLead';
}

function refreshMedicareLead(html, sourcePage) {
  const block = html.match(LEAD_RE)?.[0];
  if (!block || !block.includes('name="site-medicare-lead"')) return html;

  const sourcePageVal = block.match(/name="source_page" value="([^"]*)"/)?.[1] || sourcePage;
  const funnel = block.match(/data-funnel-name="([^"]*)"/)?.[1] || 'site_medicare_hub_lead';
  const sourceTemplate = block.match(/data-source-template="([^"]*)"/)?.[1] || 'medicare_hub';
  const headline = block.match(/class="lhi-lead-hero__title"[^>]*>([^<]+)</)?.[1]?.trim();
  const buttonText = block.match(/class="lhi-lead-hero__submit"[^>]*>([^<]+)</)?.[1]?.trim();
  const idPrefix = idPrefixFromBlock(block);

  const heroHtml = buildLeadHeroHtml({
    variant: 'medicare',
    formName: 'site-medicare-lead',
    sourceTemplate,
    sourcePage: sourcePageVal,
    idPrefix,
    funnelName: funnel,
    headline,
    buttonText
  }).trim();

  return html.replace(LEAD_RE, `${heroHtml}\n\n`);
}

let updated = 0;
for (const file of walkHtml(ROOT)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const sourcePage =
    rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -'index.html'.length)}` : `/${rel}`;
  const original = readFileSync(file, 'utf8');
  const next = refreshMedicareLead(original, sourcePage);
  if (next !== original) {
    writeFileSync(file, next);
    updated += 1;
    console.log('refreshed', sourcePage);
  }
}

console.log(`Done. ${updated} Medicare lead hero blocks refreshed.`);
