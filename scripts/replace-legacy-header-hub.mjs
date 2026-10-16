#!/usr/bin/env node
/** Replace duplicated inline nav headers with hub-template anchor when site-template is linked. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORY_B } from './non-blog-sitewide-routes.mjs';

const ROOT = join(import.meta.dirname, '..');
const HUB = '<header class="hub-template-anchor" aria-label="Site header"></header>';
const HEADER_RE = /<header\b[^>]*>[\s\S]*?<\/header>/i;

for (const rel of CATEGORY_B) {
  const path = join(ROOT, rel);
  let html = readFileSync(path, 'utf8');
  if (!html.includes('site-template.css')) continue;
  if (html.includes('hub-template-anchor')) continue;
  if (!HEADER_RE.test(html)) continue;
  html = html.replace(HEADER_RE, HUB);
  if (!html.includes('site-template.js')) {
    html = html.replace('</body>', '  <script src="/js/site-template.js?v=20261016-non-blog-bd" defer></script>\n</body>');
  }
  writeFileSync(path, html, 'utf8');
  console.log('hub header', rel);
}
