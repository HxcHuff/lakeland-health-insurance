import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

export const ROOT = resolve(new URL('../..', import.meta.url).pathname);
export const DEFAULT_CONFIG = resolve(ROOT, 'audit/config.example.json');
const SECRET_OR_IDENTIFIER = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|(?:access|refresh|api|secret|auth)[_-]?token\s*[:=]\s*[^\s,;]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b)/i;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
}

export function stableStringify(value) {
  return JSON.stringify(sortDeep(value));
}

export function loadConfig(configPath = DEFAULT_CONFIG) {
  const path = resolve(ROOT, configPath);
  const config = JSON.parse(readFileSync(path, 'utf8'));
  if (config.schemaVersion !== 1) throw new Error('Unsupported audit config schemaVersion');
  if (config.site?.origin !== 'https://lakelandhealthinsurance.com') {
    throw new Error('Audit config origin is outside the approved site boundary');
  }
  return { ...config, _path: path };
}

export function parseArgs(argv) {
  const args = {};
  const booleanArgs = new Set([
    'allow-incomplete',
    'dry-run',
    'enable-external-alert',
    'execute',
    'fixture',
    'help',
    'json',
    'live',
    'local-only',
    'once',
    'skip-google',
    'skip-live',
    'skip-render'
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (booleanArgs.has(name)) args[name] = true;
    else {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
      args[name] = value;
      index += 1;
    }
  }
  return args;
}

export function assertNoSensitiveText(value, label = 'input') {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (SECRET_OR_IDENTIFIER.test(text)) {
    throw new Error(`${label} rejected: possible credential or direct identifier detected`);
  }
}

export function sanitizeUrl(raw, config, { allowExternal = false, allowCanonicalHostProtocolVariant = false } = {}) {
  const url = new URL(raw, config.site.origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  const canonicalHostProtocolVariant = allowCanonicalHostProtocolVariant
    && url.hostname.toLowerCase() === config.site.canonicalHost
    && ['http:', 'https:'].includes(url.protocol);
  if (!allowExternal && url.origin !== config.site.origin && !canonicalHostProtocolVariant) {
    throw new Error(`URL outside approved origin: ${url.origin}`);
  }
  url.hash = '';

  const reject = new RegExp(config.privacy.rejectParameterNamePattern, 'i');
  const sanitized = new URL(url.href);
  sanitized.search = '';
  for (const [name, value] of url.searchParams) {
    if (reject.test(name)) throw new Error(`Sensitive query parameter name rejected: ${name}`);
    if (config.privacy.queryParameterMode === 'hash' && config.privacy.hashParameters.includes(name)) {
      sanitized.searchParams.append(name, `sha256:${sha256(value)}`);
    }
  }

  if (sanitized.hostname === config.site.canonicalHost) sanitized.protocol = 'https:';
  sanitized.hostname = sanitized.hostname.toLowerCase();
  sanitized.pathname = sanitized.pathname.replace(/\/{2,}/g, '/');
  return sanitized.href;
}

export function canonicalUrl(raw, config) {
  const url = new URL(sanitizeUrl(raw, config, { allowExternal: true }));
  if (url.hostname === `www.${config.site.canonicalHost}`) url.hostname = config.site.canonicalHost;
  if (url.origin !== config.site.origin) return url.href;
  if (url.pathname === '/index.html') url.pathname = '/';
  else if (url.pathname.endsWith('/index.html')) url.pathname = `${url.pathname.slice(0, -'index.html'.length)}`;
  const extension = extname(url.pathname);
  if (!extension && !url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template\b[\s\S]*?<\/template>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|quot|apos|#39);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchContent(html, regex) {
  return regex.exec(html)?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

export function extractHtmlSignals(html, pageUrl, config) {
  const text = visibleText(html);
  const scripts = [];
  const schemaDates = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      scripts.push({ valid: true, sha256: sha256(stableStringify(data)) });
      const serialized = JSON.stringify(data);
      for (const date of serialized.matchAll(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/g)) schemaDates.push(date[1]);
    } catch (error) {
      scripts.push({ valid: false, error: error.message.slice(0, 200) });
    }
  }
  const refs = [];
  for (const match of html.matchAll(/<(a|link|script|img|source|iframe|form)\b[^>]*?\b(href|src|action)=["']([^"']+)["']/gi)) {
    const [, tag, attribute, raw] = match;
    if (/^(?:mailto:|tel:|sms:|javascript:|data:|#)/i.test(raw)) continue;
    try {
      refs.push({ tag: tag.toLowerCase(), attribute: attribute.toLowerCase(), url: sanitizeUrl(new URL(raw, pageUrl).href, config, { allowExternal: true }) });
    } catch (error) {
      refs.push({ tag: tag.toLowerCase(), attribute: attribute.toLowerCase(), invalid: true, error: error.message.slice(0, 200) });
    }
  }
  const forms = [...html.matchAll(/<form\b([^>]*)>/gi)].map((match) => ({
    method: matchContent(match[1], /\bmethod=["']([^"']+)["']/i)?.toUpperCase() || 'GET',
    action: new URL(matchContent(match[1], /\baction=["']([^"']*)["']/i) || pageUrl, pageUrl).href
  }));
  return {
    title: matchContent(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: matchContent(html, /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || matchContent(html, /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i),
    canonical: matchContent(html, /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i),
    robots: matchContent(html, /<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i),
    h1Count: (html.match(/<h1\b/gi) || []).length,
    visibleTextLength: text.length,
    mainTextLength: visibleText(matchContent(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || '').length,
    visibleTextSha256: sha256(text),
    htmlSha256: sha256(html),
    schema: scripts,
    schemaDates: [...new Set(schemaDates)],
    visibleUpdatedDates: [...new Set([...text.matchAll(/\bUpdated\s+(?:on\s+)?(?:[A-Z][a-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/g)].map((m) => m[0]))],
    references: refs,
    forms
  };
}

export function parseSitemap(xml) {
  const rows = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    rows.push({
      url: matchContent(block[1], /<loc>\s*([^<]+)\s*<\/loc>/),
      lastmod: matchContent(block[1], /<lastmod>\s*([^<]+)\s*<\/lastmod>/)
    });
  }
  return rows.filter((row) => row.url);
}

export function parseRedirects(text, config) {
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [from, to, rawStatus = '200'] = trimmed.split(/\s+/);
    const status = Number(rawStatus.replace('!', ''));
    rows.push({ line: index + 1, from, to, status, force: rawStatus.endsWith('!'), fromUrl: new URL(from, config.site.origin).href, toUrl: new URL(to, config.site.origin).href });
  }
  return rows;
}

export function walkFiles(dir, { skip = new Set(['.git', '.claude', '.netlify', '.audit-data', 'node_modules', '.playwright-cli', 'output']) } = {}, out = []) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walkFiles(full, { skip }, out);
    else out.push(full);
  }
  return out;
}

export function makeEnvelope({ source, dataset, request, payload, retrievedAt = new Date().toISOString() }) {
  const payloadText = stableStringify(payload);
  return {
    schemaVersion: 1,
    source,
    retrievedAt,
    dataset,
    request,
    integrity: { algorithm: 'sha256', payloadSha256: sha256(payloadText) },
    payload
  };
}

export function verifyEnvelope(envelope) {
  const expected = sha256(stableStringify(envelope.payload));
  if (expected !== envelope.integrity?.payloadSha256) throw new Error(`Checksum mismatch for ${envelope.source}/${envelope.dataset}`);
  return true;
}

export function persistEnvelope(envelope, config) {
  verifyEnvelope(envelope);
  const storageRoot = resolve(ROOT, config.storage.root);
  const dir = join(storageRoot, 'raw', envelope.source);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = envelope.retrievedAt.replace(/[:.]/g, '-');
  const file = join(dir, `${stamp}_${envelope.integrity.payloadSha256.slice(0, 16)}.json`);
  const serialized = `${JSON.stringify(envelope, null, 2)}\n`;
  try {
    writeFileSync(file, serialized, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST' || readFileSync(file, 'utf8') !== serialized) throw error;
  }
  return file;
}

export function readEnvelopes(config, source) {
  const dir = resolve(ROOT, config.storage.root, 'raw', source);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')))
    .filter((item) => verifyEnvelope(item))
    .sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt));
}

export function latestEnvelope(config, source) {
  return readEnvelopes(config, source).at(-1) || null;
}

export async function fetchWithRetry(url, options, { retries = 2, retryBaseMs = 300 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === retries) return response;
      await response.body?.cancel();
      lastError = new Error(`Transient HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
    }
    await new Promise((done) => setTimeout(done, retryBaseMs * (2 ** attempt)));
  }
  throw lastError;
}

export function scoreFinding({ category, risk, visibility, confidence, recency }) {
  const raw = Math.round((risk * visibility * confidence * recency / 37.5) * 100);
  if (category === 'confidentiality') return Math.min(100, Math.max(95, raw));
  if (category === 'compliance') return Math.min(94, Math.max(85, raw));
  return Math.min(84, raw);
}

export function createFinding({ ruleId, category, url = null, scope = null, summary, evidence, recommendedAction, verificationRequired = false, risk = 3, visibility = 2, confidence = 0.9, recency = 1 }) {
  const score = scoreFinding({ category, risk, visibility, confidence, recency });
  const severity = score >= 90 ? 'critical' : score >= 70 ? 'high' : score >= 45 ? 'medium' : score >= 20 ? 'low' : 'info';
  return {
    id: `${ruleId}:${sha256(`${url || 'site'}:${scope || summary}:${summary}`).slice(0, 16)}`,
    ruleId,
    category,
    severity,
    score,
    url,
    summary,
    evidence,
    recommendedAction,
    automaticActionAllowed: false,
    verificationRequired,
    dimensions: { risk, visibility, confidence, recency }
  };
}

export function makeRunId(now = new Date()) {
  return `${now.toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}`;
}

export function relativeToRoot(path) {
  return relative(ROOT, path);
}
