// Periodic decay + pruning. Rules decay in confidence without reinforcement.
// Below ARCHIVE_FLOOR → archive.yaml. Below DELETE_FLOOR → removed.
// Run via launchd or `cedt1 decay`.

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { paths, ensureStore, saveCategory, loadCategory } from '../store/index.js';

const DECAY_PER_DAY = 0.01;
const ARCHIVE_FLOOR = 0.25;
const DELETE_FLOOR = 0.1;
const DEFAULT_TTL_DAYS = 120;

function daysBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

export function decay({ now = new Date() } = {}) {
  ensureStore();
  const categories = fs.readdirSync(paths.RULES_DIR).filter((f) => f.endsWith('.yaml'));
  const stats = { decayed: 0, archived: 0, deleted: 0 };

  for (const f of categories) {
    const cat = f.replace(/\.yaml$/, '');
    const rules = loadCategory(cat);
    let mutated = false;

    for (const r of rules) {
      if (r.superseded_by) continue;

      const lastTouch = r.last_reinforced ?? r.created_at;
      const days = daysBetween(lastTouch, now.toISOString());
      const ttl = r.ttl_days ?? DEFAULT_TTL_DAYS;

      if (days > ttl && r.confidence < DELETE_FLOOR) {
        stats.deleted++;
        mutated = true;
        continue;
      }

      const decayed = Math.max(0, r.confidence - DECAY_PER_DAY * days);
      if (decayed < ARCHIVE_FLOOR) {
        archive(r);
        stats.archived++;
        mutated = true;
        continue;
      }
      if (decayed !== r.confidence) {
        r.confidence = decayed;
        mutated = true;
        stats.decayed++;
      }
    }

    const kept = mutated ? rules.filter((r) => !r._archived) : rules;
    if (mutated) saveCategory(cat, kept.filter((r) => r.confidence >= ARCHIVE_FLOOR));
  }

  fs.writeFileSync(paths.decay, JSON.stringify({ last_run: now.toISOString(), stats }));
  return stats;
}

function archive(rule) {
  const archiveFile = path.join(paths.STATE_DIR, 'archive.yaml');
  let existing = [];
  if (fs.existsSync(archiveFile)) {
    try {
      const raw = fs.readFileSync(archiveFile, 'utf8');
      if (raw.trim()) {
        const parsed = yaml.parse(raw);
        existing = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // corrupt archive — start fresh
    }
  }
  existing.push({ ...rule, archived_at: new Date().toISOString(), _archived: true });
  fs.writeFileSync(archiveFile, yaml.stringify(existing, { lineWidth: 0 }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(decay(), null, 2));
}
