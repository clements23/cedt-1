# CEDT-1 Architecture

> Evolved from taste-2 learnings. Adapts typed rule model to OpenCode's skill/memory architecture.

## Core Data Model (from taste-2 schema)

Every rule is a typed object, not a markdown bullet. This is the key upgrade.

```typescript
type Rule = {
  id: string;              // stable, crypto-random identifier
  text: string;            // imperative constraint (e.g. "Never use em dashes.")
  category: string;        // free-form grouping (communication, content, code, etc.)
  scope: 'global' | 'domain';  // global = always apply; domain = only when working in domain
  domain: string | null;   // e.g. "linkedin", "react", "cloudflare"
  confidence: number;      // 0..1, calibrated over time
  source: 'learned' | 'explicit' | 'migrated' | 'inferred';
  evidence: Evidence[];    // audit trail — the single biggest upgrade over taste-1
  supersedes: string[];    // linked list of rule IDs this replaces
  superseded_by: string | null;
  conflicts_with: string[]; // bidirectional — resolver surfaces ambiguous cases
  tags: string[];          // free-form for retrieval
  ttl_days: number | null; // optional soft expiry
  created_at: string;      // ISO timestamp
  last_reinforced: string; // ISO timestamp
  notes: string | null;
};
```

## Confidence Lifecycle (from taste-2 calibrations)

- **New rule:** 0.70 (extracted from single correction)
- **Reinforcement (duplicate observation):** +0.05 per hit, capped at 0.99
- **Decay:** -0.01 per day since last_reinforced (starts after 1 day)
- **Archive floor:** 0.25 (below this → moved to archive.yaml)
- **Delete floor:** 0.10 (below this → removed entirely)
- **Default TTL:** 120 days (if no reinforcement, rule starts decaying)

## Signal Types (from taste-2 extract/capture)

### Correction Detection (heuristic patterns)
- `never-do`: /never|don't|do not|stop/i → "Never [action]."
- `always-do`: /always|make sure to|remember to/i → "Always [action]."
- `prefer-over`: /use|prefer X over|instead of|not Y/i → "Use X instead of Y."
- `capitalization`: /capitalize|capital|uppercase/i → "Always write [X]."

### Category Inference (keyword → category)
```
linkedin|aisift → content
em-dash|hashtag|emoji → content
cli|terminal|step-by-step → communication
typescript|rust|python|react → code
commit|git|pr|pull request → git
cloudflare|wrangler|d1|worker → cloudflare
(default) → general
```

### LLM Refinement (optional, controlled by env vars)
- `TASTE2_EXTRACTOR_URL` — OpenAI-compatible endpoint
- `TASTE2_EXTRACTOR_MODEL` — defaults to deepseek/deepseek-v4-pro
- Sends heuristic output + raw correction → gets refined JSON with text, category, confidence, tags

## Storage Architecture (from taste-2 store)

```
~/.cedt1/                          # CEDT1_HOME (env-overridable)
├── rules/                         # One YAML file per category (git-friendly, diff-safe)
│   ├── communication.yaml
│   ├── content.yaml
│   ├── code.yaml
│   └── general.yaml
├── state/
│   ├── evidence.jsonl             # Append-only audit log
│   ├── decay.json                 # Last decay run timestamp + stats
│   └── archive.yaml               # Pruned rules (confidence <0.25)
└── .git/                          # Git-backed sync (optional)
```

**Why file-per-category:** Small files, diff-friendly, avoids merge conflicts when rules change across categories simultaneously.

## Core Operations (from taste-2 store)

### addRule(partial)
- Dedup-aware upsert. If text+scope match exists → reinforce instead of duplicating.
- Returns the stored rule.

### reinforce(rule, evidence)
- Bump confidence +0.05, cap 0.99.
- Refresh last_reinforced timestamp.
- Append evidence entry with timestamp.

### supersede(oldId, newPartial)
- Mark old rule as superseded_by new rule.
- Old rule stays in store for audit trail.
- New rule inherits old's category.

### resolveConflicts(rules)
- When two rules conflict (via conflicts_with), prefer higher confidence.
- Tiebreak: newer last_reinforced.
- Returns `{ rules, conflicts }` — conflicts list shows what was resolved.
- Conflicting loser rules stay in store but are annotated.

### decay({ now })
- For each non-superseded rule, compute days since last_reinforced.
- Subtract DECAY_PER_DAY * days from confidence.
- Below ARCHIVE_FLOOR → move to archive.yaml.
- Below DELETE_FLOOR → remove.
- Persist last_run metadata.

## Integration: taste-2 (Claude Code) vs CEDT-1 (OpenCode)

| Layer | taste-2 (Claude Code) | CEDT-1 (OpenCode) |
|-------|----------------------|-------------------|
| **Injection** | SessionStart hook → `hookSpecificOutput.additionalContext` | `opencode.json` instructions array loads taste profile as system prompt |
| **Capture** | UserPromptSubmit hook → read stdin JSON → extract → persist | `continuous-learning` skill fires mid-session + session-end batch |
| **CLI** | `taste2 status/add/migrate/decay/export/sync/init/list` | Same commands, adapted to opencode config paths |
| **Decay** | launchd plist → daily 03:00 | Same pattern |
| **Sync** | Git-backed (commit → pull --rebase → push) | Same (optional remote) |
| **Export** | `taste2 export` → plain markdown | Same — for non-OpenCode agent compatibility |

### OpenCode-specific integration details
1. Taste profile loaded via `opencode.json` `instructions` array (same mechanism as lessons.md today)
2. `continuous-learning` skill (new) fires on UserPromptSubmit equivalent — detects corrections, extracts rules
3. `continuous-learning` fires at session end — batch processes success signals, decay check, cross-session synthesis
4. Inject logic: global rules (confidence ≥0.6) + domain rules matching cwd path
5. Cap injection at MAX_INJECT (40) to avoid context bloat

## Design Decisions

### Why YAML over JSON for rules storage?
- Human-readable, git-diff friendly, no trailing comma issues
- Same as taste-2
- JSONL for evidence (append-only log)

### Why file-per-category?
- Small files, fast to load, git merge-safe
- Categories are independent — changing "communication" rules shouldn't conflict with "code" rules

### Why heuristic extraction first (before LLM)?
- Fast, free, no API key needed
- LLM refines only when available (TASTE2_EXTRACTOR_URL set)
- Heuristics catch 80% of corrections

### Why 0.70 default confidence for new rules?
- High enough to be applied immediately
- Low enough to decay if never reinforced
- Avoids false-permanent rules from one-off corrections

### Why 0.05 reinforcement bump (not 0.15)?
- Originally proposed 0.15, but taste-2 implementation uses 0.05
- More conservative: requires 6 reinforcements to reach 0.99 from 0.70
- Prevents overconfident rules from single repeated correction pattern
