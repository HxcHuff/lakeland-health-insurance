#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { faqParityIssues } from './faq-schema-parity.mjs';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');
const WRITE = process.argv.includes('--write');
const SKIP_DIRS = new Set([
  '.git', '.claude', '.audit-data', 'audit', 'netlify', 'node_modules', 'output', 'scripts', 'tests'
]);
const JSON_LD = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>\s*/gi;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function typesOf(value) {
  return Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']];
}

function removeFaqNodes(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !typesOf(item).includes('FAQPage'))
      .map(removeFaqNodes);
  }
  if (!value || typeof value !== 'object') return value;
  const copy = {};
  for (const [key, child] of Object.entries(value)) copy[key] = removeFaqNodes(child);
  return copy;
}

let affectedFiles = 0;
let removedBlocks = 0;
let editedBlocks = 0;

for (const file of walk(ROOT)) {
  const source = readFileSync(file, 'utf8');
  const visibleSource = source.replace(JSON_LD, '');
  let changed = false;
  const next = source.replace(JSON_LD, (full, json) => {
    if (faqParityIssues(`${visibleSource}\n${full}`).length === 0) return full;

    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return full;
    }

    if (typesOf(data).includes('FAQPage')) {
      changed = true;
      removedBlocks += 1;
      return '';
    }

    const cleaned = removeFaqNodes(data);
    if (JSON.stringify(cleaned) === JSON.stringify(data)) return full;
    changed = true;
    editedBlocks += 1;
    return `<script type="application/ld+json">\n${JSON.stringify(cleaned, null, 2)}\n</script>\n`;
  });

  if (!changed) continue;
  affectedFiles += 1;
  console.log(relative(ROOT, file));
  if (WRITE) writeFileSync(file, next);
}

console.log(`${WRITE ? 'Updated' : 'Would update'} ${affectedFiles} files: removed ${removedBlocks} standalone FAQ blocks and edited ${editedBlocks} mixed JSON-LD blocks.`);
if (!WRITE && affectedFiles > 0) process.exitCode = 1;
