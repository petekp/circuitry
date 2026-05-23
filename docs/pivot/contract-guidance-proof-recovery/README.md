# Contract, Guidance, Proof, And Recovery Pivot

Status: live consolidated reference.

This README is the live documentation set for the pivot. Use the code and tests
listed here as the source of truth.

## Source Priority

When sources disagree, use this order:

1. Current schemas, runtime code, generated outputs, and tests.
2. This consolidated pivot reference.

Host prose, route labels, and report wording are not authority unless current
code and tests accept the same shape.

## Current Boundaries

| Boundary | Live source trail | Rule |
| --- | --- | --- |
| WorkContract projection | `src/schemas/work-contract-projection.ts`, `src/shared/work-contract-projection.ts`, `tests/contracts/work-contract-projection.test.ts`, `docs/generated-surfaces.md` | Flow-owned contracts declare authority, proof inputs, recovery bindings, and limits. Runtime fallback behavior may exist only where tests still preserve it. |
| GuidanceDecision trace | `src/schemas/guidance-decision.ts`, `src/runtime/run/relay-guidance.ts`, `src/runtime/run/guidance.ts`, `tests/contracts/guidance-decision-schema.test.ts`, `tests/contracts/relay-guidance-authority.test.ts` | Guidance is a recorded decision. Agent prose, preferred routes, and host wording cannot become authority without a valid trace entry. |
| PolicyEnvelope | `src/schemas/policy-envelope.ts`, `src/shared/policy-envelope.ts`, `src/shared/config-loader.ts`, `tests/contracts/policy-envelope-schema.test.ts`, `tests/runner/config-loader.test.ts`, `tests/runtime/connectors.test.ts` | Policy can constrain or rank allowed choices. It cannot loosen WorkContract authority or replace a guidance decision. |
| CheckpointBoundary | `src/schemas/checkpoint-boundary.ts`, `src/shared/checkpoint-boundary.ts`, `src/runtime/executors/checkpoint.ts`, `src/runtime/run/checkpoint-resume.ts`, `tests/contracts/checkpoint-boundary-schema.test.ts`, `tests/runtime/checkpoint-resume.test.ts` | Every automatic or default checkpoint crossing must be modeled as a declared authority boundary with matching guidance where required. |
| ProofAssessment | `src/schemas/proof-assessment.ts`, `src/shared/proof-assessment.ts`, `src/runtime/executors/verification.ts`, `src/runtime/executors/relay.ts`, `tests/contracts/proof-assessment-schema.test.ts`, `tests/runner/build-verification-exec.test.ts`, `tests/runtime/runtime-baseline.test.ts` | Write-capable completion that requires proof must close on durable proof assessment evidence, not report shape, verdict strings, or prose. |
| RecoveryRouteKind | `src/schemas/recovery-route-kind.ts`, `src/runtime/run/recovery-selection.ts`, `src/runtime/run/graph-runner.ts`, `tests/contracts/recovery-route-kind.test.ts`, `tests/runner/recovery-route.test.ts`, `tests/runtime/runtime-baseline.test.ts` | Recovery routes are typed. Route labels are not authority when WorkContract bindings are absent or mismatched. |
| SafeApply trace foundation | `src/schemas/change-packet.ts`, `src/schemas/trace-entry.ts`, `src/schemas/run.ts`, `tests/contracts/runtrace-schema.test.ts` | The live foundation keeps only shared trace enums and `safe_apply.result` trace validation. A full ChangePacket schema is not live runtime authority yet. |
| Connector write boundary | `src/runtime/connectors/resolver.ts`, `tests/runtime/connectors.test.ts` | Current write-capable connectors are classified as pre-SafeApply trusted writes. That classification must stay explicit until SafeApply exists. |
| Pursue V1 write policy | `docs/flows/pursue.md`, `src/flows/pursue/reports.ts`, `tests/contracts/pursue-report-schemas.test.ts`, `tests/runner/pursue-runtime-wiring.test.ts` | Pursue V1 keeps code-changing work serial and keeps SafeApply planning reports out of the active flow until SafeApply exists. |
| MemoryInput | `src/schemas/memory-input.ts`, `src/schemas/guidance-decision.ts`, `tests/contracts/memory-input-schema.test.ts` | Memory can be cited as input. It cannot grant write, checkpoint, proof, policy, route, or recovery authority. |
| Generated host surfaces | `docs/generated-surfaces.md`, `scripts/flows/emit.ts`, `tests/contracts/generated-surface-framing.test.ts`, `tests/contracts/catalog-completeness.test.ts` | Generated mirrors must match their sources. Host copy must not promise behavior before runtime can back it. |

## Non-Negotiable Rules

- A flow or step may act only through declared contract authority.
- A guidance decision records why an allowed choice was made.
- A policy envelope may narrow choices, not invent authority.
- A checkpoint crossing needs an explicit boundary, choice, default, or traced
  policy decision.
- Proof must be durable evidence. Report prose is not proof.
- Recovery must use declared `RecoveryRouteKind` values and matching
  WorkContract bindings.
- Memory references are hints and citations, not permission.
- Generated host surfaces are generated data. Update sources first, regenerate
  only when the source of truth changes, then run drift checks.

## Current Implementation Order

Completed pivot boundaries:

1. WorkContract projection and generated projection drift checks.
2. GuidanceDecision trace schema and relay guidance authority.
3. PolicyEnvelope projection and connector constraint handling.
4. CheckpointBoundary authority pruning.
5. ProofAssessment and typed recovery close behavior.
6. ChangePacket schema pruning back to the live SafeApply trace foundation.
7. Pivot documentation consolidation into this file.

Deferred work:

1. SafeApply runtime.
2. Parallel write-capable Pursue branches.
3. Broader memory authority or continuity behavior.

Do not start deferred work while cleaning pivot cruft. Preserve current tested
behavior until a rejection path has focused tests.

## Future SafeApply Trail

SafeApply should stay a runtime boundary, not a Pursue-only feature.

Before adding SafeApply runtime behavior, add failing tests for one old authority
path at a time. Good death tests include:

- A prose claim or report verdict cannot approve an apply.
- A packet without runtime diff evidence cannot complete write-capable work.
- A generated-surface edit without source refs and drift evidence is rejected.
- A protected-file edit routes through a checkpoint boundary.
- A weak proof routes to typed recovery or stop.
- A SafeApply rejection cannot route directly to complete.

Only after those tests exist should runtime code accept a change packet, inspect
files, bind proof refs, run final verification, and emit `safe_apply.result`.

## Future Pursue Trail

Pursue can coordinate broad work now, but code-changing work remains serial.

Parallel write-capable Pursue branches stay blocked until SafeApply provides:

- isolated work roots;
- machine-readable packets;
- runtime diff evidence;
- generated-surface drift evidence when generated files change;
- protected-file checks;
- durable proof assessment refs;
- typed recovery for reject, conflict, weak proof, and unsafe apply.

Until then, keep Pursue V1 reports strict and keep SafeApply planning reports out
of the active Pursue flow.

## Verification Ladder

Use focused checks while pruning a boundary, then finish with the full repo
verification.

Useful focused checks:

```bash
npm run test -- tests/contracts/work-contract-projection.test.ts
npm run test -- tests/contracts/guidance-decision-schema.test.ts
npm run test -- tests/contracts/policy-envelope-schema.test.ts
npm run test -- tests/contracts/checkpoint-boundary-schema.test.ts
npm run test -- tests/contracts/proof-assessment-schema.test.ts
npm run test -- tests/contracts/recovery-route-kind.test.ts
npm run test -- tests/contracts/runtrace-schema.test.ts
npm run test -- tests/contracts/pursue-report-schemas.test.ts
npm run test -- tests/contracts/documentation-surface.test.ts
```

Required closeout checks for pivot cleanup:

```bash
git diff --check
npm run check-flow-drift
npm run verify
```

For documentation pruning, also run a repository markdown link probe after
removing or moving files.

## Change Rules

- Keep this directory small. Add a new pivot file only when one README cannot
  hold the live boundary without becoming unclear.
- Prefer source-backed tables over long planning prose.
- When a boundary moves from future plan to runtime behavior, update the source
  map and tests in the same change.
- If old detail is needed, recover it from git history instead of keeping stale
  active docs in the tree.
