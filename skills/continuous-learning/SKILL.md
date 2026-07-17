# continuous-learning

Continuously learn user preferences from every interaction. Detects corrections, extracts structured rules, and persists them to the CEDT-1 taste store. Rules compound over time — confidence increases with reinforcement, decays with silence.

## When to Fire

**Auto-fire on:**
- **Mid-session:** Whenever the user corrects you (contains "no,", "don't", "actually", "use X instead", "should be", "wrong", "incorrect", "not that", "never")
- **Session end (5+ tool calls):** Batch process — success signals, decay, inject updated profile

## Correction Detection (mid-session)

When the user's message matches any of these patterns, extract a rule:

| Pattern | Example | Extraction |
|---------|---------|-------------|
| `no, ...` / `don't ...` / `never ...` | "No, don't use em dashes." | → "Never use em dashes." (negation) |
| `actually, ...` | "Actually, use named exports." | → "Always use named exports." (affirmation) |
| `use X instead of Y` | "Use pnpm instead of npm." | → 'Use "pnpm" instead of "npm".' (preference) |
| `should be ...` / `that's wrong` | "That's wrong, the file goes in src/content/" | → extract the correction |
| `always ...` / `make sure to ...` | "Always verify the deploy after pushing." | → "Always verify the deploy after pushing." (affirmation) |

**Do NOT extract when:**
- Message ends with `?` (it's a question, not a correction)
- Message starts with "can you", "could you", "please", "help me" (it's a request)
- Message is <8 chars or >800 chars (too short or too long)

## Persistence (mid-session)

When a correction is detected, run:

```bash
cedt1 learn "<the correction text>"
```

This automatically:
1. Extracts the rule via heuristics (or LLM if CEDT1_EXTRACTOR_URL is set)
2. Categorizes it (communication, content, code, git, deploy, client-work, general)
3. Persists it with confidence 0.70 (or 0.5 if no heuristic matched)
4. Deduplicates — if the same rule already exists, reinforces it instead (+0.05)

**Example:**
```
User: "No, don't use tabs in this file, use spaces."
> cedt1 learn "No, don't use tabs in this file, use spaces."
→ Rule created: "Never use tabs, use spaces." [code] conf:0.70
```

## Session-End Batch (after 5+ tool calls)

At session end, run these in order:

### 1. Success Signal Scan
Review the session transcript. For every output the user did NOT correct:
- If the output was used (user said "good", "perfect", "this works", "thanks" or took no corrective action): +0.03 implicit reinforcement
- For each uncorrected output, identify which rules were applied and reinforce them

### 2. Rule Injection
Run `cedt1 inject` to write the updated taste profile to opencode's memory directory:
```bash
cedt1 inject
```
This writes `~/.config/opencode/memory/taste-profile.md` with all rules >= 0.6 confidence, formatted with binding levels.

### 3. Decay Check
Run `cedt1 decay` to decay stale rules:
```bash
cedt1 decay
```
Rules not reinforced in 120+ days lose 0.01/day. Below 0.25 → archived. Below 0.10 → deleted.

### 4. Sync (if remote configured)
```bash
cedt1 sync
```

## Rule Structure (what gets stored)

Each rule in `~/.cedt1/rules/<category>.yaml`:
```yaml
- id: a1b2c3d4e5
  text: Never use em dashes. Replace with " - ".
  category: content
  scope: global
  confidence: 0.92
  source: learned
  evidence:
    - kind: user-correction
      raw: "no, don't use em dashes"
  tags: [negation]
  created_at: 2026-07-17T10:00:00.000Z
  last_reinforced: 2026-07-17T12:00:00.000Z
```

## Confidence Lifecycle

| Event | Effect |
|-------|--------|
| New rule (heuristic match) | 0.70 |
| New rule (no heuristic match) | 0.50 |
| Reinforcement (same rule observed again) | +0.05 (capped 0.99) |
| Decay (per day without reinforcement) | -0.01 |
| Archived (below 0.25) | Moved to state/archive.yaml |
| Deleted (below 0.10) | Removed |

## Binding Levels (how rules are applied)

| Confidence | Label | Meaning |
|-----------|-------|---------|
| >= 0.85 | BINDING | Must follow. Non-negotiable. |
| 0.55 - 0.84 | PREFERRED | Strong preference. Follow unless good reason not to. |
| 0.30 - 0.54 | SUGGEST | Consider but not required. |

## Commands Quick Reference

```bash
cedt1 status          # Show rule counts + conflicts
cedt1 learn "<text>"  # Extract and persist a rule from a correction
cedt1 add "<text>"    # Manually add a rule
cedt1 inject          # Write taste profile to opencode memory
cedt1 export          # Print full markdown export
cedt1 decay           # Run confidence decay + archive
cedt1 sync            # Git commit + pull + push
cedt1 list            # List all rules as JSON
cedt1 migrate         # Import from existing config stores or lessons logs
```
