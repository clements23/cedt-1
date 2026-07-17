# CEDT-1

**Continuous Experience-Driven Tuning — a preference learning engine for AI agents.**

CEDT-1 gives AI agents memory of your preferences. Instead of repeating yourself every session, the agent learns from your corrections and gets better over time. Every "no, do it this way" compounds into a structured rule that shapes future behavior.

---

## How It Works

```
Session → Correction detected → Rule extracted → Confidence scored → Future sessions shaped
  ↑                                                                             ↓
  └────────────────────── Reinforcement compounds, silence decays ──────────────┘
```

1. **Detect** — The agent notices when you correct it ("no, use pnpm", "actually, named exports")
2. **Extract** — The correction is turned into a structured imperative rule with a confidence score
3. **Persist** — Rules are stored as typed objects with evidence trails (where did this come from?)
4. **Apply** — Rules are injected into future sessions. Binding (≥0.85), preferred (0.55-0.84), or suggested (0.30-0.54)
5. **Self-maintain** — Confidence decays without reinforcement. Stale rules archive. Conflicting rules self-resolve.

## Use Cases

| Domain | Example rule (learned from a single correction) |
|--------|--------------------------------------------------|
| **Content & voice** | "Never use em dashes. Replace with ' — '." — confidence: 0.92 |
| **Code style** | "Use named exports. Never default exports." — confidence: 0.85 |
| **Business methodology** | "For client reports: green = positive business outcome, not raw metric direction." — confidence: 0.93 |
| **Deploy & ops** | "After every Vercel deploy, verify the custom domain alias resolved." — confidence: 0.95 |
| **Communication** | "Be terse. Default to ≤3 lines. No preamble." — confidence: 0.88 |
| **Publishing workflow** | "Every published article MUST include a copy-pasteable LinkedIn draft." — confidence: 0.99 |

## Quick Start

```bash
# Install
npm i -g cedt-1

# Seed from existing configs
cedt1 migrate

# Add a rule manually
cedt1 add "Use pnpm instead of npm. --cat code"

# Or let the agent learn it from a correction
cedt1 learn "No, don't use npm here, use pnpm"

# Inject into your agent's context
cedt1 inject

# Check what's learned
cedt1 status
```

## Rule Model

Every rule is a typed object, not a bullet point:

```yaml
- id: a1b2c3d4e5
  text: Never use em dashes. Replace with " — ".
  category: content
  scope: global
  confidence: 0.92          # compounds with reinforcement, decays with silence
  source: learned           # learned | explicit | migrated | inferred
  evidence:                 # audit trail — every correction that produced this rule
    - kind: user-correction
      raw: "no, don't use em dashes"
      at: 2026-07-17T10:00:00.000Z
  conflicts_with: []        # if two rules contradict, higher confidence wins
  supersedes: []            # linked list — when you change your mind, history stays
  last_reinforced: 2026-07-17T12:00:00.000Z
```

## Confidence Lifecycle

```
New rule (from correction)  → 0.70
Reinforced (same correction again) → +0.05 (cap 0.99)
Silence (no signal for 1 day) → -0.01/day
Archived (below 0.25) → moved to archive
Deleted (below 0.10) → removed
```

## Structure

```
.cedt1/                        # Rule store (default location)
├── rules/                     # One YAML file per category
│   ├── content.yaml
│   ├── code.yaml
│   ├── communication.yaml
│   └── client-work.yaml
└── state/
    ├── evidence.jsonl         # Append-only audit log
    └── archive.yaml           # Pruned rules

src/                           # Engine source
├── store/                     # Typed rule model + YAML persistence
├── extract/                   # Heuristic + LLM extraction from corrections
├── decay/                     # Confidence decay + auto-archive
├── sync/                      # Git-backed cross-machine sync
├── cli/                       # `cedt1` command
├── migrate/                   # Import from existing configs
└── opencode/                  # OpenCode agent integration
```

## Integration

CEDT-1 is agent-agnostic. The engine runs as a CLI. Integration is two lines:

**For OpenCode:** `cedt1 inject` writes to the agent's memory directory. Loaded into every session.

**For any agent:** `cedt1 export` produces plain markdown. Pipe it wherever your agent reads context.

## Commands

```
cedt1 status       Show rule counts by category
cedt1 add <text>   Add a rule explicitly
cedt1 learn <text> Extract and persist a rule from a correction
cedt1 inject       Write tuning profile to agent's context
cedt1 export       Emit plain markdown (any agent)
cedt1 decay        Run confidence decay + archive
cedt1 sync         Git commit + pull + push
cedt1 migrate      Import from existing config stores
```

## License

MIT
