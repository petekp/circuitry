# Run-Centered V1 Migration Ledger

Status: readiness control plane, not current behavior.

Date: 2026-05-28

## Purpose

Track the Run-centered V1 migration as small, gated implementation slices.
This ledger is the control plane for implementation. It does not change runtime
behavior.

Use this file at the start and end of every Run-centered V1 implementation
session.

## Charter

| Field | Value |
| --- | --- |
| Mission | Move Circuit from a flow-forward product surface to a Run-centered product surface while preserving the existing flow library, runtime kernel, run folders, generated surfaces, checkpoints, and hint-only memory authority. |
| Start state | `Run` is mostly a host prompt and router entry; direct flows and Goal are public peers; each flow owns its own report shapes. |
| Target state | `Run` is the normal front door. Source-owned Run forms a goal, selects process attempts, prepares evidence and skill context, checks completion, follows up under budget, and closes honestly. |
| Migration strategy | Contract, fixture, shadow artifact, source-owned Run, compact surface, public simplification. |
| Non-goal | No blank-slate rewrite. No runtime graph replacement. No public command hiding before parity. No skill packaging as a hidden dependency. |
| Operator invariant | The operator should see less steering load, not more concepts. |
| Agent invariant | The agent should have goal, process, evidence, memory hints, skill moments, prior attempts, decision packets, and stop conditions close at hand. |

## Source Truth

- Target architecture:
  [target-architecture-hypothesis-v1.md](target-architecture-hypothesis-v1.md),
  [run-centered-architecture-audit-v1.md](run-centered-architecture-audit-v1.md)
- Migration plan:
  [run-centered-migration-plan-v1.md](run-centered-migration-plan-v1.md)
- Run envelope contract prep:
  [run-supervisor-contract-sketch-v1.md](run-supervisor-contract-sketch-v1.md),
  [run-supervisor-fixture-plan-v1.md](run-supervisor-fixture-plan-v1.md)
- Skill Moment prep:
  [skill-moment-vocabulary-v1.md](skill-moment-vocabulary-v1.md),
  [skill-moment-policy-fixture-plan-v1.md](skill-moment-policy-fixture-plan-v1.md)
- Cross-cutting readiness contracts:
  [run-centered-v1-preflight-contracts.md](run-centered-v1-preflight-contracts.md)
- Readiness report:
  [run-centered-v1-implementation-readiness.md](run-centered-v1-implementation-readiness.md)

## Current Readiness State

| Area | State | Owning Artifact | Implementation Gate |
| --- | --- | --- | --- |
| Migration control plane | Ready | This ledger | Use slice order and checkpoint protocol below. |
| Run envelope data contract | Ready | Run contract sketch and fixture plan | Land schema and pure fixtures before behavior. |
| Runtime boundary guard | Ready | Preflight contracts | Add import-boundary test with first Run envelope code. |
| Process evidence projection | Ready | Preflight contracts | Add projection fixtures before source-owned Run decisions. |
| Skill Moment policy | Ready | Skill Moment vocabulary and policy fixture plan | Add policy/schema fixtures before dispatch or prompt preparation. |
| Skill availability behavior | Ready | Skill Moment policy fixture plan | Default mappings must be availability-gated and non-strict. |
| Decision packets | Ready | Preflight contracts | Define schema before checkpoint UX or `ask` mode behavior. |
| Memory update events | Ready | Preflight contracts | Keep hint-only authority and require reason/source refs. |
| Run-backed handoff | Ready | Preflight contracts | Handoff may carry Run state but must not bypass checkpoint resume. |
| Human surface simplification | Ready | Preflight contracts | Compact output must preserve artifact links. |
| Public Run default | Ready | This ledger and readiness report | Switch only after source-owned Run parity. |
| Goal de-emphasis | Ready, gated | This ledger and readiness report | Hide/de-emphasize only after Run completion parity and artifact compatibility. |
| Default skill mappings or skill packs | V1-deferred | Skill Moment policy fixture plan | Optional later; never a hidden core dependency. |
| Rich generic HTML checkpoint UI | V1-deferred | Preflight contracts | Preserve flow-owned HTML until decision packets prove generic projection. |
| Operator-level memory | V1-deferred | Readiness report | Start with project and flow memory first. |

## Slice Order

| Slice | State | Depends On | Scope | Proof Gate | Rollback |
| --- | --- | --- | --- | --- | --- |
| 0. Safety perimeter | Ready to start | None | Add guard tests and residue checks that do not change behavior. | Focused guard tests, `npm run check-flow-drift`. | Remove guards if they block valid current behavior. |
| 1. Run envelope schema and fixtures | Ready to start | 0 | Schema/data only for Run envelope records and fixture validation. | Run envelope fixture tests, Goal report schema tests, memory schema tests. | Delete schema and tests. |
| 2. Shadow Run envelope artifacts | Ready after 1 | 1 | Optional artifact beside current runs; no routing/output change. | CLI/router parity, checkpoint waiting still has no `result_path`. | Disable artifact writer. |
| 3. Process evidence projection | Ready after 1 | 1 | Normalized evidence projection for each public process. | Projection fixtures for every public flow, existing report tests. | Keep projections unused. |
| 3.5. Skill Moment policy | Ready after 1 | 1 | Config/step schema and pure policy fixtures; no dispatch. | Policy, availability, and provenance fixtures. | Keep existing skill slots/selection only. |
| 4. Source-owned Run decisions | Ready after 2, 3, 3.5 | 2, 3, 3.5 | Move routing, goal contract, process plan, and close/follow-up/block decision into source in parity mode. | Router parity, boundary tests, Goal false-complete tests. | Fall back to current explicit flow path. |
| 5. Follow-up loop | Ready after 4 | 4 | One bounded follow-up process for missing evidence. | Missing-evidence and false-complete regression tests. | Return needs-attention without follow-up. |
| 6. Compact human surface | Ready after 4 | 4 | Short human output with artifact links. | Host rendering tests and operator summary tests. | Keep old summary as fallback. |
| 7. Decision packets | Ready after 5, 6 | 5, 6 | Shared packet for checkpoint, missing-evidence, and Skill Moment `ask` decisions. | Decision packet fixtures and checkpoint resume tests. | Keep current flow-specific checkpoint rendering. |
| 8. Memory update events | Ready after 4, 7 | 4, 7 | Record/propose hint-only memory updates with indicators. | Memory authority tests and Run envelope validators. | Keep recall-only memory. |
| 9. Run public default | Ready after 4-8 | 4, 5, 6, 7, 8 | Make Run normal front door; direct flows become expert controls. | Generated-surface drift, host tests, installed-plugin smoke. | Restore old command visibility and regenerate. |
| 10. Goal de-emphasis | Ready, last | 9 | De-emphasize public Goal only after Run owns done discipline. | Goal-equivalent tests, old Goal artifact readability, release checks. | Re-expose Goal as expert command. |
| 11. Closeout | Reserved | All implementation slices | Residue sweep, docs reconciliation, dependency check, release proof. | `npm run verify`, release readiness checks, two clean reviews. | Reopen the owning slice. |

## Dependency Graph

```text
0 safety perimeter
  -> 1 run envelope fixtures
       -> 2 shadow artifact
       -> 3 process evidence projection
       -> 3.5 skill moment policy
2 + 3 + 3.5
  -> 4 source-owned Run decisions
       -> 5 follow-up loop
       -> 6 compact human surface
          -> 7 decision packets
       -> 8 memory update events
          -> 9 Run public default
             -> 10 Goal de-emphasis
                -> 11 closeout
```

## Ratchets And Residue Queries

These are implementation-time guardrails. Slice 0 should turn the highest-value
ones into tests or scripts before behavior changes.

| Query | Scope | Budget | Purpose |
| --- | --- | --- | --- |
| `rg -ni "\\bsupervisor\\b" src/commands src/flows plugins docs/release README.md` | Operator surfaces | 0 before public surface changes | Internal vocabulary must not leak to product surfaces. |
| `rg -n "src/runtime/executors" src/run-envelope src/cli/run-envelope tests` | Future Run envelope modules | 0 | Run envelope must not import executor internals. |
| `rg -n "reports/.*/.*\\.json" src/run-envelope src/cli/run-envelope` | Future Run envelope modules | 0 | Run envelope should consume process evidence projection, not private flow report paths. |
| `rg -n "skill_moments:.*skills|skills:.*skill_moments" src/flows tests` | Schematics and fixtures | 0 | Prevent flow-step skill binding matrices from returning as the default model. |
| `rg -n "authority:" src/schemas/memory-input.ts src/history tests/contracts/memory-input-schema.test.ts` | Memory schemas/tests | Investigate every match; only `hint_only` should be accepted | Memory must remain hint-only. |
| `rg -n "checkpoint_waiting.*result_path|result_path.*checkpoint_waiting" src tests` | Runtime/CLI checkpoint surfaces | Investigate every match | Waiting checkpoint output must not pretend it has a final result path. |

Known baseline residue:

- `src/flows/goal/data.ts` and generated plugin runtimes currently contain the
  phrase `Goal supervisor flow`. Slice 0 should either remove that source
  wording and regenerate, or define a narrower lint scope with evidence that
  the phrase is not operator-visible. The final closeout budget remains zero.

## Ship Checklist

The final V1 closeout slice must pass this checklist before the migration is
called done.

```text
npm run test -- tests/contracts/goal-report-schemas.test.ts
npm run test -- tests/contracts/memory-input-schema.test.ts
npm run test -- tests/runtime/checkpoint-resume.test.ts
npm run test -- tests/runner/cli-router.test.ts
npm run test -- tests/contracts/documentation-surface.test.ts
npm run check-flow-drift
npm run verify:fast
npm run verify
```

Closeout must also confirm:

- Run is the normal public entry.
- Direct flows are still available as expert controls or documented escape
  hatches.
- Goal-style completion discipline is inside Run.
- Old Goal run folders remain inspectable.
- Generated host surfaces come from source, not hand edits.
- Human output is compact and links to rich artifacts.
- Memory update behavior is hint-only.
- Skill Moment activation claims distinguish planned, staged, requested, and
  observed states.
- No `Supervisor` product language appears in operator surfaces.

## Checkpoint Protocol

After each major readiness or implementation cluster, append a short checkpoint
entry here or in the commit body.

Template:

```text
Checkpoint YYYY-MM-DD:
- Completed:
- Now true:
- Cross-area review:
- Verification:
- Next:
```

## Periodic Adversarial Review Schedule

| Moment | Review Focus |
| --- | --- |
| After ledger creation | Does the migration have a control plane, clear dependencies, and a closeout slice? |
| After Run envelope and evidence fixtures | Can Run reason about done without report scraping or runtime internals? |
| After Skill Moment policy | Does skill preparation stay deterministic, host-native, and honest about activation? |
| After decision packet and memory prep | Do human decisions and memory updates preserve authority boundaries? |
| Before public surface changes | Is behavior parity proven before hiding old surfaces? |
| Before closeout | Do all artifacts, generated surfaces, docs, and release checks agree? |

## Checkpoints

### Checkpoint 2026-05-28: Readiness Control Plane

- Completed: created this migration ledger as the Run-centered V1 control
  plane.
- Now true: every implementation slice has a dependency, proof gate, rollback
  path, and closeout owner.
- Cross-area review: initial dependency order keeps runtime behavior,
  generated surfaces, skill dispatch, memory writes, and public command
  visibility behind fixture or parity gates.
- Verification: local markdown links, documentation-surface test,
  `npm run lint`, and `npm run check-flow-drift` passed in the active
  readiness run.
- Next: start implementation at Slice 0; do not skip to runtime behavior,
  public command changes, or Goal de-emphasis.

### Checkpoint 2026-05-28: Preflight Contracts And Readiness Closure

- Completed: added cross-cutting preflight contracts for process evidence,
  decision packets, memory update events, Run-backed handoff, compact human
  output, public-surface compatibility, and boundary tests.
- Now true: every readiness area is either Ready, Ready with an implementation
  gate, or explicitly V1-deferred with rationale.
- Cross-area review: source-owned Run, public Run default, Goal de-emphasis,
  memory writes, Skill Moment activation, and generic checkpoint UI all remain
  behind their owning gates. Existing `Goal supervisor flow` wording is tracked
  as residue to remove or prove non-visible before public surface changes.
- Verification: local markdown links, documentation-surface test,
  `npm run lint`, and `npm run check-flow-drift` passed in the active
  readiness run.
- Next: begin Slice 0 safety perimeter with guard tests and residue checks.

## Handoff

If a session stops mid-migration, record:

- files changed;
- slices advanced;
- readiness areas changed;
- verification run;
- blockers;
- exact next command or artifact to inspect.

Do not rely on chat memory as the migration state.

## Decision

The migration is ready to start as a gated implementation program after this
readiness package is verified. It is not a single implementation task.
