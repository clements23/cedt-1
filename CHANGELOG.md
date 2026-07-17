# CEDT-1 Changelog

Per-session evolution log. Every change, decision, and pivot documented.

---

## Session 3 — 2026-07-17 — CEDT-1 Built & Wired

**What happened:**
- Full implementation of CEDT-1 engine (12 source files, 4 test files)
- 30/30 tests passing
- 24 rules migrated: 7 from lessons.md + 17 from taste-2
- Continuous-learning skill created and copied to `~/.config/opencode/skills/`
- Taste profile injected: `~/.config/opencode/memory/taste-profile.md` (7,341 bytes)
- Wired into opencode.json instructions array — loaded into every session
- `cedt1` CLI installed globally via npm link
- launchd plist for daily 03:00 decay pass

**Components built:** 12 source files across 6 modules + exports + skill definition

**Bugs fixed from taste-2:**
- `decay/index.js` archive function had placeholder code (`globalThis.__yamlCache?.parse`). Replaced with working `yaml.parse()`.
- `inject/index.js` null handling: now uses `??` to fall back to default path.
- Extract category inference: moved specific categories (git, deploy, client-work) before broad ones (communication). Added `\bcli\b` word boundaries.
- Heuristic ordering: capitalization check moved before always-do to avoid pattern overlap.

**Migration results:** 24 rules total (5 client-work, 1 code, 6 communication, 10 content, 1 deploy, 1 general)

**Deployed to:**
- `~/.config/opencode/memory/taste-profile.md` — auto-loaded every session
- `~/.config/opencode/skills/continuous-learning/SKILL.md` — capture corrections mid-session
- `~/.cedt1/` — rule store (YAML per category), git-initialized
- `~/Library/LaunchAgents/com.cedt1.decay.plist` — daily decay pass

---

## Session 2 — 2026-07-17 — taste-2 Architecture Absorbed

**What happened:**
- Full extraction of taste-2 codebase (`~/taste2/`) — built by user in Claude Code
- Analyzed every source file: schema, store, extract, capture, inject, decay, sync, CLI, migrate
- Taste-2 has 17 migrated rules from taste-1, 16/16 tests passing, launchd decay scheduled
- Taste-2 is live and wired into Claude Code via `~/.claude/settings.json` hooks

**Key architecture learnings from taste-2:**

1. **Typed rule model (schema.js):** Every rule is a structured object with id, text, category, scope, confidence, source, evidence trail, supersedes/superseded_by linked list, conflicts_with, tags, TTL days, timestamps. This is the core upgrade over taste-1's markdown bullets.

2. **Evidence trails:** Every rule stores the original source context (raw correction text, migration origin, reinforcement events). This is the single biggest taste-2 upgrade — audit trail means you can trace WHY a rule exists.

3. **Conflict resolution:** Rules can declare `conflicts_with` other rules. Resolver picks higher confidence, tiebreaks on recency. Losing rules stay in store (annotated) so the inject layer can warn.

4. **Supersession history:** When a user changes their mind, old rule is marked `superseded_by` new rule. Forms a linked list. Old rule stays for audit — not lost.

5. **Heuristic + LLM extraction:** Pattern matching catches 80% of corrections (never-do, always-do, prefer-over, capitalization). LLM refines when `TASTE2_EXTRACTOR_URL` is set. Falls back gracefully to heuristics alone.

6. **Confidence model (actual calibration):** +0.05 per reinforcement (not +0.15 as originally proposed). -0.01 per day decay. Archive at 0.25, delete at 0.10. Default TTL 120 days.

7. **Storage:** YAML file-per-category under `~/.taste2/rules/`. Evidence in JSONL. Archive in YAML. Git-backed sync. Simple, diff-friendly, merge-safe.

8. **Claude Code integration:** SessionStart hook injects rules (global ≥0.6 confidence + domain-matched). UserPromptSubmit hook captures corrections. JSON on stdin/stdout contract.

9. **Decay as launchd service:** Daily 03:00 pass. Idempotent. Persists stats.

10. **Known bug in taste-2:** `decay/index.js` archive function (lines 73-74) has placeholder code — `globalThis.__yamlCache?.parse()` won't work. Dynamic import in a sync function also won't work. Needs fix.

**Decisions for CEDT-1 (adapted from taste-2):**

- Same typed schema, same confidence model, same decay calibration
- Different integration layer: OpenCode skills instead of Claude Code hooks
- Same storage layout (YAML per category, JSONL evidence, git sync)
- Same CLI surface (status, add, migrate, decay, export, sync)
- Export format: plain markdown (compatible with any agent, not just OpenCode)
- Injection: `opencode.json` `instructions` array (vs. Claude Code's SessionStart hook)
- Capture: `continuous-learning` skill (vs. Claude Code's UserPromptSubmit hook)

**Repo:** kept private. `clements23/cedt-1` on GitHub. ARCHITECTURE.md updated with full taste-2 blueprint.

---

## Session 1 — 2026-07-17 — Repo Init

**What happened:**
- Created repo `clements23/cedt-1` on GitHub
- Defined project scope: open-source taste-based continuous learning engine
- Named CEDT-1 (Continuous Experience-Driven Taste engine)
- Established convention: commit every evolution to this repo
- Changed visibility to private

**Decisions:**
- CEDT-1 name chosen over generic alternatives
- MIT license (maximally permissive)
- Inspired by Command Code's taste-1 but built independently
- Primary integration target: OpenCode (extensible to others)
- Repo is living documentation — evolves with every session
