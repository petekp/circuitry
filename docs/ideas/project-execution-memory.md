# Project Execution Memory

Idea seed for the first concrete cut of Circuit's effectiveness ratchet:
a small, project-scoped store of cited execution facts that makes the
selected flow run better in this repo over time. Captured 2026-05-28
from a design pass that reviewed the existing memory idea docs
([`longitudinal-evidence-memory.md`](./longitudinal-evidence-memory.md),
[`self-improving-circuit.md`](./self-improving-circuit.md),
[`dynamic-flow-ratchet.md`](./dynamic-flow-ratchet.md)), the CONTEXT.md
memory posture, and the real run evidence under `.circuit/runs`.

This is not an implementation spec. It is a first-cut design grounded in
the evidence Circuit actually captures today. Every code and evidence
claim below was checked against the repo at capture time.

## One-liner

A small, durable, project-scoped store of cited execution facts (verify
commands, recurring failures, risky subsystems) written as
`MemoryInputV0` records using the unused `kind:"project"` seat, surfaced
into the selected flow's relay prompt at run start, keyed by
`(project, flow_id)` rather than goal-lexical similarity, with a clean
produce, announce, consume loop through the run-envelope slots that exist
and sit empty today.

## 1. The gap today

Circuit already has a memory pipeline, but it is episodic recall, not an
execution ratchet. The only producer of `MemoryInputV0` is lexical
`prior_run` recall (`src/history/memory-preview.ts`): at fresh run start
the operator goal is tokenized into a query, the top three memory-safe
docs are returned as `hint_only` inputs, and the hint text is essentially
"prior run X's goal and summary."

You can see what this produces in a real recall against
`"Please review the results of the v1 migration"`
(`.circuit/runs/8ef6eb57.../reports/history/recall.json`):

- Rank 1 is literally `"Run closed with outcome aborted."`, a build run's
  bare close summary, with the entire run-envelope header dumped into the
  hint text.
- Ranks 2 and 3 are two unrelated explore essays about Karl Friston's
  Free Energy Principle, surfaced only because they share tokens like
  "review", "circuit", and "memory" with the query. Neither has anything
  to do with reviewing a v1 migration.

That is fine as a "have you seen this before" pointer. It is not memory
that makes the review flow run better in this repo. It does not tell the
agent "the verify command here is X", "this subsystem regresses when you
touch it", or "this check fails for a known reason." It re-surfaces the
same prose summaries the history index already holds, ranked by token
overlap with the goal.

Meanwhile the schema has an empty seat the ratchet can fill.
`MemoryInputKind` (`src/schemas/memory-input.ts:8-15`) defines `project`,
but nothing emits it. Every record in the index and every hint in
recall.json is `kind:"prior_run"`. The run envelope tells the same story:
`memory_update_events` is `[]` in every run, `surface_output.memory_indicator`
(`src/schemas/run-envelope.ts:399`, an optional field) is never
populated, and `memory_context.used` only ever credits prior-run lexical
hits. The slots for an execution ratchet are built and unwired. This
design wires them.

## 2. Why this shape, and what the option pass learned

Four candidate designs were generated independently (a curated project
profile, a failure and surprise ledger, an end-of-run learn step, and
flow-scoped memory). All four converged on the same correct target (fill
`kind:"project"`, write the empty envelope slots) and were sunk by the
same flaw: they mined evidence Circuit does not capture. The headline
facts each proposed (`"npm run verify times out, use verify:fast"`,
`"npm test is flaky on file watchers"`, per-command wall-clock deltas)
assume a shell-command-and-timing log that does not exist. This was
checked directly:

- `trace.ndjson` across all runs contains no command strings. Entry kinds
  are `step.entered/completed/report_written`, `relay.*`,
  `check.evaluated`, `guidance.decision`, `run.*`, `fanout.*`,
  `checkpoint.*`, and `step.aborted`. There is no `command` field and no
  operator-recovery marker.
- `check.evaluated` carries only `{check_kind, outcome}` where
  `check_kind` is one of `result_verdict`, `schema_sections`,
  `checkpoint_selection`, `fanout_aggregate`, and `outcome` is `pass` or
  `fail`. It cannot say "npm test failed on src/foo.ts."
- `process-evidence.json`'s `declared_report_paths` is a static per-flow
  constant and `missing_evidence` is a pure function of `outcome`.
  Neither encodes per-file presence or per-check verification across runs.

So this cut keeps every grounded idea the four candidates produced and
rebuilds population on signals that actually exist:

1. **Spine: project profile.** The `kind:"project"` store of distilled
   execution facts is the right execution-first home. Kept.
2. **The `RunMemoryUpdateEvent` state machine, adopted not reinvented.**
   `RunMemoryUpdateEvent` (`src/schemas/run-envelope.ts:357-390`) already
   encodes the whole "no silent meaningful update" posture: `action` is
   one of `proposed`, `recorded`, `skipped`, `rejected`; `source_refs`
   requires at least one ref; `authority` is the `hint_only` literal; and
   a `superRefine` requires `operator_indicator` on `proposed` and
   `recorded`. We use this verbatim instead of inventing a parallel
   proposals file.
3. **Retrieval keyed by `(project, flow_id)`.** `queryHistory` already
   accepts `options.flow` and filters on `doc.flow_id`
   (`src/history/query.ts:290`), but run-start recall never passes it.
   Scoping recall to the flow about to run is small, real, and
   execution-first by construction.
4. **The one grounded auto-signal: `step.aborted.reason` clustering.**
   This is the genuine surprise primitive, and it exists. Real
   `step.aborted` entries carry a human-readable `reason` such as
   `"sub-run step 'goal-run-build': child result body lacks a non-empty
   string 'verdict' field"` (seen in two runs) or `"Writable relay fanout
   branches are serialized because relay branches share the parent
   checkout..."` (seen in five). Clustered per `(flow_id, reason)`,
   repeated aborts are a real, citable recurring-failure fact.

Two contract corrections are treated as prerequisites, not assertions:
`RunMemoryUpdateEvent` has no `staleness` field and
`memory_update_events` (`src/schemas/run-envelope.ts:490`) has no
`.max(1)` today. Step 1 adds both, so "staleness shown on the produce
side" and "at most one per run" are enforced by Zod rather than narrated.

## 3. The artifact

**Storage.** `.circuit/memory/project.v1.jsonl`, line-delimited
`MemoryInputV0` records with `kind:"project"`, parallel to the existing
`.circuit/history/documents.v1.jsonl`. Gitignored by default (local-only,
matching the history store). Append-mostly; eviction is a rewrite
(Section 6).

**Schema.** No new memory schema. Each record is an existing
`MemoryInputV0` (`src/schemas/memory-input.ts:56-145`) with
`kind:"project"`. The existing `superRefine` enforces
`source.sha256 === source.ref.sha256` when both are present, staleness
reason-code consistency, and unique hint ids. We get all of that for free.

**What an execution fact looks like.** The `applies_to` enum maps almost
one-to-one to the CONTEXT.md memory-use-priority list:

| Fact type | `applies_to` | Grounded source today |
|---|---|---|
| verify command / how to check this repo | `verification` | operator-supplied (Step 1); later, doc facets tagged `verification` |
| flaky / state-dependent check | `prior_failure` | clustered `check.evaluated` `result_verdict:fail` plus operator confirmation |
| risky file / subsystem | `repo_convention` | source paths recurring across `outcome:aborted` docs of one flow |
| recurring failure cause | `prior_failure` | clustered `step.aborted.reason` per `(flow_id, reason)` |

**Example stored record** (a recurring-failure fact distilled from real
`step.aborted` evidence):

```json
{
  "schema_version": 1,
  "memory_id": "project-goal-child-verdict-missing-a1b2c3d4e5f6",
  "kind": "project",
  "source": {
    "ref": {
      "kind": "report",
      "ref": "reports/goal/child-results/build-result.json",
      "sha256": "e547223d3c491e89ae6c53f04d5381f6ea283b55037e6a985885ca3c2d10ac92",
      "run_id": "81b8e94c-deba-4b3a-94c1-d1986f4c07a9",
      "flow_id": "goal"
    },
    "captured_at": "2026-05-28T16:40:00.000Z",
    "sha256": "e547223d3c491e89ae6c53f04d5381f6ea283b55037e6a985885ca3c2d10ac92"
  },
  "summary": "goal flow: child build runs in this repo abort when the result body omits a non-empty 'verdict' string.",
  "hints": [
    {
      "id": "hint-verdict-required",
      "text": "Recurring failure: goal child build steps abort with \"child result body lacks a non-empty string 'verdict' field\". Seen in 2 runs. Ensure the build result carries a verdict before closing. This is prior-run context only; rerun current checks before relying on it.",
      "applies_to": "prior_failure"
    }
  ],
  "staleness": {
    "status": "fresh",
    "checked_at": "2026-05-28T16:40:00.000Z",
    "reason_codes": ["source_hash_verified"]
  },
  "authority": "hint_only"
}
```

A `verification` fact (operator-supplied, Step 1) has the same shape with
`applies_to:"verification"`, a `summary` like `"review flow: this repo
verifies with 'npm run verify'"`, and a `source.ref` pointing at the run
where the operator filed it.

## 4. Population

**Posture: automatic-but-announced for facts Circuit can ground
deterministically; operator-supplied for everything else.** CONTEXT.md
leans toward automatic updates over approval ceremony, so the auto-path
does not gate every write behind a click. But it only auto-records facts
that are deterministically extractable and citable. Anything fuzzier is
proposed, not recorded.

**Path A, operator-filed facts (Step 1, ships first).** During a run, the
operator can file a project fact through the run CLI surface:
`circuit memory note --flow review --applies-to verification "this repo
verifies with npm run verify"`. The fact is written as a `MemoryInputV0`
`kind:"project"` record whose `source.ref` cites the current run (run_id
plus the sha256 of a real report in that run), and an `action:"recorded"`
`RunMemoryUpdateEvent` is appended to that run's envelope with an
`operator_indicator`. This is unimpeachably grounded, the operator is the
source, and it makes the seat live without any mining engine.

**Path B, deterministic auto-distillation (Step 4 and later).** At run
close, after `process-evidence.json` is finalized, a consolidation pass
scans the history index for the just-closed flow and looks for exactly
two grounded patterns:

- **Recurring failure cause.** Group `step.aborted` entries by
  `(flow_id, normalized reason prefix)` across runs in this project. If
  the same normalized reason appears in two or more independent runs,
  emit a candidate `prior_failure` fact citing both runs' source refs and
  the literal reason snippets.
- **Risky subsystem.** Group `outcome:aborted` docs by
  `(flow_id, source_path)`. If a source path recurs across two or more
  aborted runs of the same flow, emit a candidate `repo_convention` fact.

**Trigger and posture for Path B:** fire on signal, not on completion
(the rule from [`self-improving-circuit.md`](./self-improving-circuit.md)).
Routine successful runs emit nothing. At most one candidate per run
(`memory_update_events` capped at 1 by the `.max(1)` added in Step 1, so
this is enforced, not narrated). A deterministic auto-fact (two or more
runs, fresh sources, no contradiction) is recorded with
`action:"recorded"`; a weaker signal is `action:"proposed"` and waits for
the operator. Every event carries at least one `source_ref` and an
`operator_indicator`.

**Recorded where:** every population action, whether recorded, proposed,
skipped, or rejected, is an entry in `run-envelope.json.memory_update_events`.
That array is `[]` today; this design is what fills it.

## 5. Surfacing

**Injection point.** At run start, for the selected flow, after the
existing prior-run recall block in `src/shared/relay-support.ts` (the
"Prior Circuit History (hint-only)" block). The relay prompt gets a
second block, "Project Notes (hint-only)", carrying the matching
`kind:"project"` records.

**Retrieval keying, the execution-first move.** Today recall passes only
the goal text as a free-text query with no flow filter, which is why a
review run surfaced two unrelated Friston essays. Project Notes retrieval
instead keys on:

1. **`project` scope.** Read `.circuit/memory/project.v1.jsonl` for this
   repo only.
2. **`flow_id`.** Only facts whose source ran the same flow now being
   selected (reusing the `options.flow` path that `queryHistory` already
   supports at `src/history/query.ts:290`). A review run sees review
   facts; a goal run sees goal facts.
3. **`applies_to` relevance.** For review, lead with `verification` and
   `prior_failure`; for build-style flows, lead with `repo_convention`
   and `prior_failure`.

Cap at the existing `DEFAULT_RECALL_LIMIT` (3) project facts, sorted
fresh-first then `captured_at` descending. The injected `memory_id`s are
written into `memory_context.memory_input_ids` alongside any prior-run
hits, so the consume side round-trips exactly as it does today.

**The one-line human indicator.** Populate the real
`surface_output.memory_indicator` field. Two cases:

- On use: `"Project notes (hint-only): 2 facts loaded for review (verify
  command, recurring failure). Source runs cited; rerun current checks
  before relying on them."`
- On write: `"Project notes: recorded 1 fact for goal (recurring 'verdict
  missing' abort, seen in 2 runs)."`

This is the "briefly say what changed and why" surface CONTEXT.md asks
for, without turning memory into a report the operator must inspect.

## 6. Provenance, staleness, eviction

**Provenance.** Every project fact's `source.ref` is a real run report
ref (`kind`, `ref`, `run_id`, `flow_id`, `sha256`) and `source.sha256`
matches `source.ref.sha256`; the `MemoryInputV0` `superRefine` rejects
the record otherwise. Auto-distilled facts cite all contributing runs in
the hint text by run_id, so "project-memory promotion is explainable" is
satisfied by construction.

**Staleness, re-verified at injection.** Reuse `sourceStaleness()`
(`src/history/query.ts:204-240`) exactly: at run start, for each project
fact, re-resolve its `source.ref` against `run_folder + source_path` and
re-hash.

- File present and hash matches: `fresh`, `reason_codes:["source_hash_verified"]`.
- File deleted or hash changed: `stale`, `reason_codes:["memory_stale"]`.
- Unreadable or no recorded hash: `unknown`, `reason_codes:["memory_unverified"]`.

Stale facts are still injected but marked `[stale]` in the block and
de-prioritized. Staleness is shown, never hidden. The hint text always
carries the standard caution ("rerun current checks before relying on
it"), so current checks outrank prior memory at the prompt level.

**Staleness on the produce side (prerequisite).** `RunMemoryUpdateEvent`
has no `staleness` field today. Step 1 adds an optional `staleness`
object so a `proposed` or `recorded` event surfaces freshness at write
time. Without this, the "staleness shown" boundary would be asserted but
unenforceable on writes.

**Contradiction handling.** If a new auto-fact's `(flow_id, reason)`
cluster is contradicted by a more recent run where that flow closed
`complete` on the same condition, the candidate is `action:"skipped"`
with a `contradicted_by_recent_evidence` reason and not recorded. If two
stored facts conflict, both are shown with the conflict flagged, never
silently suppressed.

**Eviction and decay.** A fact whose source flips `stale` and is not
re-confirmed by a fresh run within a decay window (start at six weeks) is
dropped on the next consolidation rewrite. Manual eviction is
`circuit memory forget <memory_id>`. No auto-promotion to higher
authority ever; eviction only removes, never elevates.

## 7. The ratchet

The compounding loop, framed as a skilled practitioner getting better,
not as hidden mutation:

- **Run N (review).** Operator runs review on the v1 migration. While
  reviewing, they note "this repo verifies with `npm run verify`" via
  `circuit memory note`. A `kind:"project"` `verification` fact is
  recorded, citing run N; `memory_update_events` gets one `recorded`
  event; the surface line says so.
- **Run N+1 (review, weeks later).** At run start, Project Notes
  retrieval keys on `(this repo, review)` and finds the verify fact,
  fresh (hash still matches). It is injected into the relay prompt above
  the goal-lexical hits. The agent sees "verify with `npm run verify`"
  instead of guessing or re-discovering it. The indicator says "1 fact
  loaded, verify command."
- **Run N+2 and N+3 (goal).** Two goal runs abort with the same
  `step.aborted.reason` ("child result body lacks a non-empty string
  'verdict' field"). On the second abort, consolidation sees the
  `(goal, verdict-missing)` cluster hit two independent runs with fresh
  sources, records a `prior_failure` fact, and announces it.
- **Run N+4 (goal).** The recurring-failure fact is injected for the goal
  flow. The agent is warned about the verdict requirement before it trips
  over it, like a teammate who left a note: "this is how builds abort
  here, set the verdict."

The ratchet is witnessed pattern, cited distillation, flow-scoped
injection, better next run. Each step is explainable, every fact names
its source runs, staleness is re-checked at use, and current checks
always outrank the hint. Nothing about flow selection changes. The same
flow runs, it just runs better in this repo.

## 8. Build sequence

Smallest-shippable-first. Step 1 delivers value alone and adds no mining
engine.

1. **Step 1: wire the loop end to end with operator-filed facts.**
   - Add the two contract prerequisites: `.max(1)` on
     `memory_update_events` (`src/schemas/run-envelope.ts:490`) and an
     optional `staleness` field on `RunMemoryUpdateEvent`.
   - Add `circuit memory note --flow <id> --applies-to <enum> "<text>"`:
     writes one `MemoryInputV0` `kind:"project"` record to
     `.circuit/memory/project.v1.jsonl` citing the current run, and
     appends one `action:"recorded"` `RunMemoryUpdateEvent` with an
     `operator_indicator`.
   - Populate `surface_output.memory_indicator` on write.
   - Value alone: the operator can teach the repo one durable fact and
     see it recorded with provenance, before any retrieval exists. The
     `kind:"project"` seat is live; the empty envelope slots are filled.

2. **Step 2: consume at run start, flow-scoped.** In
   `relay-support.ts`, after the prior-run block, read
   `project.v1.jsonl`, filter by `(project, flow_id)` and `applies_to`,
   re-verify staleness via `sourceStaleness()`, inject up to three facts,
   write ids into `memory_context.memory_input_ids`, set the "facts
   loaded" `memory_indicator`. Now a fact filed in Step 1 actually
   changes the next run.

3. **Step 3: `circuit memory list` and `forget`.** Read-only inspection
   plus manual eviction. No mining yet.

4. **Step 4: deterministic auto-distillation, recurring-failure facts.**
   Add the consolidation pass for `step.aborted.reason` clustering per
   `(flow_id, reason)`, two or more independent runs, fresh sources, no
   contradiction. Record or propose via `RunMemoryUpdateEvent`. This is
   the first auto-path and it rests only on fields that exist.

5. **Step 5: risky-subsystem facts.** Extend consolidation to
   `(flow_id, source_path)` recurrence across `outcome:aborted` docs.

6. **Step 6: integration test and doc.** End-to-end fixture: file a fact,
   run the same flow, assert injection plus indicator; trigger an abort
   cluster, assert a recorded event with citations; delete a source,
   assert `stale`. Promote this doc out of `docs/ideas/`.

Verification-command and flaky-test facts beyond operator-filing stay
deferred until Circuit emits a structured per-check primitive (a
`check.evaluated` that names what failed). The design does not pretend
that primitive exists.

## 9. Evaluation

Measure helped-versus-misled from artifacts alone, never from model
self-report:

1. **Injection round-trips.** Every fact shown in a run appears in that
   run's `memory_context.memory_input_ids`; every `memory_update_event`
   carries at least one `source_ref`. Pure artifact assertions over
   `.circuit/runs/*`.
2. **Provenance integrity.** For every stored fact,
   `source.sha256 === source.ref.sha256` and the cited run folder exists.
   Run as a fixture check over `project.v1.jsonl`.
3. **Staleness precision.** Inject a fact, mutate its source, re-run the
   flow, assert the injected fact reports `stale` and is de-prioritized.
   Deterministic, no agent needed.
4. **Recurrence honesty.** Replay the real abort pair (both runs carry
   the verdict-missing reason): assert consolidation produces exactly one
   `goal` recurring-failure fact citing both runs, and that a single
   isolated abort produces none.
5. **Misled guard.** Assert no `recorded` fact survives when a more
   recent same-flow run closed `complete` on the same condition
   (contradiction leads to `skipped`).
6. **Boundary assertions.** `process_plan.selection_source` never
   references memory; `memory_context.authority` is always `hint_only`;
   `.circuit/memory/` is only mutated by the note and consolidation path,
   never by relay or agent output.

Operator-facing signal (qualitative, observable): acceptance rate of
`proposed` facts and `forget` frequency. Frequent forgetting means
consolidation is too noisy, so raise the minimum-run threshold.

## 10. Boundaries kept and explicit non-goals

**Kept:**

- **`hint_only`, always.** Enforced by the `MemoryInputV0` and
  `RunMemoryUpdateEvent` `authority` literals. Project facts never
  authorize route, checkpoint, recovery, proof, policy, or write.
- **Every item cited.** `source.ref` plus `sha256` mandatory;
  `superRefine` rejects mismatches; auto-facts name all contributing
  runs.
- **Staleness shown, not hidden.** Re-verified at injection via
  `sourceStaleness()`; stale facts shown and de-prioritized, not dropped
  silently; produce-side `staleness` added in Step 1.
- **Current checks outrank prior memory.** Standard caution text on every
  hint; memory never alters `process_plan` or skips a gate.
- **No silent background recall.** Recall runs only at the explicit
  run-start injection point; every use shows in `memory_indicator` and
  `memory_context`.
- **Explainable promotion.** Auto-facts require two or more independent
  cited runs; weak signals are `proposed`, not `recorded`.

**Explicit non-goals (this cut):**

- **No routing changes.** Execution-first only; the selected flow runs
  better, flow selection is untouched.
- **No self-evolving flows.** No schematic mutation, no auto-generated
  flow files.
- **No operator-level memory.** Scope is `(project, flow)`; cross-project
  and operator-global memory deferred.
- **No mined command or timing facts.** Deferred until Circuit emits a
  structured per-check primitive. The first cut consumes operator-filed
  facts and abort-reason clusters, both grounded today.
- **No cross-repo or remote sync.** Local-only under `.circuit/memory/`.

## 11. Open questions

1. **Project identity.** What keys "this project" stably across worktrees
   and clones? Repo root path is fragile (the working dirs include
   multiple worktrees). A git-remote-derived id, the existing run-folder
   root, or an explicit `.circuit` config value all work; this needs a
   decision before Step 2, since retrieval depends on it.
2. **How aggressive is auto-record versus propose?** CONTEXT.md leans
   automatic-over-approval, but the safe default for a first cut may be
   propose-only for all auto-facts (operator confirms once), with
   auto-record earned after the acceptance rate proves the signal. Which
   side do we start on?
3. **Reason normalization for `step.aborted` clustering.** Real reasons
   embed run-specific detail (session ids, stdout fragments). What is the
   right normalization (prefix before the first colon, a reason taxonomy)
   so genuinely-same failures cluster without over-merging distinct ones?
4. **Fact lifecycle when the repo fixes the problem.** A recurring-failure
   fact should retire once the failure stops recurring. Is silence-for-N-runs
   enough to evict, or do we need a positive "this flow now closes
   complete on that condition" confirmation to retire it cleanly?
5. **Indicator budget.** With both prior-run recall and Project Notes
   injecting, how many total hint-only items can the relay prompt carry
   before it bloats? Today's hard cap is 3 for recall; do project facts
   share that budget or get their own small cap?

## Sources

Circuit code and evidence (all verified at capture time):

- [`src/schemas/memory-input.ts`](../../src/schemas/memory-input.ts)
  (`MemoryInputKind`, `MemoryInputV0`, `superRefine`)
- [`src/schemas/run-envelope.ts`](../../src/schemas/run-envelope.ts)
  (`RunMemoryUpdateEvent` at 357-390, `memory_indicator` at 399,
  `memory_context` at 478, `memory_update_events` at 490)
- [`src/history/memory-preview.ts`](../../src/history/memory-preview.ts)
  (the only current producer)
- [`src/history/query.ts`](../../src/history/query.ts)
  (`sourceStaleness` at 204-240, `options.flow` filter at 290)
- [`src/shared/relay-support.ts`](../../src/shared/relay-support.ts)
  (injection point)
- `.circuit/runs/8ef6eb57.../reports/history/recall.json` (episodic
  recall behavior), `reports/run-envelope.json` (empty
  `memory_update_events`, `memory_context`), `reports/process-evidence.json`
  (`declared_report_paths`, `missing_evidence`)
- `.circuit/history/documents.v1.jsonl` (facets, `outcome`, `memory_safe`)
- `.circuit/runs/*/trace.ndjson` (`step.aborted.reason`,
  `check.evaluated` shape)

Related idea seeds:

- [`longitudinal-evidence-memory.md`](./longitudinal-evidence-memory.md)
  (precision, surprise ledger event types, "do not change `MemoryInputV0`
  first")
- [`self-improving-circuit.md`](./self-improving-circuit.md)
  (fire-on-signal, propose-not-apply, unify-with-auto-memory)
- [`dynamic-flow-ratchet.md`](./dynamic-flow-ratchet.md) (the three-stage
  ratchet; this cut is a grounded Stage 2 for execution facts)
