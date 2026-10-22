import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-decay-'));
process.env.CEDT1_HOME = tmp;

const { saveCategory, loadCategory, paths, ensureStore } = await import('../src/store/index.js');
const { decay } = await import('../src/decay/index.js');

const DAY = 86400000;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY).toISOString();
}

function seed(rules) {
  ensureStore();
  // Each test starts from a clean archive so assertions stay isolated.
  fs.rmSync(path.join(paths.STATE_DIR, 'archive.yaml'), { force: true });
  saveCategory('test-cat', rules.map((r) => ({
    id: r.id,
    text: r.text,
    category: 'test-cat',
    scope: 'global',
    domain: null,
    confidence: r.confidence,
    source: 'learned',
    evidence: [],
    supersedes: [],
    superseded_by: null,
    conflicts_with: [],
    tags: [],
    ttl_days: r.ttl_days ?? null,
    created_at: isoDaysAgo(r.silentDays),
    last_reinforced: isoDaysAgo(r.silentDays),
    notes: null,
  })));
}

function readArchive() {
  const file = path.join(paths.STATE_DIR, 'archive.yaml');
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  return raw.trim() ? yaml.parse(raw) : [];
}

test('decay subtracts 0.01/day for silent rules', () => {
  seed([{ id: 'd1', text: 'Recent rule.', confidence: 0.9, silentDays: 10 }]);
  const stats = decay();
  assert.equal(stats.decayed, 1);
  assert.equal(stats.archived, 0);
  assert.equal(stats.deleted, 0);
  assert.equal(loadCategory('test-cat')[0].confidence, 0.8);
});

test('decay leaves recently reinforced rules alone', () => {
  seed([{ id: 'd2', text: 'Fresh rule.', confidence: 0.9, silentDays: 0 }]);
  const stats = decay();
  assert.equal(stats.decayed, 0);
  assert.equal(stats.archived, 0);
  assert.equal(stats.deleted, 0);
  assert.equal(loadCategory('test-cat')[0].confidence, 0.9);
});

test('decay archives rules below 0.25', () => {
  seed([{ id: 'd3', text: 'Stale rule.', confidence: 0.7, silentDays: 46 }]);
  const stats = decay();
  assert.equal(stats.archived, 1);
  assert.equal(loadCategory('test-cat').length, 0);

  const archived = readArchive();
  assert.equal(archived.length, 1);
  assert.equal(archived[0].text, 'Stale rule.');
  assert.equal(archived[0].confidence, 0.24);
  assert.ok(archived[0].archived_at);
});

test('decay keeps a rule at exactly the archive floor', () => {
  seed([{ id: 'd4', text: 'Boundary rule.', confidence: 0.7, silentDays: 45 }]);
  const stats = decay();
  assert.equal(stats.archived, 0);
  assert.equal(stats.decayed, 1);
  assert.equal(loadCategory('test-cat')[0].confidence, 0.25);
});

test('decay deletes rules below 0.10 instead of archiving them', () => {
  seed([{ id: 'd5', text: 'Dead rule.', confidence: 0.05, silentDays: 0 }]);
  const stats = decay();
  assert.equal(stats.deleted, 1);
  assert.equal(stats.archived, 0);
  assert.equal(loadCategory('test-cat').length, 0);
  assert.equal(readArchive().length, 0);
});

test('decay archives rules past their ttl even at high confidence', () => {
  seed([{ id: 'd6', text: 'Expired rule.', confidence: 0.9, silentDays: 20, ttl_days: 10 }]);
  const stats = decay();
  assert.equal(stats.archived, 1);
  assert.equal(loadCategory('test-cat').length, 0);
  assert.equal(readArchive()[0].text, 'Expired rule.');
});

test('decay skips superseded rules', () => {
  ensureStore();
  fs.rmSync(path.join(paths.STATE_DIR, 'archive.yaml'), { force: true });
  saveCategory('test-cat', [{
    id: 'd7',
    text: 'Superseded rule.',
    category: 'test-cat',
    scope: 'global',
    domain: null,
    confidence: 0.05,
    source: 'learned',
    evidence: [],
    supersedes: [],
    superseded_by: 'newer-id',
    conflicts_with: [],
    tags: [],
    ttl_days: null,
    created_at: isoDaysAgo(300),
    last_reinforced: isoDaysAgo(300),
    notes: null,
  }]);
  const stats = decay();
  assert.equal(stats.deleted, 0);
  assert.equal(stats.archived, 0);
  assert.equal(loadCategory('test-cat').length, 1);
});

test('decay writes run metadata to state/decay.json', () => {
  seed([{ id: 'd8', text: 'Meta rule.', confidence: 0.9, silentDays: 1 }]);
  decay();
  const meta = JSON.parse(fs.readFileSync(paths.decay, 'utf8'));
  assert.ok(meta.last_run);
  assert.ok(meta.stats);
});

test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});
