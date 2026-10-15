#!/usr/bin/env node
/**
 * ACA-style answer-hero pages with inline sitelink forms: short lede + mobile-friendly order.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walkHtml(full, out);
    } else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function firstSentence(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const m = text.match(/^(.{40,220}?\.)(?:\s|$)/);
  if (m) return m[1].trim();
  return text.length > 180 ? `${text.slice(0, 177).trim()}…` : text;
}

function transform(html) {
  if (!html.includes('class="answer-hero"') || html.includes('lhi-hero-shell')) return null;
  if (!html.includes('class="sitelink-lead-form"')) return null;
  if (html.includes('medicare-hero')) return null;

  const heroRe = /(<section class="answer-hero">[\s\S]*?<div[^>]*>\s*)([\s\S]*?)(\s*<form class="sitelink-lead-form"[\s\S]*?<\/form>)([\s\S]*?)(<\/div>[\s\S]*?<\/section>)/i;
  const m = html.match(heroRe);
  if (!m) return null;

  const [, open, beforeForm, form, afterForm, close] = m;
  const h1 = beforeForm.match(/<h1[\s\S]*?<\/h1>/i)?.[0];
  if (!h1) return null;

  const afterH1 = beforeForm.slice(beforeForm.indexOf(h1) + h1.length);
  const leadMatch = afterH1.match(/^\s*(<p class="lead"[^>]*>[\s\S]*?<\/p>)/i);
  if (!leadMatch) return null;
  if (/\blhi-hero-lede\b/.test(leadMatch[1]) && html.includes('answer-hero-deferred')) return null;

  const fullLead = leadMatch[1];
  const leadInner = fullLead.replace(/^<p class="lead[^"]*"[^>]*>/i, '').replace(/<\/p>\s*$/i, '');
  const shortText = firstSentence(leadInner);
  const shortLede = `<p class="lead lhi-hero-lede">${shortText}</p>`;
  const deferredLead = fullLead.includes('answer-hero-deferred')
    ? fullLead
    : fullLead.replace(/^<p class="lead"/, '<p class="lead answer-hero-deferred"');

  const prefix = beforeForm.slice(0, beforeForm.indexOf(h1) + h1.length);
  const between = afterH1.slice(leadMatch.index + leadMatch[0].length);
  const ctaBlock = (between + afterForm).trim();

  const rebuilt = `${open}${prefix}
          ${shortLede}
          ${form}
          ${deferredLead}
          ${ctaBlock}
        ${close}`;

  return html.replace(heroRe, rebuilt);
}

let n = 0;
for (const file of walkHtml(ROOT)) {
  const html = readFileSync(file, 'utf8');
  const next = transform(html);
  if (next && next !== html) {
    writeFileSync(file, next);
    n += 1;
    console.log('updated', relative(ROOT, file));
  }
}
console.log(`Done. ${n} answer-hero sitelink pages updated.`);
