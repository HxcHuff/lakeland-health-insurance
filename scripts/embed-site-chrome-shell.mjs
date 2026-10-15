#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  renderSiteHeaderShell,
  shouldEmbedSeasonalBanner
} from './lib/site-chrome-shell.mjs';

const ROOT = resolve('/workspace');
const EMPTY_HEADER_RE = /<header class="hub-template-anchor" aria-label="Site header"><\/header>/;

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (['node_modules', '.git', 'search-engine-from-zip'].includes(name)) continue;
      walkHtml(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function publicPath(file) {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel}`;
}

function readIntent(html) {
  const m = html.match(/<meta name="lhi-chrome-intent" content="([^"]+)"/);
  return m ? m[1].trim().toLowerCase() : '';
}

function helpHrefForIntent(intent, path) {
  if (intent === 'medicare' || path.startsWith('/medicare')) return '/get-help/?intent=medicare';
  if (intent === 'under-65') return '/get-help/?intent=under-65';
  if (intent === 'losing-coverage') return '/get-help/?intent=losing-coverage';
  return '/get-help/';
}

function addBodySeasonalClass(html) {
  return html.replace(/<body([^>]*)>/, (match, rest) => {
    if (/has-seasonal-banner/.test(rest)) return match;
    const classMatch = rest.match(/\bclass="([^"]*)"/);
    if (classMatch) {
      const merged = `${classMatch[1]} has-seasonal-banner`.replace(/\s+/g, ' ').trim();
      return match.replace(classMatch[0], `class="${merged}"`);
    }
    const spacer = rest.trim() ? ` ${rest.trim()}` : '';
    return `<body class="has-seasonal-banner"${spacer}>`;
  });
}

let changed = 0;
for (const file of walkHtml(ROOT)) {
  let html = readFileSync(file, 'utf8');
  if (!EMPTY_HEADER_RE.test(html)) continue;
  const path = publicPath(file);
  const intent = readIntent(html);
  const seasonal = shouldEmbedSeasonalBanner(intent, path);
  const shell = renderSiteHeaderShell({
    helpHref: helpHrefForIntent(intent, path),
    seasonalBanner: seasonal
  });
  let patched = html.replace(EMPTY_HEADER_RE, shell);
  if (seasonal) patched = addBodySeasonalClass(patched);
  if (patched === html) continue;
  writeFileSync(file, patched);
  changed += 1;
}

console.log(`Embedded site chrome shell in ${changed} HTML file(s).`);
