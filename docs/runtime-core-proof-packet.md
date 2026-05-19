# Runtime Core Proof Packet

Status: Normative supplement to `docs/runtime-core-architecture-spec.md`

Audience: Circuit maintainers, migration authors, and adversarial reviewers

Decision bar: make the runtime-core proposal enumerable, type-checkable, and
testable before implementation changes begin.

This packet closes the review surface around runtime core. If this packet
conflicts with the prose architecture spec, this packet is the stricter
contract. The architecture spec explains intent; this packet defines what a
reviewer can mechanically check.

Normative keywords:

- MUST means the implementation, migration plan, or review cannot proceed
  without satisfying the rule.
- MUST NOT means the behavior is forbidden, even if existing helpers currently
  do it.
- MAY means the behavior is allowed only through the owner and tests named in
  the relevant table.
- N/A means the outcome or effect is illegal for that row; a runtime path that
  reaches it is a defect.

## 1. Issue Ledger

No finding is closed by explanation alone. Every row below closes only when the
named contract exists and the named test obligation is implemented.

| Finding id | Original concern | Root cause | Spec or proof-packet section that closes it | Type/API constraint that closes it | Test obligation | Remaining risk | How a reviewer verifies closure |
|---|---|---|---|---|---|---|---|
| RC-001 | Transaction model under-specified: observation commits vs decision/transition commits. | The spec described "append observations, then decisions" without exact revision, retry, and partial-failure rules. | Section 5, Transaction Protocol; Section 4, Command Outcome Matrix. | `RuntimePlan` has separate `ObservationEventDraft[]` and `DecisionEventDraft[]`; `commitLedgerPlan` accepts exactly one batch class at one `expectedRevision`; decisions are replanned after observation commit. | Boundary tests for observation-only, observation-then-decision, expected-revision mismatch, retry after partial transaction, and materialization failure after append. | First implementation may lack cross-process locking. | Check that every append uses `expectedRevision`, batch append is atomic, and no decision draft planned before an observation commit is reused after the ledger changes. |
| RC-002 | Inspect/render purity conflicted with public behavior. | Existing public `resume`, `render`, and session-start paths blur read-only inspection with projection writes. | Section 2, Runtime Authority Matrix; Section 3, Side-Effect Permission Table; Section 4, rows CO-RESUME, CO-RENDER, CO-SESSION. | `CircuitRuntime.inspect` returns `RuntimeView` and has no write-capable deps; `CircuitRuntime.materialize` returns `RuntimeMaterializationReceipt` and cannot append events. | Tests prove `inspect` writes nothing, `render` appends nothing, and session-start refresh calls materialization only when a valid indexed current run exists. | CLI wrappers may preserve old names while routing through new methods. | Run effect-spy tests over store/continuity ports and verify `inspect` has no write methods in its dependency type. |
| RC-003 | Worker transport leaked into canonical runtime events. | `dispatch_received` accepted and current helpers emit adapter, transport, resolved source, diagnostics, and fallback details. | Section 6, Schema-Type Alignment; Section 2, adapter diagnostics and worker file rows. | Canonical `DispatchReceivedEvent` payload is `receipt_path`, `exchange_id`, and `attempt`; legacy adapter fields are read-only compatibility fields and are not present in canonical drafts or planner-visible facts. | Schema/type alignment tests reject new canonical dispatch events containing `adapter`, `transport`, `resolved_from`, `runtime_boundary`, `diagnostics_path`, or `warnings`; projection compatibility tests ignore those fields in legacy ledgers. | External receipts may still contain adapter diagnostics. | Inspect the TypeScript event draft type and producer tests; verify `WorkerReceiptFact` cannot carry raw adapter fields. |
| RC-004 | Type vocabulary too loose to prevent helper sprawl. | Existing helpers pass plain strings and `Record<string, unknown>` payloads across command, event, and fact boundaries. | Section 7, Type Skeleton Requirements; Section 8, Import Boundary Rules. | Closed `RuntimeCommand`, command-specific plan unions, branded ids and paths, closed failure kinds, and exact payload interfaces. Planner-visible types ban arbitrary records except quarantined diagnostics. | Type-only skeleton must compile; ratchet scans fail on planner-visible `Record<string, unknown>` escape hatches and command-specific mini-runtime imports. | Some adapter and schema boundary code still parses unknown JSON. | Review `runtime-core/types.ts` and ratchet allowlist; confirm unknown JSON is narrowed before it reaches planner types. |
| RC-005 | Migration plan hid risky cutover steps. | The plan named slices but did not require old behavior pinning, golden ledger comparison, or wrapper thinning gates. | Section 9, Migration Gate Checklist. | Each slice has a checklist status type or tracking row that cannot be marked complete without golden CLI, side-effect, ledger, and boundary tests. | Migration ratchet requires slice evidence before deleting helper-level tests or declaring wrapper migration complete. | Manual checklist discipline can drift. | Review migration PRs against Section 9; every slice must link test names and wrapper-thinning diff. |
| RC-006 | Materialization mutates continuity authority. | The spec called continuity updates "projection materialization", hiding that continuity index is its own authority. | Section 2, continuity artifact rows; Section 3, materialize and continuity rows; Section 5 attachment intent. | `ContinuityAttachmentIntent` is separate from `ProjectionWritePolicy`; `materializeRuntimeView` may call `ContinuityPort` only when the shell supplies explicit attachment intent. | Tests prove terminal materialization clears matching current-run, detached materialization does not touch continuity, and corrupt continuity reports materialization failure without changing ledger outcome. | Continuity command remains a sibling authority. | Check that materialization never reads or writes continuity directly except through `ContinuityPort` and never creates pending records. |
| RC-007 | Worker facts expose raw or adapter-shaped payloads. | Proposed facts included raw result JSON and existing receipt helpers copy adapter payloads forward. | Section 6, Schema-Type Alignment; Section 7, Type Skeleton Requirements. | `WorkerReceiptFact` and `WorkerResultFact` expose only transport-neutral fields; raw payloads may exist only in `RuntimeDiagnosticDetails` with `source="worker_exchange"` or `source="adapter"`, never in planner input. | Type tests fail if worker facts include `raw`, `adapter`, `transport`, `resolved_from`, process argv, or diagnostics. | Debug views still need diagnostics. | Verify planner input type and tests; diagnostics must be reachable only through the single `RuntimeDiagnosticDetails` quarantine and diagnostic presenter paths. |
| RC-008 | Schema/type/event vocabulary mismatch. | The spec mentioned `dispatch_receipt_observed`, schema only has `dispatch_received`, and payload exactness was not enforced. | Section 6, Schema-Type Alignment. | Canonical ledger event remains `dispatch_received`; there is no `dispatch_receipt_observed` ledger event. TypeScript event union exactly mirrors schema event names, with stricter exact payload types. | Test enumerates `schemas/event.schema.json` event enum and runtime `RuntimeEvent["event_type"]`; test fails on either side missing a row. | JSON Schema currently allows extra payload fields in some inner payloads. | Reviewer checks exact-payload runtime validation or schema tightening migration, and confirms all schema events appear in Section 6. |
| RC-009 | Existing code paths mix append/render/continuity effects. | `recordEventsAndRender`, bootstrap, dispatch, checkpoint, synthesis, and abort combine canonical append with projection and attachment writes. | Section 3, Side-Effect Permission Table; Section 8, Import Boundary Rules; Section 9, Migration Gate Checklist. | Only `commitLedgerPlan` appends events; only `materializeRuntimeView` writes projection files; continuity mutation requires `ContinuityAttachmentIntent`; CLI presenters cannot write files. | Import ratchets ban runtime-core imports from old command helpers and ban CLI wrappers from command-specific modules after each slice migrates. Boundary effect tests spy on append/render/continuity ports separately. | Compatibility wrappers can remain temporarily. | Review import graph and wrapper-thinning evidence for each migrated command. |

## 2. Runtime Authority Matrix

Definitions:

- Authority: a file whose contents own a domain fact.
- Projection: a file derived from an authority and safe to regenerate.
- Observed fact: a local file owned outside the ledger until the runtime commits
  an observation event.
- "Can see" means the component can receive the artifact or its parsed contents.
- "Can touch" means direct read or write access. A "parsed only" cell means the
  shell may pass parsed data in, but the component cannot read the file.

| Runtime artifact | Authority or projection? | Owner | Who may read it? | Who may write it? | Can `projectLedger` see it? | Can `observeRuntimeFacts` see it? | Can `planRuntimeCommand` see it? | Can `commitLedgerPlan` write it? | Can `materializeRuntimeView` write it? | Can `inspect` touch it? | Can CLI presenter touch it? | Failure behavior | Required tests |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `events.ndjson` | Authority for runtime state. | `commitLedgerPlan` through `RuntimeStore.appendEvents`. | Runtime shell, `inspect`, `materialize`, debug tools. `projectLedger` receives parsed events only. | `commitLedgerPlan` only. Bootstrap also appends only through `commitLedgerPlan`. | Yes, parsed events only. | No. It receives projection, not the ledger file. | No. It receives projection and facts. | Yes, append-only batch at expected revision. | No. | Yes, read-only through runtime shell. | No. Presenter consumes receipts. | Corrupt ledger returns `runtime_corrupt`; schema-invalid stamped events append nothing; append mismatch appends nothing and forces re-plan. | Projection from ledger, corrupt ledger, atomic batch append, schema-invalid append rejection, expected revision mismatch, no direct appends outside commit port. |
| `state.json` | Projection only. | `materializeRuntimeView`. | Debug tools and compatibility tests. Runtime command decisions MUST NOT read it. | `materializeRuntimeView` only. | No. | No. | No. | No. | Yes, overwrite from projection. | No. | No. | Corrupt or stale state is ignored by execute and inspect; write failure returns `projection_materialization_failed`. | Abort ignores stale/corrupt state; execute ignores state; materialize overwrites state; failed state write does not duplicate events. |
| `artifacts/active-run.md` | Projection only. | `materializeRuntimeView` via `ActiveRunRenderer`. | Humans, prompt surfaces, session-start fallback banner. Runtime command decisions MUST NOT read it. | `materializeRuntimeView` only. | No. | No. | No. | No. | Yes, overwrite from projection. | No. Inspect may return in-memory view only. | No. Presenter may print the path from a receipt. | Corrupt or stale dashboard is overwritten by materialize; if render fails after append, ledger outcome remains authoritative. | Inspect writes nothing; render appends nothing; session-start refresh overwrites stale dashboard when current-run is valid. |
| `.circuit/control-plane/continuity-index.json` | Authority for continuity attachment and pending records. | Continuity control plane. Runtime shell has a narrow `ContinuityPort` for current-run attachment only. | Continuity commands, session-start, `ContinuityPort`. | Continuity commands and `ContinuityPort` current-run methods. | No. | No. | No. Planner may return attachment intent but cannot read index. | No. | Yes, only through explicit attachment intent and `ContinuityPort`. | No. | No. | Corrupt index fails closed. Runtime ledger outcome is not rolled back; attachment failure is materialization failure. | Continuity corrupt-index tests; detached runtime commands do not touch index; terminal attached runs clear matching current-run only. |
| `.circuit/current-run` | Compatibility projection of continuity index `current_run`. | Continuity control plane. | Session-start and legacy compatibility tools. Runtime core planning never reads it. | Continuity control plane only. | No. | No. | No. | No. | Yes, only through `ContinuityPort` sync/clear. | No. | No. | Stale marker is removed or resynced from index; it is never authority. | Marker follows index; stale marker does not select a run; materialize cannot attach without intent. |
| Checkpoint request files | Observed fact until accepted by `checkpoint_requested`. | Orchestrating prompt/session according to manifest `writes.request`. | `observeRuntimeFacts` for `request-checkpoint`; humans/debug tools. | Outside runtime core. Runtime core MUST NOT create them. | No. | Yes, read/exists/parse as required. | Yes, as `CheckpointRequestFact`, not raw file. | No direct file write; may append observation event. | No. | No. | No. | Missing file returns `missing_observed_file` with no checkpoint event. Malformed file returns `invalid_observed_file`. | Request checkpoint missing/malformed/valid tests; core never writes request file. |
| Checkpoint response files | Observed fact until accepted by `checkpoint_resolved`. | Human or orchestrating prompt according to manifest `writes.response`. | `observeRuntimeFacts` for `resolve-checkpoint`; humans/debug tools. | Outside runtime core. | No. | Yes. | Yes, as `CheckpointResponseFact` with selection. | No direct file write; may append observation event. | No. | No. | No. | Missing or malformed response appends nothing. Invalid selection appends nothing. | Resolve checkpoint missing/malformed/invalid/valid tests. |
| Worker request files | Observed fact until accepted by `dispatch_requested`. | Orchestrating prompt/session according to manifest `writes.request`. | `observeRuntimeFacts`; dispatch adapter may read after runtime accepts the request. | Outside runtime core. Runtime core MUST NOT create them. | No. | Yes. | Yes, as `DispatchRequestFact`. | No direct file write; may append observation event. | No. | No. | No. | Missing or malformed request appends nothing. Valid request records waiting-worker state without executing transport. | Dispatch request missing/malformed/valid tests; adapter execution spy proves no transport run. |
| Worker receipt files | Observed fact until accepted by `dispatch_received`. | Dispatch adapter or worker transport. | `WorkerExchangeReader` through `observeRuntimeFacts`; diagnostic viewers. | Dispatch adapter or worker transport only. | No. | Yes, through typed reader. | Yes, as transport-neutral `WorkerReceiptFact`. | No direct file write; may append observation event. | No. | No. | No. | Malformed receipt returns `invalid_observed_file`; legacy adapter metadata is ignored for planning. | New canonical receipt event lacks transport fields; legacy receipt events project compatibly. |
| Worker result files | Observed fact until accepted by `job_completed`. | Worker transport or orchestrating worker protocol. | `WorkerExchangeReader` through `observeRuntimeFacts`; diagnostic viewers. | Worker transport only. | No. | Yes, through typed reader. | Yes, as transport-neutral `WorkerResultFact`. | No direct file write; may append observation event. | No. | No. | No. | Missing/malformed result appends nothing. Partial/blocked/nonpassing result commits observation but no route decision. | Reconcile missing/malformed/partial/blocked/nonpassing/passing tests. |
| Invocation ledger | Authority for invocation/routing analytics only; not runtime state. | Invocation ledger adapter at shell edge. | CLI/runtime shell analytics paths. | Bootstrap shell or classification CLI after core outcome is known. | No. | No. | No. | No. | No. | No. | No. | Invocation ledger failure must not reinterpret canonical runtime ledger outcome unless the public CLI compatibility test explicitly pins failure behavior for that command. | Bootstrap invocation ledger success/failure tests; planner cannot import invocation ledger. |
| Adapter diagnostics | Diagnostics only; not runtime authority. | Dispatch adapter/worker transport. | Diagnostic viewers and adapter troubleshooting. | Dispatch adapter/worker transport. | No. | No for planning. A diagnostic view MAY read them outside planner input. | No. | No. | No. | No. | No. | Diagnostics read failure cannot change workflow state. Diagnostics MUST NOT be copied into canonical events. | Dispatch diagnostics quarantine tests; no planner-visible diagnostic fields. |

## 3. Side-Effect Permission Table

Cell format:

- `Y(owner; test)` means the effect is allowed only through that owner and must
  have the named test obligation.
- `N` means the effect is forbidden.
- `Y*` means allowed only for a named command or compatibility path described in
  the cell.

| Public method or seam | Read manifest snapshot | Read manifest source | Write manifest snapshot | Read event ledger | Append event ledger | Read observed local files | Write `state.json` | Write `active-run.md` | Mutate continuity index | Mutate `.circuit/current-run` | Write invocation ledger | Execute worker/adapter | Print CLI output |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `CircuitRuntime.execute` | Y(shell; SE-EXEC-01) | Y*(bootstrap only; SE-BOOT-01) | Y*(bootstrap only; SE-BOOT-02) | Y(shell; SE-EXEC-01) | Y(via `commitLedgerPlan`; SE-COMMIT-01) | Y(via `observeRuntimeFacts`; SE-OBS-01) | Y(via `materializeRuntimeView`; SE-MAT-01) | Y(via `materializeRuntimeView`; SE-MAT-01) | Y*(attachment intent only; SE-CONT-01) | Y*(attachment intent only; SE-CONT-01) | Y*(bootstrap/invocation edge only; SE-INV-01) | N | N |
| `CircuitRuntime.inspect` | Y(shell; SE-INSP-01) | N | N | Y(shell; SE-INSP-01) | N | N | N | N | N | N | N | N | N |
| `CircuitRuntime.materialize` | Y(shell; SE-MAT-01) | N | N | Y(shell; SE-MAT-01) | N | Y*(view enrichment only; SE-MAT-02) | Y(`materializeRuntimeView`; SE-MAT-01) | Y(`materializeRuntimeView`; SE-MAT-01) | Y*(attachment intent only; SE-CONT-01) | Y*(attachment intent only; SE-CONT-01) | N | N | N |
| `projectLedger` | N, receives manifest value | N | N | N, receives parsed events | N | N | N | N | N | N | N | N | N |
| `observeRuntimeFacts` | N, receives projection | N | N | N | N | Y(read-only store and worker exchange reader; SE-OBS-01) | N | N | N | N | N | N | N |
| `planRuntimeCommand` | N | N | N | N | N | N, receives typed facts | N | N | N | N | N | N | N |
| `commitLedgerPlan` | N | N | N | N, receives expected revision | Y(`RuntimeStore.appendEvents`; SE-COMMIT-01) | N | N | N | N | N | N | N | N |
| `materializeRuntimeView` | N, receives projection | N | N | N | N | Y*(renderer view enrichment only; SE-MAT-02) | Y(store projection writer; SE-MAT-01) | Y(renderer/store writer; SE-MAT-01) | Y*(explicit attachment intent; SE-CONT-01) | Y*(explicit attachment intent; SE-CONT-01) | N | N | N |
| CLI presenter | N | N | N | N | N | N | N | N | N | N | N | N | Y(presenter only; SE-CLI-01) |
| Continuity command/control plane | N | N | N | N | N | N | N | N | Y(continuity owner; SE-CONT-02) | Y(continuity owner; SE-CONT-02) | N | N | Y(continuity CLI presenter; SE-CONT-03) |
| Dispatch adapter/worker transport | N | N | N | N | N | Y*(request/prompt files outside planner; SE-WORK-01) | N | N | N | N | N | Y(adapter owner; SE-WORK-02) | Y*(adapter CLI only; SE-WORK-03) |

Required side-effect tests:

- SE-EXEC-01: every execute command reads ledger once per transaction phase and
  never reads `state.json` or `active-run.md` for decisions.
- SE-BOOT-01: bootstrap reads manifest source and validates it before snapshot
  or event append.
- SE-BOOT-02: bootstrap retry after a written byte-identical snapshot is
  deterministic; mismatched snapshot fails before append.
- SE-INSP-01: inspect reads only the manifest snapshot and event ledger through
  read-only deps, returns an in-memory view, and never writes projection files,
  continuity files, invocation ledger entries, worker files, or CLI output.
- SE-COMMIT-01: commit appends an all-or-nothing batch at expected revision and
  never renders, syncs continuity, writes invocation ledger, prints, or executes
  workers.
- SE-CLI-01: CLI presenters are pure receipt-to-output mappers; tests construct
  receipts in memory and prove presenters perform no filesystem, continuity,
  ledger, worker, or process side effects.
- SE-OBS-01: observers are read-only and return typed facts with evidence
  tokens.
- SE-MAT-01: materialization writes projections and appends no events.
- SE-MAT-02: renderer enrichment reads cannot influence command planning or
  event drafts.
- SE-CONT-01: runtime attachment writes require explicit intent and are reported
  as materialization status, not ledger outcome.
- SE-CONT-02: continuity command owns pending records and index authority.
- SE-CONT-03: continuity CLI output is pinned separately from runtime command
  presenters.
- SE-INV-01: invocation ledger writes are shell-edge analytics and cannot affect
  `projectLedger`.
- SE-WORK-01: adapter request/prompt reads are outside planner input.
- SE-WORK-02: worker execution is not reachable from runtime core command
  planning or execution.
- SE-WORK-03: adapter CLI output is not a runtime receipt.

## 4. Command Outcome Matrix

Rows below are the closed set of legal outcomes. Any command outcome not listed
here is a defect or must be added to this packet before implementation.

Legend:

- Projection writes means `state.json` and/or `active-run.md`.
- Continuity writes means current-run attachment sync/clear only, never pending
  record mutation.
- CLI compatibility means current stdout/stderr keys, JSON keys, and exit status
  must be pinned before migration. The core receipt may be stricter than the
  legacy command, but the presenter must preserve public behavior unless a
  staged migration decision explicitly changes it.

### 4.1 Global Outcomes Inherited By Runtime Commands

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-G-01 | All `execute` commands | Expected revision mismatch before an observation batch. | Manifest snapshot, ledger, observed facts as needed. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="expected_revision_mismatch")` or retry-internal receipt if shell retries transparently. | Exit must match pinned legacy behavior for the migrated command. | Error text and JSON failure shape pinned before slice. | Inject ledger change between project and observation append; assert no append and deterministic retry/re-plan. |
| CO-G-02 | All `execute` commands with observation then decision | Observation append succeeds; decision append expected revision mismatch. | Ledger at N, facts, ledger at N+1, then changed ledger. | Observation batch committed at N. | None for failed attempt. | Materialize from N+1 if returning non-advancing, or retry after re-plan. | Attachment only if materializing an attached projection. | `RuntimeNonAdvancingReceipt(outcome="observation_committed_decision_replanned")` if returned without retry, or final retried receipt from the replanned command; never a stale transition receipt. | Pinned per command. | Must expose appended observations if final receipt returns without retrying. | Inject concurrent append between observation and decision; assert stale decision batch is discarded and replanned. |
| CO-G-03 | All ledger-backed surfaces | Corrupt ledger. | Manifest snapshot and ledger. | None. | None. | None, unless a debug-only repair tool is explicitly invoked outside runtime core. | None. | `RuntimeFailureReceipt(kind="runtime_corrupt")` for execute; `RuntimeViewFailure(kind="runtime_corrupt")` for inspect; `RuntimeMaterializationReceipt(ok=false, failure.kind="runtime_corrupt")` for materialize. | Exit 1 for public CLI. | Stderr/JSON failure contains corrupt ledger diagnosis without guessing from `state.json`. | Corrupt ndjson line, unknown event, schema-invalid event, and incompatible legacy event tests. |
| CO-G-04 | All execute commands | Corrupt `state.json`. | Manifest snapshot, ledger. State file is not read. | Command-specific. | Command-specific. | Overwrite state during materialization or report materialization failure. | Command-specific attachment intent. | Same command-specific `RuntimeSuccessReceipt`, `RuntimeNonAdvancingReceipt`, or `RuntimeFailureReceipt` variant that a clean `state.json` would return. | Pinned per command; no command may fail only because pre-existing `state.json` is corrupt. | Output derives from projection, not stale state. | Poison `state.json`; execute command and assert same events/receipt as clean state. |
| CO-G-05 | All materializing commands | Corrupt `active-run.md`. | Manifest snapshot, ledger, optional view enrichment. | Command-specific. | Command-specific. | Overwrite dashboard or return materialization failure. | Command-specific attachment intent. | Same command-specific ledger receipt variant that a clean dashboard would return, or `RuntimeMaterializationReceipt(ok=false, failure.kind="projection_materialization_failed")` for direct `materialize`. | Pinned per command. | Output path remains stable; stale dashboard content not used as input. | Poison `active-run.md`; assert materialize overwrites and inspect ignores. |
| CO-G-06 | Attached materializing commands | Corrupt continuity index. | Manifest snapshot, ledger, continuity index through `ContinuityPort`. | Command-specific. | Command-specific. | Projection writes may succeed. | Fails closed; no partial pending-record mutation. | Ledger receipt keeps its command-specific variant and sets `materialization.ok=false` with `failure.kind="projection_materialization_failed"`; pure continuity command returns `ContinuityFailure(kind="continuity_index_invalid")`. | Pinned per command. | Includes continuity failure without claiming ledger failure. | Corrupt index after append; assert events are not rolled back and retry materialize is possible. |
| CO-G-07 | All commands with append | Materialization failure after append. | Manifest snapshot, ledger after final append. | Already committed if any. | Already committed if any. | Failed write reported in `ProjectionMaterializationStatus`. | Attachment intent not applied after a failed prerequisite write unless the materializer can prove idempotent ordering. | Ledger receipt keeps its command-specific `RuntimeSuccessReceipt`, `RuntimeNonAdvancingReceipt`, or `RuntimeFailureReceipt` variant and sets `materialization.ok=false` with `failure.kind="projection_materialization_failed"`. | Legacy presenter exit behavior must be pinned before migration. | Output must name materialization failure separately from ledger outcome. | Inject state/dashboard write failure; retry `materialize` and assert no duplicate events. |

### 4.2 Bootstrap

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-BOOT-01 | `bootstrap` | Precondition failure: missing flags, invalid attached run root, invalid entry mode, snapshot mismatch, or invalid run-root reuse. | Manifest source if path exists; existing snapshot when present. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed" or "manifest_invalid")`. | Exit 1. | Preserve current bootstrap stderr hints and JSON absence on failure unless explicitly migrated. | Golden CLI for each precondition class; no event file created. |
| CO-BOOT-02 | `bootstrap` | Missing observed file: manifest source missing. | Manifest source path existence. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="missing_observed_file")`. | Exit 1. | Preserve "manifest not found" hint. | Missing manifest source test; invocation failure side effect remains analytics only. |
| CO-BOOT-03 | `bootstrap` | Malformed observed file: manifest YAML or schema invalid. | Manifest source. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="manifest_invalid" or "invalid_observed_file")`. | Exit 1. | Preserve validation failure surface. | Invalid manifest source tests. |
| CO-BOOT-04 | `bootstrap` | Already bootstrapped/no-op: matching snapshot and valid ledger already exist. | Manifest source, manifest snapshot, ledger. | None. | None. | Yes, refresh projections. | Sync attachment when `attachment="attached"`. | `RuntimeNonAdvancingReceipt(outcome="already_bootstrapped", noOp=true)`. | Exit 0. | Preserve keys: `active_run_path`, `attachment`, `bootstrapped=false`, `resume_step`, `run_root`, `run_slug`, `status`. | Retry bootstrap test with golden stdout/JSON and unchanged ledger. |
| CO-BOOT-05 | `bootstrap` | Transition success. | Manifest source, ledger empty/missing. | None. | `run_started`, initial `step_started`. | Yes. | Sync attachment when attached. | `RuntimeSuccessReceipt(outcome="bootstrap")`. | Exit 0. | Preserve bootstrap key set and terminal announcement behavior. | Golden ledger compared to old command normalized for ids/timestamps; side effects pinned. |
| CO-BOOT-06 | `bootstrap` | Snapshot written but ledger append fails. | Manifest source and snapshot. | None. | None committed. | None. | None. | `RuntimeFailureReceipt(kind="ledger_append_failed")`; retry must reuse byte-identical snapshot or fail before append. | Exit 1. | Error output pinned. | Inject append failure after snapshot write; retry test proves deterministic behavior. |

### 4.3 Complete Synthesis

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-SYN-01 | `complete-synthesis` | Precondition failure: wrong status, wrong current step, non-synthesis step, unsupported gate with no accepted observation, or invalid route override. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed" or "route_invalid")`. | Exit 1. | Preserve current error wording where pinned. | Precondition and route override golden tests; no append. |
| CO-SYN-02 | `complete-synthesis` | Missing observed file: gate source/artifact absent. | Manifest snapshot, ledger, artifact/gate path existence. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="missing_observed_file")`. | Exit 1. | Preserve "artifact not found" shape. | Missing artifact test; no append, no projection write except legacy behavior if pinned before migration. |
| CO-SYN-03 | `complete-synthesis` | Malformed or gate-invalid observed file: source exists but required sections/options/outputs fail. | Manifest snapshot, ledger, observed source with evidence token. | `artifact_written` for newly accepted declared artifacts. | None unless a manifest failure route is selected. | Yes, if observations were committed. | Sync attachment if materialized attached run. | `RuntimeFailureReceipt(kind="invalid_observed_file" or "gate_failed")` when no observation commits; `RuntimeNonAdvancingReceipt(outcome="synthesis_gate_not_satisfied")` when valid observations commit without advancement; never transition unless routed failure is explicit. | Legacy exit behavior pinned before slice. | Output must distinguish accepted artifact observation from no route advancement. | Invalid sections, option count, and all outputs tests; observation committed at most once. |
| CO-SYN-04 | `complete-synthesis` | Already completed/no-op. | Manifest snapshot, ledger. | None. | None. | Yes, refresh projections. | Sync/clear according to projected status and attachment intent. | `RuntimeNonAdvancingReceipt(outcome="step_already_completed", noOp=true)`. | Exit 0. | Preserve `gate_passed=true`, `no_op=true`, `route`, `status`, `step`. | No-op golden test. |
| CO-SYN-05 | `complete-synthesis` | Transition success: gate passes and route targets another step. | Manifest snapshot, ledger, observed source. | `artifact_written` as needed. | `gate_passed`, next `step_started`. | Yes. | Sync attachment. | `RuntimeSuccessReceipt(outcome="synthesis_completed")`. | Exit 0. | Preserve command output keys and route value. | Golden ledger and CLI test. |
| CO-SYN-06 | `complete-synthesis` | Terminal transition. | Same as CO-SYN-05. | `artifact_written` as needed. | `gate_passed`, `run_completed`. | Yes. | Clear matching current-run attachment. | `RuntimeSuccessReceipt(outcome="terminal")`. | Exit 0. | Preserve terminal announcement and status mapping. | Terminal route tests for `@complete`, `@stop`, `@escalate`, `@handoff`. |

### 4.4 Checkpoint Request

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-CPREQ-01 | `request-checkpoint` | Precondition failure: wrong status, wrong current step, non-checkpoint step. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed")`. | Exit 1. | Preserve current error surface. | Precondition tests; no append. |
| CO-CPREQ-02 | `request-checkpoint` | Missing or malformed observed request file. | Manifest snapshot, ledger, request path. | `artifact_written` only if independently valid and already committed before request validation; otherwise none. | None. | Only if observation was committed. | Sync attachment only if materialized. | `RuntimeFailureReceipt(kind="missing_observed_file" or "invalid_observed_file")`. | Exit 1. | Preserve request missing/malformed output. | Missing/malformed request tests; no `checkpoint_requested` event. |
| CO-CPREQ-03 | `request-checkpoint` | Already waiting/no-op. | Manifest snapshot, ledger. | None. | None. | Yes, refresh projections. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="waiting_checkpoint", noOp=true)`. | Exit 0. | Preserve `gate_passed=false`, `no_op=true`, `status`, `step`. | No-op waiting checkpoint test. |
| CO-CPREQ-04 | `request-checkpoint` | Observation-only success: valid request accepted. | Manifest snapshot, ledger, request file. | Optional `artifact_written`, `checkpoint_requested`. | None. | Yes. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="waiting_checkpoint")`. | Exit 0. | Preserve output keys. | Request checkpoint round-trip golden test. |

### 4.5 Checkpoint Resolve

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-CPRES-01 | `resolve-checkpoint` | Precondition failure: wrong status, wrong step, non-checkpoint step. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed")`. | Exit 1. | Preserve current error surface. | Precondition tests; no append. |
| CO-CPRES-02 | `resolve-checkpoint` | Missing or malformed response file. | Manifest snapshot, ledger, response path. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="missing_observed_file" or "invalid_observed_file")`. | Exit 1. | Preserve parse/missing message. | Missing/malformed response tests. |
| CO-CPRES-03 | `resolve-checkpoint` | Invalid selection or route. | Manifest snapshot, ledger, response/explicit selection. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="route_invalid" or "gate_failed")`. | Exit 1. | Preserve selection failure shape. | Invalid selection and route override tests. |
| CO-CPRES-04 | `resolve-checkpoint` | Already completed/no-op. | Manifest snapshot, ledger. | None. | None. | Yes, refresh projections. | Sync/clear by projected status. | `RuntimeNonAdvancingReceipt(outcome="step_already_completed", noOp=true)`. | Exit 0. | Preserve `selection`, `route`, `no_op=true`. | No-op checkpoint resolve test. |
| CO-CPRES-05 | `resolve-checkpoint` | Transition success to next step. | Manifest snapshot, ledger, response/selection. | `checkpoint_resolved`. | `gate_passed`, next `step_started`. | Yes. | Sync attachment. | `RuntimeSuccessReceipt(outcome="checkpoint_resolved")`. | Exit 0. | Preserve output keys. | Resolve golden ledger and CLI test. |
| CO-CPRES-06 | `resolve-checkpoint` | Terminal transition. | Same as CO-CPRES-05. | `checkpoint_resolved`. | `gate_passed`, `run_completed`. | Yes. | Clear matching current-run attachment. | `RuntimeSuccessReceipt(outcome="terminal")`. | Exit 0. | Preserve status mapping and terminal announcement. | Terminal checkpoint route tests. |

### 4.6 Dispatch Step

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-DISP-01 | `dispatch-step` | Precondition failure: wrong status, wrong step, non-dispatch step, impossible receipt recovery state. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed")`. | Exit 1. | Preserve current error surface. | Dispatch precondition tests. |
| CO-DISP-02 | `dispatch-step` | Missing or malformed request file. | Manifest snapshot, ledger, request file. | Optional `artifact_written` only if independently committed before request validation; no dispatch request. | None. | Only if observations were committed. | Sync attachment only if materialized. | `RuntimeFailureReceipt(kind="missing_observed_file" or "invalid_observed_file")`. | Exit 1. | Preserve request error surface. | Missing/malformed request tests; no worker execution. |
| CO-DISP-03 | `dispatch-step` | Already requested/running with no new receipt/no-op. | Manifest snapshot, ledger, optional receipt path. | None. | None. | Yes, refresh projections. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="waiting_worker", noOp=true)`. | Exit 0. | Preserve `attempt`, `gate_passed=false`, `no_op=true`. | Waiting-worker no-op test. |
| CO-DISP-04 | `dispatch-step` | Observation-only success: valid new request accepted. | Manifest snapshot, ledger, request file, optional receipt. | Optional `artifact_written`, `dispatch_requested`, optional canonical `dispatch_received`. | None. | Yes. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="waiting_worker")`. | Exit 0. | Preserve output keys and attempt. | Dispatch request golden test; event has no adapter metadata. |
| CO-DISP-05 | `dispatch-step` | Observation-only success: receipt recovery for existing requested/running job. | Manifest snapshot, ledger, receipt file. | Canonical `dispatch_received` if not already recorded. | None. | Yes. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="worker_receipt_observed")`. | Exit 0. | Preserve receipt recovery output. | Receipt recovery test; idempotent no duplicate receipt event. |

### 4.7 Reconcile Dispatch

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-REC-01 | `reconcile-dispatch` | Precondition failure: wrong status, wrong step, non-dispatch step, no requested/running job. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed")`. | Exit 1. | Preserve current error surface. | Reconcile precondition tests. |
| CO-REC-02 | `reconcile-dispatch` | Missing result file. | Manifest snapshot, ledger, result path. | None, except optional receipt observation only if command explicitly permits receipt recovery before result failure. | None. | Only if receipt observation was committed. | Sync attachment only if materialized. | `RuntimeFailureReceipt(kind="missing_observed_file")`. | Exit 1. | Preserve missing result message. | Missing result test; receipt recovery behavior pinned. |
| CO-REC-03 | `reconcile-dispatch` | Malformed result file or unsupported completion/verdict shape. | Manifest snapshot, ledger, result path. | Optional receipt observation only if independently valid. | None. | Only if observation was committed. | Sync attachment only if materialized. | `RuntimeFailureReceipt(kind="invalid_observed_file")`. | Exit 1. | Preserve parse/unsupported output. | Malformed result tests. |
| CO-REC-04 | `reconcile-dispatch` | Already reconciled/no-op. | Manifest snapshot, ledger. | Optional newly observed receipt if not already recorded and still valid; otherwise none. | None. | Yes, refresh projections. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="dispatch_already_reconciled", noOp=true)`. | Exit 0. | Preserve `attempt`, `no_op`, `gate_passed=false`. | No-op reconcile tests. |
| CO-REC-05 | `reconcile-dispatch` | Observation-only success: `completion=partial` or `completion=blocked`. | Manifest snapshot, ledger, result and optional receipt. | Optional `dispatch_received`, `job_completed`. | None. | Yes. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="worker_partial" or "worker_blocked")`. | Exit 0 unless legacy golden says otherwise. | Output keeps status/attempt and no route. | Partial and blocked result tests. |
| CO-REC-06 | `reconcile-dispatch` | Observation-only success: complete result with non-passing verdict and no manifest reroute. | Manifest snapshot, ledger, result, optional artifact existence. | Optional `dispatch_received`, `job_completed`, optional `artifact_written` only if declared artifact exists and is accepted. | None. | Yes. | Sync attachment. | `RuntimeNonAdvancingReceipt(outcome="worker_non_passing")`. | Exit 0 unless legacy golden says otherwise. | Output reports no route and `gate_passed=false`. | Non-passing verdict without reroute tests. |
| CO-REC-07 | `reconcile-dispatch` | Invalid completion=complete because declared artifact is missing. | Manifest snapshot, ledger, result, artifact path. | Optional receipt observation only if independently committed before artifact check; no `job_completed` complete event. | None. | Only if observation was committed. | Sync attachment only if materialized. | `RuntimeFailureReceipt(kind="missing_observed_file")`. | Exit 1. | Preserve missing declared artifact message. | Complete result missing artifact test. |
| CO-REC-08 | `reconcile-dispatch` | Transition success: passing verdict. | Manifest snapshot, ledger, result, artifact. | Optional `dispatch_received`, `job_completed`, `artifact_written`. | `gate_passed`, next `step_started`. | Yes. | Sync attachment. | `RuntimeSuccessReceipt(outcome="dispatch_reconciled")`. | Exit 0. | Preserve route/status output. | Passing verdict golden ledger/CLI test. |
| CO-REC-09 | `reconcile-dispatch` | Transition success: manifest reroute for non-passing verdict. | Manifest snapshot, ledger, result. | Optional `dispatch_received`, `job_completed`, optional `artifact_written`. | Routed `gate_failed`, next `step_started` or `run_completed`. | Yes. | Sync/clear according to route. | `RuntimeSuccessReceipt(outcome="dispatch_rerouted")` for step routes, or `RuntimeSuccessReceipt(outcome="terminal")` for terminal reroutes. | Exit 0 unless explicit migration decision says otherwise. | Output route reflects reroute target. | Reroute emits `gate_failed` test; no gate event without reroute. |
| CO-REC-10 | `reconcile-dispatch` | Terminal transition. | Same as CO-REC-08 or CO-REC-09. | Same as passing or reroute case. | `gate_passed` or `gate_failed`, then `run_completed`. | Yes. | Clear matching current-run attachment. | `RuntimeSuccessReceipt(outcome="terminal")`. | Exit 0. | Preserve terminal status mapping. | Terminal dispatch route tests. |

### 4.8 Abort Run

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-ABORT-01 | `abort-run` | Precondition failure: missing reason or missing run root. | Run root existence, manifest snapshot if present for diagnostics. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="precondition_failed")`. | Exit 1. | Preserve `--reason` and missing-root messages. | Abort precondition tests. |
| CO-ABORT-02 | `abort-run` | Corrupt ledger. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeFailureReceipt(kind="runtime_corrupt")`. | Exit 1. | Error says replay failed; does not read `state.json` fallback. | Corrupt ledger abort test. |
| CO-ABORT-03 | `abort-run` | Stale or corrupt `state.json`. | Manifest snapshot, ledger. | None. | `run_aborted` if ledger projection is non-terminal. | Yes. | Clear matching current-run attachment. | `RuntimeSuccessReceipt(outcome="aborted")`. | Exit 0. | Output derives from replay, not poisoned state. | Poison state then abort test. |
| CO-ABORT-04 | `abort-run` | Already terminal/no-op by ledger projection. | Manifest snapshot, ledger. | None. | None. | Optional refresh only if public behavior is pinned. | No continuity change unless terminal materialization policy explicitly clears stale matching attachment. | `RuntimeNonAdvancingReceipt(outcome="already_terminal", noOp=true)`. | Exit 0. | Preserve `already_terminal=true`, `message`, `status`. | Already terminal abort test. |
| CO-ABORT-05 | `abort-run` | Terminal transition: explicit abort. | Manifest snapshot, ledger. | None. | `run_aborted`. | Yes. | Clear matching current-run attachment. | `RuntimeSuccessReceipt(outcome="aborted")`. | Exit 0. | Preserve abort output keys. | Abort golden ledger/CLI and continuity clear tests. |

### 4.9 Resume, Render, And Session Start

| Outcome id | Command or surface | Outcome | Reads | Observation events | Decision events | Projection writes | Continuity writes | Receipt kind | Public CLI exit behavior | Public CLI output compatibility | Test obligation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO-RESUME-01 | `resume` | Precondition failure: missing run root, missing manifest snapshot, or corrupt ledger. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeViewFailure(kind="precondition_failed" or "runtime_corrupt")`. | Exit 1. | Preserve `reason`, `resume_step`, `status` on success; failure stderr pinned. | Resume corrupt/missing tests. |
| CO-RESUME-02 | `resume` | Read-only success. | Manifest snapshot, ledger. | None. | None. | None. | None. | `RuntimeView`. | Exit 0. | Preserve keys `reason`, `resume_step`, `status`. | Effect test proves no file writes, including no `state.json` refresh. |
| CO-RENDER-01 | `render` | Projection-only success. | Manifest snapshot, ledger, optional view-enrichment artifacts. | None. | None. | Yes. | No continuity write unless explicit attachment intent is supplied by a separate surface. | `RuntimeMaterializationReceipt(ok=true)`. | Exit 0. | Preserve keys `active_run_path`, `current_phase`, `next_step`, `status`. | Render appends no events; stale dashboard overwritten. |
| CO-RENDER-02 | `render` | Materialization failure. | Manifest snapshot, ledger. | None. | None. | Failed projection write reported. | No continuity write after failed projection prerequisite. | `RuntimeMaterializationReceipt(ok=false, failure.kind="projection_materialization_failed")`. | Exit 1. | Failure output pinned. | Inject write failure; ledger unchanged. |
| CO-SESSION-01 | Session-start active-run refresh | Pending continuity exists. | Continuity index and record. | None. | None. | None. | None. | `SessionStartReceipt(kind="pending_continuity_banner")`. | Exit 0. | Preserve pending continuity banner. | Session-start pending continuity test; no runtime materialization. |
| CO-SESSION-02 | Session-start active-run refresh | Stale current-run root missing. | Continuity index. | None. | None. | None. | Clear stale current-run attachment. | `SessionStartReceipt(kind="stale_current_run_cleared")` or `SessionStartReceipt(kind="welcome_banner")`. | Exit 0. | Preserve stale-current-run warning. | Missing run root clears current-run marker/index test. |
| CO-SESSION-03 | Session-start active-run refresh | Valid current-run with stale `active-run.md`. | Continuity index, manifest snapshot, ledger. | None. | None. | Yes, via `materialize`. | Sync current-run attachment from projection. | `SessionStartReceipt(kind="active_run_banner")`. | Exit 0. | Preserve current-run fallback banner. | Stale dashboard refreshed before banner test. |
| CO-SESSION-04 | Session-start active-run refresh | Corrupt continuity index. | Continuity index. | None. | None. | None. | None. | `SessionStartReceipt(kind="continuity_failure", failure.kind="continuity_index_invalid")`. | Exit/status pinned by session-start compatibility test. | Must not scan run roots or read active-run fallback as authority. | Corrupt index session-start test. |

## 5. Transaction Protocol

Every mutating runtime command uses this protocol. The shell MAY retry a failed
expected-revision append, but it MUST NOT reuse stale decision drafts.

```text
1. read manifest snapshot and ledger at revision N
2. project ledger into RuntimeProjection P0
3. observe command facts F0 with evidence tokens
4. plan observation batch O0 from command + P0 + F0
5. validate O0 event drafts exactly
6. commit O0 at expected revision N -> N+1
7. re-read ledger at revision N+1
8. re-project ledger into RuntimeProjection P1
9. verify evidence tokens still hold, or re-observe facts as F1
10. plan decision batch D1 from command + P1 + verified F1
11. validate D1 event drafts exactly
12. commit D1 at expected revision N+1 -> N+2
13. re-read ledger at final revision
14. re-project ledger into RuntimeProjection P2
15. materialize projections from P2
16. apply continuity attachment intent, if and only if the command is attached
17. return a typed receipt containing ledger outcome and materialization status
```

Special cases:

- Commands with no observation batch skip steps 3 through 9 and plan decisions
  from the initial projection.
- Observation-only commands stop after step 9, then materialize from P1.
- Failed preconditions stop before any append.
- Missing required local facts stop before any event that depends on the missing
  fact. Independently valid observations MAY already have committed only if the
  command-specific outcome matrix allows that ordering.
- Decision drafts planned from P0 MUST be discarded after O0 commits. Decisions
  are always planned from the post-observation projection P1.

### 5.1 Evidence Tokens

Ledger revision proves only ledger stability. Local facts need evidence tokens.

Each observed file fact MUST include:

- run-relative path
- existence bit
- file type if present
- byte size if present
- high-resolution mtime if available, otherwise mtime milliseconds
- content hash for any file whose contents influence planning
- parser version or schema id when JSON/text is parsed into a typed fact

Existence-only facts MAY omit content hash only when contents do not affect the
plan. Any response selection, worker completion, worker verdict, gate source, or
manifest source that affects a decision MUST include a content hash.

Before planning D1, the shell MUST either verify every decision-relevant token
or re-observe facts. If a token changes, the shell MUST re-observe and replan
from P1. It MUST NOT append a decision that was derived from stale file facts.

### 5.2 Required Traces

#### Observation-only command

```text
read ledger at N
project P0
observe request/result fact F0 with tokens
plan O0 and no D0
commit O0 at N -> N+1
project P1
materialize P1
return RuntimeNonAdvancingReceipt with appended O0
```

Examples: `request-checkpoint`, `dispatch-step`, receipt recovery, partial
worker result.

#### Observation then decision command

```text
read ledger at N
project P0
observe artifact/result/response facts F0
plan O0
commit O0 at N -> N+1
project P1
verify tokens or re-observe F1
plan D1 from P1 + F1
commit D1 at N+1 -> N+2
project P2
materialize P2
return RuntimeSuccessReceipt with appended O0 + D1
```

Examples: synthesis pass, checkpoint resolution, passing dispatch result.

#### Observation append succeeds; decision append expected-revision mismatch

```text
commit O0 at N -> N+1 succeeds
another writer appends at N+1 -> N+2
attempt to commit D1 at expected N+1 fails before writing
read ledger at N+2
project P2
re-observe or verify facts
replan decision from P2
either commit new decision at N+2 or return `RuntimeNonAdvancingReceipt` or
`RuntimeFailureReceipt`
```

The stale D1 batch is discarded.

#### Observation append succeeds; materialization fails

```text
commit O0 and maybe D1 succeeds
project final ledger
state/dashboard/continuity write fails
return receipt with ledger outcome intact and materialization.ok=false
retry materialize from final ledger appends no events
```

#### File fact changes between observation and decision

```text
observe response selection=A with hash H1
commit checkpoint_resolved observation if allowed
before route decision, response file hash becomes H2
token verification fails
re-observe response
if committed observation already recorded A, planner must use ledger P1 as
authority and must not route from uncommitted selection B
```

For response/result facts that are themselves committed observations, the ledger
fact becomes the decision input after O0 commits. A changed local file after O0
does not mutate the accepted observation; it requires a later explicit command
or retry path.

#### Retry after partial transaction

```text
first attempt commits O0 and fails before D1
retry reads ledger at N+1
project P1 sees O0 already accepted
observer may see same local files but planner does not duplicate O0
planner produces only valid remaining decision events, or no-op/non-advancing
```

Stable logical ids and idempotence keys MUST prevent duplicate observations for
the same step, attempt, and path.

Projection replay is a separate guardrail. When observations for the same
step and attempt arrive in a different order during recovery, `projectLedger`
must not regress an accepted job or checkpoint. Repeated request observations
may refresh request paths, but they must preserve richer receipt, result,
response, and selection fields. A different attempt remains a distinct job or
checkpoint row.

#### Bootstrap snapshot written but ledger append fails

```text
write manifest snapshot atomically
append run_started + step_started fails before writing any event line
return failure
retry reads manifest source and existing snapshot
if bytes match, reuse snapshot and retry append
if bytes differ, fail before append
```

Bootstrap snapshot is setup, not runtime authority. The ledger becomes
authoritative only after `run_started` commits.

#### Abort with stale or corrupt `state.json`

```text
read manifest snapshot and ledger
project current status from ledger
ignore state.json entirely
if projection terminal, return no-op
if projection non-terminal, append run_aborted
materialize fresh state.json
clear matching current-run attachment if attached
```

#### Session-start with stale `active-run.md` and valid continuity index

```text
read continuity index
if pending_record exists, print passive pending banner and do not materialize
else if current_run exists and run root exists:
  read manifest snapshot and ledger
  materialize active-run.md from projection
  print passive active-run banner
else print welcome
```

Session-start does not append events and does not select a run by scanning run
roots or parsing dashboard markdown.

## 6. Schema-Type Alignment

The runtime core TypeScript union MUST match the external event schema event
names exactly. TypeScript payload types are stricter than the current schema:
new runtime-core producers MUST emit only the fields listed below. Legacy
payload fields listed in the compatibility column may be read but MUST NOT be
emitted by new runtime-core code.

Canonical dispatch receipt decision:

- The canonical ledger event name is `dispatch_received`.
- There is no `dispatch_receipt_observed` ledger event in this migration.
- If an implementation keeps an internal plan/fact label named
  `dispatch_receipt_observed`, it MUST lower to `dispatch_received` before
  validation and append.

| Event type | TypeScript event interface name expected in runtime core | Commit class | Producer command | Projection behavior | Allowed payload fields for new producers | Forbidden payload fields for new producers | Legacy compatibility rules | Tests |
|---|---|---|---|---|---|---|---|---|
| `run_started` | `RunStartedEvent` | Decision | `bootstrap` | Initializes run id, selected entry mode, goal, git head, started/updated timestamps, and `initialized` status. | `manifest_path`, `entry_mode`, `head_at_start`, optional `goal`. | Worker fields, route fields, diagnostics, arbitrary extra payload keys. | No legacy variant. Unknown extra payload keys are ignored only for old ledgers if compatibility test names them. | Schema/type enum parity; bootstrap golden ledger. |
| `step_started` | `StepStartedEvent` | Decision | `bootstrap`, routed transitions | Sets `current_step` and `in_progress` status. | `step_id`. | Artifact, worker, checkpoint, diagnostics, arbitrary extra keys. | No legacy variant. | Exhaustive projection test for step start. |
| `dispatch_requested` | `DispatchRequestedEvent` | Observation | `dispatch-step` | Upserts job request and sets waiting-worker unless the same step/attempt already has a result. | `request_path`, `protocol`, `attempt`. | Adapter, transport, argv, diagnostics, raw request body. | No legacy variant for new producers; old payload extras do not affect planning. | Dispatch request exactness, replay, and multi-attempt projection tests. |
| `dispatch_received` | `DispatchReceivedEvent` | Observation | `dispatch-step`, `reconcile-dispatch` receipt recovery | Upserts job receipt and running/waiting-worker state unless the same step/attempt already has a result. | `receipt_path`, `exchange_id`, `attempt`. `step_id` is top-level event field, not payload. | `adapter`, `transport`, `resolved_from`, `runtime_boundary`, `diagnostics_path`, `warnings`, command argv, raw receipt JSON. | Legacy payload with `adapter`, `transport`, `resolved_from`, and `job_id` is accepted for projection; those fields are ignored by planning and never re-emitted. | Canonical no-transport-field, replay, and schema/type parity tests. |
| `job_completed` | `JobCompletedEvent` | Observation | `reconcile-dispatch` | Upserts job result, completion, verdict, and status; does not route by itself; absent verdict clears stale verdict. | `result_path`, `completion`, `attempt`, optional `verdict`. | Raw result JSON, adapter fields, route, diagnostics, arbitrary extra keys. | Old result shapes are parsed by `WorkerExchangeReader`, not copied into events. | Partial/blocked/nonpassing/passing and stale-verdict projection tests. |
| `artifact_written` | `ArtifactWrittenEvent` | Observation | `complete-synthesis`, checkpoint/dispatch commands when declared artifacts exist | Marks artifact complete with pending gate and producer step. | `artifact_path`, optional `schema`. | File contents, route, worker metadata, diagnostics, arbitrary extra keys. | No legacy variant. | Artifact observation idempotence and exact payload tests. |
| `gate_passed` | `GatePassedEvent` | Decision | `complete-synthesis`, `resolve-checkpoint`, `reconcile-dispatch` | Records route for step and marks produced artifacts gate pass. | `step_id`, `gate_kind`, `route`. | Observed file payloads, worker raw result, diagnostics, arbitrary extra keys. | Gate kind must be one of supported schema gate kinds. Unknown legacy gate kind is `runtime_corrupt` unless a compatibility row is added. | Gate pass route and terminal expansion tests. |
| `gate_failed` | `GateFailedEvent` | Decision | `complete-synthesis` or `reconcile-dispatch` only when manifest selects a concrete failure/reroute target | Records routed failure and marks produced artifacts gate fail. | `step_id`, `gate_kind`, `failure_reason`, `route`. | Generic error logs without route, raw worker result, diagnostics, arbitrary extra keys. | `gate_failed` is never a generic validation error. Legacy unrouted failures are corrupt unless explicitly allowed. | Reroute emits gate_failed; nonpassing without reroute emits no gate event. |
| `checkpoint_requested` | `CheckpointRequestedEvent` | Observation | `request-checkpoint` | Upserts checkpoint request and sets waiting-checkpoint unless the same step/attempt is already resolved. | `request_path`, `checkpoint_kind`, `attempt`. | Response selection, route, raw request JSON, diagnostics, arbitrary extra keys. | No legacy variant. | Checkpoint request exact payload, replay, and multi-attempt projection tests. |
| `checkpoint_resolved` | `CheckpointResolvedEvent` | Observation | `resolve-checkpoint` | Upserts checkpoint response and selection; does not route by itself. | `response_path`, `selection`, `attempt`. | Route, raw response JSON, diagnostics, arbitrary extra keys. | No legacy variant. | Checkpoint resolve exact payload and projection tests. |
| `run_completed` | `RunCompletedEvent` | Decision | Routed terminal transitions | Sets terminal status, terminal target, clears current step. | `status`, `terminal_target`, optional `diagnostic_path` for `@escalate`, optional `handoff_path` for `@handoff`. | Step route fields except top-level `step_id`, worker raw result, diagnostics except explicit path fields, arbitrary extra keys. | Status must match terminal target mapping. | Terminal route mapping tests for every terminal target. |
| `run_aborted` | `RunAbortedEvent` | Decision | `abort-run` | Sets aborted status, clears current step, records abort reason. | `reason`, `aborted_at`. | Continuity fields, state snapshot fields, diagnostics, arbitrary extra keys. | No legacy variant. | Abort projection and exact payload tests. |

### 6.1 Gate Kind Alignment

The manifest schema supports these gate kinds. Runtime core types MUST include a
closed `RuntimeGate` union covering every row.

| Gate kind | Manifest schema source | Runtime fact required | Legal commands | Pass rule | Failure or compatibility rule | Tests |
|---|---|---|---|---|---|---|
| `schema_sections` | `gate.source`, `required`, optional `alternate_source`, `alternate_required`. | `ObservedMarkdownSectionsFact` with evidence token and missing section list. | `complete-synthesis`. | Primary source satisfies required sections, or alternate source satisfies alternate/primary requirements. | If source is missing, no append. If source exists but fails, commit valid artifact observations only; emit `gate_failed` only if a concrete manifest failure route is selected. | Primary pass, alternate pass, missing source, missing sections, routed failure/no-routed-failure tests. |
| `checkpoint_selection` | `gate.source`, `allow`. | `CheckpointResponseFact` selection with evidence token. | `resolve-checkpoint`. | Selection is in `allow`; route key equals selected option unless a validated override matches. | Invalid selection appends nothing. Unknown route target appends nothing. | Allowed selection, invalid selection, route override, terminal route tests. |
| `result_verdict` | `gate.source`, `pass`, optional `reroute`. | `WorkerResultFact` completion/verdict with evidence token. | `reconcile-dispatch`. | Completion is `complete` and verdict is in `pass`. | Nonpassing verdict with `reroute[verdict]` emits routed `gate_failed`; nonpassing without reroute emits no gate event. Partial/blocked are observation-only. | Passing, partial, blocked, nonpassing, reroute tests. |
| `all_outputs_present` | `required_paths`. | `OutputPresenceFact` for every required path with evidence token. | `complete-synthesis`; future dispatch reconciliation only if manifest uses the gate. | Every required path exists and is a safe run-relative path. | Missing output is non-advancing/failure with valid observations only. A routed `gate_failed` requires an explicit manifest failure route. | All present, one missing, unsafe path rejected, no generic gate_failed tests. |
| `option_count` | `gate.source`, `minimum`. | `OptionCountFact` with parsed count and evidence token. | `complete-synthesis` for decision/option artifacts. | Parsed option count is at least `minimum`. | Source missing appends nothing. Count below minimum commits valid observations only and does not route unless a failure route is explicit. | Minimum met, below minimum, malformed options, source changed token tests. |

Unsupported or legacy gate kinds:

- The current manifest schema rejects unknown gate kinds. A live manifest with an
  unknown gate kind is `manifest_invalid`.
- A historical ledger event with an unknown `gate_kind` is `runtime_corrupt`
  unless a specific compatibility row is added to this section.
- A planner MUST NOT implement a catch-all gate handler.

## 7. Type Skeleton Requirements

Before any behavior migration, the repo MUST add a compiling type-only skeleton
under:

```text
scripts/runtime/engine/src/runtime-core/types.ts
```

The skeleton must compile without changing runtime behavior. It proves the
contract before implementation. The minimum proof obligations are:

1. `RuntimeCommand` is a closed discriminated union.
2. `RuntimeViewCommand` is separate from mutating `RuntimeCommand`.
3. Each command has its own plan type:
   `BootstrapPlan`, `CompleteSynthesisPlan`, `CheckpointRequestPlan`,
   `CheckpointResolvePlan`, `DispatchRequestPlan`, `DispatchReconcilePlan`,
   and `AbortPlan`.
4. Each command plan permits only legal observation drafts and decision drafts
   from the table below.
5. Observation drafts and decision drafts are separate types and cannot be
   accidentally concatenated without preserving `commitClass`.
6. Worker facts cannot expose raw transport payloads, adapter ids, transport
   names, argv, fallback details, diagnostics paths, or warning arrays.
7. Failure kinds are closed. The exact `RuntimeFailureKind` union is:
   `precondition_failed`, `missing_observed_file`, `invalid_observed_file`,
   `gate_failed`, `route_invalid`, `worker_non_passing`, `worker_partial`,
   `worker_blocked`, `runtime_corrupt`, `projection_materialization_failed`,
   `manifest_invalid`, `expected_revision_mismatch`, and
   `ledger_append_failed`. Adding any failure kind requires updating this
   packet and the schema/type parity tests in the same change.
8. Materialization status is separate from ledger outcome.
9. Continuity attachment intent is separate from projection materialization.
10. Planner-visible core types do not use arbitrary
    `Record<string, unknown>` or raw JSON escape hatches. Unknown JSON is
    allowed only at schema/adapter boundaries and must be narrowed before
    entering planner-visible types.

Allowed event drafts by command:

| Command plan | Allowed observation drafts | Allowed decision drafts |
|---|---|---|
| `BootstrapPlan` | None. | `run_started`, initial `step_started`. |
| `CompleteSynthesisPlan` | `artifact_written`. | `gate_passed`, routed `gate_failed`, next `step_started`, `run_completed`. |
| `CheckpointRequestPlan` | `artifact_written`, `checkpoint_requested`. | None. |
| `CheckpointResolvePlan` | `checkpoint_resolved`. | `gate_passed`, routed `gate_failed`, next `step_started`, `run_completed`. |
| `DispatchRequestPlan` | `artifact_written`, `dispatch_requested`, canonical `dispatch_received`. | None. |
| `DispatchReconcilePlan` | canonical `dispatch_received`, `job_completed`, `artifact_written`. | `gate_passed`, routed `gate_failed`, next `step_started`, `run_completed`. |
| `AbortPlan` | None. | `run_aborted`. |

Type quarantine rule:

```ts
// Allowed only outside planner-visible types.
export interface RuntimeDiagnosticDetails {
  readonly source:
    | "schema"
    | "adapter"
    | "worker_exchange"
    | "store"
    | "continuity"
    | "cli";
  readonly details: Readonly<Record<string, unknown>>;
}
```

`RuntimeDiagnosticDetails` is the only raw diagnostics quarantine. No other
planner-visible type may contain `Record<string, unknown>`, `unknown`, `any`, or
a `raw` field unless the proof packet is updated with a specific reason and
test.

Required type tests:

- `runtime-core/types.test-d.ts` or equivalent compile-only tests prove illegal
  event draft combinations fail.
- A ratchet scans planner-visible runtime-core files for forbidden `Record`,
  `unknown`, `any`, and `raw` fields outside the diagnostics quarantine.
- A schema parity test enumerates every event type in `schemas/event.schema.json`
  and every TypeScript event union member.

## 8. Import Boundary Rules

Runtime core implementation modules MUST obey these import rules. Ratchet tests
must enforce them before behavior migration.

| Module | Allowed imports | Forbidden imports | Ratchet test |
|---|---|---|---|
| `runtime-core/project-ledger.ts` | `./types`, pure manifest topology helpers with no filesystem/schema/CLI side effects. | `node:*`, `fs`, schema validators, CLI, renderer, continuity, dispatch, invocation ledger, old command modules. | Import scan fails on forbidden modules and on any filesystem import. |
| `runtime-core/observe-facts.ts` | `./types`, read-only store ports, `WorkerExchangeReader`, pure path constructors. | Commit port, renderer, continuity, CLI, dispatch transport, invocation ledger, old command modules. | Effect-spy test proves read-only deps; import scan forbids write-capable deps. |
| `runtime-core/plan-command.ts` | `./types`, pure manifest helpers, pure gate evaluators over typed facts. | `fs`, `node:*`, continuity, renderer, CLI, dispatch, schemas directly, invocation ledger, command-specific mini-runtime modules. | Import scan plus type test proving planner takes only command/projection/facts. |
| `runtime-core/commit-ledger.ts` | `./types`, runtime schema validation, `RuntimeStore.appendEvents`, clock/id ports. | Renderer, continuity, CLI, worker transport, invocation ledger, state/dashboard writers, old append helpers that append per event. | Effect-spy test proves only appendEvents called; import scan forbids projection/continuity writes. |
| `runtime-core/materialize-view.ts` | `./types`, projection writers, active-run renderer, `ContinuityPort` attachment methods. | Event append, command planner, observed fact readers as command inputs, worker transport, invocation ledger, CLI printing. | Test proves no append; import scan forbids commit/planner imports. |
| `runtime-core/index.ts` | Runtime-core seams and dependency composition only. | Command-specific mini-runtime modules after their migration slice completes. | Slice ratchet shrinks wrapper allowlist. |
| CLI presenter modules | `RuntimeReceipt` types and presenter helpers. | Store, filesystem writes, continuity writers, command-specific execution modules after migration. | Presenter tests use receipts without temp filesystem. |
| `cli/circuit-engine.ts` after migration | Argument parsing, command construction, runtime shell, presenter, continuity command as sibling. | Direct imports of `bootstrap.ts`, `checkpoint-step.ts`, `complete-synthesis.ts`, `dispatch-step.ts`, `abort-run.ts`, `render-active-run.ts`, `resume.ts` after corresponding slice is complete. | Per-slice import ratchet. |
| Dispatch transport modules | Adapter execution, local receipt/result writing, diagnostics. | Runtime core planner and command decision modules. | Import scan forbids `runtime-core/plan-command` and planner types except neutral exchange schemas if explicitly allowed. |

Old command-specific mini-runtime modules include:

```text
bootstrap.ts
checkpoint-step.ts
complete-synthesis.ts
dispatch-step.ts
abort-run.ts
resume.ts
render-active-run.ts
command-support.ts
derive-state.ts as a state authority for commands
```

They may remain as compatibility wrappers during migration, but runtime-core
modules MUST NOT import them.

## 9. Migration Gate Checklist

A slice is not complete merely because helper-level tests were deleted. A slice
is complete only when all universal gates and its slice-specific gates are
satisfied.

Universal gates for every migration slice:

| Gate id | Requirement | Evidence required |
|---|---|---|
| MG-U1 | Old CLI behavior pinned first. | Golden stdout, stderr, JSON output, and exit status for the old command before routing changes. |
| MG-U2 | Boundary test added. | Test through `CircuitRuntime.execute`, `inspect`, or `materialize`, not only helper functions. |
| MG-U3 | Golden ledger output compared with old command. | Normalized ids/timestamps; event order and payload exactness compared. |
| MG-U4 | Side effects pinned. | Expected writes to ledger, state, dashboard, continuity, invocation ledger, and worker files are asserted. |
| MG-U5 | Old command wrapper thinned. | Wrapper becomes argument mapping plus presenter call, or an explicit compatibility wrapper with shrinking allowlist. |
| MG-U6 | Direct old helper access banned or reduced. | Import ratchet updated for the slice. |
| MG-U7 | Docs updated only after behavior is pinned. | PR order or commit order shows tests first, docs second. |
| MG-U8 | Helper-level tests deleted only after equivalent boundary/golden tests exist. | Deleted test names mapped to replacement boundary tests. |

Migration slices:

| Slice | Scope | Extra gates |
|---|---|---|
| M0 | Type-only `runtime-core/types.ts` skeleton. | Compile-only type tests; schema/type event parity test; planner-visible raw/record ratchet. |
| M1 | `projectLedger` foundation. | Projection parity with current `derive-state`; no state/dashboard/continuity reads; exhaustive event switch. |
| M2 | Batch append and `commitLedgerPlan`. | Draft stamping test; schema-invalid append rejection; atomic batch append test; in-memory store expected-revision mismatch test; no per-event append loop. |
| M3 | `CircuitRuntime.inspect` and `resume`. | Read-only `inspectRuntimeView` seam has no write-capable deps; `inspect` writes nothing; resume CLI golden output; corrupt `state.json` ignored before routing `resume`. |
| M4 | `CircuitRuntime.materialize`, `render`, and session-start refresh. | Projection and continuity statuses stay separate; render appends nothing; session-start pending continuity does not materialize; valid current-run refreshes dashboard. |
| M5 | `abort-run`. | Decision-only abort planning; abort derives from ledger, ignores corrupt/stale `state.json`, clears matching current-run only, and preserves public CLI output. |
| M6 | `bootstrap`. | Snapshot retry safety; invocation ledger side effects pinned; attached/detached continuity behavior pinned. |
| M7 | `complete-synthesis`. | Observation and decision batches separated; invalid gate commits only allowed observations; terminal routes covered. |
| M8 | Checkpoint request and resolve. | Request is observation-only; resolve reprojects after `checkpoint_resolved`; invalid selection appends nothing. |
| M9 | Worker exchange reader and canonical dispatch receipt event. | Worker facts are transport-neutral; canonical `dispatch_received` has no adapter fields; legacy event projection compatibility. |
| M10 | Dispatch request and reconcile. | No worker execution from runtime core; partial/blocked/nonpassing/reroute/passing/terminal outcomes covered. |
| M11 | Wrapper closeout. | CLI no longer imports migrated command modules; old helpers either deleted or documented as compatibility-only with ratchets. |

## 10. Review Rubric

The runtime-core spec is not ready for implementation review if any of these
are true:

1. Any runtime command outcome lacks an event/projection/continuity/receipt row
   in Section 4.
2. Any event exists in `schemas/event.schema.json` but not in Section 6.
3. Any planner-visible type includes arbitrary `Record<string, unknown>`,
   `unknown`, `any`, `raw`, or raw worker payloads outside the diagnostics
   quarantine.
4. Any side effect is allowed by prose but missing from Section 3.
5. Any public CLI behavior changes without a golden test obligation or explicit
   migration decision.
6. Any prior finding in Section 1 is closed only by explanatory prose.
7. Any runtime-core module can import old command-specific mini-runtime code.
8. Any retry or partial-failure path cannot be traced deterministically through
   Section 5.
9. Any continuity mutation is hidden inside generic projection language instead
   of passing through explicit attachment intent.
10. Any worker transport field appears in canonical event drafts or
    planner-visible worker facts.

Mechanical review procedure:

1. Diff `schemas/event.schema.json` against Section 6. Every event enum value
   must have a row and a TypeScript interface.
2. Diff public runtime methods and internal seams against Section 3. Every yes
   cell must have an owner and a test.
3. Diff runtime artifacts touched by code against Section 2. Every read/write
   must be owned.
4. For each migrated command, find its Section 4 rows and check the golden CLI,
   golden ledger, side-effect, and boundary tests named by the migration slice.
5. Run import ratchets from Section 8.
6. Run type skeleton ratchets from Section 7.
7. Pick one partial-failure path and trace it through Section 5. If the trace
   requires guessing, the spec is not closed.
