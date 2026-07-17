#!/usr/bin/env node
// cedt1 — Continuous Experience-Driven Taste engine CLI.

import fs from 'node:fs';
import { addRule, loadAll, resolveConflicts } from '../store/index.js';
import { migrateAll, migrateFromYaml, migrateFromMarkdown, migrateFromLessons } from '../migrate/index.js';
import { decay } from '../decay/index.js';
import { sync, ensureRepo } from '../sync/index.js';
import { exportMarkdown } from './export.js';
import { writeProfile } from '../opencode/inject.js';

const args = process.argv.slice(2);
const cmd = args[0];

function usage() {
  console.log(`cedt1 — Continuous Experience-Driven Taste engine

Commands:
  status                        Show rule counts by category + conflict summary
  add <text> [--cat X] [--conf 0..1] [--domain X] [--tags a,b]
                                Add a rule explicitly
  migrate [--from yaml|md|lessons|all] [--dry-run]
                                Import from YAML stores, markdown configs, or lessons logs
  decay                         Run confidence decay + archive/prune
  export [--out PATH]           Emit plain markdown for any agent to read
  inject [--out PATH]           Write taste profile to opencode memory dir
  sync [--no-push]              Commit + pull --rebase + push
  init [--remote URL]           Initialize git repo + optional remote
  list [--cat X]                List all rules (JSON)
  learn <correction>            Extract and persist a rule from a correction
`);
}

async function main() {
  switch (cmd) {
    case 'status':
      return statusCmd();
    case 'add':
      return addCmd(args.slice(1));
    case 'migrate':
      return migrateCmd(args.slice(1));
    case 'decay':
      return console.log(JSON.stringify(decay(), null, 2));
    case 'export':
      return exportCmd(args.slice(1));
    case 'inject':
      return injectCmd(args.slice(1));
    case 'sync':
      return console.log(JSON.stringify(sync({ push: !args.includes('--no-push') }), null, 2));
    case 'init':
      return console.log(JSON.stringify(ensureRepo({ remote: flag(args, '--remote') }), null, 2));
    case 'list':
      return listCmd(args.slice(1));
    case 'learn':
      return await learnCmd(args.slice(1));
    default:
      usage();
  }
}

function statusCmd() {
  const rules = loadAll();
  const { conflicts } = resolveConflicts(rules);
  const byCat = rules.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ total: rules.length, by_category: byCat, conflicts }, null, 2));
}

function addCmd(argv) {
  const text = argv.filter((a) => !a.startsWith('--')).join(' ');
  if (!text) throw new Error('usage: cedt1 add <text> [--cat X] [--conf 0..1]');
  const rule = addRule({
    text,
    category: flag(argv, '--cat') ?? 'general',
    confidence: parseFloat(flag(argv, '--conf') ?? '0.7'),
    domain: flag(argv, '--domain') ?? null,
    scope: flag(argv, '--domain') ? 'domain' : 'global',
    source: 'explicit',
    tags: (flag(argv, '--tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
  });
  console.log(JSON.stringify(rule, null, 2));
}

function migrateCmd(argv) {
  const from = flag(argv, '--from') ?? 'all';
  const dryRun = argv.includes('--dry-run');
  let result;
  switch (from) {
    case 'yaml':
      result = migrateFromYaml({ dryRun });
      break;
    case 'md':
      result = migrateFromMarkdown({ dryRun });
      break;
    case 'lessons':
      result = migrateFromLessons({ dryRun });
      break;
    default:
      result = migrateAll({ dryRun });
  }
  console.log(JSON.stringify(result, null, 2));
}

function exportCmd(argv) {
  const out = flag(argv, '--out');
  const md = exportMarkdown();
  if (out) {
    fs.writeFileSync(out, md);
    console.log(`wrote ${out}`);
  } else {
    console.log(md);
  }
}

function injectCmd(argv) {
  const out = flag(argv, '--out');
  const result = writeProfile({ out });
  console.log(JSON.stringify(result, null, 2));
}

function listCmd(argv) {
  const cat = flag(argv, '--cat');
  const rules = cat ? loadAll().filter((r) => r.category === cat) : loadAll();
  console.log(JSON.stringify(rules, null, 2));
}

async function learnCmd(argv) {
  const correction = argv.filter((a) => !a.startsWith('--')).join(' ');
  if (!correction) throw new Error('usage: cedt1 learn <correction text>');
  const { extract } = await import('../extract/index.js');
  const candidate = await extract(correction);
  const rule = addRule(candidate);
  console.log(JSON.stringify(rule, null, 2));
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  return argv[i + 1] ?? null;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
