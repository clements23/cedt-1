# CEDT-1

**Continuous Experience-Driven Taste engine.**

An open-source implementation of taste-based continuous learning for AI agents. Learns from every interaction, compounds over time, applies constraints to future sessions.

Inspired by Command Code's `taste-1` architecture.

---

## How It Works

```
Every interaction → Signal → Symbolic Constraint → Conditioning future generation
     ↑                                                         ↓
     └─────────────── Continuous RL Loop ─────────────────────┘
```

## Structure

```
cedt-1/
├── engine/          # Core taste engine
├── profiles/        # Taste profile format & examples
├── integrations/    # OpenCode, Claude Code, Cursor, etc.
└── README.md
```

## License

MIT
