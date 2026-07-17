# CEDT-1 Architecture

> Work in progress. Updated as design evolves.

## Core Concepts

### Taste Profile

A structured, human-readable file of constraints with confidence scores. Each constraint represents a learned preference.

**Format (proposed):**
```markdown
## [Domain]
- [Constraint description]. Confidence: 0.XX
```

**Confidence lifecycle:**
- New constraint: 0.70
- Reinforcement (accept/correction repeated): +0.15
- Contradiction (user rejects or corrects opposite): constraint removed or inverted
- Decay (no signal for 30 days): -0.05
- Pruning threshold: 0.30 (below this, archive)

### Signals

| Signal | Source | Effect |
|--------|--------|--------|
| **Accept** | User accepts output without changes | +0.05 to all constraints applied in that output |
| **Reject** | User rejects output | Remove/reduce constraints that led to output |
| **Edit** | User edits generated output | Extract delta as new constraint at 0.70, or refine existing |
| **Correction** | User explicitly says "do X not Y" | Add X as constraint at 0.70-0.85 (higher if user sounds certain) |
| **Silence** | User takes no corrective action | +0.03 implicit reinforcement (only applied if output was used) |
| **Praise** | User says "good", "perfect", "this worked" | +0.10 to all constraints active in that exchange |

### Application

Constraints are loaded into agent context with binding levels:
- **Confidence ≥0.85:** Binding rules. Must follow. Treat as non-negotiable.
- **Confidence 0.55-0.84:** Strong preferences. Should follow unless good reason not to.
- **Confidence 0.30-0.54:** Suggestions. Consider but not required.

### Storage

- **Master profile:** `~/.config/opencode/memory/taste-profile.md`
- **Archive:** `~/.config/opencode/archive/taste/` — pruned constraints
- **Raw signals:** `~/.config/opencode/memory/learning-signals.md` — append-only

## Integration Points (OpenCode)

1. **Context injection:** `taste-profile.md` added to `opencode.json` `instructions` array
2. **Signal capture:** `continuous-learning` skill (mid-session) + session-end batch
3. **Enforcement:** `clements-agent` skill Step 3 references taste constraints
4. **Audit:** `harness-check` verifies taste coherence monthly

## Design Decisions

*To be populated as we build.*
