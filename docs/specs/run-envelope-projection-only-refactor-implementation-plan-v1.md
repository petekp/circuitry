# Run Envelope Projection-Only Refactor Implementation Plan V1

Status: Implementation plan. Not current behavior.
Date: 2026-05-28

## Goal

Make the source Run envelope writer consume written `ProcessEvidenceProjection`
data only. Runtime-shaped child data should be adapted by process evidence and
sequenced by the CLI before the envelope writer runs.

This is a low-level plan for implementing
[run-envelope-projection-only-refactor-plan-v1.md](run-envelope-projection-only-refactor-plan-v1.md).
Do not use this plan to change public Run behavior, generated host surfaces, old
Goal artifact readability, checkpoint resume authority, hint-only memory rules,
host-native skill roots, or runtime-kernel ownership.

## Current Source Evidence

| Area | Evidence | Meaning |
| --- | --- | --- |
| High-level plan | `docs/specs/run-envelope-projection-only-refactor-plan-v1.md:8-15` | The target is boundary cleanup, not operator behavior change. |
| Current envelope leak | `src/run-envelope/source-record.ts:4-13` | Source writer imports projectors, writer, path constant, and `RunResult`. |
| Current input leak | `src/run-envelope/source-record.ts:32-70` | Source writer accepts `ClosedChild` and `CheckpointWaitingChild`. |
| Current adapter-in-envelope | `src/run-envelope/source-record.ts:506-534` | Source writer builds and writes process evidence internally. |
| Projection-owned adapter | `src/process-evidence/projection.ts:120-213` | Process evidence already owns closed and checkpoint projection builders plus writer. |
| Summary gap | `src/run-envelope/source-record.ts:668-673` | Source writer still reads `input.child.runResult.summary`. |
| Trace ref guarantee | `src/schemas/process-evidence.ts:49-56` | Projection parse requires `child_run_ref.kind === 'trace'`. |
| Checkpoint projection rule | `src/schemas/process-evidence.ts:96-111` | Checkpoint-waiting projections cannot have a result ref and must have checkpoint metadata. |
| Closed projection rule | `src/schemas/process-evidence.ts:114-127` | Closed projections require result refs and cannot carry checkpoint metadata. |
| Run attempt summary required | `src/schemas/run-envelope.ts:169-205` | Run attempts require a non-empty `summary`. |
| Run completion guard | `src/schemas/run-envelope.ts:477-612` | Envelope schema already prevents false complete, bad checkpoint packets, and non-complete completion wording. |
| CLI resume call site | `src/cli/circuit.ts:773-787` | Checkpoint resume passes a closed child to the source writer. |
| CLI checkpoint call site | `src/cli/circuit.ts:973-998` | Fresh checkpoint waiting passes raw checkpoint data to the source writer. |
| CLI closed call site | `src/cli/circuit.ts:1065-1083` | Fresh closed run passes a closed child to the source writer. |
| Output fields | `src/cli/run-output.ts:48-59` | Public stdout fields can remain stable if the result shape is preserved. |
| Shadow exception | `src/run-envelope/shadow-record.ts:1-185` | Shadow writer is runtime-shaped migration aid and should stay out of source ratchets. |
| Current source tests | `tests/runner/run-envelope-source-writer.test.ts:43-294` | Tests currently feed runtime-shaped children into the source writer. |
| Process evidence tests | `tests/contracts/process-evidence-projection-schema.test.ts:46-217` | Projection tests already cover public processes, checkpoint waiting, and private-report rejection. |
| Safety ratchets | `tests/contracts/run-centered-v1-safety.test.ts:52-67` | Existing boundary tests need to get stricter after the refactor. |
| Generated surface rules | `docs/generated-surfaces.md:7-18` | Edit source files, not generated host outputs, unless normal drift workflow requires regeneration. |
| Migration invariant | `docs/specs/run-centered-v1-migration-ledger.md:20-26` | Preserve flows, runtime kernel, run folders, generated surfaces, checkpoints, hint-only memory, and agent/operator balance. |

## Target Data Flow

```text
runtime result or checkpoint
  -> process-evidence projector
  -> process-evidence writer
  -> source Run envelope writer
  -> run envelope record, decision packets, compact surface
  -> CLI stdout fields
```

After this refactor:

- `src/process-evidence/projection.ts` may still import `RunResult`, flow catalog
  helpers, and filesystem helpers.
- `src/cli/circuit.ts` may still parse `RunResult` and sequence runtime,
  projection, operator summary, shadow writer, source writer, and stdout.
- `src/run-envelope/source-record.ts` must not import `RunResult`, runtime
  modules, flow catalog helpers, process-evidence projector functions, or the
  process-evidence writer.
- `src/run-envelope/shadow-record.ts` may temporarily keep runtime-shaped input.
  That exception must not leak into the source writer.

## Slice 1: Move The Process Evidence Path Constant And Add Summary

### Files

- `src/schemas/process-evidence.ts`
- `src/process-evidence/projection.ts`
- `tests/contracts/process-evidence-projection-schema.test.ts`
- `tests/contracts/schemas-barrel.test.ts` only as verification, not edit target.

### Edits

1. In `src/schemas/process-evidence.ts`, add the neutral path constant near the
   top-level schema exports:

   ```ts
   export const PROCESS_EVIDENCE_RELATIVE_PATH = 'reports/process-evidence.json';
   ```

2. In `src/schemas/process-evidence.ts`, add a required summary field to
   `ProcessEvidenceProjection`:

   ```ts
   summary: z.string().min(1),
   ```

   Put it near `outcome` or `missing_evidence`. Keep the schema strict.

3. In `src/process-evidence/projection.ts`, import
   `PROCESS_EVIDENCE_RELATIVE_PATH` from `../schemas/process-evidence.js`
   alongside `ProcessEvidenceProjection`.

4. Remove the local
   `export const PROCESS_EVIDENCE_RELATIVE_PATH = 'reports/process-evidence.json';`
   from `src/process-evidence/projection.ts`.

5. In `projectClosedProcessEvidence`, include:

   ```ts
   summary: input.runResult.summary,
   ```

   Use the child result summary directly for all closed outcomes. Do not special
   case `complete`, `handoff`, `aborted`, `stopped`, or `escalated` here.

6. In `projectCheckpointWaitingProcessEvidence`, add:

   ```ts
   summary: 'Selected process is waiting for an operator checkpoint choice.',
   ```

   Keep this exact text because the current source writer already uses it for
   checkpoint-waiting Run attempt summaries.

7. In `tests/contracts/process-evidence-projection-schema.test.ts`, change the
   path constant import so it comes from `../../src/schemas/process-evidence.js`.
   Keep the projector and writer imports from
   `../../src/process-evidence/projection.js`.

8. Add summary assertions:

   - In the public runtime process loop, assert
     `projection.summary === `${pkg.id} completed.``.
   - In the aborted review test, assert
     `projection.summary === 'Review aborted before writing the private result report.'`.
   - In the checkpoint-waiting test, assert
     `projection.summary === 'Selected process is waiting for an operator checkpoint choice.'`.

9. Add a non-complete closed-outcome table test. Use one test with cases for
   `handoff`, `aborted`, `stopped`, and `escalated`.

   Expected outcome mapping:

   | RunResult outcome | Process evidence outcome |
   | --- | --- |
   | `handoff` | `handoff` |
   | `aborted` | `aborted` |
   | `stopped` | `blocked` |
   | `escalated` | `blocked` |

   For every case, prove:

   - `projection.summary` equals the original `RunResult.summary`;
   - `projection.missing_evidence[0]?.reason` uses
     `runResult.reason ?? runResult.summary`;
   - for `stopped` and `escalated`, `projection.blocked_reason` also uses
     `runResult.reason ?? runResult.summary`;
   - for `handoff` and `aborted`, `projection.blocked_reason` stays undefined.

### Expected Behavior

No public output changes. Process evidence JSON gains one required `summary`
field and still validates all existing evidence rules.

### Focused Verification

```bash
npm run test -- tests/contracts/process-evidence-projection-schema.test.ts tests/contracts/schemas-barrel.test.ts
npm run check
npm run lint
```

### Rollback

Remove `summary` and move `PROCESS_EVIDENCE_RELATIVE_PATH` back to
`src/process-evidence/projection.ts`. Revert the test assertions. Do this only
before later slices depend on the new source writer input.

## Slice 2: Change Source Writer Input To Written Projection

### Files

- `src/run-envelope/source-record.ts`
- `tests/runner/run-envelope-source-writer.test.ts`

### Edits In `src/run-envelope/source-record.ts`

1. Replace the import from `../process-evidence/projection.js` with a neutral
   schema import that includes both the Zod parser value and the inferred type:

   ```ts
   import {
     PROCESS_EVIDENCE_RELATIVE_PATH,
     ProcessEvidenceProjection,
     type ProcessEvidenceProjection as ProcessEvidenceProjectionValue,
   } from '../schemas/process-evidence.js';
   ```

2. Remove these imports:

   - `projectCheckpointWaitingProcessEvidence`;
   - `projectClosedProcessEvidence`;
   - `writeProcessEvidenceProjection`;
   - `type RunResult`.

3. Delete the `ClosedChild` and `CheckpointWaitingChild` types.

4. Add a written projection input type near `SelectedProcess`:

   ```ts
   type WrittenProcessEvidence = {
     // Absolute filesystem path returned by writeProcessEvidenceProjection.
     readonly path: string;
     readonly projection: ProcessEvidenceProjectionValue;
   };
   ```

5. Change `WriteRunEnvelopeRecordInput`:

   ```ts
   export type WriteRunEnvelopeRecordInput = {
     readonly runFolder: string;
     readonly operatorIntent: string;
     readonly selectedProcess: SelectedProcess;
     readonly processEvidence: WrittenProcessEvidence;
     readonly recordedAt: string;
     readonly memoryContext?: MemoryContextInput;
     readonly memoryUpdates?: readonly MemoryUpdateInput[];
   };
   ```

6. Delete `buildProjection`.

7. Add a helper after `runRelativePath`:

   ```ts
   function childRunIdFromProjection(projection: ProcessEvidenceProjectionValue): RunId {
     return RunId.parse(projection.child_run_ref.run_id);
   }
   ```

   The schema already enforces trace refs, but the helper keeps every call site
   obvious and removes fallback run ids.

8. At the start of `writeRunEnvelopeRecord`, replace projection construction with
   validation of the provided projection:

   ```ts
   const projection = ProcessEvidenceProjection.parse(input.processEvidence.projection);
   const processEvidencePath = input.processEvidence.path;
   const childRunId = childRunIdFromProjection(projection);
   ```

   `processEvidencePath` should be the absolute path returned by
   `writeProcessEvidenceProjection`. Do not pass the run-relative
   `reports/process-evidence.json` path unless `evidenceFileRef` is also changed
   to resolve relative paths before hashing the file.

9. Change the `evidenceFileRef` input type so `runId` can accept the parsed
   `RunId` helper result:

   ```ts
   function evidenceFileRef(input: {
     readonly runFolder: string;
     readonly path: string;
     readonly runId: string | RunId;
     readonly flowId: string;
   }): Ref {
     ...
   }
   ```

10. Build `processEvidence` from `processEvidencePath`:

   ```ts
   const processEvidence = evidence(
     'process_evidence',
     evidenceFileRef({
       runFolder: input.runFolder,
       path: processEvidencePath,
       runId: childRunId,
       flowId: projection.flow_id as unknown as string,
     }),
   );
   ```

11. Replace every fallback zero UUID use with `childRunId`:

    - missing-evidence decision packet resume target currently at
      `src/run-envelope/source-record.ts:352-354`;
    - checkpoint decision packet resume target currently at
      `src/run-envelope/source-record.ts:377-379`;
    - decision packet artifact input currently at
      `src/run-envelope/source-record.ts:566-568`.

    The cleanest implementation is to pass `childRunId` into
    `decisionPacketsFor`:

    ```ts
    function decisionPacketsFor(input: {
      readonly projection: ProcessEvidenceProjectionValue;
      readonly processEvidence: RunEvidenceRef;
      readonly childRunId: RunId;
      readonly missingEvidence?: MissingRunEvidence;
    }): RunEnvelopeRecordValue['decision_packets'] {
      ...
      resume_target: { kind: 'run-envelope', run_id: input.childRunId }
      ...
      resume_target: { kind: 'process-checkpoint', run_id: input.childRunId, ... }
    }
    ```

12. Replace the process attempt summary branch at current
    `src/run-envelope/source-record.ts:668-673` with:

    ```ts
    summary: projection.summary,
    ```

13. Return `processEvidencePath` from the writer result:

    ```ts
    processEvidencePath,
    ```

    Do not write process evidence inside the envelope writer.

14. Keep these existing helpers and behavior:

    - `missingRunEvidence`;
    - `runOutcome`;
    - `gateFor`;
    - `followupPlannedAttempt`;
    - `memoryUpdateEvents`;
    - `surfaceFor`;
    - decision packet file writing;
    - run surface Markdown writing.

### Edits In `tests/runner/run-envelope-source-writer.test.ts`

1. Change imports:

   - Import `PROCESS_EVIDENCE_RELATIVE_PATH` from
     `../../src/schemas/process-evidence.js`.
   - Import `projectClosedProcessEvidence`,
     `projectCheckpointWaitingProcessEvidence`, and
     `writeProcessEvidenceProjection` from
     `../../src/process-evidence/projection.js`.

2. Add helper functions:

   ```ts
   function writtenClosedProcessEvidence(input: {
     readonly runFolder: string;
     readonly runResult: RunResult;
     readonly resultPath: string;
   }) {
     return writeProcessEvidenceProjection({
       runFolder: input.runFolder,
       projection: projectClosedProcessEvidence(input),
     });
   }

   function writtenCheckpointProcessEvidence(input: {
     readonly runFolder: string;
     readonly runId: string;
     readonly flowId: string;
     readonly traceEntriesObserved: number;
     readonly manifestHash: string;
     readonly checkpoint: {
       readonly stepId: string;
       readonly requestPath: string;
       readonly allowedChoices: readonly string[];
     };
   }) {
     return writeProcessEvidenceProjection({
       runFolder: input.runFolder,
       projection: projectCheckpointWaitingProcessEvidence({
         runFolder: input.runFolder,
         runId: RunId.parse(input.runId),
         flowId: input.flowId,
         traceEntriesObserved: input.traceEntriesObserved,
         manifestHash: input.manifestHash,
         checkpoint: input.checkpoint,
       }),
     });
   }
   ```

   Add `RunId` import from `../../src/schemas/ids.js` if needed.

3. In every `writeRunEnvelopeRecord` call, replace `child: ...` with
   `processEvidence: written...`.

4. Keep all existing assertions about:

   - `written.path`;
   - `written.processEvidencePath`;
   - decision packet paths;
   - completion gate;
   - memory update events;
   - compact surface text.

5. Add one assertion in the complete test:

   ```ts
   expect(record.process_attempts[0]?.summary).toBe('Review completed without findings.');
   ```

6. Add one assertion in the stopped test:

   ```ts
   expect(record.process_attempts[0]?.summary).toBe(
     'Review stopped before producing a private result report.',
   );
   ```

### Expected Behavior

The source writer still writes the same envelope, decision packet, and compact
surface artifacts. The only input change is that tests now prove the writer
starts from written process evidence, not runtime-shaped child data.

### Focused Verification

```bash
npm run test -- tests/runner/run-envelope-source-writer.test.ts tests/contracts/run-envelope-record-schema.test.ts
npm run check
npm run lint
```

### Rollback

Restore `child` input, `buildProjection`, and internal process-evidence writing.
Do not land Slice 5 ratchets until this slice is stable.

## Slice 3: Move Projection Construction To CLI Call Sites

### Files

- `src/cli/circuit.ts`
- `src/cli/run-output.ts` only as verification, not an edit target unless types
  require it.
- `tests/runner/cli-run-envelope-shadow.test.ts`
- `tests/runner/history-run-start-recall.test.ts`

### Imports In `src/cli/circuit.ts`

Add:

```ts
import {
  projectCheckpointWaitingProcessEvidence,
  projectClosedProcessEvidence,
  writeProcessEvidenceProjection,
} from '../process-evidence/projection.js';
```

Keep the `RunResult` import in the CLI. The CLI is the sequencing layer and may
parse runtime result files.

### Checkpoint Resume Path

At `src/cli/circuit.ts:745-787`:

1. Keep parsing `runResult`.
2. Keep `writeOperatorSummary`.
3. Keep `writeRunEnvelopeShadowRecord` exactly as runtime-shaped input unless
   separately refactoring the shadow writer.
4. Before `writeSourceRunEnvelopeRecord`, add:

   ```ts
   const processEvidence = writeProcessEvidenceProjection({
     runFolder,
     projection: projectClosedProcessEvidence({
       runFolder,
       runResult,
       resultPath: runtimeResult.resultPath,
     }),
   });
   ```

5. Change `writeSourceRunEnvelopeRecord` to pass:

   ```ts
   processEvidence,
   ```

   instead of `child`.

6. Preserve `recordedAt` behavior. If possible, avoid calling
   `(options.now ?? (() => new Date()))()` twice with different timestamps. The
   clean version is:

   ```ts
   const recordedAt = (options.now ?? (() => new Date()))().toISOString();
   ```

   Use it for both shadow and source records in this branch. If this changes
   fixture expectations, update fixtures only where timestamps are asserted.

### Fresh Checkpoint-Waiting Path

At `src/cli/circuit.ts:923-998`:

1. Keep `waitingResult` construction. It remains useful for operator summary and
   stdout.
2. Keep `writeRunEnvelopeShadowRecord` runtime-shaped.
3. Before `writeSourceRunEnvelopeRecord`, add:

   ```ts
   const processEvidence = writeProcessEvidenceProjection({
     runFolder,
     projection: projectCheckpointWaitingProcessEvidence({
       runFolder,
       runId: waitingResult.run_id,
       flowId: waitingResult.flow_id,
       traceEntriesObserved: waitingResult.trace_entries_observed,
       manifestHash: waitingResult.manifest_hash,
       checkpoint: {
         stepId: waitingResult.checkpoint.step_id,
         requestPath: runtimeResult.checkpoint.requestPath,
         allowedChoices: waitingResult.checkpoint.allowed_choices,
       },
     }),
   });
   ```

4. Change `writeSourceRunEnvelopeRecord` to pass `processEvidence`.

5. Keep `runEnvelopeMemoryContext(historyRecall)`.

6. Preserve stdout fields:

   - no `result_path` for checkpoint waiting;
   - `run_process_evidence_path` still present through
     `runEnvelopeOutputFields`;
   - decision packet paths still present.

### Fresh Closed Path

At `src/cli/circuit.ts:1037-1083`:

1. Keep parsing `runResult`.
2. Keep `writeOperatorSummary`.
3. Keep `writeRunEnvelopeShadowRecord` runtime-shaped.
4. Add:

   ```ts
   const processEvidence = writeProcessEvidenceProjection({
     runFolder,
     projection: projectClosedProcessEvidence({
       runFolder,
       runResult,
       resultPath: runtimeResult.resultPath,
     }),
   });
   ```

5. Change `writeSourceRunEnvelopeRecord` to pass `processEvidence`.

6. Keep `runEnvelopeMemoryContext(historyRecall)`.

### Tests

1. `tests/runner/cli-run-envelope-shadow.test.ts` should still pass unchanged.
   It proves:

   - no `run_envelope_shadow_path` leaks to stdout;
   - source envelope artifacts still exist;
   - checkpoint waiting omits `result_path`;
   - compact surface text remains stable.

2. `tests/runner/history-run-start-recall.test.ts` should still pass unchanged.
   It guards memory context behavior in fresh Run paths.

3. If TypeScript flags `runEnvelopeOutputFields`, keep the
   `WriteRunEnvelopeRecordResult` shape unchanged rather than changing stdout
   field names.

### Focused Verification

```bash
npm run test -- tests/runner/cli-run-envelope-shadow.test.ts tests/runner/history-run-start-recall.test.ts
npm run test -- tests/runner/cli-router.test.ts
npm run check
npm run lint
```

### Rollback

Move projection construction back into the source writer only before Slice 5.
After Slice 5, rollback should remove the ratchets first.

## Slice 4: Strengthen Boundary Ratchets

### Files

- `tests/contracts/run-centered-v1-safety.test.ts`

### Edits

1. Keep the existing broad runtime executor guard at lines 52-61.

2. Add a helper for non-shadow source envelope files:

   ```ts
   const sourceEnvelopeFiles = [
     'src/run-envelope/source-record.ts',
     ...walk('src/run-envelope/source').filter((path) => path.endsWith('.ts')),
   ];
   ```

   If no `src/run-envelope/source/` directory exists, the `walk` helper returns
   an empty list.

3. Add an import-boundary test:

   ```ts
   it('keeps the source Run envelope projection-only', () => {
     const offenders = sourceEnvelopeFiles.flatMap((path) => {
       const imports = importPathsFrom(path);
       return imports
         .filter(
           (importPath) =>
             importPath.endsWith('/schemas/result.js') ||
             importPath.includes('/runtime/') ||
             importPath.endsWith('/process-evidence/projection.js') ||
             importPath.includes('/flows/catalog'),
         )
         .map((importPath) => `${path} -> ${importPath}`);
     });

     expect(offenders).toEqual([]);
   });
   ```

   This is deliberately scoped to source envelope files, not
   `shadow-record.ts`.

4. Add a string regression test:

   ```ts
   it('keeps runtime-shaped child inputs out of the source Run envelope', () => {
     expect(
       matchingLines(sourceEnvelopeFiles, /\b(?:ClosedChild|CheckpointWaitingChild|buildProjection|runResult|resultPath|00000000-0000-4000-8000-000000000000)\b/),
     ).toEqual([]);
   });
   ```

   If `resultPath` appears in a harmless comment, delete the comment. The source
   writer should not need that word after the refactor.

5. Keep the private report path guard. It should continue to pass because the
   envelope uses `PROCESS_EVIDENCE_RELATIVE_PATH` and declared paths from the
   projection.

6. Do not add a guard that bans `RunResult` across all `src/run-envelope`.
   `shadow-record.ts` is the known temporary exception.

### Focused Verification

```bash
npm run test -- tests/contracts/run-centered-v1-safety.test.ts
npm run check
npm run lint
```

### Rollback

Remove the new source-envelope projection-only tests if Slice 2 or 3 must roll
back. Keep the older runtime executor and private report guards unless they are
the source of the rollback.

## Slice 5: Optional Shadow Writer Follow-Up

This slice is optional and should not block the source writer refactor.

Choose exactly one path:

1. Leave `src/run-envelope/shadow-record.ts` runtime-shaped until shadow artifacts
   are deleted. Document it as a temporary exception in a comment near
   `WriteRunEnvelopeShadowRecordInput`.
2. Convert shadow writer to `ProcessEvidenceProjection` too, only if parity tests
   still need shadow artifacts long enough to justify the extra edit.

Default recommendation: choose option 1. The shadow writer is not part of the
target architecture and should not expand this refactor.

If choosing option 1, add this comment above `WriteRunEnvelopeShadowRecordInput`:

```ts
// Temporary migration aid: the shadow writer intentionally preserves the
// pre-source-envelope runtime-shaped input until the shadow artifact is removed.
// Do not copy this input shape back into source-record.ts.
```

Run:

```bash
npm run test -- tests/runner/run-envelope-shadow-writer.test.ts tests/runner/cli-run-envelope-shadow.test.ts
npm run lint
```

## Slice 6: Final Verification Ladder

Run these after all required slices:

```bash
npm run test -- tests/contracts/process-evidence-projection-schema.test.ts tests/runner/run-envelope-source-writer.test.ts tests/contracts/run-envelope-record-schema.test.ts tests/contracts/run-centered-v1-safety.test.ts
npm run test -- tests/runner/cli-run-envelope-shadow.test.ts tests/runner/history-run-start-recall.test.ts tests/runner/cli-router.test.ts
npm run check
npm run lint
npm run check-flow-drift
npm run verify:fast
npm run verify
```

Expected result:

- All commands pass.
- `npm run check-flow-drift` produces no generated-surface drift.
- No host command or plugin generated output changes unless produced by the
  normal emitter workflow.
- `runEnvelopeOutputFields` still emits:
  - `run_envelope_path`;
  - `run_process_evidence_path`;
  - `run_surface_markdown_path`;
  - `run_surface_status_text`;
  - optional `run_decision_packet_paths`.

## Residue Queries After Implementation

Run these manual checks after the verification ladder:

```bash
rg -n "RunResult|ClosedChild|CheckpointWaitingChild|buildProjection|writeProcessEvidenceProjection|projectClosedProcessEvidence|projectCheckpointWaitingProcessEvidence" src/run-envelope/source-record.ts
rg -n "00000000-0000-4000-8000-000000000000" src/run-envelope/source-record.ts
rg -n "runResult|resultPath" src/run-envelope/source-record.ts
rg -n "processEvidence:" src/cli/circuit.ts tests/runner/run-envelope-source-writer.test.ts
rg -n "PROCESS_EVIDENCE_RELATIVE_PATH" src/schemas/process-evidence.ts src/process-evidence/projection.ts src/run-envelope/source-record.ts tests
```

Expected:

- first three queries return no matches for `src/run-envelope/source-record.ts`;
- the fourth query shows source writer call sites now pass `processEvidence`;
- the fifth query shows the constant owned by `src/schemas/process-evidence.ts`
  and imported from there where boundary-sensitive code needs it.

## Behavior That Must Not Drift

- Checkpoint waiting still has no child result ref.
- Checkpoint waiting still has no `result_path` in CLI stdout.
- Missing expected process evidence still creates one follow-up planned attempt
  and one missing-evidence decision packet.
- Complete Run still requires two gate passes.
- Non-complete compact surfaces still cannot say done, complete, or completed.
- Memory update events remain `hint_only` and source-referenced to process
  evidence.
- Old Goal result artifacts and child `reports/result.json` remain parseable.
- Generated host package content remains emitter-owned.
- Skill moments remain policy/provenance metadata. Do not add skill routing power
  to the envelope while doing this refactor.

## Adversarial Review Checklist

Before completion, run two clean reviews.

Review 1: boundary review

- Can `src/run-envelope/source-record.ts` still see `RunResult`?
- Can it still call any process-evidence projector or writer?
- Can it still create a projection from raw checkpoint data?
- Can it still use a fallback zero run id?
- Does any new helper move runtime-shaped data into `src/run-envelope/source-*`?

Review 2: behavior review

- Did stdout field names or artifact paths change?
- Did checkpoint resume authority move out of runtime/checkpoint code?
- Did memory authority change from `hint_only`?
- Did generated host surfaces change without normal emitter ownership?
- Did any compact surface text drift in a way tests do not cover?

If either review finds a medium-or-higher issue, fix it and restart the two
clean-review requirement.

## Commit Boundary

The cleanest commit is one refactor commit containing Slices 1 through 4, plus
Slice 5 only if adding the shadow exception comment. Do not mix in unrelated
Run-centered V1 cleanup, skill mapping work, public command wording, or generated
surface edits unless `check-flow-drift` explicitly requires regeneration.
