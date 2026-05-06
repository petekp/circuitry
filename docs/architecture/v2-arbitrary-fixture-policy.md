# Core-v2 Arbitrary Fixture Policy

Date: 2026-05-05

## Decision

Arbitrary explicit fixtures remain retained-runtime-owned by default.

```text
generated/flows fixtures -> follow the v2 selector matrix
explicit fixtures under generated/flows -> follow the v2 selector matrix
wrapper-provenanced installed plugin mirror -> follow the v2 selector matrix
explicit fixtures outside generated/flows -> retained runtime by default
explicit flow roots outside generated/flows -> retained runtime by default
strict CIRCUIT_V2_RUNTIME=1 -> v2 experiment lane when the flow and mode pass support checks
```

This is a product compatibility decision, not a deletion step.

## Definitions

| Name | Meaning | Current default |
| --- | --- | --- |
| Generated fixture | A compiled flow resolved from `generated/flows/**` without an explicit external root. | Selector matrix decides. |
| Explicit generated fixture | `--fixture` or `--flow-root` that resolves to `generated/flows/**`. | Selector matrix decides. |
| Arbitrary explicit fixture | `--fixture` that resolves outside `generated/flows/**`. | Retained runtime. |
| Arbitrary explicit flow root | `--flow-root` that resolves outside `generated/flows/**` without official wrapper provenance. | Retained runtime. |
| Custom flow root | Flow roots emitted by `circuit-next create`, currently under the configured custom home. | Retained runtime. |
| Installed plugin generated mirror | Generated mirrors under the installed Codex plugin, such as `plugins/circuit/flows/**`, when the wrapper injects the matching provenance marker. | Selector matrix decides. |

The current trust boundary is path-plus-provenance. `generated/flows/**` is
trusted by local path. Installed plugin mirrors are trusted only when the
official wrapper injects `CIRCUIT_GENERATED_FLOW_MIRROR_ROOT` and that marker
matches the actual `--flow-root`.

## Why Retain Arbitrary Fixtures

Arbitrary fixtures are useful for local experimentation, custom flows, copied
manifests, older manifests, malformed manifests, and migration proofs. They may
not match the shapes that core-v2 has proven through the selector matrix.

Keeping them retained by default avoids widening the core-v2 support contract by
accident. It also avoids failing local experiments that the retained runtime can
still execute.

## Current Inventory

Inventory command:

```bash
rg -n "--fixture|fixturePath|flowRoot|--flow-root|resolveFixturePath|loadFixture" \
  src tests scripts docs specs README.md commands plugins .claude-plugin generated package.json
```

Current live consumers:

| Consumer | Classification | Disposition |
| --- | --- | --- |
| `src/cli/circuit.ts` | public CLI selector and fixture loader | Owns `--fixture`, `--flow-root`, fixture loading, child-flow resolution, generated-root/trusted-mirror eligibility, strict v2 experiment behavior, and retained fallback. Keep. |
| `src/cli/create.ts` | public custom-flow producer | Emits custom flow roots and command text that call `circuit-next run <slug> --flow-root <custom-home>/flows`. Keep retained by default unless custom flows get their own v2 support contract. |
| `plugins/circuit/scripts/circuit-next.mjs` | installed host wrapper | Injects `--flow-root <plugin root>/flows` and `CIRCUIT_GENERATED_FLOW_MIRROR_ROOT=<plugin root>/flows` when no explicit fixture/root is supplied. It clears the marker when callers supply their own root or resume. Keep. |
| `tests/runner/cli-v2-runtime.test.ts` | selector coverage | Proves strict v2 fixture experiments, arbitrary fixtures retained by diagnostics/default policy, generated explicit fixtures can route through v2, wrapper-provenanced plugin mirrors can route through v2, custom roots stay retained, rollback precedence, and diagnostics output. Keep. |
| `tests/soak/v2-runtime-surface.test.ts` | soak coverage | Proves arbitrary fixtures remain retained in the v2 soak. Keep. |
| `tests/runner/cli-router.test.ts` | public CLI argument coverage | Uses explicit fixtures for router behavior and resume argument validation. Keep as CLI compatibility coverage. |
| `tests/contracts/codex-host-plugin.test.ts` | host wrapper and mirror coverage | Proves the wrapper injects the packaged flow root with the marker, clears it for caller-supplied roots and resume, and byte-compares every packaged flow JSON mirror to `generated/flows/**`. Keep. |
| Direct `tests/runner/*` `loadFixture()` helpers | retained oracle/test support | Load generated fixtures directly into retained runner/handler tests. These are not public arbitrary fixture consumers. Keep while old runner/handler tests remain retained oracle coverage. |
| `scripts/emit-flows.mjs` | generator | Emits canonical `generated/flows/**` and host mirrors. It does not define v2 runtime eligibility. Keep. |
| `scripts/release/capture-golden-run-proofs.mjs` | release proof | Uses generated flow roots and retained `composeWriter` proof behavior. No arbitrary fixture behavior change in this slice. |
| Docs and old checkpoint files | documentation/history | Keep as historical context; update live policy docs when behavior changes. |

## Current Behavior

| Invocation | Runtime policy |
| --- | --- |
| `circuit-next run review --goal ...` | Loads `generated/flows/review/circuit.json`; matrix-supported rows default to core-v2. |
| `circuit-next run review --fixture generated/flows/review/circuit.json` | Explicit fixture is still under `generated/flows`; matrix-supported rows may route to core-v2. |
| Official wrapper run that injects `--flow-root <plugin root>/flows` and matching marker | Installed generated mirror follows the selector matrix. |
| `circuit-next run review --flow-root plugins/circuit/flows` without the wrapper marker | Retained runtime by default. |
| `circuit-next run review --fixture /tmp/review-copy.json` | Retained runtime by default, even if the file is a byte-for-byte copy of a generated fixture. |
| `circuit-next run review --flow-root /tmp/flows` | Retained runtime by default. |
| `CIRCUIT_V2_RUNTIME=1` plus compatible explicit fixture | Strict experiment lane; routes through core-v2 only when support checks pass. |
| `CIRCUIT_DISABLE_V2_RUNTIME=1` plus any fixture | Retained runtime. |
| checkpoint resume plus `--fixture` or `--flow-root` | Fails closed; resume loads the saved run manifest. |

## Product Status

Arbitrary explicit fixtures are a supported compatibility surface today. They
should not be advertised as core-v2-supported.

External callers should expect:

```text
Use generated/flows for default-routed product flows.
Installed plugin wrapper runs use trusted generated mirrors for default routing.
Use --fixture or --flow-root for explicit retained compatibility.
Use CIRCUIT_V2_RUNTIME=1 only for deliberate v2 fixture experiments.
```

Custom flows created by `circuit-next create` are also explicit flow-root
invocations today. They remain retained by default until custom-flow v2 support
is designed and proven.

Phase 5.18 makes that policy visible in generated create summaries. The summary
now tells operators that custom flow roots run on retained compatibility by
default and that `CIRCUIT_V2_RUNTIME=1` is only for explicit v2 experiments.

Phase 5.22 moves the live external fixture/custom-root reason and custom-flow
summary copy into `src/cli/runtime-compatibility-policy.ts`, so selector output
and create summaries share one source.

Installed plugin flow roots are generated mirrors. They follow the selector
matrix only when the official wrapper proves provenance with
`CIRCUIT_GENERATED_FLOW_MIRROR_ROOT`.

## Deletion Implications

Old runtime deletion remains blocked while arbitrary explicit fixtures and
custom flow roots are retained compatibility surfaces.

Before deletion can be reconsidered, arbitrary fixtures must be one of:

```text
migrated to a v2 support contract
kept behind a smaller retained compatibility module
deprecated with a migration path
retired with an explicit fail-closed product decision
```

No deletion slice should infer that passing v2 generated-flow tests means
arbitrary manifests are safe to run through core-v2 by default.

## Future Options

### Option A - Keep Retained Compatibility

Keep the current behavior indefinitely:

```text
generated/flows follows the matrix
external --fixture/--flow-root remains retained
strict v2 remains the experiment lane
```

This is the safest current posture.

### Option B - Add Trusted Generated Mirrors

Allow selected generated mirror roots, such as installed plugin flow mirrors, to
follow the selector matrix.

Phase 5.10 implements this only for official wrapper-provenanced installed
plugin mirrors. The proof covers:

```text
plugin wrapper flow root
host mirror drift safety
runtime diagnostics
rollback
strict v2
custom flow roots staying retained unless explicitly approved
```

### Option C - Deprecate Arbitrary Fixtures

Eventually fail closed for arbitrary fixtures if retained runtime retirement
becomes a product goal.

This is not approved. It would need user-facing migration guidance and release
notes because arbitrary fixtures are a legitimate local experimentation surface.

## Current Recommendation

Keep Option B in its narrow Phase 5.10 form.

Do not add a core-v2 arbitrary-manifest promise. Do not fail closed. Do not
remove `--fixture` or `--flow-root`. Do not treat custom flow roots as v2-owned.

The next implementation slice, if any, should stay away from old runtime
deletion and from generalizing trusted mirrors beyond the installed wrapper.
