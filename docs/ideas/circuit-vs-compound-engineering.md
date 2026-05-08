# Circuit vs. Compound Engineering — capability and synergy

Date: 2026-05-07

A note from a working session comparing circuit-next to Every's
[Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin).
Framed around capability for developers using coding agents, not market
competition. Captures what each project is actually doing, where the
synergy is, what to borrow, what not to borrow, and the gap worth
closing.

## What each project actually is

**Compound Engineering (CE).** A curated library of named slash commands
(~37 skills, ~51 agents) plus a methodology — strategy, ideate,
brainstorm, plan, work, review, compound. State passes between commands
through plain Markdown grounding documents (`STRATEGY.md`, `PLAN.md`,
`docs/pulse-reports/`). The "flow" is whatever the operator runs next.
Multi-host (Claude, Codex, Cursor, Copilot, Droid, Qwen) as flat skill
packs. Backed by Every's content team and distribution.

**Circuit.** A runtime engine that walks typed schematics. Each step has
typed inputs and outputs (Zod-defined contracts), writes a structured
report, and the engine derives registries from a single flow catalog.
Seven built-in flows (build, explore, fix, migrate, review,
runtime-proof, sweep) plus create/handoff. Hosts: Claude + Codex,
generated from one source. Solo-dev, pre-1.0.

Same problem (more reliable agent-assisted engineering), opposite bets
on where the structure lives. CE puts the structure in the operator's
head and prose docs. Circuit puts it in the runtime.

## Capability Circuit can actually unlock

The genuine shift: **a flow becomes a thing, not a session.**

Most agent work today lives inside a chat session. Context evaporates,
runs aren't reproducible, work can't resume halfway, and nothing runs
unattended. Circuit treats a flow as a typed, named, replayable
operation with structured evidence at every step. That isn't an
incremental improvement on chat — it's a different mode of operation.

Where it pays off:

- **Unattended runs.** Cron, webhook, CI. Same flow, same way, no human
  driving sequence.
- **Resumable long work.** Migrations spanning days; reviews on huge
  diffs. Checkpoint and pick up.
- **Composability.** One flow's typed output is another flow's typed
  input. Pipelines, not sessions.
- **Auditability.** Every step's report is on disk. "What did the agent
  do" is answerable without grepping a chat log.

Most developers haven't felt the pain that makes these matter yet. They
will the first time they try to put agents on a schedule or chain them.
Circuit is positioned for that moment.

## Where the synergy with CE actually is

CE and Circuit are not doing the same job. The split is real:

- **CE = the choreography.** What good agent work looks like.
- **Circuit = the substrate.** How to run that choreography reliably.

Concrete synergy moves:

1. **CE skills as step blocks inside Circuit flows.** A Circuit flow
   could invoke `/ce-brainstorm` or `/ce-plan` as the work inside a
   step, while Circuit's typed contracts bridge between steps. CE owns
   craft. Circuit owns coordination.
2. **Wrap the CE loop as a Circuit flow.** A `compound` flow that runs
   brainstorm → plan → work → review → compound with checkpoints and
   typed evidence. Same methodology, now resumable and replayable.
3. **Cite CE in Circuit's docs as the methodology source.** Don't
   reinvent "what good looks like" — point at it.

## What to borrow from CE

Four things CE does well that Circuit is missing:

### 1. Plain-English grounding alongside typed reports

CE's `STRATEGY.md` and `PLAN.md` are short Markdown anchors that humans
and agents re-read to re-orient. Circuit's typed JSON reports are great
for engine logic but slower for re-orientation. Add a short prose
summary at each stage. Keep the typed report as the contract; ship the
prose as the re-orientation surface. Pure upside.

### 2. The compound/learning loop

CE's `/ce-compound` writes a durable learning note after each cycle
that future runs read. Circuit treats each run as independent. The
engine writes evidence per run, but nothing carries forward. A simple
`learnings.md` per flow, appended after each run and read as grounding
by the next, would close this gap.

This is the one mechanic that genuinely makes each unit easier than the
last. Without it, "compounding" is a name we can't claim.

### 3. An upstream story

Circuit's flows are mostly midstream (Review, Migrate, Fix, Build). CE
is strongest *upstream* — turning a vague idea into a right-sized
requirements doc before any code work. Circuit has no
Brainstorm/Ideate equivalent. That's where agent work most often goes
wrong, and the engine architecture would actually pay off there: typed
brief → typed plan → typed work.

### 4. A property-name, not just part-names

"Compound engineering" is sticky because it names a property — each
unit easier than the last. Circuit's vocabulary names parts (flow,
schematic, block, route, relay). The parts are accurate; the property
is more memorable.

Worth asking what property Circuit's engine actually delivers —
*replayability*, *auditable agent runs*, *programmable agentic ops* —
and naming it explicitly.

## What not to borrow

- **The 37-skill / 51-agent surface.** CE can do that because Every has
  a content team writing skills full-time. Solo, that's a treadmill.
  Circuit's payoff is heavily-engineered flows, not many of them.
- **Prose-only state between steps.** Don't replace typed contracts
  with grounding Markdown — augment them. The typed contracts are the
  moat.

## The gap worth closing

The thing missing from Circuit that would most change what developers
can do isn't borrowed from CE directly — it's the *upstream + compound
loop combined*.

Today Circuit can run a Review or a Migrate reliably. It can't yet
take "I want to add feature X" → brainstorm → plan → execute → review →
durably remember what was learned, all as one replayable, resumable,
typed pipeline.

If it could, that's the real capability unlock: the first plugin where
the engineering loop is itself a programmable, learning artifact —
not a chat session re-narrated every time.

That is the version of Circuit worth building toward. CE is useful as a
mirror that shows which pieces are missing. The engine is what makes
those pieces work in a way no chat-driven plugin can match.

## Open questions

- What's the right name for the property Circuit delivers? (Candidates:
  replayable agent ops, auditable agentic engineering, programmable
  flows.)
- Where does the learning loop live — per-flow, per-codebase,
  per-operator?
- Is the upstream brainstorm/ideate flow a Circuit flow, or a CE skill
  invoked inside a Circuit flow?
- Is there a "circuit-compound" flow worth shipping as a credibility
  move toward the CE community?
