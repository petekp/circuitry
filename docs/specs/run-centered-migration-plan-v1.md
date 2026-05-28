# Run-Centered Migration Plan V1

Status: migration plan, not current behavior.

Date: 2026-05-28

## Purpose

This plan describes how to move Circuit from the current flow-forward product
shape to a simpler Run-centered shape without rewriting the working runtime.

The target is:

```text
User sees Run.
Run forms a goal, chooses process attempts, stages the right process context,
checks completion, and closes honestly.
Existing flows remain the process library.
Existing runtime remains the execution engine.
Run folders remain the durable artifact layer.
Human output gets shorter.
Agent-facing artifacts stay rich: goal, context, skill moments, evidence
expectations, prior attempts, decision packets, and stop conditions are close at
hand.
```

This is a migration plan. It does not implement the Run envelope.

## Evidence Used

Current-source evidence:

- Product and repo direction:
  [CONTEXT.md](../../CONTEXT.md),
  [rewrite-refactor-initiative-v1.md](rewrite-refactor-initiative-v1.md)
- Target shape:
  [target-architecture-hypothesis-v1.md](target-architecture-hypothesis-v1.md),
  [run-centered-architecture-audit-v1.md](run-centered-architecture-audit-v1.md)
- Run envelope contract and fixture proof:
  [run-supervisor-contract-sketch-v1.md](run-supervisor-contract-sketch-v1.md),
  [run-supervisor-fixture-plan-v1.md](run-supervisor-fixture-plan-v1.md)
- Current Run entry and router:
  [src/commands/run.md](../../src/commands/run.md),
  [src/flows/router.ts](../../src/flows/router.ts),
  [src/cli/circuit.ts](../../src/cli/circuit.ts)
- Current flow package model:
  [src/flows/README.md](../../src/flows/README.md),
  [src/flows/catalog.ts](../../src/flows/catalog.ts),
  [docs/generated-surfaces.md](../generated-surfaces.md)
- Runtime and contracts:
  [src/runtime/README.md](../../src/runtime/README.md),
  [src/schemas/README.md](../../src/schemas/README.md),
  [docs/contracts/run.md](../contracts/run.md)
- Skill selection and continuity:
  [docs/contracts/compiled-flow.md](../contracts/compiled-flow.md),
  [docs/contracts/step.md](../contracts/step.md),
  [docs/contracts/continuity.md](../contracts/continuity.md),
  [src/shared/selection-resolver.ts](../../src/shared/selection-resolver.ts),
  [src/schemas/skill.ts](../../src/schemas/skill.ts),
  [src/commands/handoff.md](../../src/commands/handoff.md)
- Goal completion discipline:
  [src/flows/goal/reports.ts](../../src/flows/goal/reports.ts),
  [tests/contracts/goal-report-schemas.test.ts](../../tests/contracts/goal-report-schemas.test.ts),
  [tests/runner/goal-flow.test.ts](../../tests/runner/goal-flow.test.ts)
- Checkpoints and memory:
  [src/runtime/executors/checkpoint.ts](../../src/runtime/executors/checkpoint.ts),
  [src/runtime/run/graph-runner.ts](../../src/runtime/run/graph-runner.ts),
  [src/schemas/memory-input.ts](../../src/schemas/memory-input.ts),
  [tests/contracts/memory-input-schema.test.ts](../../tests/contracts/memory-input-schema.test.ts)

Local probes:

```bash
git status --short
rg -n "classifyCompiledFlowTask|prepareRunStartHistoryRecall|executeExecutableFlow|operatorSummary|historyRecall|progressSurface|result_path|checkpoint_waiting|selected_flow|flowId" src/cli/circuit.ts
rg -n "GoalContract|GoalEvidenceEvaluation|GoalGate|GoalResult|selected_flow_target|required_passes|clean_streak|missing-evidence|complete requires" src/flows/goal tests/contracts/goal-report-schemas.test.ts tests/runner/goal-flow.test.ts
rg -n "MemoryInputV0|authority|hint_only|route|checkpoint|proof|policy|safe_apply" src/schemas/memory-input.ts tests/contracts/memory-input-schema.test.ts src/history src/shared/relay-support.ts
rg -n "GraphCheckpointWaitingResult|checkpoint_waiting|checkpoint.requested|checkpoint.resolved|request_path|allowed_choices|resultPath" src/runtime/run/graph-runner.ts src/runtime/executors/checkpoint.ts src/cli/circuit.ts tests/runtime/checkpoint-resume.test.ts tests/runner/cli-router.test.ts
rg -n "skill_slots|SelectionOverride|ResolvedSelection|skills.loaded|handoff|continuity|run-backed" src docs -g '*.ts' -g '*.md'
```

## Migration Principle

Migrate in this order:

```text
contract -> fixture -> shadow artifact -> source-owned Run envelope -> default Run
-> thinner human surface -> expert-only direct flows -> deprecate public Goal
```

Do not start by hiding commands or renaming Goal. That would simplify the
surface before the architecture can support the promise.

Every phase should be either:

- additive and dark-launched;
- a source-owned behavior switch guarded by tests; or
- a visibility change over behavior already proved elsewhere.

## Target State

| Area | Target State |
| --- | --- |
| Product entry | `Run` is the normal command. Direct flows remain expert controls unless demand proves they should be removed. |
| Run envelope | Source-owned product loop above runtime calls. It owns intake, clarify decision, goal contract, process plan, process attempts, completion gate, memory update event, and short surface output. The current schema sketch may still use `Supervisor` internally. The V1 internal sub-structure is intentionally undecided; later slices may split intake, policy, and completion gate seams if the envelope gets hard to reason about. |
| Goal | Internal done-checking discipline and reusable contract/gate semantics, not a prominent product peer. From the operator's seat, Goal is not a kind of work; it is the standard Run uses for done. |
| Flows | Process packages behind Run: Build, Fix, Review, Explore, Prototype, Pursue, and any future authored flows. |
| Router | Process-selection helper inside Run, not the product front door. |
| Skill moments and policy | Run prepares skill context by publishing named work moments and applying project policy. Flows may declare moments; Run may detect moments from the work. Policy maps moments to host-native skills. Skill slots remain a lower-level compatibility or power-user mechanism, not the default product model. |
| Runtime | Executes one compiled process run at a time. It does not own the operator's whole Run lifecycle. |
| Run folders | Continue to store trace, reports, evidence, checkpoints, result files, and future Run envelope artifacts. |
| Checkpoints | Runtime keeps pause/resume mechanics. Product-level decision packets decide when a rich human surface is valuable. |
| Continuity | Run is the active work unit. Handoff is the cross-session carrier that saves or resumes Run state, including run-backed continuity when a run folder anchors the work. |
| Memory | Hint-only recall first, update events with reasons later. Memory never proves completion or grants route/checkpoint/policy authority. |
| Human output | Short status and next action. Rich proof remains linkable and agent-facing. |
| Generated surfaces | Still source-generated and drift-checked. Visibility changes happen through source and emitter rules, not hand edits. |

## Agent And Operator Balance

The migration should prepare two stations at once.

For the operator, Run removes steering tax: the user should not need to choose a
flow, decide whether Goal is appropriate, hand-invoke a skill, bind skill slots,
or inspect a proof bundle unless something needs attention.

For the agent, Run creates a prepared workspace: goal, relevant history,
process choice, evidence expectations, skill moments, planned skill context,
prior attempts, decision packets, and stop conditions should be available when
the agent needs them.

If a phase only reorganizes internals and does not improve either operator
simplicity or agent readiness, it needs a stronger reason before it lands.

## Internal Vocabulary Discipline

`Supervisor` is an internal source/spec word. It must not appear in operator
docs, CLI output, generated host surfaces, release notes, taglines, or product
messaging. User-facing language is `Run`.

For prose inside specs and implementation notes, prefer `Run envelope` when
describing the artifact or coordination boundary. The schema can still be named
`RunSupervisorRecord` until a rename clearly pays for itself.

## Run And Handoff

Run is the unit of active work. Handoff is the continuity mechanism that carries
unfinished work across sessions.

That means a handoff record should point back to the current Run state when it
can, not introduce another product model. Standalone handoff remains useful for
plain conversation continuity. Run-backed handoff is the important path for this
migration: it preserves the goal, next action, current stage/step snapshot, and
run folder anchor without bypassing checkpoint resume validation.

## Skill Moments

Skill slots tried to solve a real problem on the wrong axis. The operator wants
specific skills at specific kinds of work, not a binding matrix across every
flow and step.

Use moments as the product model:

```text
work context -> named moments -> project policy -> host-native skills
```

A moment is a recognizable condition where extra judgment is useful, such as
`before:high-impact-alignment`, `before:architecture-analysis`, or
`after:react-ui-change`.

Moment sources:

- Flow-authored moments: a step declares the work moment it intentionally
  creates.
- Run-detected moments: Run observes declared goal contract fields, selected
  process, files touched, evidence gaps, and explicit risk signals.
- Project policy: the operator maps moments to preferred skills, modes, and
  mutes.
- Skill metadata later: skills may optionally advertise moments they subscribe
  to, but this is not required for the first design.

Run may infer moments. It should not infer specific skills from a large pile of
skill descriptions. Final skill matching should be explainable:

```text
after:react-ui-change -> project policy -> react-doctor
```

Run-detected moments must be derivable from observable state: file paths, diffs,
declared goal contract fields, evidence maps, selected process, step metadata,
or explicit operator input. If a moment depends on natural-language judgment
about risk or importance, use an `ask` policy or make the signal explicit before
treating it as deterministic.

Project policy should live in the existing config layers:
`~/.config/circuit/config.yaml` for personal defaults and
`./.circuit/config.yaml` for project overrides. Do not introduce a separate
skill-policy file unless the existing config surface becomes clearly wrong.

Policy modes are deliberately small:

| Mode | Meaning |
| --- | --- |
| `auto` | Prepare or request the mapped skill without asking first. |
| `ask` | Surface a decision packet before preparing or requesting the skill. |
| `mute` | Suppress the mapped skill for this moment in this policy scope. |

The Run record should distinguish planned, staged, requested, observed, and
unplanned skill activity. Circuit may record actual skill execution only when
the host provides reliable evidence. Otherwise it records the moments and skill
requests it prepared.

| State | Meaning |
| --- | --- |
| `planned` | Moment policy matched a skill before the step ran. |
| `staged` | Circuit put the moment or skill request into the step context. |
| `requested` | Circuit explicitly asked the host or connector to consider a skill. |
| `observed` | The host or relay produced reliable evidence that the skill actually ran. |
| `unplanned` | A skill appears to have run without Circuit planning or requesting it. |

Unplanned activity should be logged neutrally. When useful, Run can suggest a
policy update or mute, but it must not silently rewrite policy or turn a
one-off host choice into a standing rule.

## Keep, Move, Collapse, Delete, Defer

| Current Part | Disposition | Reason | First Proof |
| --- | --- | --- | --- |
| FlowData and compiled packages | Keep | This is the repeatable process library Run needs. | Existing catalog and generated-surface checks stay green. |
| Runtime graph runner and executors | Keep | The runtime is good execution machinery. | Run envelope tests do not import executors or walk steps. |
| Run folders, traces, reports, results | Keep | They are the durable artifact substrate for agents, resume, memory, and proof. | Run envelope records reference child runs without changing child trace files. |
| Generated host packages | Keep | They are shipping surfaces and protect host parity. | `npm run check-flow-drift` remains required after surface changes. |
| Current Run host prompt logic | Move | Product logic belongs in source, not host instruction text. | Source-owned Run envelope can make the same first routing decision in shadow mode. |
| Router | Move | It becomes a helper for process selection. | Run envelope records `selection_source = "router"` for simple one-process cases. |
| Goal contract and gate semantics | Move | Goal's contract, evidence, recovery, and two-pass gate are the right done discipline. | `RunSupervisorRecord` fixtures reject false complete with the same protections. |
| Skill slots and selection | Reframe | The right expertise should be part of Run preparation, but the default product model should be moment-triggered policy rather than flow-step slot binding. | Moment fixtures show deterministic moment-to-skill planning, while worker-side activation is verified before product claims mention it. |
| Handoff and continuity | Clarify | Handoff should be the carrier for unfinished Run state across sessions, not a parallel product concept. | Run-backed continuity points to the active run folder and preserves explicit resume posture. |
| Goal as public flow peer | Collapse later | The concept is useful internally but competes with Run as product language. | Run supports Goal-shaped completion before Goal is hidden or renamed. |
| Flow-specific final report scraping in Run command text | Collapse | Run should consume normalized process output, not each private report shape. | Each public process exposes or maps to a small process evidence projection. |
| Verbose default operator summaries | Collapse | Human output should be short; artifacts stay rich. | Host rendering tests prove compact output still links to artifacts. |
| Routine user-facing flow taxonomy | Delete later | It is steering load from an older product model. | Run usage and expert-command escape hatches are proven before removal. |
| Memory as possible authority | Delete as an option | It would make behavior opaque and unsafe. | Memory schema and Run envelope validators reject route/proof/checkpoint/policy authority. |
| Generic checkpoint as product UX | Defer | Runtime checkpoint is real; rich decision UX is still exploratory. | Decision packets can represent current checkpoint cases before HTML is generalized. |

## Phased Plan

### Phase 0: Freeze The Safety Perimeter

Goal: name what must not regress before migration starts.

Work:

- Create a small migration ledger or checklist tied to this plan.
- Record the active invariants: runtime does execution, flows define process
  behavior, generated outputs are source-owned, memory is hint-only, and
  checkpoint resume stays runtime-owned.
- Pick the first focused proof commands for each boundary.

Validation gate:

- `npm run test -- tests/contracts/goal-report-schemas.test.ts`
- `npm run test -- tests/contracts/memory-input-schema.test.ts`
- `npm run test -- tests/runtime/checkpoint-resume.test.ts`
- `npm run check-flow-drift`

Rollback point:

- No runtime or source behavior has changed. Delete or revise the ledger.

### Phase 1: Land The Run Envelope Contract As Data Only

Goal: make the Run envelope shape real without executing anything.

Work:

- Add a `RunSupervisorRecord` schema or equivalent contract module.
- Add pure fixtures for complete, missing-evidence follow-up,
  checkpoint-needed, and blocked outcomes.
- Add negative fixtures for false complete, missing evidence with no follow-up,
  memory authority, bad checkpoint resume targets, and ad hoc evidence refs.
- Keep the validator independent of runtime executors, CLI entrypoints, and
  generated host packages.

Validation gate:

- Focused Run envelope fixture test.
- Goal schema tests for completion discipline.
- Memory input schema tests.
- Future import-boundary assertion is specified: once Run envelope code exists,
  it must not import `src/runtime/executors/*`.
- No generated-surface changes.

Rollback point:

- Remove the schema and tests. No behavior changed.

### Phase 2: Add Shadow Run Envelope Artifacts Beside Current Runs

Goal: prove Run can observe existing process runs without becoming a second
runtime.

Work:

- In the current CLI `run` path, write an optional Run envelope artifact after a
  normal one-process run closes or waits at a checkpoint.
- The artifact should point to the existing child run folder and result path.
- It should not change routing, runtime calls, checkpoint resume, or final
  output.
- The first supported path should be one process selected by today's router.

Validation gate:

- CLI router tests still pass.
- A focused test proves the shadow artifact matches stdout JSON and
  `RunResult`.
- Checkpoint-waiting output still has no `result_path`.
- `npm run check-flow-drift` stays clean.

Rollback point:

- Disable or remove the artifact writer. Current behavior remains intact.

### Phase 3: Normalize Process Evidence

Goal: stop Run from knowing private report layouts.

Work:

- Define a small process evidence projection:
  outcome, evidence refs, missing refs, checkpoint summary, blocked reason, and
  next useful action.
- Implement mapping from each public flow's existing final result to that
  projection.
- Keep flow-specific reports as source truth for now.
- Avoid reading child trace internals as proof.

Validation gate:

- Contract tests for every public process projection.
- Existing flow result schema tests still pass.
- Operator summary tests still pass.

Rollback point:

- Keep projections unused and keep current flow-specific summary behavior.

### Phase 3.5: Define Skill Moments And Policy

Goal: replace slot-shaped skill planning with a small moment-triggered policy
model before Run behavior moves into source.

Work:

- Define a small initial moment vocabulary, probably 10-15 moments, with plain
  meanings and detection rules.
- Sketch the step-level authored field for flow-declared moments.
- Sketch project policy for moment-to-skill mappings, modes, and coarse mutes
  inside the existing user-global and project config layers.
- Define Run record provenance for planned, staged, requested, observed, and
  unplanned skill activity.
- Keep skill matching deterministic. Run may infer moments, but final skill
  selection comes from explicit policy or declared metadata.
- Keep existing skill slots as compatibility or power-user substrate, not the
  default operator model.

Validation gate:

- Moment vocabulary fixtures cover the known examples:
  `before:high-impact-alignment`, `before:architecture-analysis`, and
  `after:react-ui-change`.
- Policy matching fixtures prove the same moment can trigger the same skill
  across different flows.
- Negative fixtures reject schematic shapes that hardcode skill-to-step
  bindings as the default product path.
- Activation provenance fixtures reject `observed` without host or relay proof.

Rollback point:

- Keep host auto-discovery and existing slot/selection modeling. Do not expose
  moment policy until the vocabulary and provenance model are clear.

### Phase 4: Move Run Decisions Into Source

Goal: make `Run` source-owned rather than host-prompt-owned.

Work:

- Add a Run envelope module that performs intake, memory recall use,
  conditional clarify decision, goal contract creation, initial process
  selection, runtime call, evidence evaluation, and close/follow-up/block
  decision.
- Start with one-process cases before multi-process follow-up loops.
- Add skill-moment planning for the process attempt. Flow steps may emit named
  moments, Run may detect moments from work context, and project policy maps
  those moments to host-native skills.
- Keep existing `skill_slots` and `SelectionOverride.skills` as lower-level
  compatibility or power-user mechanisms. Do not make slot binding the default
  operator experience.
- The CLI remains the invocation shell; it should not absorb Run policy.
- Host commands invoke Run rather than deciding the flow themselves.

Validation gate:

- Router behavior parity test for simple tasks.
- Source-owned Run test that records `selection_source` and process attempt.
- Skill-moment fixture proves Run records which moments fired, which skills were
  planned or requested, and whether activation was observed. Do not claim
  worker-side activation unless the relay or host path proves it.
- Goal false-complete tests remain green.
- Runtime boundary tests show the Run envelope does not import or duplicate executor
  internals, including an import-boundary test against `src/runtime/executors/*`.

Rollback point:

- Host command can route to the old explicit flow path while the Run envelope
  remains dark.

### Phase 5: Add Follow-Up Loop Under A Hard Budget

Goal: let Run continue when evidence is missing without turning into Pursue or
a general workflow engine.

Work:

- Allow one planned follow-up process after missing evidence.
- Require every follow-up to cite the missing claim and prior attempt id.
- Keep the first version serial.
- Stop honestly when budget is exhausted or proof remains missing.

Validation gate:

- Missing-evidence fixture maps to a real follow-up process plan.
- A false-complete regression test proves a child `complete` cannot close Run
  when required evidence is missing.
- Blocked output includes next needed input or reason.

Rollback point:

- Disable follow-up planning and return `needs_attention` with the artifact.

### Phase 6: Separate Human Surface From Agent Artifacts

Goal: make output shorter without losing evidence.

Work:

- Add a `RunSurfaceOutput` projection over the Run envelope record.
- Keep links to the Run envelope record, child result, operator summary, and evidence.
- Stop making the default human answer read like a proof bundle.
- Keep detailed artifacts for agents and future memory.

Validation gate:

- Host rendering contract tests verify short final output plus artifact links.
- Existing operator summary tests prove old artifacts still exist.
- Manual smoke of one complete run and one checkpoint-waiting run.

Rollback point:

- Keep old operator summary rendering as fallback.

### Phase 7: Turn Checkpoints Into Decision Packets

Goal: preserve runtime pause/resume while making product checkpoints clearer.

Work:

- Define a Run decision packet that can reference either a child process
  checkpoint or a Run-level decision.
- Keep runtime `checkpoint.requested` and `checkpoint.resolved` trace ownership
  unchanged.
- Only generate rich HTML for decision packets that actually benefit from it:
  UI previews, variants, or hard human judgment.

Validation gate:

- Existing checkpoint resume tests pass.
- Decision packet fixtures reject resume targets without a matching waiting
  attempt.
- HTML projector tests stay flow-owned until a generic packet renderer proves
  itself.

Rollback point:

- Continue rendering current checkpoint surfaces directly from flow-specific
  checkpoint artifacts.

### Phase 8: Add Memory Update Events, Still Hint-Only

Goal: let Run record useful learning without making memory magic.

Work:

- Add memory update events to Run envelope records.
- Include scope, reason, source refs, summary, effect, and user-visible
  indicator.
- Start with project and flow-level execution hints.
- Do not allow memory to select routes, prove current done claims, authorize
  checkpoints, or override recovery.

Validation gate:

- Memory schema tests reject authority smuggling.
- Run envelope validator rejects memory update events with proof/route/checkpoint
  authority.
- Human output shows only a succinct memory indicator.

Rollback point:

- Keep recall-only memory and mark updates as proposed/skipped.

### Phase 9: Make Run The Public Default

Goal: simplify the product surface after the architecture supports it.

Work:

- Rewrite Run command source around source-owned Run envelope behavior.
- Update operator docs so direct flows are expert controls.
- Change generated command/skill visibility only through source metadata and
  emitter rules.
- Keep compatibility paths for explicit flow invocation.

Validation gate:

- `npm run emit-flows`
- `npm run check-flow-drift`
- Host command/skill contract tests.
- Installed-plugin smoke before broad release.

Rollback point:

- Restore old command surfaces from source and regenerate.

### Phase 10: Internalize Goal As A Product Concept

Goal: remove the duplicate public concept only after Run owns done-ness.

Work:

- Keep Goal schemas, reports, and tests as internal completion primitives or
  migrate them into Run-owned contracts.
- Hide or de-emphasize public Goal command after compatibility period.
- Do not delete serialized `goal.*` report support until old run folders and
  release proofs no longer need it.

Validation gate:

- Existing Goal proof tests either still pass or have explicit Run-equivalent
  replacements.
- Old Goal run folders remain inspectable.
- Generated surface drift and release checks pass.

Rollback point:

- Re-expose Goal as expert command if Run completion behavior regresses.

## Phase Effects For Operator And Agent

| Phase | Operator-visible delta | Agent has at hand |
| --- | --- | --- |
| Phase 0 | None, intentionally. This is a safety freeze. | Migration invariants, boundary checks, and proof commands. |
| Phase 1 | None, intentionally. The contract is data only. | A typed Run envelope shape for goal, attempts, evidence, decisions, memory events, and stop conditions. |
| Phase 2 | None by default. Shadow artifacts are internal or opt-in. | A durable Run-level artifact beside the child run folder and result path. |
| Phase 3 | None unless debugging. Existing reports remain. | Normalized process evidence instead of private flow report scraping. |
| Phase 3.5 | None by default. Skill behavior remains compatible while the policy model is proved. | A small moment vocabulary, explicit moment-to-skill policy, and provenance states for skill activity. |
| Phase 4 | Run decisions become source-owned but should feel behaviorally the same at first. | Goal contract, selected process, memory hints, emitted/detected skill moments, planned skill requests, evidence expectations, and close/follow-up/block decision in one envelope. |
| Phase 5 | Fewer false stops when evidence is missing; failures still state the next needed action. | Prior attempt id, missing claim, follow-up budget, and stop condition. |
| Phase 6 | Shorter final output with links when details matter. | Rich artifacts remain available for later agents and memory without becoming default human prose. |
| Phase 7 | Rare high-value decision points become clearer and more digestible. | Decision packet with resume target, available choices, and relevant child process state. |
| Phase 8 | Succinct memory update indicator when Circuit records a useful hint. | Hint-only memory update event with reason and source refs. |
| Phase 9 | Run becomes the normal front door; direct flows are lightly visible expert controls. | Default entry has the same prepared goal/process/evidence envelope without the operator picking a flow. |
| Phase 10 | Goal fades as a separate public concept. | Goal-style completion discipline remains inside Run as the done standard. |

## What The Agent Has At Hand

| Prepared Item | First Phase | Why It Matters | Guardrail |
| --- | --- | --- | --- |
| Goal contract | Phase 1 | Gives the agent a clear done target instead of loose chat intent. | Complete requires proved claims and clean gate passes. |
| Process plan | Phase 1, used in Phase 4 | Names the chosen process and why. | Router remains a helper; Run does not become a workflow language. |
| Evidence expectations | Phase 1, normalized in Phase 3 | Lets the agent know what proof must exist before closing. | No child `complete` can close Run when required evidence is missing. |
| Memory hints | Phase 4, expanded in Phase 8 | Brings useful prior context into reach. | Memory remains hint-only and cannot prove, route, or authorize. |
| Skill moments and policy | Phase 3.5, used in Phase 4 | Makes the right expertise part of preparation without asking the operator to bind slots per flow step. | Run may infer moments, not specific skills; skill matching comes from explicit policy or metadata, and activation claims require proof. |
| Prior attempt state | Phase 5 | Supports follow-up without forgetting what already happened. | Follow-up cites missing claim and prior attempt id, under a hard budget. |
| Decision packet | Phase 7 | Gives the agent and operator a shared decision object. | Runtime still owns checkpoint trace and resume validation. |
| Handoff continuity | Existing, clarified before Phase 1 | Carries unfinished work across sessions. | Handoff is a carrier for Run state, not a second product model or bypass. |
| Stop condition | Phase 1, enforced in Phase 5 | Prevents endless looping and false done. | Budget exhaustion closes as blocked, handoff, or needs attention, not complete. |

## Dependency Order

| Must Come First | Before This | Why |
| --- | --- | --- |
| Run envelope fixtures | Shadow artifact writer | The shape must be testable before it appears in real runs. |
| Shadow artifact writer | Source-owned Run decisions | We need parity evidence before changing behavior. |
| Process evidence projection | Follow-up loop | Run needs normalized child evidence before planning follow-ups. |
| Moment vocabulary and policy shape | Skill moment claims | Run should not promise agent preparation beyond explicit moment-policy matching and observed host behavior. |
| Moment vocabulary and policy shape | Source-owned skill planning | Run needs deterministic skill policy before it prepares skills automatically. |
| Completion gate parity | Public Run default | Run cannot become the product until false complete is protected. |
| Decision packet contract | Generic HTML checkpoint rendering | Rich UI should project structured decisions, not arbitrary flow state. |
| Memory update event contract | Automatic memory updates | Update behavior needs authority rules before it becomes automatic. |
| Run-backed continuity relation | Cross-session Run messaging | Handoff needs to be explained as the carrier for Run state before the surface is simplified. |
| Source-owned Run decisions | Hiding direct flows | Surface simplification is safe only after Run can carry the work. |
| Run completion parity | Goal de-emphasis | Goal should not disappear before Run has its useful discipline. |

## Compatibility Risks

| Risk | Why It Matters | Guardrail |
| --- | --- | --- |
| Run envelope becomes a second runtime | Duplicates graph walking, checkpoint resume, and close semantics. | Run may call runtime and read results; it must not execute steps, import executor internals, or append child trace entries. |
| Internal `Supervisor` language leaks into product | It makes Run sound like a babysitter or correction layer. | Treat `Supervisor` as source/spec vocabulary only; operator surfaces say `Run`. |
| Generated surfaces drift | Host packages are committed outputs. | All command/visibility changes go through source and `check-flow-drift`. |
| Old run folders become unreadable | Run folders are durable artifacts and release proof evidence. | New Run envelope artifacts are additive; old `RunResult`, traces, and reports remain valid. |
| Flow-specific reports leak upward | Run becomes tangled with every process package. | Require normalized process evidence projection before follow-up behavior. |
| Skill moment policy overclaims | Users may believe Circuit caused worker-side skill use when it only planned a skill request. | Separate planned, staged, requested, observed, and unplanned skill activity. Keep built-in public flows portable. |
| Memory gains hidden authority | Automatic memory could silently steer or falsely prove work. | Keep `authority: "hint_only"` and reject route/proof/checkpoint/policy authority. |
| Checkpoint resume breaks | Human decisions need durable pause/resume. | Runtime keeps checkpoint trace and resume validation ownership. |
| Handoff becomes a second product model | Cross-session continuity would add a new concept beside Run. | Explain handoff as the carrier for unfinished Run state; run-backed continuity points to the active run folder. |
| Direct flow users lose power tools | Expert paths help debugging and explicit control. | Keep direct flows as expert controls through at least the first Run-default release. |
| Human output gets too thin for failures | Users still need to recover when things go wrong. | Short output must include next action and artifact links. |

## Growth Ceiling

Run exists to make the product feel like one clear concept. It should coordinate
process attempts, not become a public workflow language.

Hard ceiling:

- No low-level graph walking.
- No checkpoint resume validation.
- No connector subprocess execution.
- No Run-owned parallel branch engine; use existing runtime fanout only through
  flows.
- No nested Run envelopes.
- No Circuit-owned replacement for host-native skill roots.
- No flow-step skill binding matrix as the default operator experience.
- No fuzzy Run-owned skill matching over every installed skill description.
- No new product-visible branching concepts unless they belong in a flow or a
  separate authored process.

If the Run envelope needs these powers to succeed, the design is drifting back
toward a more complex product, and the migration should stop for review.

## Validation Ladder

Use focused proof first, then broad proof before release.

| Change Area | Focused Proof |
| --- | --- |
| Run envelope record schema | `tests/contracts/run-supervisor-record-fixtures.test.ts` |
| Goal/complete behavior | `tests/contracts/goal-report-schemas.test.ts`, `tests/runner/goal-flow.test.ts` |
| Router and CLI output | `tests/runner/cli-router.test.ts` focused cases |
| Runtime/checkpoint safety | `tests/runtime/checkpoint-resume.test.ts`, checkpoint output cases in CLI router tests |
| Memory authority | `tests/contracts/memory-input-schema.test.ts` plus Run envelope negative fixtures |
| Skill moments | moment vocabulary fixtures, policy matching fixtures, and relay/host proof before claiming worker activation |
| Continuity relation | `tests/contracts/continuity-schema.test.ts` and handoff CLI tests for run-backed records |
| Run/runtime boundary | import-boundary test proving Run envelope code does not reach `src/runtime/executors/*` |
| Vocabulary discipline | grep-style lint such as `tests/lint/no-supervisor-in-surfaces.test.ts` proving internal `Supervisor` language does not appear in operator docs, CLI output, generated host surfaces, release notes, taglines, or product messaging |
| Generated host surfaces | `npm run check-flow-drift` |
| Host rendering | Host rendering contract tests and installed-plugin smoke |
| Release readiness | `npm run check-release-ready` and release infrastructure tests when public claims move |
| Final broad gate | `npm run verify` before claiming implementation slices are done |

For this planning artifact, focused verification is docs/link/lint/drift only.
Implementation phases should use the larger gates above.

## First Three Implementation Slices

### Slice 1: Contract And Fixtures

Add the pure `RunSupervisorRecord` contract and fixture tests. Do not touch the
CLI, runtime, generated packages, or host command text.

Done when fixture tests prove complete, follow-up, checkpoint-needed, blocked,
and the required negative cases.

### Slice 2: Shadow Artifact

Write a Run envelope record after one existing `Run` execution path, behind an
opt-in or internal flag. It should reference the current child run result and
operator summary without changing output.

Done when current CLI output and run folder behavior are unchanged, and the
shadow record validates.

### Slice 3: Process Evidence Projection

Add one normalized evidence projection for the easiest public process, then
expand to the rest. This is the bridge from "Run scrapes flow reports" to "Run
consumes process evidence."

Done when each covered flow can produce the small projection from current final
reports, with no private trace scraping.

### Immediate Follow-On: Skill Moment Policy

Define the first moment vocabulary and policy fixtures before moving Run
decisions into source. This keeps automatic skill preparation deterministic
instead of slot-shaped or fuzzy.

Done when the known examples map cleanly:
`before:high-impact-alignment` to alignment skills,
`before:architecture-analysis` to architecture-analysis skills, and
`after:react-ui-change` to React review skills, with no activation claim unless
the host proves it.

## What Not To Do First

- Do not rename Goal to Run.
- Do not hide or delete direct flow commands.
- Do not rewrite the runtime kernel.
- Do not make memory choose routes or prove claims.
- Do not treat planned or requested skills as proof that a worker used those
  skills.
- Do not create a Circuit-owned skill store to replace host-native skill roots.
- Do not reintroduce a flow-step skill binding matrix under a new name.
- Do not generalize HTML checkpoints before decision packets exist.
- Do not make the CLI file the long-term home of Run policy.
- Do not hand-edit generated command or skill files.
- Do not add product-visible workflow concepts to Run just because the internal
  envelope could represent them.

## Review Questions Before Each Slice

1. Does this reduce user-facing concept count or prepare the agent's workspace
   in a way that matters?
2. Does it preserve runtime ownership of execution and checkpoint resume?
3. Does it preserve generated-surface ownership?
4. Does it keep old run folders valid?
5. Does it keep memory hint-only?
6. Does it use moment-triggered skill policy honestly, without overclaiming
   activation?
7. Does it keep handoff as continuity for Run, not a separate product model?
8. Does it make human output shorter without hiding recovery information?
9. Is there a clear rollback path?

## Decision

Proceed with the Run-centered migration as an additive, contract-first program.

The simplest path is not a rewrite. It is a controlled layering change:

```text
current Run/router/Goal/flows/runtime
  -> Run envelope contract
  -> shadow Run envelope records
  -> normalized process evidence
  -> source-owned Run decisions
  -> Run as public default
  -> Goal/direct flows de-emphasized only after parity
```

This sequence gives the product the simpler model without discarding the tested
runtime, flow packages, generated surfaces, run folders, checkpoints, and memory
authority rules that already work.
