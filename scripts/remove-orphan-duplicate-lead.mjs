#!/usr/bin/env node
/** Remove orphaned duplicate lhi-site-lead-form card outside lhi-hero-shell (city migration artifact). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CITY = [
  'clearwater-health-insurance/index.html',
  'largo-health-insurance/index.html',
  'new-port-richey-health-insurance/index.html',
  'riverview-health-insurance/index.html',
  'st-petersburg-health-insurance/index.html',
  'wesley-chapel-health-insurance/index.html',
  'retiring-and-medicare-lakeland-fl/index.html'
];

const ORPHAN_RE =
  /(\n<\/div>\s*)\n\s*<div class="lhi-lead-hero__card" id="lhi-site-lead-form">[\s\S]*?<\/form>\s*\n\s*<\/div>\s*\n\s*<\/div>\s*\n(?=\s*<(?:section|div|article|footer))/;

for (const rel of CITY) {
  const path = join(ROOT, rel);
  let html = readFileSync(path, 'utf8');
  const shellEnd = html.indexOf('<div class="lhi-hero-shell">');
  if (shellEnd < 0) continue;
  const afterShellClose = html.indexOf('</div>', html.indexOf('</section>', shellEnd));
  const orphanIdx = html.indexOf('<div class="lhi-lead-hero__card" id="lhi-site-lead-form">', afterShellClose);
  if (orphanIdx < 0) continue;
  const formEnd = html.indexOf('</form>', orphanIdx);
  if (formEnd < 0) continue;
  let end = formEnd + '</form>'.length;
  if (html.slice(end, end + 20).includes('</div>')) {
    end = html.indexOf('</div>', end) + '</div>'.length;
  }
  html = html.slice(0, orphanIdx) + html.slice(end);
  writeFileSync(path, html, 'utf8');
  console.log('removed orphan lead', rel);
}
