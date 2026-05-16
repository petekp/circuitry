# Tracker connector — emit workflow output as tracked issues

Idea for letting Circuit workflows write their structured output into
whatever issue tracker the operator already uses (beads, Linear, GitHub
Issues, plain markdown). Captured 2026-05-07 from a conversation about
beads (https://github.com/gastownhall/beads) and whether Circuit should
support it as a plugin.

## The trigger

Beads is a graph-structured task store for coding agents — issues with
`blocks` / `relates_to` edges, hash-based IDs, a `bd ready` query that
returns unblocked work. The natural question was "should Circuit
support beads as a plugin?"

The honest read: not as a primitive, because beads wants to be the
source of truth for agent task state and Circuit already has its own
continuity / handoff system. Two systems both claiming "where the
session lives" creates user confusion about which one to trust.

But there is a real fit at a different layer. Circuit workflows
already produce structured artifacts at Close — Explore drops a
report, Build can produce implementation follow-ups, and larger
transition plans can produce dependency-linked work. Those outputs are exactly the shape
a tracker stores natively: items with edges. Right now they live as
prose in the run record, where nothing can query them.

## The shape that fits Circuit

A **tracker connector** — a small adapter interface that workflows can
optionally emit into at Close. Beads is one implementation, Linear and
GitHub Issues are others, and a plain-markdown file is the trivial
fallback so the abstraction works without any external tool installed.

This mirrors the existing adapter pattern (agent vs codex). The
operator picks their tracker in user-global config; recipes don't
hardcode one.

The flow is **boundary-only**: Circuit reads the tracker on Frame to
ask "what should I work on?", and writes to the tracker on Close to
file what came out of the run. Mid-run, the connector is silent — no
reads, no writes. That keeps the source-of-truth boundary clear:
Circuit owns what's happening *now*, the tracker owns the durable
backlog of *what to work on next* and *what came out of past runs*.

## The two integration points

Boundary integration means exactly two touchpoints, no more:

**Frame source — "what should I work on?"** Today `/circuit:run
<task>` takes the task from the operator's prompt. With the connector
wired in, `/circuit:run` with no argument can ask the tracker for the
top of the ready queue. The tracker returns one or more unblocked
issues; Circuit takes the title and body as the task description,
runs its router (Explore / Build / Repair / Review), and
dispatches.

This is the bigger of the two. It changes the *unit of work entry*
from "operator types a prompt" to "agent picks the next unblocked
item." For a long-horizon project where the operator has filed 30
follow-ups across sessions, that's the difference between "I have to
remember what to ask for" and "the agent already knows what's next."

**Close sink — "what came out of this run?"** Workflows already
produce structured artifacts at Close: Build's follow-ups,
Review's findings, Explore's option graph, and Repair's follow-ups. Those have natural
graph shape (issues + edges). Today they live as prose in the run
record, where nothing can query them. With the connector, Close shows
the operator a preview of issues + edges to create, and on confirm
writes them into the tracker.

The two together close the loop: previous-session output becomes
next-session input.

**Three operator entry modes** that should all work:

- `/circuit:run` (no args) — queue-driven, picks from ready
- `/circuit:run <task>` — prompt-driven, current behavior, no
  tracker involvement
- `/circuit:run --link <id>` — prompt-driven but tied to an existing
  issue, so Close still calls `closeIssue` against that ID

That third one is the bridge case: operator types the task themselves
but wants the run to count against an existing issue.

## Dataflow, end to end

Walk through what happens across two sessions of an operator using
both Circuit and a beads-backed connector:

**Session 1.**

1. Operator types `/circuit:run`, no args. Circuit calls
   `connector.ready()`. Beads returns `bd-a3f8` ("Move fanout
   executor to runtime").
2. Circuit calls `connector.claim("bd-a3f8")` so the issue flips to
   `in_progress` and assignee is set. Atomic: if a parallel agent
   tried the same issue, only one wins.
3. Circuit takes the issue title + body as the task description,
   runs the router (probably Build), dispatches.
4. The workflow runs normally. Claude Code's task list tracks
   in-session steps. Continuity / handoff records work as today.
   The connector is silent.
5. Close. Workflow produces 6 follow-up batches with `blocks` edges
   between them. The connector previews: "close bd-a3f8 with
   resolution X, create 6 new issues with this edge graph,
   `relates_to bd-a3f8`." Operator confirms. Beads gets the writes.

**Session 2.**

6. Operator types `/circuit:run`. Connector hits ready queue. Top is
   now the first follow-up that session 1 filed. Loop compounds.

The mental model: beads is a **durable producer/consumer queue
between sessions**. Circuit consumes one item per session (Frame),
produces zero-to-many items per session (Close). The queue is shaped
like a DAG, so "what can I work on next" is a real query, not a
guess.

## Connector interface (sketch)

Minimal surface — enough to express what Circuit workflows actually
produce, no more:

```ts
interface TrackerConnector {
  // --- Source side (called by Frame) ---

  // Top of the unblocked queue. Returns one or more candidates; the
  // workflow picks one (usually the first).
  ready(limit?: number): Promise<TrackerIssue[]>;

  // Look up a specific issue by ID. Used by /circuit:run --link <id>.
  show(id: string): Promise<TrackerIssue>;

  // Atomic claim: mark in_progress and set assignee. Must be safe
  // against parallel agents claiming the same issue — only one wins.
  claim(id: string): Promise<{ claimed: boolean }>;

  // --- Sink side (called by Close) ---

  // Close an issue with a resolution summary. No-op if not previously
  // claimed.
  closeIssue(id: string, summary: string): Promise<void>;

  // Create an issue. Returns a tracker-native ID.
  createIssue(input: {
    title: string;
    body: string;
    kind: "task" | "bug" | "epic" | "investigation";
    priority?: 0 | 1 | 2 | 3;
  }): Promise<{ id: string }>;

  // Link two issues. Edge kinds map across trackers as best they can;
  // the connector picks the closest native equivalent.
  linkIssues(input: {
    from: string;
    to: string;
    kind: "blocks" | "relates_to" | "parent_of";
  }): Promise<void>;

  // Optional: dry-run preview of what would be created, without
  // touching the tracker. Used by Close to show the operator before
  // commit.
  preview?(plan: EmissionPlan): string;
}

interface TrackerIssue {
  id: string;
  title: string;
  body: string;
  kind: "task" | "bug" | "epic" | "investigation";
  priority?: 0 | 1 | 2 | 3;
  status: "open" | "in_progress" | "closed";
}
```

Implementations:

- **markdown** (built-in fallback): a flat `docs/tracker.md` with a
  stable ID scheme and a small parser for status / edges. Zero
  external dependencies. Lives in the repo. Source-side `ready()` is
  a topological scan over the parsed graph.
- **beads**: shells out to `bd ready --json`, `bd show <id> --json`,
  `bd update <id> --claim`, `bd close <id> "summary"`, `bd create`,
  and `bd dep add`. Requires the `bd` CLI on PATH.
- **linear**, **github-issues**: API-based. Out of scope for v0 but
  the shape fits. Source-side `ready()` would query for open issues
  with no open `blocks` predecessors.

## User-global config (sketch)

The operator picks the connector and which workflows participate at
which boundary. Per-workflow because not every workflow type benefits
from queue-driven entry — Explore is naturally prompt-driven (an
investigation question), while Repair can use the tracker as a bug queue.
The defaults below reflect that:

```yaml
# user-global circuit config (location TBD — see deferred slice on
# consumer-config story; this sketch assumes a yaml file the user
# authors directly until that lands)

tracker:
  # Which connector implementation. Omit to disable tracker
  # integration entirely.
  connector: beads          # markdown | beads | linear | github

  # Per-workflow source/sink wiring. Both sides default to "off" so
  # tracker integration is opt-in.
  workflows:
    explore:
      source: prompt        # investigations are operator-initiated
      sink: tracker         # findings can become issues
    build:
      source: prompt        # most builds are prompt-driven
      sink: tracker         # follow-ups become issues
    repair:
      source: prefer-tracker  # try ready first, fall back to prompt
      sink: tracker         # regressions / new bugs filed as issues

  # Connector-specific options
  beads:
    cli: bd                 # PATH lookup by default
    db: ~                   # use bd's default database location
```

The `source` values and what they mean:

- `prompt` — current behavior. `/circuit:run <task>` required.
- `tracker` — `/circuit:run` with no args calls `connector.ready()`.
  If the queue is empty, the workflow asks the operator for a
  prompt instead.
- `prefer-tracker` — `/circuit:run` with no args tries the tracker
  first; if no claim succeeds within a timeout, falls back to
  asking for a prompt. Useful when the tracker is sometimes empty.

The `sink` values:

- `none` — Close does not write to the tracker.
- `tracker` — Close shows a preview of issues + edges, operator
  confirms, connector writes.

Per-run override on the command line:

- `/circuit:run --no-tracker` — bypass both source and sink for
  this run.
- `/circuit:run --link <id>` — prompt-driven but tied to an existing
  issue; sink will close that ID.

## Design constraints to get right

**Opt-in per run, not per workflow type.** Not every Build run wants
to populate a tracker. The default should be "don't emit" with an
explicit flag (or workflow config) to turn it on. Otherwise routine
work pollutes the backlog.

**Preview before commit.** Mirrors the same rule as the
self-improving-circuit idea and auto-memory: never auto-apply at a
boundary the operator should see. The Close phase shows "here are the
N issues I'd create with these edges, confirm?" Operator says yes /
no / edit.

**Idempotent on re-run.** If a flow re-runs on the same input
(e.g. a Build batch that got re-executed after a fix), it should not
create duplicate issues. The connector needs a way to recognize
"already emitted" — easiest path is a content hash stored in the run
record, checked against tracker contents before creation.

**Edge fidelity is best-effort, not lossless.** Beads has rich edge
kinds; GitHub Issues has only "linked." Circuit's emission plan should
use a small canonical edge vocabulary and let each connector lossily
map to its native equivalents. Document the mappings; don't pretend
they're equivalent.

**Reads happen at Frame, writes at Close, nothing in between.**
Mid-run, the connector is silent. If a workflow ever wants "what's
already in the tracker" as input partway through a run, that's a
different feature with different tradeoffs (sync direction, conflict
handling, what to do when the tracker contradicts in-session state)
and should be designed separately, not slipped in. The boundary
discipline is what keeps the source-of-truth story clean.

**Failed claim is not a failed run.** If `claim()` returns
`{ claimed: false }` (because a parallel agent grabbed it first),
Frame should pick the next ready item, not error out. Treat the ready
queue as a best-effort hint, not a reservation system.

## Where integration does not fit

Three places that look tempting but should not be wired in. Naming
them explicitly so the boundary is clear:

**Continuity backend.** Beads has issue status (open / in_progress /
closed); Circuit has pending-continuity records. They overlap
conceptually but are different units — issues are work items,
continuity is "where the session left off mid-flow." Forcing them to
be the same thing creates impedance: what's the issue status when
you've handed off mid-Build with three subtasks complete and two
pending? Continuity stays in Circuit; issues stay in the tracker.

**In-session task list.** Persisting every Claude Code TaskCreate to
the tracker would flood it with trivia (a Build run might generate 30
ephemeral subtasks). The in-session list is the right tool for
in-session granularity. Keep it ephemeral.

**Auto-memory.** Beads has `bd remember` and Circuit has the
auto-memory system. They are doing the same job in different stores.
Leave them independent — both are operator-private; no value in
unifying. Cross-pollination at the level of *what to remember* is
fine; cross-pollination at the level of *where it lives* is not.

The principle: integrate at workflow boundaries (Frame and Close),
nowhere else. Mid-run, the two systems should be invisible to each
other.

## Honest tradeoff

This adds surface area Circuit does not need today. No operator has
asked for it. The lighter move that captures most of the value on
the **sink side**: a documented recipe pattern that pipes Close
output through a shell step into `bd create`, with no code changes.
That validates Close-side demand before building the abstraction.

Note the recipe-pattern path only covers Close. The Frame-source
side (`/circuit:run` reading from the tracker) cannot be done with a
shell step — it requires `circuit:run` itself to know about the
connector before it has a task to act on. So if the value the
operator wants is "agent picks the next thing from my backlog," the
recipe pattern does not deliver it; the connector has to be real
code. That asymmetry is worth weighing: the sink is cheap to fake,
the source is not.

Building the connector layer makes sense only when one of these is
true:

- An operator actually says "I want my Build plan in my tracker."
- Multiple workflows are independently inventing ad-hoc emission and
  the duplication is becoming a maintenance cost.
- Circuit's marketplace story benefits from advertising
  tracker-native output (plausible — "Circuit emits into your existing
  Linear / GitHub Issues / beads" is a clear value prop).

Until one of those lands, document the recipe-pattern path and treat
the connector layer as deferred.

## What to prototype (when the time comes)

Smallest version that proves the shape. Build the **sink side first**
(Close emission) — it's strictly additive, can ship behind a flag,
and exercises preview / commit / idempotency. Build the **source
side second** (Frame ingestion) — it changes the shape of
`circuit:run` itself and needs the operator-facing UX worked out.

Sink-first sequence:

1. Define the canonical emission plan (issue list + edges) as a typed
   artifact one flow already produces. A Build implementation plan is
   the strongest current candidate — it has natural dependencies between
   tasks.
2. Ship the **markdown** connector with sink-side methods only
   (`createIssue`, `linkIssues`, `closeIssue`, `preview`). Zero
   external dependencies. Exercises the full preview / commit /
   idempotency path and gives operators something useful even
   without a tracker installed.
3. Add the **beads** sink. Validates the abstraction against a real
   tracker with real edge semantics. If the markdown shape needs to
   bend to fit beads, that's a v0 design lesson worth catching
   early.

Source side, after the sink has a few weeks of real use:

4. Add `ready()`, `show()`, `claim()` to both connectors.
5. Wire `/circuit:run` (no args) to call `connector.ready()` when
   `source: tracker` is configured for the routed workflow.
6. Add the `--link <id>` and `--no-tracker` flags.

Linear / GitHub Issues connectors come later, only after a real ask.

## Open questions

- Where does the run record store the "already emitted" hash for
  idempotency — auto-memory, the run artifact, or a sidecar file the
  connector owns?
- For trackers that assign their own IDs (beads, Linear), how does
  Circuit reference an emitted issue in later prose? Round-trip the
  tracker ID into the run record? Operator-readable title?
- Does emission belong in Close, or is it a separate post-Close step
  the operator runs explicitly (`/circuit:emit-tracker`)? Explicit
  step is safer; in-Close is more ergonomic.
- Should the markdown fallback be the *primary* shape (i.e. Circuit
  always writes markdown, and "real" tracker connectors are sync
  layers from the markdown to the tracker)? That inverts the design —
  markdown becomes the canonical store and trackers are projections.
  Worth considering; arguably simpler.
- How does this interact with the self-improving-circuit idea? Both
  fire at Close, both produce proposals for the operator. Should they
  share a single "post-run proposal" surface, or stay independent?
- The user-global config sketch above assumes a yaml file the
  operator authors directly. The deferred slice on consumer-config
  story has not landed yet, so the actual config surface is still
  open. Tracker-connector config should be designed to slot into
  whatever shape that work settles on, not to invent its own.
- When `source: tracker` is on and the ready queue is empty, should
  `/circuit:run` (no args) prompt the operator for a task, exit
  silently, or print the empty queue and offer to file a new issue?
- For `prefer-tracker`, what's the right fallback timeout? Long
  enough to handle a slow remote tracker (Linear API), short enough
  not to make the operator wait when the queue is empty.
