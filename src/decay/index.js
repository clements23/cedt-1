// Periodic decay + pruning. Rules decay in confidence without reinforcement.
// Below DELETE_FLOOR -> removed. Below ARCHIVE_FLOOR -> archive.yaml. Past ttl_days -> archived.
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

// Sub-day clock drift and binary float noise must not leak into stored confidences
// (0.9 - 0.01*10 renders as 0.7999999996527778 in YAML). Four decimals is finer
// than any visible confidence and keeps floor comparisons deterministic.
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

export function decay({ now = new Date() } = {}) {
  ensureStore();
  const categories = fs.readdirSync(paths.RULES_DIR).filter((f) => f.endsWith('.yaml'));
  const stats = { decayed: 0, archived: 0, deleted: 0 };
  const toArchive = [];

  for (const f of categories) {
    const cat = f.replace(/\.yaml$/, '');
    const rules = loadCategory(cat);
    const removed = new Set();
    let mutated = false;

    for (const r of rules) {
      if (r.superseded_by) continue;

      const lastTouch = r.last_reinforced ?? r.created_at;
      const days = daysBetween(lastTouch, now.toISOString());
      const ttl = r.ttl_days ?? DEFAULT_TTL_DAYS;
      const decayed = round4(Math.max(0, r.confidence - DECAY_PER_DAY * days));

      if (decayed <= DELETE_FLOOR) {
        stats.deleted++;
        removed.add(r.id);
        mutated = true;
        continue;
      }
      if (days > ttl || decayed < ARCHIVE_FLOOR) {
        toArchive.push({ ...r, confidence: decayed });
        stats.archived++;
        removed.add(r.id);
        mutated = true;
        continue;
      }
      if (decayed !== r.confidence) {
        r.confidence = decayed;
        stats.decayed++;
        mutated = true;
      }
    }

    if (mutated) saveCategory(cat, rules.filter((r) => !removed.has(r.id)));
  }

  if (toArchive.length) archiveMany(toArchive);

  fs.writeFileSync(paths.decay, JSON.stringify({ last_run: now.toISOString(), stats }));
  return stats;
}

function archiveMany(rules) {
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
      // corrupt archive, start fresh
    }
  }
  const stamped = rules.map((r) => ({ ...r, archived_at: new Date().toISOString() }));
  fs.writeFileSync(archiveFile, yaml.stringify([...existing, ...stamped], { lineWidth: 0 }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(decay(), null, 2));
}
