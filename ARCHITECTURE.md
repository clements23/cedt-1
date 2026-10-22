# CEDT-1 Architecture

## Overview

CEDT-1 is a continuous preference learning engine. It watches agent-user interactions, extracts structured rules from corrections, and shapes future sessions. The core loop:

```
Correction detected → Rule extracted → Stored with confidence → Injected into future sessions
        ↑                                                                     ↓
        └───────────────── Reinforcement compounds, silence decays ───────────┘
```

---

## Data Model

### Rule

The atomic unit. Every rule is a typed object:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Stable identifier (crypto-random, 10-char base64url from `node:crypto`) |
| `text` | string | Imperative constraint (e.g. "Never use em dashes.") |
| `category` | string | Free-form grouping (communication, content, code, client-work, etc.) |
| `scope` | `global` \| `domain` | Global = always apply. Domain = only when working in domain (e.g. "linkedin", "react") |
| `domain` | string \| null | Required when scope is domain |
| `confidence` | 0..1 | Calibrated over time. Starts at 0.70 (heuristic match) or 0.50 (no match) |
| `source` | `learned` \| `explicit` \| `migrated` \| `inferred` | How the rule entered the system |
| `evidence` | Evidence[] | Audit trail: every correction that created or reinforced this rule |
| `supersedes` | string[] | IDs of rules this one replaces (linked list) |
| `superseded_by` | string \| null | ID of rule that replaced this one |
| `conflicts_with` | string[] | IDs of rules that contradict this one |
| `tags` | string[] | Free-form for retrieval (e.g. `["negation", "writing-voice"]`) |
| `ttl_days` | number \| null | Optional soft expiry (default 120 days) |
| `created_at` | string | ISO timestamp of first entry |
| `last_reinforced` | string | ISO timestamp of most recent reinforcement |
| `notes` | string \| null | Free-form annotation |

### Evidence

```typescript
type Evidence = {
  kind: string;           // "user-correction" | "migration" | "explicit-add" | "reinforcement"
  raw?: string;           // original correction text
  from?: string;          // migration source file
  original_confidence?: number;
  at?: string;            // timestamp
};
```

---

## Confidence Model

| Event | Delta | Cap |
|-------|-------|-----|
| New rule (heuristic match) | 0.70 | none |
| New rule (no heuristic match) | 0.50 | none |
| Reinforcement (same rule observed again) | +0.05 | 0.99 |
| Decay (per day without reinforcement) | -0.01 | 0.10 floor |
| Archived | rule moved at 0.25 | none |
| Deleted | rule removed at 0.10 | none |

### Design rationale
- **0.70 start:** High enough to be applied immediately, low enough to decay if never reinforced
- **0.05 bump:** Conservative. Requires 6 reinforcements to reach 0.99. Prevents one-off patterns from becoming permanent
- **0.01/day decay:** A rule with no reinforcement for 45 days drops from 0.70 to 0.25 (archive threshold). Gives rules a meaningful lifespan without manual cleanup

---

## Storage Architecture

```
~/.cedt1/
├── rules/                     # One YAML file per category
│   ├── communication.yaml
│   ├── content.yaml
│   └── code.yaml
├── state/
│   ├── evidence.jsonl         # Append-only audit log
│   ├── decay.json             # Last decay run metadata
│   └── archive.yaml           # Rules pruned below 0.25
└── .git/                      # Optional git-backed sync
```

**Design decisions:**
- **YAML over JSON:** Human-readable, git-diff friendly, no trailing comma issues
- **File per category:** Small files, fast loads, merge-safe (changing communication rules doesn't conflict with code rules)
- **JSONL for evidence:** Append-only, no parse-before-write needed

---

## Extraction Engine

### Heuristic Patterns (always available, no API key needed)

| Pattern | Regex | Output |
|---------|-------|--------|
| capitalization | `/(always\s+)?(capitalize\|capital\|uppercase)\s+(\w+)/i` | "Always write "X" (not lowercased)." |
| never-do | `/(never\|don't\|do not\|stop)\s+(?:use\s+)?(.+?)(?:\.\|$)/i` | "Never X." |
| always-do | `/(always\|make sure to\|remember to)\s+(.+?)(?:\.\|$)/i` | "Always X." |
| prefer-over | `/(use\|prefer)\s+(\w+)\s+(?:over\|instead of\|not)\s+(\w+)/i` | 'Use "X" instead of "Y".' |

### Category Inference (keyword matching)

Specific categories checked first, broad ones last. Order is intentional:

```
git → cloudflare → deploy → client-work → content → code → communication → general
```

### LLM Refinement (optional)

When `CEDT1_EXTRACTOR_URL` is set, the extraction pipeline:
1. Runs heuristics first (fast, free)
2. Sends heuristic output + raw correction to an LLM (OpenAI-compatible endpoint)
3. LLM refines: splits compound corrections, infers category, adjusts confidence
4. Falls back to heuristics if LLM is unavailable

---

## Conflict Resolution

When two rules declare `conflicts_with` each other:
1. Higher confidence wins
2. Same confidence: newer `last_reinforced` wins
3. Loser stays in store (annotated, not deleted)
4. Resolution is surfaced so the agent can warn: "Rule X (conf 0.85) overrides rule Y (conf 0.60)"

---

## Supersession

When a user changes their mind, the old rule is NOT deleted. Instead:
- Old rule gets `superseded_by: new_rule_id`
- New rule gets `supersedes: [old_rule_id]`
- Forms a linked list: full history preserved
- During resolution, only non-superseded rules are active

---

## Decay Engine

Runs on schedule (launchd/cron) or manually (`cedt1 decay`):

1. For each non-superseded rule, compute days since `last_reinforced`
2. Subtract `DECAY_PER_DAY * days`, floor at 0, round to 4 decimals
3. If the result is ≤ 0.10: delete the rule
4. Else if past `ttl_days` (default 120) or the result is < 0.25: append to `archive.yaml`
5. Else: persist the decayed confidence back to the category file
6. Persist `{ last_run, stats }` to state/decay.json

---

## Agent Integration

### OpenCode

1. `cedt1 inject` writes `~/.config/opencode/memory/tuning-profile.md`
2. File is in `opencode.json` `instructions` array → loaded into every session's system prompt
3. Rules are formatted with binding levels: BINDING (≥0.85), PREFERRED (0.55-0.84), SUGGEST (0.30-0.54)
4. A companion skill (`continuous-learning`) tells the agent how to detect corrections and run `cedt1 learn`

### Any Agent (generic)

```bash
cedt1 export > /path/to/agent/context/preferences.md
```

Produces clean markdown. Pipe it wherever your agent reads context files.

---

## Migration

`cedt1 migrate` seeds rules from existing configuration stores. Supported sources:

| Source | Flag | Format |
|--------|------|--------|
| YAML rule stores | `--from yaml` | Same format as CEDT-1 (portable between instances) |
| Markdown lessons logs | `--from lessons` | Structured lessons with `- **Rule:** ` lines |
| All available | `--from all` (default) | Tries all sources, merges results |

Each migrated rule gets `source: migrated` and evidence pointing at the origin file.
