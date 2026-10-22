# CEDT-1 Changelog

Per-session evolution log. Every build session documented.

---

## Session 4 (2026-10-22): v0.2.0 Modernization Pass

Repo was 2 months stale at v0.1.0. Full update pass across engine, CLI, tests, packaging, and docs. 60/60 tests passing.

**Engine fixes:**

| Module | Fix |
|--------|-----|
| `store/schema` | `cryptoId()` used `Math.random()`. Now `node:crypto` random bytes, base64url, 10 chars, matching the architecture doc's claim of a crypto-random id |
| `store` | `resolveConflicts()` reported each conflicting pair twice, once from each side. Now reported once |
| `decay` | "Deleted below 0.10" was unreachable: the 0.25 archive check always fired first, so rules were archived and never deleted. Delete is now evaluated before archive, and `ttl_days` expiry archives high-confidence rules instead of doing nothing |
| `decay` | Confidence is rounded to 4 decimals. Sub-day clock drift stored values like `0.7999999996527778` in YAML and made floor comparisons nondeterministic |
| `decay` | Dead `kept` variable removed; archive entries no longer leak the internal `_archived` marker; archive file written once per run instead of once per rule |
| `opencode/inject` | Injection floor was 0.6, silently dropping the documented SUGGEST tier (0.30-0.54). Now 0.30, so all three tiers reach the agent |
| `cli` | `add` and `learn` folded flag values into rule text: `cedt1 add "Use pnpm." --cat code` produced text `Use pnpm. code`. Flag values are now skipped when collecting positional args |
| `cli` | Added `version`/`--version`/`-v`, `help`/`--help`/`-h`, and `--min-conf` on `export` and `inject`. Usage now prints the version and documents `CEDT1_*` env vars |
| `sync` | Git calls moved from `execSync` shell strings to `execFileSync` argv arrays. Remote URLs and commit messages are no longer shell-interpolated |

**Tests:** 31 → 60. New suites: `decay.test.js` (8: decay rate, archive floor, delete floor, ttl expiry, superseded skip, run metadata), `profile.test.js` (10: export tiers, min-confidence, conflict winner, injection tiers, disk write), `cli.test.js` (12: real `spawnSync` against the binary for every command including usage and error paths).

**Packaging:** `package.json` now declares `files`, `exports` (per-module entry points), `repository`, `homepage`, and `bugs`, and bumps to 0.2.0.

**Docs:** README install instructions fixed (`npm i -g cedt-1` pointed at a package that does not exist on npm; now installs from GitHub), `add` example corrected so the flag sits outside the quotes, command reference completed, Architecture decay steps and id description aligned with the code, skill updated for the new injection floor and commands. Em dashes purged repo-wide.

---

## Session 3 (2026-07-17): v0.1.0 Engine Built

**Engine:** 12 source files across 6 modules. 30/30 tests passing.

| Module | Purpose |
|--------|---------|
| `store/` | Typed rule model: id, text, category, confidence, evidence trail, conflict declarations, supersession chain |
| `extract/` | Heuristic + optional LLM extraction from user corrections (4 pattern types, 10 category detectors) |
| `decay/` | Confidence decay engine: -0.01/day, archive at 0.25, delete at 0.10 |
| `sync/` | Git-backed cross-machine sync |
| `migrate/` | Multi-source import from existing config stores |
| `cli/` | Full CLI surface: status, add, learn, inject, export, decay, sync, migrate |
| `opencode/` | OpenCode agent integration: writes tuning profile to agent memory directory |

**Deployed:** 24 rules live in production store. Tuning profile injected into OpenCode context (loaded every session). Continuous-learning skill active for mid-session correction capture. Scheduled decay via launchd (daily 03:00). Global `cedt1` CLI installed.

**Key design choices locked:**
- Confidence model: 0.70 start, +0.05/reinforcement, -0.01/day decay
- Storage: YAML per category (human-readable, git-friendly, merge-safe)
- Conflict resolution: higher confidence wins, loser stays annotated
- Supersession: linked list, full history preserved
- Extraction: heuristics first (always available), LLM optional (refinement)

---

## Session 2 (2026-07-17): Architecture Research

Researched existing preference learning systems. Key findings that shaped CEDT-1's design:

1. **Typed rules > markdown bullets.** Structured objects with evidence trails, conflict declarations, and supersession chains give the system auditability that flat text can't provide.
2. **Confidence must decay.** Without automatic decay, rules accumulate forever and the profile grows stale. The 0.01/day rate gives rules a meaningful lifespan (~45 days from 0.70 to archive).
3. **Conflicts should surface, not hide.** When two rules contradict, the resolver picks a winner but keeps the loser annotated. The agent can warn: "Rule X overrides Y due to higher confidence."
4. **Heuristics cover 80%.** Pattern matching (never-do, always-do, prefer-over, capitalization) catches most corrections. LLM refinement is gravy, not foundation.
5. **Agent-agnostic by design.** The engine is a CLI. Integration is one command output piped to a context file. No agent-specific coupling.

---

## Session 1 (2026-07-17): Project Init

Repository created. Core concept defined: a continuous preference learning engine for AI agents that learns from corrections, compounds over time, and self-maintains. Named CEDT-1 (Continuous Experience-Driven Tuning). MIT licensed.
