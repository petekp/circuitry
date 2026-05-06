# Circuit v2 Runtime Import Inventory

Generated for Phase 4.28 retained-runtime narrowing prep. This file records
command output and targeted ownership evidence for deletion-readiness review.
The inventory excludes this generated file from the rg scans so it does not cite
itself.

Phase 5.5 adds the current deletion-readiness disposition in
`docs/architecture/v2-deletion-readiness-inventory.md`. Treat that file as the
current owner map and this file as supporting import evidence.

Phase 5.5 result:

- no `src/runtime` file is deletion-ready;
- no retained runner or handler test is obsolete;
- old-path compatibility wrappers still have intentional import support;
- neutral infrastructure under `src/runtime` needs focused move plans, not broad
  deletion.

## Runtime file tree

```bash
find src/runtime -type f | sort
```

```text
src/runtime/append-and-derive.ts
src/runtime/catalog-derivations.ts
src/runtime/checkpoint-resume.ts
src/runtime/compile-schematic-to-flow.ts
src/runtime/config-loader.ts
src/runtime/connectors/claude-code.ts
src/runtime/connectors/codex.ts
src/runtime/connectors/custom.ts
src/runtime/connectors/relay-materializer.ts
src/runtime/connectors/shared.ts
src/runtime/manifest-snapshot-writer.ts
src/runtime/operator-summary-writer.ts
src/runtime/policy/flow-kind-policy.ts
src/runtime/progress-projector.ts
src/runtime/reducer.ts
src/runtime/registries/checkpoint-writers/registry.ts
src/runtime/registries/checkpoint-writers/types.ts
src/runtime/registries/close-writers/registry.ts
src/runtime/registries/close-writers/shared.ts
src/runtime/registries/close-writers/types.ts
src/runtime/registries/compose-writers/registry.ts
src/runtime/registries/compose-writers/types.ts
src/runtime/registries/cross-report-validators.ts
src/runtime/registries/report-schemas.ts
src/runtime/registries/shape-hints/registry.ts
src/runtime/registries/shape-hints/types.ts
src/runtime/registries/verification-writers/registry.ts
src/runtime/registries/verification-writers/types.ts
src/runtime/relay-selection.ts
src/runtime/relay-support.ts
src/runtime/result-writer.ts
src/runtime/router.ts
src/runtime/run-relative-path.ts
src/runtime/run-status-projection.ts
src/runtime/runner-types.ts
src/runtime/runner.ts
src/runtime/selection-resolver.ts
src/runtime/snapshot-writer.ts
src/runtime/step-handlers/checkpoint.ts
src/runtime/step-handlers/compose.ts
src/runtime/step-handlers/fanout.ts
src/runtime/step-handlers/fanout/aggregate.ts
src/runtime/step-handlers/fanout/branch-resolution.ts
src/runtime/step-handlers/fanout/join-policy.ts
src/runtime/step-handlers/fanout/types.ts
src/runtime/step-handlers/index.ts
src/runtime/step-handlers/recovery-route.ts
src/runtime/step-handlers/relay.ts
src/runtime/step-handlers/shared.ts
src/runtime/step-handlers/sub-run.ts
src/runtime/step-handlers/types.ts
src/runtime/step-handlers/verification.ts
src/runtime/trace-reader.ts
src/runtime/trace-writer.ts
src/runtime/write-capable-worker-disclosure.ts
```

## Phase 4.18 Targeted Connector And Registry Inventory

Phase 4.18 did not move connector subprocess modules, relay materialization, or registries. The targeted inventory below records why those boundaries are still live.

### Connector / materializer references

```text
src/core-v2/executors/relay.ts imports relayClaudeCode, relayCodex, and relayCustom from src/runtime/connectors/*.
src/runtime/relay-selection.ts dynamically imports relayClaudeCode, relayCodex, and relayCustom for retained runtime relay resolution.
src/runtime/connectors/relay-materializer.ts imports RelayResult and sha256Hex through the runtime connector compatibility surface.
src/runtime/checkpoint-resume.ts imports sha256Hex from src/shared/connector-relay.ts for retained checkpoint request hash validation.
tests/runner/agent-relay-roundtrip.test.ts and tests/runner/codex-relay-roundtrip.test.ts import materializeRelay directly.
tests/runner/agent-connector-smoke.test.ts and tests/runner/codex-connector-smoke.test.ts import the subprocess connector modules directly.
tests/runner/custom-connector-runtime.test.ts imports relayCustom directly.
```

### Connector smoke fingerprint source lists

```text
tests/runner/codex-relay-roundtrip.test.ts fingerprints:
- src/runtime/connectors/codex.ts
- src/shared/connector-relay.ts
- src/shared/connector-helpers.ts
- src/runtime/connectors/shared.ts
- src/runtime/connectors/relay-materializer.ts
- src/runtime/runner.ts
- src/runtime/registries/report-schemas.ts

tests/runner/explore-e2e-parity.test.ts fingerprints:
- src/runtime/connectors/claude-code.ts
- src/shared/connector-relay.ts
- src/shared/connector-helpers.ts
- src/runtime/connectors/shared.ts
- src/runtime/connectors/relay-materializer.ts
- src/runtime/runner.ts
- src/runtime/registries/report-schemas.ts
```

### Registry references

```text
src/core-v2/executors/compose.ts imports compose and close writer registries.
src/core-v2/executors/checkpoint.ts imports checkpoint writer registry.
src/core-v2/executors/verification.ts imports verification writer registry.
src/core-v2/executors/relay.ts imports cross-report validators and report schemas.
src/shared/relay-support.ts imports the shape-hint registry.
src/runtime/runner.ts imports compose and close writer registries.
src/runtime/checkpoint-resume.ts imports the checkpoint writer registry for retained checkpoint report resume validation.
src/runtime/step-handlers/checkpoint.ts imports checkpoint writer registry.
src/runtime/step-handlers/verification.ts imports verification writer registry.
src/runtime/step-handlers/relay.ts and fanout.ts import report schemas and cross-report validators.
src/flows/** writers import registry type surfaces and close-writer path helpers.
src/flows/** relay-hints import shape-hint type surfaces.
src/flows/types.ts imports all writer, shape-hint, and cross-report validator type surfaces.
tests/runner/catalog-derivations.test.ts, compose-builder-registry.test.ts, close-builder-registry.test.ts, relay-shape-hint-registry.test.ts, cross-report-validators.test.ts, and tests/properties/visible/cross-report-validator.test.ts import registry surfaces directly.
```

## Completed Helper Extraction Inventory

```text
Phase 4.19: src/shared/flow-kind-policy.ts owns validateCompiledFlowKindPolicy; src/runtime/policy/flow-kind-policy.ts is a compatibility re-export.
Phase 4.20: src/shared/manifest-snapshot.ts owns old manifest snapshot byte-match helpers; src/runtime/manifest-snapshot-writer.ts is a compatibility re-export.
Phase 4.21: src/shared/operator-summary-writer.ts owns writeOperatorSummary; src/runtime/operator-summary-writer.ts is a compatibility re-export.
Phase 4.22: src/shared/config-loader.ts owns config discovery; src/runtime/config-loader.ts is a compatibility re-export.
Phase 4.23: src/shared/write-capable-worker-disclosure.ts is now cited in release evidence alongside its runtime compatibility wrapper.
Phase 4.24: docs/architecture/v2-result-writer-plan.md classifies retained and v2 result writer ownership. No result writer code moved.
Phase 4.25: src/shared/result-path.ts owns the shared reports/result.json path helper; src/runtime/result-writer.ts keeps resultPath(...) as a compatibility export.
Phase 4.26: docs/architecture/v2-trace-status-progress-plan.md classifies runs show, progress JSONL, v1 trace/reducer/snapshot, and v2 projection ownership. No projection code moved.
Phase 4.27: src/run-status/project-run-folder.ts owns the neutral public runs show import surface while delegating to src/runtime/run-status-projection.ts.
Phase 4.28: src/run-status/project-run-folder.ts owns the run-status dispatcher implementation; src/runtime/run-status-projection.ts is a compatibility re-export.
Phase 4.29: src/run-status/v2-run-folder.ts owns marked core-v2 run-folder projection; src/run-status/projection-common.ts owns shared status projection helpers.
Phase 4.30: src/run-status/v1-run-folder.ts owns retained v1 run-folder projection while retained trace/reducer/checkpoint helper modules stay in src/runtime.
Phase 4.30.1: neutral status modules import result path and run-relative path from shared helpers instead of retained runtime wrappers.
Phase 4.31: docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md classifies lower-level retained trace/progress/checkpoint ownership before any move.
Phase 4.32: docs/architecture/v2-checkpoint-resume-ownership-plan.md maps retained checkpoint resume ownership and recommends old runner/handler test classification before any resume implementation or shrink.
Phase 4.33: docs/architecture/v2-runner-handler-test-classification.md classifies old runner and handler tests; no old runner/handler test is currently deletion-ready.
Phase 4.34: docs/architecture/v2-runner-handler-current-import-inventory.md records current-only old runner/handler imports without historical scan blocks.
Phase 4.35: docs/architecture/v2-retained-progress-contract-plan.md keeps retained v1 progress projection in src/runtime/progress-projector.ts until checkpoint resume or retained runner ownership changes.
Phase 4.36: docs/architecture/v2-retained-checkpoint-resume-shrink-proposal.md proposes extracting retained resume discovery/validation into src/runtime/checkpoint-resume.ts; no code moved yet.
Phase 4.37: src/runtime/checkpoint-resume.ts owns retained checkpoint resume discovery and validation; src/runtime/runner.ts keeps the public resume wrapper and retained execution loop.
Phase 4.38: docs/architecture/v2-retained-runner-boundary-plan.md maps remaining runner responsibilities and recommends no further runner shrink before a focused close/result finalization proposal.
Phase 4.39: docs/architecture/v2-runner-handler-test-classification.md and docs/architecture/v2-runner-handler-current-import-inventory.md were refreshed after the checkpoint resume extraction; no old runner or handler test is deletion-ready.
Phase 4.40: docs/architecture/v2-close-result-finalization-proposal.md maps retained close/result finalization and recommends keeping it in runner.ts pending focused review.
Phase 4.41: src/runtime/terminal-verdict.ts owns pure terminal admitted verdict derivation; src/runtime/runner.ts still owns retained close/result finalization.
```

## Phase 4.23 Heavy Boundary Inventory

```text
docs/architecture/v2-heavy-boundary-plan.md classifies the remaining high-risk clusters:
- connector subprocess modules;
- relay materializer;
- registries and catalog-derived writer/report infrastructure;
- router/catalog infrastructure;
- compiler/schematic projection;
- trace reader/writer/reducer/snapshot/status/progress;
- result writer;
- old runner;
- old step handlers;
- checkpoint resume.
```

## Phase 4.24-4.25 Result Writer Inventory

Phase 4.24/4.25 ran:

```bash
rg -n "resultPath|runResultPath|RUN_RESULT_RELATIVE_PATH|writeRunResult|writeResult|result-writer|reports/result.json|RunResult" README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json -g "!docs/architecture/v2-runtime-import-inventory.md"
```

High-signal consumer groups:

```text
commands/review.md, commands/build.md, commands/fix.md, commands/explore.md,
commands/run.md and plugin mirrors describe reports/result.json as the user
visible close report path.

specs/reports.json and flow contracts define the universal RunResult at
reports/result.json as distinct from flow-specific close reports such as
build-result.json, fix-result.json, and explore-result.json.

src/shared/result-path.ts owns the shared relative path and absolute helper.
src/runtime/result-writer.ts keeps resultPath(...) as a retained compatibility export and owns writeResult(...).
src/runtime/runner.ts calls writeResult(...) at run close and intentionally does
not write reports/result.json for checkpoint_waiting.

src/runtime/run-status-projection.ts imports resultPath(...) to project
result_path for retained and v2 run folders.

src/runtime/step-handlers/sub-run.ts and src/runtime/step-handlers/fanout.ts
use resultPath(...) to read child reports/result.json before copying it into
parent writes.

src/core-v2/run/result-writer.ts writes reports/result.json through RunFileStore
using RUN_RESULT_RELATIVE_PATH.
src/core-v2/run/graph-runner.ts constructs RunResultV2 and calls
writeRunResultV2(...) after appending run.closed.

src/core-v2/executors/sub-run.ts and src/core-v2/fanout/branch-execution.ts
parse or copy child RunResult files.

src/shared/operator-summary-writer.ts treats RUN_RESULT_RELATIVE_PATH as the
operator-summary result_path.

tests/runner/result-path-compat.test.ts proves shared and retained path helpers match.
Other runner, v2, and parity tests parse reports/result.json through RunResult.
```

Full current output:

```text
commands/review.md:73:   - `result_path` — the run summary `reports/result.json`
commands/review.md:86:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
commands/run.md:193:8. **If `outcome === "aborted"`, read `reports/result.json` at
commands/build.md:110:8. **If `outcome === "aborted"`, read `reports/result.json` at
scripts/host-smoke/codex-handoff.mjs:44:function writeResult(status, reason, evidence = []) {
scripts/host-smoke/codex-handoff.mjs:275:    writeResult(err.status, err.reason, err.evidence);
commands/explore.md:84:   - `result_path` — the run summary `reports/result.json` (not the
commands/explore.md:92:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
commands/explore.md:96:   the `RunResult.reason` schema field.
scripts/host-smoke/claude-handoff.mjs:41:function writeResult(status, reason, evidence = []) {
scripts/host-smoke/claude-handoff.mjs:280:    writeResult(err.status, err.reason, err.evidence);
src/flows/build/command.md:110:8. **If `outcome === "aborted"`, read `reports/result.json` at
commands/fix.md:115:9. **If `outcome === "aborted"`, read `reports/result.json` at
src/flows/build/contract.md:40:`reports/result.json`.
docs/architecture/v2-phase-4-notes.md:39:- child `reports/result.json` is copied into the parent `writes.result` slot;
docs/architecture/v2-phase-4-notes.md:41:- admitted child verdicts can propagate to the parent `reports/result.json`.
docs/architecture/v2-phase-4-notes.md:93:- `reports/result.json.manifest_hash` matches the snapshot hash.
plugins/circuit/commands/review.md:73:   - `result_path` — the run summary `reports/result.json`
plugins/circuit/commands/review.md:86:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
specs/reports.json:291:      "description": "User-visible summary of what a run produced, persisted at <circuit-next-run-folder>/reports/result.json once the closing run.closed trace_entry is appended. Unlike state.json (reducer-derived, recomputable from run.trace) a RunResult is written once at close and never mutated; it is the authoritative 'what happened' report independent of future log rewrites. Slice 27c declares the shape; Slice 27d wires the writer into runtime-proof.",
specs/reports.json:294:      "schema_exports": ["RunResult"],
specs/reports.json:301:      "backing_paths": ["<circuit-next-run-folder>/reports/result.json"],
specs/reports.json:816:      "description": "Close-stage aggregate report for the explore flow run. Composes a deterministic summary, verdict snapshot, and pointers to the four prior reports (brief, analysis, compose, review-verdict). Persisted at <run-folder>/reports/explore-result.json — distinct from the engine-authored universal run.result at <run-folder>/reports/result.json (per-flow path split). Per-flow <kind>-result.json siblings is the canonical pattern for future flow-specific aggregates (build-result.json, fix-result.json, etc.).",
specs/reports.json:832:      "trust_boundary": "engine-computed at Close by the registered explore.result@v1 compose writer from schema-parsed compose.json and review-verdict.json plus flow-declared evidence link paths; terminal report — no in-run readers; cross-run reader is the run result consumer only; path-distinct from run.result so the engine's result-writer (src/runtime/result-writer.ts RESULT-I1 — single writer to result.json) and the orchestrator's close-step (flow-semantic aggregate at explore-result.json) do not collide",
specs/reports.json:962:      "description": "Close-stage aggregate report for the Build flow. Clean-break structured JSON successor to the reference result.md; summarizes the run outcome and points to the five prior Build reports. Persisted at <run-folder>/reports/build-result.json, distinct from the universal run.result at <run-folder>/reports/result.json.",
specs/reports.json:1153:      "description": "Close report for the Fix schematic. Summarizes outcome, verification status, review verdict when present, residual risks, and pointers to Fix reports. Persisted at <run-folder>/reports/fix-result.json, distinct from the universal run.result at <run-folder>/reports/result.json.",
specs/reports.json:1293:      "description": "Batch Execution report for the Migrate flow. The Execute stage delegates the actual code change to a Build child flow via sub-run; the child's run.result is copied verbatim into the parent's writes.result slot. MigrateBatch re-exports RunResult so downstream readers (close-writer, tests) have a typed alias to parse against. The verdict on the child RunResult is what the parent's check.pass admits.",
specs/reports.json:1307:      "trust_boundary": "produced by a Build child flow run via the sub-run handler; the child's own relay + verification + review trust boundaries apply to the materialized RunResult; the parent treats the result as immutable evidence",
plugins/circuit/commands/run.md:192:8. **If `outcome === "aborted"`, read `reports/result.json` at
docs/architecture/v2-checkpoint-2.md:22:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-checkpoint-2.md:52:  `reports/result.json`.
docs/architecture/v2-checkpoint-2.md:69:- The result path is `reports/result.json`.
docs/architecture/v2-checkpoint-2.md:114:- Result writing to `reports/result.json`.
docs/architecture/v2-checkpoint-4.2.2.md:48:- `reports/result.json` parses through `RunResult`.
plugins/circuit/commands/build.md:109:8. **If `outcome === "aborted"`, read `reports/result.json` at
docs/architecture/v2-checkpoint-3.md:19:- v2 writes `reports/result.json`.
docs/architecture/v2-checkpoint-3.md:40:- v2 writes a v1-like `reports/result.json` with snake_case fields.
docs/architecture/v2-checkpoint-3.md:61:- v2 writes `reports/result.json` with `outcome: complete`.
docs/architecture/v2-checkpoint-3.md:78:- Result output is written to `reports/result.json`.
docs/architecture/v2-checkpoint-3.md:187:- Removed `terminal_target` from v2 `reports/result.json`; parity tests now
docs/architecture/v2-checkpoint-3.md:188:  parse that file with the current `RunResult` schema.
plugins/circuit/commands/fix.md:114:9. **If `outcome === "aborted"`, read `reports/result.json` at
docs/architecture/v2-worklog.md:142:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:188:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:198:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:400:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:420:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:471:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:481:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:496:  run ids were not UUIDs for `RunResult` parsing and one nested matcher was too
docs/architecture/v2-worklog.md:505:result files that parse with the current `RunResult` schema, computes manifest
docs/architecture/v2-worklog.md:620:that snapshot hash to `run.bootstrapped` and `reports/result.json`.
docs/architecture/v2-worklog.md:1278:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1279:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:1288:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1289:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:1298:- `docs/architecture/v2-result-writer-plan.md`
docs/architecture/v2-worklog.md:1307:`reports/result.json` path, while retained and v2 result writers remain
docs/architecture/v2-worklog.md:1312:- `src/runtime/result-writer.ts` is still live and not deletable.
docs/architecture/v2-worklog.md:1327:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1328:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:1341:- `docs/architecture/v2-result-writer-plan.md`
docs/architecture/v2-worklog.md:1362:- The retained and v2 result writers both write `reports/result.json`, but
docs/architecture/v2-worklog.md:1366:  `reports/result.json`.
docs/architecture/v2-worklog.md:1369:extraction for `reports/result.json` if the team wants a low-risk next code
docs/architecture/v2-worklog.md:2485:- `src/core-v2/run/result-writer.ts`
plugins/circuit/skills/run/SKILL.md:188:8. **If `outcome === "aborted"`, read `reports/result.json` at
docs/architecture/v2-deletion-plan.md:81:| `src/runtime/result-writer.ts` | retain retained writer / compatibility path export | core-v2 has its own result writer, but retained runtime and old result tests still use this one. Phase 4.25 moved only the shared `reports/result.json` path helper to `src/shared/result-path.ts`; do not merge the writers yet. |
docs/architecture/v2-deletion-plan.md:130:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-deletion-plan.md:207:| Plan result writer ownership before moving code | Done in Phase 4.24. `docs/architecture/v2-result-writer-plan.md` compares retained and v2 result semantics and recommends a path-only helper extraction before any writer merge. | Keep retained and v2 result writers separate unless a future trace/status/progress ownership review approves merging lifecycle semantics. |
docs/architecture/v2-deletion-plan.md:208:| Move the shared run result path helper | Done in Phase 4.25. `src/shared/result-path.ts` owns `RUN_RESULT_RELATIVE_PATH` and `runResultPath(...)`; `src/runtime/result-writer.ts` keeps the compatibility `resultPath(...)` export. | Keep `src/runtime/result-writer.ts` as the retained writer; this move does not make it deletable. |
plugins/circuit/commands/explore.md:83:   - `result_path` — the run summary `reports/result.json` (not the
plugins/circuit/commands/explore.md:91:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
plugins/circuit/commands/explore.md:95:   the `RunResult.reason` schema field.
docs/architecture/v2-checkpoint-4.24.md:5:Phase 4.24 is a result-writer planning checkpoint.
docs/architecture/v2-checkpoint-4.24.md:15:- `docs/architecture/v2-result-writer-plan.md`
docs/architecture/v2-checkpoint-4.24.md:25:The retained and v2 result writers both write `reports/result.json` with the
docs/architecture/v2-checkpoint-4.24.md:26:shared `RunResult` shape. They should not be merged yet.
docs/architecture/v2-checkpoint-4.24.md:34:with a shared relative constant/helper for `reports/result.json`.
docs/architecture/v2-checkpoint-4.24.md:36:`src/runtime/result-writer.ts` should remain the retained runtime writer, and
docs/architecture/v2-checkpoint-4.24.md:37:`src/core-v2/run/result-writer.ts` should remain the v2 writer. The path helper
docs/architecture/v2-checkpoint-4.25.md:22:- `src/runtime/result-writer.ts`
docs/architecture/v2-checkpoint-4.25.md:23:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-checkpoint-4.25.md:43:RUN_RESULT_RELATIVE_PATH = "reports/result.json"
docs/architecture/v2-checkpoint-4.25.md:44:runResultPath(runFolder)
docs/architecture/v2-checkpoint-4.25.md:47:`src/runtime/result-writer.ts` keeps the old `resultPath(...)` export as a
docs/architecture/v2-checkpoint-4.25.md:56:`src/runtime/result-writer.ts` remains live because retained runtime still owns
docs/architecture/v2-checkpoint-4.2.5.md:46:- `reports/result.json` parses through `RunResult`.
plugins/circuit/skills/build/SKILL.md:114:8. **If `outcome === "aborted"`, read `reports/result.json` at
tests/core-v2/default-executors-v2.test.ts:7:import { RunResult } from '../../src/schemas/result.js';
tests/core-v2/default-executors-v2.test.ts:43:        RunResult.parse(JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8'))),
docs/architecture/v2-checkpoint-4.2.3.md:42:- `reports/result.json` parses through `RunResult`.
docs/architecture/v2-checkpoint-4.2.4.md:41:- the child `reports/result.json` parses through `RunResult`;
docs/architecture/v2-checkpoint-4.2.4.md:45:- the parent `reports/result.json` parses through `RunResult`.
plugins/circuit/skills/explore/SKILL.md:89:   - `result_path` — the run summary `reports/result.json` (not the
plugins/circuit/skills/explore/SKILL.md:97:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
plugins/circuit/skills/explore/SKILL.md:101:   the `RunResult.reason` schema field.
tests/core-v2/fanout-v2.test.ts:8:import type { GraphRunResultV2 } from '../../src/core-v2/run/graph-runner.js';
tests/core-v2/fanout-v2.test.ts:11:import { RunResult } from '../../src/schemas/result.js';
tests/core-v2/fanout-v2.test.ts:178:  return async (options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> => {
tests/core-v2/fanout-v2.test.ts:179:    const resultPath = join(options.runDir, 'reports', 'result.json');
tests/core-v2/fanout-v2.test.ts:180:    await mkdir(dirname(resultPath), { recursive: true });
tests/core-v2/fanout-v2.test.ts:181:    const body = RunResult.parse({
tests/core-v2/fanout-v2.test.ts:193:    await writeFile(resultPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
tests/core-v2/fanout-v2.test.ts:205:      resultPath,
docs/architecture/v2-checkpoint-4.1.md:49:- `src/runtime/result-writer.ts`
plugins/circuit/skills/review/SKILL.md:79:   - `result_path` — the run summary `reports/result.json`
plugins/circuit/skills/review/SKILL.md:92:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
src/flows/fix/command.md:115:9. **If `outcome === "aborted"`, read `reports/result.json` at
plugins/circuit/skills/fix/SKILL.md:119:9. **If `outcome === "aborted"`, read `reports/result.json` at
tests/core-v2/sub-run-v2.test.ts:8:import type { GraphRunResultV2 } from '../../src/core-v2/run/graph-runner.js';
tests/core-v2/sub-run-v2.test.ts:12:import { RunResult } from '../../src/schemas/result.js';
tests/core-v2/sub-run-v2.test.ts:96:  return async (options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> => {
tests/core-v2/sub-run-v2.test.ts:97:    const resultPath = join(options.runDir, 'reports', 'result.json');
tests/core-v2/sub-run-v2.test.ts:98:    await mkdir(dirname(resultPath), { recursive: true });
tests/core-v2/sub-run-v2.test.ts:99:    const body = RunResult.parse({
tests/core-v2/sub-run-v2.test.ts:111:    await writeFile(resultPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
tests/core-v2/sub-run-v2.test.ts:123:      resultPath,
tests/core-v2/sub-run-v2.test.ts:146:    const copied = RunResult.parse(
docs/architecture/v2-heavy-boundary-plan.md:23:| Result writer | retained runner and old result tests | Writes retained runtime `reports/result.json` and checks trace/result consistency | User-visible run result report | Keep until retained runner result ownership is narrowed | Medium | result writer tests, runner close tests, status tests |
docs/architecture/v2-heavy-boundary-plan.md:48:   extraction for `reports/result.json`, while keeping retained and v2 writers
src/flows/fix/contract.md:45:`reports/result.json`.
docs/architecture/v2-checkpoint-4.md:14:- schema-compatible `reports/result.json` output;
tests/core-v2/core-v2-baseline.test.ts:124:      await expect(files.readJson('reports/result.json')).resolves.toMatchObject({
docs/architecture/v2-result-writer-plan.md:7:it is still user-visible. Both runtimes write `reports/result.json`; parent
docs/architecture/v2-result-writer-plan.md:16:| `src/runtime/result-writer.ts` | Retained runtime writer for `reports/result.json`; owns `resultPath(...)` and `writeResult(...)`. | Retained runner, retained status projection, retained sub-run/fanout handlers, retained tests. | Keep for now. Candidate future slice may move only the path helper. |
docs/architecture/v2-result-writer-plan.md:17:| `src/core-v2/run/result-writer.ts` | v2 writer wrapper over `RunFileStore.writeJson('reports/result.json', ...)`. | `src/core-v2/run/graph-runner.ts`; v2 tests and parity tests. | Keep separate. Lifecycle is owned by v2 graph runner. |
docs/architecture/v2-result-writer-plan.md:18:| `src/schemas/result.ts` | Shared `RunResult` schema and user-visible result contract. | CLI, flow packages, retained runtime tests, v2 tests, release tests, operator summary. | Keep as the canonical shape. |
docs/architecture/v2-result-writer-plan.md:20:| `src/runtime/step-handlers/sub-run.ts` | Reads child `reports/result.json` and copies it into parent writes. | Retained sub-run fallback and tests. | Keep with retained handler. |
docs/architecture/v2-result-writer-plan.md:21:| `src/runtime/step-handlers/fanout.ts` | Reads child `reports/result.json` and copies it into branch result slots. | Retained fanout fallback and tests. | Keep with retained handler. |
docs/architecture/v2-result-writer-plan.md:22:| `src/core-v2/executors/sub-run.ts` | Reads child v2 or retained `RunResult` through `RunResult.parse`. | v2 sub-run. | Keep v2-owned. |
docs/architecture/v2-result-writer-plan.md:23:| `src/core-v2/fanout/branch-execution.ts` | Copies child `RunResult` into branch result slots. | v2 fanout. | Keep v2-owned. |
docs/architecture/v2-result-writer-plan.md:30:<run-folder>/reports/result.json
docs/architecture/v2-result-writer-plan.md:33:It parses through `RunResult` and carries:
docs/architecture/v2-result-writer-plan.md:57:| Path | `resultPath(runFolder)` returns `<run-folder>/reports/result.json`. | `RunFileStore.writeJson('reports/result.json', ...)` resolves the same path. | Yes. |
docs/architecture/v2-result-writer-plan.md:58:| Schema shape | `writeResult(...)` parses through `RunResult` before writing. | `GraphRunResultV2` / `RunResultV2` mirrors `RunResult`; tests parse output through `RunResult`. | Effectively yes, but v2 writer itself does not call `RunResult.parse`. |
docs/architecture/v2-result-writer-plan.md:69:| Checkpoint waiting | Retained runner returns `checkpoint_waiting` without writing `reports/result.json`. | v2 does not own checkpoint waiting/resume. | Retained-only. |
docs/architecture/v2-result-writer-plan.md:75:| `complete` | Writes `reports/result.json`; emits completed progress. | Writes `reports/result.json`; emits completed progress. |
docs/architecture/v2-result-writer-plan.md:76:| `aborted` | Writes `reports/result.json`; reason should explain failure. | Writes `reports/result.json`; reason should explain failure. |
docs/architecture/v2-result-writer-plan.md:77:| `stopped` | Writes `reports/result.json`; retained rich-route behavior. | v2 can represent stopped, but unsupported retained modes still own many rich routes. |
docs/architecture/v2-result-writer-plan.md:78:| `handoff` | Writes `reports/result.json`; retained rich-route behavior. | v2 can represent handoff, but handoff/resume product behavior is retained. |
docs/architecture/v2-result-writer-plan.md:79:| `escalated` | Writes `reports/result.json`; retained rich-route behavior. | v2 can represent escalated, but unsupported retained modes still own many rich routes. |
docs/architecture/v2-result-writer-plan.md:80:| `checkpoint_waiting` | Returned to caller; no `reports/result.json` is written. | Not v2-owned. |
docs/architecture/v2-result-writer-plan.md:87:rg -n "resultPath|writeRunResult|writeResult|result-writer|reports/result.json|RunResult" \
docs/architecture/v2-result-writer-plan.md:97:| Retained runtime writer/readers | `src/runtime/result-writer.ts`, `src/runtime/runner.ts`, `src/runtime/run-status-projection.ts`, retained sub-run/fanout handlers | Retained execution and compatibility. |
docs/architecture/v2-result-writer-plan.md:98:| core-v2 writer/readers | `src/core-v2/run/result-writer.ts`, `src/core-v2/run/graph-runner.ts`, v2 sub-run/fanout executors | v2 execution. |
docs/architecture/v2-result-writer-plan.md:100:| CLI output | `src/cli/circuit.ts` | Product output path and `RunResult` parsing. |
docs/architecture/v2-result-writer-plan.md:120:export const RUN_RESULT_RELATIVE_PATH = 'reports/result.json';
docs/architecture/v2-result-writer-plan.md:121:export function runResultPath(runFolder: string): string;
docs/architecture/v2-result-writer-plan.md:126:- keep `src/runtime/result-writer.ts` as the retained writer;
docs/architecture/v2-result-writer-plan.md:127:- make `resultPath(...)` delegate to the shared helper for compatibility;
docs/architecture/v2-result-writer-plan.md:128:- use `RUN_RESULT_RELATIVE_PATH` in `src/core-v2/run/result-writer.ts`;
docs/architecture/v2-result-writer-plan.md:129:- use `runResultPath(...)` in retained/v2 progress and CLI result-path output;
docs/architecture/v2-result-writer-plan.md:130:- do not merge `writeResult(...)` and `writeRunResultV2(...)`.
docs/architecture/v2-result-writer-plan.md:138:- retained runtime writes synchronously and validates through `RunResult.parse`;
docs/architecture/v2-result-writer-plan.md:164:runtime resultPath(runFolder) === shared runResultPath(runFolder)
docs/architecture/v2-result-writer-plan.md:165:shared relative constant === "reports/result.json"
docs/architecture/v2-result-writer-plan.md:173:- change `RunResult`;
docs/architecture/v2-result-writer-plan.md:180:- delete `src/runtime/result-writer.ts`.
docs/architecture/v2-result-writer-plan.md:186:After a path-only move, `src/runtime/result-writer.ts` would still remain live
docs/architecture/v2-rigor-audit.md:13:| Run close rules | `src/runtime/runner.ts`, `src/runtime/result-writer.ts`, `src/schemas/run.ts` | Runs that keep accepting entries after completion, wrong terminal result | CLI, status projection, operator summary | `run.closed`, result writer, trace close validation | keep | `run/graph-runner.ts` and `run/result-writer.ts` | Run trace and runner tests | Close should be a graph-runner responsibility, with result writing isolated. |
src/core-v2/run/result-writer.ts:1:import { RUN_RESULT_RELATIVE_PATH } from '../../shared/result-path.js';
src/core-v2/run/result-writer.ts:5:export interface RunResultV2 {
src/core-v2/run/result-writer.ts:19:export async function writeRunResultV2(files: RunFileStore, result: RunResultV2): Promise<string> {
src/core-v2/run/result-writer.ts:20:  return await files.writeJson(RUN_RESULT_RELATIVE_PATH, result);
docs/release/proofs/index.yaml:64:      - examples/runs/review/run/reports/result.json
docs/release/proofs/index.yaml:85:      - examples/runs/checkpoint/run/reports/result.json
docs/release/proofs/index.yaml:105:      - examples/runs/abort/run/reports/result.json
src/core-v2/run/compiled-flow-runner.ts:20:import { type GraphRunResultV2, executeExecutableFlowV2 } from './graph-runner.js';
src/core-v2/run/compiled-flow-runner.ts:67:): Promise<GraphRunResultV2> {
src/cli/circuit.ts:16:import { RunResult } from '../schemas/result.js';
src/cli/circuit.ts:30:import { runResultPath } from '../shared/result-path.js';
src/cli/circuit.ts:661:        : { result_path: runResultPath(outcome.runFolder) };
src/cli/circuit.ts:745:      'trace.ndjson + state.json + manifest.snapshot.json + reports/result.json from clean checkout',
src/cli/circuit.ts:820:    const runResult = RunResult.parse(JSON.parse(readFileSync(v2Result.resultPath, 'utf8')));
src/cli/circuit.ts:849:          result_path: v2Result.resultPath,
src/cli/circuit.ts:875:  const resultPath =
src/cli/circuit.ts:878:      : { result_path: runResultPath(outcome.runFolder) };
src/cli/circuit.ts:899:        ...resultPath,
src/cli/create.ts:168:function resultPath(home: string, slug: string): string {
src/cli/create.ts:506:    const outPath = resultPath(home, slug);
src/cli/create.ts:536:  resultPath,
src/cli/handoff.ts:1042:  const resultPath = handoffResultPath(controlPlane, 'save');
src/cli/handoff.ts:1043:  writeJson(resultPath, result);
src/cli/handoff.ts:1044:  return { ...result, result_path: resultPath };
src/cli/handoff.ts:1060:    const resultPath = handoffResultPath(controlPlane, 'resume');
src/cli/handoff.ts:1061:    writeJson(resultPath, result);
src/cli/handoff.ts:1062:    return { ...result, result_path: resultPath };
src/cli/handoff.ts:1075:    const resultPath = handoffResultPath(controlPlane, 'resume');
src/cli/handoff.ts:1076:    writeJson(resultPath, result);
src/cli/handoff.ts:1077:    return { ...result, result_path: resultPath };
src/cli/handoff.ts:1101:  const resultPath = handoffResultPath(controlPlane, 'resume');
src/cli/handoff.ts:1102:  writeJson(resultPath, result);
src/cli/handoff.ts:1103:  return { ...result, result_path: resultPath };
src/cli/handoff.ts:1127:  const resultPath = handoffResultPath(controlPlane, 'done');
src/cli/handoff.ts:1128:  writeJson(resultPath, result);
src/cli/handoff.ts:1129:  return { ...result, result_path: resultPath };
src/runtime/result-writer.ts:3:import { RunResult } from '../schemas/result.js';
src/runtime/result-writer.ts:4:import { runResultPath } from '../shared/result-path.js';
src/runtime/result-writer.ts:6:// RESULT-I1 — <run-folder>/reports/result.json is authored once at close
src/runtime/result-writer.ts:10:// The shape is enforced by `RunResult` in src/schemas/result.ts; this
src/runtime/result-writer.ts:14:export function resultPath(runFolder: string): string {
src/runtime/result-writer.ts:15:  return runResultPath(runFolder);
src/runtime/result-writer.ts:18:export function writeResult(runFolder: string, candidate: unknown): RunResult {
src/runtime/result-writer.ts:19:  const parsed = RunResult.parse(candidate);
src/runtime/result-writer.ts:20:  const path = resultPath(runFolder);
src/runtime/runner-types.ts:6:import type { RunResult } from '../schemas/result.js';
src/runtime/runner-types.ts:152:export interface CompiledFlowRunResult {
src/runtime/runner-types.ts:154:  result: RunResult | CheckpointWaitingResult;
src/runtime/runner-types.ts:160:export type CompiledFlowRunner = (inv: CompiledFlowInvocation) => Promise<CompiledFlowRunResult>;
src/runtime/runner.ts:47:import { resultPath, writeResult } from './result-writer.js';
src/runtime/runner.ts:53:  CompiledFlowRunResult,
src/runtime/runner.ts:91:  CompiledFlowRunResult,
src/runtime/runner.ts:744:): Promise<CompiledFlowRunResult> {
src/runtime/runner.ts:1141:  const result = writeResult(runFolder, {
src/runtime/runner.ts:1185:      result_path: resultPath(runFolder),
src/runtime/runner.ts:1198:      result_path: resultPath(runFolder),
src/runtime/runner.ts:1215:export async function runCompiledFlow(inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> {
src/runtime/runner.ts:1221:): Promise<CompiledFlowRunResult> {
src/core-v2/run/child-runner.ts:9:import type { GraphRunResultV2 } from './graph-runner.js';
src/core-v2/run/child-runner.ts:64:) => Promise<GraphRunResultV2>;
src/runtime/run-status-projection.ts:15:import { resultPath } from './result-writer.js';
src/runtime/run-status-projection.ts:154:  const result = resultPath(runFolder);
src/flows/review/command.md:73:   - `result_path` — the run summary `reports/result.json`
src/flows/review/command.md:86:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
src/shared/operator-summary-writer.ts:8:import type { RunResult } from '../schemas/result.js';
src/shared/operator-summary-writer.ts:9:import { RUN_RESULT_RELATIVE_PATH } from './result-path.js';
src/shared/operator-summary-writer.ts:30:  readonly run_id: RunResult['run_id'];
src/shared/operator-summary-writer.ts:31:  readonly flow_id: RunResult['flow_id'];
src/shared/operator-summary-writer.ts:45:export type OperatorSummaryRunResult = RunResult | CheckpointWaitingOperatorSummaryResult;
src/shared/operator-summary-writer.ts:388:  readonly runResult: OperatorSummaryRunResult;
src/shared/operator-summary-writer.ts:397:  const resultRelPath = RUN_RESULT_RELATIVE_PATH;
src/shared/operator-summary-writer.ts:398:  const resultPath =
src/shared/operator-summary-writer.ts:404:  if (resultPath !== undefined)
src/shared/operator-summary-writer.ts:456:    ...(resultPath === undefined ? {} : { result_path: resultPath }),
src/runtime/operator-summary-writer.ts:3:  type OperatorSummaryRunResult,
src/shared/result-path.ts:3:export const RUN_RESULT_RELATIVE_PATH = 'reports/result.json';
src/shared/result-path.ts:5:export function runResultPath(runFolder: string): string {
src/shared/result-path.ts:6:  return join(runFolder, RUN_RESULT_RELATIVE_PATH);
src/core-v2/run/graph-runner.ts:27:import { type RunResultV2, writeRunResultV2 } from './result-writer.js';
src/core-v2/run/graph-runner.ts:54:export interface GraphRunResultV2 extends RunResultV2 {
src/core-v2/run/graph-runner.ts:55:  readonly resultPath: string;
src/core-v2/run/graph-runner.ts:129:): Promise<GraphRunResultV2> {
src/core-v2/run/graph-runner.ts:142:  const result: RunResultV2 = {
src/core-v2/run/graph-runner.ts:155:  const resultPath = await writeRunResultV2(context.files, result);
src/core-v2/run/graph-runner.ts:156:  return { ...result, resultPath };
src/core-v2/run/graph-runner.ts:162:): Promise<GraphRunResultV2> {
tests/release/release-infrastructure.test.ts:34:import { RunResult } from '../../src/schemas/result.js';
tests/release/release-infrastructure.test.ts:476:      RunResult.parse(jsonFile('examples/runs/explore-decision/run/reports/result.json')),
tests/release/release-infrastructure.test.ts:578:          RunResult.parse(jsonFile(`examples/runs/${proof.slug}/run/reports/result.json`)),
src/runtime/step-handlers/sub-run.ts:6:import { resultPath } from '../result-writer.js';
src/runtime/step-handlers/sub-run.ts:309:  const childResultPathAbs = resultPath(childRunFolder);
src/schemas/result.ts:5:// RESULT-I1 — RunResult is the user-visible report a run produces at
src/schemas/result.ts:6:// closure. Written to <run-folder>/reports/result.json by the runtime
src/schemas/result.ts:8:// (reducer-derived, recomputable) a RunResult is persisted once at close
src/schemas/result.ts:15:// src/runtime/result-writer.ts); this schema only enforces shape.
src/schemas/result.ts:39:export const RunResult = z
src/schemas/result.ts:54:export type RunResult = z.infer<typeof RunResult>;
src/schemas/flow-schematic.ts:128://                                        into parent's writes.result slot — RunResult shape)
src/core-v2/executors/sub-run.ts:5:import { RunResult } from '../../schemas/result.js';
src/core-v2/executors/sub-run.ts:159:  const childResultText = await readFile(childResult.resultPath, 'utf8');
src/core-v2/executors/sub-run.ts:160:  const childResultBody = RunResult.parse(JSON.parse(childResultText));
src/schemas/check.ts:44:export const SubRunResultSource = z
src/schemas/check.ts:50:export type SubRunResultSource = z.infer<typeof SubRunResultSource>;
src/schemas/check.ts:70:  SubRunResultSource,
src/schemas/check.ts:100:    source: z.discriminatedUnion('kind', [RelayResultSource, SubRunResultSource]),
src/flows/review/writers/result.ts:45:  const resultPath = reviewerRelayes[0]?.writes.result as unknown as string | undefined;
src/flows/review/writers/result.ts:46:  if (resultPath === undefined || !closeStep.reads.includes(resultPath as never)) {
src/flows/review/writers/result.ts:48:      `review.result@v1 requires close step '${closeStepId}' to read the reviewer relay result path '${resultPath ?? '<missing>'}'`,
src/flows/review/writers/result.ts:51:  return resultPath;
src/core-v2/fanout/branch-execution.ts:5:import { RunResult } from '../../schemas/result.js';
src/core-v2/fanout/branch-execution.ts:75:  const resultPath = `${branchDirRel}/result.json`;
src/core-v2/fanout/branch-execution.ts:122:    await context.files.writeJson(resultPath, reportBody);
src/core-v2/fanout/branch-execution.ts:164:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:172:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:190:  const resultPath = `${branchDirRel}/result.json`;
src/core-v2/fanout/branch-execution.ts:214:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:222:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:269:    const childResultText = await readFile(child.resultPath, 'utf8');
src/core-v2/fanout/branch-execution.ts:270:    const childResult = RunResult.parse(JSON.parse(childResultText));
src/core-v2/fanout/branch-execution.ts:271:    await context.files.writeJson(resultPath, childResult);
src/core-v2/fanout/branch-execution.ts:285:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:293:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:310:      result_path: resultPath,
src/core-v2/fanout/branch-execution.ts:318:      result_path: resultPath,
tests/parity/migrate-v2.test.ts:5:import type { GraphRunResultV2 } from '../../src/core-v2/run/graph-runner.js';
tests/parity/migrate-v2.test.ts:6:import { RunResult } from '../../src/schemas/result.js';
tests/parity/migrate-v2.test.ts:17:async function buildChildRunner(options: CompiledFlowRunOptionsV2Like): Promise<GraphRunResultV2> {
tests/parity/migrate-v2.test.ts:18:  const resultPath = join(options.runDir, 'reports', 'result.json');
tests/parity/migrate-v2.test.ts:19:  await mkdir(dirname(resultPath), { recursive: true });
tests/parity/migrate-v2.test.ts:20:  const body = RunResult.parse({
tests/parity/migrate-v2.test.ts:32:  await writeFile(resultPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
tests/parity/migrate-v2.test.ts:44:    resultPath,
tests/parity/migrate-v2.test.ts:78:      const copied = RunResult.parse(
tests/parity/fix-v2.test.ts:12:import { RunResult } from '../../src/schemas/result.js';
tests/parity/fix-v2.test.ts:65:      const runResult = RunResult.parse(await files.readJson('reports/result.json'));
tests/parity/fix-v2.test.ts:113:      const runResult = RunResult.parse(await files.readJson('reports/result.json'));
tests/parity/fix-v2.test.ts:167:      expect(RunResult.parse(await files.readJson('reports/result.json'))).toMatchObject({
src/core-v2/projections/progress.ts:11:import { runResultPath } from '../../shared/result-path.js';
src/core-v2/projections/progress.ts:511:            result_path: runResultPath(input.runDir),
src/core-v2/projections/progress.ts:524:            result_path: runResultPath(input.runDir),
tests/parity/review-v2.test.ts:6:import { RunResult } from '../../src/schemas/result.js';
tests/parity/review-v2.test.ts:52:      const runResult = RunResult.parse(await files.readJson('reports/result.json'));
tests/parity/build-v2.test.ts:12:import { RunResult } from '../../src/schemas/result.js';
tests/parity/build-v2.test.ts:83:      const runResult = RunResult.parse(await files.readJson('reports/result.json'));
src/runtime/compile-schematic-to-flow.ts:334:      const resultPath = requireWritesField(writes, 'result_path', item.id, 'relay');
src/runtime/compile-schematic-to-flow.ts:343:        result: resultPath,
src/runtime/compile-schematic-to-flow.ts:374:      const resultPath = requireWritesField(writes, 'result_path', item.id, 'sub-run');
src/runtime/compile-schematic-to-flow.ts:390:          result: resultPath,
src/runtime/compile-schematic-to-flow.ts:391:          report: { path: resultPath, schema: item.output },
src/flows/explore/command.md:84:   - `result_path` — the run summary `reports/result.json` (not the
src/flows/explore/command.md:92:   If `outcome === 'aborted'`, read `reports/result.json` at `result_path`
src/flows/explore/command.md:96:   the `RunResult.reason` schema field.
src/flows/migrate/reports.ts:2:import { RunResult } from '../../schemas/result.js';
src/flows/migrate/reports.ts:121:// at that path is exactly RunResult; MigrateBatch re-exports it so
src/flows/migrate/reports.ts:123:// against. The `verdict` field on the child RunResult is what the
src/flows/migrate/reports.ts:126:export const MigrateBatch = RunResult;
tests/runner/handler-throw-recovery.test.ts:9:import { RunResult } from '../../src/schemas/result.js';
tests/runner/handler-throw-recovery.test.ts:109:    // manifest.snapshot.json, reports/result.json all exist. A retry
tests/runner/handler-throw-recovery.test.ts:116:    // result.json parses through RunResult and pins the abort.
tests/runner/handler-throw-recovery.test.ts:117:    const result = RunResult.parse(
tests/runner/handler-throw-recovery.test.ts:198:    const result = RunResult.parse(
tests/runner/fanout-handler-direct.test.ts:18:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/fanout-handler-direct.test.ts:22:  CompiledFlowRunResult,
tests/runner/fanout-handler-direct.test.ts:31:import { RunResult } from '../../src/schemas/result.js';
tests/runner/fanout-handler-direct.test.ts:196:  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
tests/runner/fanout-handler-direct.test.ts:238:    const childResultAbs = resultPath(inv.runFolder);
tests/runner/fanout-handler-direct.test.ts:240:    const body = RunResult.parse({
src/runtime/registries/report-schemas.ts:20://   → RunResult.reason mirrors the close reason.
src/flows/explore/contract.md:55:`backing_path` at `<run-folder>/reports/result.json`. To preserve the
src/flows/explore/contract.md:58:`<run-folder>/reports/result.json`. The two reports now live at distinct
src/flows/explore/contract.md:88:  `<run-folder>/reports/result.json`, authored by the engine at
src/flows/explore/contract.md:318:`<run-folder>/reports/result.json` mirrors the same outcome and reason
src/flows/explore/contract.md:319:on `RunResult.outcome` and `RunResult.reason`. The relay step does not
src/flows/explore/contract.md:351:`<run-folder>/reports/result.json` mirrors the aborted outcome and
src/flows/explore/contract.md:376:`RunResult.reason` mirroring the close-trace_entry reason on the user-visible
tests/runner/migrate-runtime-wiring.test.ts:17:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/migrate-runtime-wiring.test.ts:21:  type CompiledFlowRunResult,
tests/runner/migrate-runtime-wiring.test.ts:29:import { RunResult } from '../../src/schemas/result.js';
tests/runner/migrate-runtime-wiring.test.ts:44://     (deriveTerminalVerdict in runner.ts populates RunResult.verdict
tests/runner/migrate-runtime-wiring.test.ts:47://     batch (RunResult shape) + verification + review and produces a
tests/runner/migrate-runtime-wiring.test.ts:183:// step check expects, then returns a minimal CompiledFlowRunResult so the
tests/runner/migrate-runtime-wiring.test.ts:187:  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
tests/runner/migrate-runtime-wiring.test.ts:188:    const childResultAbs = resultPath(inv.runFolder);
tests/runner/migrate-runtime-wiring.test.ts:190:    const body = RunResult.parse({
tests/contracts/fix-report-schemas.test.ts:424:      '<circuit-next-run-folder>/reports/result.json',
tests/runner/terminal-outcome-mapping.test.ts:17:import { RunResult } from '../../src/schemas/result.js';
tests/runner/terminal-outcome-mapping.test.ts:465:      const result = RunResult.parse(
tests/runner/pass-route-cycle-guard.test.ts:13:import { RunResult } from '../../src/schemas/result.js';
tests/runner/pass-route-cycle-guard.test.ts:135:    const result = RunResult.parse(
tests/runner/operator-summary-writer.test.ts:8:import { RunResult } from '../../src/schemas/result.js';
tests/runner/operator-summary-writer.test.ts:28:function baseResult(flowId: string): RunResult {
tests/runner/operator-summary-writer.test.ts:29:  return RunResult.parse({
tests/runner/operator-summary-writer.test.ts:325:    const result = RunResult.parse({
src/runtime/step-handlers/fanout.ts:10:import { resultPath } from '../result-writer.js';
src/runtime/step-handlers/fanout.ts:570:          const childResultAbs = resultPath(childRunFolder);
tests/runner/fanout-real-recursion.test.ts:307:      // result-writer.
src/flows/migrate/writers/close.ts:9:// reported follow-ups; 'reverted' iff the batch RunResult outcome is
src/flows/migrate/writers/close.ts:11:// Build's RunResult copied verbatim by the sub-run handler — its
tests/runner/result-path-compat.test.ts:4:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/result-path-compat.test.ts:5:import { RUN_RESULT_RELATIVE_PATH, runResultPath } from '../../src/shared/result-path.js';
tests/runner/result-path-compat.test.ts:11:    expect(RUN_RESULT_RELATIVE_PATH).toBe('reports/result.json');
tests/runner/result-path-compat.test.ts:12:    expect(runResultPath(runFolder)).toBe(join(runFolder, 'reports', 'result.json'));
tests/runner/result-path-compat.test.ts:13:    expect(resultPath(runFolder)).toBe(runResultPath(runFolder));
tests/runner/build-checkpoint-exec.test.ts:392:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
tests/runner/build-checkpoint-exec.test.ts:439:    expect(readJson(runFolder, 'reports/result.json')).toMatchObject({ outcome: 'complete' });
tests/runner/build-checkpoint-exec.test.ts:481:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
tests/runner/build-checkpoint-exec.test.ts:509:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
tests/runner/build-checkpoint-exec.test.ts:562:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
tests/runner/build-checkpoint-exec.test.ts:632:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
tests/runner/build-checkpoint-exec.test.ts:896:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(true);
tests/runner/fanout-runtime.test.ts:6:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/fanout-runtime.test.ts:10:  type CompiledFlowRunResult,
tests/runner/fanout-runtime.test.ts:19:import { RunResult } from '../../src/schemas/result.js';
tests/runner/fanout-runtime.test.ts:208:  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
tests/runner/fanout-runtime.test.ts:217:    const childResultAbs = resultPath(inv.runFolder);
tests/runner/fanout-runtime.test.ts:219:    const body = RunResult.parse({
tests/runner/fanout-runtime.test.ts:427:  readonly resultPath: string;
tests/runner/fanout-runtime.test.ts:440:  expect(branchCompleted.result_path).toBe(input.resultPath);
tests/runner/fanout-runtime.test.ts:468:      result_path: input.resultPath,
tests/runner/fanout-runtime.test.ts:746:      resultPath: 'reports/branches/a/result.json',
tests/runner/fanout-runtime.test.ts:765:      resultPath: 'reports/branches/a/result.json',
tests/runner/fanout-runtime.test.ts:786:      resultPath: 'reports/branches/a/result.json',
tests/runner/fanout-runtime.test.ts:803:      resultPath: 'reports/branches/a/result.json',
tests/runner/fanout-runtime.test.ts:821:      resultPath: 'reports/branches/a/result.json',
tests/runner/fanout-runtime.test.ts:871:      resultPath: 'reports/branches/a/result.json',
tests/runner/runtime-smoke.test.ts:10:import { RunResult } from '../../src/schemas/result.js';
tests/runner/runtime-smoke.test.ts:90:  it('closes one run producing trace.ndjson / state.json / manifest.snapshot.json / reports/result.json', async () => {
tests/runner/runtime-smoke.test.ts:140:    // result.json parses as RunResult with the expected bindings.
tests/runner/runtime-smoke.test.ts:141:    const result = RunResult.parse(
tests/runner/runtime-smoke.test.ts:306:      const result = RunResult.parse(
tests/runner/sub-run-handler-direct.test.ts:20:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/sub-run-handler-direct.test.ts:24:  CompiledFlowRunResult,
tests/runner/sub-run-handler-direct.test.ts:32:import { RunResult } from '../../src/schemas/result.js';
tests/runner/sub-run-handler-direct.test.ts:168:  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
tests/runner/sub-run-handler-direct.test.ts:172:      // Per result-writer semantics, a checkpoint_waiting result is
tests/runner/sub-run-handler-direct.test.ts:173:      // not written to disk — the runner returns it on the CompiledFlowRunResult.
tests/runner/sub-run-handler-direct.test.ts:208:    const childResultAbs = resultPath(inv.runFolder);
tests/runner/sub-run-handler-direct.test.ts:212:    // Build a RunResult shape for the return value. The handler reads
tests/runner/sub-run-handler-direct.test.ts:217:      runResult = RunResult.parse(JSON.parse(body));
tests/runner/sub-run-handler-direct.test.ts:222:      runResult = RunResult.parse({
tests/runner/sub-run-handler-direct.test.ts:236:      result: runResult as CompiledFlowRunResult['result'],
tests/contracts/build-report-schemas.test.ts:422:      '<circuit-next-run-folder>/reports/result.json',
tests/runner/explore-e2e-parity.test.ts:383:        // CompiledFlowRunResult.relayResults (populated by runCompiledFlow;
tests/runner/explore-e2e-parity.test.ts:393:            'AGENT_SMOKE fingerprint promotion: no claude-code relay result captured (CompiledFlowRunResult.relayResults empty for connector=claude-code)',
tests/runner/sub-run-runtime.test.ts:6:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/sub-run-runtime.test.ts:10:  type CompiledFlowRunResult,
tests/runner/sub-run-runtime.test.ts:18:import { RunResult } from '../../src/schemas/result.js';
tests/runner/sub-run-runtime.test.ts:175:// runFolder/reports and returns a minimal CompiledFlowRunResult. This
tests/runner/sub-run-runtime.test.ts:184:  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
tests/runner/sub-run-runtime.test.ts:186:    const childResultAbs = resultPath(inv.runFolder);
tests/runner/sub-run-runtime.test.ts:188:    const body = RunResult.parse({
tests/runner/cli-router.test.ts:648:    expect(output.result_path).toBe(join(runFolder, 'reports/result.json'));
tests/contracts/relay-transcript-schema.test.ts:127:  result_path: 'reports/result.json',
tests/runner/runner-relay-provenance.test.ts:582:// CompiledFlowRunResult.relayResults surface for AGENT_SMOKE /
tests/runner/runner-relay-provenance.test.ts:586:describe('CompiledFlowRunResult.relayResults surfaces per-relay cli_version', () => {
tests/runner/build-report-writer.test.ts:216:    id: 'build-result-writer-test',
tests/runner/run-status-projection.test.ts:148:function writeResultPlaceholder(runFolder: string): void {
tests/runner/run-status-projection.test.ts:237:    writeResultPlaceholder(runFolder);
tests/runner/relay-invocation-failure.test.ts:12:import { RunResult } from '../../src/schemas/result.js';
tests/runner/relay-invocation-failure.test.ts:151:    const result = RunResult.parse(
tests/runner/run-relative-path.test.ts:76:    expect(resolveRunRelative(runFolder, 'reports/result.json')).toBe(
tests/runner/build-runtime-wiring.test.ts:393:    expect(existsSync(join(runFolder, 'reports/result.json'))).toBe(false);
tests/contracts/scalars.test.ts:94:    ['nested report', 'reports/result.json'],
tests/runner/review-runtime-wiring.test.ts:40:function loadFixtureWithRenamedAnalyzeResultPath(resultPath: string): {
tests/runner/review-runtime-wiring.test.ts:53:      step.writes.result = resultPath;
tests/runner/review-runtime-wiring.test.ts:57:        path === 'stages/analyze/review-raw-findings.json' ? resultPath : path,
tests/runner/cli-v2-runtime.test.ts:34:import { RunResult } from '../../src/schemas/result.js';
tests/runner/cli-v2-runtime.test.ts:948:      RunResult.parse(JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8'))),
tests/runner/cli-v2-runtime.test.ts:1013:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1118:      RunResult.parse(JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8'))),
tests/runner/cli-v2-runtime.test.ts:1150:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1205:    const childResult = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1223:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1309:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1391:          result_path: `${runFolder}/reports/result.json`,
tests/runner/cli-v2-runtime.test.ts:1451:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1511:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:1720:    const result = RunResult.parse(
tests/runner/cli-v2-runtime.test.ts:2420:      result_path: `${reviewRunFolder}/reports/result.json`,
tests/runner/cli-v2-runtime.test.ts:2447:      result_path: `${abortedRunFolder}/reports/result.json`,
tests/runner/fresh-run-root.test.ts:17:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/fresh-run-root.test.ts:93:      resultPath(runFolder),
tests/runner/fresh-run-root.test.ts:116:      expect(existsSync(resultPath(runFolder))).toBe(false);
tests/runner/fresh-run-root.test.ts:123:      expect(existsSync(resultPath(runFolder))).toBe(false);
tests/runner/fresh-run-root.test.ts:167:    expect(existsSync(resultPath(runFolder))).toBe(true);
tests/runner/fresh-run-root.test.ts:189:      ['result', resultPath],
src/runtime/connectors/relay-materializer.ts:73:  readonly resultPath: string;
src/runtime/connectors/relay-materializer.ts:228:    resultPath: resultAbs,
```

Phase 4.25 ownership conclusion:

```text
The shared result path helper is neutral now.
Do not merge retained and v2 result writers yet.
src/runtime/result-writer.ts remains the retained writer and compatibility surface.
```

## Runtime import references

```bash
rg -n "from ['\"].*runtime/|../runtime|../../runtime|runtime/" README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json -g "!docs/architecture/v2-runtime-import-inventory.md"
```

```text
commands/run.md:206:- `src/runtime/router.ts` (current deterministic classifier)
src/flows/catalog.ts:13:import { runtimeProofCompiledFlowPackage } from './runtime-proof/index.js';
docs/flows/authoring-model.md:19:- `src/runtime/compile-schematic-to-flow.ts` for schematic to compiled-flow projection.
specs/reference/legacy-circuit/review-characterization.md:34:~/Code/circuit/scripts/runtime/bin/dispatch.js  # the CLI (bundled)
specs/reference/legacy-circuit/review-characterization.md:173:existing step kinds at `src/runtime/runner.ts` are `dispatch` and
specs/reference/legacy-circuit/review-characterization.md:230:adapter surface (`src/runtime/adapters/`). The shape is cited here for
scripts/release/emit-current-capabilities.mjs:499:    evidence: ['src/runtime/router.ts'],
scripts/release/emit-current-capabilities.mjs:544:    evidence: ['src/schemas/connector.ts', 'src/runtime/relay-selection.ts'],
scripts/release/emit-current-capabilities.mjs:702:      evidence: ['src/runtime/runner.ts', 'src/cli/circuit.ts'],
scripts/release/emit-current-capabilities.mjs:717:      evidence: ['src/runtime/snapshot-writer.ts', 'src/runtime/runner.ts', 'src/cli/handoff.ts'],
scripts/release/emit-current-capabilities.mjs:733:      evidence: ['src/runtime/router.ts', 'tests/contracts/flow-router.test.ts'],
scripts/release/emit-current-capabilities.mjs:778:        'src/runtime/write-capable-worker-disclosure.ts',
scripts/release/emit-current-capabilities.mjs:779:        'src/runtime/runner.ts',
scripts/release/emit-current-capabilities.mjs:780:        'src/runtime/operator-summary-writer.ts',
scripts/release/emit-current-capabilities.mjs:801:      evidence: ['src/runtime/compile-schematic-to-flow.ts'],
tests/helpers/failure-message.ts:20:import type { StepHandlerResult } from '../../src/runtime/step-handlers/types.js';
commands/build.md:117:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
generated/release/current-capabilities.json:520:      "evidence": ["src/schemas/connector.ts", "src/runtime/relay-selection.ts"],
generated/release/current-capabilities.json:536:      "evidence": ["src/schemas/connector.ts", "src/runtime/relay-selection.ts"],
generated/release/current-capabilities.json:552:      "evidence": ["src/schemas/connector.ts", "src/runtime/relay-selection.ts"],
generated/release/current-capabilities.json:569:      "evidence": ["src/runtime/runner.ts", "src/cli/circuit.ts"],
generated/release/current-capabilities.json:586:      "evidence": ["src/runtime/snapshot-writer.ts", "src/runtime/runner.ts", "src/cli/handoff.ts"],
generated/release/current-capabilities.json:603:      "evidence": ["src/runtime/router.ts", "tests/contracts/flow-router.test.ts"],
generated/release/current-capabilities.json:1647:      "evidence": ["src/runtime/compile-schematic-to-flow.ts"],
generated/release/current-capabilities.json:1662:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1677:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1692:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1707:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1722:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1737:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1752:      "evidence": ["src/runtime/router.ts"],
generated/release/current-capabilities.json:1807:        "src/runtime/write-capable-worker-disclosure.ts",
generated/release/current-capabilities.json:1808:        "src/runtime/runner.ts",
generated/release/current-capabilities.json:1809:        "src/runtime/operator-summary-writer.ts"
plugins/circuit/skills/run/SKILL.md:194:- `src/runtime/router.ts` (current deterministic classifier)
src/flows/build/relay-hints.ts:3:import type { SchemaShapeHint } from '../../runtime/registries/shape-hints/types.js';
tests/helpers/failure-message.test.ts:17:import type { StepHandlerResult } from '../../src/runtime/step-handlers/types.js';
commands/explore.md:111:- `src/runtime/` (current runner)
plugins/circuit/skills/build/SKILL.md:121:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
src/flows/build/command.md:117:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
commands/fix.md:123:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
plugins/circuit/skills/fix/SKILL.md:127:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
src/flows/build/writers/plan.ts:10:} from '../../../runtime/registries/compose-writers/types.js';
docs/generated-surfaces.md:37:| `runtime-proof` | `internal` | `src/flows/runtime-proof/schematic.json` | `generated/flows/runtime-proof/circuit.json` | none; internal flow | none | none | Edit the flow package; host mirrors must not exist. |
scripts/release/capture-golden-run-proofs.mjs:16:import { writeComposeReport } from '../../dist/runtime/runner.js';
src/flows/build/writers/verification.ts:10:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/build/writers/verification.ts:16:} from '../../../runtime/registries/verification-writers/types.js';
plugins/circuit/commands/run.md:205:- `src/runtime/router.ts` (current deterministic classifier)
plugins/circuit/commands/build.md:116:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
src/flows/build/writers/close.ts:8:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/build/writers/close.ts:12:} from '../../../runtime/registries/close-writers/types.js';
docs/contracts/selection.md:142:  `src/runtime/connectors/*.ts` for connector-specific honoring.
docs/contracts/selection.md:271:## Property ids (Stage 2 runtime/property coverage)
src/flows/build/writers/checkpoint-brief.ts:22:} from '../../../runtime/registries/checkpoint-writers/types.js';
specs/reports.json:75:      "description": "Authoring-layer schematic shape for assembling reusable flow blocks into runnable compiled flows. Captures schematic steps, stage bindings, execution labels, typed evidence contracts, contract aliases, named route targets, and per-depth route_overrides. Compiled to generated/flows/<id>/circuit.json (and per-mode <mode>.json siblings) by src/runtime/compile-schematic-to-flow.ts at build time.",
specs/reports.json:252:      "trust_boundary": "operator-local derived state; state.json is written only by the reducer-derived snapshot writer at src/runtime/snapshot-writer.ts (never by step executors). A byte-match against a fresh reducer pass over run.trace is the re-entry check. Slice 27c lands the writer; re-entry byte-match enforcement in resume lands in Slice 27d+ per plan.",
specs/reports.json:279:      "trust_boundary": "operator-local persisted state; written once at bootstrap by the manifest snapshot writer at src/runtime/manifest-snapshot-writer.ts. Hash algorithm: SHA-256 over the exact persisted manifest snapshot bytes (`algorithm: 'sha256-raw'`), per ADR-0001 Addendum B §Stage 1.5 Close Criteria #8. Parse-time superRefine rejects any snapshot whose declared hash disagrees with sha256 over decoded bytes_base64; a second reader cannot be tricked into accepting a tampered byte-body under the declared hash.",
specs/reports.json:832:      "trust_boundary": "engine-computed at Close by the registered explore.result@v1 compose writer from schema-parsed compose.json and review-verdict.json plus flow-declared evidence link paths; terminal report — no in-run readers; cross-run reader is the run result consumer only; path-distinct from run.result so the engine's result-writer (src/runtime/result-writer.ts RESULT-I1 — single writer to result.json) and the orchestrator's close-step (flow-semantic aggregate at explore-result.json) do not collide",
scripts/release/lib.mjs:103:  return import(resolve(projectRoot, 'dist/runtime/router.js'));
plugins/circuit/commands/explore.md:110:- `src/runtime/` (current runner)
plugins/circuit/commands/fix.md:122:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
src/flows/sweep/relay-hints.ts:3:import type { SchemaShapeHint } from '../../runtime/registries/shape-hints/types.js';
plugins/circuit/skills/explore/SKILL.md:116:- `src/runtime/` (current runner)
docs/positioning-and-strategy.md:163:| Within-run continuity (pause/resume single run) | **Real** (`runtime/checkpoint.ts`, `schemas/continuity.ts`) |
docs/contracts/step.md:145:  `src/runtime/run-relative-path.ts` path is a retained compatibility wrapper.
docs/architecture/v2-checkpoint-4.22.md:21:- `src/runtime/config-loader.ts`
docs/architecture/v2-checkpoint-4.22.md:40:`src/runtime/config-loader.ts` is now a compatibility wrapper. Keep it until
docs/contracts/connector.md:126:    `src/runtime/connectors/codex.ts`; ADR-0009 §Consequences.Enabling is
docs/contracts/connector.md:175:  `src/runtime/connectors/custom.ts`.
docs/architecture/v2-checkpoint-4.16.md:23:`src/runtime/connectors/shared.ts` remains as a compatibility surface for those
docs/architecture/v2-checkpoint-4.16.md:31:Connector-only helpers remain in `src/runtime/connectors/shared.ts`:
src/flows/sweep/cross-report-validators.ts:19:} from '../../runtime/registries/close-writers/shared.js';
src/flows/sweep/cross-report-validators.ts:20:import type { CrossReportResult } from '../../runtime/registries/cross-report-validators.js';
docs/architecture/v2-checkpoint-4.9.md:23:`src/runtime/runner-types.ts` remains as a compatibility re-export and still
docs/architecture/v2-checkpoint-4.9.md:28:core-v2 no longer imports `src/runtime/runner-types.ts` for relay/progress
docs/architecture/v2-checkpoint-4.9.md:38:`src/runtime/runner-types.ts` or `src/runtime/runner.ts`.
docs/architecture/v2-checkpoint-4.6.md:60:fresh runs; it only includes runtime/runtime_reason fields in CLI JSON output.
docs/architecture/v2-checkpoint-4.8.md:16:First, `src/runtime/selection-resolver.ts` is not just a test oracle. It is
docs/architecture/v2-checkpoint-4.8.md:18:core-v2 relay through `src/runtime/relay-selection.ts`.
docs/architecture/v2-checkpoint-4.8.md:20:Second, `src/runtime/progress-projector.ts` is not only old runtime/test
docs/architecture/v2-checkpoint-4.8.md:33:find src/runtime -type f | sort
docs/architecture/v2-checkpoint-4.8.md:34:rg -n "from ['\"].*runtime/|../runtime|../../runtime|runtime/" src tests scripts docs specs package.json
docs/architecture/v2-checkpoint-4.8.md:47:1. Move shared relay/progress types out of `src/runtime/runner-types.ts`.
docs/architecture/v2-checkpoint-4.8.md:48:2. Move shared progress helper functions out of `src/runtime/progress-projector.ts`.
docs/architecture/v2-checkpoint-4.8.md:49:3. Move relay selection support out of `src/runtime/relay-selection.ts` and
docs/architecture/v2-checkpoint-4.8.md:50:   `src/runtime/selection-resolver.ts`.
docs/architecture/v2-registry-ownership-plan.md:7:The current registry modules live under `src/runtime/`, but they are not old
docs/architecture/v2-registry-ownership-plan.md:18:- `src/runtime/catalog-derivations.ts`;
docs/architecture/v2-registry-ownership-plan.md:19:- `src/runtime/registries/**`.
docs/architecture/v2-registry-ownership-plan.md:22:the package shape. `src/runtime/catalog-derivations.ts` turns packages into
docs/architecture/v2-registry-ownership-plan.md:30:| `src/runtime/catalog-derivations.ts` | Pure derivation layer from flow packages to registries and routable packages | router, registry modules, catalog tests, flow-router property tests | Duplicate detection, default route selection, schema/hint derivation, and report registry construction still depend on it | `src/flows/catalog-derivations.ts` or `src/flow-packages/catalog-derivations.ts` |
docs/architecture/v2-registry-ownership-plan.md:31:| `src/runtime/registries/compose-writers/*` | Compose writer lookup and read-path resolution | retained runner, core-v2 compose executor, flow writers/tests | Flow-owned compose reports are written through this lookup in both runtimes | `src/flows/registries/compose-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:32:| `src/runtime/registries/close-writers/*` | Close/result writer lookup and report-path helper | retained runner, core-v2 compose/close executor, flow close writers, cross-report validators, tests | Result writers and evidence-link path generation depend on it | `src/flows/registries/close-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:33:| `src/runtime/registries/verification-writers/*` | Verification writer lookup and writer type surface | retained verification handler, core-v2 verification executor, flow verification writers, tests | Verification report writing is shared runtime behavior | `src/flows/registries/verification-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:34:| `src/runtime/registries/checkpoint-writers/*` | Checkpoint brief writer lookup and writer type surface | retained checkpoint handler, core-v2 checkpoint executor, run status projection, Build checkpoint writer, tests | Checkpoint brief writing and status projection still rely on it | `src/flows/registries/checkpoint-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:35:| `src/runtime/registries/report-schemas.ts` | Relay report schema parse registry | retained relay/fanout handlers, core-v2 relay executor, report composition tests, connector smoke fingerprints | Fail-closed report parsing is a runtime safety boundary | `src/flows/registries/report-schemas.ts` |
docs/architecture/v2-registry-ownership-plan.md:36:| `src/runtime/registries/cross-report-validators.ts` | Cross-report validator registry | retained relay/fanout handlers, core-v2 relay executor, Sweep validators/tests | Enforces multi-report invariants that Zod cannot express alone | `src/flows/registries/cross-report-validators.ts` |
docs/architecture/v2-registry-ownership-plan.md:37:| `src/runtime/registries/shape-hints/*` | Relay shape hint lookup | shared relay prompt support, flow relay hints, tests | Prompt materialization still depends on flow-owned shape hints | `src/flows/registries/shape-hints/*` |
docs/architecture/v2-registry-ownership-plan.md:56:infrastructure. Reducing `src/runtime/` namespace pressure should not be
docs/architecture/v2-registry-ownership-plan.md:68:2. Move type-only registry surfaces first, with `src/runtime/registries/**`
docs/architecture/v2-registry-ownership-plan.md:71:   `src/runtime/catalog-derivations.ts`.
docs/architecture/v2-checkpoint-4.23.md:22:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-checkpoint-4.2.md:36:The complex flows still have direct v2 runtime/parity coverage, but the CLI
docs/architecture/v2-checkpoint-4.11.md:21:`src/runtime/selection-resolver.ts` remains as a compatibility re-export.
docs/architecture/v2-checkpoint-4.11.md:25:`src/runtime/relay-selection.ts` now imports selection precedence from the
docs/architecture/v2-result-writer-plan.md:16:| `src/runtime/result-writer.ts` | Retained runtime writer for `reports/result.json`; owns `resultPath(...)` and `writeResult(...)`. | Retained runner, retained status projection, retained sub-run/fanout handlers, retained tests. | Keep for now. Candidate future slice may move only the path helper. |
docs/architecture/v2-result-writer-plan.md:19:| `src/runtime/run-status-projection.ts` | Adds `result_path` for retained and v2 run folders. | `runs show`, CLI status tests. | Keep as cross-runtime status infrastructure. |
docs/architecture/v2-result-writer-plan.md:20:| `src/runtime/step-handlers/sub-run.ts` | Reads child `reports/result.json` and copies it into parent writes. | Retained sub-run fallback and tests. | Keep with retained handler. |
docs/architecture/v2-result-writer-plan.md:21:| `src/runtime/step-handlers/fanout.ts` | Reads child `reports/result.json` and copies it into branch result slots. | Retained fanout fallback and tests. | Keep with retained handler. |
docs/architecture/v2-result-writer-plan.md:97:| Retained runtime writer/readers | `src/runtime/result-writer.ts`, `src/runtime/runner.ts`, `src/runtime/run-status-projection.ts`, retained sub-run/fanout handlers | Retained execution and compatibility. |
docs/architecture/v2-result-writer-plan.md:126:- keep `src/runtime/result-writer.ts` as the retained writer;
docs/architecture/v2-result-writer-plan.md:149:npx vitest run tests/runner/runtime-smoke.test.ts
docs/architecture/v2-result-writer-plan.md:180:- delete `src/runtime/result-writer.ts`.
docs/architecture/v2-result-writer-plan.md:186:After a path-only move, `src/runtime/result-writer.ts` would still remain live
docs/architecture/v2-checkpoint-4.18.md:29:- old connector shared path: `src/runtime/connectors/shared.ts` compatibility
docs/architecture/v2-checkpoint-4.18.md:34:- `src/runtime/connectors/claude-code.ts`
docs/architecture/v2-checkpoint-4.18.md:35:- `src/runtime/connectors/codex.ts`
docs/architecture/v2-checkpoint-4.18.md:36:- `src/runtime/connectors/custom.ts`
docs/architecture/v2-checkpoint-4.18.md:37:- `src/runtime/connectors/relay-materializer.ts`
docs/architecture/v2-checkpoint-4.18.md:44:`src/runtime/registries/**` is shared flow-package and report infrastructure,
docs/architecture/v2-checkpoint-4.17.md:22:`src/runtime/connectors/shared.ts` remains as a compatibility surface for those
docs/architecture/v2-migration-plan.md:12:`src/runtime/`, `src/cli/`, `src/schemas/`, `src/flows/`, `docs/contracts/`,
docs/architecture/v2-migration-plan.md:128:`src/runtime/compile-schematic-to-flow.ts`, `src/schemas/step.ts`, flow
docs/architecture/v2-migration-plan.md:176:Files likely involved: old `src/runtime/*`, old runner imports, CLI runtime
docs/architecture/v2-checkpoint-4.10.md:21:`src/runtime/progress-projector.ts` remains as the old trace-to-progress
docs/architecture/v2-checkpoint-4.10.md:30:It no longer imports `src/runtime/progress-projector.ts`.
docs/architecture/v2-checkpoint-4.1.md:42:- `src/runtime/runner.ts`
docs/architecture/v2-checkpoint-4.1.md:43:- `src/runtime/runner-types.ts`
docs/architecture/v2-checkpoint-4.1.md:44:- `src/runtime/step-handlers/checkpoint.ts`
docs/architecture/v2-checkpoint-4.1.md:45:- `src/runtime/step-handlers/relay.ts`
docs/architecture/v2-checkpoint-4.1.md:46:- `src/runtime/step-handlers/verification.ts`
docs/architecture/v2-checkpoint-4.1.md:47:- `src/runtime/relay-selection.ts`
docs/architecture/v2-checkpoint-4.1.md:48:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-checkpoint-4.1.md:49:- `src/runtime/result-writer.ts`
docs/architecture/v2-checkpoint-4.20.md:21:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-checkpoint-4.20.md:44:`src/runtime/manifest-snapshot-writer.ts` is now a compatibility wrapper. Keep
docs/architecture/v2-checkpoint-4.20.md:62:- `npx vitest run tests/unit/runtime/event-log-round-trip.test.ts tests/runner/run-status-projection.test.ts tests/runner/fresh-run-root.test.ts tests/runner/handoff-hook-adapters.test.ts` passed.
docs/architecture/v2-checkpoint-4.md:30:- `src/runtime/runner.ts`
docs/architecture/v2-checkpoint-4.md:31:- `src/runtime/runner-types.ts`
docs/architecture/v2-checkpoint-4.md:32:- `src/runtime/step-handlers/checkpoint.ts`
docs/architecture/v2-checkpoint-4.md:33:- `src/runtime/step-handlers/compose.ts`
docs/architecture/v2-checkpoint-4.md:34:- `src/runtime/step-handlers/relay.ts`
docs/architecture/v2-checkpoint-4.md:35:- `src/runtime/step-handlers/sub-run.ts`
docs/architecture/v2-checkpoint-4.md:36:- `src/runtime/step-handlers/fanout.ts`
docs/architecture/v2-checkpoint-4.md:37:- `src/runtime/step-handlers/fanout/aggregate.ts`
docs/architecture/v2-checkpoint-4.md:38:- `src/runtime/step-handlers/fanout/branch-resolution.ts`
docs/architecture/v2-checkpoint-4.md:39:- `src/runtime/step-handlers/fanout/join-policy.ts`
docs/architecture/v2-checkpoint-4.md:40:- `src/runtime/step-handlers/fanout/types.ts`
docs/architecture/v2-checkpoint-4.md:41:- `src/runtime/step-handlers/verification.ts`
docs/architecture/v2-checkpoint-4.md:42:- `src/runtime/step-handlers/recovery-route.ts`
docs/architecture/v2-checkpoint-4.md:43:- `src/runtime/step-handlers/shared.ts`
docs/architecture/v2-checkpoint-4.md:44:- `src/runtime/step-handlers/types.ts`
docs/architecture/v2-checkpoint-4.md:46:The deletion should be a narrow approved slice, not a whole-tree `src/runtime/`
docs/architecture/v2-checkpoint-4.md:53:- `src/runtime/compile-schematic-to-flow.ts`
docs/architecture/v2-checkpoint-4.md:54:- `src/runtime/catalog-derivations.ts`
docs/architecture/v2-checkpoint-4.md:55:- `src/runtime/registries/**`
docs/architecture/v2-checkpoint-4.md:56:- `src/runtime/connectors/**`
docs/architecture/v2-checkpoint-4.md:57:- `src/runtime/config-loader.ts`
docs/architecture/v2-checkpoint-4.md:58:- `src/runtime/router.ts`
docs/architecture/v2-checkpoint-4.md:59:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-checkpoint-4.md:60:- `src/runtime/snapshot-writer.ts`
docs/architecture/v2-checkpoint-4.md:61:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-checkpoint-4.md:62:- `src/runtime/progress-projector.ts`
docs/architecture/v2-checkpoint-4.md:63:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-checkpoint-4.md:64:- `src/runtime/reducer.ts`
docs/architecture/v2-checkpoint-4.md:65:- `src/runtime/trace-reader.ts`
docs/architecture/v2-checkpoint-4.md:66:- `src/runtime/trace-writer.ts`
docs/architecture/v2-checkpoint-4.md:67:- `src/runtime/append-and-derive.ts`
docs/architecture/v2-checkpoint-4.md:68:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-checkpoint-4.md:69:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-checkpoint-4.md:70:- `src/runtime/run-relative-path.ts`
docs/architecture/v2-checkpoint-4.md:82:| `runtime/runner` | production CLI, release proof script, old runner tests, a few contract tests | replace with v2 before deleting runner |
docs/architecture/v2-checkpoint-4.md:83:| `runtime/step-handlers` | direct handler tests and property tests | delete or rewrite after v2 executor coverage is accepted |
docs/architecture/v2-checkpoint-4.md:84:| `runtime/registries` | flow packages, writer types, report schema helpers, catalog tests | retain or move before whole-runtime cleanup |
docs/architecture/v2-checkpoint-4.md:85:| `runtime/catalog-derivations` | catalog and router tests | retain or move |
docs/architecture/v2-checkpoint-4.md:86:| `runtime/compile-schematic-to-flow` | emit script and compiler tests | retain until compiler replacement |
docs/architecture/v2-checkpoint-4.md:87:| `runtime/relay-selection` | old relay provenance tests | replace with v2 connector/config tests |
docs/architecture/v2-checkpoint-4.md:88:| `runtime/selection-resolver` | flow model/effort contract test | replace with v2 config precedence tests |
docs/architecture/v2-checkpoint-4.md:94:rg -n "runCompiledFlow|executeCompiledFlow|compileSchematicToFlow|CompiledFlow|flow-schematic|runtime/runner|runtime/step-handlers|runtime/catalog-derivations|runtime/registries|relay-selection|selection-resolver" src tests docs specs scripts commands plugins .claude-plugin generated README.md package.json
docs/architecture/v2-checkpoint-4.md:95:rg -n "from ['\"].*runtime/(runner|step-handlers|catalog-derivations|registries|relay-selection|selection-resolver)|from ['\"].*runtime/(compile-schematic-to-flow)" src tests scripts
docs/architecture/v2-checkpoint-4.md:96:rg -l "from ['\"].*runtime/runner" src tests scripts
docs/architecture/v2-checkpoint-4.md:97:rg -l "from ['\"].*runtime/step-handlers" src tests scripts
docs/architecture/v2-checkpoint-4.md:98:rg -l "from ['\"].*runtime/registries" src tests scripts
docs/architecture/v2-checkpoint-4.md:99:rg -l "from ['\"].*runtime/(catalog-derivations|relay-selection|selection-resolver|compile-schematic-to-flow)" src tests scripts
docs/architecture/v2-checkpoint-4.md:209:- Deleting all of `src/runtime/` would remove live compiler/catalog/report/config
docs/architecture/v2-checkpoint-4.25.md:22:- `src/runtime/result-writer.ts`
docs/architecture/v2-checkpoint-4.25.md:24:- `src/runtime/runner.ts`
docs/architecture/v2-checkpoint-4.25.md:47:`src/runtime/result-writer.ts` keeps the old `resultPath(...)` export as a
docs/architecture/v2-checkpoint-4.25.md:56:`src/runtime/result-writer.ts` remains live because retained runtime still owns
src/flows/sweep/writers/queue.ts:12:} from '../../../runtime/registries/compose-writers/types.js';
docs/architecture/v2-heavy-boundary-plan.md:16:| Connector subprocess modules | `src/core-v2/executors/relay.ts`, retained relay selection, connector contract/smoke tests | Runs Claude Code, Codex, and custom connector commands; enforces argv, provider/model, timeout, output, and sandbox rules | External process execution and connector safety | Keep in `src/runtime/connectors/` until a dedicated connector-safety move | High | connector schema tests, real/controlled connector smoke, custom connector tests, CLI unsafe connector tests, full verify |
docs/architecture/v2-heavy-boundary-plan.md:55:   `src/runtime/` without touching connectors or runner fallback.
docs/architecture/v2-heavy-boundary-plan.md:80:No `src/runtime` file should be deleted as part of Phase 4.23.
docs/architecture/v2-checkpoint-4.24.md:36:`src/runtime/result-writer.ts` should remain the retained runtime writer, and
docs/architecture/v2-checkpoint-4.14.md:22:`src/runtime/write-capable-worker-disclosure.ts` remains as a compatibility
docs/architecture/v2-checkpoint-4.21.md:21:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-checkpoint-4.21.md:38:`src/runtime/operator-summary-writer.ts` is now a compatibility wrapper. Keep it
scripts/emit-flows.mjs:5:// src/runtime/compile-schematic-to-flow.ts (consumed here through
scripts/emit-flows.mjs:644:  // dist/runtime/compile-schematic-to-flow.js is produced by `npm run
scripts/emit-flows.mjs:647:  const distPath = resolve(projectRoot, 'dist/runtime/compile-schematic-to-flow.js');
docs/architecture/v2-checkpoint-4.1.1.md:25:  `src/runtime/relay-support.ts`, so `core-v2` no longer imports
docs/architecture/v2-checkpoint-4.1.1.md:26:  `src/runtime/step-handlers/relay.ts` directly.
docs/architecture/v2-checkpoint-4.1.1.md:32:- `src/runtime/runner.ts` remains the production CLI runner.
docs/architecture/v2-checkpoint-4.1.1.md:33:- `src/runtime/step-handlers/relay.ts` remains for the old runtime path and old
docs/architecture/v2-checkpoint-4.1.1.md:35:- `src/runtime/runner-types.ts` remains because `RelayFn` is still shared by the
docs/architecture/v2-rigor-audit.md:11:| Trace sequence authority | `src/runtime/runner.ts`, `src/schemas/run.ts`, `docs/contracts/run.md` | Trace corruption, duplicate sequence numbers, status projection drift | Reducer, progress projector, run status, reports | Runner `push()` assigns sequence numbers before append | keep | `trace/trace-store.ts` | `tests/runner/push-sequence-authority.test.ts`, `tests/contracts/runtrace-schema.test.ts` | One component must own sequence assignment. |
docs/architecture/v2-rigor-audit.md:12:| Run bootstrap rules | `src/runtime/runner.ts`, `src/schemas/run.ts`, `docs/contracts/run.md` | Ambiguous run identity, missing manifest snapshot, invalid resume base | CLI, run reducer, status reader | `run.bootstrapped` first entry, manifest snapshot writer, strict trace schema | keep | `run/run-context.ts` and trace store | Run trace schema tests, status projection tests | Bootstrap should stay explicit and single. |
docs/architecture/v2-rigor-audit.md:13:| Run close rules | `src/runtime/runner.ts`, `src/runtime/result-writer.ts`, `src/schemas/run.ts` | Runs that keep accepting entries after completion, wrong terminal result | CLI, status projection, operator summary | `run.closed`, result writer, trace close validation | keep | `run/graph-runner.ts` and `run/result-writer.ts` | Run trace and runner tests | Close should be a graph-runner responsibility, with result writing isolated. |
docs/architecture/v2-rigor-audit.md:14:| Resume rules | `src/runtime/runner.ts`, checkpoint handler, run status projection | Resuming the wrong checkpoint, stale request reuse, mismatched manifest | CLI resume path, checkpoint waiting state | Saved manifest, checkpoint request validation, resume choice checks | keep | `run/resume.ts` | Checkpoint and status projection tests | Keep behavior. Split resume from main runner. |
docs/architecture/v2-rigor-audit.md:15:| Connector capability rules | `docs/contracts/connector.md`, `src/schemas/connector.ts`, `src/runtime/connectors/` | Wrong connector writes, sandbox bypass, unsafe argv, unknown provider effort | Relay runtime, config resolution, tests | Schema checks, argv guards, subprocess flags, provider effort allowlists | keep | `connectors/resolver.ts` and connector modules | Connector schema, Codex, custom connector, identity tests | This is load-bearing and should not be loosened for migration speed. |
docs/architecture/v2-rigor-audit.md:16:| Selection/config precedence | `src/runtime/selection-resolver.ts`, `src/runtime/relay-selection.ts`, `docs/contracts/selection.md`, `docs/contracts/config.md` | Ambiguous model/effort/connector choice, hidden overrides | Relay prompt builder, CLI config loader | Layered config fold with applied provenance | keep | `domain/selection.ts` plus connector resolver | Config loader and selection tests | Preserve precedence. Simplify by making provenance a v2 first-class value. |
docs/architecture/v2-rigor-audit.md:18:| Schematic step validation | `src/schemas/flow-schematic.ts`, `src/runtime/compile-schematic-to-flow.ts` | Missing kind-specific fields, invalid reads/writes/checks | Compiler, flow packages | Flat optional authoring shape plus manual cross-field validation | simplify | Phase 5 authoring schemas, then adapter/compiler output validation | Flow schematic and compiler tests | Keep validation strength, reduce optional-field reasoning. |
docs/architecture/v2-rigor-audit.md:21:| Report schema validation | Flow package `reports.ts`, `src/runtime/registries/*`, connector materializer | Invalid report trusted downstream, bad relay result accepted | Relay executor, report readers, generated manifests | Flow-owned schemas and runtime parsing | keep | Flow-owned validators called by executors | Flow report schema tests and relay tests | Preserve flow package ownership. |
docs/architecture/v2-rigor-audit.md:22:| Checkpoint behavior | `src/runtime/step-handlers/checkpoint.ts`, checkpoint writers, Build writer | Bad pause/resume, wrong auto-resolution, invalid checkpoint report | Runner, CLI resume, status projection | Handler policy, checkpoint files, trace entries, flow-owned writers | simplify | `executors/checkpoint.ts`, `run/resume.ts`, flow-owned policy | Checkpoint handler, Build checkpoint tests | Preserve behavior but remove generic knowledge of Build-specific report shape. |
docs/architecture/v2-rigor-audit.md:23:| Fanout behavior | `src/runtime/step-handlers/fanout.ts`, `src/runtime/step-handlers/fanout/*` | Branch loss, partial failure mishandling, missing aggregate report, leaked worktree | Explore and Sweep flows, run status, report consumers | Large handler plus helper modules | simplify | `fanout/branch-expansion.ts`, `branch-execution.ts`, `worktree.ts`, `join-policy.ts`, `aggregate-report.ts`, `cleanup.ts` | Fanout runtime and property tests | Behavior is load-bearing; file shape needs decomposition. |
docs/architecture/v2-rigor-audit.md:24:| Sub-run behavior | `src/runtime/step-handlers/sub-run.ts` | Child run ambiguity, missing copied result, parent/child trace confusion | Migrate/Sweep flows, parent runner | Child run folder creation, child resolver, copied report/result | keep | `executors/sub-run.ts` plus `run/graph-runner.ts` child context | Sub-run runtime and recursion tests | Preserve identity and materialization rules. |
docs/architecture/v2-rigor-audit.md:26:| Runtime-proof flow | `src/flows/runtime-proof/`, generated internal flow | Runtime checks become public product shape or stale proof relic | Tests and generated internal manifest | Internal flow package | demote | Focused core-v2 test fixtures | Current catalog/generated tests | Keep only if it remains a useful internal fixture. Do not make it v2 architecture. |
docs/architecture/v2-rigor-audit.md:31:| Run file path safety | `src/schemas/scalars.ts`, `src/runtime/run-relative-path.ts`, step schema | Path traversal, symlink escape, write collision | Runtime writers, connectors, reports | Run-relative path parser and containment checks | keep | `run-files/paths.ts` and `run-file-store.ts` | Scalar and runner path tests | Keep explicit paths in executable manifests. |
docs/architecture/v2-rigor-audit.md:32:| Progress/status projection | `src/runtime/reducer.ts`, `src/runtime/progress-projector.ts`, `src/runtime/run-status-projection.ts` | Independent truth stores disagree with trace | CLI progress, run status, operator summary | Reducer and projection modules read trace and files | simplify | `projections/status.ts`, `progress.ts`, `task-state.ts`, `user-input.ts` | Progress projector and status tests | Preserve trace-first rule. Split projection from runner wording. |
docs/architecture/v2-rigor-audit.md:33:| Manifest snapshot and hash | `src/runtime/manifest-snapshot-writer.ts`, runner bootstrap | Resume against different flow bytes, impossible run audit | Resume path, status readers, tests | Snapshot writer and bootstrap metadata | keep | `manifest/` plus `run/run-context.ts` | Runner and resume tests | v2 should snapshot the executable manifest actually run. |
docs/architecture/v2-checkpoint-4.12.md:23:`src/runtime/relay-selection.ts` re-exports those helpers for compatibility.
docs/architecture/v2-checkpoint-4.12.md:29:`src/runtime/relay-selection.ts` still owns retained relayer resolution,
src/flows/sweep/writers/verification.ts:12:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/sweep/writers/verification.ts:18:} from '../../../runtime/registries/verification-writers/types.js';
docs/architecture/v2-checkpoint-4.7.md:49:Several files under `src/runtime/` are not old execution code and should be
docs/architecture/v2-checkpoint-4.19.md:21:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-checkpoint-4.19.md:43:`src/runtime/policy/flow-kind-policy.ts` is now a compatibility wrapper. Keep
docs/architecture/v2-checkpoint-4.15.md:20:`src/runtime/run-relative-path.ts` remains as a compatibility re-export.
docs/architecture/v2-connector-materializer-plan.md:11:- `src/runtime/connectors/shared.ts` is now a compatibility re-export surface.
docs/architecture/v2-connector-materializer-plan.md:20:| `src/runtime/connectors/claude-code.ts` | retained relay selection, core-v2 relay bridge, connector smoke tests, old runner tests | Owns Claude CLI argv, tool-surface restrictions, timeout and process-group kill behavior, stdout/stderr caps, provider/model/effort compatibility, JSON extraction at connector edge | Produces the shared `RelayResult` shape; does not write relay transcript files directly | `tests/runner/agent-connector-smoke.test.ts`, `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/explore-e2e-parity.test.ts`, `tests/contracts/connector-schema.test.ts`, full `npm run verify` | Keep in `src/runtime/connectors/` until a dedicated connector-safety move is reviewed |
docs/architecture/v2-connector-materializer-plan.md:21:| `src/runtime/connectors/codex.ts` | core-v2 relay bridge, retained relay selection, Codex connector contract tests, Codex smoke tests | Owns Codex CLI argv, read-only sandbox policy, forbidden argv checks, version capture, JSONL parse discipline, timeout and process-group kill behavior, provider/model/effort compatibility | Produces the shared `RelayResult` shape; does not write relay transcript files directly | `tests/contracts/codex-connector-schema.test.ts`, `tests/runner/codex-connector-smoke.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, full `npm run verify` | Keep in `src/runtime/connectors/` until a dedicated connector-safety move is reviewed |
docs/architecture/v2-connector-materializer-plan.md:22:| `src/runtime/connectors/custom.ts` | core-v2 relay bridge, retained relay selection, custom connector tests | Owns configured command invocation, prompt-file transport, temp-dir lifecycle, timeout and process-group kill behavior, output-size caps, JSON extraction at connector edge | Produces the shared `RelayResult` shape; writes temporary prompt/output files only, then removes the temp directory | `tests/runner/custom-connector-runtime.test.ts`, CLI custom connector precedence tests, full `npm run verify` | Keep in `src/runtime/connectors/` until custom connector execution policy is reviewed |
docs/architecture/v2-connector-materializer-plan.md:23:| `src/runtime/connectors/relay-materializer.ts` | retained relay handler tests, relay provenance tests, run-relative path tests, live smoke roundtrip tests | Owns translation from validated connector result to trace entries and durable relay slots; cross-checks role/provenance consistency | Writes request, receipt, result, and optional report files; emits the durable relay transcript sequence | `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, `tests/runner/runner-relay-provenance.test.ts`, `tests/runner/run-relative-path.test.ts`, `tests/runner/materializer-schema-parse.test.ts` | Keep until a materialization-contract plan proves byte-for-byte and trace-shape parity after a move |
docs/architecture/v2-connector-materializer-plan.md:24:| `src/runtime/connectors/shared.ts` | retained runtime imports, tests that still use the old connector surface | No subprocess behavior; compatibility only | No direct writes or trace entries | `tests/runner/connector-shared-compat.test.ts`, full `npm run verify` | Keep as a wrapper until old-path imports are migrated or intentionally retained |
docs/architecture/v2-connector-materializer-plan.md:33:- `src/runtime/connectors/codex.ts`;
docs/architecture/v2-connector-materializer-plan.md:36:- `src/runtime/connectors/shared.ts`;
docs/architecture/v2-connector-materializer-plan.md:37:- `src/runtime/connectors/relay-materializer.ts`;
docs/architecture/v2-connector-materializer-plan.md:38:- `src/runtime/runner.ts`;
docs/architecture/v2-connector-materializer-plan.md:39:- `src/runtime/registries/report-schemas.ts`.
docs/architecture/v2-connector-materializer-plan.md:43:- `src/runtime/connectors/claude-code.ts`;
docs/architecture/v2-connector-materializer-plan.md:46:- `src/runtime/connectors/shared.ts`;
docs/architecture/v2-connector-materializer-plan.md:47:- `src/runtime/connectors/relay-materializer.ts`;
docs/architecture/v2-connector-materializer-plan.md:48:- `src/runtime/runner.ts`;
docs/architecture/v2-connector-materializer-plan.md:49:- `src/runtime/registries/report-schemas.ts`.
docs/architecture/v2-connector-materializer-plan.md:94:   src/runtime/connectors for now.
docs/architecture/v2-checkpoint-4.13.md:24:`src/runtime/relay-support.ts` remains as a compatibility re-export.
docs/architecture/v2-checkpoint-4.13.md:33:- `src/runtime/registries/shape-hints/registry.ts`
docs/architecture/v2-checkpoint-4.13.md:34:- `src/runtime/run-relative-path.ts`
src/flows/sweep/writers/close.ts:11:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/sweep/writers/close.ts:15:} from '../../../runtime/registries/close-writers/types.js';
docs/architecture/v2-checkpoint-1.md:136:- `src/runtime/runner.ts`
docs/architecture/v2-checkpoint-1.md:137:- `src/runtime/compile-schematic-to-flow.ts`
docs/architecture/v2-checkpoint-1.md:138:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-checkpoint-1.md:139:- `src/runtime/relay-selection.ts`
docs/architecture/v2-checkpoint-1.md:140:- `src/runtime/catalog-derivations.ts`
docs/architecture/v2-checkpoint-1.md:141:- `src/runtime/reducer.ts`
docs/architecture/v2-checkpoint-1.md:142:- `src/runtime/progress-projector.ts`
docs/architecture/v2-checkpoint-1.md:143:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-checkpoint-1.md:144:- `src/runtime/run-relative-path.ts`
docs/architecture/v2-checkpoint-1.md:145:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-checkpoint-1.md:146:- `src/runtime/router.ts`
docs/architecture/v2-checkpoint-1.md:147:- `src/runtime/connectors/codex.ts`
docs/architecture/v2-checkpoint-1.md:148:- `src/runtime/connectors/claude-code.ts`
docs/architecture/v2-checkpoint-1.md:149:- `src/runtime/connectors/custom.ts`
docs/architecture/v2-checkpoint-1.md:150:- `src/runtime/step-handlers/checkpoint.ts`
docs/architecture/v2-checkpoint-1.md:151:- `src/runtime/step-handlers/sub-run.ts`
docs/architecture/v2-checkpoint-1.md:152:- `src/runtime/step-handlers/fanout.ts`
docs/architecture/v2-checkpoint-1.md:153:- `src/runtime/step-handlers/fanout/aggregate.ts`
docs/architecture/v2-checkpoint-1.md:154:- `src/runtime/step-handlers/fanout/branch-resolution.ts`
docs/architecture/v2-checkpoint-1.md:155:- `src/runtime/step-handlers/fanout/join-policy.ts`
docs/architecture/v2-checkpoint-1.md:156:- `src/runtime/step-handlers/fanout/types.ts`
docs/architecture/v2-deletion-plan.md:50:| `src/runtime/runner.ts` | retained execution path | The CLI still imports `runCompiledFlow` for unsupported modes, rollback, arbitrary fixtures, `composeWriter`, and checkpoint resume. Release proof scripts and many runner tests still use it. |
docs/architecture/v2-deletion-plan.md:51:| `src/runtime/runner-types.ts` | compatibility re-export plus retained runtime types | core-v2 imports shared relay/progress/run callback types from `src/shared/relay-runtime-types.ts`. Keep this file until retained runtime and tests stop importing the old surface. |
docs/architecture/v2-deletion-plan.md:52:| `src/runtime/step-handlers/checkpoint.ts` | checkpoint pause/resume and retained checkpoint modes | v2 handles fresh safe checkpoint choices, but checkpoint waiting and resume stay retained-runtime-owned. |
docs/architecture/v2-deletion-plan.md:53:| `src/runtime/step-handlers/compose.ts` | retained fallback and programmatic compose writer hook | core-v2 uses catalog writers, but `main(..., { composeWriter })` intentionally falls back to retained runtime. |
docs/architecture/v2-deletion-plan.md:54:| `src/runtime/step-handlers/relay.ts` | retained relay handler and oracle tests | core-v2 no longer imports this file directly, but retained runtime and handler tests still do. |
docs/architecture/v2-deletion-plan.md:55:| `src/runtime/step-handlers/sub-run.ts` | retained fallback and oracle tests | core-v2 has sub-run coverage, but unsupported fallback paths and old tests still rely on the old handler. |
docs/architecture/v2-deletion-plan.md:56:| `src/runtime/step-handlers/fanout.ts` and `src/runtime/step-handlers/fanout/*` | retained fallback and fanout oracle tests | core-v2 has fanout slices, but old fanout behavior remains the comparison oracle. |
docs/architecture/v2-deletion-plan.md:57:| `src/runtime/step-handlers/verification.ts` | retained fallback and verification oracle tests | core-v2 can run flow-owned verification writers, but old verification tests remain useful until migration. |
docs/architecture/v2-deletion-plan.md:58:| `src/runtime/step-handlers/recovery-route.ts` | retained runner recovery behavior | core-v2 has bounded recovery tests, but old runner tests still cover the retained path. |
docs/architecture/v2-deletion-plan.md:59:| `src/runtime/step-handlers/shared.ts`, `src/runtime/step-handlers/types.ts`, `src/runtime/step-handlers/index.ts` | retained handler support | Delete only with the old handler cluster. |
docs/architecture/v2-deletion-plan.md:67:These files live under `src/runtime/`, but they are not simply old graph-runner
docs/architecture/v2-deletion-plan.md:72:| `src/runtime/compile-schematic-to-flow.ts` | keep / compiler infrastructure | `scripts/emit-flows.mjs`, compiler tests, and generated flow output still use it. |
docs/architecture/v2-deletion-plan.md:73:| `src/runtime/catalog-derivations.ts` | keep / catalog infrastructure | Router, generated surfaces, and catalog tests depend on catalog-derived data. |
docs/architecture/v2-deletion-plan.md:74:| `src/runtime/registries/**` | keep / later move | Flow packages, v2 report validation, writer discovery, cross-report validators, and shape hints depend on these registries. |
docs/architecture/v2-deletion-plan.md:75:| `src/runtime/connectors/**` | keep / later move | core-v2 reuses real connector subprocesses, relay materialization, and argv validation. The relay data/hash surface moved to `src/shared/connector-relay.ts` in Phase 4.16, and connector parsing/model helpers moved to `src/shared/connector-helpers.ts` in Phase 4.17. Subprocess modules and materialization remain production safety infrastructure. |
docs/architecture/v2-deletion-plan.md:76:| `src/runtime/relay-support.ts` | compatibility re-export | Relay prompt and check helpers moved to `src/shared/relay-support.ts` in Phase 4.13. Keep this wrapper until retained relay handler imports and old tests stop using the old path. |
docs/architecture/v2-deletion-plan.md:77:| `src/runtime/config-loader.ts` | compatibility re-export | Config discovery moved to `src/shared/config-loader.ts` in Phase 4.22. Keep this wrapper until old-path tests and external imports stop using it. |
docs/architecture/v2-deletion-plan.md:78:| `src/runtime/router.ts` | keep / later move | Natural-language flow selection still uses the current router. |
docs/architecture/v2-deletion-plan.md:79:| `src/runtime/relay-selection.ts` | retained relay decision bridge | Selection-depth helpers moved to `src/shared/relay-selection.ts` in Phase 4.12. Keep this file for retained relayer resolution, connector bridge behavior, old relay handler imports, and relay provenance tests. |
docs/architecture/v2-deletion-plan.md:80:| `src/runtime/selection-resolver.ts` | compatibility re-export | Selection precedence logic moved to `src/shared/selection-resolver.ts` in Phase 4.11. Keep this wrapper until retained runtime tests and external imports stop using the old path. |
docs/architecture/v2-deletion-plan.md:81:| `src/runtime/result-writer.ts` | retain retained writer / compatibility path export | core-v2 has its own result writer, but retained runtime and old result tests still use this one. Phase 4.25 moved only the shared `reports/result.json` path helper to `src/shared/result-path.ts`; do not merge the writers yet. |
docs/architecture/v2-deletion-plan.md:82:| `src/runtime/manifest-snapshot-writer.ts` | compatibility re-export | Manifest snapshot byte-match helper moved to `src/shared/manifest-snapshot.ts` in Phase 4.20. Keep this wrapper while retained runner and old snapshot tests use the old path. |
docs/architecture/v2-deletion-plan.md:83:| `src/runtime/snapshot-writer.ts` | retain for state snapshots and continuity | Used by retained runner, checkpoint handler, `append-and-derive`, `cli/handoff`, event-log round-trip tests, fresh-run-root tests, release evidence, and state snapshot behavior. |
docs/architecture/v2-deletion-plan.md:84:| `src/runtime/operator-summary-writer.ts` | compatibility re-export | Operator summary writing moved to `src/shared/operator-summary-writer.ts` in Phase 4.21. Keep this wrapper until old-path tests and release evidence stop using it. |
docs/architecture/v2-deletion-plan.md:85:| `src/runtime/run-status-projection.ts` | keep | This is now the compatibility projector for both v1 and v2 run folders. |
docs/architecture/v2-deletion-plan.md:86:| `src/runtime/progress-projector.ts` | retained trace-to-progress projection | core-v2 imports shared helpers from `src/shared/progress-output.ts`. Keep this file for old trace projection, retained runtime imports, and old progress tests. |
docs/architecture/v2-deletion-plan.md:87:| `src/runtime/reducer.ts`, `src/runtime/append-and-derive.ts`, `src/runtime/trace-reader.ts`, `src/runtime/trace-writer.ts` | retain until trace/projection tests migrate | Old trace infrastructure remains the v1 oracle and status/progress source for retained runs. |
docs/architecture/v2-deletion-plan.md:88:| `src/runtime/policy/flow-kind-policy.ts` | compatibility re-export | Flow-kind policy moved to `src/shared/flow-kind-policy.ts` in Phase 4.19. Keep this wrapper until old-path imports and documentation references stop using it. |
docs/architecture/v2-deletion-plan.md:89:| `src/runtime/write-capable-worker-disclosure.ts` | compatibility re-export | Disclosure helper moved to `src/shared/write-capable-worker-disclosure.ts` in Phase 4.14. Keep this wrapper while release evidence, old-path compatibility tests/docs, or external old-path consumers still cite the wrapper. |
docs/architecture/v2-deletion-plan.md:90:| `src/runtime/run-relative-path.ts` | compatibility re-export | Run-relative path helper moved to `src/shared/run-relative-path.ts` in Phase 4.15. Keep this wrapper while retained runtime, connector materialization, old handlers, projection, and operator summary imports use the old path. |
docs/architecture/v2-deletion-plan.md:97:../runtime
docs/architecture/v2-deletion-plan.md:98:../../runtime
docs/architecture/v2-deletion-plan.md:99:runtime/
docs/architecture/v2-deletion-plan.md:107:| `runtime/runner` | `src/cli/circuit.ts`, release proof script, many `tests/runner/*`, selected contract tests | retained execution | Keep until unsupported modes, rollback, `composeWriter`, fixtures, and checkpoint resume have explicit replacement or retained-module ownership. |
docs/architecture/v2-deletion-plan.md:108:| `runtime/runner-types` | retained runtime, `src/cli/circuit.ts`, tests | compatibility re-export | core-v2 no longer imports this file. Keep until retained runtime and tests stop importing the old type surface. |
docs/architecture/v2-deletion-plan.md:109:| `runtime/step-handlers` | direct handler tests and retained runner | retained execution oracle | Migrate tests only after v2 owns the behavior or the behavior stays retained by policy. |
docs/architecture/v2-deletion-plan.md:110:| `runtime/registries` | flow packages, core-v2 report validation, tests | live infrastructure | Move to neutral flow-package infrastructure before deleting any runtime namespace. |
docs/architecture/v2-deletion-plan.md:111:| `runtime/connectors` | core-v2 relay bridge, retained runtime, connector tests | live connector infrastructure | Keep. Shared relay data/hash ownership moved to `src/shared/connector-relay.ts`, and connector helper ownership moved to `src/shared/connector-helpers.ts`, but subprocess modules and materialization remain production safety infrastructure. |
docs/architecture/v2-deletion-plan.md:112:| `runtime/relay-support` | old relay handler and compatibility imports | compatibility re-export | core-v2 no longer imports this file. Shared helper ownership now lives in `src/shared/relay-support.ts`. |
docs/architecture/v2-deletion-plan.md:113:| `runtime/relay-selection` | retained relay handler, old runner, and old relay tests | retained relay decision bridge | core-v2 no longer imports this file. Keep until retained relayer resolution and connector bridge behavior move or stay behind an explicit retained module. |
docs/architecture/v2-deletion-plan.md:114:| `runtime/selection-resolver` | retained tests and compatibility imports | compatibility re-export | Neutral ownership now lives in `src/shared/selection-resolver.ts`; keep wrapper until old-path imports migrate. |
docs/architecture/v2-deletion-plan.md:180:find src/runtime -type f | sort
docs/architecture/v2-deletion-plan.md:181:rg -n "from ['\"].*runtime/|../runtime|../../runtime|runtime/" src tests scripts docs specs package.json
docs/architecture/v2-deletion-plan.md:195:| Move shared relay/progress types out of `src/runtime/runner-types.ts` | Done in Phase 4.9 for `RelayFn`, `RelayInput`, `ProgressReporter`, and `RuntimeEvidencePolicy`. `runner-types.ts` remains as a compatibility re-export plus retained runtime invocation/result types. | Keep full validation green while retained runtime and tests continue importing the old surface. |
docs/architecture/v2-deletion-plan.md:196:| Move progress helper functions out of `src/runtime/progress-projector.ts` | Done in Phase 4.10 for `progressDisplay` and `reportProgress`. `progress-projector.ts` re-exports them for compatibility and still owns old trace-to-progress projection. | Keep progress schema tests, old progress-projector tests, CLI v2 progress tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:197:| Move relay selection support to a neutral module | Mostly done in Phases 4.11 and 4.12 for selection ownership: `src/shared/selection-resolver.ts` owns `resolveSelectionForRelay`, and `src/shared/relay-selection.ts` owns depth-bound selection derivation. `src/runtime/relay-selection.ts` remains for retained relayer resolution and connector bridge behavior. | Config loader tests, selection contract tests, relay provenance tests, core-v2 connector tests, CLI custom connector precedence tests, full `npm run verify`. |
docs/architecture/v2-deletion-plan.md:198:| Move run-relative path helper out of `src/runtime/run-relative-path.ts` | Done in Phase 4.15 for `resolveRunRelative`. Flow writers and shared relay support now import `src/shared/run-relative-path.ts`; the runtime file remains a compatibility re-export for retained runtime surfaces. | Keep run-relative path containment tests, materializer tests, report writer tests, CLI v2 tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:199:| Move connector relay data/hash helper out of `src/runtime/connectors/shared.ts` | Done in Phase 4.16 for `ConnectorRelayInput`, `RelayResult`, and `sha256Hex`. `src/runtime/connectors/shared.ts` remains for compatibility re-exports plus connector-only parsing/model helpers. | Keep connector wrapper compatibility tests, relay/materializer tests, connector selection tests, connector smoke source fingerprint lists, and full validation green. |
docs/architecture/v2-deletion-plan.md:200:| Move connector-only helpers out of `src/runtime/connectors/shared.ts` | Done in Phase 4.17 for `selectedModelForProvider` and `extractJsonObject`. `src/runtime/connectors/shared.ts` remains as a compatibility re-export surface. | Keep connector helper compatibility tests, extraction tests, connector smoke source fingerprint lists, subprocess connector smoke tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:202:| Move flow-kind policy wrapper out of `src/runtime/policy/flow-kind-policy.ts` | Done in Phase 4.19. The neutral wrapper lives in `src/shared/flow-kind-policy.ts`; the runtime path remains a compatibility re-export. | Keep flow-kind policy tests, CLI fixture policy tests, generated-surface drift checks, and full validation green. |
docs/architecture/v2-deletion-plan.md:203:| Move manifest snapshot helper out of `src/runtime/manifest-snapshot-writer.ts` | Done in Phase 4.20. The byte-match implementation lives in `src/shared/manifest-snapshot.ts`; the runtime path remains a compatibility re-export. | Keep event-log round-trip tests, run-status projection tests, fresh-run-root tests, handoff tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:204:| Move operator summary writer out of `src/runtime/operator-summary-writer.ts` | Done in Phase 4.21. The implementation lives in `src/shared/operator-summary-writer.ts`; the runtime path remains a compatibility re-export. | Keep operator summary tests, CLI v2 runtime tests, release evidence checks, and full validation green. |
docs/architecture/v2-deletion-plan.md:205:| Move config loader out of `src/runtime/config-loader.ts` | Done in Phase 4.22. The schema-backed config discovery implementation lives in `src/shared/config-loader.ts`; the runtime path remains a compatibility re-export. | Keep config-loader tests, CLI v2 runtime tests, connector selection tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:208:| Move the shared run result path helper | Done in Phase 4.25. `src/shared/result-path.ts` owns `RUN_RESULT_RELATIVE_PATH` and `runResultPath(...)`; `src/runtime/result-writer.ts` keeps the compatibility `resultPath(...)` export. | Keep `src/runtime/result-writer.ts` as the retained writer; this move does not make it deletable. |
docs/architecture/v2-worklog.md:17:- `src/runtime/`
docs/architecture/v2-worklog.md:18:- `src/runtime/connectors/`
docs/architecture/v2-worklog.md:19:- `src/runtime/step-handlers/`
docs/architecture/v2-worklog.md:65:  lives in generic schema/runtime surfaces.
docs/architecture/v2-worklog.md:188:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:301:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-worklog.md:350:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:398:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:399:- `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:400:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:401:- `src/runtime/step-handlers/`
docs/architecture/v2-worklog.md:476:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:525:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:587:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:588:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-worklog.md:642:- `src/runtime/**`
docs/architecture/v2-worklog.md:643:- current imports referencing `src/runtime/`
docs/architecture/v2-worklog.md:669:- `src/runtime/runner.ts` remains live for retained fallback, rollback,
docs/architecture/v2-worklog.md:672:- Several `src/runtime/` modules are shared infrastructure and should be moved
docs/architecture/v2-worklog.md:685:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:686:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-worklog.md:688:- `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:725:shared relay/progress callback types out of `src/runtime/runner-types.ts`.
docs/architecture/v2-worklog.md:729:- `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:740:- `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:763:Behavior changed? No runtime behavior changed. `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:779:the shared progress output helpers out of `src/runtime/progress-projector.ts`.
docs/architecture/v2-worklog.md:783:- `src/runtime/progress-projector.ts`
docs/architecture/v2-worklog.md:791:- `src/runtime/progress-projector.ts`
docs/architecture/v2-worklog.md:818:- `src/runtime/progress-projector.ts` remains live for retained runtime and old
docs/architecture/v2-worklog.md:827:precedence resolver out of `src/runtime/selection-resolver.ts`.
docs/architecture/v2-worklog.md:831:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-worklog.md:832:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:840:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-worklog.md:841:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:871:- `src/runtime/relay-selection.ts` remains live for retained relay decision
docs/architecture/v2-worklog.md:875:leaving retained relayer resolution in `runtime/relay-selection.ts`.
docs/architecture/v2-worklog.md:879:Goal: reduce core-v2's dependency on `src/runtime/relay-selection.ts` by moving
docs/architecture/v2-worklog.md:885:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:886:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:887:- `src/runtime/step-handlers/relay.ts`
docs/architecture/v2-worklog.md:896:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:918:`src/shared/relay-selection.ts`; `src/runtime/relay-selection.ts` re-exports
docs/architecture/v2-worklog.md:924:- `src/runtime/relay-selection.ts` remains live for retained relayer resolution,
docs/architecture/v2-worklog.md:933:Goal: reduce core-v2's dependency on `src/runtime/relay-support.ts` by moving
docs/architecture/v2-worklog.md:938:- `src/runtime/relay-support.ts`
docs/architecture/v2-worklog.md:939:- `src/runtime/step-handlers/relay.ts`
docs/architecture/v2-worklog.md:940:- `src/runtime/step-handlers/fanout.ts`
docs/architecture/v2-worklog.md:947:- `src/runtime/relay-support.ts`
docs/architecture/v2-worklog.md:969:`src/runtime/relay-support.ts` re-exports them for retained runtime
docs/architecture/v2-worklog.md:983:Goal: reduce core-v2's dependency on `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:988:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:990:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:991:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:997:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:1019:`src/runtime/write-capable-worker-disclosure.ts` re-exports them for retained
docs/architecture/v2-worklog.md:1027:Next recommended action: inspect `src/runtime/run-relative-path.ts` as the next
docs/architecture/v2-worklog.md:1034:`src/runtime/run-relative-path.ts` without changing path safety semantics.
docs/architecture/v2-worklog.md:1038:- `src/runtime/run-relative-path.ts`
docs/architecture/v2-worklog.md:1047:- `src/runtime/run-relative-path.ts`
docs/architecture/v2-worklog.md:1071:in `src/shared/run-relative-path.ts`; `src/runtime/run-relative-path.ts`
docs/architecture/v2-worklog.md:1087:`src/runtime/connectors/shared.ts` without moving connector subprocess modules
docs/architecture/v2-worklog.md:1092:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1103:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1131:`src/runtime/connectors/shared.ts` re-exports them for retained runtime and
docs/architecture/v2-worklog.md:1152:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1153:- `src/runtime/connectors/claude-code.ts`
docs/architecture/v2-worklog.md:1154:- `src/runtime/connectors/codex.ts`
docs/architecture/v2-worklog.md:1155:- `src/runtime/connectors/custom.ts`
docs/architecture/v2-worklog.md:1163:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1164:- `src/runtime/connectors/claude-code.ts`
docs/architecture/v2-worklog.md:1165:- `src/runtime/connectors/codex.ts`
docs/architecture/v2-worklog.md:1166:- `src/runtime/connectors/custom.ts`
docs/architecture/v2-worklog.md:1194:`src/runtime/connectors/shared.ts` re-exports them for retained runtime and old
docs/architecture/v2-worklog.md:1215:- `src/runtime/connectors/claude-code.ts`
docs/architecture/v2-worklog.md:1216:- `src/runtime/connectors/codex.ts`
docs/architecture/v2-worklog.md:1217:- `src/runtime/connectors/custom.ts`
docs/architecture/v2-worklog.md:1218:- `src/runtime/connectors/relay-materializer.ts`
docs/architecture/v2-worklog.md:1219:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1220:- `src/runtime/registries/**`
docs/architecture/v2-worklog.md:1221:- `src/runtime/catalog-derivations.ts`
docs/architecture/v2-worklog.md:1278:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1280:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:1288:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1290:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:1312:- `src/runtime/result-writer.ts` is still live and not deletable.
docs/architecture/v2-worklog.md:1327:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1331:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:1332:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1333:- `src/runtime/step-handlers/sub-run.ts`
docs/architecture/v2-worklog.md:1334:- `src/runtime/step-handlers/fanout.ts`
docs/architecture/v2-worklog.md:1335:- `tests/runner/runtime-smoke.test.ts`
docs/architecture/v2-worklog.md:1426:- `src/runtime/config-loader.ts`
docs/architecture/v2-worklog.md:1434:- `src/runtime/config-loader.ts`
docs/architecture/v2-worklog.md:1453:`src/shared/config-loader.ts`; `src/runtime/config-loader.ts` re-exports it for
docs/architecture/v2-worklog.md:1474:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1483:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1504:lives in `src/shared/operator-summary-writer.ts`; `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1526:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-worklog.md:1528:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1530:- `tests/unit/runtime/event-log-round-trip.test.ts`
docs/architecture/v2-worklog.md:1536:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-worklog.md:1537:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1539:- `tests/unit/runtime/event-log-round-trip.test.ts`
docs/architecture/v2-worklog.md:1549:- `npx vitest run tests/unit/runtime/event-log-round-trip.test.ts tests/runner/run-status-projection.test.ts tests/runner/fresh-run-root.test.ts tests/runner/handoff-hook-adapters.test.ts`
docs/architecture/v2-worklog.md:1557:`src/runtime/manifest-snapshot-writer.ts` re-exports it for compatibility.
docs/architecture/v2-worklog.md:1580:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:1592:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:1616:now lives in `src/shared/flow-kind-policy.ts`; `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:1639:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1650:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1694:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1707:- `src/runtime/run-status-projection.ts`
docs/architecture/v2-worklog.md:1852:- `src/runtime/step-handlers/relay.ts`
docs/architecture/v2-worklog.md:1853:- `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:1862:- `src/runtime/relay-support.ts`
docs/architecture/v2-worklog.md:1863:- `src/runtime/step-handlers/relay.ts`
docs/architecture/v2-worklog.md:1889:- `RelayFn` still lives in `src/runtime/runner-types.ts` and should move to a
docs/architecture/v2-worklog.md:2231:- `src/runtime/catalog-derivations.ts`
docs/architecture/v2-worklog.md:2288:- `src/runtime/`
docs/architecture/v2-worklog.md:2289:- `src/runtime/runner.ts`
docs/architecture/v2-worklog.md:2290:- `src/runtime/runner-types.ts`
docs/architecture/v2-worklog.md:2291:- `src/runtime/step-handlers/`
docs/architecture/v2-worklog.md:2292:- `src/runtime/compile-schematic-to-flow.ts`
docs/architecture/v2-worklog.md:2293:- `src/runtime/catalog-derivations.ts`
docs/architecture/v2-worklog.md:2294:- `src/runtime/selection-resolver.ts`
docs/architecture/v2-worklog.md:2295:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:2296:- `src/runtime/registries/`
docs/architecture/v2-worklog.md:2329:- Some files under `src/runtime/` are still live compiler, catalog, registry,
docs/architecture/v2-worklog.md:2385:- `src/runtime/compile-schematic-to-flow.ts`
docs/architecture/v2-worklog.md:2468:- `src/runtime/step-handlers/sub-run.ts`
docs/architecture/v2-worklog.md:2469:- `src/runtime/step-handlers/fanout.ts`
docs/architecture/v2-worklog.md:2470:- `src/runtime/step-handlers/fanout/branch-resolution.ts`
docs/architecture/v2-worklog.md:2471:- `src/runtime/step-handlers/fanout/join-policy.ts`
docs/architecture/v2-worklog.md:2472:- `src/runtime/relay-selection.ts`
docs/architecture/v2-worklog.md:2473:- `src/runtime/connectors/claude-code.ts`
docs/architecture/v2-worklog.md:2474:- `src/runtime/connectors/codex.ts`
src/flows/sweep/writers/brief.ts:12:} from '../../../runtime/registries/compose-writers/types.js';
tests/contracts/terminology-product-surface.test.ts:174:        'internal/runtime names belong inside backticks or fenced code,',
tests/contracts/terminology-product-surface.test.ts:214:    expect(raw).not.toMatch(/\bsrc\/runtime\/compile-recipe-to-flow\.ts\b/);
tests/contracts/terminology-product-surface.test.ts:219:    expect(raw).toMatch(/\bsrc\/runtime\/compile-schematic-to-flow\.ts\b/);
tests/runner/fanout-handler-direct.test.ts:18:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/fanout-handler-direct.test.ts:25:} from '../../src/runtime/runner.js';
tests/runner/fanout-handler-direct.test.ts:26:import { runFanoutStep } from '../../src/runtime/step-handlers/fanout.js';
tests/runner/fanout-handler-direct.test.ts:27:import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
tests/unit/compile-schematic-per-mode.test.ts:10:import { compileSchematicToCompiledFlow } from '../../src/runtime/compile-schematic-to-flow.js';
tests/contracts/orphan-blocks.test.ts:24:} from '../../src/runtime/compile-schematic-to-flow.js';
tests/contracts/orphan-blocks.test.ts:25:import { runCompiledFlow, writePrototypeComposeReport } from '../../src/runtime/runner.js';
tests/runner/terminal-outcome-mapping.test.ts:6:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/terminal-outcome-mapping.test.ts:7:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/terminal-outcome-mapping.test.ts:12:} from '../../src/runtime/runner.js';
tests/runner/terminal-outcome-mapping.test.ts:13:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/contracts/codex-host-plugin.test.ts:17:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/contracts/codex-host-plugin.test.ts:18:import type { RelayInput } from '../../src/runtime/runner.js';
tests/contracts/codex-host-plugin.test.ts:460:    expect(existsSync(resolve(PLUGIN_ROOT, 'flows/runtime-proof'))).toBe(false);
tests/contracts/codex-host-plugin.test.ts:461:    expect(existsSync(resolve(REPO_ROOT, '.claude-plugin/skills/runtime-proof'))).toBe(false);
tests/contracts/flow-router.test.ts:3:import { ROUTABLE_WORKFLOWS, classifyCompiledFlowTask } from '../../src/runtime/router.js';
tests/contracts/flow-model-effort.test.ts:6:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/contracts/flow-model-effort.test.ts:7:import { type RelayFn, type RelayInput, runCompiledFlow } from '../../src/runtime/runner.js';
tests/contracts/compile-schematic-to-flow.test.ts:7:} from '../../src/runtime/compile-schematic-to-flow.js';
tests/properties/visible/flow-router-tiebreak.test.ts:3:// src/runtime/router.ts.
tests/properties/visible/flow-router-tiebreak.test.ts:32:import type { RoutablePackage } from '../../../src/runtime/catalog-derivations.js';
tests/properties/visible/flow-router-tiebreak.test.ts:33:import { classifyTaskAgainstRoutables } from '../../../src/runtime/router.js';
tests/runner/fanout-runtime.test.ts:6:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/fanout-runtime.test.ts:15:} from '../../src/runtime/runner.js';
tests/runner/fanout-runtime.test.ts:801:      reason: /runtime-proof-strict@v1/,
tests/unit/runtime/event-log-round-trip.test.ts:19:} from '../../../src/runtime/manifest-snapshot-writer.js';
tests/unit/runtime/event-log-round-trip.test.ts:20:import { reduce } from '../../../src/runtime/reducer.js';
tests/unit/runtime/event-log-round-trip.test.ts:21:import { appendAndDerive, bootstrapRun, initRunFolder } from '../../../src/runtime/runner.js';
tests/unit/runtime/event-log-round-trip.test.ts:26:} from '../../../src/runtime/snapshot-writer.js';
tests/unit/runtime/event-log-round-trip.test.ts:27:import { readRunTrace } from '../../../src/runtime/trace-reader.js';
tests/unit/runtime/event-log-round-trip.test.ts:28:import { appendTraceEntry, traceEntryLogPath } from '../../../src/runtime/trace-writer.js';
src/flows/fix/command.md:123:- `src/runtime/router.ts` (router bypass behavior for explicit flow names)
tests/runner/codex-relay-roundtrip.test.ts:8:import { type CodexRelayResult, relayCodex } from '../../src/runtime/connectors/codex.js';
tests/runner/codex-relay-roundtrip.test.ts:9:import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
tests/runner/codex-relay-roundtrip.test.ts:10:import { sha256Hex } from '../../src/runtime/connectors/shared.js';
tests/runner/codex-relay-roundtrip.test.ts:11:import { reduce } from '../../src/runtime/reducer.js';
tests/runner/codex-relay-roundtrip.test.ts:12:import { appendAndDerive, bootstrapRun } from '../../src/runtime/runner.js';
tests/runner/codex-relay-roundtrip.test.ts:13:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/runner/codex-relay-roundtrip.test.ts:60://   (a) src/runtime/connectors/codex.ts — relayCodex + parseCodexStdout
tests/runner/codex-relay-roundtrip.test.ts:65://   (d) src/runtime/connectors/shared.ts — compatibility re-exports used by
tests/runner/codex-relay-roundtrip.test.ts:67://   (e) src/runtime/connectors/relay-materializer.ts — five-trace_entry
tests/runner/codex-relay-roundtrip.test.ts:80:  resolve('src/runtime/connectors/codex.ts'),
tests/runner/codex-relay-roundtrip.test.ts:83:  resolve('src/runtime/connectors/shared.ts'),
tests/runner/codex-relay-roundtrip.test.ts:84:  resolve('src/runtime/connectors/relay-materializer.ts'),
tests/runner/codex-relay-roundtrip.test.ts:85:  resolve('src/runtime/runner.ts'),
tests/runner/codex-relay-roundtrip.test.ts:86:  resolve('src/runtime/registries/report-schemas.ts'),
tests/properties/visible/cross-report-validator.test.ts:16:import { reportPathForSchemaInCompiledFlow } from '../../../src/runtime/registries/close-writers/shared.js';
tests/properties/visible/cross-report-validator.test.ts:17:import { runCrossReportValidator } from '../../../src/runtime/registries/cross-report-validators.js';
tests/unit/runtime/progress-projector.test.ts:6:import { projectTraceEntryToProgress } from '../../../src/runtime/progress-projector.js';
tests/properties/visible/fanout-join-policy.test.ts:3:// `evaluateFanoutJoinPolicy` helper in src/runtime/step-handlers/fanout.ts.
tests/properties/visible/fanout-join-policy.test.ts:33:} from '../../../src/runtime/step-handlers/fanout.js';
tests/contracts/codex-connector-schema.test.ts:15:} from '../../src/runtime/connectors/codex.js';
tests/contracts/codex-connector-schema.test.ts:22://   (A) `src/runtime/connectors/codex.ts` module shape + capability-
tests/contracts/codex-connector-schema.test.ts:40:describe('Codex connector — src/runtime/connectors/codex.ts module shape', () => {
tests/runner/explore-tournament-runtime.test.ts:6:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/explore-tournament-runtime.test.ts:12:} from '../../src/runtime/runner.js';
tests/contracts/relay-transcript-schema.test.ts:11:import { reduce } from '../../src/runtime/reducer.js';
tests/runner/build-runtime-wiring.test.ts:12:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/build-runtime-wiring.test.ts:13:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/build-runtime-wiring.test.ts:14:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/agent-relay-roundtrip.test.ts:9:} from '../../src/runtime/connectors/claude-code.js';
tests/runner/agent-relay-roundtrip.test.ts:10:import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
tests/runner/agent-relay-roundtrip.test.ts:11:import { sha256Hex } from '../../src/runtime/connectors/shared.js';
tests/runner/agent-relay-roundtrip.test.ts:12:import { reduce } from '../../src/runtime/reducer.js';
tests/runner/agent-relay-roundtrip.test.ts:13:import { appendAndDerive, bootstrapRun } from '../../src/runtime/runner.js';
tests/runner/agent-relay-roundtrip.test.ts:14:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/contracts/build-report-schemas.test.ts:342:            file_refs: ['src/runtime/runner.ts'],
tests/unit/emit-flows-drift.test.ts:22:const runtimeProofClaudeDir = resolve(projectRoot, '.claude-plugin/skills/runtime-proof');
tests/unit/emit-flows-drift.test.ts:23:const runtimeProofCodexDir = resolve(projectRoot, 'plugins/circuit/flows/runtime-proof');
tests/unit/emit-flows-drift.test.ts:105:    expect(combined).toContain('.claude-plugin/skills/runtime-proof');
tests/unit/emit-flows-drift.test.ts:106:    expect(combined).toContain('plugins/circuit/flows/runtime-proof');
tests/unit/emit-flows-drift.test.ts:123:      'removed internal host mirror .claude-plugin/skills/runtime-proof',
tests/unit/emit-flows-drift.test.ts:126:      'removed internal host mirror plugins/circuit/flows/runtime-proof',
tests/runner/verification-handler-direct.test.ts:25:import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
tests/runner/verification-handler-direct.test.ts:26:import { runVerificationStep } from '../../src/runtime/step-handlers/verification.js';
tests/contracts/flow-kind-policy.test.ts:12:} from '../../src/runtime/policy/flow-kind-policy.js';
tests/contracts/flow-kind-policy.test.ts:322:    expect(result.detail).toMatch(/runtime-proof.*exempt/);
tests/runner/codex-connector-smoke.test.ts:3:import { relayCodex } from '../../src/runtime/connectors/codex.js';
tests/runner/codex-connector-smoke.test.ts:4:import { sha256Hex } from '../../src/runtime/connectors/shared.js';
tests/runner/build-verification-exec.test.ts:16:import { type ComposeWriterFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/contracts/explore-report-composition.test.ts:5:import { findCloseBuilder } from '../../src/runtime/registries/close-writers/registry.js';
tests/contracts/explore-report-composition.test.ts:6:import { findComposeBuilder } from '../../src/runtime/registries/compose-writers/registry.js';
tests/contracts/explore-report-composition.test.ts:7:import { parseReport } from '../../src/runtime/registries/report-schemas.js';
tests/runner/runner-relay-provenance.test.ts:6:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/runner-relay-provenance.test.ts:7:import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
tests/runner/runner-relay-provenance.test.ts:8:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/runner-relay-provenance.test.ts:9:import { resolveRelayDecision } from '../../src/runtime/relay-selection.js';
tests/runner/runner-relay-provenance.test.ts:10:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/runner-relay-provenance.test.ts:25:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/contracts/engine-flow-boundary.test.ts:1:// Architecture boundary: src/runtime/ may not import from any
tests/contracts/engine-flow-boundary.test.ts:14:const RUNTIME_ROOT = 'src/runtime';
tests/contracts/engine-flow-boundary.test.ts:69:  it('no file under src/runtime/ imports a flow source other than the catalog or types', () => {
tests/contracts/engine-flow-boundary.test.ts:76:      'src/runtime walk returned unexpectedly few files — discovery loop is likely broken',
tests/runner/checkpoint-handler-direct.test.ts:16:import { runCheckpointStep } from '../../src/runtime/step-handlers/checkpoint.js';
tests/runner/checkpoint-handler-direct.test.ts:17:import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
tests/runner/checkpoint-handler-direct.test.ts:18:import { traceEntryLogPath } from '../../src/runtime/trace-writer.js';
tests/runner/fix-runtime-wiring.test.ts:17:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/fix-runtime-wiring.test.ts:18:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/fix-runtime-wiring.test.ts:24:} from '../../src/runtime/runner.js';
src/flows/fix/writers/verification.ts:11:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/fix/writers/verification.ts:17:} from '../../../runtime/registries/verification-writers/types.js';
tests/runner/sub-run-real-recursion.test.ts:25:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/sub-run-real-recursion.test.ts:26:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/sub-run-real-recursion.test.ts:31:} from '../../src/runtime/runner.js';
tests/runner/pass-route-cycle-guard.test.ts:6:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/pass-route-cycle-guard.test.ts:7:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/pass-route-cycle-guard.test.ts:8:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/pass-route-cycle-guard.test.ts:9:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/runner/pass-route-cycle-guard.test.ts:17:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/cli-router.test.ts:9:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/cli-router.test.ts:10:import type { RelayFn, RelayInput } from '../../src/runtime/runner.js';
tests/runner/agent-connector-smoke.test.ts:4:import { relayClaudeCode, sha256Hex } from '../../src/runtime/connectors/claude-code.js';
tests/runner/close-builder-registry.test.ts:21:import { findCloseBuilder } from '../../src/runtime/registries/close-writers/registry.js';
tests/runner/close-builder-registry.test.ts:22:import type { CloseBuilder } from '../../src/runtime/registries/close-writers/types.js';
tests/runner/close-builder-registry.test.ts:23:import { runCompiledFlow, writePrototypeComposeReport } from '../../src/runtime/runner.js';
tests/runner/runtime-smoke.test.ts:14:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/runtime-smoke.test.ts:15:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/runtime-smoke.test.ts:16:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/runtime-smoke.test.ts:17:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/runner/runtime-smoke.test.ts:30:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
src/flows/fix/writers/close.ts:14:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/fix/writers/close.ts:18:} from '../../../runtime/registries/close-writers/types.js';
tests/runner/cli-v2-runtime.test.ts:32:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/cli-v2-runtime.test.ts:33:import type { ComposeWriterFn, RelayFn, RelayInput } from '../../src/runtime/runner.js';
tests/runner/cli-v2-runtime.test.ts:1547:      /checkpoint-waiting depth 'deep' remains on the retained checkpoint runtime/,
src/cli/circuit.ts:18:import { classifyCompiledFlowTask } from '../runtime/router.js';
src/cli/circuit.ts:26:} from '../runtime/runner.js';
tests/runner/plugin-command-invocation.test.ts:139:        expect(body).not.toMatch(/dist\/cli\/runtime-proof\.js/);
tests/runner/handler-throw-recovery.test.ts:11:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/handler-throw-recovery.test.ts:12:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/handler-throw-recovery.test.ts:13:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/handler-throw-recovery.test.ts:14:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/runner/handler-throw-recovery.test.ts:25:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/operator-summary-writer.test.ts:6:import { writeOperatorSummary as runtimeWriteOperatorSummary } from '../../src/runtime/operator-summary-writer.js';
tests/runner/runner-relay-connector-identity.test.ts:6:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/runner-relay-connector-identity.test.ts:7:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/runner-relay-connector-identity.test.ts:8:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/runner-relay-connector-identity.test.ts:30:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/catalog-derivations.test.ts:20:} from '../../src/runtime/catalog-derivations.js';
tests/runner/catalog-derivations.test.ts:21:import type { CheckpointBriefBuilder } from '../../src/runtime/registries/checkpoint-writers/types.js';
tests/runner/catalog-derivations.test.ts:22:import type { CloseBuilder } from '../../src/runtime/registries/close-writers/types.js';
tests/runner/catalog-derivations.test.ts:23:import type { ComposeBuilder } from '../../src/runtime/registries/compose-writers/types.js';
tests/runner/catalog-derivations.test.ts:24:import type { StructuralShapeHint } from '../../src/runtime/registries/shape-hints/types.js';
tests/runner/catalog-derivations.test.ts:25:import type { VerificationBuilder } from '../../src/runtime/registries/verification-writers/types.js';
tests/runner/catalog-derivations.test.ts:461:      '../../src/runtime/registries/compose-writers/registry.js'
tests/runner/catalog-derivations.test.ts:464:      '../../src/runtime/registries/close-writers/registry.js'
tests/runner/catalog-derivations.test.ts:467:      '../../src/runtime/registries/verification-writers/registry.js'
tests/runner/catalog-derivations.test.ts:470:      '../../src/runtime/registries/checkpoint-writers/registry.js'
tests/runner/check-evaluation.test.ts:10:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/check-evaluation.test.ts:11:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/check-evaluation.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/check-evaluation.test.ts:29:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/explore-report-writer.test.ts:13:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/explore-report-writer.test.ts:14:import { type RelayFn, type RelayInput, runCompiledFlow } from '../../src/runtime/runner.js';
src/flows/fix/writers/brief.ts:12:} from '../../../runtime/registries/compose-writers/types.js';
tests/runner/build-checkpoint-exec.test.ts:8:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/build-checkpoint-exec.test.ts:9:import { sha256Hex } from '../../src/runtime/connectors/shared.js';
tests/runner/build-checkpoint-exec.test.ts:15:} from '../../src/runtime/runner.js';
tests/runner/result-path-compat.test.ts:4:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/migrate-runtime-wiring.test.ts:15:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/migrate-runtime-wiring.test.ts:16:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/migrate-runtime-wiring.test.ts:17:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/migrate-runtime-wiring.test.ts:25:} from '../../src/runtime/runner.js';
tests/runner/run-status-projection.test.ts:6:import { projectRunStatusFromRunFolder } from '../../src/runtime/run-status-projection.js';
tests/runner/run-status-projection.test.ts:7:import { appendTraceEntry } from '../../src/runtime/trace-writer.js';
tests/runner/relay-invocation-failure.test.ts:6:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/relay-invocation-failure.test.ts:7:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/relay-invocation-failure.test.ts:8:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/runner/relay-invocation-failure.test.ts:16:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/fix-report-writer.test.ts:22:import { writeComposeReport } from '../../src/runtime/runner.js';
tests/runner/relay-shape-hint-registry.test.ts:20:} from '../../src/runtime/registries/shape-hints/registry.js';
tests/runner/relay-shape-hint-registry.test.ts:21:import type { RelayStep } from '../../src/runtime/registries/shape-hints/types.js';
tests/runner/router-routing-invariants.test.ts:15:import { classifyTaskAgainstRoutables, deriveRoutingForTesting } from '../../src/runtime/router.js';
src/cli/handoff.ts:6:import { deriveSnapshot } from '../runtime/snapshot-writer.js';
tests/runner/fanout-real-recursion.test.ts:13:// itself (per src/runtime/runner.ts:633), so each branch recurses
tests/runner/fanout-real-recursion.test.ts:24:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/fanout-real-recursion.test.ts:25:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/fanout-real-recursion.test.ts:31:} from '../../src/runtime/runner.js';
tests/runner/connector-shared-compat.test.ts:6:} from '../../src/runtime/connectors/shared.js';
tests/runner/connector-shared-compat.test.ts:7:import { sha256Hex as runtimeSha256Hex } from '../../src/runtime/connectors/shared.js';
tests/runner/cross-report-validators.test.ts:6:import { reportPathForSchemaInCompiledFlow } from '../../src/runtime/registries/close-writers/shared.js';
tests/runner/cross-report-validators.test.ts:7:import { runCrossReportValidator } from '../../src/runtime/registries/cross-report-validators.js';
tests/runner/sub-run-runtime.test.ts:6:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/sub-run-runtime.test.ts:14:} from '../../src/runtime/runner.js';
tests/runner/review-runtime-wiring.test.ts:28:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/review-runtime-wiring.test.ts:29:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/review-runtime-wiring.test.ts:30:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/custom-connector-runtime.test.ts:3:import { relayCustom } from '../../src/runtime/connectors/custom.js';
tests/runner/sub-run-handler-direct.test.ts:20:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/sub-run-handler-direct.test.ts:26:} from '../../src/runtime/runner.js';
tests/runner/sub-run-handler-direct.test.ts:27:import { runSubRunStep } from '../../src/runtime/step-handlers/sub-run.js';
tests/runner/sub-run-handler-direct.test.ts:28:import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
src/flows/review/relay-hints.ts:10:import type { StructuralShapeHint } from '../../runtime/registries/shape-hints/types.js';
src/cli/runs.ts:4:} from '../runtime/run-status-projection.js';
tests/runner/push-sequence-authority.test.ts:10:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/push-sequence-authority.test.ts:11:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/push-sequence-authority.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/push-sequence-authority.test.ts:13:import { readRunTrace } from '../../src/runtime/trace-reader.js';
tests/runner/push-sequence-authority.test.ts:26:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/compose-builder-registry.test.ts:15:import { findComposeBuilder } from '../../src/runtime/registries/compose-writers/registry.js';
tests/runner/compose-builder-registry.test.ts:16:import type { ComposeBuilder } from '../../src/runtime/registries/compose-writers/types.js';
tests/runner/compose-builder-registry.test.ts:17:import { runCompiledFlow, writeComposeReport } from '../../src/runtime/runner.js';
tests/runner/sweep-runtime-wiring.test.ts:15:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/sweep-runtime-wiring.test.ts:16:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/sweep-runtime-wiring.test.ts:17:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/terminal-verdict-derivation.test.ts:10:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/terminal-verdict-derivation.test.ts:11:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/terminal-verdict-derivation.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/terminal-verdict-derivation.test.ts:31:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/run-relative-path.test.ts:14:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/run-relative-path.test.ts:15:import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
tests/runner/run-relative-path.test.ts:16:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/run-relative-path.test.ts:17:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/run-relative-path.test.ts:23:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/explore-e2e-parity.test.ts:7:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/explore-e2e-parity.test.ts:12:import { type RelayFn, type RelayInput, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/explore-e2e-parity.test.ts:50:  'src/runtime/connectors/claude-code.ts',
tests/runner/explore-e2e-parity.test.ts:53:  'src/runtime/connectors/shared.ts',
tests/runner/explore-e2e-parity.test.ts:54:  'src/runtime/connectors/relay-materializer.ts',
tests/runner/explore-e2e-parity.test.ts:55:  'src/runtime/runner.ts',
tests/runner/explore-e2e-parity.test.ts:56:  'src/runtime/registries/report-schemas.ts',
src/runtime/runner.ts:441:// under src/runtime/registries/compose-writers/ and is registered by
src/runtime/runner.ts:443:// src/runtime/registries/close-writers/. The runner stays flow-
src/runtime/runner.ts:741:// src/runtime/step-handlers/.
tests/runner/build-report-writer.test.ts:19:} from '../../src/runtime/runner.js';
tests/runner/build-report-writer.test.ts:334:        changed_files: ['src/runtime/runner.ts'],
tests/runner/config-loader.test.ts:11:} from '../../src/runtime/config-loader.js';
tests/runner/config-loader.test.ts:12:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/config-loader.test.ts:13:import type { RelayFn, RelayInput } from '../../src/runtime/runner.js';
tests/runner/fresh-run-root.test.ts:14:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/fresh-run-root.test.ts:15:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/fresh-run-root.test.ts:16:import { manifestSnapshotPath } from '../../src/runtime/manifest-snapshot-writer.js';
tests/runner/fresh-run-root.test.ts:17:import { resultPath } from '../../src/runtime/result-writer.js';
tests/runner/fresh-run-root.test.ts:23:} from '../../src/runtime/runner.js';
tests/runner/fresh-run-root.test.ts:24:import { snapshotPath } from '../../src/runtime/snapshot-writer.js';
tests/runner/fresh-run-root.test.ts:25:import { traceEntryLogPath } from '../../src/runtime/trace-writer.js';
tests/runner/fresh-run-root.test.ts:30:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/materializer-schema-parse.test.ts:10:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/materializer-schema-parse.test.ts:11:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/materializer-schema-parse.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/materializer-schema-parse.test.ts:41:const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
tests/runner/materializer-schema-parse.test.ts:200:    expect(ge.reason).toMatch(/runtime-proof-strict@v1/);
tests/runner/relay-handler-direct.test.ts:16:import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
tests/runner/relay-handler-direct.test.ts:17:import type { RelayResult } from '../../src/runtime/connectors/shared.js';
tests/runner/relay-handler-direct.test.ts:18:import { runRelayStep } from '../../src/runtime/step-handlers/relay.js';
tests/runner/relay-handler-direct.test.ts:19:import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
src/runtime/registries/compose-writers/types.ts:17:// src/runtime/registries/close-writers/. The two registries are intentionally
src/runtime/operator-summary-writer.ts:11:// importing the old path while ownership narrows out of `src/runtime/`.
src/runtime/compile-schematic-to-flow.ts:71:        `schematic item '${item.id}' has verification kind but writes '${item.output}'; no verification writer is registered for that schema (see src/runtime/registries/verification-writers/registry.ts)`,
src/runtime/compile-schematic-to-flow.ts:78:        `schematic item '${item.id}' has checkpoint kind writing report '${item.output}'; no checkpoint writer is registered for that schema (see src/runtime/registries/checkpoint-writers/registry.ts)`,
src/core-v2/executors/verification.ts:4:import { findVerificationWriter } from '../../runtime/registries/verification-writers/registry.js';
src/core-v2/executors/verification.ts:5:import type { VerificationCommand } from '../../runtime/registries/verification-writers/types.js';
src/runtime/manifest-snapshot-writer.ts:11:// importing the old path while ownership narrows out of `src/runtime/`.
src/runtime/connectors/relay-materializer.ts:28:// Why live in `src/runtime/connectors/` and not `src/runtime/` proper.
src/runtime/connectors/relay-materializer.ts:31:// scope is `src/runtime/connectors/**`, and this module's only external
src/runtime/connectors/relay-materializer.ts:93:// `src/runtime/runner.ts::evaluateRelayCheck` + the `parseReport`
src/runtime/connectors/relay-materializer.ts:97:// registry at `src/runtime/registries/report-schemas.ts`; unknown schema names
src/core-v2/executors/checkpoint.ts:2:import { findCheckpointBriefBuilder } from '../../runtime/registries/checkpoint-writers/registry.js';
src/runtime/step-handlers/checkpoint.ts:109:// means adding a builder under src/runtime/registries/checkpoint-writers/.
src/flows/review/writers/intake.ts:14:} from '../../../runtime/registries/compose-writers/types.js';
src/schemas/result.ts:15:// src/runtime/result-writer.ts); this schema only enforces shape.
src/runtime/connectors/shared.ts:12:// materialization remain in `src/runtime/connectors/`.
src/flows/review/writers/result.ts:14:} from '../../../runtime/registries/compose-writers/types.js';
src/core-v2/executors/compose.ts:5:} from '../../runtime/registries/close-writers/registry.js';
src/core-v2/executors/compose.ts:9:} from '../../runtime/registries/compose-writers/registry.js';
src/shared/relay-support.ts:2:import { findRelayShapeHint } from '../runtime/registries/shape-hints/registry.js';
src/core-v2/executors/relay.ts:3:import { relayClaudeCode } from '../../runtime/connectors/claude-code.js';
src/core-v2/executors/relay.ts:4:import { relayCodex } from '../../runtime/connectors/codex.js';
src/core-v2/executors/relay.ts:5:import { relayCustom } from '../../runtime/connectors/custom.js';
src/core-v2/executors/relay.ts:6:import { runCrossReportValidator } from '../../runtime/registries/cross-report-validators.js';
src/core-v2/executors/relay.ts:7:import { parseReport } from '../../runtime/registries/report-schemas.js';
src/flows/migrate/relay-hints.ts:3:import type { SchemaShapeHint } from '../../runtime/registries/shape-hints/types.js';
src/flows/types.ts:14:import type { CheckpointBriefBuilder } from '../runtime/registries/checkpoint-writers/types.js';
src/flows/types.ts:15:import type { CloseBuilder } from '../runtime/registries/close-writers/types.js';
src/flows/types.ts:16:import type { ComposeBuilder } from '../runtime/registries/compose-writers/types.js';
src/flows/types.ts:17:import type { CrossReportValidator } from '../runtime/registries/cross-report-validators.js';
src/flows/types.ts:18:import type { StructuralShapeHint } from '../runtime/registries/shape-hints/types.js';
src/flows/types.ts:19:import type { VerificationBuilder } from '../runtime/registries/verification-writers/types.js';
src/flows/explore/relay-hints.ts:3:import type { SchemaShapeHint } from '../../runtime/registries/shape-hints/types.js';
src/flows/migrate/writers/verification.ts:12:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/migrate/writers/verification.ts:18:} from '../../../runtime/registries/verification-writers/types.js';
src/flows/runtime-proof/index.ts:9:    schematic: 'src/flows/runtime-proof/schematic.json',
src/flows/migrate/writers/brief.ts:13:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/migrate/writers/close.ts:14:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/migrate/writers/close.ts:18:} from '../../../runtime/registries/close-writers/types.js';
src/flows/migrate/writers/coexistence.ts:12:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/explore/command.md:111:- `src/runtime/` (current runner)
src/flows/explore/contract.md:369:`src/runtime/registries/report-schemas.ts`. The canonical report at
src/flows/explore/contract.md:387:`src/runtime/registries/report-schemas.ts` carries the strict
src/flows/explore/contract.md:394:`src/runtime/runner.ts` name the exact JSON shapes the connectors must
src/flows/runtime-proof/writers/compose.ts:4:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/explore/writers/analysis.ts:10:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/explore/writers/brief.ts:11:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/explore/writers/decision.ts:11:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/explore/writers/decision-options.ts:10:} from '../../../runtime/registries/compose-writers/types.js';
src/flows/explore/writers/close.ts:10:import { reportPathForSchemaInCompiledFlow } from '../../../runtime/registries/close-writers/shared.js';
src/flows/explore/writers/close.ts:14:} from '../../../runtime/registries/close-writers/types.js';
```

## Runner and selection symbol references

```bash
rg -n "runCompiledFlow|resumeCompiledFlowCheckpoint|RelayFn|ProgressReporter|deriveResolvedSelection|resolveSelection" src tests scripts docs -g "!docs/architecture/v2-runtime-import-inventory.md"
```

```text
docs/architecture/v2-phase-4-notes.md:87:compiled-flow bytes supplied to `runCompiledFlowV2`.
docs/architecture/v2-checkpoint-4.12.md:21:- `deriveResolvedSelection`
docs/architecture/v2-checkpoint-4.12.md:27:core-v2 relay now imports `deriveResolvedSelection` from the shared module.
docs/architecture/v2-checkpoint-3.md:11:-> runCompiledFlowV2
docs/architecture/v2-checkpoint-3.md:156:- `runCompiledFlowV2` lives in source as an opt-in internal path. That is useful
docs/architecture/v2-checkpoint-3.md:189:- Changed `runCompiledFlowV2` to compute `manifest_hash` from raw
docs/architecture/v2-checkpoint-3.md:211:- `runCompiledFlowV2` now accepts raw compiled-flow bytes only, parses the
tests/core-v2/default-executors-v2.test.ts:5:import { runCompiledFlowV2 } from '../../src/core-v2/run/compiled-flow-runner.js';
tests/core-v2/default-executors-v2.test.ts:18:      const result = await runCompiledFlowV2({
docs/architecture/v2-deletion-plan.md:50:| `src/runtime/runner.ts` | retained execution path | The CLI still imports `runCompiledFlow` for unsupported modes, rollback, arbitrary fixtures, `composeWriter`, and checkpoint resume. Release proof scripts and many runner tests still use it. |
docs/architecture/v2-deletion-plan.md:182:rg -n "runCompiledFlow|resumeCompiledFlowCheckpoint|RelayFn|ProgressReporter|deriveResolvedSelection|resolveSelection" src tests scripts docs
docs/architecture/v2-deletion-plan.md:195:| Move shared relay/progress types out of `src/runtime/runner-types.ts` | Done in Phase 4.9 for `RelayFn`, `RelayInput`, `ProgressReporter`, and `RuntimeEvidencePolicy`. `runner-types.ts` remains as a compatibility re-export plus retained runtime invocation/result types. | Keep full validation green while retained runtime and tests continue importing the old surface. |
docs/architecture/v2-deletion-plan.md:197:| Move relay selection support to a neutral module | Mostly done in Phases 4.11 and 4.12 for selection ownership: `src/shared/selection-resolver.ts` owns `resolveSelectionForRelay`, and `src/shared/relay-selection.ts` owns depth-bound selection derivation. `src/runtime/relay-selection.ts` remains for retained relayer resolution and connector bridge behavior. | Config loader tests, selection contract tests, relay provenance tests, core-v2 connector tests, CLI custom connector precedence tests, full `npm run verify`. |
docs/architecture/v2-checkpoint-4.2.md:18:This routes only supported fresh runs through `runCompiledFlowV2(...)`.
docs/architecture/v2-checkpoint-4.2.md:42:The opt-in path passes raw generated manifest bytes into `runCompiledFlowV2`.
docs/architecture/v2-worklog.md:864:Behavior changed? No runtime behavior changed. `resolveSelectionForRelay` now
docs/architecture/v2-worklog.md:915:Behavior changed? No runtime behavior changed. `deriveResolvedSelection`,
docs/architecture/v2-worklog.md:1889:- `RelayFn` still lives in `src/runtime/runner-types.ts` and should move to a
docs/architecture/v2-worklog.md:2328:  CLI execution still imports `runCompiledFlow`.
docs/architecture/v2-checkpoint-4.md:94:rg -n "runCompiledFlow|executeCompiledFlow|compileSchematicToFlow|CompiledFlow|flow-schematic|runtime/runner|runtime/step-handlers|runtime/catalog-derivations|runtime/registries|relay-selection|selection-resolver" src tests docs specs scripts commands plugins .claude-plugin generated README.md package.json
docs/architecture/v2-checkpoint-4.md:234:1. route production CLI run execution through `runCompiledFlowV2`;
docs/architecture/v2-checkpoint-4.11.md:18:- `resolveSelectionForRelay`
docs/architecture/v2-checkpoint-4.9.md:18:- `RelayFn`
docs/architecture/v2-checkpoint-4.9.md:20:- `ProgressReporter`
docs/architecture/v2-checkpoint-4.1.1.md:27:- A generated Review flow smoke test now runs through `runCompiledFlowV2` with
docs/architecture/v2-checkpoint-4.1.1.md:35:- `src/runtime/runner-types.ts` remains because `RelayFn` is still shared by the
docs/architecture/v2-checkpoint-4.8.md:35:rg -n "runCompiledFlow|resumeCompiledFlowCheckpoint|RelayFn|ProgressReporter|deriveResolvedSelection|resolveSelection" src tests scripts docs
tests/parity/core-v2-parity-helpers.ts:13:import { runCompiledFlowV2 } from '../../src/core-v2/run/compiled-flow-runner.js';
tests/parity/core-v2-parity-helpers.ts:166:  return await runCompiledFlowV2({
tests/contracts/orphan-blocks.test.ts:25:import { runCompiledFlow, writePrototypeComposeReport } from '../../src/runtime/runner.js';
tests/contracts/orphan-blocks.test.ts:187:    const outcome = await runCompiledFlow({
tests/contracts/orphan-blocks.test.ts:301:    const outcome = await runCompiledFlow({
tests/contracts/orphan-blocks.test.ts:381:    const outcome = await runCompiledFlow({
tests/contracts/orphan-blocks.test.ts:466:    const outcome = await runCompiledFlow({
tests/contracts/orphan-blocks.test.ts:556:    const outcome = await runCompiledFlow({
tests/contracts/flow-model-effort.test.ts:7:import { type RelayFn, type RelayInput, runCompiledFlow } from '../../src/runtime/runner.js';
tests/contracts/flow-model-effort.test.ts:14:import { resolveSelectionForRelay } from '../../src/shared/selection-resolver.js';
tests/contracts/flow-model-effort.test.ts:189:    const resolution = resolveSelectionForRelay({
tests/contracts/flow-model-effort.test.ts:221:    const resolution = resolveSelectionForRelay({
tests/contracts/flow-model-effort.test.ts:265:    const relayer: RelayFn = {
tests/contracts/flow-model-effort.test.ts:279:    const outcome = await runCompiledFlow({
src/cli/circuit.ts:6:import { runCompiledFlowV2 } from '../core-v2/run/compiled-flow-runner.js';
src/cli/circuit.ts:23:  type RelayFn,
src/cli/circuit.ts:24:  resumeCompiledFlowCheckpoint,
src/cli/circuit.ts:25:  runCompiledFlow,
src/cli/circuit.ts:113:  relayer?: RelayFn;
src/cli/circuit.ts:641:    const outcome = await resumeCompiledFlowCheckpoint({
src/cli/circuit.ts:801:    const v2Result = await runCompiledFlowV2({
src/cli/circuit.ts:865:  const outcome = await runCompiledFlow(invocation);
src/shared/relay-selection.ts:6:import type { RelayFn } from './relay-runtime-types.js';
src/shared/relay-selection.ts:7:import { resolveSelectionForRelay } from './selection-resolver.js';
src/shared/relay-selection.ts:10:  readonly relayer?: RelayFn;
src/shared/relay-selection.ts:78:export function deriveResolvedSelection(
src/shared/relay-selection.ts:84:  return resolveSelectionForRelay({
src/runtime/relay-selection.ts:12:import type { RelayFn } from './runner-types.js';
src/runtime/relay-selection.ts:15:  deriveResolvedSelection,
src/runtime/relay-selection.ts:23:  readonly explicitRelayer?: RelayFn;
src/runtime/relay-selection.ts:30:  readonly relayer: RelayFn;
src/runtime/relay-selection.ts:52:async function relayerForBuiltin(name: EnabledConnector): Promise<RelayFn> {
src/runtime/relay-selection.ts:83:async function relayerForCustom(descriptor: CustomConnectorDescriptor): Promise<RelayFn> {
src/runtime/relay-selection.ts:92:async function relayerForResolvedConnector(connector: ResolvedConnector): Promise<RelayFn> {
src/runtime/relay-selection.ts:127:async function decideRelayer(connector: ResolvedConnector, role: RelayRole): Promise<RelayFn> {
src/runtime/progress-projector.ts:18:import type { ProgressReporter } from './runner-types.js';
src/runtime/progress-projector.ts:83:  readonly progress: ProgressReporter | undefined;
src/runtime/progress-projector.ts:127:  readonly progress?: ProgressReporter;
src/runtime/progress-projector.ts:184:  readonly progress: ProgressReporter | undefined;
src/shared/selection-resolver.ts:150:export function resolveSelectionForRelay(input: ResolveSelectionInput): SelectionResolution {
src/core-v2/run/compiled-flow-runner.ts:8:  ProgressReporter,
src/core-v2/run/compiled-flow-runner.ts:9:  RelayFn,
src/core-v2/run/compiled-flow-runner.ts:38:  readonly relayer?: RelayFn;
src/core-v2/run/compiled-flow-runner.ts:40:  readonly progress?: ProgressReporter;
src/core-v2/run/compiled-flow-runner.ts:65:export async function runCompiledFlowV2(
src/core-v2/run/compiled-flow-runner.ts:97:      childRunner: options.childRunner ?? runCompiledFlowV2,
src/core-v2/run/graph-runner.ts:7:  ProgressReporter,
src/core-v2/run/graph-runner.ts:8:  RelayFn,
src/core-v2/run/graph-runner.ts:48:  readonly relayer?: RelayFn;
src/core-v2/run/graph-runner.ts:50:  readonly progress?: ProgressReporter;
tests/runner/close-builder-registry.test.ts:7:// runCompiledFlow, and asserts the new builder fires. If the runner ever
tests/runner/close-builder-registry.test.ts:23:import { runCompiledFlow, writePrototypeComposeReport } from '../../src/runtime/runner.js';
tests/runner/close-builder-registry.test.ts:167:    const outcome = await runCompiledFlow({
tests/runner/fanout-handler-direct.test.ts:4:// the handler transitively through full runCompiledFlow runs. Neither
src/core-v2/run/run-context.ts:4:  ProgressReporter,
src/core-v2/run/run-context.ts:5:  RelayFn,
src/core-v2/run/run-context.ts:39:  readonly relayer?: RelayFn;
src/core-v2/run/run-context.ts:41:  readonly progress?: ProgressReporter;
src/core-v2/projections/progress.ts:10:import type { ProgressReporter } from '../../shared/relay-runtime-types.js';
src/core-v2/projections/progress.ts:76:  readonly progress: ProgressReporter | undefined;
src/core-v2/projections/progress.ts:166:  readonly progress: ProgressReporter | undefined;
src/runtime/selection-resolver.ts:3:  resolveSelectionForRelay,
tests/runner/runner-relay-connector-identity.test.ts:8:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/runner-relay-connector-identity.test.ts:13:// Connector-identity plumbing through `runCompiledFlow`. `RelayFn` is a
tests/runner/runner-relay-connector-identity.test.ts:21:// carries connector identity end-to-end through `runCompiledFlow`.
tests/runner/runner-relay-connector-identity.test.ts:26:// This test exercises the `runCompiledFlow` seam on top of that — the
tests/runner/runner-relay-connector-identity.test.ts:28:// calls `materializeRelay` directly and bypasses `runCompiledFlow`.
tests/runner/runner-relay-connector-identity.test.ts:43:function codexShapedStub(): RelayFn {
tests/runner/runner-relay-connector-identity.test.ts:77:describe('RelayFn descriptor carries connector identity into relay.started', () => {
tests/runner/runner-relay-connector-identity.test.ts:81:    const outcome = await runCompiledFlow({
tests/runner/terminal-outcome-mapping.test.ts:9:  type RelayFn,
tests/runner/terminal-outcome-mapping.test.ts:10:  runCompiledFlow,
tests/runner/terminal-outcome-mapping.test.ts:377:function unusedRelayer(): RelayFn {
tests/runner/terminal-outcome-mapping.test.ts:405:      const outcome = await runCompiledFlow({
tests/runner/terminal-outcome-mapping.test.ts:489:      const outcome = await runCompiledFlow({
tests/runner/terminal-outcome-mapping.test.ts:522:    const outcome = await runCompiledFlow({
tests/runner/terminal-outcome-mapping.test.ts:548:    const outcome = await runCompiledFlow({
src/runtime/connectors/relay-materializer.ts:55:  // derives them in `runCompiledFlow`: connector provenance is
src/runtime/runner.ts:57:  ProgressReporter,
src/runtime/runner.ts:58:  RelayFn,
src/runtime/runner.ts:84:  RelayFn,
src/runtime/runner.ts:392:  readonly progress: ProgressReporter | undefined;
src/runtime/runner.ts:520:  readonly relayer?: RelayFn;
src/runtime/runner.ts:532:  readonly progress?: ProgressReporter;
src/runtime/runner.ts:540:    throw new Error(`runCompiledFlow: flow ${flow.id} declares no entry_modes`);
src/runtime/runner.ts:545:      throw new Error(`runCompiledFlow: flow ${flow.id} entry_modes[0] unreadable`);
src/runtime/runner.ts:552:      `runCompiledFlow: flow ${flow.id} declares no entry_mode named '${entryModeName}'`,
src/runtime/runner.ts:868:        `runCompiledFlow: route target '${currentStepId}' is not a known step id (fixture/reduction mismatch)`,
src/runtime/runner.ts:941:        childRunner: ctx.childRunner ?? runCompiledFlow,
src/runtime/runner.ts:1046:        `runCompiledFlow: step '${step.id}' selected route '${routeTaken}' but the compiled step has no target for that route`,
src/runtime/runner.ts:1055:          `runCompiledFlow: route target '${nextRoute}' is not a known step id (fixture/reduction mismatch)`,
src/runtime/runner.ts:1215:export async function runCompiledFlow(inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> {
src/runtime/runner.ts:1219:export async function resumeCompiledFlowCheckpoint(
tests/runner/pass-route-cycle-guard.test.ts:8:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/pass-route-cycle-guard.test.ts:41:function unusedRelayer(): RelayFn {
tests/runner/pass-route-cycle-guard.test.ts:74:    const outcome = await runCompiledFlow({
src/core-v2/run/child-runner.ts:3:  ProgressReporter,
src/core-v2/run/child-runner.ts:4:  RelayFn,
src/core-v2/run/child-runner.ts:56:  readonly relayer?: RelayFn;
src/core-v2/run/child-runner.ts:58:  readonly progress?: ProgressReporter;
tests/runner/fanout-runtime.test.ts:12:  type RelayFn,
tests/runner/fanout-runtime.test.ts:14:  runCompiledFlow,
tests/runner/fanout-runtime.test.ts:53:function unusedRelayer(): RelayFn {
tests/runner/fanout-runtime.test.ts:390:  readonly relayer: RelayFn;
tests/runner/fanout-runtime.test.ts:394:  const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:409:function relayReturning(resultBody: string): RelayFn {
tests/runner/fanout-runtime.test.ts:423:  readonly outcome: Awaited<ReturnType<typeof runCompiledFlow>>;
tests/runner/fanout-runtime.test.ts:506:    const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:574:    const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:670:    const relayer: RelayFn = {
tests/runner/fanout-runtime.test.ts:687:    const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:904:    const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:1036:    const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:1088:    const outcome = await runCompiledFlow({
tests/runner/fanout-runtime.test.ts:1157:    const outcome = await runCompiledFlow({
src/shared/relay-runtime-types.ts:8:export interface RelayFn {
src/shared/relay-runtime-types.ts:18:export type ProgressReporter = (event: ProgressEvent) => void;
src/runtime/step-handlers/types.ts:11:  RelayFn,
src/runtime/step-handlers/types.ts:40:  readonly relayer?: RelayFn;
src/runtime/step-handlers/types.ts:52:  // `runCompiledFlow`. Tests injecting a stub childRunner can avoid the full
src/runtime/runner-types.ts:11:  ProgressReporter,
src/runtime/runner-types.ts:12:  RelayFn,
src/runtime/runner-types.ts:16:  ProgressReporter,
src/runtime/runner-types.ts:17:  RelayFn,
src/runtime/runner-types.ts:94:  relayer?: RelayFn;
src/runtime/runner-types.ts:107:  // own `runCompiledFlow`. Tests inject deterministic child-run stubs so they
src/runtime/runner-types.ts:118:  progress?: ProgressReporter;
src/runtime/runner-types.ts:126:  relayer?: RelayFn;
src/runtime/runner-types.ts:132:  progress?: ProgressReporter;
tests/runner/fix-runtime-wiring.test.ts:4:// CompiledFlow) and runs it through `runCompiledFlow` with stubbed relayers
tests/runner/fix-runtime-wiring.test.ts:21:  type RelayFn,
tests/runner/fix-runtime-wiring.test.ts:22:  runCompiledFlow,
tests/runner/fix-runtime-wiring.test.ts:47:      'runCompiledFlow closes the lite Fix flow via real CompiledFlow with stubbed relayers and a fast verification command',
tests/runner/fix-runtime-wiring.test.ts:98:function relayer(): RelayFn {
tests/runner/fix-runtime-wiring.test.ts:159:    const outcome = await runCompiledFlow({
tests/runner/sub-run-runtime.test.ts:12:  type RelayFn,
tests/runner/sub-run-runtime.test.ts:13:  runCompiledFlow,
tests/runner/sub-run-runtime.test.ts:51:function unusedRelayer(): RelayFn {
tests/runner/sub-run-runtime.test.ts:250:    const outcome = await runCompiledFlow({
tests/runner/sub-run-runtime.test.ts:326:    const outcome = await runCompiledFlow({
tests/runner/sub-run-runtime.test.ts:364:    const outcome = await runCompiledFlow({
src/core-v2/executors/relay.ts:13:import { deriveResolvedSelection } from '../../shared/relay-selection.js';
src/core-v2/executors/relay.ts:275:  const resolvedSelection = deriveResolvedSelection(
tests/runner/explore-tournament-runtime.test.ts:8:  type RelayFn,
tests/runner/explore-tournament-runtime.test.ts:10:  resumeCompiledFlowCheckpoint,
tests/runner/explore-tournament-runtime.test.ts:11:  runCompiledFlow,
tests/runner/explore-tournament-runtime.test.ts:44:function tournamentRelayer(): RelayFn {
tests/runner/explore-tournament-runtime.test.ts:172:    const waiting = await runCompiledFlow({
tests/runner/explore-tournament-runtime.test.ts:226:    const resumed = await resumeCompiledFlowCheckpoint({
tests/runner/explore-tournament-runtime.test.ts:261:    const outcome = await runCompiledFlow({
src/shared/progress-output.ts:2:import type { ProgressReporter } from './relay-runtime-types.js';
src/shared/progress-output.ts:6:export function reportProgress(progress: ProgressReporter | undefined, event: ProgressEvent): void {
tests/runner/migrate-runtime-wiring.test.ts:23:  type RelayFn,
tests/runner/migrate-runtime-wiring.test.ts:24:  runCompiledFlow,
tests/runner/migrate-runtime-wiring.test.ts:106:): RelayFn {
tests/runner/migrate-runtime-wiring.test.ts:278:    const outcome = await runCompiledFlow({
tests/runner/migrate-runtime-wiring.test.ts:367:    const outcome = await runCompiledFlow({
tests/runner/migrate-runtime-wiring.test.ts:394:    const outcome = await runCompiledFlow({
tests/runner/fanout-real-recursion.test.ts:12:// on the CompiledFlowInvocation, the runner defaults to `runCompiledFlow`
tests/runner/fanout-real-recursion.test.ts:28:  type RelayFn,
tests/runner/fanout-real-recursion.test.ts:30:  runCompiledFlow,
tests/runner/fanout-real-recursion.test.ts:45:      'each branch recurses through real runCompiledFlow with a fresh RunId and a sibling run-folder, each child emits its own trace, parent admits via aggregate-only join',
tests/runner/fanout-real-recursion.test.ts:47:      'integration test of fanout + real recursive runCompiledFlow rather than handler-isolation unit test',
tests/runner/fanout-real-recursion.test.ts:57:function acceptingRelayer(): RelayFn {
tests/runner/fanout-real-recursion.test.ts:141:      'real-recursion fanout test parent — two branches, each recurses into the child via real runCompiledFlow.',
tests/runner/fanout-real-recursion.test.ts:221:  it('runs each branch via real runCompiledFlow (no childRunner stub) and admits via aggregate-only', async () => {
tests/runner/fanout-real-recursion.test.ts:235:    // KEY: NO `childRunner` field — runner defaults to `runCompiledFlow`
tests/runner/fanout-real-recursion.test.ts:237:    const outcome = await runCompiledFlow({
tests/runner/runtime-smoke.test.ts:16:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/runtime-smoke.test.ts:23:// composes the runtime boundary via `runCompiledFlow`.
tests/runner/runtime-smoke.test.ts:49:// The stub uses the structured `RelayFn` descriptor shape and binds
tests/runner/runtime-smoke.test.ts:55:function stubRelayer(): RelayFn {
tests/runner/runtime-smoke.test.ts:93:    const outcome = await runCompiledFlow({
tests/runner/runtime-smoke.test.ts:153:    const outcome = await runCompiledFlow({
tests/runner/runtime-smoke.test.ts:209:    const runA = await runCompiledFlow({
tests/runner/runtime-smoke.test.ts:220:    const runB = await runCompiledFlow({
tests/runner/runtime-smoke.test.ts:249:      // load, schema parse, runCompiledFlow composition, JSON
tests/runner/explore-report-writer.test.ts:14:import { type RelayFn, type RelayInput, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/explore-report-writer.test.ts:42:      'default runCompiledFlow explore path writes explore.brief@v1 and explore.analysis@v1 reports that parse through their schemas',
tests/runner/explore-report-writer.test.ts:48:function stubRelayer(): RelayFn {
tests/runner/explore-report-writer.test.ts:115:function incompleteReviewRelayer(): RelayFn {
tests/runner/explore-report-writer.test.ts:151:function extraKeyReviewRelayer(): RelayFn {
tests/runner/explore-report-writer.test.ts:193:function extraKeyComposeRelayer(): RelayFn {
tests/runner/explore-report-writer.test.ts:219:function incompleteComposeRelayer(): RelayFn {
tests/runner/explore-report-writer.test.ts:248:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:315:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:340:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:371:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:399:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:427:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:459:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:491:    const outcome = await runCompiledFlow({
tests/runner/explore-report-writer.test.ts:523:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:14:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/build-runtime-wiring.test.ts:50:): RelayFn {
tests/runner/build-runtime-wiring.test.ts:124:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:169:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:199:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:234:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:264:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:337:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:376:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:402:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:434:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:473:    const outcome = await runCompiledFlow({
tests/runner/build-runtime-wiring.test.ts:505:      runCompiledFlow({
tests/runner/check-evaluation.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/check-evaluation.test.ts:24:// Tests below exercise the four cases through `runCompiledFlow` end-to-end
tests/runner/check-evaluation.test.ts:26:// integration against the runCompiledFlow loop's flow control is part of
tests/runner/check-evaluation.test.ts:42:function relayerWith(resultBody: string): RelayFn {
tests/runner/check-evaluation.test.ts:81:    const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:119:    const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:185:    const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:246:    const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:279:    const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:366:      const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:411:    const outcome = await runCompiledFlow({
tests/runner/check-evaluation.test.ts:448:    const outcome = await runCompiledFlow({
tests/runner/cli-router.test.ts:10:import type { RelayFn, RelayInput } from '../../src/runtime/runner.js';
tests/runner/cli-router.test.ts:52:function relayerWithBody(body: string): RelayFn {
tests/runner/cli-router.test.ts:76:function tournamentRelayer(): RelayFn {
tests/runner/cli-router.test.ts:153:function migrateCliRelayer(): RelayFn {
tests/runner/cli-router.test.ts:350:  relayer: RelayFn,
tests/runner/cli-router.test.ts:375:  relayer: RelayFn,
tests/runner/build-checkpoint-exec.test.ts:11:  type RelayFn,
tests/runner/build-checkpoint-exec.test.ts:13:  resumeCompiledFlowCheckpoint,
tests/runner/build-checkpoint-exec.test.ts:14:  runCompiledFlow,
tests/runner/build-checkpoint-exec.test.ts:332:    const outcome = await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:366:    const outcome = await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:406:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:418:    const resumed = await resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:461:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:474:      resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:488:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:502:      resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:516:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:555:      resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:569:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:625:      resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:639:    const relayer: RelayFn = {
tests/runner/build-checkpoint-exec.test.ts:653:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:684:    const resumed = await resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:724:    const relayer: RelayFn = {
tests/runner/build-checkpoint-exec.test.ts:738:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:750:    const resumed = await resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:793:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:805:    const resumed = await resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:826:    await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:837:    const resumed = await resumeCompiledFlowCheckpoint({
tests/runner/build-checkpoint-exec.test.ts:855:    const outcome = await runCompiledFlow({
tests/runner/build-checkpoint-exec.test.ts:882:    const outcome = await runCompiledFlow({
tests/runner/handler-throw-recovery.test.ts:13:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/handler-throw-recovery.test.ts:38:function stubRelayer(): RelayFn {
tests/runner/handler-throw-recovery.test.ts:57:      'runCompiledFlow resolves with outcome=aborted, step.aborted + run.closed trace_entries, and a parseable result.json',
tests/runner/handler-throw-recovery.test.ts:88:    const outcome = await runCompiledFlow({
tests/runner/handler-throw-recovery.test.ts:163:    const outcome = await runCompiledFlow({
tests/runner/handler-throw-recovery.test.ts:179:    // raw throw out of runCompiledFlow. The compose handler has its OWN
tests/runner/fresh-run-root.test.ts:19:  type RelayFn,
tests/runner/fresh-run-root.test.ts:22:  runCompiledFlow,
tests/runner/fresh-run-root.test.ts:54:function stubRelayer(): RelayFn {
tests/runner/fresh-run-root.test.ts:74:  await runCompiledFlow({
tests/runner/explore-e2e-parity.test.ts:12:import { type RelayFn, type RelayInput, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/explore-e2e-parity.test.ts:22:// branch runs the real explore fixture through `runCompiledFlow` with the
tests/runner/explore-e2e-parity.test.ts:130:      'runCompiledFlow closes the explore fixture under real relayClaudeCode with 2x five-trace_entry transcripts and a byte-shape golden on explore-result.json',
tests/runner/explore-e2e-parity.test.ts:136:function deterministicRelayer(): RelayFn {
tests/runner/explore-e2e-parity.test.ts:285:      const outcome = await runCompiledFlow({
tests/runner/explore-e2e-parity.test.ts:332:      const outcome = await runCompiledFlow({
tests/runner/explore-e2e-parity.test.ts:383:        // CompiledFlowRunResult.relayResults (populated by runCompiledFlow;
tests/runner/runner-relay-provenance.test.ts:10:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/runner-relay-provenance.test.ts:16:// Relay-trace_entry provenance plumbing through `runCompiledFlow`.
tests/runner/runner-relay-provenance.test.ts:61:function stubRelayer(): RelayFn {
tests/runner/runner-relay-provenance.test.ts:100:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:346:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:382:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:429:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:474:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:503:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:534:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:563:    const outcome = await runCompiledFlow({
tests/runner/runner-relay-provenance.test.ts:590:    const outcome = await runCompiledFlow({
tests/runner/config-loader.test.ts:13:import type { RelayFn, RelayInput } from '../../src/runtime/runner.js';
tests/runner/config-loader.test.ts:208:    const relayer: RelayFn = {
tests/runner/config-loader.test.ts:285:    const relayer: RelayFn = {
tests/runner/push-sequence-authority.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/push-sequence-authority.test.ts:39:function stubRelayer(): RelayFn {
tests/runner/push-sequence-authority.test.ts:76:    const outcome = await runCompiledFlow({
src/runtime/step-handlers/relay.ts:9:import { deriveResolvedSelection, resolveRelayDecision } from '../relay-selection.js';
src/runtime/step-handlers/relay.ts:118:  const resolvedSelection = deriveResolvedSelection(relayerInv, flow, step, depth);
tests/runner/relay-invocation-failure.test.ts:7:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/relay-invocation-failure.test.ts:40:function throwingRelayer(): RelayFn {
tests/runner/relay-invocation-failure.test.ts:64:    const outcome = await runCompiledFlow({
tests/runner/terminal-verdict-derivation.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/terminal-verdict-derivation.test.ts:19:// runCompiledFlow:
tests/runner/terminal-verdict-derivation.test.ts:44:function fixedRelayer(verdict: string): RelayFn {
tests/runner/terminal-verdict-derivation.test.ts:57:function sequenceRelayer(verdicts: string[]): RelayFn {
tests/runner/terminal-verdict-derivation.test.ts:104:    const outcome = await runCompiledFlow({
tests/runner/terminal-verdict-derivation.test.ts:199:    const outcome = await runCompiledFlow({
tests/runner/terminal-verdict-derivation.test.ts:228:    const outcome = await runCompiledFlow({
tests/runner/terminal-verdict-derivation.test.ts:293:    const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:16:import { type ComposeWriterFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/build-verification-exec.test.ts:165:    const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:205:    const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:239:    const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:269:    const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:313:    const lexical = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:349:    const symlinked = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:383:      const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:416:      const outcome = await runCompiledFlow({
tests/runner/build-verification-exec.test.ts:456:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:17:  runCompiledFlow,
tests/runner/build-report-writer.test.ts:34:      'default runCompiledFlow path writes build.plan@v1 and build.result@v1 reports that parse through their schemas',
tests/runner/build-report-writer.test.ts:418:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:450:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:471:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:492:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:523:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:544:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:565:    const outcome = await runCompiledFlow({
tests/runner/build-report-writer.test.ts:586:    const outcome = await runCompiledFlow({
tests/runner/cli-v2-runtime.test.ts:33:import type { ComposeWriterFn, RelayFn, RelayInput } from '../../src/runtime/runner.js';
tests/runner/cli-v2-runtime.test.ts:172:function relayerWithBody(body: string, connectorName = 'claude-code'): RelayFn {
tests/runner/cli-v2-runtime.test.ts:192:function generatedFixRelayer(): RelayFn {
tests/runner/cli-v2-runtime.test.ts:219:function generatedExploreRelayer(): RelayFn {
tests/runner/cli-v2-runtime.test.ts:242:function generatedMigrateRelayer(): RelayFn {
tests/runner/cli-v2-runtime.test.ts:278:function generatedSweepRelayer(): RelayFn {
tests/runner/cli-v2-runtime.test.ts:303:function tournamentRelayer(): RelayFn {
tests/runner/cli-v2-runtime.test.ts:629:    readonly relayer?: RelayFn;
tests/runner/cli-v2-runtime.test.ts:666:  options: { readonly relayer?: RelayFn } = {},
tests/runner/cli-v2-runtime.test.ts:694:  options: { readonly relayer?: RelayFn; readonly configCwd?: string } = {},
tests/runner/cli-v2-runtime.test.ts:737:    readonly relayer?: RelayFn;
tests/runner/cli-v2-runtime.test.ts:776:    readonly relayer?: RelayFn;
tests/runner/cli-v2-runtime.test.ts:817:    readonly relayer?: RelayFn;
tests/runner/cli-v2-runtime.test.ts:856:    readonly relayer?: RelayFn;
tests/runner/cli-v2-runtime.test.ts:1582:      readonly relayer: RelayFn;
tests/runner/cli-v2-runtime.test.ts:1741:      readonly relayer: RelayFn;
tests/runner/cli-v2-runtime.test.ts:2010:      readonly relayer: RelayFn;
tests/runner/cli-v2-runtime.test.ts:2150:      readonly relayer: RelayFn;
tests/runner/sub-run-real-recursion.test.ts:8:// the runner defaults to `runCompiledFlow` itself, and the parent's
tests/runner/sub-run-real-recursion.test.ts:29:  type RelayFn,
tests/runner/sub-run-real-recursion.test.ts:30:  runCompiledFlow,
tests/runner/sub-run-real-recursion.test.ts:45:      'real runCompiledFlow recurses into the child with a fresh RunId and a sibling run-folder, child emits its own trace, parent admits child verdict',
tests/runner/sub-run-real-recursion.test.ts:47:      'integration test of sub-run + real recursive runCompiledFlow rather than handler-isolation unit test',
tests/runner/sub-run-real-recursion.test.ts:59:function acceptingRelayer(): RelayFn {
tests/runner/sub-run-real-recursion.test.ts:125:      'real-recursion test parent — single sub-run step recurses into the child via real runCompiledFlow.',
tests/runner/sub-run-real-recursion.test.ts:144:        title: 'Sub-run — recurse into child via real runCompiledFlow',
tests/runner/sub-run-real-recursion.test.ts:178:  it('runs the child via real runCompiledFlow (no childRunner stub) and admits the child verdict', async () => {
tests/runner/sub-run-real-recursion.test.ts:192:    // KEY: NO `childRunner` field — runner defaults to `runCompiledFlow`
tests/runner/sub-run-real-recursion.test.ts:194:    const outcome = await runCompiledFlow({
tests/runner/sweep-runtime-wiring.test.ts:17:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/sweep-runtime-wiring.test.ts:101:): RelayFn {
tests/runner/sweep-runtime-wiring.test.ts:188:    const outcome = await runCompiledFlow({
tests/runner/sweep-runtime-wiring.test.ts:299:    const outcome = await runCompiledFlow({
tests/runner/sweep-runtime-wiring.test.ts:333:    const outcome = await runCompiledFlow({
tests/runner/sweep-runtime-wiring.test.ts:361:    const outcome = await runCompiledFlow({
tests/runner/run-relative-path.test.ts:17:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/run-relative-path.test.ts:46:function relayerWithCapture(capture: string[]): RelayFn {
tests/runner/run-relative-path.test.ts:104:        runCompiledFlow({
tests/runner/run-relative-path.test.ts:133:      runCompiledFlow({
tests/runner/run-relative-path.test.ts:213:      runCompiledFlow({
tests/runner/run-relative-path.test.ts:240:      runCompiledFlow({
tests/runner/materializer-schema-parse.test.ts:12:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/materializer-schema-parse.test.ts:37:// add `writes.report`. Cases exercise through the full `runCompiledFlow`
tests/runner/materializer-schema-parse.test.ts:68:function relayerWith(resultBody: string): RelayFn {
tests/runner/materializer-schema-parse.test.ts:125:    const outcome = await runCompiledFlow({
tests/runner/materializer-schema-parse.test.ts:167:    const outcome = await runCompiledFlow({
tests/runner/materializer-schema-parse.test.ts:244:    const outcome = await runCompiledFlow({
tests/runner/materializer-schema-parse.test.ts:329:    const outcome = await runCompiledFlow({
tests/runner/materializer-schema-parse.test.ts:381:    const outcome = await runCompiledFlow({
tests/runner/compose-builder-registry.test.ts:5:// fresh schema's report end-to-end via runCompiledFlow — no runner.ts
tests/runner/compose-builder-registry.test.ts:17:import { runCompiledFlow, writeComposeReport } from '../../src/runtime/runner.js';
tests/runner/compose-builder-registry.test.ts:124:    const outcome = await runCompiledFlow({
tests/runner/compose-builder-registry.test.ts:148:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:30:import { type RelayFn, runCompiledFlow } from '../../src/runtime/runner.js';
tests/runner/review-runtime-wiring.test.ts:82:function relayerWith(result: ReviewRelayResult): RelayFn {
tests/runner/review-runtime-wiring.test.ts:86:function relayerWithBody(body: string): RelayFn {
tests/runner/review-runtime-wiring.test.ts:159:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:202:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:242:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:294:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:363:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:421:      const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:469:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:512:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:564:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:594:    const outcome = await runCompiledFlow({
tests/runner/review-runtime-wiring.test.ts:647:      const outcome = await runCompiledFlow({
tests/runner/relay-handler-direct.test.ts:4:// runCompiledFlow runs, but the handler's own surface — check
```

## Phase 4.26 Trace, Status, And Progress Inventory

Phase 4.26 ran:

```bash
rg -n "run-status-projection|progress-projector|trace-reader|trace-writer|append-and-derive|snapshot-writer|reducer|projectStatusFromTraceV2|createProgressProjectorV2|projectTraceEntryToProgress|readRunTrace|appendTraceEntry|writeDerivedSnapshot|deriveSnapshot|snapshotPath" README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json -g "!docs/architecture/v2-runtime-import-inventory.md"
```

and:

```bash
rg -n "projectRunStatusFromRunFolder|runRunsCommand|runs show|--progress jsonl|ProgressEvent|RunStatusProjection" README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json -g "!docs/architecture/v2-runtime-import-inventory.md"
```

High-signal consumer groups:

```text
src/run-status/project-run-folder.ts owns projectRunStatusFromRunFolder and
RunStatusFolderError as the neutral public runs show dispatcher. src/cli/runs.ts
and public status behavior tests import it directly.

src/runtime/run-status-projection.ts is now an old-path compatibility
re-export.

src/run-status/project-run-folder.ts reads retained v1 traces and delegates to
src/run-status/v1-run-folder.ts, or falls back to src/run-status/v2-run-folder.ts
for marked core-v2 run folders. It is intentionally cross-runtime status
infrastructure today, not old-runner debris.

src/run-status/projection-common.ts owns shared invalid-projection,
saved-flow, report-path, and step-metadata helpers used by both the dispatcher
and the v1/v2 run-folder projectors. It imports result path from
src/shared/result-path.ts.

src/run-status/v1-run-folder.ts imports retained reducer and checkpoint writer
registry helpers to project retained v1 run folders. It imports run-relative
path resolution from src/shared/run-relative-path.ts. The retained reducer and
checkpoint registry dependencies remain retained infrastructure.

src/runtime/progress-projector.ts still owns v1 TraceEntry-to-ProgressEvent
projection. core-v2 uses src/core-v2/projections/progress.ts and shared
progress output helpers instead.

src/runtime/trace-reader.ts, trace-writer.ts, reducer.ts, snapshot-writer.ts,
and append-and-derive.ts are still used by retained runner, checkpoint handler,
handoff, relay smoke tests, event-log round-trip tests, fresh-run-root tests,
and many retained runner tests.

src/core-v2/projections/status.ts owns in-memory v2 trace status projection;
src/core-v2/projections/progress.ts owns v2 progress projection and is wired
through the v2 graph runner.

src/schemas/run-status.ts and src/schemas/progress-event.ts remain public
schema contracts shared by CLI, host surfaces, tests, and release checks.

docs/specs/headless-engine-host-api-v1.md describes runs show as host recovery
and progress JSONL as live rendering. That reinforces the Phase 4.26 decision:
do not move or rewrite projection internals mechanically.

docs/architecture/v2-trace-progress-checkpoint-boundary-plan.md records the
current stop line: do not move trace reader/writer, reducer, snapshot writer,
progress projector, checkpoint resume, old runner, or step handlers before a
checkpoint resume ownership decision or old runner/handler test classification.
```

Targeted current output:

```text
src/run-status/project-run-folder.ts:11:export class RunStatusFolderError extends Error {
src/run-status/project-run-folder.ts:67:export function projectRunStatusFromRunFolder(runFolder: string): RunStatusProjectionV1 {
src/run-status/project-run-folder.ts:3:import { readRunTrace } from '../runtime/trace-reader.js';
src/run-status/v1-run-folder.ts:3:import { reduce } from '../runtime/reducer.js';
src/run-status/v1-run-folder.ts:4:import { findCheckpointBriefBuilder } from '../runtime/registries/checkpoint-writers/registry.js';
src/run-status/v1-run-folder.ts:13:import { resolveRunRelative } from '../shared/run-relative-path.js';
src/run-status/projection-common.ts:7:import { runResultPath } from '../shared/result-path.js';
src/cli/runs.ts:3:  projectRunStatusFromRunFolder,
src/cli/runs.ts:66:export async function runRunsCommand(argv: readonly string[]): Promise<number> {
src/cli/runs.ts:80:    writeJson(projectRunStatusFromRunFolder(parsed.runFolder));
src/runtime/run-status-projection.ts:2:  RunStatusFolderError,
src/runtime/run-status-projection.ts:3:  projectRunStatusFromRunFolder,
src/runtime/run-status-projection.ts:4:} from '../run-status/project-run-folder.js';
src/run-status/v2-run-folder.ts:138:export function projectV2RunStatusFromRunFolder(
src/run-status/projection-common.ts:20:export function invalidProjection(input: {
src/runtime/progress-projector.ts:183:export function projectTraceEntryToProgress(input: {
src/runtime/snapshot-writer.ts:4:import { reduce } from './reducer.js';
src/runtime/snapshot-writer.ts:5:import { readRunTrace } from './trace-reader.js';
src/runtime/snapshot-writer.ts:15:export function snapshotPath(runFolder: string): string {
src/runtime/snapshot-writer.ts:19:export function deriveSnapshot(runFolder: string): Snapshot {
src/runtime/snapshot-writer.ts:24:export function writeDerivedSnapshot(runFolder: string): Snapshot {
src/runtime/trace-reader.ts:4:import { traceEntryLogPath } from './trace-writer.js';
src/runtime/trace-reader.ts:43:export function readRunTrace(runFolder: string): RunTrace {
src/runtime/trace-writer.ts:22:export function appendTraceEntry(runFolder: string, trace_entry: TraceEntry): void {
src/runtime/append-and-derive.ts:3:import { writeDerivedSnapshot } from './snapshot-writer.js';
src/runtime/append-and-derive.ts:4:import { appendTraceEntry } from './trace-writer.js';
src/runtime/runner.ts:22:import { appendAndDerive } from './append-and-derive.js';
src/runtime/runner.ts:32:  projectTraceEntryToProgress,
src/runtime/runner.ts:62:import { writeDerivedSnapshot } from './snapshot-writer.js';
src/runtime/runner.ts:70:import { readRunTrace } from './trace-reader.js';
src/runtime/runner.ts:71:import { appendTraceEntry, traceEntryLogPath } from './trace-writer.js';
src/runtime/step-handlers/checkpoint.ts:12:import { writeDerivedSnapshot } from '../snapshot-writer.js';
src/cli/handoff.ts:6:import { deriveSnapshot } from '../runtime/snapshot-writer.js';
src/core-v2/run/graph-runner.ts:17:import { createProgressProjectorV2 } from '../projections/progress.js';
src/core-v2/projections/progress.ts:165:export function createProgressProjectorV2(input: {
src/core-v2/projections/status.ts:14:export function projectStatusFromTraceV2(entries: readonly TraceEntryV2[]): RunStatusV2 {
tests/runner/run-status-projection.test.ts:6:import { projectRunStatusFromRunFolder } from '../../src/run-status/project-run-folder.js';
tests/runner/run-status-facade.test.ts:7:} from '../../src/run-status/project-run-folder.js';
tests/runner/run-status-facade.test.ts:11:} from '../../src/runtime/run-status-projection.js';
tests/unit/runtime/progress-projector.test.ts:6:import { projectTraceEntryToProgress } from '../../../src/runtime/progress-projector.js';
tests/unit/runtime/event-log-round-trip.test.ts:20:import { reduce } from '../../../src/runtime/reducer.js';
tests/unit/runtime/event-log-round-trip.test.ts:27:import { readRunTrace } from '../../../src/runtime/trace-reader.js';
tests/unit/runtime/event-log-round-trip.test.ts:28:import { appendTraceEntry, traceEntryLogPath } from '../../../src/runtime/trace-writer.js';
tests/core-v2/core-v2-baseline.test.ts:10:import { projectStatusFromTraceV2 } from '../../src/core-v2/projections/status.js';
docs/specs/headless-engine-host-api-v1.md:203:circuit-next runs show --run-folder <path> --json
docs/specs/headless-engine-host-api-v1.md:208:- CLI only parses args, calls `projectRunStatusFromRunFolder`, and prints JSON
docs/specs/headless-engine-host-api-v1.md:315:Check: if a host misses all events, it must still recover fully from `runs show`.
```

## Phase 4.18-4.25 Targeted Reference Scan

```bash
rg -n "src/runtime/connectors/shared.ts|src/shared/connector-helpers.ts|src/shared/connector-relay.ts|src/runtime/connectors/relay-materializer.ts|src/runtime/registries/|src/shared/flow-kind-policy.ts|src/runtime/policy/flow-kind-policy.ts|src/shared/manifest-snapshot.ts|src/runtime/manifest-snapshot-writer.ts|src/shared/operator-summary-writer.ts|src/runtime/operator-summary-writer.ts|src/shared/config-loader.ts|src/runtime/config-loader.ts|src/shared/write-capable-worker-disclosure.ts|src/runtime/write-capable-worker-disclosure.ts|v2-heavy-boundary-plan.md|v2-result-writer-plan.md|src/shared/result-path.ts|src/runtime/result-writer.ts|src/core-v2/run/result-writer.ts" README.md commands plugins .claude-plugin generated docs specs scripts src tests package.json -g "!docs/architecture/v2-runtime-import-inventory.md"
```

```text
scripts/policy/flow-kind-policy.d.mts:6: *   - src/shared/flow-kind-policy.ts — runtime-level
scripts/policy/flow-kind-policy.mjs:3:// Consumed by src/shared/flow-kind-policy.ts, which wraps these
scripts/policy/flow-kind-policy.mjs:236: * in src/shared/flow-kind-policy.ts so this stays Zod-free and
docs/architecture/v2-checkpoint-4.22.md:17:- `src/shared/config-loader.ts`
docs/architecture/v2-checkpoint-4.22.md:21:- `src/runtime/config-loader.ts`
docs/architecture/v2-checkpoint-4.22.md:40:`src/runtime/config-loader.ts` is now a compatibility wrapper. Keep it until
scripts/release/emit-current-capabilities.mjs:776:        'src/shared/operator-summary-writer.ts',
scripts/release/emit-current-capabilities.mjs:777:        'src/shared/write-capable-worker-disclosure.ts',
scripts/release/emit-current-capabilities.mjs:778:        'src/runtime/write-capable-worker-disclosure.ts',
scripts/release/emit-current-capabilities.mjs:780:        'src/runtime/operator-summary-writer.ts',
docs/architecture/v2-checkpoint-4.16.md:15:- `src/shared/connector-relay.ts`
docs/architecture/v2-checkpoint-4.16.md:23:`src/runtime/connectors/shared.ts` remains as a compatibility surface for those
docs/architecture/v2-checkpoint-4.16.md:29:now import the moved surface from `src/shared/connector-relay.ts`.
docs/architecture/v2-checkpoint-4.16.md:31:Connector-only helpers remain in `src/runtime/connectors/shared.ts`:
docs/architecture/v2-checkpoint-4.16.md:45:`src/shared/connector-relay.ts`, so future changes to the moved relay contract
specs/reports.json:279:      "trust_boundary": "operator-local persisted state; written once at bootstrap by the manifest snapshot writer at src/runtime/manifest-snapshot-writer.ts. Hash algorithm: SHA-256 over the exact persisted manifest snapshot bytes (`algorithm: 'sha256-raw'`), per ADR-0001 Addendum B §Stage 1.5 Close Criteria #8. Parse-time superRefine rejects any snapshot whose declared hash disagrees with sha256 over decoded bytes_base64; a second reader cannot be tricked into accepting a tampered byte-body under the declared hash.",
specs/reports.json:832:      "trust_boundary": "engine-computed at Close by the registered explore.result@v1 compose writer from schema-parsed compose.json and review-verdict.json plus flow-declared evidence link paths; terminal report — no in-run readers; cross-run reader is the run result consumer only; path-distinct from run.result so the engine's result-writer (src/runtime/result-writer.ts RESULT-I1 — single writer to result.json) and the orchestrator's close-step (flow-semantic aggregate at explore-result.json) do not collide",
docs/architecture/v2-connector-materializer-plan.md:9:- relay data/hash lives in `src/shared/connector-relay.ts`;
docs/architecture/v2-connector-materializer-plan.md:10:- connector parsing/model helpers live in `src/shared/connector-helpers.ts`;
docs/architecture/v2-connector-materializer-plan.md:11:- `src/runtime/connectors/shared.ts` is now a compatibility re-export surface.
docs/architecture/v2-connector-materializer-plan.md:23:| `src/runtime/connectors/relay-materializer.ts` | retained relay handler tests, relay provenance tests, run-relative path tests, live smoke roundtrip tests | Owns translation from validated connector result to trace entries and durable relay slots; cross-checks role/provenance consistency | Writes request, receipt, result, and optional report files; emits the durable relay transcript sequence | `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, `tests/runner/runner-relay-provenance.test.ts`, `tests/runner/run-relative-path.test.ts`, `tests/runner/materializer-schema-parse.test.ts` | Keep until a materialization-contract plan proves byte-for-byte and trace-shape parity after a move |
docs/architecture/v2-connector-materializer-plan.md:24:| `src/runtime/connectors/shared.ts` | retained runtime imports, tests that still use the old connector surface | No subprocess behavior; compatibility only | No direct writes or trace entries | `tests/runner/connector-shared-compat.test.ts`, full `npm run verify` | Keep as a wrapper until old-path imports are migrated or intentionally retained |
docs/architecture/v2-connector-materializer-plan.md:34:- `src/shared/connector-relay.ts`;
docs/architecture/v2-connector-materializer-plan.md:35:- `src/shared/connector-helpers.ts`;
docs/architecture/v2-connector-materializer-plan.md:36:- `src/runtime/connectors/shared.ts`;
docs/architecture/v2-connector-materializer-plan.md:37:- `src/runtime/connectors/relay-materializer.ts`;
docs/architecture/v2-connector-materializer-plan.md:39:- `src/runtime/registries/report-schemas.ts`.
docs/architecture/v2-connector-materializer-plan.md:44:- `src/shared/connector-relay.ts`;
docs/architecture/v2-connector-materializer-plan.md:45:- `src/shared/connector-helpers.ts`;
docs/architecture/v2-connector-materializer-plan.md:46:- `src/runtime/connectors/shared.ts`;
docs/architecture/v2-connector-materializer-plan.md:47:- `src/runtime/connectors/relay-materializer.ts`;
docs/architecture/v2-connector-materializer-plan.md:49:- `src/runtime/registries/report-schemas.ts`.
generated/release/current-capabilities.json:1805:        "src/shared/operator-summary-writer.ts",
generated/release/current-capabilities.json:1806:        "src/shared/write-capable-worker-disclosure.ts",
generated/release/current-capabilities.json:1807:        "src/runtime/write-capable-worker-disclosure.ts",
generated/release/current-capabilities.json:1809:        "src/runtime/operator-summary-writer.ts"
docs/architecture/v2-deletion-plan.md:74:| `src/runtime/registries/**` | keep / later move | Flow packages, v2 report validation, writer discovery, cross-report validators, and shape hints depend on these registries. |
docs/architecture/v2-deletion-plan.md:75:| `src/runtime/connectors/**` | keep / later move | core-v2 reuses real connector subprocesses, relay materialization, and argv validation. The relay data/hash surface moved to `src/shared/connector-relay.ts` in Phase 4.16, and connector parsing/model helpers moved to `src/shared/connector-helpers.ts` in Phase 4.17. Subprocess modules and materialization remain production safety infrastructure. |
docs/architecture/v2-deletion-plan.md:77:| `src/runtime/config-loader.ts` | compatibility re-export | Config discovery moved to `src/shared/config-loader.ts` in Phase 4.22. Keep this wrapper until old-path tests and external imports stop using it. |
docs/architecture/v2-deletion-plan.md:81:| `src/runtime/result-writer.ts` | retain retained writer / compatibility path export | core-v2 has its own result writer, but retained runtime and old result tests still use this one. Phase 4.25 moved only the shared `reports/result.json` path helper to `src/shared/result-path.ts`; do not merge the writers yet. |
docs/architecture/v2-deletion-plan.md:82:| `src/runtime/manifest-snapshot-writer.ts` | compatibility re-export | Manifest snapshot byte-match helper moved to `src/shared/manifest-snapshot.ts` in Phase 4.20. Keep this wrapper while retained runner and old snapshot tests use the old path. |
docs/architecture/v2-deletion-plan.md:84:| `src/runtime/operator-summary-writer.ts` | compatibility re-export | Operator summary writing moved to `src/shared/operator-summary-writer.ts` in Phase 4.21. Keep this wrapper until old-path tests and release evidence stop using it. |
docs/architecture/v2-deletion-plan.md:88:| `src/runtime/policy/flow-kind-policy.ts` | compatibility re-export | Flow-kind policy moved to `src/shared/flow-kind-policy.ts` in Phase 4.19. Keep this wrapper until old-path imports and documentation references stop using it. |
docs/architecture/v2-deletion-plan.md:89:| `src/runtime/write-capable-worker-disclosure.ts` | compatibility re-export | Disclosure helper moved to `src/shared/write-capable-worker-disclosure.ts` in Phase 4.14. Keep this wrapper while release evidence, old-path compatibility tests/docs, or external old-path consumers still cite the wrapper. |
docs/architecture/v2-deletion-plan.md:111:| `runtime/connectors` | core-v2 relay bridge, retained runtime, connector tests | live connector infrastructure | Keep. Shared relay data/hash ownership moved to `src/shared/connector-relay.ts`, and connector helper ownership moved to `src/shared/connector-helpers.ts`, but subprocess modules and materialization remain production safety infrastructure. |
docs/architecture/v2-deletion-plan.md:130:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-deletion-plan.md:138:- `src/shared/connector-relay.ts`
docs/architecture/v2-deletion-plan.md:139:- `src/shared/connector-helpers.ts`
docs/architecture/v2-deletion-plan.md:145:- `src/shared/write-capable-worker-disclosure.ts`
docs/architecture/v2-deletion-plan.md:147:- `src/shared/flow-kind-policy.ts`
docs/architecture/v2-deletion-plan.md:148:- `src/shared/manifest-snapshot.ts`
docs/architecture/v2-deletion-plan.md:149:- `src/shared/operator-summary-writer.ts`
docs/architecture/v2-deletion-plan.md:150:- `src/shared/config-loader.ts`
docs/architecture/v2-deletion-plan.md:151:- `src/shared/result-path.ts`
docs/architecture/v2-deletion-plan.md:199:| Move connector relay data/hash helper out of `src/runtime/connectors/shared.ts` | Done in Phase 4.16 for `ConnectorRelayInput`, `RelayResult`, and `sha256Hex`. `src/runtime/connectors/shared.ts` remains for compatibility re-exports plus connector-only parsing/model helpers. | Keep connector wrapper compatibility tests, relay/materializer tests, connector selection tests, connector smoke source fingerprint lists, and full validation green. |
docs/architecture/v2-deletion-plan.md:200:| Move connector-only helpers out of `src/runtime/connectors/shared.ts` | Done in Phase 4.17 for `selectedModelForProvider` and `extractJsonObject`. `src/runtime/connectors/shared.ts` remains as a compatibility re-export surface. | Keep connector helper compatibility tests, extraction tests, connector smoke source fingerprint lists, subprocess connector smoke tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:202:| Move flow-kind policy wrapper out of `src/runtime/policy/flow-kind-policy.ts` | Done in Phase 4.19. The neutral wrapper lives in `src/shared/flow-kind-policy.ts`; the runtime path remains a compatibility re-export. | Keep flow-kind policy tests, CLI fixture policy tests, generated-surface drift checks, and full validation green. |
docs/architecture/v2-deletion-plan.md:203:| Move manifest snapshot helper out of `src/runtime/manifest-snapshot-writer.ts` | Done in Phase 4.20. The byte-match implementation lives in `src/shared/manifest-snapshot.ts`; the runtime path remains a compatibility re-export. | Keep event-log round-trip tests, run-status projection tests, fresh-run-root tests, handoff tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:204:| Move operator summary writer out of `src/runtime/operator-summary-writer.ts` | Done in Phase 4.21. The implementation lives in `src/shared/operator-summary-writer.ts`; the runtime path remains a compatibility re-export. | Keep operator summary tests, CLI v2 runtime tests, release evidence checks, and full validation green. |
docs/architecture/v2-deletion-plan.md:205:| Move config loader out of `src/runtime/config-loader.ts` | Done in Phase 4.22. The schema-backed config discovery implementation lives in `src/shared/config-loader.ts`; the runtime path remains a compatibility re-export. | Keep config-loader tests, CLI v2 runtime tests, connector selection tests, and full validation green. |
docs/architecture/v2-deletion-plan.md:206:| Plan the remaining heavy boundaries before risky moves | Done in Phase 4.23. `docs/architecture/v2-heavy-boundary-plan.md` classifies connector subprocesses, relay materialization, registries, router/catalog, compiler, trace/status/progress, result writing, old runner/handlers, and checkpoint resume. | Review the plan before moving or deleting any remaining high-risk runtime cluster. |
docs/architecture/v2-deletion-plan.md:207:| Plan result writer ownership before moving code | Done in Phase 4.24. `docs/architecture/v2-result-writer-plan.md` compares retained and v2 result semantics and recommends a path-only helper extraction before any writer merge. | Keep retained and v2 result writers separate unless a future trace/status/progress ownership review approves merging lifecycle semantics. |
docs/architecture/v2-deletion-plan.md:208:| Move the shared run result path helper | Done in Phase 4.25. `src/shared/result-path.ts` owns `RUN_RESULT_RELATIVE_PATH` and `runResultPath(...)`; `src/runtime/result-writer.ts` keeps the compatibility `resultPath(...)` export. | Keep `src/runtime/result-writer.ts` as the retained writer; this move does not make it deletable. |
docs/architecture/v2-checkpoint-4.13.md:33:- `src/runtime/registries/shape-hints/registry.ts`
src/flows/explore/contract.md:369:`src/runtime/registries/report-schemas.ts`. The canonical report at
src/flows/explore/contract.md:387:`src/runtime/registries/report-schemas.ts` carries the strict
docs/architecture/v2-checkpoint-4.23.md:16:- `docs/architecture/v2-heavy-boundary-plan.md`
docs/architecture/v2-checkpoint-4.23.md:21:- `src/shared/write-capable-worker-disclosure.ts`
docs/architecture/v2-checkpoint-4.23.md:22:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-checkpoint-4.17.md:15:- `src/shared/connector-helpers.ts`
docs/architecture/v2-checkpoint-4.17.md:22:`src/runtime/connectors/shared.ts` remains as a compatibility surface for those
docs/architecture/v2-checkpoint-4.17.md:45:`src/shared/connector-helpers.ts`, so future changes to connector parsing/model
tests/contracts/explore-report-composition.test.ts:5:import { findCloseBuilder } from '../../src/runtime/registries/close-writers/registry.js';
tests/contracts/explore-report-composition.test.ts:6:import { findComposeBuilder } from '../../src/runtime/registries/compose-writers/registry.js';
tests/contracts/explore-report-composition.test.ts:7:import { parseReport } from '../../src/runtime/registries/report-schemas.js';
docs/architecture/v2-checkpoint-4.25.md:17:- `src/shared/result-path.ts`
docs/architecture/v2-checkpoint-4.25.md:22:- `src/runtime/result-writer.ts`
docs/architecture/v2-checkpoint-4.25.md:23:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-checkpoint-4.25.md:26:- `src/shared/operator-summary-writer.ts`
docs/architecture/v2-checkpoint-4.25.md:37:src/shared/result-path.ts
docs/architecture/v2-checkpoint-4.25.md:47:`src/runtime/result-writer.ts` keeps the old `resultPath(...)` export as a
docs/architecture/v2-checkpoint-4.25.md:56:`src/runtime/result-writer.ts` remains live because retained runtime still owns
docs/architecture/v2-checkpoint-4.md:55:- `src/runtime/registries/**`
docs/architecture/v2-checkpoint-4.md:57:- `src/runtime/config-loader.ts`
docs/architecture/v2-checkpoint-4.md:59:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-checkpoint-4.md:61:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-checkpoint-4.md:68:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-checkpoint-4.md:69:- `src/runtime/write-capable-worker-disclosure.ts`
tests/properties/visible/cross-report-validator.test.ts:16:import { reportPathForSchemaInCompiledFlow } from '../../../src/runtime/registries/close-writers/shared.js';
tests/properties/visible/cross-report-validator.test.ts:17:import { runCrossReportValidator } from '../../../src/runtime/registries/cross-report-validators.js';
docs/architecture/v2-rigor-audit.md:13:| Run close rules | `src/runtime/runner.ts`, `src/runtime/result-writer.ts`, `src/schemas/run.ts` | Runs that keep accepting entries after completion, wrong terminal result | CLI, status projection, operator summary | `run.closed`, result writer, trace close validation | keep | `run/graph-runner.ts` and `run/result-writer.ts` | Run trace and runner tests | Close should be a graph-runner responsibility, with result writing isolated. |
docs/architecture/v2-rigor-audit.md:21:| Report schema validation | Flow package `reports.ts`, `src/runtime/registries/*`, connector materializer | Invalid report trusted downstream, bad relay result accepted | Relay executor, report readers, generated manifests | Flow-owned schemas and runtime parsing | keep | Flow-owned validators called by executors | Flow report schema tests and relay tests | Preserve flow package ownership. |
docs/architecture/v2-rigor-audit.md:33:| Manifest snapshot and hash | `src/runtime/manifest-snapshot-writer.ts`, runner bootstrap | Resume against different flow bytes, impossible run audit | Resume path, status readers, tests | Snapshot writer and bootstrap metadata | keep | `manifest/` plus `run/run-context.ts` | Runner and resume tests | v2 should snapshot the executable manifest actually run. |
docs/architecture/v2-result-writer-plan.md:16:| `src/runtime/result-writer.ts` | Retained runtime writer for `reports/result.json`; owns `resultPath(...)` and `writeResult(...)`. | Retained runner, retained status projection, retained sub-run/fanout handlers, retained tests. | Keep for now. Candidate future slice may move only the path helper. |
docs/architecture/v2-result-writer-plan.md:17:| `src/core-v2/run/result-writer.ts` | v2 writer wrapper over `RunFileStore.writeJson('reports/result.json', ...)`. | `src/core-v2/run/graph-runner.ts`; v2 tests and parity tests. | Keep separate. Lifecycle is owned by v2 graph runner. |
docs/architecture/v2-result-writer-plan.md:97:| Retained runtime writer/readers | `src/runtime/result-writer.ts`, `src/runtime/runner.ts`, `src/runtime/run-status-projection.ts`, retained sub-run/fanout handlers | Retained execution and compatibility. |
docs/architecture/v2-result-writer-plan.md:98:| core-v2 writer/readers | `src/core-v2/run/result-writer.ts`, `src/core-v2/run/graph-runner.ts`, v2 sub-run/fanout executors | v2 execution. |
docs/architecture/v2-result-writer-plan.md:99:| Shared consumers | `src/shared/operator-summary-writer.ts`, `src/schemas/result.ts` | Cross-runtime shape or presentation. |
docs/architecture/v2-result-writer-plan.md:114:src/shared/result-path.ts
docs/architecture/v2-result-writer-plan.md:126:- keep `src/runtime/result-writer.ts` as the retained writer;
docs/architecture/v2-result-writer-plan.md:128:- use `RUN_RESULT_RELATIVE_PATH` in `src/core-v2/run/result-writer.ts`;
docs/architecture/v2-result-writer-plan.md:180:- delete `src/runtime/result-writer.ts`.
docs/architecture/v2-result-writer-plan.md:186:After a path-only move, `src/runtime/result-writer.ts` would still remain live
src/runtime/policy/flow-kind-policy.ts:11:// `src/shared/flow-kind-policy.ts`.
docs/architecture/v2-registry-ownership-plan.md:19:- `src/runtime/registries/**`.
docs/architecture/v2-registry-ownership-plan.md:31:| `src/runtime/registries/compose-writers/*` | Compose writer lookup and read-path resolution | retained runner, core-v2 compose executor, flow writers/tests | Flow-owned compose reports are written through this lookup in both runtimes | `src/flows/registries/compose-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:32:| `src/runtime/registries/close-writers/*` | Close/result writer lookup and report-path helper | retained runner, core-v2 compose/close executor, flow close writers, cross-report validators, tests | Result writers and evidence-link path generation depend on it | `src/flows/registries/close-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:33:| `src/runtime/registries/verification-writers/*` | Verification writer lookup and writer type surface | retained verification handler, core-v2 verification executor, flow verification writers, tests | Verification report writing is shared runtime behavior | `src/flows/registries/verification-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:34:| `src/runtime/registries/checkpoint-writers/*` | Checkpoint brief writer lookup and writer type surface | retained checkpoint handler, core-v2 checkpoint executor, run status projection, Build checkpoint writer, tests | Checkpoint brief writing and status projection still rely on it | `src/flows/registries/checkpoint-writers/*` |
docs/architecture/v2-registry-ownership-plan.md:35:| `src/runtime/registries/report-schemas.ts` | Relay report schema parse registry | retained relay/fanout handlers, core-v2 relay executor, report composition tests, connector smoke fingerprints | Fail-closed report parsing is a runtime safety boundary | `src/flows/registries/report-schemas.ts` |
docs/architecture/v2-registry-ownership-plan.md:36:| `src/runtime/registries/cross-report-validators.ts` | Cross-report validator registry | retained relay/fanout handlers, core-v2 relay executor, Sweep validators/tests | Enforces multi-report invariants that Zod cannot express alone | `src/flows/registries/cross-report-validators.ts` |
docs/architecture/v2-registry-ownership-plan.md:37:| `src/runtime/registries/shape-hints/*` | Relay shape hint lookup | shared relay prompt support, flow relay hints, tests | Prompt materialization still depends on flow-owned shape hints | `src/flows/registries/shape-hints/*` |
docs/architecture/v2-registry-ownership-plan.md:68:2. Move type-only registry surfaces first, with `src/runtime/registries/**`
docs/architecture/v2-checkpoint-4.20.md:17:- `src/shared/manifest-snapshot.ts`
docs/architecture/v2-checkpoint-4.20.md:21:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-checkpoint-4.20.md:44:`src/runtime/manifest-snapshot-writer.ts` is now a compatibility wrapper. Keep
src/runtime/registries/compose-writers/types.ts:17:// src/runtime/registries/close-writers/. The two registries are intentionally
src/runtime/runner.ts:441:// under src/runtime/registries/compose-writers/ and is registered by
src/runtime/runner.ts:443:// src/runtime/registries/close-writers/. The runner stays flow-
docs/architecture/v2-checkpoint-2.md:22:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-checkpoint-4.18.md:27:- relay data/hash: `src/shared/connector-relay.ts`
docs/architecture/v2-checkpoint-4.18.md:28:- parsing/model helpers: `src/shared/connector-helpers.ts`
docs/architecture/v2-checkpoint-4.18.md:29:- old connector shared path: `src/runtime/connectors/shared.ts` compatibility
docs/architecture/v2-checkpoint-4.18.md:37:- `src/runtime/connectors/relay-materializer.ts`
docs/architecture/v2-checkpoint-4.18.md:44:`src/runtime/registries/**` is shared flow-package and report infrastructure,
docs/architecture/v2-checkpoint-4.14.md:14:- `src/shared/write-capable-worker-disclosure.ts`
docs/architecture/v2-checkpoint-4.14.md:22:`src/runtime/write-capable-worker-disclosure.ts` remains as a compatibility
src/runtime/operator-summary-writer.ts:10:// `src/shared/operator-summary-writer.ts`; retained runtime callers can keep
docs/architecture/v2-checkpoint-4.19.md:17:- `src/shared/flow-kind-policy.ts`
docs/architecture/v2-checkpoint-4.19.md:21:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-checkpoint-4.19.md:43:`src/runtime/policy/flow-kind-policy.ts` is now a compatibility wrapper. Keep
docs/architecture/v2-checkpoint-4.1.md:49:- `src/runtime/result-writer.ts`
docs/architecture/v2-checkpoint-1.md:145:- `src/runtime/manifest-snapshot-writer.ts`
src/runtime/config-loader.ts:9:// `src/shared/config-loader.ts`; old imports can keep using this wrapper.
src/schemas/result.ts:15:// src/runtime/result-writer.ts); this schema only enforces shape.
docs/architecture/v2-checkpoint-4.24.md:15:- `docs/architecture/v2-result-writer-plan.md`
docs/architecture/v2-checkpoint-4.24.md:31:src/shared/result-path.ts
docs/architecture/v2-checkpoint-4.24.md:36:`src/runtime/result-writer.ts` should remain the retained runtime writer, and
docs/architecture/v2-checkpoint-4.24.md:37:`src/core-v2/run/result-writer.ts` should remain the v2 writer. The path helper
docs/architecture/v2-checkpoint-4.21.md:17:- `src/shared/operator-summary-writer.ts`
docs/architecture/v2-checkpoint-4.21.md:21:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-checkpoint-4.21.md:38:`src/runtime/operator-summary-writer.ts` is now a compatibility wrapper. Keep it
src/runtime/manifest-snapshot-writer.ts:10:// live in `src/shared/manifest-snapshot.ts`; retained runtime callers can keep
tests/runner/codex-relay-roundtrip.test.ts:62://   (b) src/shared/connector-relay.ts — sha256Hex + RelayResult
tests/runner/codex-relay-roundtrip.test.ts:64://   (c) src/shared/connector-helpers.ts — connector parsing/model helpers
tests/runner/codex-relay-roundtrip.test.ts:65://   (d) src/runtime/connectors/shared.ts — compatibility re-exports used by
tests/runner/codex-relay-roundtrip.test.ts:67://   (e) src/runtime/connectors/relay-materializer.ts — five-trace_entry
tests/runner/codex-relay-roundtrip.test.ts:81:  resolve('src/shared/connector-relay.ts'),
tests/runner/codex-relay-roundtrip.test.ts:82:  resolve('src/shared/connector-helpers.ts'),
tests/runner/codex-relay-roundtrip.test.ts:83:  resolve('src/runtime/connectors/shared.ts'),
tests/runner/codex-relay-roundtrip.test.ts:84:  resolve('src/runtime/connectors/relay-materializer.ts'),
tests/runner/codex-relay-roundtrip.test.ts:86:  resolve('src/runtime/registries/report-schemas.ts'),
docs/architecture/v2-worklog.md:142:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:188:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:198:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:400:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:420:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:471:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:481:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:588:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-worklog.md:983:Goal: reduce core-v2's dependency on `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:988:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:991:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:996:- `src/shared/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:997:- `src/runtime/write-capable-worker-disclosure.ts`
docs/architecture/v2-worklog.md:1018:flow helpers now live in `src/shared/write-capable-worker-disclosure.ts`;
docs/architecture/v2-worklog.md:1019:`src/runtime/write-capable-worker-disclosure.ts` re-exports them for retained
docs/architecture/v2-worklog.md:1087:`src/runtime/connectors/shared.ts` without moving connector subprocess modules
docs/architecture/v2-worklog.md:1092:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1102:- `src/shared/connector-relay.ts`
docs/architecture/v2-worklog.md:1103:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1130:`RelayResult`, and `sha256Hex` now live in `src/shared/connector-relay.ts`;
docs/architecture/v2-worklog.md:1131:`src/runtime/connectors/shared.ts` re-exports them for retained runtime and
docs/architecture/v2-worklog.md:1152:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1162:- `src/shared/connector-helpers.ts`
docs/architecture/v2-worklog.md:1163:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1193:`extractJsonObject` now live in `src/shared/connector-helpers.ts`;
docs/architecture/v2-worklog.md:1194:`src/runtime/connectors/shared.ts` re-exports them for retained runtime and old
docs/architecture/v2-worklog.md:1218:- `src/runtime/connectors/relay-materializer.ts`
docs/architecture/v2-worklog.md:1219:- `src/runtime/connectors/shared.ts`
docs/architecture/v2-worklog.md:1220:- `src/runtime/registries/**`
docs/architecture/v2-worklog.md:1278:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1279:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:1282:- `src/shared/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1287:- `src/shared/result-path.ts`
docs/architecture/v2-worklog.md:1288:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1289:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:1292:- `src/shared/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1297:- `docs/architecture/v2-heavy-boundary-plan.md`
docs/architecture/v2-worklog.md:1298:- `docs/architecture/v2-result-writer-plan.md`
docs/architecture/v2-worklog.md:1312:- `src/runtime/result-writer.ts` is still live and not deletable.
docs/architecture/v2-worklog.md:1327:- `src/runtime/result-writer.ts`
docs/architecture/v2-worklog.md:1328:- `src/core-v2/run/result-writer.ts`
docs/architecture/v2-worklog.md:1341:- `docs/architecture/v2-result-writer-plan.md`
docs/architecture/v2-worklog.md:1387:- `docs/architecture/v2-heavy-boundary-plan.md`
docs/architecture/v2-worklog.md:1426:- `src/runtime/config-loader.ts`
docs/architecture/v2-worklog.md:1433:- `src/shared/config-loader.ts`
docs/architecture/v2-worklog.md:1434:- `src/runtime/config-loader.ts`
docs/architecture/v2-worklog.md:1453:`src/shared/config-loader.ts`; `src/runtime/config-loader.ts` re-exports it for
docs/architecture/v2-worklog.md:1474:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1482:- `src/shared/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1483:- `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1504:lives in `src/shared/operator-summary-writer.ts`; `src/runtime/operator-summary-writer.ts`
docs/architecture/v2-worklog.md:1526:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-worklog.md:1535:- `src/shared/manifest-snapshot.ts`
docs/architecture/v2-worklog.md:1536:- `src/runtime/manifest-snapshot-writer.ts`
docs/architecture/v2-worklog.md:1556:read/write/hash helper now lives in `src/shared/manifest-snapshot.ts`;
docs/architecture/v2-worklog.md:1557:`src/runtime/manifest-snapshot-writer.ts` re-exports it for compatibility.
docs/architecture/v2-worklog.md:1580:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:1591:- `src/shared/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:1592:- `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:1616:now lives in `src/shared/flow-kind-policy.ts`; `src/runtime/policy/flow-kind-policy.ts`
docs/architecture/v2-worklog.md:2296:- `src/runtime/registries/`
docs/architecture/v2-worklog.md:2485:- `src/core-v2/run/result-writer.ts`
src/runtime/connectors/relay-materializer.ts:97:// registry at `src/runtime/registries/report-schemas.ts`; unknown schema names
src/runtime/connectors/shared.ts:10:// `src/shared/connector-relay.ts`; connector parsing/model helpers live in
src/runtime/connectors/shared.ts:11:// `src/shared/connector-helpers.ts`. Subprocess connector modules and relay
src/runtime/compile-schematic-to-flow.ts:71:        `schematic item '${item.id}' has verification kind but writes '${item.output}'; no verification writer is registered for that schema (see src/runtime/registries/verification-writers/registry.ts)`,
src/runtime/compile-schematic-to-flow.ts:78:        `schematic item '${item.id}' has checkpoint kind writing report '${item.output}'; no checkpoint writer is registered for that schema (see src/runtime/registries/checkpoint-writers/registry.ts)`,
tests/runner/explore-e2e-parity.test.ts:51:  'src/shared/connector-relay.ts',
tests/runner/explore-e2e-parity.test.ts:52:  'src/shared/connector-helpers.ts',
tests/runner/explore-e2e-parity.test.ts:53:  'src/runtime/connectors/shared.ts',
tests/runner/explore-e2e-parity.test.ts:54:  'src/runtime/connectors/relay-materializer.ts',
tests/runner/explore-e2e-parity.test.ts:56:  'src/runtime/registries/report-schemas.ts',
src/runtime/step-handlers/checkpoint.ts:109:// means adding a builder under src/runtime/registries/checkpoint-writers/.
src/cli/circuit.ts:401:  // Validator: src/shared/flow-kind-policy.ts.
tests/runner/close-builder-registry.test.ts:21:import { findCloseBuilder } from '../../src/runtime/registries/close-writers/registry.js';
tests/runner/close-builder-registry.test.ts:22:import type { CloseBuilder } from '../../src/runtime/registries/close-writers/types.js';
tests/runner/catalog-derivations.test.ts:21:import type { CheckpointBriefBuilder } from '../../src/runtime/registries/checkpoint-writers/types.js';
tests/runner/catalog-derivations.test.ts:22:import type { CloseBuilder } from '../../src/runtime/registries/close-writers/types.js';
tests/runner/catalog-derivations.test.ts:23:import type { ComposeBuilder } from '../../src/runtime/registries/compose-writers/types.js';
tests/runner/catalog-derivations.test.ts:24:import type { StructuralShapeHint } from '../../src/runtime/registries/shape-hints/types.js';
tests/runner/catalog-derivations.test.ts:25:import type { VerificationBuilder } from '../../src/runtime/registries/verification-writers/types.js';
tests/runner/catalog-derivations.test.ts:461:      '../../src/runtime/registries/compose-writers/registry.js'
tests/runner/catalog-derivations.test.ts:464:      '../../src/runtime/registries/close-writers/registry.js'
tests/runner/catalog-derivations.test.ts:467:      '../../src/runtime/registries/verification-writers/registry.js'
tests/runner/catalog-derivations.test.ts:470:      '../../src/runtime/registries/checkpoint-writers/registry.js'
tests/runner/relay-shape-hint-registry.test.ts:20:} from '../../src/runtime/registries/shape-hints/registry.js';
tests/runner/relay-shape-hint-registry.test.ts:21:import type { RelayStep } from '../../src/runtime/registries/shape-hints/types.js';
tests/runner/cross-report-validators.test.ts:6:import { reportPathForSchemaInCompiledFlow } from '../../src/runtime/registries/close-writers/shared.js';
tests/runner/cross-report-validators.test.ts:7:import { runCrossReportValidator } from '../../src/runtime/registries/cross-report-validators.js';
tests/runner/compose-builder-registry.test.ts:15:import { findComposeBuilder } from '../../src/runtime/registries/compose-writers/registry.js';
tests/runner/compose-builder-registry.test.ts:16:import type { ComposeBuilder } from '../../src/runtime/registries/compose-writers/types.js';
```
