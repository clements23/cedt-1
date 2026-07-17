# CEDT-1 Changelog

Per-session evolution log. Every build session documented.

---

## Session 3 — 2026-07-17 — v0.1.0: Engine Built

**Engine:** 12 source files across 6 modules. 30/30 tests passing.

| Module | Purpose |
|--------|---------|
| `store/` | Typed rule model — id, text, category, confidence, evidence trail, conflict declarations, supersession chain |
| `extract/` | Heuristic + optional LLM extraction from user corrections (4 pattern types, 10 category detectors) |
| `decay/` | Confidence decay engine — -0.01/day, archive at 0.25, delete at 0.10 |
| `sync/` | Git-backed cross-machine sync |
| `migrate/` | Multi-source import from existing config stores |
| `cli/` | Full CLI surface — status, add, learn, inject, export, decay, sync, migrate |
| `opencode/` | OpenCode agent integration — writes taste profile to agent memory directory |

**Deployed:** 24 rules live in production store. Taste profile injected into OpenCode context (loaded every session). Continuous-learning skill active for mid-session correction capture. Scheduled decay via launchd (daily 03:00). Global `cedt1` CLI installed.

**Key design choices locked:**
- Confidence model: 0.70 start, +0.05/reinforcement, -0.01/day decay
- Storage: YAML per category (human-readable, git-friendly, merge-safe)
- Conflict resolution: higher confidence wins, loser stays annotated
- Supersession: linked list, full history preserved
- Extraction: heuristics first (always available), LLM optional (refinement)

---

## Session 2 — 2026-07-17 — Architecture Research

Researched existing preference learning systems. Key findings that shaped CEDT-1's design:

1. **Typed rules > markdown bullets.** Structured objects with evidence trails, conflict declarations, and supersession chains give the system auditability that flat text can't provide.
2. **Confidence must decay.** Without automatic decay, rules accumulate forever and the profile grows stale. The 0.01/day rate gives rules a meaningful lifespan (~45 days from 0.70 to archive).
3. **Conflicts should surface, not hide.** When two rules contradict, the resolver picks a winner but keeps the loser annotated. The agent can warn: "Rule X overrides Y due to higher confidence."
4. **Heuristics cover 80%.** Pattern matching (never-do, always-do, prefer-over, capitalization) catches most corrections. LLM refinement is gravy, not foundation.
5. **Agent-agnostic by design.** The engine is a CLI. Integration is one command output piped to a context file. No agent-specific coupling.

---

## Session 1 — 2026-07-17 — Project Init

Repository created. Core concept defined: a continuous preference learning engine for AI agents that learns from corrections, compounds over time, and self-maintains. Named CEDT-1 (Continuous Experience-Driven Taste). MIT licensed.
