import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-profile-'));
process.env.CEDT1_HOME = tmp;

const { addRule, ensureStore, loadAll, resolveConflicts, saveCategory, loadCategory } =
  await import('../src/store/index.js');
const { exportMarkdown } = await import('../src/cli/export.js');
const { injectContext, writeProfile } = await import('../src/opencode/inject.js');

function seedRules() {
  ensureStore();
  saveCategory('code', []);
  saveCategory('content', []);
  addRule({ text: 'Use named exports, never default exports.', category: 'code', confidence: 0.95 });
  addRule({ text: 'Ship a LinkedIn draft with every article.', category: 'content', confidence: 0.7 });
  addRule({ text: 'Consider grouping related imports.', category: 'code', confidence: 0.4 });
  addRule({ text: 'Use Mongo.', category: 'code', confidence: 0.6 });
  addRule({ text: 'Use Postgres.', category: 'code', confidence: 0.9 });

  const all = loadAll();
  const mongo = all.find((r) => r.text === 'Use Mongo.');
  const pg = all.find((r) => r.text === 'Use Postgres.');
  mongo.conflicts_with = [pg.id];
  pg.conflicts_with = [mongo.id];
  saveCategory('code', loadCategory('code').map((r) => {
    if (r.id === mongo.id) return mongo;
    if (r.id === pg.id) return pg;
    return r;
  }));
}

seedRules();

test('exportMarkdown groups rules by category with binding levels', () => {
  const md = exportMarkdown();
  assert.match(md, /^# CEDT-1 Tuning Profile/m);
  assert.match(md, /^## code$/m);
  assert.match(md, /^## content$/m);
  assert.match(md, /named exports.*\[BINDING\] \(confidence: 0\.95\)/);
  assert.match(md, /LinkedIn draft.*\[PREFERRED\] \(confidence: 0\.70\)/);
  assert.match(md, /grouping related imports.*\[SUGGESTION\] \(confidence: 0\.40\)/);
});

test('exportMarkdown drops rules below minConfidence', () => {
  const md = exportMarkdown({ minConfidence: 0.5 });
  assert.ok(!md.includes('grouping related imports'));
  assert.ok(md.includes('named exports'));
});

test('exportMarkdown surfaces the conflict winner only', () => {
  const md = exportMarkdown();
  assert.ok(md.includes('Use Postgres.'));
  assert.ok(!md.includes('Use Mongo.'));
});

test('resolveConflicts reports the loser', () => {
  const { conflicts } = resolveConflicts(loadAll());
  assert.equal(conflicts.length, 1);
  const mongo = loadAll().find((r) => r.text === 'Use Mongo.');
  const pg = loadAll().find((r) => r.text === 'Use Postgres.');
  assert.equal(conflicts[0].winner, pg.id);
  assert.deepEqual(conflicts[0].losers, [mongo.id]);
});

test('injectContext includes the suggested tier by default', () => {
  const md = injectContext();
  assert.ok(md.includes('grouping related imports'), 'conf 0.40 rules should be injected');
  assert.match(md, /\[BINDING/);
  assert.match(md, /\[PREFERRED/);
  assert.match(md, /\[SUGGEST/);
});

test('injectContext respects minConfidence and maxRules', () => {
  const strict = injectContext({ minConfidence: 0.65 });
  assert.ok(!strict.includes('grouping related imports'));
  assert.ok(strict.includes('named exports'));

  const capped = injectContext({ maxRules: 1 });
  assert.equal(capped.match(/^- /gm).length, 1);
});

test('injectContext returns null when no rules qualify', () => {
  assert.equal(injectContext({ minConfidence: 1.1 }), null);
});

test('writeProfile writes the profile to disk', () => {
  const out = path.join(tmp, 'profile', 'tuning-profile.md');
  const result = writeProfile({ out });
  assert.equal(result.wrote, true);
  assert.ok(fs.existsSync(out));
  assert.ok(result.bytes > 0);
  assert.match(fs.readFileSync(out, 'utf8'), /CEDT-1 Tuning Profile/);
});

test('writeProfile reports no rules instead of throwing', () => {
  const out = path.join(tmp, 'empty-profile.md');
  const result = writeProfile({ out, minConfidence: 1.1 });
  assert.equal(result.wrote, false);
  assert.ok(!fs.existsSync(out));
});

test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});
