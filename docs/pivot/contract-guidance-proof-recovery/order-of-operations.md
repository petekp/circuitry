# Circuit Pivot Order Of Operations

Status: canonical order guide for the contract, guidance, proof, recovery, and
safe-apply pivot. This guide is future-facing, but the "Current State" section
records what the pivot foundation branch already proves.

## Short Answer

The foundation slices are in place. The remaining work is not just to add the
new system. Each slice must also prune the old authority path it replaces.

Do this in order:

1. finish the core authority cutover and remove old relay/config selection as
   final authority;
2. replace checkpoint auto-resolution and remove the old autonomous checkpoint
   paths;
3. cut proof/recovery over and remove report-shape-as-proof and freeform
   recovery meaning;
4. keep generated host surfaces intent-first and prune any bypass framing;
5. make SafeApply the write boundary and then prune pre-SafeApply trusted-write
   paths from higher-autonomy work;
6. let Pursue use SafeApply before enabling parallel code-changing branches;
7. keep MemoryInput as hints only and prune any memory-as-authority behavior if
   it appears.

Temporary bridges are allowed only when they preserve current behavior during a
slice. Every bridge must name its owner slice, its removal condition, and a
death test that prevents it from coming back.

## Current State After Foundations

The pivot foundation branch has moved beyond the original planning state:

- WorkContract projections exist and are generated beside compiled flow files.
- `guidance.decision` exists in the trace schema and runtime traces.
- Relay execution planning is behind guidance; the relay executor calls
  `planRelayGuidanceDecision` and no longer calls `deriveResolvedSelection`
  directly.
- PolicyEnvelope v2 schema and policy layers exist, and v2 connector/provider,
  effort, and skill rules can block before relay starts.
- CheckpointBoundary, ProofAssessment, RecoveryRouteKind, ChangePacket,
  SafeApply trace, Pursue SafeApply reporting, and MemoryInput schemas exist.
- Generated host surfaces now frame `/circuit:run` as the intent front door and
  direct flow commands as expert controls, not runtime bypasses.
- Current write-capable built-in connectors are explicitly classified as
  `pre_safe_apply_trusted_write`.

Those facts do not mean the broad cutover is done. Old paths still exist in the
repo and must be pruned by the slices below:

- `SelectionOverride`, `ResolvedSelection`, `SelectionResolution`,
  `default_selection`, stage/step `selection`, and selection resolver tests;
- config v1 runtime loading, `relay.circuits`, `circuits.<flow>.selection`,
  `defaults.selection`, `skill_bindings`, and `variant_models`;
- checkpoint `safe_default_choice`, `safe_autonomous_choice`, and
  `auto_resolution` paths;
- old route labels such as `retry` and `revise` where they still carry recovery
  meaning without a typed RecoveryRouteKind binding;
- direct parent-checkout writes through trusted connectors before SafeApply.

## Source Anchors To Recheck

- [Pivot brief](pivot-brief.md)
- [Implementation readiness audit](implementation-readiness-audit.md)
- [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md)
- [docs/generated-surfaces.md](../../generated-surfaces.md)
- [docs/flows/pursue.md](../../flows/pursue.md)
- [src/schemas/compiled-flow.ts](../../../src/schemas/compiled-flow.ts)
- [src/schemas/step.ts](../../../src/schemas/step.ts)
- [src/schemas/config.ts](../../../src/schemas/config.ts)
- [src/schemas/run.ts](../../../src/schemas/run.ts)
- [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts)
- [src/runtime/run/relay-guidance.ts](../../../src/runtime/run/relay-guidance.ts)
- [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts)
- [src/runtime/connectors/resolver.ts](../../../src/runtime/connectors/resolver.ts)
- [src/runtime/safe-apply/](../../../src/runtime/safe-apply/)
- [src/commands/run.md](../../../src/commands/run.md)
- [plugins/codex/skills/run/SKILL.md](../../../plugins/codex/skills/run/SKILL.md)

## Pruning Rule

Do not let the old path and new path live as peers.

For every implementation slice:

1. add or confirm the replacement path;
2. identify the old path it replaces;
3. keep only the smallest temporary bridge needed to preserve behavior;
4. add the death test before or with the removal;
5. delete the old path when the cutover condition is true;
6. update generated surfaces and docs only through their source files.

A field, function, or doc phrase may survive temporarily only as one of these:

- **Input to guidance**: useful context that cannot decide by itself.
- **Migration fixture**: test data proving old inputs are converted or rejected.
- **Debug-only surface**: explicitly marked and still routed through the same
  guidance, proof, recovery, and trace path.

It must not survive as final authority.

## Deprecated-Code Pruning Ledger

| Slice | Deprecated path to prune | Temporary bridge allowed | Cutover condition | Death test / probe | Owner |
| --- | --- | --- | --- | --- | --- |
| Core authority cutover | Flow/stage/step/fanout/config `selection`; `SelectionOverride`, `ResolvedSelection`, `SelectionResolution` as final authority; relay executor access to old selection resolver | Old selection may feed `GuidanceDecision.selected` through `src/runtime/run/relay-guidance.ts` only | Relay, skills, connector, model, effort, and depth decisions are read from matching `guidance.decision`; old selection is not imported by runtime executors | Static test proves `src/runtime/executors/relay.ts` does not import or call `deriveResolvedSelection` or `resolveLoadedRelaySkills`; runtime tests fail mismatched guidance/relay choices | GuidanceDecision Trace Invariant + WorkContract Projection |
| Policy cutover | Config v1 as runtime policy; `relay.circuits`, `circuits.<flow>.selection`, `defaults.selection`, `skill_bindings`, `variant_models[*].selection` as final authority | Config v1 may be projected into PolicyEnvelope inputs in loader tests and migration fixtures | Runtime execution accepts PolicyEnvelope v2 policy layers and rejects config v1 in the runtime path after migration | Config tests reject old authority fields outside migration fixtures; runtime tests prove v2 hard rules beat v1 selection inputs | PolicyEnvelope Config V2 Cutover |
| Checkpoint authority | `safe_autonomous_choice`; `safe-autonomous` trace source; untraced `auto_resolution`; `highest-score`, `first-acceptable`, `accept-as-is` as checkpoint decision paths | `safe_default_choice` may project into `declared_default` until checkpoint schema is cut over | Every checkpoint resolution is operator, policy, or declared-default, and has matching `guidance.decision.subject === "checkpoint_resolution"` | Schema rejects `safe_autonomous_choice`; trace rejects `safe-autonomous`; runtime sequence rejects auto-resolved checkpoints without matching guidance | CheckpointBoundary Authority |
| Proof and evidence | Acceptance criteria, verdict strings, report field presence, and agent prose as final proof | `check.evaluated` remains an Evidence input; existing flow reports remain inputs | Write-capable complete closes require passing ProofAssessment refs when proof policy requires claims | RunTrace rejects complete close without required `proof.assessed`; tests reject report-shape-only proof and unsupported claims | ProofAssessment And Evidence Adapter |
| Recovery | Route strings such as `retry`, `revise`, and flow-local recovery labels carrying meaning by themselves | Route ids may remain stable graph targets; typed meaning must come from RecoveryRouteKind binding | Recovery decisions record typed recovery kind, failure cause, failure ref, and WorkContract binding ref | Tests reject recovery guidance without typed kind or WorkContract binding; enum audit rejects recovery kinds named in specs but missing from schema | RecoveryRouteKind |
| Generated host surfaces | "flow runner", "run this flow" as the main product story, "Direct Flow Bypass", and any claim that direct commands skip guidance/proof/recovery/trace | Direct flow commands may remain public expert or developer controls | All public host surfaces are intent-first; direct controls are marked expert/developer and still use the same runtime path | Generated-surface framing tests and `emit.ts --check` reject bypass wording and stale mirrors | Generated Host Surface Reframing |
| SafeApply | Parent-checkout mutation counted as accepted change; worker-reported `changed_files` as final touched-file truth; write-capable trusted connector path for higher autonomy | Current trusted-write connectors may remain for ordinary serial Build/Fix until isolated ChangePacket flow exists | Write-capable higher-autonomy work produces ChangePacket; runtime computes touched files; SafeApply accepts/rejects before parent mutation is trusted | SafeApply tests reject base mismatch, dirty parent, patch conflict, protected-file drift, generated-surface drift, weak proof, and partial mutation | ChangePacket And SafeApply |
| Pursue | Parallel code-changing branches without SafeApply; counting rejected packets as complete; old serial-only report fields as the only safety record | Pursue may keep serial code-changing work before SafeApply | Parallel code-changing branches are allowed only from isolated roots that produce ChangePackets and pass SafeApply/final verification | Pursue tests reject parallel writes before SafeApply; applied/rejected/blocked packet counts are required; final verification gates close | Pursue SafeApply Integration |
| Memory | Memory changing authority, relaxing policy, skipping proof, choosing undeclared routes, crossing checkpoint authority, or approving apply | Optional `memory_refs` only; memory may explain hints used or ignored | Material memory use is traced as input, and hard policy/contract conflicts are ignored and recorded | Memory tests prove conflicts with hard policy are ignored and memory cannot authorize route, checkpoint, proof, or SafeApply decisions | MemoryInput Boundary |

## Targeted Pruning Probes

Run these at the start and end of each slice. Early in the pivot, hits are
expected. At cutover, the owner slice must turn the expected hard-cut state into
tests or release audits.

### Legacy Selection Authority

```bash
rg -n \
  "SelectionOverride|ResolvedSelection|SelectionResolution|default_selection|deriveResolvedSelection|resolveSelectionForRelay|selectionConfigLayers|step\\.selection|stage\\.selection|circuits\\..*selection|defaults\\.selection|variant_models.*selection" \
  src tests docs generated plugins
```

Hard-cut state: old selection code is gone from runtime authority paths or is
only nested under `GuidanceDecision.selected` as traced input.

### Config V1 And Old Relay Routing

```bash
rg -n \
  "schema_version:\\s*1|z\\.literal\\(1\\)|Config\\.parse|LayeredConfig\\.parse|relay\\.circuits|circuits\\.[^.]+\\.selection|defaults\\.selection|skill_bindings|variant_models" \
  src tests docs generated plugins
```

Hard-cut state: config v1 is migration/test/docs-only. It is not a runtime
execution input after PolicyEnvelope v2 cutover.

### Checkpoint Auto-Resolution

```bash
rg -n \
  "safe_autonomous_choice|safe-autonomous|safe autonomous|auto_resolution|highest-score|first-acceptable|accept-as-is|safe_default_choice" \
  src tests docs generated plugins
```

Hard-cut state: old automatic checkpoint paths are rejected or converted into
declared defaults plus traced checkpoint guidance.

### Direct Flow Bypass Framing

```bash
rg -n \
  "Direct Flow Bypass|skip this classifier|bypass classifier|runtime bypass|direct flow skills|flow runner|run this flow|flow selector" \
  README.md docs src/commands plugins generated tests
```

Hard-cut state: public surfaces do not teach bypass. Expert/developer surfaces
say direct flow controls still use guidance, proof, recovery, and trace.

### Recovery Meaning

```bash
rg -n \
  "retry_with_feedback|retry_same_step_with_feedback|retry-selected-flow|retry|revise|RecoveryRouteKind|recovery_kind|route_taken|failed_check" \
  src tests docs generated plugins
```

Hard-cut state: route ids can remain graph labels, but recovery meaning comes
from typed RecoveryRouteKind bindings and traced recovery decisions.

### Pre-SafeApply Writes

```bash
rg -n \
  "workspace-write|trusted-write|pre_safe_apply_trusted_write|ChangePacket|SafeApply|safe_apply|safe apply|patch_path|changed_files|dirty_parent|parent checkout|parallel.*write|code-changing" \
  src tests docs generated plugins
```

Hard-cut state: trusted-write paths are either ordinary serial work or are
behind an explicit pre-SafeApply limit. Higher-autonomy write work requires
ChangePacket and SafeApply.

## Remaining Order

### Phase 1: Core Authority Pruning

Goal: finish the relay/config authority cutover without keeping old selection as
a second system.

Steps:

1. Ensure WorkContract refs are present for every public compiled flow and
   generated mirror.
2. Make relay execution consume the recorded guidance decision as the authority
   record.
3. Move old selection resolution behind guidance only as input.
4. Cut config execution to PolicyEnvelope v2.
5. Delete or quarantine old selection/config authority paths named in the ledger.

Exit criteria:

- Relay cannot start without matching guidance.
- Guidance cannot choose undeclared routes.
- Old selection cannot be imported by runtime executors.
- Config v1 is not accepted by runtime execution after cutover.
- Policy hard rules beat all old selection inputs.

Verification:

- `tests/contracts/work-contract-projection.test.ts`
- `tests/contracts/guidance-decision-schema.test.ts`
- `tests/contracts/runtrace-schema.test.ts`
- `tests/contracts/policy-envelope-schema.test.ts`
- `tests/contracts/relay-guidance-authority.test.ts`
- `tests/runner/config-loader.test.ts`
- targeted selection/config pruning probes above

### Phase 2: Checkpoint Authority Pruning

Goal: replace hidden checkpoint automation with authority-boundary decisions.

Steps:

1. Project current checkpoint fields into CheckpointBoundary.
2. Convert `safe_default_choice` to `declared_default`.
3. Delete `safe_autonomous_choice` and old untraced `auto_resolution` execution.
4. Require checkpoint resolution guidance before `checkpoint.resolved`.
5. Update resume validation so stale checkpoint requests cannot cross authority.

Exit criteria:

- `safe_autonomous_choice` cannot parse in active schemas.
- `safe-autonomous` cannot appear as a checkpoint resolution source.
- `highest-score`, `first-acceptable`, and `accept-as-is` cannot resolve a
  checkpoint without matching guidance.
- Resume fails when checkpoint request hash, choices, route, or WorkContract ref
  drift.

Verification:

- `tests/contracts/checkpoint-boundary-schema.test.ts`
- `tests/contracts/runtrace-schema.test.ts`
- `tests/runtime/checkpoint-resume.test.ts`
- checkpoint pruning probe above

### Phase 3: Proof And Recovery Pruning

Goal: make proof and recovery first-class enough that old report/check meaning
cannot masquerade as success.

Steps:

1. Convert acceptance-criteria results into Evidence.
2. Add durable ProofAssessment records and `proof.assessed` trace entries.
3. Gate write-capable close on ProofAssessment where WorkContract requires
   proof.
4. Bind recovery decisions to typed RecoveryRouteKind and WorkContract refs.
5. Remove old recovery meaning from route strings and report verdicts.

Exit criteria:

- Agent prose cannot count as proof.
- Report shape and verdict strings cannot close write-capable work by
  themselves.
- Weak or unproved proof routes to typed recovery or stop.
- Recovery guidance must name typed recovery kind, failure cause, failure ref,
  and WorkContract binding.

Verification:

- `tests/contracts/proof-assessment-schema.test.ts`
- `tests/contracts/recovery-route-kind.test.ts`
- `tests/contracts/runtrace-schema.test.ts`
- proof closure runtime tests
- recovery pruning probe above

### Phase 4: Generated Surface Pruning

Goal: keep generated surfaces as an enforcement asset and remove old product
framing.

Steps:

1. Keep `/circuit:run` as the intent front door.
2. Keep direct flow commands only as expert/developer controls.
3. Delete or replace old bypass and flow-runner wording.
4. Regenerate host mirrors from source.
5. Add framing audits so stale mirrors cannot reintroduce the old story.

Exit criteria:

- Public docs do not describe Circuit primarily as a flow runner.
- Direct flow controls do not claim bypass.
- Generated mirrors stay drift-clean.

Verification:

- `npm run build && npm run emit-flows`
- `node scripts/flows/emit.ts --check`
- generated-surface framing tests
- direct-flow pruning probe above

### Phase 5: SafeApply Write Pruning

Goal: make write-capable autonomous work propose changes before Circuit applies
them.

Steps:

1. Ensure ChangePacket has base refs, patch refs/hashes, runtime-computed
   touched files, proof refs, risks, protected-file status, and final
   verification policy.
2. Route higher-autonomy write-capable relays through isolated roots or explicit
   pre-SafeApply trusted-write limits.
3. Make SafeApply reject unsafe packets before parent mutation.
4. Remove worker-reported `changed_files` as final touched-file truth.
5. Keep ordinary serial trusted-write work clearly labeled until its own cutover.

Exit criteria:

- Base mismatch, dirty parent, protected-file drift, generated-surface drift
  without proof, patch conflict, weak proof, and final verification failure all
  reject.
- Runtime-computed touched files override worker-reported files.
- No higher-autonomy write work uses `pre_safe_apply_trusted_write`.

Verification:

- `tests/contracts/change-packet-schema.test.ts`
- `tests/runtime/safe-apply.test.ts`
- generated-surface SafeApply tests
- pre-SafeApply write pruning probe above

### Phase 6: Pursue SafeApply Pruning

Goal: let Pursue coordinate parallel code-changing work only after SafeApply can
inspect and apply packets.

Steps:

1. Keep serial code-changing Pursue as the default until SafeApply is enabled.
2. Add isolated branch execution that returns ChangePackets.
3. Reconcile estimated and actual touch sets.
4. Report applied, rejected, and blocked packets separately.
5. Delete any path that treats file-disjoint patches or successful worker prose
   as sufficient safety.

Exit criteria:

- Parallel code-changing branches fail unless SafeApply is enabled.
- Rejected packets do not count as complete.
- Final composed verification gates close.

Verification:

- `tests/runner/pursue-runtime.test.ts`
- `tests/contracts/pursue-report-schemas.test.ts`
- `tests/runtime/fanout.test.ts`
- SafeApply and Pursue pruning probes above

### Phase 7: Memory Boundary Pruning

Goal: keep memory useful without letting it become hidden authority.

Steps:

1. Keep memory as optional `memory_refs` and plain hints.
2. Trace memory conflicts when memory is considered and ignored.
3. Reject any memory input that tries to permit writes, relax policy, skip
   proof, choose undeclared routes, cross checkpoint authority, or affect
   SafeApply.
4. Do not build a memory store, memory UI, or memory scoring until the authority
   cutover is complete.

Exit criteria:

- Memory conflicts with WorkContract or hard policy are ignored and traced.
- Memory cannot change route, checkpoint, proof, or SafeApply authority.

Verification:

- `tests/contracts/memory-input-schema.test.ts`
- `tests/runtime/policy-memory-conflicts.test.ts`
- targeted memory authority probes when memory runtime exists

## Do Not Do

- Do not leave old and new authority systems as peers.
- Do not keep a temporary bridge without naming its removal slice.
- Do not delete old fields before replacement tests prove current behavior is
  preserved or intentionally rejected.
- Do not use generated host copy as the first proof of a runtime cutover.
- Do not treat `ResolvedSelection` as final relay authority.
- Do not let config v1 survive as runtime policy after PolicyEnvelope cutover.
- Do not let checkpoints auto-resolve without guidance.
- Do not let acceptance criteria or report shape stand in for ProofAssessment.
- Do not let SafeApply become a Pursue-only feature.
- Do not make memory central to the first cutovers.

## Still Unsettled

- Exact timing for config v1 runtime rejection.
- Which old selection schema exports remain as migration fixtures after cutover.
- Whether direct flow controls stay public expert controls long-term or become
  developer-only.
- Exact durable path for ProofAssessment records.
- Exact policy-change event name for loosening a hard project rule.
- How ordinary serial trusted-write Build/Fix work migrates to SafeApply.
- Whether `highest-score` becomes fanout/review policy or disappears.

## Review Record

Earlier passes fixed the high-level ordering: generated-surface implementation
stays after runtime support, and SafeApply stays after proof. This revision adds
the missing pruning ledger so future implementation agents cannot treat old
selection, config, checkpoint, proof, recovery, generated-surface, write, Pursue,
or memory paths as permanent parallel systems.
