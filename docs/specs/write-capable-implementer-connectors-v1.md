# Write-Capable Implementer Connectors V1

Status: superseded implementation record. The Cursor connector parts remain
useful history, but the Codex connector split is superseded by
[`codex-first-class-writable-worker-v1.md`](codex-first-class-writable-worker-v1.md).
Current behavior is defined by source, tests, generated surfaces, config, and
contracts.
Last source pass: 2026-05-20.

## Goal

Circuit should support more than one write-capable implementer connector. The
first product use is Prototype tournament mode, where each variant can be built
by a different implementer:

- Codex 5.5 with xhigh reasoning through a write-capable Codex path.
- Claude Opus 4.7 with max effort through Claude Code.
- Gemini 3.5 Flash through Cursor CLI.

Earlier smallest-safe contract changes kept the existing `codex` connector
read-only and added separate write-capable paths for Codex and Cursor. Current
Codex behavior now uses the public `codex` connector name.

## Confirmed Source Facts

- Built-in connector names are `claude-code`, `codex`, `codex-isolated`,
  and `cursor-agent`. `codex` is a built-in connector, not a custom connector,
  and it remains read-only.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L5).
- Connector filesystem capability is modeled as `read-only`, `trusted-write`,
  or `isolated-write`.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L8).
- The built-in `claude-code` connector is `trusted-write`; `codex` is
  `read-only`; `codex-isolated` is `isolated-write`; and `cursor-agent` is
  `trusted-write`.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L32-L37).
- Custom connectors are currently forced to `read-only`.
  The schema rejects custom connector descriptors that claim any write
  capability.
  Source: [`src/schemas/connector.ts`](../../src/schemas/connector.ts#L52-L71).
- Registry-layer connector references in config are strict built-in or named
  references; inline custom descriptors must be registered under
  `relay.connectors` and referenced by name.
  Source: [`src/schemas/config.ts`](../../src/schemas/config.ts#L13-L28).
- Implementer role resolution rejects read-only connectors before relay
  execution.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L47-L53).
- Connector resolution already has a precedence order: explicit connector,
  role connector, circuit connector, default connector, then auto.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L95-L140).
- Selection compatibility is checked by connector name before a relay is
  spawned. Built-ins map `claude-code` to `anthropic`, `codex` and
  `codex-isolated` to `openai`, and `cursor-agent` to `gemini`.
  Source: [`src/runtime/connectors/resolver.ts`](../../src/runtime/connectors/resolver.ts#L142-L172).
- `ResolvedSelection.effort` allows `none`, `minimal`, `low`, `medium`,
  `high`, `xhigh`, and `max`.
  Source: [`src/schemas/selection-policy.ts`](../../src/schemas/selection-policy.ts#L19).
- Runtime relay steps already have an optional `connector?: string` field.
  Source: [`src/runtime/manifest/executable-flow.ts`](../../src/runtime/manifest/executable-flow.ts#L48-L52).
- The relay executor's built-in connector lookup and dispatch know
  `claude-code`, `codex`, `codex-isolated`, and `cursor-agent`.
  Sources:
  [`src/runtime/executors/relay.ts`](../../src/runtime/executors/relay.ts#L65-L70),
  [`src/runtime/executors/relay.ts`](../../src/runtime/executors/relay.ts#L208-L217).
- Serialized flow relay steps expose an optional connector field.
  Source: [`src/schemas/step.ts`](../../src/schemas/step.ts#L162-L176).
- Fanout relay branches carry per-branch selection and per-branch connector
  routing.
  Source: [`src/schemas/step.ts`](../../src/schemas/step.ts#L244-L290).
- Fanout branch expansion and execution preserve branch connectors through
  dynamic templates and synthetic relay steps.
  Sources:
  [`src/runtime/fanout/branch-expansion.ts`](../../src/runtime/fanout/branch-expansion.ts#L9-L32),
  [`src/runtime/fanout/types.ts`](../../src/runtime/fanout/types.ts#L8-L24),
  [`src/runtime/fanout/branch-execution.ts`](../../src/runtime/fanout/branch-execution.ts#L83-L147).
- Relay fanout branches currently reuse the normal production relay path,
  default fanout concurrency is 4, and only sub-run branches require git
  worktrees. A writable relay tournament therefore needs an explicit isolation
  or serialization decision before it can safely run multiple implementers.
  Sources:
  [`src/runtime/executors/fanout.ts`](../../src/runtime/executors/fanout.ts#L60-L65),
  [`src/runtime/executors/fanout.ts`](../../src/runtime/executors/fanout.ts#L144-L156),
  [`src/runtime/fanout/branch-execution.ts`](../../src/runtime/fanout/branch-execution.ts#L524-L526).
- Prototype variant generation validates each configured variant against its
  own resolved implementer connector.
  Source: [`src/flows/prototype/writers/variant-options.ts`](../../src/flows/prototype/writers/variant-options.ts#L44-L67).
- Prototype variant config has `id`, `label`, optional `connector`, and
  `selection`; `selection.model` and `selection.effort` are required.
  Source: [`src/schemas/config.ts`](../../src/schemas/config.ts#L134-L148).
- Prototype variant options carry provider, model, effort, selection, requested
  connector, resolved connector name, and connector resolution source.
  Sources:
  [`src/flows/prototype/writers/variant-options.ts`](../../src/flows/prototype/writers/variant-options.ts#L92-L129),
  [`src/flows/prototype/reports.ts`](../../src/flows/prototype/reports.ts#L270-L315).
- Prototype tournament fanout maps connector, provider, model, and effort from
  each variant into the relay branch.
  Source: [`src/flows/prototype/schematic.json`](../../src/flows/prototype/schematic.json#L190-L240).
- Prototype provider evidence already reads connector name, resolved selection,
  and resolution source from `relay.started` trace entries.
  Source: [`src/flows/prototype/writers/variant-provider-evidence.ts`](../../src/flows/prototype/writers/variant-provider-evidence.ts#L32-L88).
- The current Codex connector is deliberately no-write. It runs `codex exec`
  with `-s read-only`, pins its argv boundary, and rejects unsafe flags such as
  `--dangerously-bypass-approvals-and-sandbox`, `--full-auto`, `--add-dir`, and
  arbitrary `-c` or `--config`.
  Sources:
  [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L18-L26),
  [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L72-L79),
  [`src/connectors/codex.ts`](../../src/connectors/codex.ts#L127-L138).
- The connector contract now names `codex-isolated` as the separate Codex
  write-capable path while keeping the existing `codex` connector read-only.
  Source: [`docs/contracts/connector.md`](../contracts/connector.md#connector-contract).
- The current config default for Prototype variants routes three tournament
  variants through `codex-isolated`, `claude-code`, and `cursor-agent`.
  Source: [`.circuit/config.yaml`](../../.circuit/config.yaml#L1-L36).

## Implemented Design

### 1. Keep `codex` read-only

Do not change the meaning of the existing `codex` connector. It is pinned by
schema, resolver behavior, and argv contract tests as a read-only connector.
Weakening that name would silently change the safety contract for any existing
flow or config that selected `codex` for analysis work.

Adopt the already documented future connector name:

```ts
"codex-isolated"
```

`codex-isolated` is a sibling connector, not a mode hidden behind `codex`.
It should declare `capabilities.filesystem: "isolated-write"` and provider
compatibility with OpenAI selections. Its implementation can share parsing and
schema-output code with `src/connectors/codex.ts`, but it needs its own argv
contract and tests.

The write-capable Codex path should still be bounded:

- Allow `codex exec --json --ephemeral --skip-git-repo-check`.
- Use a write-capable sandbox mode such as `workspace-write` only inside the
  connector's isolated execution root.
- Continue to reject `--dangerously-bypass-approvals-and-sandbox`,
  `--full-auto`, `--add-dir`, arbitrary `-c`, arbitrary `--config`, and output
  redirection flags.
- Keep reasoning effort as the only allowlisted config key unless a later
  contract explicitly adds more.
- Keep the current `codex` tests intact so the read-only connector cannot
  regress while `codex-isolated` is added.

### 2. Add connector routing at the step and fanout branch level

Connector choice should stay outside `SelectionOverride`. Selection answers
"which model and effort?" Connector routing answers "which implementer runs
this relay?" Keeping those separate avoids overloading model selection with
filesystem authority.

Add optional connector names in two places:

- Serialized relay steps:

  ```ts
  connector?: string
  ```

- Fanout relay branches and dynamic fanout branch templates:

  ```ts
  connector?: string
  ```

The runtime already has a partial path for `RelayStep.connector`; this work
should connect the serialized schema, compiler output, fanout branch expansion,
and synthetic relay branch steps to that existing runtime field.

Config-authored Prototype variant models should use the existing registry-layer
`ConnectorReference` shape from `src/schemas/config.ts`. The variant-options
writer should resolve that reference once and emit the resolved connector name
for fanout branches. This keeps schematic relay steps aligned with the runtime
field that already exists: `connector?: string`.

Resolution order remains the same, with one addition:

1. Branch or step connector.
2. Role connector.
3. Circuit connector.
4. Default connector.
5. Auto connector.

The existing `assertConnectorCanRunRole` check must still run after the final
connector is resolved. A branch-level connector can make a tournament branch
write-capable, but it cannot bypass read-only rejection.

### 3. Make Prototype variant options connector-aware

Prototype tournament mode should treat each variant option as a complete
implementer choice:

```ts
{
  id: "codex-55-xhigh",
  label: "Codex 5.5 xhigh",
  connector: { kind: "builtin", name: "codex-isolated" },
  selection: {
    model: { provider: "openai", model: "gpt-5.5" },
    effort: "xhigh"
  }
}
```

`src/flows/prototype/writers/variant-options.ts` should resolve and validate
each variant against its own connector. It should no longer resolve one
Prototype implementer connector and apply it to the whole matrix.

The emitted `PrototypeVariantOption` should include:

- `connector`: the requested connector reference.
- `connector_name`: the resolved connector name.
- `connector_source`: explicit, role, circuit, default, or auto.
- The existing provider, model, effort, and selection fields.

The tournament fanout template should pass both connector and selection into
each branch. The relay trace already records the connector actually used in
`relay.started`, so the existing provider evidence writer can remain the main
proof surface after its report schema accepts connector-aware variants.

### 4. Add a Cursor CLI path without opening arbitrary write connectors first

Gemini 3.5 Flash via Cursor CLI needs a write-capable implementer path. The
safer first slice is a dedicated connector contract instead of immediately
allowing all custom connectors to claim write capability.

Add one explicit connector identity:

```ts
"cursor-agent"
```

The first implementation should be narrowly scoped:

- `capabilities.filesystem: "trusted-write"`.
- Provider compatibility with `gemini`, and optionally `anthropic` or `openai`
  only when the adapter contract and tests prove the exact model mapping.
- A pinned argv builder for Cursor CLI, with tests equivalent to the Codex
  connector tests.
- No user-controlled shell string interpolation.
- No custom connector write capability until the built-in Cursor path has a
  proven command contract.

This keeps the implementation small enough for Prototype while avoiding a broad
"any local command can write" schema change.

### 5. Handle `max` as a real effort migration

`max` is not in the current `Effort` enum. The Claude Opus 4.7 target needs it,
so this is a schema migration, not just config churn.

Add `max` to the shared `Effort` enum only if the connector support matrix
also changes:

- `claude-code`: supports `low`, `medium`, `high`, `xhigh`, and `max`.
- `codex` and `codex-isolated`: support `low`, `medium`, `high`, and `xhigh`.
- `cursor-agent`: should support `none` for models with no separate effort
  knob. It may support connector-specific effort mapping later, but the Gemini
  3.5 Flash default should not invent a fake effort value.

Compatibility validation must reject unsupported combinations. For example,
`codex-isolated` plus `max` should fail during variant option generation, before
any relay starts.

### 6. Add a write-isolation gate for relay tournaments

Connector routing does not by itself make writable tournaments safe. Current
relay fanout branches can run concurrently, and relay branches do not currently
get git worktrees. If three write-capable implementers run in the same checkout,
the prompt-level "write only under this variant root" instruction is not a
strong enough boundary.

Before enabling write-capable relay branches in Prototype tournament mode, add
one of these guards:

- Preferred: provision a branch-local execution root or git worktree for relay
  fanout branches when the resolved connector can write.
- Minimum safe fallback: force writable relay fanouts to concurrency 1 and
  record a trace/report note that branches were serialized because no isolated
  write root was available.

Do not treat `fanout.branch_started.worktree_path` as proof of write isolation
for relay branches until the executor actually runs the connector in that
branch-local root.

## Surface Mapping

| Surface | Current contract | Proposed change | Focused proof |
| --- | --- | --- | --- |
| Connector schema and resolver | Built-ins are `claude-code` and read-only `codex`; custom connectors are read-only; read-only implementers are rejected. | Add explicit built-ins `codex-isolated` and `cursor-agent`; keep `codex` read-only; preserve role safety checks. | `tests/contracts/connector-schema.test.ts`, `tests/runtime/connectors.test.ts`, and a new Codex isolated argv contract test. |
| Selection and effort | Provider compatibility is connector-name based; effort enum has no `max`. | Add per-connector support for `max` only where supported; allow `cursor-agent` plus Gemini with `effort: none`. | Selection schema tests plus resolver tests for accepted and rejected connector/provider/effort combinations. |
| Per-step routing | Runtime relay steps have `connector?: string`; serialized steps do not. | Add serialized relay-step `connector?: string` and compile it into the existing runtime field. | Existing explicit step connector tests plus one schema/compiler test for relay-step connector projection. |
| Fanout routing | Fanout branches carry selection but no connector; relay branches do not currently get worktrees and default fanout concurrency is 4. | Add branch/template `connector?: string`, preserve it through branch expansion, pass it into synthetic relay steps, and add an isolation or serialization gate for writable relay branches. | New fanout tests for mixed connectors, read-only branch rejection, provider mismatch before callback invocation, and no concurrent shared-checkout execution for writable relay branches. |
| Trace and evidence | `relay.started` records connector and resolved selection; Prototype evidence reads that trace. | Keep `relay.started` as the source of truth and add variant connector fields so reports can compare intended and actual connector. | `tests/contracts/runtrace-schema.test.ts`, `tests/runtime/runtime-trace-contract.test.ts`, and Prototype provider evidence tests with connector-aware variants. |
| Config | Before this slice, Prototype variant config had `id`, `label`, and `selection`, and defaults were Sonnet low/medium/high. | Add optional variant `connector: ConnectorReference`; switch defaults after runtime and schema support land. | Config parse tests and variant-options tests for the three motivating defaults. |
| Prototype tournament | Tournament schematic maps provider, model, and effort into each relay branch. | Map resolved connector name into each branch along with selection. | Flow facts or schematic tests proving the dynamic branch template emits connector and selection. |

## Motivating Config Shape

After the schema and connector contracts landed, the Prototype defaults moved
from the prior Sonnet-only matrix to this shape:

These are the current defaults in `.circuit/config.yaml`.

```yaml
circuits:
  prototype:
    variant_models:
      - id: codex-55-xhigh
        label: Codex 5.5 xhigh
        connector:
          kind: builtin
          name: codex-isolated
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

This config is valid under the current schema and is covered by the config,
variant-options, fanout, and connector compatibility tests named below.

## Implementation Slices

### Slice 1: Connector contract expansion

Files:

- `src/schemas/connector.ts`
- `src/runtime/connectors/resolver.ts`
- `docs/contracts/connector.md`
- `tests/contracts/connector-schema.test.ts`
- `tests/contracts/runtrace-schema.test.ts`
- `tests/runtime/connectors.test.ts`

Changes:

- Add built-in connector names `codex-isolated` and `cursor-agent`.
- Keep `codex` built-in capability as `read-only`.
- Add provider and effort compatibility entries for the new names.
- Update the connector contract because `connector-I1` treats adding a
  built-in as a schema-level change.
- Keep implementer read-only rejection unchanged.

Proof:

- Existing test that rejects `codex` for implementer still passes.
- New test accepts `codex-isolated` for implementer when the selection is OpenAI
  and effort is `xhigh`.
- New test rejects `codex-isolated` with `max`.
- New test accepts `cursor-agent` for implementer with Gemini and `effort:
  none`.
- New test rejects `cursor-agent` if provider compatibility is not declared.
- New trace schema test accepts resolved `relay.started` entries for the new
  built-ins and still rejects unresolved named connector references.

### Slice 2: Step and fanout connector routing

Files:

- `src/schemas/step.ts`
- `src/runtime/manifest/executable-flow.ts`
- `src/runtime/fanout/types.ts`
- `src/runtime/fanout/branch-expansion.ts`
- `src/runtime/fanout/branch-execution.ts`
- `src/runtime/executors/relay.ts`
- `tests/runtime/fanout.test.ts`

Changes:

- Add optional connector names to serialized relay steps.
- Add optional connector names to fanout relay branches and branch
  templates.
- Preserve the connector through branch expansion and synthetic relay steps.
- Continue using the existing relay resolver path so role safety and provider
  compatibility checks run in one place.
- Add a guard so write-capable relay fanout branches either run in branch-local
  execution roots or are serialized with an explicit trace/report reason.

Proof:

- New fanout test where branch A uses `claude-code`, branch B uses
  `codex-isolated`, and both reach the relay callback with the expected connector.
- New fanout test where one branch selects `codex` as implementer and fails
  before callback invocation.
- New fanout test where branch selection is OpenAI but connector is
  `claude-code`, proving provider mismatch is caught before execution.
- New fanout test proving writable relay branches do not run concurrently in a
  shared checkout without an isolation root.
- Existing explicit step connector tests still pass.

### Slice 3: Prototype tournament variant routing

Files:

- `src/schemas/config.ts`
- `src/flows/prototype/reports.ts`
- `src/flows/prototype/writers/variant-options.ts`
- `src/flows/prototype/schematic.json`
- `src/flows/prototype/writers/variant-provider-evidence.ts`
- Prototype-focused tests under `tests/`

Changes:

- Add optional connector reference to `CircuitVariantModel`.
- Resolve each Prototype variant against its own connector.
- Emit connector request, resolved connector name, and connector source in
  `PrototypeVariantOption`.
- Pass connector into each tournament relay branch.
- Keep trace proof based on `relay.started`.

Proof:

- New variant-options test accepts a three-variant matrix using
  `codex-isolated`, `claude-code`, and `cursor-agent`.
- New variant-options test rejects `codex` for a tournament implementer
  variant.
- New variant-options test rejects `codex-isolated` plus `max`.
- New schematic or flow-facts test proves the tournament fanout template emits
  both connector and selection.
- Existing provider evidence test is updated to include connector-aware
  variants without losing model and effort evidence.

### Slice 4: Codex write-capable adapter

Files:

- `src/connectors/codex.ts` or a new `src/connectors/codex-isolated.ts`
- `src/runtime/executors/relay.ts`
- `tests/contracts/codex-connector-schema.test.ts`
- A new `tests/contracts/codex-isolated-connector-schema.test.ts`

Changes:

- Add a separate argv builder and relay function for `codex-isolated`.
- Share only safe parsing helpers with the read-only Codex adapter.
- Keep `CODEX_NO_WRITE_FLAGS` exact tests unchanged.
- Add exact tests for the write argv boundary.

Proof:

- `codex` still builds args with `-s read-only`.
- `codex-isolated` builds args with the chosen write sandbox and no bypass flags.
- `codex-isolated` does not permit arbitrary config keys.
- `codex-isolated` passes OpenAI model and xhigh effort through the allowlisted
  config key.
- Runtime relay dispatch picks `codex-isolated` only when that connector name is
  resolved.

### Slice 5: Cursor adapter

Files:

- New `src/connectors/cursor-agent.ts`
- `src/runtime/executors/relay.ts`
- New connector contract tests

Changes:

- Add a dedicated Cursor CLI adapter with pinned argv construction.
- Map Gemini model selections to Cursor model names.
- Treat `effort: none` as valid for Gemini 3.5 Flash.
- Reject unsupported providers and effort values before spawn.

Proof:

- `cursor-agent` accepts Gemini 3.5 Flash with `effort: none`.
- `cursor-agent` rejects OpenAI or Anthropic selections until explicitly
  supported.
- The argv builder test proves prompt, model, output path, and trust/workspace
  flags are deterministic and not shell-interpolated.
- A skipped or env-gated smoke test can prove the local `cursor-agent` binary
  contract without forcing every CI run to have Cursor installed.

### Slice 6: Effort migration

Files:

- `src/schemas/selection-policy.ts`
- `src/runtime/connectors/resolver.ts`
- `src/connectors/claude-code.ts`
- `docs/contracts/selection.md`
- `docs/contracts/connector.md`
- `tests/contracts/*`
- `tests/runtime/connectors.test.ts`

Changes:

- Add `max` to the shared effort enum.
- Add `max` only to connector support lists that actually support it.
- Update selection and connector contracts so effort vocabulary and support
  lists stay in sync.
- Update any generated docs or release surfaces that enumerate effort values.

Proof:

- Schema accepts `max`.
- `claude-code` accepts `max`.
- `codex`, `codex-isolated`, and `cursor-agent` reject `max` unless explicitly
  supported.
- Existing `xhigh` behavior does not regress.

### Slice 7: Defaults and release surface

Files:

- `.circuit/config.yaml`
- `docs/contracts/*`
- `docs/flows/*`
- Generated host plugin surfaces, if the flow compiler projects the new schema
  into generated artifacts.

Changes:

- Switch Prototype defaults to the three motivating variants only after slices
  1 through 6 are proven.
- Update contracts and flow docs with the connector-aware tournament behavior.
- Regenerate generated surfaces if drift checks require it.

Proof:

- `npm run check-flow-drift`
- Prototype flow facts and catalog completeness tests.
- A local Prototype tournament dry run or smoke run that proves trace evidence
  reports one connector per variant.
- `npm run verify` before shipping implementation.

## Risks and Guardrails

- Risk: `codex` silently becomes write-capable.
  Guardrail: keep `codex` read-only and add `codex-isolated` as a new connector
  name with separate tests.
- Risk: per-variant connector routing bypasses role safety.
  Guardrail: route all branch and step connector choices through the existing
  resolver and `assertConnectorCanRunRole`.
- Risk: `max` becomes accepted for connectors that do not support it.
  Guardrail: update shared schema and per-connector support lists together.
- Risk: Cursor CLI becomes an arbitrary write shell.
  Guardrail: start with a dedicated pinned adapter, not broad write-capable
  custom connectors.
- Risk: Prototype evidence shows only model selection, not the implementer
  connector.
  Guardrail: include connector fields in variant options and keep
  `relay.started` as the source of truth for provider evidence.
- Risk: write-capable relay tournament branches run concurrently in one
  checkout and overwrite each other.
  Guardrail: require branch-local write roots or serialize writable relay
  branches until isolation is implemented.

## Non-Goals

- Do not make custom connectors write-capable in the first slice.
- Do not rename internal relay or connector files.
- Do not change the existing read-only Codex behavior.
- Do not update Prototype defaults before the schema and resolver can validate
  the new matrix.
- Do not run paid model generation as part of this spec work.
