import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicExtract, inferCategory } from '../src/extract/index.js';

test('heuristicExtract catches never-do', () => {
  const out = heuristicExtract("No, don't use em dashes in content.");
  assert.ok(out);
  assert.match(out.text, /Never/);
  assert.ok(out.tags.includes('negation'));
});

test('heuristicExtract catches always-do', () => {
  const out = heuristicExtract("Always use TypeScript for CLI tools.");
  assert.ok(out);
  assert.match(out.text, /Always/);
  assert.ok(out.tags.includes('affirmation'));
});

test('heuristicExtract catches prefer-over', () => {
  const out = heuristicExtract("Use pnpm instead of npm.");
  assert.ok(out);
  assert.match(out.text, /pnpm/);
  assert.match(out.text, /npm/);
  assert.ok(out.tags.includes('preference'));
});

test('heuristicExtract catches capitalization', () => {
  const out = heuristicExtract("Always capitalize TypeScript.");
  assert.ok(out);
  assert.match(out.text, /TypeScript/);
  assert.ok(out.tags.includes('capitalization'));
});

test('heuristicExtract returns null for non-correction', () => {
  const out = heuristicExtract("Can you help me with this file?");
  assert.equal(out, null);
});

test('inferCategory recognizes content keywords', () => {
  assert.equal(inferCategory('use proper case in linkedin posts'), 'content');
  assert.equal(inferCategory('the ai sift articles need hashtags'), 'content');
  assert.equal(inferCategory('do not use em dashes in blog drafts'), 'content');
});

test('inferCategory recognizes communication keywords', () => {
  assert.equal(inferCategory('be more granular in step-by-step instructions'), 'communication');
  assert.equal(inferCategory('always use absolute paths for file locations'), 'communication');
});

test('inferCategory recognizes code keywords', () => {
  assert.equal(inferCategory('use TypeScript for this function'), 'code');
  assert.equal(inferCategory('react components should use named exports'), 'code');
});

test('inferCategory recognizes git keywords', () => {
  assert.equal(inferCategory('always write a descriptive commit message'), 'git');
  assert.equal(inferCategory('squash before creating the PR'), 'git');
});

test('inferCategory recognizes deploy keywords', () => {
  assert.equal(inferCategory('verify the vercel deploy succeeded'), 'deploy');
  assert.equal(inferCategory('always run npm run build before pushing'), 'deploy');
});

test('inferCategory recognizes client-work keywords', () => {
  assert.equal(inferCategory('in the ydn weekly report, include reach'), 'client-work');
  assert.equal(inferCategory('lifted client reports should use green for positive'), 'client-work');
});

test('inferCategory falls back to general', () => {
  assert.equal(inferCategory('this is a random statement about nothing specific'), 'general');
});
