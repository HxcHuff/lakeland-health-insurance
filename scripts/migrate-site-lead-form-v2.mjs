#!/usr/bin/env node
/**
 * Roll site hero forms to unified lead form v2. Skips LP and get-help sitelink pages.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  buildLeadFormV2Html,
  inferPreselect,
  sourcePageKeyFromPath,
  fixFunnelName
} from './lib/lead-hero-v2-html.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const ASSET_V = '20261017-lead-form-v338';
const V2_JS = `<script src="/js/lead-form-v2.js?v=${ASSET_V}" defer></script>`;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'search-engine-from-zip', '.ai-worker-local', 'lp']);

const SKIP_FILES = new Set([
  'medicare/index.html',
  'aca-health-insurance-lakeland-fl/index.html',
  'aca-health-insurance-agent-polk-county-fl/index.html',
  'lp/aca/index.html',
  'lp/gap/index.html',
  'lp/medicare/index.html',
  'employer-referral/index.html',
  'post-enrollment-review/index.html'
]);

function walkHtml(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

function pagePathFromFile(file) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  return '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '/');
}

function extractMeta(html, file) {
  if (!html.includes('data-lhi-site-lead-form')) return null;
  if (html.includes('data-lf2-mode="site"') || html.includes('class="lf2')) return null;
  const formOpen = html.match(/<form\b[^>]*data-lhi-site-lead-form[^>]*>/i);
  if (!formOpen) return null;
  const tag = formOpen[0];
  const nameMatch = tag.match(/\bname="(site-(?:medicare|aca)-lead)"/);
  const idMatch = tag.match(/\bid="([^"]+)"/);
  const funnelMatch = tag.match(/data-funnel-name="([^"]+)"/);
  if (!nameMatch || !idMatch) return null;
  const before = html.slice(0, formOpen.index);
  const templateMatch = before.match(/data-source-template="([^"]+)"/);
  const sourcePageMatch = html.match(/name="source_page"\s+value="([^"]+)"/);
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const sourcePage = sourcePageMatch ? sourcePageMatch[1] : pagePathFromFile(file);
  const idPrefix = idMatch[1].replace(/Form$/, '');
  const formName = nameMatch[1];
  const funnelName = fixFunnelName(funnelMatch ? funnelMatch[1] : 'site_lead', formName);
  return {
    idPrefix,
    formName,
    funnelName,
    sourceTemplate: templateMatch ? templateMatch[1] : 'site_page',
    sourcePage,
    rel,
    preselect: inferPreselect(sourcePage, formName, rel)
  };
}

function replaceForm(html, meta) {
  const re = new RegExp(
    `<form\\b[^>]*id="${meta.idPrefix}Form"[^>]*data-lhi-site-lead-form[\\s\\S]*?</form>`,
    'i'
  );
  const replacement = buildLeadFormV2Html({
    formName: meta.formName,
    sourceTemplate: meta.sourceTemplate,
    sourcePage: meta.sourcePage,
    sourcePageKey: sourcePageKeyFromPath(meta.sourcePage),
    idPrefix: meta.idPrefix,
    funnelName: meta.funnelName,
    preselect: meta.preselect || undefined
  });
  return html.replace(re, replacement.trim());
}

function bumpPins(html) {
  let out = html.replace(/\/css\/lead-hero\.css\?v=[^"']+/g, `/css/lead-hero.css?v=${ASSET_V}`);
  out = out.replace(/\/js\/lead-hero\.js\?v=[^"']+/g, `/js/lead-hero.js?v=${ASSET_V}`);
  if (out.includes('class="lf2') && !out.includes('lead-form-v2.js')) {
    if (out.includes('lead-hero.js')) {
      out = out.replace(/(<script[^>]*lead-hero\.js[^>]*><\/script>)/i, `$1\n    ${V2_JS}`);
    } else if (out.includes('</body>')) {
      out = out.replace(/<\/body>/i, `    ${V2_JS}\n</body>`);
    }
  }
  return out;
}

let changed = 0;
for (const file of walkHtml()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel)) continue;
  const html = readFileSync(file, 'utf8');
  const meta = extractMeta(html, file);
  if (!meta) continue;
  let next = replaceForm(html, meta);
  next = bumpPins(next);
  if (next !== html) {
    writeFileSync(file, next);
    changed += 1;
    console.log('updated', rel);
  }
}
console.log(`Done. ${changed} files updated.`);
