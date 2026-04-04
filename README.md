<p align="center">
  <img src="assets/circuitry.png" alt="Circuitry" width="100%" />
</p>

# Circuitry

**One command. The right workflow. The right skills. No babysitting.**

You've got skills for TDD, architecture, research, debugging -- but you're still
picking which ones to use, in what order, and hoping nothing falls apart mid-task.
Sessions crash. Reviews get skipped. Quality depends on how much you babysit.

Circuitry is a Claude Code plugin that turns one command into a structured,
multi-phase workflow. You describe your task. Circuitry classifies it, picks the
right workflow, and runs it -- research before decisions, decisions before code,
independent review before shipping. If a session dies, the next one picks up
where it stopped.

## Get Started

```bash
claude plugin install petekp/circuitry
```

Then run it:

```
/circuit evaluate CRDTs vs OT vs polling for real-time document sync
```

That's it. Circuitry classifies your task, picks the right workflow, and runs it.

## How It Works

The task above triggers a **crucible** -- three competing approaches developed,
pressure-tested, and converged into one hardened proposal:

```
  Frame ──────────▶ Diverge ─────────▶ Explore ──────────▶ Converge
    │                  │                   │                   │
  problem brief     3 workers           adversarial        select best,
  (you confirm      develop competing   review + revise,   absorb ideas
   scope)           approaches          then stress-test   from the rest,
                                        each one           pre-mortem
                       │                   │                   │
                   deep-research        gate: every        gate: every
                   injected per         weakness           pre-mortem risk
                   worker               addressed          mitigated
```

Not every task triggers a tournament. A bug fix gets scoped, tested, and fixed.
A feature build starts with research. An architecture decision gets adversarial
evaluation. Circuitry picks the workflow that fits:

1. **Triage classifies your task.** Circuitry matches your task description to
   one of seven workflows: quick fix, full feature, architecture decision, spec
   review, overnight quality pass, and more.

2. **Steps run in the right order.** Research before decisions. Decisions before
   implementation. Implementation gets an independent review from a separate
   session. Every step saves progress to disk.

3. **Progress survives crashes.** All state lives in `.circuitry/` as plain
   markdown. A new session reads that folder and resumes from wherever the last
   one stopped.

4. **You step in where it matters.** Circuitry pauses at checkpoints for your
   judgment (scope confirmation, tradeoff decisions). Everything else runs
   autonomously.

## Commands

**Entry modes** (modify the `/circuit` command):

| You type | What happens |
|----------|-------------|
| `/circuit <task>` | Triage picks the best workflow automatically |
| `/circuit fix: <bug>` | Quick bug fix with test-first discipline |
| `/circuit decide: <choice>` | Architecture decision with adversarial evaluation |
| `/circuit develop: <feature>` | Full feature build with a research phase |
| `/circuit repair: <issue>` | Deep investigation with regression testing |

**Standalone circuits:**

| You type | What happens |
|----------|-------------|
| `/circuit:cleanup` | Systematic dead code and stale doc removal |
| `/circuit:migrate` | Framework swap with coexistence planning |
| `/circuit:handoff` | Manually save your progress before ending a long session |

See [CIRCUITS.md](CIRCUITS.md) for the full catalog with phase breakdowns and
usage examples.

## Key Features

**Automatic workflow selection.** Describe your task. Circuitry picks from seven
workflows so you don't have to.

**Independent review.** Implementation and review always run in separate sessions.
The reviewer starts fresh with no knowledge of the implementation choices.

**Parallel workers.** Heavy lifting runs in isolated worker sessions. Research,
implementation, and review don't compete for your main context window.

**Circuit breakers.** When something goes wrong, Circuitry escalates to you with
the failure output and your options. No silent failures. No infinite loops.

## Recommended Skills

Circuitry works best with complementary Claude Code skills. When installed,
they're used automatically at the right phase:

| Skill | Used For |
|-------|----------|
| `tdd` | Test-first discipline in bug fixes and implementation |
| `clean-architecture` | Architecture decisions and quality passes |
| `deep-research` | Evidence gathering and external research |
| `dead-code-sweep` | Cleanup category surveys |
| `architecture-exploration` | Evaluating competing design approaches |

Install what's relevant to your stack. Circuitry works without any of them, but
each one adds depth to the phases where it applies.

**Bring your own skills.** Map any installed skill to any Circuitry capability in
`circuit.config.yaml`. See `circuit.config.example.yaml` for details.

## Optional: Codex CLI

Circuitry can run workers through Codex CLI for faster parallel execution, or
through Claude Code's built-in tools. Both work out of the box. Codex is optional
but noticeably faster for large tasks.

```bash
npm install -g @openai/codex
```

## Prerequisites

- **Claude Code** (the host environment)
- **Node.js** (no build step required)

## Further Reading

- **[CIRCUITS.md](CIRCUITS.md):** Full catalog with phase breakdowns and usage examples.
- **[ARCHITECTURE.md](ARCHITECTURE.md):** How circuits work internally.
- **[CONTRIBUTING.md](CONTRIBUTING.md):** How to build new circuits or modify existing ones.

## License

MIT
