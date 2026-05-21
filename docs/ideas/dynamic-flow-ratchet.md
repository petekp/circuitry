# Dynamic flow composition as a ratchet for coding agents

Idea seed for runtime-generated flows in Circuit and the longer-term
mechanism by which they could compound into durably better agents.
Captured 2026-05-07 from a conversation that started with "is it
possible for Circuit to dynamically create flows at runtime?" and
intentionally widened to "what would the long-term implications of that
capability be?"

## The trigger

The starter question was whether Circuit could expose something like
`circuit:smart` — a flow that decides what steps are needed as it
progresses, based on the results of prior steps, instead of executing a
predeclared schematic. The interesting answer turned out to be less
about that flow specifically and more about whether such a capability
unlocks a *ratchet* — a mechanism by which the agent gets durably
better over time, not just a flexible flow that feels smart for a week.

A future build would slot into stages 1–3 below.

## Where Circuit is today

Circuit's flows are statically declared as `schematic.json` packages
(see `src/flows/<id>/schematic.json`, aggregated in
`src/flows/catalog.ts`). The router selects a flow based on signals;
the flow itself is fixed at compile time. Existing runtime dynamism
inside a schematic:

- **Data-driven fanout.** A step can declare
  `fanout.branches.kind: "dynamic"` that reads a prior report and spawns
  N branches whose count, IDs, and goals come from that report. The
  tournament step in `src/flows/explore/schematic.json` does this —
  `decision-options.json` decides what branches run.
- **Entry modes / depth.** `entry_modes` (lite / standard / deep /
  tournament / autonomous) select different stage paths through the
  same schematic.
- **Conditional routes.** Each step's `check.pass` outcome routes to
  `continue` vs `stop`, optionally skipping a stage.

What it does **not** do today: a running step authoring a brand-new
step ID or step kind that wasn't in the schematic. The router,
registries, and contract validators all key off the compiled
`CompiledFlowPackage`, so "the LLM invents stage 7 mid-run" isn't a
thing.

The existing execution kinds across all schematics are `relay`,
`fanout`, `compose`, `verification`, and `checkpoint`. None of them
iterate.

## The two design changes a dynamic planner would need

A planner step itself is just a relay — `decision-options-step` already
demonstrates the shape (a relay that emits `plan.strategy@v1`-aliased
output that a downstream dynamic fanout consumes). No new step type is
required for the planner.

The genuinely new blocks are downstream of the planner:

**1. Heterogeneous fanout (smaller change).** Today's `fanout.template`
has a fixed `report_schema` and `role`; every branch is the same shape,
only the goal varies via `$item.<field>`. A smart flow needs each plan
item to carry its own schema/role/kind so branch 1 can be a researcher
emitting `evidence@v1` while branch 2 is a writer emitting
`compose@v1`. This is a real schema/runtime change to fanout but it's
a generalization of what exists, not a new execution kind.

**2. A loop / react block (bigger change).** Existing kinds are
all one-shot. "Decide next steps as it progresses, based on results of
prior steps" is plan→act→observe→re-plan. Fanout commits to the whole
plan up front and runs branches in parallel; a loop lets the planner
see what happened and adjust. This *is* a new execution kind — call it
`loop` or `react` — with a max-iteration bound, a loop-state contract,
and a termination predicate.

So: one-shot version is mostly heterogeneous-fanout + a new plan
contract. Iterative version is a new execution kind plus loop-bounded
checkpointing semantics so runs stay replayable.

## What "ratcheting" actually requires

A coding agent gets better along four independent axes:

1. **Model capability** — not under our control; we ride it.
2. **Step vocabulary** — what kinds of work can be expressed as a
   typed, reportable step.
3. **Step prompts/contracts** — the quality of each step in isolation.
4. **Composition policy** — knowing which steps to use, and in what
   order, for a given task.

Static schematics are a frozen answer to #4. The flow author hand-encodes
"for build tasks, do plan→implement→verify→compose." That answer never
improves on its own; every operator session is the first session.

A dynamic planner moves #4 from "frozen policy" to "policy that runs
every time." That's a *prerequisite* for ratcheting, but it doesn't
ratchet by itself — every run is still a snowflake unless something
carries forward between runs.

## The three-stage ratchet

`circuit:smart` is only the first stage. The compounding capability
lives in stages 2 and 3.

**Stage 1 — per-run dynamism.** Planner sees the task, picks steps. No
memory. Useful but not yet learning.

**Stage 2 — episodic retrieval.** Every run leaves a trace. The
planner's prompt is augmented with "for tasks shaped like this one,
here's what prior runs did and how they ended." This is RAG over the
local corpus of run traces. Cheap to build once stage 1 exists, because
the trace format is already structured. This is where the agent starts
to feel like it has experience.

**Stage 3 — schematic crystallization.** When the same step-sequence
shows up in N successful runs, the system proposes promoting it to a
static flow — minting `circuit:<new-flow>` with typed contracts and
verifiers, joining the catalog. What was discovered dynamically is
fossilized into something cheap, fast, replayable, and operator-
reviewable. The catalog grows from observed practice instead of from
operator authoring sessions.

Stage 3 is the strategically interesting one. Most "agentic" systems
stop at stage 1 and ship a generic ReAct loop wearing their branding.
Stage 3 turns Circuit-the-runtime into Circuit-the-self-extending-
toolbox.

## The constraint that makes any of this work

When you build a dynamic planner there's a temptation to let it be
open-ended — the LLM decides what to do, including making up new step
kinds. Don't. The thing that makes ratcheting *possible at all* is
that the planner operates over a **closed alphabet**: a finite registry
of step kinds and a finite registry of report contracts. The dynamism
is "which steps, how many, in what order" — not "invent a new step on
the fly."

Why this matters:

- You can **count** how often each step appears in successful vs failed
  runs.
- You can **cluster** runs by their step-sequences.
- You can **compare** two runs of the same task because their structure
  is commensurable.
- You can **detect motifs** and propose them as crystallization
  candidates.

Without the closed alphabet, every dynamic run is an incomparable
transcript and you cannot improve. With it, every run is a structured
datum that compounds. This is the deepest design property of
Circuit-as-it-stands and it should be preserved religiously even when
going dynamic: **typed contracts everywhere, even when the path is
chosen at runtime.**

## How the operator's role evolves

If stage 3 lands, the operator's job shifts: from "author flows" →
"curate crystallization candidates" → "validate that the agent's
emergent playbook still matches business intent." The schematic author
becomes a target for automation. Long horizon, but it's the natural
shape, and it's consistent with the existing governance split
(operator owns product direction; engineering is delegated). The
operator reviews patterns the system surfaced rather than writing them
from scratch.

## Honest tradeoffs

**The Bitter Lesson tension.** Static schematics are hand-tuned
heuristics; dynamic flows are general methods. Sutton's lesson
suggests the general method wins given enough scale. But the lesson
doesn't apply 1:1 to a product agent system because we're not
optimizing a benchmark — we're optimizing operator trust and replay-
ability. Typed contracts aren't heuristics, they're invariants. The
two-tier endpoint (dynamic composition + static crystallization) is the
honest blend: keep the general method available for novel shapes,
fossilize the patterns that work into static flows.

**The plateau-at-stage-1 failure mode.** Ship `circuit:smart`, never
build stages 2–3, watch erosion happen to the typed-contract discipline
because people start letting the planner cut corners "since it's
dynamic anyway." Result: a flexible flow that feels magical for a few
sessions, then plateaus, while what made Circuit different from any
Anthropic-SDK agent loop quietly disappears.

**Replay cost.** Loop-based execution makes run reconstruction harder
than a fixed schematic. Every iteration's plan needs to be persisted
as a typed report, the loop-state contract has to be defined, and the
trace format has to make iteration boundaries first-class. Doable, but
not free.

## The strategic question

The question is not "do we want dynamic flows" — it is **"are we
committing to stages 2 and 3, with the discipline of preserved typed
contracts, or are we just building a flexible flow?"** Those are very
different products.

The first one ratchets and gets durably better, and `circuit:smart`
becomes the seed of a self-extending toolbox.
The second one is a feature. It's fine. It just doesn't compound.

If we commit to the first, then the trace format, the run corpus
structure, and the crystallization pipeline all need to be design
constraints from day one — not afterthoughts.

## Open questions

- What's the right shape for the plan contract (`smart.plan@v1`)?
  Probably a list of `{kind, role, report_schema, goal, depends_on}`
  items, but the `depends_on` semantics need thought (DAG vs sequence
  vs conditional).
- Is stage 1 best built as a `loop` step, or as heterogeneous fanout
  with a re-entry edge, or as a sub-run relay loop in
  `src/runtime/executors/sub-run.ts`? Each has different replay
  implications.
- What's the storage shape for the run corpus that stage 2 reads from?
  The current run-files layout is per-run; stage 2 needs a queryable
  index across runs (probably embeddings + metadata).
- What's the trigger for crystallization in stage 3? Pure
  step-sequence frequency, or weighted by operator-review outcome, or
  something else? Frequency alone risks fossilizing common-but-bad
  patterns.
- How does crystallization interact with `circuit:create`, which
  already publishes user-global custom flows? Is a crystallized flow a
  proposed `circuit:create` invocation, or is it a different code
  path?
- This idea overlaps with `self-improving-circuit.md` (doc-update as a
  learning channel) and `per-step-validation-check.md` (machine-checked
  acceptance criteria as a precondition for long autonomous runs). The
  three together describe a coherent program; it's worth a follow-up
  pass to figure out whether they should be unified into one design or
  kept as independent threads.
