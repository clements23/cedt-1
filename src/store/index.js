// Persistent store backed by one YAML file per category under ~/.cedt1/rules/<category>.yaml.
// File-per-category keeps each file small, diff-friendly, and avoids merge conflicts.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { newRule, validateRule } from './schema.js';

const ROOT = process.env.CEDT1_HOME ?? path.join(os.homedir(), '.cedt1');
const RULES_DIR = path.join(ROOT, 'rules');
const STATE_DIR = path.join(ROOT, 'state');

export const paths = {
  ROOT,
  RULES_DIR,
  STATE_DIR,
  evidence: path.join(STATE_DIR, 'evidence.jsonl'),
  decay: path.join(STATE_DIR, 'decay.json'),
};

export function ensureStore() {
  fs.mkdirSync(RULES_DIR, { recursive: true });
  fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(paths.evidence)) fs.writeFileSync(paths.evidence, '');
}

function ruleFile(category) {
  return path.join(RULES_DIR, `${slug(category)}.yaml`);
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function loadCategory(category) {
  const file = ruleFile(category);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return [];
  const parsed = yaml.parse(raw) ?? [];
  return Array.isArray(parsed) ? parsed : [];
}

export function saveCategory(category, rules) {
  const file = ruleFile(category);
  const out = yaml.stringify(rules, { lineWidth: 0 });
  fs.writeFileSync(file, out);
}

export function loadAll() {
  ensureStore();
  const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.yaml'));
  const all = [];
  for (const f of files) {
    const cat = f.replace(/\.yaml$/, '');
    for (const r of loadCategory(cat)) all.push(r);
  }
  return all;
}

// addRule: dedup-aware upsert. If text+scope match, reinforce instead of duplicating.
export function addRule(partial) {
  ensureStore();
  const rule = newRule(partial);
  const errs = validateRule(rule);
  if (errs.length) throw new Error(`invalid rule: ${errs.join('; ')}`);

  const existing = loadCategory(rule.category);
  const dupIdx = existing.findIndex(
    (r) => r.text.toLowerCase() === rule.text.toLowerCase() && r.scope === rule.scope,
  );
  if (dupIdx >= 0) {
    const reinforced = reinforce(existing[dupIdx], rule.evidence[0] ?? null);
    existing[dupIdx] = reinforced;
    saveCategory(rule.category, existing);
    return reinforced;
  }
  existing.push(rule);
  saveCategory(rule.category, existing);
  return rule;
}

// reinforce: bump confidence and refresh last_reinforced. Capped at 0.99.
export function reinforce(rule, evidence) {
  const bump = 0.05;
  const out = {
    ...rule,
    confidence: Math.min(0.99, rule.confidence + bump),
    last_reinforced: new Date().toISOString(),
  };
  if (evidence) {
    out.evidence = [
      ...(rule.evidence ?? []),
      { at: new Date().toISOString(), ...evidence },
    ];
  }
  return out;
}

// supersede: mark old as replaced by new, keeping history.
export function supersede(oldId, newPartial) {
  const all = loadAll();
  const old = all.find((r) => r.id === oldId);
  if (!old) throw new Error(`no rule with id ${oldId}`);
  const updated = {
    ...newRule({ ...newPartial, category: old.category }),
    supersedes: [...(old.supersedes ?? []), oldId],
  };
  old.superseded_by = updated.id;
  saveCategory(old.category, loadCategory(old.category).map((r) => (r.id === oldId ? old : r)));
  const catRules = loadCategory(updated.category);
  catRules.push(updated);
  saveCategory(updated.category, catRules);
  return updated;
}

// resolveConflicts: when two rules conflict, prefer higher confidence, then newer last_reinforced.
export function resolveConflicts(rules) {
  const live = rules.filter((r) => !r.superseded_by);
  const winners = [];
  const conflicts = [];
  for (const r of live) {
    const conflicting = live.filter(
      (x) => x.id !== r.id && r.conflicts_with?.includes(x.id),
    );
    if (!conflicting.length) {
      winners.push(r);
      continue;
    }
    const group = [r, ...conflicting].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (b.last_reinforced ?? '').localeCompare(a.last_reinforced ?? '');
    });
    winners.push(group[0]);
    conflicts.push({ winner: group[0].id, losers: group.slice(1).map((x) => x.id) });
  }
  return { rules: dedupeById(winners), conflicts };
}

function dedupeById(rules) {
  const seen = new Set();
  const out = [];
  for (const r of rules) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export function recordEvidence(ruleId, evidence) {
  ensureStore();
  const entry = { rule_id: ruleId, at: new Date().toISOString(), ...evidence };
  fs.appendFileSync(paths.evidence, JSON.stringify(entry) + '\n');
}
