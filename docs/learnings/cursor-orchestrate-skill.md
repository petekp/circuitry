# Cursor's `orchestrate` skill — what we'd borrow, what we'd skip

Notes from a read of Cursor's `orchestrate` SKILL.md on 2026-05-07
(https://github.com/cursor/plugins/blob/d1cdb88a9eb33cf392395c87e3fd76419fc1010e/orchestrate/skills/orchestrate/SKILL.md).
The skill kicks off a tree of parallel Cursor cloud agents from an
explicit `/orchestrate <goal>` invocation. A root planner fans out
subplanners, workers, and verifiers; coordination happens through
structured handoffs and a JSON state file.

This file captures what's worth lifting into circuit-next, what isn't,
and the architectural disagreement between the two systems.

## What the source is

A skill for orchestrating multiple cloud-hosted coding agents in
parallel via the Cursor SDK. The execution model is a tree:

- A **planner** owns a scope, writes `plan.json`, reads handoffs,
  decides what's next. Planners do no coding.
- A **subplanner** is a recursive planner over a slice of the parent's
  scope.
- A **worker** runs one task in an isolated repo clone, returns one
  handoff.
- A **verifier** checks acceptance criteria for a target and returns a
  verdict.
- **Git** is the shared medium: branches carry code, a `handoffs/`
  directory carries meaning.

A script (`scripts/cli.ts`) drives the spawn / wait / handoff loop.
The planner agent decides; the script executes.

## What's worth borrowing

### "Long-running agent loops drift; a script with a JSON state file keeps its footing"

The single sharpest line in the skill. The pattern: agent *decides*,
script *drives*. State lives in `plan.json`, not in the agent's
working memory. The agent reads handoffs, updates the plan, and the
script does the rest.

circuit-next's circuits are long-running agent loops — Frame → Plan
→ Act → Verify → Review → Close. The drift risk applies even though
we're sequential rather than parallel. The question worth asking next
time we touch a circuit: how much of its state is reconstructed from
natural-language phase markers each turn, vs. recorded in a
structured artifact the engine reads? If the answer is "mostly
natural language," we have the drift surface orchestrate is pointing
at.

This isn't a recommendation to introduce a state machine right now.
It's a lens to apply when a circuit feels flaky or repeats itself.

### Planners own scopes and publish tasks. They do no coding.

A hard role-discipline rule. If a planner feels the urge to edit a
file, it publishes a task for a worker instead. Sharper than the
flywheel's implicit Plan/Bead/Code separation, because it's stated as
a contract, not an emergent property.

circuit-next has Plan and Act phases, but nothing enforces the
separation — a Build-circuit Plan phase can quietly slide into editing
if the agent gets impatient. Importing this rule (as a phase
contract, not as new infra) would be free and would prevent a real
failure mode where Plan output is partial and Act has nothing left to
do.

### The node-type table as a documentation pattern

Five rows (Planner / Subplanner / Worker / Verifier / Git), four
columns (runs the loop? scope? output?). The entire mental model of
the system fits on one screen.

circuit-next has comparable conceptual surface area — circuits,
rigor profiles, adapters, dispatch shapes — and we have nothing this
crisp. Even if we don't lift the architecture, the table format is
worth lifting for our own surfaces. Operators reading our docs should
be able to see the whole shape on one screen.

### `disable-model-invocation: true` for expensive operations

The skill loads only on explicit `/orchestrate` invocation, never
autonomously. The frontmatter declares it. Right shape for any future
circuit that spawns cloud workers, costs real money, or is
hard-to-reverse. We don't have anything matching this profile yet,
but the pattern is in the bank for when we do.

### Optional visibility layer with explicit fallback

Slack integration is optional. If `SLACK_BOT_TOKEN` is missing, the
script logs once and runs without it. The skill states the contract
plainly: *"correctness does not change."*

Clean separation of "what makes the system correct" from "what gives
the operator a window into it." Worth holding as a default rule
whenever we add observability or telemetry to circuit-next: never
make correctness depend on a visibility channel.

## What we'd skip, and why

### The cloud-agent and walk-away parts of the architecture

What genuinely doesn't transfer from orchestrate isn't the tree
shape itself — it's two specific properties of orchestrate's tree:

- **Workers run as cloud agents in cloned sandboxes.** circuit-next
  dispatches in-process / on-host. We don't have the cloud infra,
  and adopting it isn't a design choice — it's a separate
  infrastructure project.
- **The operator kicks off the root and walks away.** circuit-next is
  built around an operator who stays in the loop and can redirect
  mid-circuit. Walk-away semantics aren't compatible with that
  session model.

The git-as-shared-medium piece (a `handoffs/` directory committed
alongside code as the sole inter-agent message channel) is in the
same bucket — it's an answer to "how do isolated cloud sandboxes
communicate," and we don't have isolated cloud sandboxes.

Lifting any of these three without the underlying conditions would
be cosplay — the ceremony without the load it's there to bear.

### Verifier as a separate node type

In orchestrate, a verifier is a distinct node that checks acceptance
criteria and returns a verdict. It earns its keep because workers
need an external judge in a parallel system.

circuit-next folds verification into the Verify and Review *phases*
inside circuits — same agent, same context, different stage of the
loop. For a sequential system that's fine; the cost of "agent grades
its own work" is mitigated by the fresh-eyes-on-batch-review pattern
we already do. Splitting verification into a separate node type would
add structure without solving a real problem.

### Subplanners as a separate, named node type

The recursion concept is fine on its own — circuit-next already has
the primitive in dispatch, and a worker could in principle dispatch
its own workers. What we'd skip is treating recursive planners as a
*distinct named role* in our model. Naming "Subplanner" as a separate
node type would be premature taxonomy for a shape we don't yet
exercise. If a circuit ever genuinely needs nested fanout, we'd
extend dispatch, not import a node-type vocabulary.

## The architectural disagreement

orchestrate and circuit-next are both answers to the question "how do
you keep coding agents on track over a long workflow." They differ in
two ways that are easy to conflate, so it's worth pulling them apart.

**Role discipline.** orchestrate enforces it through topology:
planners can't code because workers are the only nodes holding an
edit context; siblings can't talk because the tree forbids it; state
lives in a file because no agent's memory survives a sandbox restart.
circuit-next would have to enforce the same rules through phase
contracts and convention, since our circuits run in one session. The
discipline patterns are independently load-bearing — they'd help a
sequential system too — and adopting them costs nothing.

**Topology.** Here the two systems are closer than they look.
circuit-next already has a parallelism primitive: dispatch fans out
work to workers and collects structured results, which is the same
shape as orchestrate's planner → worker relationship. The parts of
orchestrate that genuinely don't transfer are narrower than they
first appear:

- **Cloud-agent execution.** orchestrate spawns Cursor cloud agents
  in isolated sandboxes via the SDK; we dispatch in-process /
  on-host. That's missing infra, not a design choice.
- **The operator-walks-away session model.** orchestrate assumes the
  operator typed `/orchestrate` and is done; the tree runs for hours
  and comes back with a PR. circuit-next assumes the operator is
  reading along and can redirect mid-phase. That's the deeper design
  difference, and it's about session shape, not parallelism.

What's *not* orthogonal: recursive dispatch (a worker spawning its
own sub-fanout), wider parallel fan-out within a phase (e.g. parallel
slice execution in Build), structured-handoff returns (dispatch
already does this in a small way). These are extensions of
circuit-next's existing topology, not imports of a foreign one. We
just haven't pushed dispatch in those directions because the
operator-in-the-loop session model hasn't yet needed it.

So the more honest separation is three buckets, not two:

- *Role-discipline patterns* — real list, worth adopting.
- *Cloud-execution and walk-away session model* — genuinely
  orthogonal, infrastructure- and session-model-level.
- *Recursive / wider dispatch* — in our design space, available if a
  circuit ever earns it.

## Status

Captured for reference. Two patterns worth holding in mind during
near-term work:

- The "agent decides, script drives" lens, applied next time a
  circuit feels flaky or repeats itself.
- The planners-don't-code rule, applied as a Plan-phase contract next
  time we touch Build.

The node-type table format is worth keeping in mind for any future
docs pass over circuits/rigor/adapters.
