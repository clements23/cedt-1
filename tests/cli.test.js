import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const cli = path.join(repo, 'src', 'cli', 'index.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-cli-'));
const env = {
  ...process.env,
  CEDT1_HOME: tmp,
  // Point migration sources away from the host machine's real config stores.
  CEDT1_YAML_SRC: path.join(tmp, 'no-such-yaml-src'),
  CEDT1_MD_SRC: path.join(tmp, 'no-such-md-src'),
  CEDT1_LESSONS_SRC: path.join(tmp, 'no-such-lessons.md'),
  CEDT1_EXTRACTOR_URL: '',
};

function run(...argv) {
  const res = spawnSync(process.execPath, [cli, ...argv], { encoding: 'utf8', env });
  return { ...res, out: res.stdout.trim(), err: res.stderr.trim() };
}

const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));

test('version prints package version', () => {
  const r = run('version');
  assert.equal(r.status, 0);
  assert.equal(r.out, pkg.version);
});

test('help and --help list every command', () => {
  for (const flag of ['help', '--help', '-h']) {
    const r = run(flag);
    assert.equal(r.status, 0);
    for (const cmd of ['status', 'add', 'learn', 'migrate', 'decay', 'export', 'inject', 'sync', 'init', 'list', 'version']) {
      assert.ok(r.out.includes(cmd), `usage should mention ${cmd} (${flag})`);
    }
  }
});

test('no arguments prints usage', () => {
  const r = run();
  assert.equal(r.status, 0);
  assert.ok(r.out.includes('Continuous Experience-Driven Tuning'));
});

test('add persists a rule and status reports it', () => {
  const added = run('add', 'Never use em dashes.', '--cat', 'content', '--conf', '0.9');
  assert.equal(added.status, 0, added.err);
  const rule = JSON.parse(added.out);
  assert.equal(rule.text, 'Never use em dashes.');
  assert.equal(rule.category, 'content');
  assert.equal(rule.source, 'explicit');

  const status = run('status');
  assert.equal(status.status, 0, status.err);
  const parsed = JSON.parse(status.out);
  assert.equal(parsed.total, 1);
  assert.equal(parsed.by_category.content, 1);
});

test('add rejects an empty rule', () => {
  const r = run('add');
  assert.equal(r.status, 1);
  assert.match(r.err, /usage: cedt1 add/);
});

test('learn extracts a rule from a correction', () => {
  const r = run('learn', "No, don't use default exports in this project.");
  assert.equal(r.status, 0, r.err);
  const rule = JSON.parse(r.out);
  assert.equal(rule.source, 'learned');
  assert.equal(rule.category, 'code');
  assert.match(rule.text, /^Never /);
  assert.equal(rule.evidence[0].kind, 'user-correction');
});

test('learn requires correction text', () => {
  const r = run('learn');
  assert.equal(r.status, 1);
  assert.match(r.err, /usage: cedt1 learn/);
});

test('list returns JSON rules', () => {
  const r = run('list');
  assert.equal(r.status, 0, r.err);
  const rules = JSON.parse(r.out);
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 2);
  assert.ok(rules.every((x) => x.id && x.text && typeof x.confidence === 'number'));
});

test('export writes markdown to --out', () => {
  const out = path.join(tmp, 'export.md');
  const r = run('export', '--out', out);
  assert.equal(r.status, 0, r.err);
  const md = fs.readFileSync(out, 'utf8');
  assert.match(md, /CEDT-1 Tuning Profile/);
  assert.match(md, /\[BINDING\]/);
});

test('inject writes the tuning profile to --out', () => {
  const out = path.join(tmp, 'memory', 'tuning-profile.md');
  const r = run('inject', '--out', out);
  assert.equal(r.status, 0, r.err);
  const result = JSON.parse(r.out);
  assert.equal(result.wrote, true);
  assert.ok(fs.existsSync(out));
  assert.match(fs.readFileSync(out, 'utf8'), /Never use em dashes\./);
});

test('decay runs and reports stats', () => {
  const r = run('decay');
  assert.equal(r.status, 0, r.err);
  const stats = JSON.parse(r.out);
  assert.deepEqual(Object.keys(stats), ['decayed', 'archived', 'deleted']);
});

test('migrate --dry-run does not crash on missing sources', () => {
  const r = run('migrate', '--from', 'yaml', '--dry-run');
  assert.equal(r.status, 0, r.err);
  const result = JSON.parse(r.out);
  assert.equal(result.ok, false);
  assert.match(result.reason, /rules not found/);
});

test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});
