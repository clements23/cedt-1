import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-test-'));
process.env.CEDT1_HOME = tmp;

const { newRule, validateRule } = await import('../src/store/schema.js');
const { addRule, loadAll, loadCategory, saveCategory, reinforce, supersede, resolveConflicts, ensureStore, paths } = await import('../src/store/index.js');

test('newRule creates a valid rule with defaults', () => {
  const r = newRule({ text: 'Use spaces, not tabs.' });
  assert.ok(r.id);
  assert.equal(r.text, 'Use spaces, not tabs.');
  assert.equal(r.category, 'general');
  assert.equal(r.scope, 'global');
  assert.equal(r.confidence, 0.5);
  assert.equal(r.source, 'learned');
});

test('newRule accepts overrides', () => {
  const r = newRule({ text: 'Always format on save.', category: 'code', confidence: 0.9, scope: 'global', source: 'explicit' });
  assert.equal(r.category, 'code');
  assert.equal(r.confidence, 0.9);
  assert.equal(r.source, 'explicit');
});

test('validateRule passes for valid rules', () => {
  const r = newRule({ text: 'Use TypeScript.', category: 'code' });
  const errs = validateRule(r);
  assert.equal(errs.length, 0);
});

test('validateRule rejects empty text', () => {
  const r = newRule({ text: '' });
  const errs = validateRule(r);
  assert.ok(errs.some((e) => e.includes('text')));
});

test('validateRule rejects bad confidence', () => {
  const errs = validateRule({ text: 'x', confidence: 1.5, source: 'learned', scope: 'global' });
  assert.ok(errs.some((e) => e.includes('confidence')));
});

test('validateRule requires domain when scope is domain', () => {
  const r = newRule({ text: 'x', scope: 'domain' });
  const errs = validateRule(r);
  assert.ok(errs.some((e) => e.includes('domain')));
});

test('addRule persists and returns rule', () => {
  ensureStore();
  const r = addRule({ text: 'Test rule one.', category: 'test-cat' });
  assert.ok(r.id);
  assert.equal(r.text, 'Test rule one.');

  const loaded = loadCategory('test-cat');
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].text, 'Test rule one.');
});

test('addRule deduplicates by text + scope', () => {
  const r1 = addRule({ text: 'Duplicate rule.', category: 'test-cat', confidence: 0.5 });
  const r2 = addRule({ text: 'Duplicate rule.', category: 'test-cat', confidence: 0.5 });
  assert.equal(r1.id, r2.id);
  assert.ok(r2.confidence > 0.5, 'should have been reinforced');
});

test('addRule is case-insensitive for dedup', () => {
  const r1 = addRule({ text: 'CASE TEST.', category: 'test-cat' });
  const r2 = addRule({ text: 'case test.', category: 'test-cat' });
  assert.equal(r1.id, r2.id);
});

test('addRule different scopes are different rules', () => {
  const r1 = addRule({ text: 'Scoped rule.', category: 'test-cat', scope: 'global' });
  const r2 = addRule({ text: 'Scoped rule.', category: 'test-cat', scope: 'domain', domain: 'react' });
  assert.notEqual(r1.id, r2.id);
});

test('reinforce bumps confidence and timestamps', () => {
  const r = newRule({ text: 'Reinforce me.', category: 'test-cat', confidence: 0.7 });
  const reinforced = reinforce(r, { kind: 'test' });
  assert.equal(reinforced.confidence, 0.75);
  assert.ok(reinforced.last_reinforced >= r.last_reinforced, 'last_reinforced should be >= original');
  assert.equal(reinforced.evidence.length, r.evidence.length + 1);
});

test('reinforce caps at 0.99', () => {
  const r = newRule({ text: 'Near max.', category: 'test-cat', confidence: 0.98 });
  const reinforced = reinforce(r);
  assert.equal(reinforced.confidence, 0.99);
});

test('supersede creates new rule and marks old', () => {
  const old = addRule({ text: 'Old rule.', category: 'test-cat' });
  const updated = supersede(old.id, { text: 'New rule.', category: 'test-cat' });
  assert.equal(updated.supersedes.includes(old.id), true);

  const reloaded = loadCategory('test-cat');
  const oldReloaded = reloaded.find((r) => r.id === old.id);
  assert.equal(oldReloaded.superseded_by, updated.id);
});

test('resolveConflicts picks higher confidence', () => {
  addRule({ text: 'Use Mongo.', category: 'code', confidence: 0.6, conflicts_with: ['x'] });
  addRule({ text: 'Use Postgres.', category: 'code', confidence: 0.9, conflicts_with: ['x'] });

  const all = loadAll();
  const mongo = all.find((r) => r.text === 'Use Mongo.');
  const pg = all.find((r) => r.text === 'Use Postgres.');
  mongo.conflicts_with = [pg.id];
  pg.conflicts_with = [mongo.id];

  const cat = loadCategory('code').map((r) => {
    if (r.id === mongo.id) return mongo;
    if (r.id === pg.id) return pg;
    return r;
  });
  saveCategory('code', cat);

  const reloaded = loadAll();
  const { rules, conflicts } = resolveConflicts(reloaded);
  assert.ok(conflicts.length > 0, 'should have detected conflicts');

  const winner = rules.find((r) => r.text === 'Use Postgres.');
  assert.ok(winner, 'higher confidence should win');
});

test('loadAll returns rules from all categories', () => {
  addRule({ text: 'Cat A rule.', category: 'cat-a' });
  addRule({ text: 'Cat B rule.', category: 'cat-b' });
  const all = loadAll();
  assert.ok(all.some((r) => r.text === 'Cat A rule.'));
  assert.ok(all.some((r) => r.text === 'Cat B rule.'));
});

// cleanup
test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});
