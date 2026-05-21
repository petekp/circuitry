# Codex First-Class Writable Worker V1

Status: implemented V1 record. Current behavior is defined by source, tests,
generated surfaces, config, and contracts.
Last source pass: 2026-05-20.

## Goal

Circuit should treat Codex as both a first-class host and a first-class
write-capable worker. The public worker connector should be `codex`, matching
the way operators already think about `claude-code` and `cursor-agent`.

This spec supersedes the Codex split in
[`write-capable-implementer-connectors-v1.md`](write-capable-implementer-connectors-v1.md).
That earlier spec kept `codex` read-only and added `codex-isolated` as the
Codex write path. The proposed design here migrates that write path onto the
public `codex` connector name and removes `codex-isolated` from the built-in
connector surface.

## Non-Goals

- Do not make arbitrary custom connectors write-capable.
- Do not run paid live model generation. CLI smoke tests remain skipped or
  environment-gated unless an operator explicitly opts in.
- Do not broaden Codex effort support to `max`. Codex remains `low`, `medium`,
  `high`, and `xhigh` until the Codex CLI contract proves otherwise.

## Pre-Implementation Source Facts

This section captures the source contract that existed before this migration
was implemented. Some paths named here are intentionally removed by the
implemented design.

### Host And Connector Identity

- Codex is already a first-class host. `HostKind` accepts `generic-shell`,
  `claude-code`, and `codex`.
  Source: [`src/schemas/host.ts`](../../src/schemas/host.ts#L3).
- The worker connector enum currently accepts `claude-code`, `codex`,
  `codex-isolated`, and `cursor-agent`.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L5).
- Built-in connector capabilities currently model `claude-code` as
  `trusted-write`, `codex` as `read-only`, `codex-isolated` as
  `isolated-write`, and `cursor-agent` as `trusted-write`.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L35).
- Custom connectors are still read-only in V1. A custom descriptor that claims a
  write capability is rejected.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L54).
- Config connector references are strict built-in or named references. Inline
  custom descriptors must be registered under `relay.connectors` first.
  Source: [`src/schemas/config.ts`](../../src/schemas/config.ts#L13).

### Resolver And Selection Compatibility

- Implementer relays reject read-only connectors before execution.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L53).
- Relay connector precedence is explicit connector, role connector, flow
  connector, default connector, then auto.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L112).
- Provider compatibility currently maps `claude-code` to `anthropic`, `codex`
  and `codex-isolated` to `openai`, and `cursor-agent` to `gemini`.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L159).
- Effort compatibility currently maps `claude-code` to `low`, `medium`,
  `high`, `xhigh`, `max`; `codex` and `codex-isolated` to `low`, `medium`,
  `high`, `xhigh`; and `cursor-agent` to `none`.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L25).

### Codex Adapter Boundary

- The current `codex` adapter is intentionally no-write. Its docs and constants
  pin `codex exec -s read-only`.
  Sources: [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L18),
  [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L72).
- The current `codex` adapter rejects sandbox-widening or CLI-side write paths,
  including bypass flags, `--full-auto`, `--add-dir`, output redirection, profile
  loading, arbitrary config, and sandbox overrides.
  Source: [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L127).
- The current `codex` adapter accepts only OpenAI models and `low`, `medium`,
  `high`, `xhigh` efforts before spawn.
  Source: [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L241).
- The current `codex-isolated` adapter already carries the intended Codex
  writable argv shape: `codex exec --json -s workspace-write --ephemeral
  --skip-git-repo-check --ignore-user-config --ignore-rules`.
  Source: [`src/connectors/codex-isolated.ts`](../../src/connectors/codex-isolated.ts#L21).
- `codex-isolated` already threads a runtime `cwd` through both `--cd` and the
  subprocess `cwd` option.
  Sources: [`src/connectors/codex-isolated.ts`](../../src/connectors/codex-isolated.ts#L153),
  [`src/connectors/codex-isolated.ts`](../../src/connectors/codex-isolated.ts#L201).
- `codex-isolated` rejects non-OpenAI providers and unsupported efforts before
  spawn.
  Source: [`src/connectors/codex-isolated.ts`](../../src/connectors/codex-isolated.ts#L75).

### Relay Dispatch, Fanout, And Trace

- Relay dispatch currently imports and dispatches both `relayCodex` and
  `relayCodexIsolated`.
  Sources: [`src/runtime/executors/relay.ts`](../../src/runtime/executors/relay.ts#L1),
  [`src/runtime/executors/relay.ts`](../../src/runtime/executors/relay.ts#L198).
- Relay execution already threads `cwd`, resolved selection, and response schema
  into built-in connectors.
  Source: [`src/runtime/executors/relay.ts`](../../src/runtime/executors/relay.ts#L198).
- Fanout relay branches carry optional `connector` and `selection`.
  Source: [`src/runtime/fanout/types.ts`](../../src/runtime/fanout/types.ts#L21).
- Dynamic fanout branch expansion preserves branch connector and selection.
  Source: [`src/runtime/fanout/branch-expansion.ts`](../../src/runtime/fanout/branch-expansion.ts#L22).
- Relay fanout branch execution creates synthetic relay steps that preserve
  branch connector and selection.
  Source: [`src/runtime/fanout/branch-execution.ts`](../../src/runtime/fanout/branch-execution.ts#L83).
- Fanout already serializes relay branches when the resolved connector
  capability is not `read-only`.
  Source: [`src/runtime/executors/fanout.ts`](../../src/runtime/executors/fanout.ts#L75).
- `relay.started` and `relay.failed` trace entries store the resolved connector,
  resolved selection, role, and resolution source.
  Sources: [`src/schemas/trace-entry.ts`](../../src/schemas/trace-entry.ts#L111),
  [`src/schemas/trace-entry.ts`](../../src/schemas/trace-entry.ts#L175).

### Prototype Tournament Surface

- The project config currently routes the Codex tournament variant through
  `codex-isolated`.
  Source: [`.circuit/config.yaml`](../../.circuit/config.yaml#L13).
- Prototype `variant_models` entries have `id`, `label`, optional `connector`,
  and required model/effort selection.
  Source: [`src/schemas/config.ts`](../../src/schemas/config.ts#L125).
- The Prototype variant-options writer resolves and validates each variant
  against its own implementer connector.
  Source: [`src/flows/prototype/writers/variant-options.ts`](../../src/flows/prototype/writers/variant-options.ts#L45).
- The generated Prototype tournament fanout template passes each variant's
  `connector_name`, provider, model, and effort into the relay branch.
  Source: [`generated/flows/prototype/tournament.json`](../../generated/flows/prototype/tournament.json#L171).
- Prototype provider evidence reads the actual connector name and resolved
  selection from `relay.started`.
  Source: [`src/flows/prototype/writers/variant-provider-evidence.ts`](../../src/flows/prototype/writers/variant-provider-evidence.ts#L32).

### Existing Tests Pin The Old Split

- Connector schema tests currently accept `codex-isolated` as a built-in and
  pin the four-name built-in tuple.
  Source: [`tests/contracts/connector-schema.test.ts`](../../tests/contracts/connector-schema.test.ts#L103).
- Runtime connector tests currently reject `codex` for implementer roles and
  accept `codex-isolated`.
  Source: [`tests/runtime/connectors.test.ts`](../../tests/runtime/connectors.test.ts#L52).
- Codex connector tests currently pin `CODEX_NO_WRITE_FLAGS` to `-s read-only`.
  Source: [`tests/contracts/codex-connector-schema.test.ts`](../../tests/contracts/codex-connector-schema.test.ts#L45).

## Implemented Design

### 1. Make `codex` The Writable Worker Name

Change the public built-in connector tuple to:

```ts
['claude-code', 'codex', 'cursor-agent']
```

Set `BUILTIN_CONNECTOR_CAPABILITIES.codex.filesystem` to `trusted-write`.
This deliberately models Codex like Claude Code and Cursor Agent from Circuit's
runtime perspective: it is a built-in worker allowed to edit the operator
checkout. Codex may still use the Codex CLI's `workspace-write` sandbox flag
internally, but Circuit should not call it `isolated-write` unless the runtime
provisions a branch-local write root. Today writable relay fanout branches share
the parent checkout and are serialized, so `trusted-write` is the honest
capability label.

Keep `FilesystemCapability` values unchanged unless a later cleanup proves
`isolated-write` is unused everywhere. Removing that enum value is not required
to make Codex first-class, and leaving it avoids mixing a semantic migration
with a type cleanup.

### 2. Remove `codex-isolated` From The Public Built-In Surface

`codex-isolated` should be removed, not aliased.

Reason: an alias would make traces and config misleading. A tournament branch
that says `codex-isolated` would still really run the first-class Codex worker,
and audit readers would have to remember an invisible synonym. Circuit should
emit one name for one worker.

Migration policy:

- Remove `codex-isolated` from `EnabledConnector`.
- Remove it from `RESERVED_ADAPTER_NAMES` by derivation.
- Remove `relayCodexIsolated` dispatch and imports.
- Delete `src/connectors/codex-isolated.ts` after its argv behavior is folded
  into `src/connectors/codex.ts`.
- Update repo config, docs, generated surfaces, and tests to use `codex`.
- Make stale `codex-isolated` config fail schema validation with the same
  unknown built-in behavior as any removed connector. If a compatibility story
  is needed later, it should be an explicit config migration command, not a
  silent resolver alias.

### 3. Fold The Writable Argv Boundary Into `src/connectors/codex.ts`

Replace the no-write Codex argv contract with a write-capable contract owned by
the public `codex` adapter.

Implemented base argv:

```ts
export const CODEX_WRITE_FLAGS = Object.freeze([
  'exec',
  '--json',
  '-s',
  'workspace-write',
  '--ephemeral',
  '--skip-git-repo-check',
  '--ignore-user-config',
  '--ignore-rules',
] as const);
```

`buildCodexArgs` should produce:

```text
codex exec --json -s workspace-write --ephemeral --skip-git-repo-check
  --ignore-user-config --ignore-rules
  [--cd <cwd>]
  [-m <openai-model>]
  [-c model_reasoning_effort="<low|medium|high|xhigh>"]
  [--output-schema <schema-path>]
  <prompt>
```

Required guardrails:

- Exactly one `-s workspace-write` pair.
- `--ignore-user-config` and `--ignore-rules` present in the base flags.
- No `--dangerously-bypass-approvals-and-sandbox`.
- No `--full-auto`.
- No `--add-dir`.
- No `-o` or `--output-last-message`.
- No `--config`, profile loading, or sandbox override.
- At most one `-c`, and only for `model_reasoning_effort` with Codex-supported
  efforts.
- OpenAI provider only.
- `max`, `minimal`, and `none` rejected before spawn.
- `cwd` threaded through both `--cd` and subprocess options.
- Existing JSON stdout parsing and structured-output temp-file cleanup retained.

The old `CODEX_NO_WRITE_FLAGS` name should be removed or replaced with a clear
compatibility-free name. Tests that import it should move to `CODEX_WRITE_FLAGS`.

First-class does not mean unbounded user config. In this design, first-class
means `codex` is the public connector identity, can run implementer roles, can
be selected per step or per tournament variant, and is traced like the other
built-in workers. The connector still owns its spawn boundary. That mirrors the
existing posture for other built-in workers: Circuit may suppress or replace
host-specific user settings when those settings would make a relay invocation
less auditable or less reproducible.

### 4. Keep Provider And Effort Compatibility Strict

The connector resolver should keep rejecting incompatible model/provider/effort
combinations before subprocess spawn:

| Connector | Provider | Effort |
| --- | --- | --- |
| `claude-code` | `anthropic` | `low`, `medium`, `high`, `xhigh`, `max` |
| `codex` | `openai` | `low`, `medium`, `high`, `xhigh` |
| `cursor-agent` | `gemini` | `none` |

Remove all resolver branches for `codex-isolated`.

### 5. Preserve Custom Connector Safety

Do not make custom connectors write-capable in this refactor. The schema-level
rejection in `CustomConnectorDescriptor` stays intact. Runtime tests should keep
a read-only custom connector as the negative implementer case, because `codex`
will no longer be the read-only negative example.

### 6. Keep Fanout Serialization As The Safety Valve

When `codex` becomes `trusted-write`, Prototype tournament branches routed to
Codex should automatically trigger writable relay serialization through the
existing `connectorCapabilities(...).filesystem !== 'read-only'` check.

No branch-local worktree behavior is required in this refactor. If Circuit later
wants true parallel writable relay branches, that should be a separate design:
branch-local write roots, merge policy, and conflict handling.

### 7. Update Prototype Tournament Defaults

The project default matrix should become:

```yaml
circuits:
  prototype:
    variant_models:
      - id: codex-55-xhigh
        label: Codex 5.5 xhigh
        connector:
          kind: builtin
          name: codex
        selection:
          model:
            provider: openai
            model: gpt-5.5
          effort: xhigh
      - id: opus-47-max
        label: Claude Opus 4.7 max
        connector:
          kind: builtin
          name: claude-code
        selection:
          model:
            provider: anthropic
            model: claude-opus-4-7
          effort: max
      - id: gemini-35-flash-cursor
        label: Gemini 3.5 Flash via Cursor
        connector:
          kind: builtin
          name: cursor-agent
        selection:
          model:
            provider: gemini
            model: gemini-3.5-flash
          effort: none
```

The Prototype writer and fanout schematic already have the right routing shape:
each variant resolves to a connector name, and the fanout template passes that
connector name into the branch. The required change is the connector identity
and tests, not a new routing mechanism.

## Implementation Slices And Proof

| Slice | Implemented changes | Focused proof |
| --- | --- | --- |
| Connector schema | Remove `codex-isolated` from `EnabledConnector`; set `codex` to `trusted-write`; keep custom connectors read-only. | `tests/contracts/connector-schema.test.ts`; `tests/contracts/config-schema.test.ts`. |
| Resolver compatibility | Remove `CODEX_ISOLATED_SUPPORTED_EFFORTS`; map only `codex` to OpenAI and Codex efforts; keep provider/effort rejection. | `tests/runtime/connectors.test.ts`; `tests/runner/prototype-variant-options-writer.test.ts`. |
| Codex argv boundary | Replace no-write constants with writable `codex` constants; fold `--cd`, workspace-write, ignore-user-config, ignore-rules, model, effort, schema, and forbidden-token checks into `src/connectors/codex.ts`; delete the separate isolated adapter. | `tests/contracts/codex-connector-schema.test.ts`; remove or replace `tests/contracts/codex-isolated-connector-schema.test.ts`; update `tests/runner/connector-shared.test.ts`. |
| Relay dispatch | Remove `relayCodexIsolated` import and dispatch; keep `relayCodex` dispatch for the public `codex` worker. | `tests/runtime/connectors.test.ts`; `npm run check`. |
| Runtrace/config contracts | Update contract docs and tests so `relay.started` accepts first-class `codex` as a write-capable implementer connector and rejects stale `codex-isolated`; keep `HostKind` accepting `codex`. | `tests/contracts/runtrace-schema.test.ts`; `tests/contracts/connector-schema.test.ts`; `tests/contracts/config-schema.test.ts`. |
| Fanout serialization | Assert that a Codex relay branch is writable and serializes fanout; keep read-only custom connector rejection as the negative case. | `tests/runtime/fanout.test.ts`. |
| Prototype defaults | Change `.circuit/config.yaml` Codex variant connector from `codex-isolated` to `codex`; keep Claude and Cursor entries. | `tests/runner/prototype-variant-options-writer.test.ts`; `tests/runner/prototype-variant-provider-evidence-writer.test.ts`; `tests/contracts/config-schema.test.ts`. |
| Generated host surfaces | Regenerate flow and plugin surfaces after source/config/doc changes. At minimum this covers `generated/flows/prototype/tournament.json`, `plugins/claude/skills/prototype/tournament.json`, `plugins/codex/flows/prototype/tournament.json`, and both plugin runtime bundles. No generated host surface should mention `codex-isolated`. | `npm run emit-flows`; `npm run emit-release`; `npm run check-flow-drift`; `npm run check-release-infra`; `rg -n "codex-isolated" generated plugins docs/release`. |
| Public docs | Update connector, config, selection, host capability, first-run, release claim, and README prose to call `codex` the first-class writable worker. Remove the read-only Codex guarantee. | `npm run check-release-infra`; `rg -n "read-only Codex|codex-isolated" README.md docs generated plugins src tests`. |

Focused test command during implementation:

```bash
npx vitest run \
  tests/contracts/connector-schema.test.ts \
  tests/contracts/config-schema.test.ts \
  tests/contracts/runtrace-schema.test.ts \
  tests/contracts/codex-connector-schema.test.ts \
  tests/runtime/connectors.test.ts \
  tests/runtime/fanout.test.ts \
  tests/runner/prototype-variant-options-writer.test.ts \
  tests/runner/prototype-variant-provider-evidence-writer.test.ts \
  tests/runner/flow-facts.test.ts
```

Final verification:

```bash
npm run check-flow-drift
npm run verify
```

## Expected Test Rewrites

- `tests/contracts/connector-schema.test.ts`
  - Pin `EnabledConnector.options` to `['claude-code', 'codex',
    'cursor-agent']`.
  - Assert `codex-isolated` is no longer accepted as an enabled connector,
    connector reference, or relay default.
  - Keep `HostKind.safeParse('codex')` passing.
  - Keep custom connector write capability rejection.
- `tests/contracts/codex-connector-schema.test.ts`
  - Rename no-write expectations to write-capable expectations.
  - Assert `-s workspace-write`, `--ignore-user-config`, `--ignore-rules`,
    `--cd <cwd>`, OpenAI model passthrough, `xhigh` effort passthrough, and
    `max` rejection.
  - Keep forbidden-token coverage for bypass, sandbox override, profile,
    add-dir, output-file, and arbitrary config.
- `tests/contracts/codex-isolated-connector-schema.test.ts`
  - Delete this test if `src/connectors/codex-isolated.ts` is deleted.
- `tests/runtime/connectors.test.ts`
  - Change Codex implementer tests from read-only rejection to acceptance.
  - Use a read-only custom connector to prove implementer rejection still exists.
  - Remove `codex-isolated` compatibility checks.
- `tests/runtime/fanout.test.ts`
  - Replace `codex-isolated` branches with `codex`.
  - Assert Codex still causes writable relay fanout serialization.
  - Keep read-only custom connector rejection.
- `tests/runner/prototype-variant-options-writer.test.ts`
  - Accept the three-variant matrix with `codex`, `claude-code`, and
    `cursor-agent`.
  - Replace "rejects read-only codex" with "rejects Codex max effort" or a
    custom read-only negative case.
- `tests/runner/prototype-variant-provider-evidence-writer.test.ts`
  - Expect provider evidence connector order `codex`, `claude-code`,
    `cursor-agent`.
- `tests/contracts/runtrace-schema.test.ts`
  - Accept first-class `codex` and `cursor-agent` for write-capable relay
    traces.
  - Reject stale `codex-isolated`.

## Review Checklist

Before implementation is complete, review for these failure modes:

- `codex-isolated` still accepted by schema, resolver, relay dispatch, config,
  generated surfaces, or public docs.
- `codex` marked write-capable in schema but still launches with
  `-s read-only`.
- `codex` launches with writable flags but does not pin
  `--ignore-user-config` and `--ignore-rules`.
- Arbitrary `-c` or `--config` can widen sandbox or approval settings.
- Codex `max` effort reaches spawn instead of failing in resolver or adapter.
- Custom connectors become write-capable as a side effect.
- Prototype config uses `codex`, but generated flow/plugin surfaces still carry
  `codex-isolated`.
- Fanout no longer serializes writable relay branches after Codex becomes
  `trusted-write`.
- Trace entries become ambiguous because stale `codex-isolated` aliases to
  `codex`.
