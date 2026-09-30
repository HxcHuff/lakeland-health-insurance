import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');

export const FAQ_MATCH_SKIP_RELS = new Set([
]);

// All blog/*.html pages are in scope. Extra exclusions beyond PR #200 go here.
export const FAQ_MATCH_EXTRA_SKIP_RELS = new Set([
]);

export const FAQ_MATCH_SCOPE_RELS = null;

// Non-blog pages that still need FAQPage/visible-copy parity.
export const FAQ_MATCH_EXTRA_RELS = new Set([
  'local-health-insurance-answers/watson-clinic-insurance-network-help/index.html',
]);

const SKIP_DIRS = new Set([
  '.git', '.claude', '.audit-data', 'audit', 'node_modules', 'netlify', '.netlify',
  'output', 'tests', 'scripts', 'search-engine-from-zip',
]);

export function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#x2011;|&#8209;/gi, '-')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

export function normalizeFaqText(value) {
  return decodeHtmlEntities(value)
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?\)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

export function visiblePageText(html) {
  const withoutHidden = String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return normalizeFaqText(withoutHidden);
}

export function jsonLdBlocks(html) {
  return [...String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match, index) => {
      try {
        return { index: index + 1, data: JSON.parse(match[1]) };
      } catch (error) {
        return { index: index + 1, error: error.message };
      }
    });
}

function walkNodes(value, visit) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkNodes(item, visit));
    return;
  }
  if (!value || typeof value !== 'object') return;
  visit(value);
  Object.values(value).forEach((child) => walkNodes(child, visit));
}

export function faqEntries(data) {
  const entries = [];
  walkNodes(data, (node) => {
    const types = [].concat(node['@type'] || []);
    if (!types.includes('FAQPage')) return;
    for (const entity of [].concat(node.mainEntity || [])) {
      const name = typeof entity?.name === 'string' ? entity.name : '';
      const text = typeof entity?.acceptedAnswer?.text === 'string' ? entity.acceptedAnswer.text : '';
      if (name || text) entries.push({ name, text });
    }
  });
  return entries;
}

export function findFaqVisibleMatchIssues(rel, html, {
  skipRels = FAQ_MATCH_SKIP_RELS,
  extraSkipRels = FAQ_MATCH_EXTRA_SKIP_RELS,
  scopeRels = FAQ_MATCH_SCOPE_RELS,
} = {}) {
  if (!rel.startsWith('blog/') && !FAQ_MATCH_EXTRA_RELS.has(rel)) return [];
  if (skipRels.has(rel) || extraSkipRels.has(rel)) return [];
  if (scopeRels && !scopeRels.has(rel)) return [];
  const visible = visiblePageText(html);
  const issues = [];
  for (const block of jsonLdBlocks(html)) {
    if (block.error) continue;
    for (const entry of faqEntries(block.data)) {
      const question = normalizeFaqText(entry.name);
      const answer = normalizeFaqText(entry.text);
      if (question && !visible.includes(question)) {
        issues.push(`${rel}: FAQPage question is not visible: ${question}`);
      }
      if (answer && !visible.includes(answer)) {
        issues.push(`${rel}: FAQPage answer is not visible for "${question || '(missing question)'}": ${answer}`);
      }
    }
  }
  return issues;
}

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

export function collectFaqVisibleMatchIssues({
  root = ROOT,
  skipRels = FAQ_MATCH_SKIP_RELS,
  extraSkipRels = FAQ_MATCH_EXTRA_SKIP_RELS,
  scopeRels = FAQ_MATCH_SCOPE_RELS,
} = {}) {
  const issues = [];
  for (const file of walkHtml(root)) {
    const rel = relative(root, file);
    issues.push(...findFaqVisibleMatchIssues(rel, readFileSync(file, 'utf8'), { skipRels, extraSkipRels, scopeRels }));
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = collectFaqVisibleMatchIssues();
  if (issues.length === 0) {
    console.log('OK — FAQPage questions and answers match visible copy');
    process.exit(0);
  }
  console.error(`FAIL — ${issues.length} FAQPage visible-copy issue(s):`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}
