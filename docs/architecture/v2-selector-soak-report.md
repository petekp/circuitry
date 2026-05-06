# Circuit v2 Selector Soak Report

Last updated: 2026-05-05.

## Scope

This report tracks the automated selector soak gate added in Phase 5.0.

The gate proves the current ownership boundary:

```text
core-v2 owns matrix-supported fresh runs.
retained runtime owns retained/v1 checkpoint resume, unsupported external
fixtures/roots, programmatic composeWriter fallback, rollback, and old oracle
coverage.
```

Phase 5.3 adds Build deep to the default core-v2 selector matrix. It is the
first default-routed checkpoint mode. Phase 5.11 adds Explore tournament after
fanout relay parity hardening and production checkpoint wait/resume proof. Old
retained/v1 checkpoint folders remain retained-runtime-owned.

Phase 5.4 documents retained checkpoint-folder and fallback policy. It also
tightens run-backed handoff continuity so the neutral run-status fallback is
used only for core-v2-marked folders.

## Commands

Primary gates:

```bash
npm run soak:v2:fast
npm run soak:v2
```

Supporting focused command:

```bash
npx vitest run tests/soak
```

## Supported Matrix Rows

`tests/soak/v2-runtime-surface.test.ts` covers every default-routed
matrix-supported fresh run without v2 environment variables:

| Row | Proof |
|---|---|
| Review default | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Fix default | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Fix lite | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Fix deep | core-v2 trace marker, result parse on the normal path, manifest/result hash agreement, `runs show --json`, forced no-repro checkpoint wait/resume proof in CLI tests |
| Fix autonomous | core-v2 trace marker, safe-autonomous no-repro checkpoint auto-resolution, no checkpoint/user-input progress, result parse, Fix result parse, `runs show --json` completed status |
| Build default | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Build lite | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Build deep | core-v2 trace marker, checkpoint wait, `runs show --json` waiting status, checkpoint/user-input progress, resume by saved engine marker, result parse, Build result parse |
| Build autonomous | core-v2 trace marker, safe-autonomous checkpoint auto-resolution, no checkpoint/user-input progress, result parse, Build result parse, `runs show --json` completed status |
| Explore default | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Explore lite | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Explore deep | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Explore autonomous | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Explore tournament | core-v2 trace marker, production relay fanout branch artifacts, aggregate parse, checkpoint wait, dynamic option labels in progress/status, resume by saved engine marker, decision/result parse |
| Migrate default | core-v2 trace marker, result parse, manifest/result hash agreement, parent and child run consistency |
| Migrate deep | core-v2 trace marker, checkpoint wait, `runs show --json` waiting status, checkpoint/user-input progress, resume by saved engine marker, result parse, Migrate result parse, Build child-run consistency |
| Migrate autonomous | core-v2 trace marker, safe-autonomous coexistence checkpoint auto-resolution, no checkpoint/user-input progress, result parse, Migrate result parse, Build child-run consistency, `runs show --json` completed status |
| Sweep default | core-v2 trace marker, result parse, manifest/result hash agreement, `runs show --json`, operator summary files |
| Sweep lite | core-v2 trace marker, safe-default triage checkpoint auto-resolution, no checkpoint/user-input progress, result parse, Sweep result parse, `runs show --json` completed status |
| Sweep deep | core-v2 trace marker, checkpoint wait, `runs show --json` waiting status, checkpoint/user-input progress, resume by saved engine marker, result parse, Sweep result parse |
| Sweep autonomous | core-v2 trace marker, safe-autonomous triage checkpoint auto-resolution, no checkpoint/user-input progress, result parse, Sweep result parse, `runs show --json` completed status |

## Retained Fallback Rows

The soak suite checks retained execution for:

| Row | Proof |
|---|---|
| Arbitrary explicit fixture | retained v1 trace marker |
| Programmatic `composeWriter` | retained v1 trace marker and aborted retained result |
| Rollback for Review default | retained diagnostic output and retained v1 trace marker |
| Rollback for Fix default | retained diagnostic output and retained v1 trace marker |
| Rollback for Fix lite | retained diagnostic output and retained v1 trace marker |
| Rollback for Fix deep | retained diagnostic output and retained v1 trace marker |
| Rollback for Fix autonomous | retained diagnostic output and retained v1 trace marker |
| Rollback for Build default | retained diagnostic output and retained v1 trace marker |
| Rollback for Build deep | retained diagnostic output and retained v1 trace marker |
| Rollback for Build autonomous | retained diagnostic output and retained v1 trace marker |
| Rollback for Explore default | retained diagnostic output and retained v1 trace marker |
| Rollback for Explore lite | retained diagnostic output and retained v1 trace marker |
| Rollback for Explore deep | retained diagnostic output and retained v1 trace marker |
| Rollback for Explore autonomous | retained diagnostic output and retained v1 trace marker |
| Rollback for Explore tournament | retained diagnostic output and retained v1 trace marker |
| Rollback for Migrate default | retained diagnostic output and retained v1 trace marker |
| Rollback for Migrate deep | retained diagnostic output and retained v1 trace marker |
| Rollback for Migrate autonomous | retained diagnostic output and retained v1 trace marker |
| Rollback for Sweep default | retained diagnostic output and retained v1 trace marker |
| Rollback for Sweep lite | retained diagnostic output and retained v1 trace marker |
| Rollback for Sweep deep | retained diagnostic output and retained v1 trace marker |
| Rollback for Sweep autonomous | retained diagnostic output and retained v1 trace marker |

Build has no current public tournament entry mode in `src/flows/build/schematic.json`
or `generated/flows/build/circuit.json`. If one is added later, it needs its
own selector proof before v2 routing.

## Strict Opt-In

The soak suite checks:

- strict v2 opt-in routes a supported Review default run through core-v2 even
  when rollback is also set;
- strict v2 opt-in rejects unsupported flows before creating a run folder;
- strict v2 opt-in can route Build deep through the v2 checkpoint path.

## Runs Show

The soak suite calls `runs show --json` for every core-v2 run in the default
matrix and checks:

- completed status;
- result path;
- flow id;
- terminal outcome.

Existing `tests/runner/run-status-projection.test.ts` remains the deeper
malformed trace, v1, v2, retry, aborted, and checkpoint-waiting projection
coverage.

`tests/runner/utility-cli.test.ts` proves run-backed handoff continuity can bind
to both core-v2 waiting runs and retained waiting runs.

## Progress JSONL

The soak suite parses every emitted progress line through `ProgressEvent` and
checks targeted lifecycle events for:

- Review relay progress;
- Build deep checkpoint waiting and resumed completion progress;
- Build unsafe-connector abort progress;
- Migrate parent/child progress;
- fanout branch lifecycle progress.

## Connector Safety

The soak suite checks:

- unsafe Codex implementer configuration rejects before relayer invocation;
- a real custom connector bridge executes without an injected relayer;
- project custom connector config overrides user-global config.

Existing connector and relay tests remain the deeper provider/model,
materializer, identity, and schema-tagged report safety coverage.

## Child Runs And Fanout

The soak suite checks:

- Migrate default and autonomous create a Build child run;
- parent and child result/manifest/status consistency;
- child run folders do not need top-level operator summaries;
- fanout emits branch lifecycle progress;
- fanout aggregate and branch proposal reports parse.

## Known Gaps

The soak gate does not make retained/v1 checkpoint folders v2-owned. It proves
that new default Build deep folders use core-v2, while old retained/v1
checkpoint folders still stay retained.

The soak gate does not approve old runtime deletion.

## Latest Results

Current parity batch validation after adding Explore lite/deep/autonomous:

- `npx vitest run tests/parity/explore-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Current parity batch validation after adding Migrate autonomous:

- `npx vitest run tests/parity/migrate-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Current parity batch validation after adding Sweep lite:

- `npx vitest run tests/parity/sweep-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Current parity batch validation after adding Sweep deep:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Current parity batch validation after adding Fix deep:

- `npx vitest run tests/parity/fix-v2.test.ts tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Current parity batch validation after adding Migrate deep:

- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/soak/v2-runtime-surface.test.ts`:
  passed.
- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run verify`: passed.
- `git diff --check`: passed.

Phase 5.3 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/runner/cli-v2-runtime.test.ts tests/core-v2/checkpoint-resume-v2.test.ts`:
  passed.
- `npx vitest run tests/runner/build-checkpoint-exec.test.ts`: passed.
- `npx vitest run tests/core-v2 tests/parity`: passed.
- `npx vitest run tests/runner/run-status-projection.test.ts tests/contracts/progress-event-schema.test.ts`:
  passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `git diff --check`: passed before this report refresh.

`npm run soak:v2` ran the focused soak suite, full `npm run verify`, and
`npm run check-flow-drift` successfully.

Phase 5.0 validation:

- `npm run check`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/soak`: passed.
- `npm run soak:v2:fast`: passed.
- `npm run soak:v2`: passed.
- `npm run test:fast`: passed.
- `npm run check-flow-drift`: passed on sequential rerun after `test:fast`.
- `npm run verify`: passed after report updates.
- `git diff --check`: passed.

`npm run soak:v2` ran the focused soak suite, full `npm run verify`, and
`npm run check-flow-drift` successfully.

Note: a parallel `npm run check-flow-drift` run overlapped with
`tests/unit/emit-flows-drift.test.ts` and briefly saw that test's temporary
stale sibling fixture. The generated files were clean after `test:fast`
finished, and the sequential drift rerun passed.
