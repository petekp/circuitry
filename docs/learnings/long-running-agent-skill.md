# Jarrod Watts' `long-running-agent` skill — what we'd borrow, what we'd skip

Notes from a read of Jarrod Watts' "You Need More Than a Ralph Loop"
post on 2026-05-07 (https://x.com/jarrodwatts/status/2052372045829382430)
and the accompanying `long-running-agent-skill` repo
(https://github.com/jarrodwatts/long-running-agent-skill). The post
argues that bare prompt loops (Codex's `/goal`, ralph wiggum loops)
fail on three predictable axes; the skill is his answer, packaged as a
single `SKILL.md` that any agent runtime can load.

This file captures what's worth lifting into circuit-next, what isn't,
and where the two systems disagree.

## What the post argues

Three failure modes in long-running agent loops:

- **Ambiguity compounds.** Each loop turn's output is the next turn's
  input. One vague decision early on misshapes everything after it.
  His fix: a heavy upfront interview phase that resolves ambiguity
  before any autonomous run begins.
- **One agent loses to many.** A single smart agent burning more
  tokens loses to an orchestrator + subagent team (implementer ↔
  reviewer). His fix: dispatch implementer subagents in git worktrees,
  follow each milestone with an architectural reviewer subagent.
- **Memory leaks out of context.** Long runs blow past the context
  window. His fix: four markdown files (`goal.md`, `standards.md`,
  `implement.md`, `progress.md`) the agent re-reads each loop turn and
  rewrites after each action.

The post is honest about the failure mode of the third fix:
*"agents don't always listen when you tell them too much."*

## What the skill is

A single `SKILL.md` plus a templates file. The execution model is two
phases:

- **Phase 1 — Setup.** Operator interview, then autonomous plan
  drafting. Output: four markdown files in `.agent/`. Last user
  interaction.
- **Phase 2 — Orchestrate.** A loop: read `progress.md` and
  `plans.md`, identify the current milestone, dispatch implementers
  in git worktrees (max 5 parallel), verify, merge, dispatch
  reviewer, fix-cycle until approved or 3 iterations, update
  `progress.md`, advance.

Dispatch is via the host's `Agent` tool with `isolation: "worktree"`.
State is the four markdown files. The reviewer cycle is a hardcoded
loop with a 3-iteration cap.

## What's worth borrowing

### The setup phase as a contract

The strongest move in the skill is the discipline of *resolving all
ambiguity before any autonomous run begins*. The interview is treated
as the most important part of the workflow, not a preamble. After
sign-off, no further operator input.

We already practice the equivalent at the operator level (the
exhaustive grill-me at project start). We don't yet ship it as a flow
or stage block. A flow whose first stage is a Frame block — typed
output, must produce an unambiguous goal report before any later
stage can run — would close that gap. Worth doing for any flow we
intend to run unattended.

### Standards as an injected, scoped input

`standards.md` is the part of the skill that's most clearly
load-bearing. Every implementer subagent reads it before writing
code. It's the team's quality bar made portable.

Circuit-next has nothing equivalent at the relay layer. A typed
standards report, written once at flow start and threaded into every
relay step's input set, would do the same job — and would be enforced
by the schema rather than relying on the worker to faithfully read a
file.

### Worktree isolation for parallel relays

The skill defaults to one git worktree per subagent for any parallel
work, with a hard cap of 5 to keep merge conflicts manageable. This
is sound. Worth confirming whether Circuit's relay step standardizes
worktree isolation when a flow fans out parallel branches; if not, the
skill is the right precedent to lift from.

### "Re-read state before every decision"

The Manus pattern, called out plainly in the skill: agent attention
drifts, the file doesn't. We get this for free in Circuit because the
trace is engine-written and the model doesn't have to remember to
update it — but the *spirit* of the rule (workers should not rely on
their own attention surviving a long run) is worth making explicit in
flow-authoring guidance.

## What we'd skip, and why

### Markdown files as the memory primitive

The four `.agent/*.md` files are where the skill is weakest by its
own admission. The model is the writer; the file is a side effect of
the model's behavior. If the model forgets, the memory is wrong, and
downstream loops compound on the wrong state. The author flags this
and frames the files as guidelines.

Circuit's bet is the inversion: the engine is the writer, the model
produces typed outputs the engine records. The trace is append-only
and engine-owned. Schema mismatches fail loudly. We'd not adopt the
markdown-as-memory pattern because it's the exact failure mode the
typed-trace approach exists to remove.

### The hardcoded 3-iteration review cap

The skill caps reviewer ↔ fix iterations at 3, then directs the agent
to "make a best-judgment call, log decision, proceed." That works as
a prompt rule. As a runtime contract it's in the wrong place — the
iteration policy belongs in the schematic for the flow that owns the
review, not in instructions to a model.

### The "after approval, you execute autonomously" walk-away model

Same reasoning as the cursor-orchestrate writeup: Circuit assumes an
operator-in-the-loop session who can redirect mid-flow. Walk-away
semantics aren't compatible with that. The skill's setup-phase
discipline is worth lifting; its no-more-operator-input rule isn't.

### One universal "build a project" macro

The skill's whole shape is end-to-end: one big run, one big goal.
Circuit's flows are kind-of-work-specific — Build, Fix, Explore,
Review — because the right shape for a fix isn't the
right shape for a review. We'd not collapse them into a single
macro flow even if we shipped a Build flow tomorrow.

## The architectural disagreement

The skill and Circuit are answers to the same question — how do you
keep agents on track over a long workflow — at different layers.

- **Skill: markdown protocol on top of any model.** The model is
  asked to follow a procedure. Memory is a file the model writes.
  Reviewer cycles are a prompt rule. State integrity depends on the
  model behaving.
- **Circuit: runtime that compiles flows.** Memory is an
  engine-written trace. Reports are typed. Reviewer is a step in a
  schematic, not a prompt directive. State integrity is enforced by
  the schema.

Both diagnoses are the same. The bet is different: the skill bets you
can codify the right protocol in prose and the model will follow it;
Circuit bets you have to push the protocol down a layer so it can't
drift. The author's own caveat — *"agents don't always listen when
you tell them too much"* — is the load-bearing argument for the lower
layer.

The honest tradeoff: the skill is lighter for one-shot greenfield
"build me a project" runs. Circuit's typed-runtime ceremony pays off
on repeated kinds of work, where the same shape runs many times and
the cost of drift compounds.

## Why the memory model requires the workflow architecture

The typed-trace bet only exists because the workflow architecture
exists. They are not two independent design choices; the second is a
projection of the first.

For the engine to be the writer instead of the model, three things
have to be true:

- **Work is shaped into discrete steps.** Something has to know "a
  step just completed" so it can write a record. That requires a
  compiled flow. In a freeform loop there is no step boundary; the
  agent is acting in one continuous stream.
- **Steps have declared output shapes.** For the trace to record
  typed reports rather than English summaries, each step has to
  declare what it produces. That requires schemas attached to blocks.
  Without them the engine can record that something happened, but
  not what — and you're back to summarizing in prose.
- **Routing between steps is explicit, not interpreted.** For the
  next step to consume a typed report from the prior step, the wiring
  has to be authored. Without explicit routes the model has to decide
  what comes next, which puts the model back in the path of state.

Strip any of the three and the memory model collapses.

This is the same pattern as a database write-ahead log. The WAL works
because the database has a transaction model — discrete commits with
declared effects. You can't bolt a WAL onto a system that doesn't
already have transactions; the log records nothing meaningful because
there are no boundaries to record. The transaction model is the
precondition; the WAL is the projection. Trace and run folder are the
same kind of projection over the workflow architecture.

What you can do without the workflow architecture is land somewhere
near cursor-orchestrate's pattern: script drives, agent decides, JSON
state file. That's a real improvement over markdown — typed shapes,
validated, externally written. But the model is still the writer,
there are no step boundaries the script can hook into, and the model
still decides what the next state should be. The runtime *being* the
writer requires the runtime to *know* what work is being done against
what contracts.

The reason this matters for positioning: the workflow architecture is
what makes the memory bet defensible. Anyone can write a SKILL.md
saying "use these four files." Building a runtime that compiles typed
flows is a much bigger lift, and once it exists the memory model
falls out almost for free. The reverse isn't true. The easy copy
path is the markdown path, which is the path that hits the failure
mode the author calls out himself.

## Status

Captured for reference. Three patterns worth holding in mind during
near-term work:

- A Frame block at the head of any flow we intend to run unattended,
  treated as a hard contract: no later stage runs until ambiguity is
  resolved into a typed goal.
- A typed standards report threaded into every relay step's input
  set, replacing the markdown-file convention.
- Worktree isolation as the default posture for parallel relay
  fan-out, with a small hard cap.

The deeper takeaway is not a new pattern — it's confirmation that the
typed-runtime bet is aimed at a real failure mode that practitioners
in this space are running into and currently working around at the
prompt layer.
