import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  buildValidationPlan,
  changedJavaScript,
  parseArgs,
  runValidationPlan,
  selectComparisonBase,
} from '../scripts/validate-local.mjs';

function fakeGit(responses) {
  return (_root, args) => {
    const key = args.join(' ');
    const value = responses.get(key);
    if (value instanceof Error) throw value;
    if (value === undefined) throw new Error(`unexpected git call: ${key}`);
    return value;
  };
}

function runGit(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(result.error?.message || result.stderr.trim() || `git exited ${result.status}`);
  }
  return allowFailure ? result : result.stdout;
}

function writeRepoFile(root, relativePath, contents = 'void 0;\n') {
  const full = join(root, relativePath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, contents);
}

function commitAll(root, message) {
  runGit(root, ['add', '--all']);
  runGit(root, ['commit', '-m', message]);
  return runGit(root, ['rev-parse', 'HEAD']).trim();
}

function syntheticRepository(t, { remote = true, originHead = true } = {}) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'lhi-base-selection-'));
  const work = join(fixtureRoot, 'work');
  const bare = join(fixtureRoot, 'origin.git');
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  if (remote) runGit(fixtureRoot, ['init', '--bare', '--initial-branch=main', bare]);
  runGit(fixtureRoot, ['init', '--initial-branch=main', work]);
  runGit(work, ['config', 'user.name', 'Synthetic Validator']);
  runGit(work, ['config', 'user.email', 'validator@example.invalid']);
  runGit(work, ['config', 'commit.gpgsign', 'false']);
  runGit(work, ['config', 'core.hooksPath', '/dev/null']);
  writeRepoFile(work, 'base.txt', 'base\n');
  writeRepoFile(work, 'scripts/existing.js', 'void 0;\n');
  const base = commitAll(work, 'base');
  if (remote) {
    runGit(work, ['remote', 'add', 'origin', bare]);
    runGit(work, ['push', '-u', 'origin', 'main']);
    if (originHead) runGit(work, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
  }
  return { fixtureRoot, work, bare, base };
}

function createFeature(work, branch, relativePath, { push = false } = {}) {
  runGit(work, ['switch', '-c', branch]);
  writeRepoFile(work, relativePath, "import { writeFileSync } from 'node:fs'; writeFileSync('VALIDATOR_EXECUTED', 'bad');\n");
  const head = commitAll(work, 'feature');
  if (push) runGit(work, ['push', '-u', 'origin', branch]);
  return head;
}

test('comparison-base selection is explicit, deterministic, and validates revisions', () => {
  const explicit = fakeGit(new Map([
    ['rev-parse --verify --quiet --end-of-options HEAD^{commit}', 'head999\n'],
    ['rev-parse --verify --quiet --end-of-options release^{commit}', 'abc123\n'],
    ['merge-base --all head999 abc123', 'abc123\n'],
  ]));
  assert.deepEqual(selectComparisonBase({ root: '/repo', explicitBase: 'release', gitRun: explicit }), {
    commit: 'abc123', source: '--base merge-base', rejectedSameFeatureUpstream: false,
  });
  assert.throws(() => selectComparisonBase({ root: '/repo', explicitBase: '--output=/tmp/x', gitRun: explicit }), /invalid/);
});

test('unpushed feature branch selects the remote symbolic default branch', (t) => {
  const { work, base } = syntheticRepository(t);
  createFeature(work, 'codex/unpushed', 'scripts/unpushed.mjs');
  const selected = selectComparisonBase({ root: work });
  assert.equal(selected.commit, base);
  assert.equal(selected.source, 'origin/HEAD -> origin/main merge-base');
  assert.equal(selected.rejectedSameFeatureUpstream, false);
});

test('pushed same-feature upstream is rejected without collapsing committed coverage', (t) => {
  const { work, base } = syntheticRepository(t);
  const filename = 'scripts/feature file;touch PWNED.mjs';
  const head = createFeature(work, 'codex/pushed-feature', filename, { push: true });
  assert.equal(runGit(work, ['rev-parse', '@{upstream}']).trim(), head);
  assert.equal(runGit(work, ['rev-parse', '--symbolic-full-name', '@{upstream}']).trim(), 'refs/remotes/origin/codex/pushed-feature');

  const first = selectComparisonBase({ root: work });
  const second = selectComparisonBase({ root: work });
  assert.deepEqual(second, first);
  assert.equal(first.commit, base);
  assert.notEqual(first.commit, head);
  assert.equal(first.source, 'origin/HEAD -> origin/main merge-base');
  assert.equal(first.rejectedSameFeatureUpstream, true);
  assert.equal(runGit(work, ['diff', '--name-only', `${first.commit}...HEAD`]).trim(), filename);
  assert.deepEqual(changedJavaScript({ root: work, base: first.commit }), [filename]);

  const plan = buildValidationPlan({ root: work, base: first.commit });
  const syntaxStep = plan.find((step) => step.name === `syntax:${filename}`);
  assert.deepEqual(syntaxStep, { name: `syntax:${filename}`, command: 'node', args: ['--check', filename] });
  assert.equal(runValidationPlan([syntaxStep], {
    root: work, stdout: { write() {} }, stderr: { write() {} },
  }), 0);
  assert.equal(existsSync(join(work, 'VALIDATOR_EXECUTED')), false);
  assert.equal(existsSync(join(work, 'PWNED.mjs')), false);
  t.diagnostic('same-feature upstream rejected; origin/HEAD selected; merge-base differs from HEAD; committed JavaScript retained');
});

test('origin/main is used when origin/HEAD is unavailable', (t) => {
  const { work, base } = syntheticRepository(t, { originHead: false });
  createFeature(work, 'codex/no-symbolic-default', 'scripts/fallback.js');
  const selected = selectComparisonBase({ root: work });
  assert.equal(selected.commit, base);
  assert.equal(selected.source, 'origin/main merge-base');
});

test('local main is a safe fallback and permits an unchanged main HEAD', (t) => {
  const { work, base } = syntheticRepository(t, { remote: false });
  const onMain = selectComparisonBase({ root: work });
  assert.equal(onMain.commit, base);
  assert.equal(onMain.source, 'local main merge-base');

  createFeature(work, 'codex/local-only', 'scripts/local-only.cjs');
  const onFeature = selectComparisonBase({ root: work });
  assert.equal(onFeature.commit, base);
  assert.equal(onFeature.source, 'local main merge-base');
});

test('automatic selection fails closed without a trustworthy default reference', (t) => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'lhi-no-base-'));
  const work = join(fixtureRoot, 'work');
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  runGit(fixtureRoot, ['init', '--initial-branch=feature', work]);
  runGit(work, ['config', 'user.name', 'Synthetic Validator']);
  runGit(work, ['config', 'user.email', 'validator@example.invalid']);
  writeRepoFile(work, 'one.txt', 'one\n');
  commitAll(work, 'one');
  writeRepoFile(work, 'two.txt', 'two\n');
  commitAll(work, 'two');
  assert.throws(() => selectComparisonBase({ root: work }), /no trustworthy comparison base/);
});

test('feature branch based on updated default uses the updated branch point', (t) => {
  const { work } = syntheticRepository(t);
  writeRepoFile(work, 'updated.txt', 'updated\n');
  const updatedMain = commitAll(work, 'updated main');
  runGit(work, ['push', 'origin', 'main']);
  createFeature(work, 'codex/after-update', 'scripts/after-update.js');
  const selected = selectComparisonBase({ root: work });
  assert.equal(selected.commit, updatedMain);
});

test('feature branch behind an advanced default fails instead of collapsing to feature HEAD', (t) => {
  const { work, base } = syntheticRepository(t);
  createFeature(work, 'codex/behind-default', 'scripts/behind.js');
  runGit(work, ['switch', 'main']);
  writeRepoFile(work, 'advanced.txt', 'advanced\n');
  commitAll(work, 'advance default');
  runGit(work, ['push', 'origin', 'main']);
  runGit(work, ['switch', 'codex/behind-default']);
  runGit(work, ['reset', '--hard', base]);
  assert.throws(() => selectComparisonBase({ root: work }), /collapsed to feature HEAD/);
});

test('real Git metadata includes committed, staged, unstaged, and untracked safe paths', (t) => {
  const { work } = syntheticRepository(t);
  const committed = 'scripts/committed file;safe.mjs';
  createFeature(work, 'codex/all-states', committed);
  const staged = 'scripts/staged $(safe).cjs';
  writeRepoFile(work, staged);
  runGit(work, ['add', '--', staged]);
  const working = 'scripts/existing.js';
  writeRepoFile(work, working, 'const changed = true;\n');
  const untracked = 'scripts/untracked [safe].js';
  writeRepoFile(work, untracked);
  const base = selectComparisonBase({ root: work });
  assert.deepEqual(
    changedJavaScript({ root: work, base: base.commit }),
    [committed, staged, working, untracked].sort((a, b) => a.localeCompare(b)),
  );
});

test('validator Git discovery is read-only, offline, deterministic, and artifact-free', (t) => {
  const { work } = syntheticRepository(t);
  createFeature(work, 'codex/audited', 'scripts/audited.js', { push: true });
  const beforeStatus = runGit(work, ['status', '--porcelain=v1', '-z']);
  const calls = [];
  const gitRun = (root, args) => {
    calls.push([...args]);
    return runGit(root, args);
  };
  const first = selectComparisonBase({ root: work, gitRun });
  const firstPlan = buildValidationPlan({ root: work, base: first.commit, gitRun });
  const second = selectComparisonBase({ root: work, gitRun });
  const secondPlan = buildValidationPlan({ root: work, base: second.commit, gitRun });
  assert.deepEqual(second, first);
  assert.deepEqual(secondPlan, firstPlan);
  assert.equal(runGit(work, ['status', '--porcelain=v1', '-z']), beforeStatus);
  assert.equal(existsSync(join(work, 'VALIDATOR_EXECUTED')), false);

  const readOnlyGitOperations = new Set(['rev-parse', 'symbolic-ref', 'merge-base', 'rev-list', 'diff', 'ls-files']);
  for (const args of calls) assert.ok(readOnlyGitOperations.has(args[0]), `unexpected validator Git operation: ${args[0]}`);
  const source = readFileSync(new URL('../scripts/validate-local.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\['(?:fetch|pull|push|clone|add|commit|merge|rebase|reset|clean|stash)'(?:,|\])/);
  assert.doesNotMatch(source, /\['remote',\s*'show'/);
  assert.doesNotMatch(source, /\b(?:curl|wget|npm|npx|netlify)\b|https?:\/\//);
  assert.doesNotMatch(source, /submit|form[_-]?submission/i);
});

test('changed JavaScript includes committed, staged, unstaged, and untracked files', () => {
  const root = mkdtempSync(join(tmpdir(), 'lhi-changed-js-'));
  try {
    for (const name of ['committed.js', 'staged.mjs', 'working.cjs', 'new.js']) writeFileSync(join(root, name), 'void 0;');
    const gitRun = fakeGit(new Map([
      ['diff --name-only -z --diff-filter=ACMR base...HEAD', 'committed.js\0'],
      ['diff --cached --name-only -z --diff-filter=ACMR', 'staged.mjs\0'],
      ['diff --name-only -z --diff-filter=ACMR', 'working.cjs\0'],
      ['ls-files --others --exclude-standard -z', 'new.js\0notes.txt\0'],
    ]));
    assert.deepEqual(changedJavaScript({ root, base: 'base', gitRun }), ['committed.js', 'new.js', 'staged.mjs', 'working.cjs']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('changed path validation rejects traversal', () => {
  const root = mkdtempSync(join(tmpdir(), 'lhi-changed-escape-'));
  try {
    const gitRun = fakeGit(new Map([
      ['diff --name-only -z --diff-filter=ACMR base...HEAD', '../escape.js\0'],
      ['diff --cached --name-only -z --diff-filter=ACMR', ''],
      ['diff --name-only -z --diff-filter=ACMR', ''],
      ['ls-files --others --exclude-standard -z', ''],
    ]));
    assert.throws(() => changedJavaScript({ root, base: 'base', gitRun }), /unsafe changed path/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('site-integrity failure propagates, stops execution, and reports later steps as skipped', () => {
  const out = [];
  const err = [];
  const calls = [];
  const plan = [
    { name: 'one', command: 'node', args: ['one.mjs'] },
    { name: 'site-integrity', command: 'node', args: ['scripts/check-site-integrity.mjs'] },
    { name: 'three', command: 'node', args: ['three.mjs'] },
  ];
  const status = runValidationPlan(plan, {
    root: '/repo',
    runner(command, args) { calls.push([command, args]); return { status: calls.length === 2 ? 7 : 0, stdout: '', stderr: '' }; },
    stdout: { write(value) { out.push(value); } },
    stderr: { write(value) { err.push(value); } },
  });
  assert.equal(status, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls, [
    ['node', ['one.mjs']],
    ['node', ['scripts/check-site-integrity.mjs']],
  ]);
  assert.match(out.join(''), /PASS one/);
  assert.match(out.join(''), /SKIP three/);
  assert.match(err.join(''), /FAIL site-integrity: exit 7/);
});

test('runner preserves repository state and never invokes a shell', () => {
  const root = mkdtempSync(join(tmpdir(), 'lhi-artifact-free-'));
  try {
    writeFileSync(join(root, 'sentinel'), 'unchanged');
    const before = readdirSync(root);
    const optionsSeen = [];
    assert.equal(runValidationPlan([{ name: 'safe', command: 'node', args: ['--check', 'safe.js'] }], {
      root,
      runner(_command, _args, options) { optionsSeen.push(options); return { status: 0, stdout: '', stderr: '' }; },
      stdout: { write() {} }, stderr: { write() {} },
    }), 0);
    assert.deepEqual(readdirSync(root), before);
    assert.equal(optionsSeen[0].shell, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('real validation plan is offline, non-mutating, and uses argument arrays', () => {
  const root = new URL('..', import.meta.url).pathname;
  const plan = buildValidationPlan({ root, base: 'HEAD^' });
  assert.ok(plan.some((step) => step.name === 'site-integrity'));
  assert.ok(plan.some((step) => step.name === 'node-tests'));
  for (const step of plan) {
    assert.ok(Array.isArray(step.args));
    assert.ok(['node', 'git', 'xmllint'].includes(step.command));
    assert.ok(!['add', 'commit', 'push', 'fetch', 'pull', 'merge', 'rebase', 'reset', 'clean'].includes(step.args[0]));
    assert.doesNotMatch(step.command, /curl|wget|npm|npx|netlify/);
  }
});

test('argument parser rejects unknown and incomplete options', () => {
  assert.deepEqual(parseArgs([]), {});
  assert.deepEqual(parseArgs(['--base', 'HEAD~2']), { base: 'HEAD~2' });
  assert.throws(() => parseArgs(['--base']), /usage/);
  assert.throws(() => parseArgs(['--root', '/tmp']), /usage/);
});
