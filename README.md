# CEDT-1

**Continuous Experience-Driven Taste engine.**

Open-source taste-based continuous learning for AI agents. Learns from every interaction, compounds over time, applies constraints to future sessions. Every session makes the agent more aligned.

Inspired by Command Code's `taste-1` architecture. Built for OpenCode. Portable to any agent framework.

---

## How It Works

```
Every interaction → Signal → Symbolic Constraint → Conditioning future generation
     ↑                                                         ↓
     └─────────────── Continuous RL Loop ─────────────────────┘
```

- **Signal extraction:** Accept, reject, edit, correction, silence (implicit approval)
- **Constraint storage:** Human-readable, confidence-scored, auto-decaying
- **Application:** Injected into agent context, binding above threshold
- **Compounding:** Confidence +0.15 per reinforcement, -0.05 per 30d of silence, pruned below 0.30

## Quick Start

```
# Coming soon
```

## Structure

```
cedt-1/
├── README.md        # This file
├── CHANGELOG.md     # Per-session evolution log
├── ARCHITECTURE.md  # Technical design & constraints
├── engine/          # Core taste engine
├── profiles/        # Taste profile format & examples
└── integrations/    # OpenCode, Claude Code, Cursor, etc.
```

## Evolution

Every change, every decision, every pivot is documented in [CHANGELOG.md](CHANGELOG.md). This repo grows with the work.

## License

MIT
