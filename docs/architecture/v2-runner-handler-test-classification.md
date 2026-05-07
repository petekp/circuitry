# Circuit v2 Runner And Handler Test Classification

Phase 4.33 classified old runner and direct handler tests before any checkpoint
resume implementation, retained-resume shrink, or old runtime deletion.
Phase 4.39 refreshes the same map after Phase 4.37 extracted retained
checkpoint resume preparation into `src/runtime/checkpoint-resume.ts` and
Phase 4.38 recommended stopping further runner shrinkage for now.
Phase 4.41 adds a focused helper test for the extracted terminal verdict rule,
and Phase 5.37 moves that pure helper to `src/shared/terminal-verdict.ts` while
keeping the old runtime path as a compatibility re-export. Phase 5.38 moves the
pure fanout join-policy helper to `src/shared/fanout-join-policy.ts`, with the
old retained fanout path kept as a compatibility re-export. Phase 5.39 moves
the pure recovery route priority helper to `src/shared/recovery-route.ts`, with
the old retained route helper path kept as a compatibility re-export. Phase
5.40 moves the generic path-safe JSON report helper to `src/shared/json-report.ts`.
Phase 5.5 adds the current deletion-readiness conclusion: no retained runner or
handler test is obsolete. Phase 5.15 starts moving accidental test-only type
imports to shared/facade modules, but it does not delete retained tests or
change retained behavior. The second Phase 5.15 batch split more retained-runner
tests so old runner imports are value-level execution/helper calls, while relay
and retained callback/data types come from shared or facade modules. Phase 5.16
adds more v2 twins for relay recovery, report gating, and connector invocation
failure behavior, while keeping the retained tests live. Phase 5.17 adds strict
v2 final-result proof for executor throws and pass-route cycles. Phase 5.32
moves connector subprocess modules and relay materialization to neutral
`src/connectors/**` ownership, while keeping old runtime connector import paths
as compatibility wrappers.

No code moves are approved by this document.

## Classification Labels

| Label | Meaning |
|---|---|
| retained product fallback | Tests behavior that the product still routes through retained runtime. Keep until policy changes. |
| checkpoint-resume product coverage | Tests checkpoint waiting/resume behavior. Keep until v2 owns checkpoint pause/resume or retained resume is narrowed with equivalent proof. |
| old-runtime oracle | Tests behavior that v2 has some coverage for, but where the retained runtime remains the comparison oracle or fallback path. |
| migrate to v2 later | Useful behavior to express through core-v2 tests once the target owner is ready. Do not delete yet. |
| compatibility import | Imports old runtime type/helper surfaces but does not primarily test old execution. Migrate imports only when the old surface is intentionally retired. |
| shared helper proof | Tests pure shared behavior used by retained and v2 implementations. Keep while both engines depend on the helper. |
| delete only after obsolete | No current file is in this bucket. |

## Phase 5.5 Four-Bucket Summary

| Bucket | Current disposition |
|---|---|
| retained fallback coverage | Keep. This includes retained/v1 checkpoint resume, rollback, unsupported rows, retained run folder status/progress, connector/materializer compatibility wrappers, handoff run-backed continuity, and old import compatibility. |
| oracle coverage | Keep. Direct handler tests, flow runtime wiring tests, report writer tests, sub-run/fanout recursion tests, and fanout join-policy property tests still compare behavior v2 must preserve or deliberately retire. |
| migrated to v2 | No retained runner or handler test moves to this bucket yet. V2 coverage exists, but it does not retire retained fallback/oracle proof. |
| obsolete candidate | None. |

See `docs/architecture/v2-deletion-readiness-inventory.md` for the current
inventory table.

## Direct Checkpoint Resume Coverage

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/build-checkpoint-exec.test.ts` | checkpoint-resume product coverage | Covers deep checkpoint waiting, operator resume, invalid choices, manifest/trace identity rejection, missing/tampered brief, request hash tampering, original selection/config restoration, original project root restoration, post-checkpoint relay, and post-checkpoint verification. |
| `tests/runner/explore-tournament-runtime.test.ts` | oracle coverage | Covers the retained Explore tournament behavior that core-v2 now mirrors for generated tournament runs. Keep as comparison proof until retained fanout/checkpoint ownership is retired. |
| `tests/runner/cli-v2-runtime.test.ts` | retained product fallback and v2 selector coverage | Proves retained/v1 checkpoint resume, rollback, arbitrary fixtures, custom roots, `composeWriter`, and current core-v2 selector rows. |
| `tests/runner/run-status-projection.test.ts` | checkpoint-resume product coverage | Proves `runs show` projects waiting checkpoints and validates malformed checkpoint request/report state. |

Decision: these tests are non-negotiable until checkpoint resume ownership
changes. They are the main proof that retained checkpoint behavior is still
safe.

## Direct Handler Tests

| Test | Handler | Classification | Why keep |
|---|---|---|---|
| `tests/runner/checkpoint-handler-direct.test.ts` | checkpoint | checkpoint-resume product coverage | Tests checkpoint resolution lattice, operator resume branch, error handling, and trace sequence invariants below the runner. |
| `tests/runner/relay-handler-direct.test.ts` | relay | old-runtime oracle | Tests retained relay handler verdict mapping, connector failures, and trace sequence invariants. |
| `tests/runner/verification-handler-direct.test.ts` | verification | old-runtime oracle | Tests retained verification error paths and trace sequence invariants. |
| `tests/runner/sub-run-handler-direct.test.ts` | sub-run | old-runtime oracle | Tests retained sub-run pre-execution aborts, child execution failures, verdict evaluation, and trace behavior. |
| `tests/runner/fanout-handler-direct.test.ts` | fanout | old-runtime oracle | Tests retained fanout pre-execution aborts, branch failures, join policies, and trace sequence invariants. |
| `tests/properties/visible/fanout-join-policy.test.ts` | fanout helper | shared helper proof | Tests shared join-policy behavior used by retained and v2 fanout paths, plus the old retained path compatibility re-export. |

Decision: do not delete direct handler tests yet. They are still the clearest
low-level proof for retained fallback and for behaviors v2 must preserve.

## Retained Runner Control-Loop Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/runtime-smoke.test.ts` | retained product fallback | Proves retained `runCompiledFlow` can still bootstrap, execute, and close. |
| `tests/runner/fresh-run-root.test.ts` | retained product fallback | Proves fresh run-folder claim and reuse behavior. |
| `tests/runner/handler-throw-recovery.test.ts` | retained product fallback | Proves handler throws become clean abort/result state instead of corrupting run folders. |
| `tests/runner/pass-route-cycle-guard.test.ts` | retained product fallback | Proves retained route-cycle abort behavior. |
| `tests/runner/push-sequence-authority.test.ts` | retained product fallback | Proves retained push sequencing is the trace sequence authority. |
| `tests/runner/terminal-outcome-mapping.test.ts` | retained product fallback | Proves terminal route mapping for retained runs. |
| `tests/runner/terminal-verdict-derivation.test.ts` | retained product fallback | Proves retained result verdict derivation. |
| `tests/runner/terminal-verdict-helper.test.ts` | retained product fallback | Proves the shared terminal admitted verdict helper and old runtime compatibility re-export used by the retained close tail. |
| `tests/runner/check-evaluation.test.ts` | retained product fallback | Proves retained check evaluation and route behavior through the full runner loop. |
| `tests/runner/relay-invocation-failure.test.ts` | retained product fallback | Proves retained relay invocation failures close safely. |
| `tests/runner/run-relative-path.test.ts` | retained product fallback | Proves retained runner rejects unsafe run-relative reads/writes. |

Decision: keep until unsupported modes, rollback, arbitrary fixtures,
`composeWriter`, and checkpoint resume either move to v2 or are intentionally
kept behind a smaller retained module.

## Flow Runtime Wiring Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/review-runtime-wiring.test.ts` | old-runtime oracle | Retained Review execution remains a comparison oracle for generated Review behavior. |
| `tests/runner/fix-runtime-wiring.test.ts` | old-runtime oracle | Retained Fix lite/default wiring remains fallback/oracle coverage. |
| `tests/runner/build-runtime-wiring.test.ts` | checkpoint-resume product coverage | Build wiring includes checkpoint-depth policy, entry-mode depth behavior, and retained checkpoint behavior. |
| `tests/runner/build-report-writer.test.ts` | old-runtime oracle | Proves retained Build report writer integration. |
| `tests/runner/build-verification-exec.test.ts` | old-runtime oracle | Proves retained verification execution and project-root safety behavior. |
| `tests/runner/explore-report-writer.test.ts` | old-runtime oracle | Proves retained Explore report writer integration. |
| `tests/runner/explore-e2e-parity.test.ts` | old-runtime oracle | Proves retained Explore connector/report behavior and smoke fingerprints. |
| `tests/runner/migrate-runtime-wiring.test.ts` | old-runtime oracle | Proves retained Migrate full flow behavior. |
| `tests/runner/sweep-runtime-wiring.test.ts` | old-runtime oracle | Proves retained Sweep full flow behavior. |
| `tests/runner/fix-report-writer.test.ts` | compatibility import | Uses retained compose writer helper directly; not a runner deletion blocker by itself. |

Decision: these are not deletion candidates. Some can gain v2 equivalents over
time, but old tests remain useful while retained fallback is product policy.

## Sub-Run And Fanout Retained Runtime Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/sub-run-runtime.test.ts` | old-runtime oracle | Proves retained sub-run execution through old runner. |
| `tests/runner/sub-run-real-recursion.test.ts` | old-runtime oracle | Proves retained real recursive child execution. |
| `tests/runner/fanout-runtime.test.ts` | old-runtime oracle | Proves retained fanout execution through old runner. |
| `tests/runner/fanout-real-recursion.test.ts` | old-runtime oracle | Proves retained fanout branches can recurse through real `runCompiledFlow`. |

Decision: keep until v2 sub-run/fanout behavior is considered the sole owner
for supported paths and retained fallback policy is narrowed.

## Registry, Materializer, And Connector-Adjacent Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/runner/materializer-schema-parse.test.ts` | retained product fallback | Exercises relay materialization through retained runner; materializer implementation now lives in `src/connectors/**` and remains production safety infrastructure. |
| `tests/runner/agent-relay-roundtrip.test.ts` | retained product fallback | Uses retained bootstrap/append helpers for relay roundtrip proof. |
| `tests/runner/codex-relay-roundtrip.test.ts` | retained product fallback | Uses retained bootstrap/append helpers and fingerprints `src/runtime/runner.ts`. |
| `tests/runner/runner-relay-provenance.test.ts` | retained product fallback | Proves retained relay provenance through `runCompiledFlow`. |
| `tests/runner/runner-relay-connector-identity.test.ts` | retained product fallback | Proves retained connector identity plumbing through `runCompiledFlow`. |
| `tests/runner/compose-builder-registry.test.ts` | old-runtime oracle | Proves registry writer integration through retained runner. |
| `tests/runner/close-builder-registry.test.ts` | old-runtime oracle | Proves close writer registry integration through retained runner. |

Decision: do not use these as a reason to delete old connector wrappers, change
connector behavior, or move registries. They prove those boundaries remain
live.

## Compatibility Import Tests

Phase 5.15 moved the casual shared relay type imports in
`tests/contracts/codex-host-plugin.test.ts`, `tests/runner/cli-router.test.ts`,
`tests/runner/config-loader.test.ts`, `tests/runner/cli-v2-runtime.test.ts`,
and `tests/soak/v2-runtime-surface.test.ts` to `src/shared/**` or
`src/compat/**`. The second batch made the same split across retained runner,
direct handler, and contract tests: shared relay types now come from
`src/shared/relay-runtime-types.ts`, retained callback/data types now come from
`src/compat/retained-runtime.ts`, and old `src/runtime/runner.ts` imports remain
only where a test intentionally calls retained execution or old helper values.

Phase 5.15 also moved casual `sha256Hex` helper imports to
`src/shared/connector-relay.ts`, leaving
`tests/runner/connector-shared-compat.test.ts` as the explicit neutral connector
helper proof.

Phase 5.32 moves connector subprocess modules and relay materialization to
`src/connectors/**`. Tests now import real connector implementations from the
neutral path. Final cutover later removed the old `src/runtime/connectors/**`
wrappers.

Phase 5.19 moves retained execution calls behind the retained compatibility
facade across the runner/contract test suite. Tests no longer import
`runCompiledFlow` or `resumeCompiledFlowCheckpoint` directly from
`src/runtime/runner.js`; they import
`runRetainedCompiledFlow as runCompiledFlow` or
`resumeRetainedCompiledFlowCheckpoint as resumeCompiledFlowCheckpoint` from
`src/compat/retained-runtime.ts`. Direct old runner imports now remain for
helper-specific compatibility/oracle surfaces such as `writeComposeReport`,
`writePrototypeComposeReport`, `appendAndDerive`, `bootstrapRun`,
`initRunFolder`, and fresh-run claim helpers.

Phase 5.20 puts those retained helper calls behind the facade too. The helpers
still live in retained runtime implementation modules, and
`tests/runner/fix-report-writer.test.ts` remains as the explicit public
`writeComposeReport` old-path proof. Other tests now use retained-named facade
exports for append/bootstrap/init/fresh-run-claim and compose report helpers.

Phase 5.23 narrows the remaining direct test imports of retained checkpoint
resume to `src/compat/retained-checkpoint-folders.ts`, matching the production
CLI/handoff/run-status saved-folder boundary. The broad
`src/compat/retained-runtime.ts` still re-exports those helpers for compatibility
but should not be the default import path for new saved-folder test code.

Phase 5.34 extends that guard posture to retained trace/status/checkpoint
internals. Tests that only need retained trace reads should use
`src/compat/retained-checkpoint-folders.ts`; direct imports from retained
trace-reader/writer, reducer, snapshot, progress projector, checkpoint resume,
append-and-derive, or checkpoint handler modules must stay explicit old-oracle
or old-path proof.

Phase 5.38 moves the fanout join-policy property test to the shared helper path
and keeps an explicit assertion that the old retained fanout export still
points at the same helper.

Phase 5.39 adds `tests/runner/recovery-route-compat.test.ts` as the explicit
compatibility proof for shared recovery route priority. The test keeps retained
old-path and core-v2 adapter behavior tied to the shared helper.

Phase 5.40 adds `tests/runner/json-report-compat.test.ts` as the explicit
compatibility proof for the path-safe JSON report helper. Retained handlers now
import the shared helper directly; the old retained handler helper path remains
a wrapper.

Phase 5.41 adds `tests/runner/fanout-aggregate-compat.test.ts` as the explicit
compatibility proof for fanout aggregate report body construction. Retained
fanout and core-v2 fanout now both delegate to `src/shared/fanout-aggregate-report.ts`;
the old retained aggregate helper path remains a wrapper.

Decision: continue moving accidental type/helper imports to neutral modules as
low-risk implementation work. Keep explicit old-path compatibility tests and
tests that intentionally execute `runCompiledFlow(...)` through the retained
compatibility facade.

## V2 Twin Tests Added From Old Oracles

| Test | Old oracle covered | What it proves |
|---|---|---|
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/terminal-outcome-mapping.test.ts` | Core-v2 maps `@complete`, `@stop`, `@handoff`, and `@escalate` to the retained terminal outcome vocabulary and writes matching final results. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/terminal-outcome-mapping.test.ts` | Core-v2 executes rich checkpoint route labels through their declared routes and bounds retry loops with `budgets.max_attempts`. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/checkpoint-handler-direct.test.ts` | Core-v2 checkpoint auto-resolution failures emit a request, `check.evaluated`/fail, and `step.aborted` without writing `checkpoint.resolved`. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/check-evaluation.test.ts` | Core-v2 admits the actual connector verdict from the relay body, including non-first `check.pass` members, and rejects malformed or unaccepted verdicts without carrying them into the final result. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/relay-handler-direct.test.ts` | Core-v2 rejects relay result shape edge cases, including array bodies, `null` bodies, and empty verdict strings, without admitting a final verdict. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/relay-handler-direct.test.ts`, `tests/runner/check-evaluation.test.ts`, and `tests/runner/relay-invocation-failure.test.ts` | Core-v2 production relay paths record ordered transcript evidence for admitted checks, failed checks, and connector throws while keeping final verdict admission strict. |
| `tests/core-v2/control-loop-v2.test.ts` and `tests/core-v2/connectors-v2.test.ts` | `tests/runner/runner-relay-provenance.test.ts` and `tests/runner/runner-relay-connector-identity.test.ts` | Core-v2 production relay traces carry connector identity plus the connector resolution source, and the resolver preserves provenance through default, role, explicit, and custom connector decisions. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/terminal-outcome-mapping.test.ts` | Core-v2 routes failed relay checks through declared recovery routes without admitting the rejected verdict into the final result. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/check-evaluation.test.ts` | Core-v2 keeps relay transcript files for failed checks, omits the canonical admitted report and `relay.completed.report_path`, and writes both only after relay admission passes. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/relay-invocation-failure.test.ts` | Core-v2 connector invocation failures recover through a declared route when available, otherwise abort cleanly without an admitted final verdict. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/verification-handler-direct.test.ts` | Core-v2 verification pre-write failures emit `check.evaluated`/fail, abort without `step.report_written`, and do not write the canonical verification report. |
| `tests/core-v2/sub-run-v2.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 sub-runs fail closed for missing resolvers, wrong resolved flow ids, child invocation failures, and missing child verdicts while preserving child result evidence where available. |
| `tests/core-v2/sub-run-v2.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 sub-runs now record resolver throws as explicit check failures and copy malformed child result evidence before rejecting invalid child result bodies. |
| `tests/core-v2/sub-run-v2.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 sub-runs do not admit an otherwise allowed child verdict when the child run closes non-complete, so aborted child results do not leak into the parent final verdict. |
| `tests/core-v2/sub-run-v2.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 sub-runs record invalid child compiled-flow bytes from the resolver as explicit check failures before `sub_run.started`. |
| `tests/core-v2/sub-run-v2.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 sub-runs reject divergent `writes.report` and `writes.result` paths before child start, emit check failure evidence, and avoid invoking the child runner. |
| `tests/core-v2/core-v2-baseline.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 final result selection ignores non-complete `sub_run.completed` verdict traces even when older/custom traces lack `data.admitted: false`. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/runner/fanout-handler-direct.test.ts` | Core-v2 dynamic fanout expansion failures abort before `fanout.started`, do not call relay branches, and do not write the aggregate. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/runner/fanout-handler-direct.test.ts` | Core-v2 sub-run fanout branch failures from worktree provisioning throws and child runner throws record aborted branch completions with `<no-verdict>`, let sibling branches finish under `continue-others`, and fail the disjoint-merge join with evidence. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/runner/fanout-handler-direct.test.ts` | Core-v2 disjoint-merge fanout fails when completed branches report overlapping changed files, records the file-conflict reason, and still cleans up branch worktrees. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/properties/visible/fanout-join-policy.test.ts` | Core-v2 disjoint-merge fanout fails when changed-file discovery throws after branches complete, records the `file-disjoint validation failed` reason, and still cleans up branch worktrees. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/runner/fanout-handler-direct.test.ts` and `tests/properties/visible/fanout-join-policy.test.ts` | Core-v2 fanout executor wiring carries pick-winner success/failure, aggregate-only failure, and resolver-throw branch failures into aggregate reports, `fanout.joined`, `check.evaluated`, and final outcomes. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/runner/fanout-handler-direct.test.ts` and `tests/properties/visible/fanout-join-policy.test.ts` | Core-v2 fanout executor wiring carries aggregate-only success with parseable non-admitted branch verdicts and abort-all short-circuiting through trace evidence, aggregate reports, and final outcomes. |
| `tests/core-v2/fanout-v2.test.ts` | `tests/runner/fanout-handler-direct.test.ts` | Core-v2 successful sub-run fanout records branch start/completion, aggregate report writing, join evidence, check pass, step completion, and run closure in order. |
| `tests/core-v2/sub-run-v2.test.ts` | `tests/runner/sub-run-handler-direct.test.ts` | Core-v2 sub-runs reject a missing child runner before `sub_run.started`, emit `check.evaluated` failure evidence, and close cleanly. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/terminal-verdict-derivation.test.ts` | Core-v2 final result selection uses the later admitted relay verdict when multiple relay verdicts are admitted before `@complete`. |
| `tests/core-v2/control-loop-v2.test.ts` | `tests/runner/terminal-verdict-derivation.test.ts` | Core-v2 omits previously admitted relay verdicts from non-complete final results, matching the retained/shared terminal verdict contract. |
| `tests/core-v2/core-v2-baseline.test.ts` | `tests/runner/handler-throw-recovery.test.ts` | Core-v2 executor throws close cleanly, write a parseable aborted `reports/result.json`, and do not write `step.completed` for the failed step. |
| `tests/core-v2/core-v2-baseline.test.ts` | `tests/runner/pass-route-cycle-guard.test.ts` | Core-v2 pass-route cycles abort before step completion and write a parseable final result with the route-cycle reason. |

Decision: these v2 twins reduce oracle risk but do not make the retained tests
obsolete. The retained tests still prove retained fallback behavior while
arbitrary fixtures, custom roots, rollback, public `composeWriter`, and v1 run
folders remain supported through retained compatibility.

## Trace And Snapshot Tests

| Test | Classification | Why keep |
|---|---|---|
| `tests/unit/runtime/event-log-round-trip.test.ts` | retained product fallback | Proves v1 trace append/read/reduce/snapshot behavior. Required while checkpoint resume uses v1 trace/state. |
| `tests/unit/runtime/progress-projector.test.ts` | retained product fallback | Proves retained trace-to-progress projection. Required while retained runtime can emit progress. |

Decision: these tests block moving trace reader/writer, reducer, snapshot
writer, append-and-derive, or progress projector without a separate ownership
plan.

## Migration Candidates

Useful future v2 test targets:

- checkpoint waiting and resume parity, if Option A is selected later;
- more retained route-cycle behavior, if old fallback narrows;
- more relay provenance and connector identity behavior, if retained relay behavior narrows;
- direct handler invariants that become v2 executor invariants.

Not migration candidates yet:

- checkpoint resume tests;
- trace/snapshot round-trip tests;
- progress projector tests;
- connector subprocess/materializer behavior tests;
- registry integration tests.

Those still prove retained product behavior.

## Recommended Next Action

Do not delete old runner or handler tests.

Do not move old runner or handler code.

The earlier next-step options have now landed:

- Phase 4.34 produced a current-only old runner/handler import inventory.
- Phase 4.35 classified retained progress projection ownership.
- Phase 4.37 extracted retained checkpoint resume preparation behind
  `src/runtime/checkpoint-resume.ts`.
- Phase 4.38 mapped the remaining runner boundary and recommended stopping
  runner shrinkage for now.
- Phase 4.41 extracted only pure terminal verdict derivation, and Phase 5.37
  moved that implementation to `src/shared/terminal-verdict.ts` with
  `src/runtime/terminal-verdict.ts` kept as a compatibility wrapper;
  close/result finalization remains in `src/runtime/runner.ts`.

Current recommendation: keep these tests as live product and oracle evidence.
Any future close/result finalization move still needs focused review first. Do
not start by deleting or migrating tests.
