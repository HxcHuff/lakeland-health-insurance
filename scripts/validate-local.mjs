#!/usr/bin/env node
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const PUBLIC_DATE = '2026-08-12';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/@{}~^+\-]*$/;

function git(root, args, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim() || `git exited ${result.status}`);
  return result.stdout;
}

function verifyCommit(root, ref, gitRun = git) {
  return gitRun(root, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]).trim();
}

function optionalGit(root, args, gitRun = git) {
  try { return gitRun(root, args).trim() || null; }
  catch { return null; }
}

function uniqueMergeBase(root, head, candidate, gitRun = git) {
  const bases = gitRun(root, ['merge-base', '--all', head, candidate]).trim().split(/\r?\n/).filter(Boolean);
  if (bases.length !== 1) throw new Error('comparison base does not have one trustworthy merge-base');
  return bases[0];
}

function validOriginRef(ref) {
  return /^refs\/remotes\/origin\/[A-Za-z0-9][A-Za-z0-9._/+\-]*$/.test(ref)
    && !ref.includes('..') && !ref.endsWith('/') && ref !== 'refs/remotes/origin/HEAD';
}

export function selectComparisonBase({ root = DEFAULT_ROOT, explicitBase, gitRun = git } = {}) {
  const head = verifyCommit(root, 'HEAD', gitRun);
  if (explicitBase !== undefined) {
    if (!REF_PATTERN.test(explicitBase) || explicitBase.startsWith('-') || explicitBase.length > 200) throw new Error('invalid --base revision');
    const candidate = verifyCommit(root, explicitBase, gitRun);
    return {
      commit: uniqueMergeBase(root, head, candidate, gitRun),
      source: '--base merge-base',
      rejectedSameFeatureUpstream: false,
    };
  }

  const branchRef = optionalGit(root, ['symbolic-ref', '--quiet', 'HEAD'], gitRun);
  if (!branchRef?.startsWith('refs/heads/')) throw new Error('automatic comparison base requires a local branch');
  const branchName = branchRef.slice('refs/heads/'.length);
  if (!branchName || branchName.includes('..') || /[\0\r\n]/.test(branchName)) throw new Error('unsafe local branch name');

  const upstreamRef = optionalGit(root, ['rev-parse', '--symbolic-full-name', '--verify', '--quiet', '@{upstream}'], gitRun);
  const symbolicDefault = optionalGit(root, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], gitRun);
  const candidates = [];
  if (symbolicDefault && validOriginRef(symbolicDefault)) {
    candidates.push({ ref: symbolicDefault, source: `origin/HEAD -> ${symbolicDefault.slice('refs/remotes/'.length)} merge-base` });
  }
  candidates.push(
    { ref: 'refs/remotes/origin/main', source: 'origin/main merge-base' },
    { ref: 'refs/heads/main', source: 'local main merge-base' },
  );

  let selected = null;
  for (const candidate of candidates) {
    try {
      selected = { ...candidate, tip: verifyCommit(root, candidate.ref, gitRun) };
      break;
    } catch { /* use the next documented local metadata fallback */ }
  }
  if (!selected) throw new Error('no trustworthy comparison base is available');

  const mergeBase = uniqueMergeBase(root, head, selected.tip, gitRun);
  const featureCommitCountText = gitRun(root, ['rev-list', '--count', `${mergeBase}..${head}`, '--']).trim();
  if (!/^\d+$/.test(featureCommitCountText)) throw new Error('unable to verify committed feature changes');
  const selectedBranch = selected.ref.replace(/^refs\/(?:remotes\/origin|heads)\//, '');
  const isDefaultBranch = branchName === selectedBranch;
  if (!isDefaultBranch && mergeBase === head) {
    const defaultAheadText = gitRun(root, ['rev-list', '--count', `${head}..${selected.tip}`, '--']).trim();
    if (!/^\d+$/.test(defaultAheadText)) throw new Error('unable to verify default-branch relationship');
    if (Number(defaultAheadText) > 0 || Number(featureCommitCountText) > 0) {
      throw new Error('comparison base collapsed to feature HEAD');
    }
  }

  const sameFeatureRefs = new Set([branchRef, `refs/remotes/origin/${branchName}`]);
  const rejectedSameFeatureUpstream = Boolean(
    upstreamRef && sameFeatureRefs.has(upstreamRef) && upstreamRef !== selected.ref,
  );
  return { commit: mergeBase, source: selected.source, rejectedSameFeatureUpstream };
}

function nulList(value) {
  return value.split('\0').filter(Boolean);
}

function safeChangedPath(root, raw) {
  if (!raw || raw.includes('\0') || raw.includes('\n') || raw.includes('\r') || isAbsolute(raw)) throw new Error('unsafe changed path');
  const normalized = raw.replaceAll('\\', '/');
  if (normalized.split('/').some((part) => part === '..' || part === '.')) throw new Error(`unsafe changed path: ${raw}`);
  const approvedRoot = realpathSync(root);
  const full = resolve(approvedRoot, normalized);
  const rel = relative(approvedRoot, full);
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error(`unsafe changed path: ${raw}`);
  if (existsSync(full)) {
    const stat = lstatSync(full);
    const real = stat.isSymbolicLink() ? realpathSync(full) : realpathSync(dirname(full));
    const realRel = relative(approvedRoot, real);
    if (realRel === '..' || realRel.startsWith(`..${sep}`) || isAbsolute(realRel)) throw new Error(`changed path escapes repository: ${raw}`);
  }
  return normalized;
}

export function changedJavaScript({ root = DEFAULT_ROOT, base, gitRun = git } = {}) {
  const lists = [
    gitRun(root, ['diff', '--name-only', '-z', '--diff-filter=ACMR', `${base}...HEAD`]),
    gitRun(root, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']),
    gitRun(root, ['diff', '--name-only', '-z', '--diff-filter=ACMR']),
    gitRun(root, ['ls-files', '--others', '--exclude-standard', '-z']),
  ];
  const paths = new Set();
  for (const list of lists) for (const raw of nulList(list)) {
    const rel = safeChangedPath(root, raw);
    if (JS_EXTENSIONS.has(extname(rel).toLowerCase()) && existsSync(resolve(root, rel))) paths.add(rel);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function testFiles(root, gitRun = git) {
  const output = gitRun(root, ['ls-files', '-z', '--', 'tests/*.test.mjs']);
  const tracked = nulList(output);
  const untracked = nulList(gitRun(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', 'tests/*.test.mjs']));
  return [...new Set([...tracked, ...untracked])].sort((a, b) => a.localeCompare(b));
}

function installedChromePreload() {
  if (!existsSync(CHROME)) return null;
  let playwrightPath;
  try { playwrightPath = createRequire(SCRIPT_PATH).resolve('playwright'); }
  catch { return null; }
  const esmPath = resolve(dirname(playwrightPath), 'index.mjs');
  const modulePath = existsSync(esmPath) ? esmPath : playwrightPath;
  const importStatement = modulePath.endsWith('.mjs')
    ? `import { chromium } from ${JSON.stringify(pathToFileURL(modulePath).href)};`
    : `import playwright from ${JSON.stringify(pathToFileURL(modulePath).href)};const { chromium }=playwright;`;
  const source = `${importStatement}const launch=chromium.launch.bind(chromium);chromium.launch=(options={})=>launch({...options,executablePath:${JSON.stringify(CHROME)}});`;
  return `data:text/javascript,${encodeURIComponent(source)}`;
}

export function buildValidationPlan({ root = DEFAULT_ROOT, base, gitRun = git } = {}) {
  const syntaxFiles = changedJavaScript({ root, base, gitRun });
  const tests = testFiles(root, gitRun);
  const nodeTestArgs = ['--test', ...tests];
  const preload = installedChromePreload();
  if (preload) nodeTestArgs.unshift(`--import=${preload}`);
  return [
    { name: 'pages', command: 'node', args: ['scripts/validate-pages.mjs'] },
    { name: 'node-tests', command: 'node', args: nodeTestArgs },
    { name: 'regulated-claims', command: 'node', args: ['scripts/check-regulated-claims.mjs', '--as-of', PUBLIC_DATE] },
    { name: 'authority', command: 'node', args: ['scripts/validate-authority.mjs'], env: { LHI_VALIDATION_DATE: PUBLIC_DATE } },
    { name: 'site-integrity', command: 'node', args: ['scripts/check-site-integrity.mjs'] },
    ...syntaxFiles.map((file) => ({ name: `syntax:${file}`, command: 'node', args: ['--check', file] })),
    { name: 'sitemap-xml', command: 'xmllint', args: ['--noout', 'sitemap.xml'] },
    { name: 'diff-working', command: 'git', args: ['diff', '--check'] },
    { name: 'diff-staged', command: 'git', args: ['diff', '--cached', '--check'] },
    { name: 'diff-base', command: 'git', args: ['diff', '--check', `${base}...HEAD`] },
  ];
}

function sanitize(value, root) {
  return String(value || '')
    .replaceAll(root, '<repo>')
    .split(/\r?\n/)
    .filter((line) => !/(token|secret|password|authorization|api[_-]?key)\s*[:=]/i.test(line))
    .join('\n').trim();
}

export function runValidationPlan(plan, { root = DEFAULT_ROOT, runner = spawnSync, stdout = process.stdout, stderr = process.stderr } = {}) {
  let failed = false;
  for (const step of plan) {
    if (failed) {
      stdout.write(`SKIP ${step.name}\n`);
      continue;
    }
    const result = runner(step.command, step.args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...step.env },
      shell: false,
    });
    if (!result.error && result.status === 0) {
      stdout.write(`PASS ${step.name}\n`);
      continue;
    }
    failed = true;
    stderr.write(`FAIL ${step.name}: ${result.error?.message || `exit ${result.status ?? 'unknown'}`}\n`);
    const diagnostic = sanitize(`${result.stdout || ''}\n${result.stderr || ''}`, root);
    if (diagnostic) stderr.write(`${diagnostic}\n`);
  }
  return failed ? 1 : 0;
}

export function parseArgs(argv) {
  if (argv.includes('--help')) return { help: true };
  if (argv.length === 0) return {};
  if (argv.length === 2 && argv[0] === '--base' && argv[1]) return { base: argv[1] };
  throw new Error('usage: node scripts/validate-local.mjs [--base <revision>]');
}

export function runCli(argv = process.argv.slice(2)) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) { process.stderr.write(`FAIL validate-local: ${error.message}\n`); return 2; }
  if (options.help) {
    process.stdout.write('Usage: node scripts/validate-local.mjs [--base <revision>]\nComparison base: explicit --base; otherwise origin/HEAD, origin/main, then local main; fails closed when none is trustworthy.\n');
    return 0;
  }
  try {
    const root = realpathSync(DEFAULT_ROOT);
    const base = selectComparisonBase({ root, explicitBase: options.base });
    if (base.rejectedSameFeatureUpstream) process.stdout.write('INFO comparison-base: same-feature upstream rejected\n');
    process.stdout.write(`INFO comparison-base: ${base.source} ${base.commit.slice(0, 12)}\n`);
    const plan = buildValidationPlan({ root, base: base.commit });
    if (!plan.some((step) => step.name.startsWith('syntax:'))) process.stdout.write('SKIP syntax:no changed JavaScript files\n');
    return runValidationPlan(plan, { root });
  } catch (error) {
    process.stderr.write(`FAIL validate-local: ${sanitize(error.message, DEFAULT_ROOT)}\n`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) process.exitCode = runCli();
