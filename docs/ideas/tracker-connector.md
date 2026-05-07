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
report, Migrate produces a batch plan, Rearchitect produces a
dependency-linked migration plan. Those outputs are exactly the shape
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

The flow is **one-way**: Circuit emits, the tracker stores. The
tracker does not feed back into Circuit's continuity or task list
mid-run. That keeps the source-of-truth boundary clear: Circuit owns
what's happening *now*, the tracker owns the durable backlog of *what
came out of past runs*.

## Connector interface (sketch)

Minimal surface — enough to express what Circuit workflows actually
produce, no more:

```ts
interface TrackerConnector {
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
  // touching the tracker. Used by the workflow to show the operator
  // before commit.
  preview?(plan: EmissionPlan): string;
}
```

Implementations:

- **markdown** (built-in fallback): writes to `docs/tracker.md` with a
  stable ID scheme. Zero external dependencies. Lives in the repo.
- **beads**: shells out to `bd create` / `bd dep add`. Requires the
  `bd` CLI on PATH.
- **linear**, **github-issues**: API-based. Out of scope for v0 but
  the shape fits.

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

**Idempotent on re-run.** If a workflow re-runs on the same input
(e.g. a Migrate batch that got re-executed after a fix), it should not
create duplicate issues. The connector needs a way to recognize
"already emitted" — easiest path is a content hash stored in the run
record, checked against tracker contents before creation.

**Edge fidelity is best-effort, not lossless.** Beads has rich edge
kinds; GitHub Issues has only "linked." Circuit's emission plan should
use a small canonical edge vocabulary and let each connector lossily
map to its native equivalents. Document the mappings; don't pretend
they're equivalent.

**No mid-run reads.** The connector is write-only from Circuit's
perspective. If a workflow ever wants "what's already in the tracker"
as input, that's a different feature with different tradeoffs (sync
direction, conflict handling) and should be designed separately, not
slipped in.

## Honest tradeoff

This adds surface area Circuit does not need today. No operator has
asked for it. The lighter move that captures most of the value: a
**recipe pattern** — a documented way to pipe Close output through a
shell step into `bd create` — with no code changes. That validates the
demand before building the abstraction.

Building the connector layer makes sense only when one of these is
true:

- An operator actually says "I want my Migrate plan in my tracker."
- Multiple workflows are independently inventing ad-hoc emission and
  the duplication is becoming a maintenance cost.
- Circuit's marketplace story benefits from advertising
  tracker-native output (plausible — "Circuit emits into your existing
  Linear / GitHub Issues / beads" is a clear value prop).

Until one of those lands, document the recipe-pattern path and treat
the connector layer as deferred.

## What to prototype (when the time comes)

Smallest version that proves the shape:

1. Define the canonical emission plan (issue list + edges) as a typed
   artifact one workflow already produces. Migrate's batch plan is the
   strongest candidate — it has natural dependencies between batches.
2. Ship the **markdown** connector first. Zero external dependencies,
   exercises the full preview / commit / idempotency path, and gives
   operators something useful even without a tracker installed.
3. Add the **beads** connector second. Validates the abstraction
   against a real tracker with real edge semantics. If the markdown
   shape needs to bend to fit beads, that's a v0 design lesson worth
   catching early.
4. Ship Linear / GitHub Issues only after a real ask.

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
