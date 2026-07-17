// Migration from various formats into CEDT-1 store.
// Supports: taste-2 YAML rules, taste-1 markdown, lessons.md extraction.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { addRule } from '../store/index.js';

// taste-2 store at ~/.taste2 falls back to CEDT2_HOME env
const TASTE2_HOME = process.env.CEDT2_HOME ?? path.join(os.homedir(), '.taste2');
// taste-1 store at ~/.commandcode/taste
const TASTE1_HOME = process.env.TASTE1_HOME ?? path.join(os.homedir(), '.commandcode', 'taste');
// opencode lessons at ~/.config/opencode/memory/lessons.md
const LESSONS_PATH = process.env.OP_LESSONS ?? path.join(os.homedir(), '.config', 'opencode', 'memory', 'lessons.md');

// taste-1 rule line: "- Use proper capitalization ... Confidence: 0.90"
const TASTE1_RE = /^-\s+(.+?)\s*Confidence:\s*([0-9.]+)\s*$/;

export function migrateFromTaste2({ src = TASTE2_HOME, dryRun = false } = {}) {
  const rulesDir = path.join(src, 'rules');
  if (!fs.existsSync(rulesDir)) {
    return { ok: false, reason: `taste-2 rules not found: ${rulesDir}` };
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

export function migrateFromTaste1({ src = TASTE1_HOME, dryRun = false } = {}) {
  if (!fs.existsSync(src)) {
    return { ok: false, reason: `taste-1 source not found: ${src}` };
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
      const m = line.match(TASTE1_RE);
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
          tags: ['migrated-from-taste-1'],
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

// lessons.md has sections like:
// ### 2026-07-17 sort-by-display-label (PERMANENT RULE)
// - **What:** ...
// - **Rule:** ...
// - **Trigger:** ...
export function migrateFromLessons({ src = LESSONS_PATH, dryRun = false } = {}) {
  if (!fs.existsSync(src)) {
    return { ok: false, reason: `lessons.md not found: ${src}` };
  }
  const stats = { rules: 0, skipped: 0 };
  const raw = fs.readFileSync(src, 'utf8');
  const sections = raw.split(/^### /m).slice(1); // skip preamble

  for (const section of sections) {
    const lines = section.split('\n');
    const title = lines[0]?.trim() ?? '';
    const isPermanent = title.includes('PERMANENT RULE');
    if (!isPermanent) continue;

    // Extract "Rule:" line
    const ruleLine = lines.find((l) => l.trim().startsWith('- **Rule:**'));
    if (!ruleLine) continue;

    const ruleText = ruleLine.replace(/- \*\*Rule:\*\*\s*/, '').trim();
    if (!ruleText || ruleText.length < 10) continue;

    const confidence = 0.85; // PERMANENT RULE entries start high

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

// Main migrate entry. Tries taste-2 → taste-1 → lessons in order.
export function migrateAll({ dryRun = false } = {}) {
  const results = {};
  results.taste2 = migrateFromTaste2({ dryRun });
  if (!results.taste2.ok) {
    results.taste1 = migrateFromTaste1({ dryRun });
  }
  results.lessons = migrateFromLessons({ dryRun });
  return results;
}
