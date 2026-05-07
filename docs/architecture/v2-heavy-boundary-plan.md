# Circuit v2 Heavy Boundary Plan

Phase 4.23 was a planning checkpoint. Phase 5.33 has since moved connector
subprocess modules and relay materialization to neutral `src/connectors/**`
ownership and router/compiler implementations to neutral `src/flows/**`
ownership, with old `src/runtime/**` compatibility re-exports. The remaining
high-risk boundaries in this document are retained trace/status/checkpoint
state, retained fallback execution, and old handler/oracle ownership.

The low-risk helper extraction lane is now complete. The remaining runtime
namespace contains product behavior, safety boundaries, shared flow
infrastructure, or retained fallback/oracle code.

## Boundary Summary

| Cluster | Current consumers | Product behavior | Contract boundary | Disposition | Risk | Required proof |
|---|---|---|---|---|---|---|
| Connector subprocess modules | `src/core-v2/executors/relay.ts`, connector contract/smoke tests | Runs Claude Code, Codex, and custom connector commands; enforces argv, provider/model, timeout, output, and sandbox rules | External process execution and connector safety | Neutral owner is `src/connectors/**`; old runtime wrappers are retired | High | connector schema tests, real/controlled connector smoke, custom connector tests, CLI unsafe connector tests, full verify |
| Relay materializer | Retained relay handler, relay provenance tests, connector roundtrip tests | Turns connector results into durable request/receipt/result/report files and trace entries | On-disk relay slot and trace transcript shape | Neutral owner is `src/connectors/relay-materializer.ts`; keep old runtime wrapper | High | golden trace/on-disk tests, run-relative path tests, materializer schema tests, connector roundtrips, full verify |
| Registries and catalog-derived writer/report infrastructure | flow packages, core-v2 executors, retained handlers, tests, generated surfaces | Looks up compose/close/checkpoint/verification writers, report schemas, cross-report validators, and relay shape hints | Flow package source-of-truth and report validation | Keep until a neutral flow registry namespace is designed | High | catalog derivation tests, writer registry tests, report schema tests, cross-report validators, generated drift, full verify |
| Router/catalog infrastructure | CLI, router tests, generated command claims, catalog derivations | Natural-language flow selection, entry-mode inference, default routable flow | Product routing behavior | Neutral owner is `src/flows/router.ts`; old `src/runtime/router.ts` wrapper is retired | Medium-high | CLI router tests, flow router contracts, generated docs checks, release public-claim checks |
| Compiler / schematic projection | generator, flow compiler tests, generated flows, release checks | Converts schematics to compiled flows and generated plugin surfaces | Generated surface source of truth | Neutral owner is `src/flows/compile-schematic-to-flow.ts`; old runtime wrapper is retired | Medium-high | compiler tests, orphan block tests, generated-surface drift, release checks |
| Trace reader/writer/reducer/snapshot | retained runner, status/progress, event-log tests, checkpoint resume | Reads, appends, reduces, and snapshots v1 run traces | v1 trace oracle and retained state model | Keep until retained trace/status ownership is narrowed | High | runtrace schema tests, event-log round-trip tests, status projection tests, retained runner tests |
| Status/progress projection | `runs show`, CLI progress, old and v2 run folders, tests | Projects v1/v2 run folders and progress events for operators | Operator inspection and host progress compatibility | Keep as cross-runtime compatibility infrastructure | High | run-status projection tests, progress schema tests, CLI progress tests, malformed trace tests |
| Result writer | retained runner and old result tests | Writes retained runtime `reports/result.json` and checks trace/result consistency | User-visible run result report | Keep until retained runner result ownership is narrowed | Medium | result writer tests, runner close tests, status tests |
| Old runner | CLI fallback, rollback, unsupported modes, arbitrary fixtures, `composeWriter`, public checkpoint resume wrapper, old tests | Retained execution path for non-v2-owned invocations | Product fallback and resume execution owner | Keep until fallback/resume policy changes | High | CLI fallback tests, checkpoint resume tests, old runner oracle tests, full verify |
| Checkpoint resume preparation | `src/runtime/runner.ts`, retained trace/snapshot/checkpoint infrastructure | Finds and validates waiting checkpoint runs before retained resume execution | Manifest/trace/request/report validation | Keep retained-runtime-owned while checkpoint resume remains retained | High | checkpoint resume identity/tamper tests, manifest snapshot tests, CLI resume tests |
| Old step handlers | retained runner and handler tests | Executes retained checkpoint, compose, relay, verification, sub-run, fanout, and recovery behavior | Old execution oracle and fallback behavior | Keep until each handler is v2-owned or explicitly retained | High | direct handler tests, runtime wiring tests, v2 parity tests |
| Checkpoint resume | CLI `resume`, retained checkpoint handler, manifest/snapshot/trace infrastructure | Continues waiting checkpoint runs | Interactive/resume product behavior | Keep retained-runtime-owned until v2 resume is implemented or permanently retained | High | checkpoint resume tests, manifest snapshot tests, CLI resume tests |

## Non-Goals For The Next Move

Do not combine any of these with another helper cleanup:

- change connector subprocess behavior or permissions;
- change relay materialization shape;
- move registries;
- change router/catalog behavior;
- change generated flow compilation behavior;
- route checkpoint resume through v2;
- change the default selector or rollback policy;
- delete old runner or old step handlers.

## Recommended Next Slice

The next implementation slice should not move a high-risk boundary directly.
It should choose one of these paths and write the proof plan first:

1. **Result writer neutralization plan.**
   Completed in Phase 4.24. It recommends a future path-only helper
   extraction for `reports/result.json`, while keeping retained and v2 writers
   separate. The path-only extraction was completed in Phase 4.25.
2. **Trace/status/progress ownership plan.**
   Best if the team wants to clarify v1/v2 inspection and retained run folder
   compatibility before deleting anything.
3. **Flow registry neutral namespace plan.**
   Completed in Phase 5.13 for registries/catalog derivations and extended in
   Phase 5.33 for router/compiler implementation ownership.
4. **Connector/materializer safety plan.**
   Completed for neutral ownership in Phase 5.32. Future connector work should
   focus on behavior changes, old-path retirement, or stronger smoke evidence,
   each with focused review.
5. **Checkpoint resume ownership plan.**
   Best if the team wants to reduce retained runtime product ownership rather
   than keep moving shared infrastructure.

Phase 4.37 completed the first retained checkpoint resume shrink:
`src/runtime/checkpoint-resume.ts` owns resume discovery/validation while
`resumeCompiledFlowCheckpoint(...)` and `executeCompiledFlow(...)` remain in
`src/runtime/runner.ts`. Do not move `progress-projector.ts`, trace
reader/writer, reducer, snapshot writer, checkpoint handler, old runner
execution loop, or step handlers without another focused ownership decision.

Phase 4.38 maps the remaining runner boundary and recommends stopping runner
shrinkage for now. The only plausible next shrink candidate is close/result
finalization, and that should get a focused proposal before any code movement.

Phase 4.39 refreshes the runner/handler test classification and current import
inventory after the resume extraction. The refresh does not change the boundary:
old runner and handler tests remain live product or oracle evidence.

Phase 4.40 proposes the close/result finalization boundary and recommends
keeping it in `runner.ts` for now. Any extraction of the retained close tail
needs focused review before code movement.

## Deletion Status

Old runtime deletion is still blocked.

Deletion can only be reconsidered after each retained runtime responsibility is
classified as one of:

- v2-owned;
- permanently retained behind a smaller module;
- neutral shared infrastructure;
- compatibility wrapper;
- obsolete and covered by tests.

No `src/runtime` file should be deleted as part of Phase 4.23.
