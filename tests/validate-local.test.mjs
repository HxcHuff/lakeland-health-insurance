import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('comparison-base selection is explicit, deterministic, and validates revisions', () => {
  const explicit = fakeGit(new Map([['rev-parse --verify --quiet --end-of-options release^{commit}', 'abc123\n']]));
  assert.deepEqual(selectComparisonBase({ root: '/repo', explicitBase: 'release', gitRun: explicit }), { commit: 'abc123', source: '--base' });
  assert.throws(() => selectComparisonBase({ root: '/repo', explicitBase: '--output=/tmp/x', gitRun: explicit }), /invalid/);

  const fallback = fakeGit(new Map([
    ['rev-parse --verify --quiet --end-of-options @{upstream}^{commit}', new Error('none')],
    ['rev-parse --verify --quiet --end-of-options origin/main^{commit}', 'def456\n'],
    ['merge-base HEAD origin/main', 'base789\n'],
  ]));
  assert.deepEqual(selectComparisonBase({ root: '/repo', gitRun: fallback }), { commit: 'base789', source: 'origin/main merge-base' });
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
