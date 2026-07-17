// Migration from various formats into CEDT-1 store.
// Supports: YAML rule stores, markdown config files, lessons.md extraction.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { addRule } from '../store/index.js';

const YAML_HOME = process.env.CEDT1_YAML_SRC ?? path.join(os.homedir(), '.taste2');
const MD_HOME = process.env.CEDT1_MD_SRC ?? path.join(os.homedir(), '.commandcode', 'taste');
const LESSONS_PATH = process.env.CEDT1_LESSONS_SRC ?? path.join(os.homedir(), '.config', 'opencode', 'memory', 'lessons.md');

const MD_RULE_RE = /^-\s+(.+?)\s*Confidence:\s*([0-9.]+)\s*$/;

export function migrateFromYaml({ src = YAML_HOME, dryRun = false } = {}) {
  const rulesDir = path.join(src, 'rules');
  if (!fs.existsSync(rulesDir)) {
    return { ok: false, reason: `rules not found: ${rulesDir}` };
  }
  const stats = { rules: 0, skipped: 0 };
  const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.yaml'));

  for (const f of files) {
    const cat = f.replace(/\.yaml$/, '');
    const raw = fs.readFileSync(path.join(rulesDir, f), 'utf8');
    let rules;
    try {
      rules = yaml.parse(raw) ?? [];
    } catch {
      stats.skipped++;
      continue;
    }
    if (!Array.isArray(rules)) continue;

    for (const r of rules) {
      if (dryRun) {
        stats.rules++;
        continue;
      }
      try {
        addRule({
          ...r,
          source: 'migrated',
          evidence: [
            ...(r.evidence ?? []),
            { kind: 'migration', from: path.join(rulesDir, f), migrated_at: new Date().toISOString() },
          ],
        });
        stats.rules++;
      } catch {
        stats.skipped++;
      }
    }
  }

  return { ok: true, ...stats };
}

export function migrateFromMarkdown({ src = MD_HOME, dryRun = false } = {}) {
  if (!fs.existsSync(src)) {
    return { ok: false, reason: `source not found: ${src}` };
  }
  const stats = { categories: 0, rules: 0, skipped: 0 };
  const categories = fs.readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const catDir of categories) {
    const cat = catDir.name;
    const mdFile = path.join(src, cat, 'taste.md');
    if (!fs.existsSync(mdFile)) continue;
    const raw = fs.readFileSync(mdFile, 'utf8');
    const lines = raw.split('\n');

    for (const line of lines) {
      const m = line.match(MD_RULE_RE);
      if (!m) continue;
      const [, text, conf] = m;
      if (dryRun) {
        stats.rules++;
        continue;
      }
      try {
        addRule({
          text,
          category: cat,
          confidence: parseFloat(conf),
          source: 'migrated',
          evidence: [{ kind: 'migration', from: mdFile, original_confidence: parseFloat(conf) }],
          tags: ['migrated-from-md'],
        });
        stats.rules++;
      } catch {
        stats.skipped++;
      }
    }
    stats.categories++;
  }

  return { ok: true, ...stats };
}

export function migrateFromLessons({ src = LESSONS_PATH, dryRun = false } = {}) {
  if (!fs.existsSync(src)) {
    return { ok: false, reason: `lessons not found: ${src}` };
  }
  const stats = { rules: 0, skipped: 0 };
  const raw = fs.readFileSync(src, 'utf8');
  const sections = raw.split(/^### /m).slice(1);

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0]?.trim() ?? '';
    const isPermanent = title.includes('PERMANENT RULE');
    if (!isPermanent) continue;

    const ruleLine = lines.find((l) => l.trim().startsWith('- **Rule:**'));
    if (!ruleLine) continue;

    const ruleText = ruleLine.replace(/- \*\*Rule:\*\*\s*/, '').trim();
    if (!ruleText || ruleText.length < 10) continue;

    const confidence = 0.85;

    if (dryRun) {
      stats.rules++;
      continue;
    }
    try {
      addRule({
        text: ruleText,
        category: inferCategoryFromRule(ruleText),
        confidence,
        source: 'migrated',
        evidence: [{ kind: 'migration', from: src, section: title }],
        tags: ['migrated-from-lessons'],
      });
      stats.rules++;
    } catch {
      stats.skipped++;
    }
  }

  return { ok: true, ...stats };
}

function inferCategoryFromRule(text) {
  const t = text.toLowerCase();
  if (/deploy|vercel|build|commit|git|push|pull/.test(t)) return 'deploy';
  if (/client|lifted|izzy|babylon|ydn|report|whatsapp/.test(t)) return 'client-work';
  if (/code|sort|function|import|export|typescript|react/.test(t)) return 'code';
  if (/content|blog|linkedin|publish|article|draft/.test(t)) return 'content';
  if (/communication|tone|voice|write|language|response/.test(t)) return 'communication';
  return 'general';
}

export function migrateAll({ dryRun = false } = {}) {
  const results = {};
  results.yaml = migrateFromYaml({ dryRun });
  if (!results.yaml.ok) {
    results.md = migrateFromMarkdown({ dryRun });
  }
  results.lessons = migrateFromLessons({ dryRun });
  return results;
}
