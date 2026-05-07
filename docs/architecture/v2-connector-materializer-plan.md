# Circuit v2 Connector And Materializer Ownership Plan

Phase 4.18 was the original planning checkpoint. Phase 5.32 moved connector
subprocess modules and relay materialization to neutral ownership after focused
review. This document now records the current boundary: implementations live in
`src/connectors/**`. Final cutover has since retired the old
`src/runtime/connectors/**` compatibility re-exports.

The low-risk helper moves are complete:

- relay data/hash lives in `src/shared/connector-relay.ts`;
- connector parsing/model helpers live in `src/shared/connector-helpers.ts`;
- `src/connectors/shared.ts` is the neutral connector helper barrel;
- old `src/runtime/connectors/**` wrapper paths are retired.

The remaining connector files are production safety boundaries, not cheap
namespace cleanup.

## Current Files

| File | Current consumers | Safety contract | On-disk / trace contract | Evidence | Disposition |
|---|---|---|---|---|---|
| `src/connectors/claude-code.ts` | retained relay selection, core-v2 relay bridge, connector smoke tests, old runner tests | Owns Claude CLI argv, tool-surface restrictions, timeout and process-group kill behavior, stdout/stderr caps, provider/model/effort compatibility, JSON extraction at connector edge | Produces the shared `RelayResult` shape; does not write relay transcript files directly | `tests/runner/agent-connector-smoke.test.ts`, `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/explore-e2e-parity.test.ts`, `tests/contracts/connector-schema.test.ts`, full `npm run verify` | Neutral owner after Phase 5.32 |
| `src/connectors/codex.ts` | core-v2 relay bridge, retained relay selection, Codex connector contract tests, Codex smoke tests | Owns Codex CLI argv, read-only sandbox policy, forbidden argv checks, version capture, JSONL parse discipline, timeout and process-group kill behavior, provider/model/effort compatibility | Produces the shared `RelayResult` shape; does not write relay transcript files directly | `tests/contracts/codex-connector-schema.test.ts`, `tests/runner/codex-connector-smoke.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, full `npm run verify` | Neutral owner after Phase 5.32 |
| `src/connectors/custom.ts` | core-v2 relay bridge, retained relay selection, custom connector tests | Owns configured command invocation, prompt-file transport, temp-dir lifecycle, timeout and process-group kill behavior, output-size caps, JSON extraction at connector edge | Produces the shared `RelayResult` shape; writes temporary prompt/output files only, then removes the temp directory | `tests/runner/custom-connector-runtime.test.ts`, CLI custom connector precedence tests, full `npm run verify` | Neutral owner after Phase 5.32 |
| `src/connectors/relay-materializer.ts` | retained relay handler tests, relay provenance tests, run-relative path tests, live smoke roundtrip tests | Owns translation from validated connector result to trace entries and durable relay slots; cross-checks role/provenance consistency | Writes request, receipt, result, and optional report files; emits the durable relay transcript sequence | `tests/runner/agent-relay-roundtrip.test.ts`, `tests/runner/codex-relay-roundtrip.test.ts`, `tests/runner/runner-relay-provenance.test.ts`, `tests/runner/run-relative-path.test.ts`, `tests/runner/materializer-schema-parse.test.ts` | Neutral owner after Phase 5.32 |

## Source Fingerprint Coverage

Connector smoke fingerprints bind the source files that materially affect live
connector evidence.

Codex relay fingerprint coverage includes:

- `src/connectors/codex.ts`;
- `src/shared/connector-relay.ts`;
- `src/shared/connector-helpers.ts`;
- `src/connectors/shared.ts`;
- `src/connectors/relay-materializer.ts`;
- `src/runtime/runner.ts`;
- `src/flows/registries/report-schemas.ts`.

Claude/agent Explore smoke fingerprint coverage includes:

- `src/connectors/claude-code.ts`;
- `src/shared/connector-relay.ts`;
- `src/shared/connector-helpers.ts`;
- `src/connectors/shared.ts`;
- `src/connectors/relay-materializer.ts`;
- `src/runtime/runner.ts`;
- `src/flows/registries/report-schemas.ts`.

That coverage means changing helper, connector, materializer, runner call-site,
or report-schema behavior invalidates the smoke evidence. Keep these lists in
sync with any future connector or materializer move.

## What Phase 5.32 Changed

Phase 5.32 moved the subprocess connectors and relay materializer to
`src/connectors/**`, changed core-v2 and retained relay call sites to import the
neutral paths, and initially left `src/runtime/connectors/**` as compatibility
re-exports. Final cutover later removed those old wrappers. The move keeps
source fingerprint coverage bound to the real neutral implementation files.

## Why The Move Needed Review

The subprocess modules are capability boundaries. Moving them risks changing:

- argv construction;
- sandbox or permission behavior;
- provider/model/effort compatibility;
- timeout and process cleanup behavior;
- stdout/stderr caps;
- JSON extraction timing;
- custom connector temp-file lifecycle;
- source fingerprint evidence.

The Phase 5.32 review packet approved a behavior-preserving move with those
guardrails.

## Why The Materializer Move Needed Review

`relay-materializer.ts` owns the durable relay transcript and on-disk relay slot
shape. A move can affect:

- request/receipt/result/report file paths;
- run-relative path containment;
- trace entry order and sequence numbers;
- request and result hashes;
- role/provenance cross-validation;
- schema-validated report materialization assumptions.

That is more than namespace cleanup. Phase 5.32 moved it only after preserving
materializer tests, connector roundtrip fingerprints, run-relative path checks,
and temporary compatibility wrappers.

## Recommended Position

Recommendation for this checkpoint:

```text
A. Keep connector subprocess and relay materializer implementations in
   src/connectors.
```

Do not start these adjacent moves in the same slice:

```text
B. Change connector subprocess behavior or permissions.
C. Change relay transcript/materialization shape.
D. Change router/compiler behavior.
E. Recreate old runtime connector wrappers.
```

## Future Move Requirements

Phase 5.33 moved router/compiler implementation ownership to `src/flows/**`.
Before changing connector subprocess behavior or relay materialization shape,
require:

- full import graph for connector and materializer references;
- unchanged connector source fingerprint coverage;
- static connector contract tests;
- custom connector execution tests;
- materializer trace/on-disk tests;
- run-relative path containment tests;
- core-v2 relay tests;
- retained relay handler tests;
- CLI v2 runtime tests;
- `npm run verify`;
- `git diff --check`.

Old runtime connector wrapper deletion is complete under the final cutover
policy.
