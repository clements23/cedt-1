# CEDT-1: taste-2 → OpenCode Mapping

How each taste-2 component maps to its CEDT-1 equivalent, with implementation notes.

## Schema (src/store/schema.js → identical)

The typed rule model is directly reusable. No changes needed — it's agent-agnostic.

```javascript
// CEDT-1 uses the same schema
export function newRule(partial) { /* identical to taste-2 */ }
export function validateRule(rule) { /* identical to taste-2 */ }
```

## Store (src/store/index.js → adapted)

| taste-2 | CEDT-1 | Notes |
|---------|--------|-------|
| `~/.taste2/rules/` | `~/.config/opencode/cedt1/rules/` | OpenCode config directory |
| `TASTE2_HOME` env | `CEDT1_HOME` env | Same pattern, different name |
| `addRule()` | identical | Same logic |
| `reinforce()` | identical | Same confidence model |
| `supersede()` | identical | Same linked-list approach |
| `resolveConflicts()` | identical | Higher confidence wins |
| `decay()` | identical | Same thresholds |

## Extract (src/extract/index.js → adapted)

| taste-2 | CEDT-1 | Notes |
|---------|--------|-------|
| `inferCategory()` | identical | Same keyword mapping |
| `heuristicExtract()` | identical | Same 4 pattern types |
| `llmRefine()` | adapted | Different env vars: `CEDT1_EXTRACTOR_URL`, `CEDT1_EXTRACTOR_MODEL` |

## Capture (src/capture/index.js → **replaced**)

taste-2 uses Claude Code's `UserPromptSubmit` hook with stdin JSON.

CEDT-1 uses OpenCode's **continuous-learning skill**:
- Fires mid-session on user corrections (watches conversation for correction markers)
- Fires at session end (batch processes success signals, decay, cross-session synthesis)
- No stdin JSON — reads from session transcript directly

## Inject (src/inject/index.js → **replaced**)

taste-2 injects via Claude Code's `SessionStart` hook with `hookSpecificOutput.additionalContext`.

CEDT-1 injects via OpenCode's **instructions array** in `opencode.json`:
- Taste profile is written to a file (`~/.config/opencode/memory/taste-profile.md`)
- File is added to `instructions` array (auto-loaded into every session's system prompt)
- Selection logic (global ≥0.6 + domain match, cap 40) applied during write, not at read time
- Export format: markdown, same as taste-2's export function

## Decay (src/decay/index.js → identical)

Same logic, same thresholds, same launchd pattern. No changes.

**Known taste-2 bug:** archive function in decay/index.js lines 73-74 uses placeholder code:
```javascript
const yaml = JSON.parse; // placeholder
existing = globalThis.__yamlCache?.parse(fs.readFileSync(archiveFile, 'utf8')) ?? [];
```
This won't work. Fix: directly `import yaml from 'yaml'` at top level and use `yaml.parse()`.

## Sync (src/sync/index.js → adapted)

Same git-backed sync. Different repo path. Optional remote.

## CLI (src/cli/index.js → adapted)

Same command surface. Different binary name (`cedt1` vs `taste2`). Different default paths.

## Migration (src/migrate/index.js → adapted)

CEDT-1 migrates from:
1. taste-2 format (if user has taste-2 data)
2. OpenCode memory files (lessons.md, user-preferences.md) — extract constraints from existing learnings
3. Direct YAML rules (portable between taste-2 and CEDT-1)

## OpenCode-Specific Integration

### context injection
```json
// opencode.json
{
  "instructions": [
    "~/.config/opencode/memory/taste-profile.md",
    // ... existing instructions
  ]
}
```

### continuous-learning skill
```
Trigger: mid-session (user correction detected) + session-end (batch)
Actions:
  Mid-session: extract rule, persist, reinforce
  Session-end: batch success signals, decay check, cross-session synthesis
  Write updated taste-profile.md
```

### enforcement
```
clements-agent skill Step 3:
  - Read taste-profile.md constraints with confidence ≥0.85
  - Treat as binding rules (must follow)
  - Conflicts: higher confidence wins
```

## Implementation Order

1. Schema + Store (port directly from taste-2 with path changes)
2. Extract (identical, different env vars)
3. continuous-learning skill (new — replaces capture/inject hooks)
4. CLI (port with path changes)
5. Migration (from taste-2 + from lessons.md)
6. Decay + launchd (identical)
7. Sync (identical with path changes)
8. Tests (port + extend)
9. Wire into opencode.json instructions array
