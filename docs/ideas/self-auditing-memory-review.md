# Self-Auditing Memory: Soundness and Durability Review

Status: archived in place. This dated review caused corrections in
`self-auditing-memory.md`, but several blocked findings are now implemented.
Prefer the parent memory docs, the slice specs, and current code for active
guidance.

Reviewed: 2026-05-29. Subject: [`docs/ideas/self-auditing-memory.md`](./self-auditing-memory.md). Repo state at review: branch `architecture-hardening` checked out, REP-R2 landed as commit `a9649e94`, REP-R1 and SD-FIX-1/2/3 not yet landed, working tree clean of code (only this review and its subject untracked).

## 1. Top-line verdict

**build-ready-with-changes.**

The thesis is architecturally sound and the doc honors CONTEXT.md posture without overclaiming in its messaging. But four load-bearing build claims are wrong or overstated against the live repo: the cross-run hint identity the "unique unlock" depends on does not exist (hint ids are run-scoped), three of the five named outcome signals are unpopulated or degenerate (`tokens-to-close` does not exist, `time-to-close` is zero-elapsed, `clean_streak` is a hardcoded 0/2), the keystone is net-new plumbing rather than a join over indexed data, and the keystone reads through surfaces the in-flight `architecture-hardening` program is still restructuring. None of these sink the design. They mean Slice 1 must be re-scoped to the signals that actually exist, and the doc must stop reading as if the linkage substrate already ships. Fix the P0 items below and the doc is build-ready as a report-only first slice.

## 2. Claim integrity

Every named schema symbol exists with the shape the doc claims. The defects are interpretive (signals cited as richer or more available than they are) and one identity claim that is wrong for the cross-run case.

| Doc claim | Status | Citation |
|---|---|---|
| `MemoryInputV0` carries source ref + sha256 + staleness + `authority:"hint_only"`, enforced by a Zod `superRefine` | confirmed | `src/schemas/memory-input.ts:56-145` (authority literal :65; superRefine :68-144) |
| `RunMemoryUpdateEvent` is a state machine (`proposed`/`recorded`/`skipped`/`rejected`) requiring `source_refs` and an operator indicator | confirmed (schema), inert in practice | `src/schemas/run-envelope.ts:357-390`; no caller passes `memoryUpdates`, so `memoryUpdateEvents` always returns `[]` (`src/run-envelope/source-record.ts:496-517`; observed empty `.circuit/runs/8ef6eb57.../reports/run-envelope.json:191`) |
| `memory_context.memory_input_ids` records which hints a run used | confirmed (write side, non-resume path) | `src/schemas/run-envelope.ts:478-484`; populated `src/run-envelope/source-record.ts:650-652` from `runEnvelopeMemoryContext` (`src/cli/circuit.ts:715-725,1079,1182`). Resume/shadow paths write a shadow record and omit it (`circuit.ts:818,1033,1150`) |
| `memory_indicator` exists on the surface output | confirmed | `src/schemas/run-envelope.ts:399`; writer at `src/run-envelope/source-record.ts:637-639` |
| `completion_gate` carries clean-streak, attack-lens verdicts, required passes | confirmed (fields exist) | `src/schemas/run-envelope.ts:238-304` (`clean_streak` :253, `gate_passes`/`attack_lens` :228-236, `required_passes` :254) |
| `verification.command_evaluated` events with durations exist; newly added | confirmed | `src/schemas/trace-entry.ts:87-99`; emitted `src/runtime/executors/verification.ts:273-291`; added same day as the doc |
| `step.aborted` carries a human-readable `reason` (and attempt) | confirmed | `src/schemas/trace-entry.ts:382-388` |
| `src/history/query.ts` has `sourceStaleness` and `options.flow` | confirmed | `src/history/query.ts:204` (`sourceStaleness`), `:56` (`flow?`), `:290` (filter) |
| `src/history/memory-preview.ts` is the sole `MemoryInputV0` producer, emits `kind:"prior_run"` | confirmed | `src/history/memory-preview.ts:68,71` |
| `kind:"project"` cited-fact producer is future work (slice 5) | confirmed | enum has `project` (`src/schemas/memory-input.ts:8-15`); no producer emits it; only `prior_run` is produced |
| Keystone links injected hint ids to objective outcome over data the system **already produces and indexes** | **blocked (overstated)** | `HistoryDocumentV1` (`src/schemas/history.ts:53-89`) has no `memory_input_ids`/`clean_streak`/`completion_gate` fields; `src/history/extract.ts` indexes the envelope only as freeform text; zero readers of these fields for cross-run aggregation |
| Injected hint ids form a stable per-hint identity usable for cross-run comparison | **blocked (wrong)** | `memoryId = prior-run-${runPrefix}-${hash}` where both `runPrefix` (run_id) and `hash` (`sha256(doc_id)`, and `doc_id` leads with run_id) are run-scoped (`src/history/memory-preview.ts:46-48,77`; `src/history/extract.ts:400-406`). The same source fact in two runs yields two different ids |
| `tokens-to-close` is an outcome signal Circuit already emits | **blocked (does not exist)** | No token-usage field anywhere in `src/`; `verification.command_evaluated` carries `duration_ms`, not tokens (`src/schemas/trace-entry.ts:88-96`) |
| `time-to-close` is retrievable from the envelope | **blocked (degenerate)** | `started_at` and `completed_at` both = the single `recordedAt` snapshot (`src/run-envelope/source-record.ts:706-707`; `recordedAt` is one `new Date()` per writer call) |
| `clean_streak` is a graduated outcome signal | **uncertain (coarse)** | Hardcoded `2` when outcome `complete`, else `0` (`src/run-envelope/source-record.ts:289,318,337,356,378`). The granular reset-on-finding streak lives in `goal.gate@v1` (`src/flows/goal/reports.ts:371-409`), a different schema |
| Command/tool output is "the one new leakage surface" that must be closed | uncertain (overstated) | Schema stores `stdout_summary`/`stderr_summary`, not raw output (`src/schemas/trace-entry.ts:97-98`); history already strips raw `stdout`/`stderr` as NOISY_FIELDS (`src/history/extract.ts:31-44`); `memory_safe` gates hints (`src/history/memory-preview.ts:44-45`) |
| Doc honors CONTEXT.md no-overclaim posture; no em dashes | confirmed | doc §11 restates the ratchet rule verbatim (line 85) with per-bullet Avoid caveats; 0 em dashes |

**The wrong claim to call out loudly:** doc §3 says the research-named efficiency metrics "tokens and turns to resolution... Circuit already emits them, as a byproduct." That is false for tokens (no field exists) and currently empty for verification durations (zero `command_evaluated` events in the entire 22-run corpus; 64 `check.evaluated` events but zero with `criterion_kind:"command"`). This is exactly the project's recurring "assert a capability that does not exist" failure mode.

## 3. Does the thesis hold?

**The architectural premise is real and distinctive.** Flows are a closed typed alphabet (`TraceEntry` is a discriminated union over a finite kind set, `src/schemas/trace-entry.ts:525-553`), runs carry a deterministic comparable envelope, and recall is automatic with no operator command (`shouldPrepareHistoryRecall` defaults on, `src/cli/circuit.ts:727-735`). "Comparable typed runs let you measure memory effect" is genuinely something transcript-based competitors cannot do. The bet is defensible long term.

**But the effect is not measurable at current scale, and the keystone's double-duty is cleaner in prose than in data.** Three confirmed corpus realities:

1. **Comparability at per-hint attribution granularity does not exist.** The 22-run corpus splits across 5 flow_ids (10 explore, 8 prototype, 2 review, 1 goal, 1 build). The only flow with both a memory-on and a memory-off run is `review`: one run each (`8ef6eb57` mem-on, the sole run carrying `memory_context`, vs `317b918f` mem-off). That is n=1 per arm. Any outcome delta is fully confounded by goal, model, and operator. Cross-flow comparison is structurally impossible. The history manifest reports 22 runs / 202 documents (`.circuit/history/manifest.v1.json:8-10`).

2. **Recurrence, which the measurement engine needs, is confirmed absent.** The 4 `step.aborted` entries in the corpus have 4 distinct root causes. The companion `project-execution-memory.md:16-22` states the worked failure does not recur and appears in one run. A hint that never gets a second comparable run can never earn or lose its place. The research's ~10-20 session cold-start (`docs/learnings/codebase-memory-research.md:149-153`) means 22 runs is plausibly pre-ratchet.

3. **The validation half of the keystone is empty.** Only 1 of 22 runs carries `memory_context` at all, only 1 `run-envelope.json` exists, and its `memory_input_ids` are all `prior_run` lexical hits with `memory_update_events:[]`. As product substrate the linkage is well-defined; as a validation experiment it can only describe n=1 today.

**Confound and cold-start risk:** real and acknowledged. Doc §10 is empirically accurate and pre-empts the small-corpus objection honestly. The honest near-term output of Slices 1-2 is "insufficient comparable runs / no detectable effect," which §10 admits but §3 and §6 assert past. The durable near-term value is the safety posture (hint-only, cited, self-staling), not the measurement ratchet, which is the speculative bet that may report "no effect" indefinitely on a single small repo.

**Does the keystone double-duty hold?** As one artifact serving both goals, yes, but **in sequence, not simultaneously**: substrate now, validation only after a deliberate run-accumulation period and after the cited-fact producer (slice 5) exists to generate non-`prior_run` memory worth measuring. The phrase "judge helped-versus-misled... from outcomes alone" (§4 step 4) is too strong for the current corpus; the safer posture is explicit cited report verdicts (with `unknown` / `insufficient evidence` allowed) until enough comparable data exists.

## 4. Buildability of the keystone

**Slice 1 is buildable but materially larger than "just the linkage."** It is net-new plumbing, not a read over indexed data. Concrete prerequisites, with citations:

- **A new `history.memory-merge@v1` report schema, writer, path constant, and contract tests.** None exist; grep for `memory-merge`/`memory_merge` across `src/`/tests returns zero (only the three idea docs). A candidate home `reports/history/memory-merge.json` is proposed only in `docs/ideas/ratchet-data-requirements.md:601-620`. Mirror the existing report schemas at `src/schemas/history.ts`.
- **A new envelope-aware extractor or aggregator.** `HistoryDocumentV1` (`src/schemas/history.ts:53-89`) does not lift `memory_input_ids`/`clean_streak`/`completion_gate` into queryable fields; `src/history/extract.ts` flattens the envelope to freeform text only. The structured outcome must be extracted before any join.
- **A stable, run-independent fact identity** before Slice 2 can group "runs that used hint H." Today `memoryId` is run-scoped (`src/history/memory-preview.ts:46-48,77`; `src/history/extract.ts:400-406`). This is a prerequisite for the doc's named "unique unlock," not a follow-up. Relatedly, `RunMemoryUpdateEvent` has no memory-record-ref or memory-input-id field linking an update back to the hint it concerns (`src/schemas/run-envelope.ts:357-390`).
- **Exact source-ref plumbing.** The schema allows `source_refs: Ref[].min(1)`, but the writer always emits exactly `[processEvidence.ref]` (`src/run-envelope/source-record.ts:511`); a merge entry wanting both the hint source and the outcome artifact needs this relaxed. There is also no `max` bound on `memory_update_events` or `source_refs` (`src/schemas/run-envelope.ts:366,490`), which a high-precision design should set.
- **A per-run elapsed-time field**, if time-to-close is wanted. The envelope's timestamps are degenerate (`src/run-envelope/source-record.ts:706-707`); real durations exist only as per-step `duration_ms` on relay/sub_run/verification trace entries and must be summed from `trace.ndjson`.
- **A read-side for `memory_input_ids`.** Nothing in `src/` reads it back today; only the writer (`source-record.ts:650-652`) and three test assertions exist.

**Is Slice 1 genuinely small?** Smaller than the rest, yes; "report-only, changes nothing" is honest. But "just the linkage that comparable runs make possible" understates a new report surface, a new extractor, and (for the signals the doc names) a stable-identity and timing-capture prerequisite. Of the five outcome signals the doc names, only **abort presence/reason** and the **binary gate/envelope outcome** (`RunEnvelopeOutcome`, `src/schemas/run-envelope.ts:8-15`) are honestly retrievable per run today.

## 5. Long-term fit

**The design composes additively and does not paint Circuit into a corner.** A new report kind fits the emit pipeline cleanly (GEN-P1 makes adding an artifact a one-descriptor change, `docs/ideas/architecture-hardening-plan-v2.md:168-178`). Earned-precision injection layers on the existing write path; gated pull builds on `query.ts` (`options.flow` :290) emitting hint-only `MemoryInputV0`. The hint-only / no-invocation / report-only-first / no-routing posture matches CONTEXT.md. None of this locks in debt.

**The real conflict is timing against the in-flight architecture-hardening program.** Branch `architecture-hardening` (the branch this review is authored on) is 9 commits ahead of `main`; its authoritative plan is `docs/ideas/architecture-hardening-plan-v2.md`. Status of the surfaces the keystone reads through:

- **REP-R2 has landed** (commit `a9649e94`): trace-field reads are now centralized behind `src/runtime/trace/trace-fields.ts`, and `RunClosedOutcome` is single-sourced from `src/schemas/trace-entry.ts` across `domain/run.ts`, `progress.ts`, `status.ts`, `runtime-run-folder.ts`, `fanout-join-policy.ts`. The working tree is clean of code changes, so the "mid-edit" risk an earlier pass flagged has resolved for REP-R2.
- **REP-R1 and SD-FIX-1/2/3 have NOT landed** (no commits matching them). SD-FIX-2's hashing target is still live and unmigrated at `src/run-envelope/source-record.ts:75-100,489` (`sha256File`/`sha256Text`), and SD-FIX-1 still has the two source-file enumerators (`extract.ts`, `indexer.ts`) the staleness path depends on. These overlapping surfaces are still moving.
- MACRO-2 (relocating run-envelope/history/process-evidence under `src/app`) is defaulted to defer/drop (`plan-v2:73-82,348`), so the relocation risk is low and decision-gated; the near-term churn is on the hashing (SD-FIX-2) and trace/projection (REP-R1) paths.

**Correction to one over-stated overlap:** the report's stable join key is **not** under refactor. A memory-merge report joins on the run's objective outcome, which is `RunEnvelopeOutcome` in the on-disk `run.envelope@v0` record (`src/schemas/run-envelope.ts:8-15,492`). The hardening plan does not touch that enum; REP-R2 only single-sourced the separate `RunClosedOutcome`. So the churn risk is on the trace/projection **read path** and the history/envelope **hashing** path, not on the outcome enum the report joins.

**Sequencing recommendation:** scope Slice 1 to read only the stable on-disk `run.envelope@v0` record (its `outcome` and `memory_context.memory_input_ids` are not being moved) and avoid importing the runtime trace consumers, the private `sourceStaleness` helper, or history hashing internals while SD-FIX-1/2 and REP-R1 are in flight. Or land Slice 1 after those phases complete. Target stable contracts (schemas, report paths, refs, run/flow ids, trace kinds, history documents), not current file locations.

## 6. Posture and overclaim check

**Honors CONTEXT.md, with one minor documentation gap.** Doc §11 restates the effectiveness-ratchet rule verbatim ("do not claim Circuit already gets better over time," line 85) and attaches an explicit Avoid caveat to all five differentiators ("Avoid: claiming it already proves this today"; "Avoid: autonomous/self-optimizing/self-mutating"). This directly matches CONTEXT.md's ratchet Avoid list (`CONTEXT.md:108-110`) and memory posture (hint-only, agent-facing, `:112-114`). The thesis verbs are capability/design intent, not achieved outcome. Zero em dashes. No AI-isms in the reviewed prose. No overclaim defect in the messaging.

**The minor gap:** §8 "What it refuses to do" omits the announced-update / `memory_indicator` obligation that CONTEXT.md treats as a hard rule (avoid "silent meaningful memory updates," `:113-114`; surface a one-line indicator, `:124-126`). It is enforced in the schema (`RunMemoryUpdateEvent` superRefine requires an operator indicator, `src/schemas/run-envelope.ts:371-381`) and gestured at in messaging bullet 91, but not restated in the refusal list. Low risk because the keystone slice writes no memory.

**The overclaim that matters is not in the messaging, it is in the build claims:** §3 ("Circuit already emits them, as a byproduct") and §4/§6 (the five outcome signals as if all present and linkable) read as if the measurement substrate already ships. That is the posture risk to fix, because it would let a future builder skip the extraction, identity, and timing work the keystone actually needs.

## 7. Must-fix before building

**P0 (correctness, blocks the named design as written):**

1. **Add a stable, run-independent fact identity.** Evidence: `memoryId` is run-scoped (`src/history/memory-preview.ts:46-48,77`; `extract.ts:400-406`), so "runs that used hint H vs runs that did not" has no grouping key. Fix: introduce a content-addressed identity (e.g. hash of `source_path#selector` + normalized hint text, run-independent) carried on both the recall preview and `memory_input_ids`, before or as part of Slice 1.

2. **Re-scope the named outcome signals to what exists.** Evidence: no token field anywhere in `src/`; `started_at`/`completed_at` both = `recordedAt` (`source-record.ts:706-707`); `clean_streak` hardcoded 0/2 (`source-record.ts:289-378`). Fix: drop `tokens-to-close`; mark `time-to-close` as requiring a new summed-from-trace elapsed field; scope Slice 1 to abort reason and the binary `RunEnvelopeOutcome`, the only honestly-retrievable per-run signals.

3. **Correct the "already produces and indexes" framing.** Evidence: `HistoryDocumentV1` (`src/schemas/history.ts:53-89`) does not lift the structured envelope outcome; no cross-run reader exists. Fix: state that Slice 1 adds a new `history.memory-merge@v1` report kind + an envelope-aware extractor/reader + cross-run grouping, and budget that as the first task.

**P1 (de-risks the build and the thesis):**

4. **Sequence against architecture-hardening.** Evidence: SD-FIX-1/2 (`source-record.ts:75-100`, `extract.ts`/`indexer.ts`) and REP-R1 are unlanded. Fix: scope Slice 1 to the stable on-disk `run.envelope@v0` record only, or land after those phases; do not import private `sourceStaleness`.

5. **Promote Open Questions 2 and 3 to Slice 1 acceptance criteria.** Evidence: corpus is n=1-per-arm with absent recurrence (§3). Fix: define the minimum-sample threshold and lead metric (and the comparable-run grouping key beyond `flow_id`) before Slice 1 ships, so the report states its own statistical floor rather than emitting "insufficient data" silently.

6. **Reconcile §6 double-duty with §10.** Fix: state the artifact serves substrate-now and validation-later in sequence, and that the validation half is meaningful only after slice 5 cited facts exist and a comparable corpus accumulates. Soften "from outcomes alone" to cited outcomes plus explicit report verdicts.

**P2 (accuracy and completeness):**

7. **Soften the leakage claim (§8).** Evidence: schema stores summaries, not raw output (`trace-entry.ts:97-98`); history already redacts raw `stdout`/`stderr` (`extract.ts:31-44`). Fix: reframe as "summaries can still leak; raw output is already redacted at capture; verify summary redaction on any path that feeds memory."

8. **Describe `memory_update_events` as defined-but-not-yet-emitted, and add source-ref plumbing + bounds.** Evidence: always `[]` (`source-record.ts:496-517`); writer hardcodes one ref (`:511`); arrays unbounded (`run-envelope.ts:366,490`). Fix: stop citing the state machine as a shipping mechanism; add exact per-evidence refs and an at-most-N bound when the merge report is authored.

9. **Add the announced-update refusal bullet to §8.** Evidence: CONTEXT.md hard rule (`:113-114,124-126`) not restated. Fix: one bullet on one-line `memory_indicator`, never a silent meaningful update.

## 8. Proposed doc edits

Edits only, do not rewrite the doc:

1. **§3, bullet 2:** replace "Circuit already emits them, as a byproduct" with language that the event type exists and will emit once verification-running flows are exercised; drop the implication that tokens are emitted (no token field exists).
2. **§3, bullet 1 / §6:** add that the envelope persists `memory_input_ids` and gate signals per run, but a new envelope-aware extractor must lift the structured outcome into the query index before the merge report can join them.
3. **§3, bullet 2 / §12.3:** distinguish the coarse envelope `clean_streak` (effectively complete vs not, `source-record.ts:289-378`) from the granular `goal.gate@v1` streak; pick lead metrics from signals that are actually graduated and persisted per run.
4. **§4 step 3 / §6 / Slice 2:** state plainly that injected hint ids are run-scoped today and a stable run-independent identity is a prerequisite for the cross-run comparison; do not claim Slice 1 "seeds" cross-run comparison until that identity exists.
5. **§4 step 3 / §6:** drop `tokens-to-close` from the named signal set; mark `time-to-close` as requiring a new per-run elapsed field summed from trace `duration_ms` (envelope timestamps are degenerate).
6. **§4 step 4 / §6:** change "from outcomes alone" to "from cited outcomes plus explicit report verdicts (with `unknown`/`insufficient evidence` allowed) until enough comparable data exists."
7. **§6 / §7:** add a precondition that the full `run-envelope.json` is produced only for source-owned active runs (non-source runs write a shadow record, `circuit.ts:818,1033,1150`); verify envelope coverage across the corpus before relying on `memory_input_ids` as a broad linkage signal.
8. **§7:** state explicitly that Slice 1 is net-new (new `history.memory-merge@v1` schema + writer + path constant + contract tests + envelope reader + grouping), that no read-side exists today, and add exact source-ref plumbing and at-most-N bounds as prerequisites.
9. **§7 / new sequencing note:** sequence Slice 1 behind or scoped-around the in-flight architecture-hardening phases (SD-FIX-1/2, REP-R1); read only the stable on-disk `run.envelope@v0` record; treat `sourceStaleness` as behavior to preserve, not a stable import target.
10. **§8:** soften the leakage bullet (summaries not raw; raw already redacted; verify summary redaction); add an announced-update / `memory_indicator` refusal bullet; describe `RunMemoryUpdateEvent` as a defined contract not yet emitted in practice.
11. **§5 / §8:** note that run-start recall does not currently pass `options.flow` to `queryHistory` (`src/history/run-start-recall.ts:48-60`), even though the CLI history query can.
12. **§10:** add that the measurement ratchet structurally requires recurrence the corpus does not show, that the loop may report "no effect" indefinitely on a single small repo, and that the safety posture is the stated near-term value while measurement is the speculative bet.

## 9. Open questions

- **Will recurrence ever materialize on a single small repo?** The corpus shows none (4 aborts, 4 causes; worked failure appears once). Cannot be resolved from code; it is an empirical bet on whether the cross-project or longer-horizon case is where the loop pays off.
- **What is the canonical comparable-run key** beyond `flow_id`: route, goal class, worktree, operator task tag, or a new report field (Open Q1)? Undetermined; not built.
- **What sample size is enough** before an effect estimate may influence injection or before scoring helped-versus-misled (Open Q2)? Depends on the chosen lead metric (Open Q3), neither resolved.
- **Does any flow emit `verification.command_evaluated` in practice,** or does the corpus simply lack runs of those flows? The schema and emit site exist (`verification.ts:273-291`) but zero events were captured. Cannot tell from artifacts alone whether this is a coverage gap or a flow-coverage issue. The event is also not currently indexed by `shouldIndexTrace` (`src/history/extract.ts:655-679`).
- **Where the memory-merge report lives and whether judgments stay report-only until an independent eval confirms they track outcomes** (the doc's own Open Q5), especially after architecture-hardening settles app-service placement. No report home exists in code.
