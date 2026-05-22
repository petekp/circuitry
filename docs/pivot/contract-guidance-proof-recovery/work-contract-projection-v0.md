# WorkContract Projection V0

Status: first implementation-spec direction for the Circuit pivot. This is not
current runtime behavior until the matching schema, runtime, tests, contracts,
and generated surfaces change.

## Purpose

WorkContract Projection V0 defines how current Circuit flow fields project into
three buckets:

1. `work_contract`: what is allowed, required, bounded, and provable.
2. `guidance_seed`: old hints that guidance may consider, with source refs, but
   never final authority.
3. `rejected_authority`: old fields or combinations that must fail once the
   cutover is active.

The goal is to remove dual authority. A Flow may carry a work contract. It must
not also secretly decide model, effort, connector, or skill choice.

## Source Surfaces

Recheck these before writing the implementation spec:

- [Pivot brief](pivot-brief.md)
- [src/schemas/compiled-flow.ts](../../../src/schemas/compiled-flow.ts)
- [src/schemas/stage.ts](../../../src/schemas/stage.ts)
- [src/schemas/step.ts](../../../src/schemas/step.ts)
- [src/schemas/flow-schematic.ts](../../../src/schemas/flow-schematic.ts)
- [src/schemas/config.ts](../../../src/schemas/config.ts)
- [src/schemas/selection-policy.ts](../../../src/schemas/selection-policy.ts)
- [src/schemas/acceptance-criteria.ts](../../../src/schemas/acceptance-criteria.ts)
- [src/schemas/skill.ts](../../../src/schemas/skill.ts)
- [src/shared/selection-resolver.ts](../../../src/shared/selection-resolver.ts)
- [src/runtime/connectors/resolver.ts](../../../src/runtime/connectors/resolver.ts)
- [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts)
- [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts)
- [src/runtime/run/graph-runner.ts](../../../src/runtime/run/graph-runner.ts)
- [docs/generated-surfaces.md](../../generated-surfaces.md)

## Core Decision

WorkContract V0 should be a generated projection carried by the Flow, not a
second hand-authored source file. FlowData and schematics remain the authoring
source. The projection should be emitted with compiled flow output and mirrored
through the same generated-surface checks.

## Projection Map

| Current surface | Fate | Projection rule |
| --- | --- | --- |
| Flow `id`, `version`, `purpose`, `entry`, `axes`, `starts_at` | Contract | Flow identity and entry shape. |
| Flow stages, stage ids, canonical stage path, `stage_path_policy` | Contract | Allowed run shape. Stage `selection` is not contract authority. |
| Schematic or step block kind, step id, title, protocol, reads, writes, check refs | Contract | Runnable block and expected file/report effects. |
| `routes`, terminal targets, `route_from_report` | Contract | Allowed transitions only. Dynamic route selection must validate against declared routes. |
| Recovery routes | Contract | Add `RecoveryRouteKind`; current string labels are too thin. |
| `budgets.max_attempts`, `budgets.wall_clock_ms` | Contract | Hard caps. Policy may only tighten them. |
| Relay `role`, report ref/schema, request/result/report writes, acceptance inputs | Contract | Defines work role and proof inputs. |
| Relay `connector` | Guidance seed | May become a preference or hard policy input. Must not directly choose the connector. |
| Acceptance criteria | Contract proof input | Convert command/report checks into Evidence inputs. They cannot close write-capable work by themselves. |
| Report and evidence requirements | Contract | Required proof slots and report refs. |
| Checkpoint choices, choice sources, route consequences | Contract | Authority boundary. Dynamic choices must map to declared route families. |
| `safe_default_choice` | Replace | Becomes `declared_default` only if policy can cross the boundary and a GuidanceDecision records it. |
| `safe_autonomous_choice`, `safe-autonomous`, old `auto_resolution` modes | Deleted | These are hidden decision paths. |
| Sub-run `flow_ref`, goal, writes, report refs | Contract | Allowed child Flow call. |
| Sub-run or selection `depth` | Split | Child-run depth can be a contract limit. Selection depth is guidance input only. |
| Fanout branch ids, goals, report schema, required counts, failure policy | Contract | Allowed branch shape. Writable branches stay serial until SafeApply. |
| Fanout branch `selection` and `connector` | Guidance seed / deleted as authority | May inform guidance. Cannot directly select worker/model/connector. |
| Flow, stage, step, config, invocation `selection` | Guidance seed only | Preserve source/provenance if useful. Final authority moves to GuidanceDecision. |
| `skill_slots` | Contract | Capability slots the work needs. |
| Concrete skill bindings and `SelectionOverride.skills` | Guidance seed | Guidance may choose skills inside policy. Direct activation authority is deleted. |
| Config `relay.default`, `relay.roles`, `relay.circuits`, `circuits.<flow>.selection`, `defaults.selection`, variant model selection | Guidance/policy input only | These may migrate into rules, limits, or preferences. They must never directly determine connector/model/effort/skills. |
| Generated host commands and plugin mirrors | Generated output | Must carry the same contract/guidance/proof runtime after cutover. |

## Proposed V0 Shape

```ts
type WorkContractProjectionV0 = {
  work_contract: {
    flow: FlowIdentity;
    topology: DeclaredStagesAndRoutes;
    blocks: DeclaredBlocks;
    authority: ReadsWritesRelaysCheckpointsSubrunsFanout;
    proof: ReportsEvidenceAcceptanceInputsCloseRules;
    recovery: RecoveryRoute[];
    limits: Budgets;
  };
  guidance_seed: {
    selection_hints: SourceRef[];
    connector_hints: SourceRef[];
    skill_hints: SourceRef[];
    host_recommendations?: SourceRef[];
  };
  rejected_authority: ProjectionViolation[];
};
```

## Death Tests

Schema and projection:

- Reject unclassified fields during projection.
- Reject `default_selection`, stage `selection`, step `selection`, and fanout
  branch `selection` inside `work_contract`.
- Reject relay `connector` as final contract authority.
- Reject `safe_autonomous_choice`, `safe-autonomous`, and old checkpoint
  `auto_resolution` as contract authority.
- Require every recovery route to bind route id, `RecoveryRouteKind`, and
  allowed failure causes.
- Require acceptance criteria to project to proof inputs, not close conditions.
- Require skill slots to stay capability slots; concrete skill ids stay guidance
  seed.

Runtime:

- Relay cannot start from WorkContract alone with connector/model/effort/skills
  chosen.
- Guidance cannot choose a route missing from WorkContract.
- Checkpoint default resolution requires a declared default and a matching
  GuidanceDecision.
- Weak or unproved proof cannot close write-capable work.
- Pursue cannot enable parallel code-changing branches before SafeApply.

Generated surfaces:

- Generated flow manifests include or reference the WorkContract projection.
- Drift checks fail if generated mirrors omit the projection.
- Public generated docs do not teach direct flow commands as bypassing guidance,
  proof, recovery, or trace.
- Direct flow commands, if kept, are expert/dev controls that still run the same
  runtime path.

## Still Unsettled

- Exact `Ref` shape belongs to the GuidanceDecision spec.
- Full Claim/Evidence/ProofAssessment schema belongs to the proof spec.
- PolicyEnvelope v2 conflict rules belong to the config cutover spec.
- Exact ChangePacket and SafeApply fields belong to the SafeApply spec.
- Direct flow command treatment belongs to generated-surface reframing.

## Review Record

First pass found three medium risks: guidance hints were too close to contract
authority, acceptance criteria lacked claim coverage, and fanout
connector/selection could slip through. The projection is now explicitly
three-way, claim coverage can come from WorkContract proof policy, and fanout
connector/selection is guidance seed only.

Second pass found no medium-or-above findings. Remaining low risks are delegated
specs, not blockers for WorkContract Projection V0.
