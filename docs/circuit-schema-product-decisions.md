# Circuit Schema Product Decisions

Status: decision log for v3 schema proof  
Date: 2026-04-17

## Purpose

Record the product decisions that must be settled before v3 mode behavior,
budgets, checkpoints, and work patterns become schema-owned.

This file is deliberately narrower than the architecture proposal. It answers
the open questions exposed by the adversarial review and mode truth-table audit.

## Decision 1: Generic Rigor Is A Default, Not Law

Decision:

> Generic rigor profiles describe defaults. Workflow-specific mode contracts win
> when they differ.

Consequences:

- Build Lite can still run Review because Build now uses a fixed graph.
- Repair Lite can skip Review because the Repair contract says so.
- Sweep can write `review.md` during Verify without having a separate Review
  phase.
- A v3 schema must avoid global shortcuts like `lite.skip_phases: [review]`.

Schema implication:

```yaml
modes:
  lite:
    phase_overrides:
      review:
        behavior: run
        note: Build keeps Review even in Lite.
```

Do not infer workflow behavior from generic rigor alone.

## Decision 2: Build Architecture Uncertainty Stops, It Does Not Transfer

Decision:

> Until runtime has ledger-backed transfer events, Build architecture
> uncertainty stops the Build workflow and tells the user to restart through
> Explore.

Consequences:

- `active-run.md` transfer notes are advisory, not command input.
- SessionStart and runtime resume must not treat a prose transfer note as
  topology.
- A future runtime transfer feature needs canonical events before cross-workflow
  resume can rely on it.

Schema implication:

Do not encode same-run Build -> Explore transfer in the first v3 definition
fixture. Use stop/escalate guidance instead.

## Decision 3: Migrate Autonomous Plan Checkpoint Is Evidence-Gated

Decision:

> Migrate Autonomous may auto-continue through the coexistence-plan checkpoint
> only when the plan is concrete under every required lens and the coexistence
> strategy reuses an established pattern. It must hold for human review when
> coexistence is novel, underspecified, or any lens is hand-wavy.

Required lenses:

- coexistence strategy
- batch order
- rollback procedures
- scope boundaries

Established-pattern examples:

- same-DB dual-write with clear reconciliation
- strangler routing with reversible traffic switch
- blue-green cutover with verified rollback

Hold-for-human examples:

- novel shared-state design
- hand-wavy rollback
- unclear data ownership
- missing per-batch verification
- missing cutover criteria

Schema implication:

Checkpoint policy needs evidence criteria and receipt fields:

```yaml
checkpoint_policy:
  coexistence_plan:
    autonomous:
      behavior: evidence_gated_auto_continue
      required_lenses:
        - coexistence_strategy
        - batch_order
        - rollback_procedures
        - scope_boundaries
      hold_when:
        - novel_coexistence
        - missing_lens
        - hand_wavy_rollback
      enforcement: receipt_audited
```

This is not `runtime_enforced` until an evaluator exists. The first v3 proof
should generate prompt guidance and require a receipt explanation.

## Decision 4: Explore Tournament Budgets Count Rounds And Child Workers

Decision:

> Tournament budgets must name both dispatched rounds and child-worker count.
> The current Explore Tournament shape has four child-worker rounds of three
> workers each, followed by orchestrator convergence and pre-mortem.

Budget vocabulary:

| Budget Field | Current Explore Tournament Value | Meaning |
|--------------|----------------------------------|---------|
| `max_proposals` | 3 | Divergent proposals. |
| `max_child_rounds` | 4 | Diverge, adversarial review, revise, stress-test. |
| `max_child_dispatches` | 12 | Three workers per child round. |
| `max_orchestrator_rounds` | 2 | Convergence and pre-mortem. |
| `max_tradeoff_checkpoints` | 1 | User confirmation after convergence. |

Consequences:

- Do not describe Tournament as "about seven dispatch steps." That hides the
  actual cost surface.
- Runtime-core does not need to see all 12 child dispatches in the first v3
  slice. Receipts can record actual child units.
- A future scheduler can promote child units to runtime state only after the
  receipt-only proof shows enough value.

Schema implication:

```yaml
work:
  pattern: tournament
  budget:
    max_proposals: 3
    max_child_rounds: 4
    max_child_dispatches: 12
    max_orchestrator_rounds: 2
    max_tradeoff_checkpoints: 1
    enforcement: resolver_enforced
```

## Decision 5: Dynamic Units Are Receipt-Visible First

Decision:

> Runtime-derived child work units should be receipt-visible before they become
> runtime-core-visible.

Applies to:

- Sweep survey categories selected by sweep type
- Sweep PROVE rows selected from `queue.md`
- Sweep execute batches selected from `queue.md`
- Migrate batches selected from `plan.md`
- Explore Tournament child rounds under the current outer Decide phase

Consequences:

- The first v3 compiler emits the current v2-compatible outer graph.
- The policy index can describe templates and cardinality limits.
- Receipts record actual resolved units.
- Runtime events remain unchanged.

Schema implication:

Work patterns need a field or convention that says where actual units appear:

```yaml
work:
  pattern: parameterized_fanout
  actual_units: receipt_visible
```

Do not promote dynamic child units into runtime topology until resume,
scheduling, and ledger semantics are explicitly designed.

## Decision 6: Enforcement Class Is Required For New Controls

Decision:

> Every new v3 control must declare how it is enforced.

Allowed classes:

- `runtime_enforced`
- `resolver_enforced`
- `adapter_enforced`
- `receipt_audited`
- `prompt_guidance`
- `prose_only`

Consequences:

- YAML cannot imply safety that runtime does not provide.
- Reviewers can distinguish hard gates from instructions.
- The compiler can reject missing enforcement classifications once v3 moves past
  fixture status.

Schema implication:

Controls without an enforcement class are invalid in v3 proof fixtures.

## Open Follow-Up

The next unresolved product question is whether Migrate Deep should add real
steering checkpoints beyond the coexistence plan checkpoint. Current docs imply
extra steering, but the current skill does not enumerate it. Until that is
resolved, v3 should model Migrate Deep as a stronger posture over the same named
checkpoint rather than adding hidden checkpoint topology.
