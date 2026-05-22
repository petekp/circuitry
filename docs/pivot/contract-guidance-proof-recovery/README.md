# Contract, Guidance, Proof, And Recovery Pivot

Status: canonical reference directory for the current Circuit pivot. These docs
are future-facing unless they point to code, tests, generated surfaces, or
runtime behavior that has already changed.

Use this directory when continuing pivot work. It keeps the doctrine, first
spec direction, and order of operations together so future sessions do not have
to reconstruct the plan from chat history.

## Read In This Order

1. [Pivot brief](pivot-brief.md) - product thesis, doctrine, language rules,
   boundaries, anti-cruft rules, roadmap, unsettled items, and review findings.
2. [Order of operations](order-of-operations.md) - the safest sequence for
   specs, docs, generated surfaces, schema/runtime changes, tests, and gates.
3. [WorkContract Projection V0](work-contract-projection-v0.md) - first
   implementation-spec direction for projecting current Flow fields into
   contract authority, guidance inputs, or deleted old authority.
4. [GuidanceDecision Trace Invariant](guidance-decision-trace-invariant.md) -
   second implementation-spec direction for recorded decisions, refs, matching
   rules, sequence checks, and death tests.
5. [PolicyEnvelope Config V2 Cutover](policy-envelope-config-v2-cutover.md) -
   third implementation-spec direction for moving config, relay routing,
   selection, skills, connector/model preferences, defaults, limits, and
   overrides into policy inputs instead of old runtime authority.
6. [CheckpointBoundary Authority](checkpoint-boundary-authority.md) - supporting
   implementation-spec direction for checkpoint choices, declared defaults,
   policy-controlled resolution, trace rules, resume validation, and old
   auto-resolution death tests.
7. [ProofAssessment And Evidence Adapter](proof-assessment-evidence-adapter.md) -
   supporting implementation-spec direction for claims, evidence, proof checks,
   acceptance-criteria evidence, weak-proof recovery, and write-capable close
   gates.
8. [RecoveryRouteKind](recovery-route-kind.md) - supporting
   implementation-spec direction for typed recovery paths after failed checks,
   weak proof, contradicted evidence, checkpoint boundaries, relay failures,
   apply conflicts, budget limits, and unknown failures.
9. [Generated Host Surface Reframing](generated-host-surface-reframing.md) -
   supporting implementation-spec direction for intent-first host commands,
   Codex skills, plugin manifests, direct flow expert controls, generated
   mirrors, drift checks, and product-framing death tests.
10. [ChangePacket And SafeApply](change-packet-safe-apply.md) - supporting
   implementation-spec direction for proposed changes, base checks, runtime
   touched files, patch/apply gates, protected files, generated surfaces, final
   verification, and Pursue safe-apply implications.
11. [Pursue SafeApply Integration](pursue-safe-apply-integration.md) -
   supporting implementation-spec direction for Pursue isolated write branches,
   serial behavior before SafeApply, touch-set reconciliation,
   applied/rejected/blocked packet reporting, proof gates, final verification,
   recovery, generated-surface handling, and premature-parallel-write death
   tests.
12. [MemoryInput Boundary](memory-input-boundary.md) - supporting
   implementation-spec direction for using memory as hints without letting
   memory authorize work, relax policy, skip proof, choose undeclared routes,
   change checkpoint authority, or affect SafeApply.
13. [Implementation Readiness Audit](implementation-readiness-audit.md) -
   cross-spec audit of contradictions, terminology drift, death-test gaps,
   ownership boundaries, and the safest first runtime/schema/test slice.

## Doctrine

Flows carry work contracts. Guidance runs those contracts within the rules.
Trace records consequential decisions. Proof checks the evidence. Safe apply
turns agent-written edits into inspected proposed changes.

Short rule:

> Flow defines what can run. WorkContract defines what is allowed. Guidance
> decides how to run it now.

## Local Evidence To Recheck

- [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md) - canonical Circuit
  vocabulary.
- [docs/generated-surfaces.md](../../generated-surfaces.md) - generated output
  ownership and drift checks.
- [docs/flows/authoring-model.md](../../flows/authoring-model.md) - current flow
  authoring model.
- [docs/flows/pursue.md](../../flows/pursue.md) - Pursue safety boundary.
- [src/schemas/](../../../src/schemas/) - current schema authority paths.
- [src/runtime/](../../../src/runtime/) - current runtime authority paths.
- [src/commands/run.md](../../../src/commands/run.md) and
  [plugins/codex/skills/run/SKILL.md](../../../plugins/codex/skills/run/SKILL.md)
  - current host-facing flow-selection surfaces.

## Rules For Future Work

- Do not treat these docs as current runtime truth until the matching code,
  tests, contracts, and generated surfaces change.
- Keep product prose plain: use flow, block, route, relay, trace, report,
  evidence, checkpoint, and Pursue.
- Do not start runtime implementation until WorkContract Projection V0,
  GuidanceDecision Trace Invariant, and PolicyEnvelope Config V2 Cutover have
  crisp death tests.
- Generated host surfaces must change through their source files and emit
  scripts, not by hand-editing generated mirrors.
