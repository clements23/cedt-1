import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-mig-src-'));
const tmpDst = fs.mkdtempSync(path.join(os.tmpdir(), 'cedt1-mig-dst-'));
process.env.CEDT1_HOME = tmpDst;

test.before(() => {
  // Set up fake migration source with markdown format
  fs.mkdirSync(path.join(tmpSrc, 'communication'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpSrc, 'communication', 'taste.md'),
    `- Use proper capitalization and sentence case. Confidence: 0.90
- Provide a concise summary of next steps upfront. Confidence: 0.75
`,
  );
});

test('migrateFromMarkdown imports rules', async () => {
  const { migrateFromMarkdown } = await import('../src/migrate/index.js');
  const result = migrateFromMarkdown({ src: tmpSrc });
  assert.equal(result.ok, true);
  assert.equal(result.rules, 2);

  const { loadAll } = await import('../src/store/index.js');
  const all = loadAll();
  const cap = all.find((r) => r.text.includes('capitalization'));
  assert.ok(cap);
  assert.equal(cap.confidence, 0.9);
  assert.equal(cap.source, 'migrated');
  assert.equal(cap.tags.includes('migrated-from-md'), true);
});

test('migrateFromMarkdown dryRun does not persist', async () => {
  const { migrateFromMarkdown } = await import('../src/migrate/index.js');
  const result = migrateFromMarkdown({ src: tmpSrc, dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.rules, 2);
});

test('migrateFromMarkdown returns error for missing src', async () => {
  const { migrateFromMarkdown } = await import('../src/migrate/index.js');
  const result = migrateFromMarkdown({ src: '/nonexistent/path' });
  assert.equal(result.ok, false);
});

test('migrateFromYaml returns error for missing src', async () => {
  const { migrateFromYaml } = await import('../src/migrate/index.js');
  const result = migrateFromYaml({ src: '/nonexistent/path' });
  assert.equal(result.ok, false);
});

test.after(() => {
  fs.rmSync(tmpSrc, { recursive: true, force: true });
  fs.rmSync(tmpDst, { recursive: true, force: true });
});
