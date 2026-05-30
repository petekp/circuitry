# Self-Auditing Memory Review

Status: Codex assessment
Date: 2026-05-29
Scope: analysis and report only. No production or runtime code changed.

## Top-line answer

Verdict: **build-ready-with-changes**.

The design thesis is sound enough to build from if the first build is scoped to
the report-only memory-merge substrate. It fits Circuit's long-term direction:
typed runs, cited evidence, hint-only memory, and outcome-based evaluation.

It is not build-ready as written. The doc overstates three things:

1. Current run data can support a useful product substrate, but it cannot yet
   validate memory effectiveness. The observed corpus has 22 runs and 202
   history documents, but only one run envelope with memory use
   (`.circuit/history/manifest.v1.json:8-10`,
   `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:7-15`).
2. `memory_context.memory_input_ids` records memory input ids, not hint ids, and
   those ids are run-scoped prior-run ids today
   (`src/schemas/run-envelope.ts:478-484`,
   `src/history/memory-preview.ts:46-48`,
   `src/history/memory-preview.ts:74-79`).
3. The memory-merge artifact has no code home, schema, writer, or contract test
   today. It is proposed in idea docs, not implemented
   (`docs/ideas/longitudinal-evidence-memory.md:329-360`,
   `docs/ideas/ratchet-data-requirements.md:601-620`).

Build the keystone only after the must-fix list below is applied to the design.
Do not build earned-precision injection or pruning until Slice 1 and Slice 2
have real comparable data.

## Method

Labels:

- **confirmed**: live code or a local artifact directly proves the claim.
- **supported**: live code supports the claim, but with a stated limit.
- **blocked**: the current repo or corpus lacks the capability.
- **uncertain**: evidence is mixed or the claim cannot be resolved from code and
  artifacts.

I checked the target doc against:

- `CONTEXT.md`
- `docs/learnings/codebase-memory-research.md`
- `docs/ideas/longitudinal-evidence-memory.md`
- `docs/ideas/self-improving-circuit.md`
- `docs/ideas/ratchet-data-requirements.md`
- `src/schemas/memory-input.ts`
- `src/schemas/run-envelope.ts`
- `src/schemas/trace-entry.ts`
- `src/history/query.ts`
- `src/history/memory-preview.ts`
- `src/history/extract.ts`
- `.circuit/runs` and `.circuit/history`
- the current `architecture-hardening` branch and `docs/ideas/architecture-hardening-plan-v2.md`

## Claim Inventory

| Claim from `self-auditing-memory.md` | Label | Evidence and assessment |
| --- | --- | --- |
| Flows are a closed set of typed schematic packages with finite step kinds and report contracts. | confirmed | `StepExecutionKind` is finite and `StepExecution` is a discriminated union (`src/schemas/flow-schematic.ts:90-123`). The authoring model names `input`, `output`, `execution`, checks, and routes as typed step concerns (`docs/flows/authoring-model.md:89-105`). |
| Closed typed runs make cross-run comparison possible in principle. | supported | The closed alphabet claim is valid at the step and report-contract level (`src/schemas/flow-schematic.ts:90-123`, `src/schemas/compiled-flow.ts:17-40`). It does not by itself define "same intent class" or enough sample size. |
| `completion_gate` carries required passes, attack-lens verdicts, and clean streak. | confirmed | `RunCompletionGate` defines `gate_passes.attack_lens`, `gate_passes.verdict`, `clean_streak`, and literal `required_passes` (`src/schemas/run-envelope.ts:228-304`). The goal contract also fixes required passes and blocking severities (`src/schemas/run-envelope.ts:123-129`). |
| `step.aborted` carries abort reasons. | confirmed | `StepAbortedTraceEntry` has `reason: z.string().min(1)` (`src/schemas/trace-entry.ts:382-388`). The local corpus has four `step.aborted` entries, with no repeated normalized abort reason (`docs/ideas/ratchet-data-requirements.md:286-295`). |
| `verification.command_evaluated` exists and carries command result and duration. | confirmed | The schema has `command_id`, `cwd`, `argv`, `exit_code`, `status`, `duration_ms`, `stdout_summary`, and `stderr_summary` (`src/schemas/trace-entry.ts:87-102`). The executor appends it after each proof-plan command observation (`src/runtime/executors/verification.ts:273-291`). Tests assert pass and fail entries (`tests/runner/build-verification-exec.test.ts:239-260`, `tests/runner/build-verification-exec.test.ts:327-337`). |
| `verification.command_evaluated.status` is mechanically tied to exit code. | confirmed | The trace union `superRefine` requires `passed` when `exit_code` is 0 and `failed` otherwise (`src/schemas/trace-entry.ts:559-568`). |
| Attempt counts are available. | supported | Trace entries carry `attempt` on steps and checks (`src/schemas/trace-entry.ts:48-99`), and run envelopes have process attempts (`src/schemas/run-envelope.ts:170-226`). The local corpus found no trace entry with `attempt > 1` (`docs/ideas/ratchet-data-requirements.md:293-297`). |
| Circuit already emits time and tokens to close. | blocked | Time is partially available through `duration_ms` on relay, sub-run, fanout branch, and verification events (`src/schemas/trace-entry.ts:87-99`, `src/schemas/trace-entry.ts:283-291`, `src/schemas/trace-entry.ts:413-427`, `src/schemas/trace-entry.ts:480-491`) and `started_at` / `completed_at` in process attempts (`src/schemas/run-envelope.ts:176-177`). I found no token or turn fields in the relevant schemas or runtime paths. The doc should not say tokens are already emitted. |
| `MemoryInputV0` carries a source ref, sha256, staleness, and `authority:"hint_only"`. | supported | The shape carries those fields, but `source.sha256` is optional (`src/schemas/memory-input.ts:31-38`, `src/schemas/memory-input.ts:56-66`). `superRefine` only checks equality when both `source.sha256` and `source.ref.sha256` are present (`src/schemas/memory-input.ts:68-79`). |
| `MemoryInputV0` enforces staleness reason rules. | confirmed | Unknown staleness requires `memory_unverified`, and stale staleness requires `memory_stale` (`src/schemas/memory-input.ts:111-130`). |
| Memory is hint-only and cannot become route, checkpoint, proof, policy, safe-apply, or write authority. | confirmed | `authority` is the `hint_only` literal (`src/schemas/memory-input.ts:56-66`), the history authority notice forbids proof, checkpoint, policy, route, recovery, verification, and write authority (`src/schemas/history.ts:5-6`), memory hint categories reject authority categories in tests (`tests/contracts/memory-input-schema.test.ts:57-83`), and guidance decisions allow memory refs only as hints or inputs (`tests/contracts/guidance-decision-schema.test.ts:459-589`). |
| `RunMemoryUpdateEvent` is a real state machine with `proposed`, `recorded`, `skipped`, and `rejected`. | supported | The action enum exists (`src/schemas/run-envelope.ts:357-369`). Calling it a state machine is stronger than the code: it is an event shape, not an enforced transition machine. |
| `RunMemoryUpdateEvent` requires source refs and an operator indicator. | supported | `source_refs` is required with `.min(1)` (`src/schemas/run-envelope.ts:366`). `operator_indicator` is required only for `proposed` and `recorded`, not for `skipped` or `rejected` (`src/schemas/run-envelope.ts:371-381`). |
| `memory_context.memory_input_ids` records exactly which hints a run used. | uncertain | It records memory input ids, not hint ids (`src/schemas/run-envelope.ts:478-484`, `src/cli/circuit.ts:715-725`). The hint ids live inside each memory input (`src/history/memory-preview.ts:74-79`) and are not recorded in the envelope. |
| Run-start recall injects current history memory into runtime prompts. | confirmed | The CLI prepares history recall before the runtime run (`src/cli/circuit.ts:956-986`), passes `memoryInputs`, and writes memory context into the envelope on closed and checkpoint-waiting paths (`src/cli/circuit.ts:1072-1080`, `src/cli/circuit.ts:1172-1183`). Relay prompts render "Prior Circuit History (hint-only)" (`src/shared/relay-support.ts:147-165`). |
| Run-start recall is small and capped. | confirmed | `DEFAULT_RECALL_LIMIT` is 3 and cap logic slices to `maxMemoryInputs` (`src/history/run-start-recall.ts:11-45`). |
| `memory_indicator` exists. | confirmed | `RunSurfaceOutput` has optional `memory_indicator` (`src/schemas/run-envelope.ts:392-400`), and the writer derives it from proposed or recorded memory events (`src/run-envelope/source-record.ts:637-641`). The observed envelope has no indicator because it has no memory update events (`.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:191-213`). |
| `sourceStaleness` exists and checks source freshness. | confirmed | `sourceStaleness` returns `unknown` with `memory_unverified` when no hash exists, `fresh` when the current source hash matches, and `stale` on missing or changed source (`src/history/query.ts:204-240`). It is private to `query.ts`. |
| `options.flow` exists in history query. | confirmed | `HistoryQueryOptions` includes optional `flow` (`src/history/query.ts:52-60`), and candidates are filtered by `doc.flow_id` when it is set (`src/history/query.ts:289-293`). Run-start recall does not pass a flow filter today (`src/history/run-start-recall.ts:48-60`). |
| `src/history/memory-preview.ts` converts history hits to `MemoryInputV0`. | confirmed | `historyMemoryInputPreview` builds `kind:"prior_run"` inputs, preserves source refs and staleness, and parses through `MemoryInputV0` (`src/history/memory-preview.ts:34-83`). |
| Memory preview ids can be used as a stable per-hint effect key. | blocked | `memoryId` includes the source run id prefix and a hash of `doc_id`, while each hint id is a hash suffix (`src/history/memory-preview.ts:46-48`, `src/history/memory-preview.ts:74-79`). This is fine for one run's injected context, but not enough for "runs that used hint H" across regenerated or equivalent hints. |
| A memory-merge report exists or has a code-defined home. | blocked | No schema or writer exists in `src/schemas/history.ts`; the code has history query, preview, and recall schemas only (`src/schemas/history.ts:130-221`). The report home is only proposed in idea docs (`docs/ideas/longitudinal-evidence-memory.md:329-360`, `docs/ideas/ratchet-data-requirements.md:601-620`). |
| Current history indexing lifts memory use and completion-gate outcome into queryable fields. | blocked | `HistoryDocumentV1` has generic `outcome`, `facets`, `text`, and refs, but no `memory_input_ids`, `completion_gate`, `clean_streak`, or helped/misled fields (`src/schemas/history.ts:53-89`). `extractRunHistoryDocuments` flattens JSON into text and facets (`src/history/extract.ts:487-561`, `src/history/extract.ts:564-653`). |
| A memory-merge report can link used memory to objective run outcome. | supported | The raw pieces exist in one source-owned run envelope: `memory_context`, `completion_gate`, `process_attempts`, `outcome`, and evidence refs (`.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:7-15`, `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:79-189`, `.circuit/runs/8ef6eb57-9284-44fe-9f4a-b1aa864a3e47/reports/run-envelope.json:214`). A new reader or report writer is still required. |
| A memory-merge report can judge helped vs misled from outcomes alone today. | blocked | The corpus has one memory-on envelope and no comparable memory-off envelope with the same flow and intent class. The research says the right method is outcome-grounded ablation, never self-report (`docs/learnings/codebase-memory-research.md:107-133`, `docs/learnings/codebase-memory-research.md:152-153`). Current local data can log linkage, not infer effect. |
| `memory_update_events` supports exact per-evidence refs and an at-most-N bound. | supported for refs, blocked for exactness and bounds | The schema allows an array of refs (`src/schemas/run-envelope.ts:366`), but the writer hardcodes `[processEvidence.ref]` (`src/run-envelope/source-record.ts:496-517`). Neither `source_refs` nor `memory_update_events` has `.max(...)` (`src/schemas/run-envelope.ts:366`, `src/schemas/run-envelope.ts:490`). |
| Verification command output needs redaction before feeding memory. | supported | Verification trace entries store `stdout_summary` and `stderr_summary` (`src/schemas/trace-entry.ts:97-98`). The proof-plan runner summarizes by truncation, not semantic redaction (`src/shared/proof-plan.ts:105-109`, `src/shared/proof-plan.ts:171-208`). The doc is right to require a capture-time redaction policy before memory production. |

## Load-bearing Thesis

The core thesis is sound:

- Circuit's typed flow and trace vocabulary gives a better comparison substrate
  than freeform chat transcripts.
- Outcome-grounded memory evaluation is exactly the gap the research identifies:
  do ablations on objective outcomes and do not ask the model whether memory
  helped (`docs/learnings/codebase-memory-research.md:107-133`,
  `docs/learnings/codebase-memory-research.md:152-153`).
- The first slice should be report-only. That honors the research's warnings
  about distractors, stale drift, self-reinforcing loops, and prompt bloat
  (`docs/learnings/codebase-memory-research.md:114-130`,
  `docs/learnings/codebase-memory-research.md:155-172`).

The weak point is measurement sufficiency.

The project's own corpus findings say the local sample is thin:

- 22 runs and 202 documents in the history manifest
  (`.circuit/history/manifest.v1.json:8-10`).
- One recall report, with three prior-run `MemoryInputV0` records
  (`docs/ideas/ratchet-data-requirements.md:299-306`).
- One run envelope with memory use and no memory update events
  (`docs/ideas/ratchet-data-requirements.md:299-306`).
- No repeated normalized abort reason and no step with `attempt > 1`
  (`docs/ideas/ratchet-data-requirements.md:286-297`).
- The corpus is descriptive only and not enough for stable probabilities
  (`docs/ideas/ratchet-data-requirements.md:317-319`).

So the keystone slice serves as product substrate immediately. It does not serve
as a validation experiment immediately unless the team also defines a controlled
evaluation set or waits for enough comparable memory-on and memory-off runs.

My call: keep the keystone, but change its promise. Slice 1 should say:

> Build the linkage artifact that makes later effect measurement possible. It
> may report "not enough comparable data" for a while.

That is still valuable. It is also more honest.

## Buildability Verdict

Buildability: **medium** for Slice 1 after prerequisites. **Low** for earned
injection or pruning until enough data exists.

Concrete prerequisites:

1. **Define the report contract.** Add a `history.memory-merge@v1` schema, report
   path, writer, fixtures, and contract tests. No such code exists today
   (`src/schemas/history.ts:130-221`; idea-only home at
   `docs/ideas/ratchet-data-requirements.md:601-620`).
2. **Add an envelope-aware reader or extractor.** `HistoryDocumentV1` does not
   lift `memory_input_ids`, `completion_gate`, `clean_streak`, or gate pass data
   into structured fields (`src/schemas/history.ts:53-89`). Current extraction
   flattens reports to text and facets (`src/history/extract.ts:487-653`).
3. **Fix the identity problem.** Decide whether Slice 1 groups by memory input,
   hint, source doc, or a new stable fact id. Today `memory_context` records
   memory input ids (`src/schemas/run-envelope.ts:478-484`) while hint ids live
   inside each input (`src/history/memory-preview.ts:74-79`).
4. **Add source-ref plumbing where needed.** `RunMemoryUpdateEvent` can hold refs,
   but `writeRunEnvelopeRecord` hardcodes the process-evidence ref
   (`src/run-envelope/source-record.ts:496-517`). A merge report needs refs for
   the injected memory source and the current outcome evidence.
5. **Add explicit bounds.** If memory updates or merge judgments can be emitted
   automatically, add at-most-N bounds. The current arrays are unbounded
   (`src/schemas/run-envelope.ts:366`, `src/schemas/run-envelope.ts:490`).
6. **Clarify time and token metrics.** Use available durations and process times
   now. Do not promise tokens or turns unless new usage fields are added.
7. **Define the "not enough data" output.** This is not a failure case. It is the
   expected early result given the corpus and cold-start warning
   (`docs/learnings/codebase-memory-research.md:132-133`).

## Long-Term Fit And Architecture-Hardening

Long-term fit: **good, with sequencing care**.

There is no fundamental conflict with the architecture-hardening branch. The
design should build against stable contracts, not refactor-target internals:

- Use on-disk `run.envelope@v0`, `MemoryInputV0`, `TraceEntry`, and history
  schemas as the stable inputs.
- Avoid depending on private `sourceStaleness` or current history hashing
  internals. `sourceStaleness` is private to `src/history/query.ts`
  (`src/history/query.ts:204-240`), and the architecture plan has history and
  hash primitive work in Phase 5 (`docs/ideas/architecture-hardening-plan-v2.md:371-372`).
- Avoid coupling Slice 1 to the current progress projector or runtime trace
  consumer. The current branch is actively changing runtime trace typing:
  `src/runtime/domain/trace.ts` now uses `z.infer<typeof TraceEntrySchema>` for
  read-side trace entries (`src/runtime/domain/trace.ts:1-10`).
- Be careful with the post-run artifact hook. The architecture plan explicitly
  targets `run` and `resume` extraction plus the shared post-run artifact step
  (`docs/ideas/architecture-hardening-plan-v2.md:84-88`,
  `docs/ideas/architecture-hardening-plan-v2.md:366-372`). A standalone
  read-only merge command over completed run folders may be less conflict-prone
  than inserting a new post-run writer while that branch is in motion.

Current branch check:

- Current branch: `architecture-hardening`.
- The working tree is dirty. The tracked dirty files touch runtime
  trace/progress/run files, tests, and generated host bundles. Separate
  untracked docs include the target memory docs and this review. The tracked
  dirty files do not directly edit `src/schemas/memory-input.ts`,
  `src/schemas/run-envelope.ts`, `src/schemas/trace-entry.ts`,
  `src/history/query.ts`, or `src/history/memory-preview.ts`, but they do touch
  runtime trace read paths.

Conclusion: do not block the design on architecture-hardening. Do sequence the
first implementation as a schema-level report reader/writer, or wait until the
post-run artifact extraction settles.

## CONTEXT And Research Fit

The doc mostly honors `CONTEXT.md`.

Confirmed fit:

- It frames the effectiveness ratchet as future-facing and not a current promise
  (`CONTEXT.md:108-110`).
- It keeps memory agent-facing and hint-only (`CONTEXT.md:112-126`).
- It starts with project and flow scope (`CONTEXT.md:116-122`).
- It prioritizes improving flow execution before routing or self-evolving flows
  (`CONTEXT.md:120-122`).

Gaps to fix:

- Add a refusal bullet for "no silent meaningful memory updates." CONTEXT says a
  succinct indicator should appear when memory influences a run
  (`CONTEXT.md:112-126`). The design mentions this in messaging, but the refusal
  list should name it as a rule.
- Soften "Circuit is the only one" into a product thesis, not a proven market
  fact. The research supports the field gap, but the repo cannot verify every
  competitor's capability (`docs/learnings/codebase-memory-research.md:152-153`).
- Clarify that source hashes make staleness machine-checkable, not correctness
  guaranteed. The research says citations help but do not prove truth
  (`docs/learnings/codebase-memory-research.md:140-141`).

## Must Fix Before Building

Priority 1: **Correct the identity claim.**

- Problem: the doc says "hint ids." The envelope stores memory input ids.
- Evidence: `memory_context.memory_input_ids` (`src/schemas/run-envelope.ts:478-484`);
  memory preview hint ids (`src/history/memory-preview.ts:74-79`).
- Required edit: either say "memory input ids" for Slice 1, or add a stable
  run-independent fact or hint identity as a prerequisite.

Priority 2: **Define the memory-merge report contract.**

- Problem: the report is central, but not defined in code.
- Evidence: current history schemas stop at query, preview, and recall
  (`src/schemas/history.ts:130-221`); idea-only shape at
  `docs/ideas/ratchet-data-requirements.md:601-620`.
- Required edit: name the schema, path, writer, test, and exact input artifacts.

Priority 3: **Separate substrate from validation.**

- Problem: the keystone cannot currently validate effect.
- Evidence: 22 runs, one recall report, one memory-on envelope, no repeated abort
  reason, no retries (`docs/ideas/ratchet-data-requirements.md:286-319`).
- Required edit: say Slice 1 logs the join and can report "not enough comparable
  data." Validation requires a minimum sample rule or controlled eval harness.

Priority 4: **Add the envelope and history reader gap.**

- Problem: no read-side lifts memory ids plus gate outcomes into structured
  queryable data.
- Evidence: `HistoryDocumentV1` lacks those fields (`src/schemas/history.ts:53-89`);
  extraction flattens JSON (`src/history/extract.ts:487-653`).
- Required edit: add an envelope-aware extractor, reader, or standalone scan as
  part of Slice 1.

Priority 5: **Fix source-ref and bound requirements.**

- Problem: the update-event writer hardcodes one ref and arrays are unbounded.
- Evidence: `source_refs: [input.processEvidence.ref]`
  (`src/run-envelope/source-record.ts:496-517`); no max on source refs or update
  events (`src/schemas/run-envelope.ts:366`, `src/schemas/run-envelope.ts:490`).
- Required edit: require per-judgment refs and an at-most-N bound before automatic
  memory writes.

Priority 6: **Remove the token claim or add token capture.**

- Problem: the target doc names tokens to close as an available outcome.
- Evidence: available schema fields cover durations and timestamps, not tokens
  (`src/schemas/trace-entry.ts:87-99`, `src/schemas/run-envelope.ts:176-177`).
- Required edit: use time, attempts, aborts, and gate outcomes for Slice 1.

Priority 7: **Name the architecture sequencing.**

- Problem: the branch is actively changing trace and post-run artifact internals.
- Evidence: architecture plan phases include trace-domain changes, history/hash
  work, and CLI post-run artifact extraction
  (`docs/ideas/architecture-hardening-plan-v2.md:366-375`).
- Required edit: target stable on-disk schemas, or defer post-run hook work until
  those slices settle.

## Proposed Design Doc Edits

Do not rewrite the design yet. Apply these edits before implementation:

1. In section 3, change "`MemoryInputV0` carries a source ref plus sha256" to
   "`MemoryInputV0` can carry a source hash; when both hashes are present the
   schema requires them to match."
2. In section 3, change "`RunMemoryUpdateEvent` is a real state machine" to
   "`RunMemoryUpdateEvent` is an event contract with four actions."
3. In section 4 and section 6, replace "hint ids" with "memory input ids" unless
   a stable hint or fact id is added.
4. In section 4, add that `options.flow` exists but run-start recall does not
   pass it yet.
5. In section 6, state that Slice 1 creates a new `history.memory-merge@v1`
   report, schema, writer, and reader.
6. In section 6, add the expected early output: "not enough comparable data."
7. In section 6, split "product substrate" from "validation experiment." The
   substrate is immediate. Validation needs sample size.
8. In section 7, remove token-to-close from the first slice unless token capture
   is added.
9. In section 8, add "no silent meaningful updates; show a short memory
   indicator when memory influences future behavior."
10. In section 8, say command-output summaries need redaction review before they
    feed memory.
11. In section 10, add a minimum-sample open question and a controlled-eval
    option.
12. In sources, mark `src/history/memory-preview.ts` as prior-run preview only,
    not project memory production.

## Open Questions

1. What is the stable identity for a memory item across runs: memory input id,
   hint id, source doc id, or a new content-addressed fact id?
2. What defines "same intent class" beyond `flow_id`?
3. How many comparable runs are required before an effect estimate can suppress
   or promote a hint?
4. Should Slice 1 run as a standalone history command over completed run folders
   first, to avoid conflict with architecture-hardening post-run refactors?
5. Should helped/misled stay absent in Slice 1, replaced by `effect_status:
   "not_enough_data" | "correlated_positive" | "correlated_negative" |
   "unresolved"`?

## Adversarial Review Record

Review pass 1:

- Medium finding resolved before final: the draft initially treated
  `MemoryInputV0` hash verification as unconditional. Fixed to state that
  `source.sha256` is optional and equality is enforced only when both hashes are
  present.
- Medium finding resolved before final: the draft did not distinguish product
  substrate from validation experiment sharply enough. Fixed in the top-line
  answer, load-bearing thesis, and must-fix list.
- Low finding resolved before final: added the `memory_indicator` gap from
  CONTEXT.

Review pass 2:

- No medium-or-above findings after the branch-status wording fix above.
- Low residual risk: corpus counts from the read-only scan are descriptive and
  can drift as `.circuit/runs` changes. The report cites stable artifacts where
  available and states the current date and scope.

Review pass 3:

- No medium-or-above findings.
- The report answers the requested top-line verdict, claim inventory,
  buildability verdict, long-term-fit verdict, CONTEXT check, and must-fix list.
