# Runtime Core Implementation Decisions

Status: Proposed implementation companion to
`runtime-core-architecture-spec.md` and `runtime-core-proof-packet.md`

Audience: migration authors implementing runtime-core slices M1 through M4

Decision bar: close the remaining design questions that affect port shape,
retry safety, and materialization failure reporting before behavior migration.

This note is subordinate to the proof packet. If this note conflicts with
`runtime-core-proof-packet.md`, the proof packet wins.

## 1. Scope

The type-only runtime-core skeleton proves the command, event, receipt, and
boundary vocabulary. Three implementation choices remain before migrating
behavior:

1. How narrow should the runtime-core ports be?
2. How should event identity and idempotence work across retries?
3. How should continuity attachment failures be reported without confusing
   ledger outcome and materialization status?

The recommended path below avoids new schema fields unless a later slice proves
they are necessary.

## 2. Port Shape

### Options

| Option | Shape | Strength | Weakness |
|---|---|---|---|
| A. Monolithic `RuntimeDeps` | Every runtime function receives one broad dependency object. | Easy to thread through early code. | Blurs read, append, render, continuity, and shell authority. Ratchets become weaker because every function can see too much. |
| B. Narrow authority ports | Each runtime function receives only the read or write capability it owns. | Matches the proof packet, makes effect tests simple, and keeps imports honest. | More interfaces and more composition work in `node-runtime-deps.ts`. |
| C. Module-local adapters | Each module imports concrete Node helpers directly. | Lowest upfront ceremony. | Recreates command-specific mini-runtimes and defeats import-boundary ratchets. |

### Decision

Use **Option B: narrow authority ports**.

`node-runtime-deps.ts` may assemble a larger dependency object for the shell, but
kernel functions should accept only the capability they need:

| Port | Owner | Capability |
|---|---|---|
| `ManifestSnapshotReader` | runtime shell | Read the run-root manifest snapshot. |
| `ManifestSourceReader` | bootstrap shell path | Read and validate the source manifest before snapshot creation. |
| `ManifestSnapshotWriter` | bootstrap shell path | Atomically write the manifest snapshot before the first ledger append. |
| `InspectRuntimeViewDeps` | `inspectRuntimeView` only | Read the manifest snapshot and event ledger; no projection, continuity, append, invocation, worker, or CLI capabilities. |
| `RuntimeEventLedgerReader` | runtime shell and inspect/materialize shell | Read `events.ndjson` and return events plus current revision. |
| `RuntimeEventLedgerAppender` | `commitLedgerPlan` only | Append one all-or-nothing batch at an expected revision. |
| `ObservedFileReader` | `observeRuntimeFacts` only | Stat/read local observed files and produce evidence tokens. |
| `WorkerExchangeReader` | `observeRuntimeFacts` only | Parse worker request, receipt, and result files into transport-neutral facts. |
| `ProjectionWriter` | `materializeRuntimeView` only | Write `state.json` from a projection. |
| `ActiveRunRenderer` | `materializeRuntimeView` only | Render and write `artifacts/active-run.md`. |
| `ContinuityPort` | `materializeRuntimeView` only | Sync or clear current-run attachment, never pending records. |
| `Clock` | shell or commit module | Produce timestamps for event construction. |
| `IdGenerator` | shell or commit module | Produce event ids after drafts are validated. |
| `HashPort` | `observeRuntimeFacts` only | Hash content that influences planning. |

The implementation should keep read and write sides separate even when the Node
adapter uses the same file internally. For example, reading the ledger and
appending to it are different ports.

## 3. Event Identity And Idempotence

### Options

| Option | Shape | Strength | Weakness |
|---|---|---|---|
| A. Deterministic `event_id` | Derive `event_id` from the event's idempotence key. | Easy to spot duplicate logical events in the ledger. | Overloads event identity, gets awkward for legal repeated events, and may force key changes into public ledger semantics. |
| B. Random `event_id`, deterministic draft idempotence key | Keep `event_id` as an append occurrence id. Use deterministic draft keys and projection natural keys to avoid duplicates. | Avoids schema churn, keeps event identity simple, and matches the current type skeleton. | Requires disciplined planner/projection duplicate checks. The idempotence key is not directly visible in the ledger. |
| C. Persist `idempotence_key` in every event | Add an explicit schema field and make the store reject duplicates. | Strongest ledger-level enforcement. | Requires schema and compatibility migration before behavior migration, and expands every canonical event. |

### Decision

Use **Option B: random `event_id`, deterministic draft idempotence key** for the
first behavior migration slices.

`event_id` remains an opaque append occurrence id. It may be random or otherwise
store-generated. It is not the logical idempotence key.

Every event draft still carries an `idempotenceKey`. The planner uses that key
to deduplicate drafts in the current plan, and it must derive the key with
`runtimeEventDraftNaturalKey` or `withRuntimeEventDraftNaturalKey`. The shell
re-reads and re-projects the ledger after each successful observation batch.
After re-projection, the planner must use canonical ledger facts, not local
files, to avoid re-emitting already accepted observations.

The canonical ledger does not need a new field for M1 through M3 because the
natural key is reconstructable from existing event fields.

Recommended natural keys:

| Event | Natural key |
|---|---|
| `run_started` | `run_id + event_type` |
| initial `step_started` | `run_id + event_type + step_id + bootstrap` |
| routed `step_started` | `run_id + event_type + predecessor_step_id + route + step_id` |
| `dispatch_requested` | `run_id + step_id + event_type + attempt + request_path` |
| `dispatch_received` | `run_id + step_id + event_type + attempt + receipt_path` |
| `job_completed` | `run_id + step_id + event_type + attempt + result_path` |
| `artifact_written` | `run_id + step_id + event_type + artifact_path` |
| `gate_passed` | `run_id + step_id + event_type + gate_kind + route` |
| `gate_failed` | `run_id + step_id + event_type + gate_kind + route` |
| `checkpoint_requested` | `run_id + step_id + event_type + attempt + request_path` |
| `checkpoint_resolved` | `run_id + step_id + event_type + attempt + response_path` |
| `run_completed` | `run_id + event_type + terminal_target` |
| `run_aborted` | `run_id + event_type` |

Two rules follow from this decision:

1. Local file content hashes belong in evidence tokens, not in idempotence keys,
   unless the accepted event payload itself records the content-derived value.
2. If M2 finds that projection-level duplicate prevention is not enough, move to
   Option C deliberately by updating the event schema, type union, proof packet,
   and compatibility tests in the same change.

## 4. Continuity Attachment Failure Reporting

### Options

| Option | Shape | Strength | Weakness |
|---|---|---|---|
| A. New failure kind | Add `continuity_attachment_failed`. | Precise. | Violates the closed failure-kind union unless the proof packet and tests change. |
| B. Materialization failure with continuity diagnostics | Keep ledger outcome intact. Set `materialization.ok=false`, `failure.kind="projection_materialization_failed"`, and `diagnostics.source="continuity"`. | Matches the proof packet and keeps continuity outside ledger authority. | The failure kind is broader than the low-level cause. |
| C. Ignore attachment failure after projection writes | Return success and log diagnostics. | Simple public behavior. | Hides a user-visible attachment failure and weakens retry semantics. |

### Decision

Use **Option B: materialization failure with continuity diagnostics**.

Continuity attachment is part of materialization status, not ledger outcome. A
command that successfully appends events keeps its success, non-advancing, or
failure receipt. If current-run sync or clear fails, the receipt reports:

```text
materialization.ok = false
materialization.failure.kind = "projection_materialization_failed"
materialization.failure.diagnostics.source = "continuity"
materialization.continuityStatus = "failed"
```

The materializer must not append compensating events. Retrying `materialize`
from the same ledger revision is the recovery path.

## 5. Implementation Gates

Before M1 starts:

- Add the port interfaces to `runtime-core/types.ts` or a dedicated
  `runtime-core/ports.ts` if the type file is becoming too large.
- Keep import ratchets pointed at the future module names from the proof packet.
- Keep `runtime-core/project-ledger.ts` on the exhaustive handler-map harness so
  every `RuntimeEvent["event_type"]` has a projection slot before behavior lands.

Before M2 starts:

- Keep `runtime-core/idempotence.ts` covered for every event type before append
  behavior consumes natural keys. Draft-level keys and committed-event keys must
  stay in parity.
- Keep `projectLedger` replay tests covering same-attempt request/receipt/result
  upserts and separate rows for distinct attempts before planner retry logic
  consumes the projection.
- Add planner tests proving retry after a committed observation does not produce
  duplicate observation drafts.
- Keep append tests proving expected-revision mismatch writes nothing through
  both `commitLedgerPlan` failure pass-through and the in-memory ledger store.

Before M4 starts:

- Add materialization tests for state write failure, dashboard write failure, and
  continuity sync/clear failure.
- Assert that all three failures leave the ledger outcome unchanged and surface
  only through `RuntimeMaterializationStatus`.

## 6. Remaining Reopen Triggers

Reopen these decisions only if one of the following happens:

- A legal workflow requires repeating the same natural key within one run.
- Cross-process retry tests cannot be made deterministic without a persisted
  idempotence key.
- CLI compatibility requires a distinct continuity failure exit or JSON shape.
- The port count becomes high enough that tests stop proving meaningful effect
  ownership.
