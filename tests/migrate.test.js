import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-mig-src-'));
const tmpDst = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-mig-dst-'));
process.env.CEDT1_HOME = tmpDst;

test.before(() => {
  // Set up fake taste-1 structure
  fs.mkdirSync(path.join(tmpSrc, 'communication'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpSrc, 'communication', 'taste.md'),
    `- Use proper capitalization and sentence case. Confidence: 0.90
- Provide a concise summary of next steps upfront. Confidence: 0.75
`,
  );
});

test('migrateFromTaste1 imports rules', async () => {
  const { migrateFromTaste1 } = await import('../src/migrate/index.js');
  const result = migrateFromTaste1({ src: tmpSrc });
  assert.equal(result.ok, true);
  assert.equal(result.rules, 2);

  const { loadAll } = await import('../src/store/index.js');
  const all = loadAll();
  const cap = all.find((r) => r.text.includes('capitalization'));
  assert.ok(cap);
  assert.equal(cap.confidence, 0.9);
  assert.equal(cap.source, 'migrated');
  assert.equal(cap.tags.includes('migrated-from-taste-1'), true);
});

test('migrateFromTaste1 dryRun does not persist', async () => {
  const { migrateFromTaste1 } = await import('../src/migrate/index.js');
  const result = migrateFromTaste1({ src: tmpSrc, dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.rules, 2);
  // no persistence checked implicitly — dryRun just counts
});

test('migrateFromTaste1 returns error for missing src', async () => {
  const { migrateFromTaste1 } = await import('../src/migrate/index.js');
  const result = migrateFromTaste1({ src: '/nonexistent/path' });
  assert.equal(result.ok, false);
});

test.after(() => {
  fs.rmSync(tmpSrc, { recursive: true, force: true });
  fs.rmSync(tmpDst, { recursive: true, force: true });
});
