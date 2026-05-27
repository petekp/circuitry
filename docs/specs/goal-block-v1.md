# Goal Block V1 Implementation Spec

Status: implementation spec, not current behavior.

Date: 2026-05-20

## Summary

Goal V1 should make Circuit, not Claude Code or Codex `/goal`, the source of
truth for long-running objective state.

The best V1 shape is a hybrid:

1. Add a reusable **Goal** block that writes a typed `goal.contract@v1` report.
2. Add a public **Goal flow** that acts as a supervisor path around existing
   Circuit flows.
3. Add an adversarial completion gate that blocks close until two consecutive
   gate reviews find no medium, high, or critical findings.

Native host `/goal` may remain an optional convenience for keeping a host
session active, but it must not own Circuit's goal state, completion decision,
proof standard, recovery policy, or final close.

## Source-Backed Boundaries

### Host `/goal` Baseline

Checked against the official host docs on 2026-05-20:

- [OpenAI Codex Goals](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex)
- [Claude Code `/goal`](https://code.claude.com/docs/en/goal)

Codex Goals are thread-scoped persistent objectives with a completion condition,
verification surface, lifecycle controls, continuation policy, budget handling,
and evidence-based completion. The official Codex cookbook describes Goals as
durable thread state that keeps a target visible, checks evidence, and continues
only at safe idle boundaries.

Claude Code `/goal` is a session-scoped completion condition. The official
Claude Code docs describe it as a wrapper around a prompt-based Stop hook: after
each turn, a small model judges the goal against the conversation so far. The
docs also state that the evaluator does not call tools and can only judge what
Claude surfaced in the transcript.

Circuit V1 should learn from both host designs but not copy their authority
model. Circuit's advantage is that it can close from typed run reports, checks,
and evidence, rather than from host conversation state alone.

### Circuit Repo Boundaries

Circuit already has the pieces this design should use:

- Blocks have structured inputs, typed outputs, checks, and routes. Prompts are
  a connector-boundary delivery format, not the source of truth. See
  [docs/flows/blocks.md](../flows/blocks.md).
- Flow authoring separates block definitions, flow-specific steps, report
  schemas, and route policy. Later steps consume named facts, not arbitrary
  prose. See [docs/flows/authoring-model.md](../flows/authoring-model.md).
- Pursue already demonstrates rough-goal ownership through contracts,
  coordination, verification, review, and close evidence. See
  [docs/flows/pursue.md](../flows/pursue.md).
- Hosts start Circuit, render progress, map task/user-input surfaces, and read
  final JSON and report files. Hosts must not treat progress as the canonical
  outcome. See [docs/contracts/host-adapter.md](../contracts/host-adapter.md)
  and [docs/contracts/host-rendering.md](../contracts/host-rendering.md).
- Checkpoints are step-level pauses with request/response files, trace evidence,
  and validated resume. See `src/runtime/executors/checkpoint.ts`.
- Sub-run V1 uses registered `flow_ref` values. Inline child flow definitions
  are out of scope. See `src/schemas/step.ts`.
- Cross-run query and recall are still a gap, not current behavior. Goal V1 must
  stay within the current run folder plus checkpoint and handoff surfaces.

## V1 Product Contract

Goal V1 should answer five operator questions:

1. What exactly is Circuit trying to make true?
2. What evidence would prove it?
3. What has Circuit already tried?
4. If it is not done, what typed recovery route comes next?
5. Why is the final answer safe to trust?

The operator-facing promise is:

> Circuit will keep a scoped goal moving through known flows until typed evidence
> proves the goal, a checkpoint needs operator judgment, or a blocked/failed
> result is more honest than continuing.

This is intentionally not:

- background autonomy;
- a project-level goal ledger;
- arbitrary dynamic child-flow loading;
- an adapter around Claude Code or Codex `/goal`;
- a replacement for every existing flow.

## V1 Flow Shape

Add a public `goal` flow package under `src/flows/goal/`.

The flow shape should be:

```text
Intake
  -> Route
  -> Goal Contract
  -> Supervisor Dispatch
  -> Static Child Flow Segment
  -> Evidence Evaluation
  -> Recovery, Checkpoint, Gate, or Handoff
  -> Adversarial Completion Gate
  -> Close With Evidence
```

The supervisor path may route to known child-flow steps, but V1 must keep those
targets static in the authored schematic:

- `fix`
- `build`
- `review`
- `explore`
- `pursue`

The Goal flow can select among these paths at runtime by routing to one of the
predeclared steps. It must not accept arbitrary flow ids from model prose.

## Source Of Truth

Goal V1 source of truth is the run folder.

Authoritative state comes from:

- `reports/goal/contract.json`
- `reports/goal/attempts/*.json`
- `reports/goal/evidence-evaluation.json`
- `reports/goal/recovery.json`
- `reports/goal/gate.json`
- `reports/goal-result.json`
- child-flow `result.json` files copied or linked into the parent run folder
- the parent run trace

Host transcript text, native host `/goal` state, and progress lines are not
authoritative. They are presentation surfaces.

## Goal Block Contract

Add a reusable block definition:

```ts
{
  id: 'goal',
  title: 'Goal',
  purpose: 'Turn a user objective into a bounded goal contract with proof, recovery, and completion-gate policy.',
  input_contracts: ['task.intake@v1', 'route.decision@v1'],
  alternative_input_contracts: [['task.intake@v1']],
  output_contract: 'goal.contract@v1',
  action_surface: 'orchestrator',
  produces_evidence: [
    'goal contract',
    'done claims',
    'proof requirements',
    'allowed flow targets',
    'recovery routes',
    'completion gate policy'
  ],
  check: {
    kind: 'schema',
    description:
      'The goal contract must preserve the operator objective, declare proof requirements, constrain flow targets, and name recovery and close rules.'
  },
  allowed_routes: ['continue', 'ask', 'stop'],
  human_interaction: 'optional',
  schematicPolicy: {
    executionKinds: ['compose', 'checkpoint', 'sub-run'],
    stages: ['frame']
  }
}
```

The block writes the contract. The supervisor flow enforces the contract.

## Typed Reports

### `goal.contract@v1`

```ts
type GoalContract = {
  schema: 'goal.contract@v1';
  objective: string;
  source_of_truth: 'circuit-run-folder';
  scope: {
    in: string[];
    out: string[];
    assumptions: string[];
  };
  constraints: string[];
  done_when: Array<{
    id: string;
    claim: string;
    required_evidence: Array<{
      kind: 'command' | 'report' | 'review' | 'source' | 'checkpoint';
      description: string;
      required: boolean;
    }>;
  }>;
  allowed_flow_targets: Array<'fix' | 'build' | 'review' | 'explore' | 'pursue'>;
  selected_flow_target: 'fix' | 'build' | 'review' | 'explore' | 'pursue';
  recovery_policy: {
    max_attempts: number;
    routes: Array<
      | 'retry-selected-flow'
      | 'run-fix'
      | 'run-review'
      | 'run-explore'
      | 'split-to-pursue'
      | 'checkpoint'
      | 'handoff'
      | 'blocked'
    >;
  };
  check_in_triggers: string[];
  stop_conditions: string[];
  completion_gate: {
    required_passes: 2;
    blocking_severities: Array<'critical' | 'high' | 'medium'>;
    reset_on_blocking_finding: true;
  };
};
```

Validation rules:

- `objective`, `done_when`, `allowed_flow_targets`, and `check_in_triggers`
  must be non-empty.
- `selected_flow_target` must be present in `allowed_flow_targets`.
- Every `done_when` item must include at least one required evidence entry.
- `source_of_truth` must be the literal `circuit-run-folder`.
- `completion_gate.required_passes` must be `2` in V1.
- `recovery_policy.max_attempts` must be positive and bounded.

### `goal.attempt@v1`

```ts
type GoalAttempt = {
  schema: 'goal.attempt@v1';
  attempt_id: string;
  flow_target: 'fix' | 'build' | 'review' | 'explore' | 'pursue';
  child_result_path: string;
  child_report_paths: string[];
  outcome: 'complete' | 'needs_attention' | 'blocked' | 'failed' | 'handoff';
  summary: string;
};
```

### `goal.evidence-evaluation@v1`

```ts
type GoalEvidenceEvaluation = {
  schema: 'goal.evidence-evaluation@v1';
  verdict: 'satisfied' | 'missing-evidence' | 'contradicted' | 'blocked';
  claim_results: Array<{
    claim_id: string;
    status: 'proved' | 'missing' | 'contradicted' | 'blocked';
    evidence: string[];
    gap: string | null;
  }>;
  next_route:
    | 'completion-gate'
    | 'retry-selected-flow'
    | 'run-fix'
    | 'run-review'
    | 'run-explore'
    | 'split-to-pursue'
    | 'checkpoint'
    | 'handoff'
    | 'blocked';
};
```

Validation rules:

- `satisfied` requires every `claim_results.status` to be `proved`.
- `completion-gate` is allowed only when `verdict` is `satisfied`.
- `missing-evidence` must name at least one claim gap.
- `contradicted` and `blocked` must not route directly to close.

### `goal.recovery@v1`

```ts
type GoalRecovery = {
  schema: 'goal.recovery@v1';
  reason:
    | 'missing-evidence'
    | 'verification-failed'
    | 'review-blocked'
    | 'scope-drift'
    | 'child-blocked'
    | 'attempt-limit';
  selected_route:
    | 'retry-selected-flow'
    | 'run-fix'
    | 'run-review'
    | 'run-explore'
    | 'split-to-pursue'
    | 'checkpoint'
    | 'handoff'
    | 'blocked';
  rationale: string;
  attempt_count: number;
  operator_input_required: boolean;
};
```

### `goal.gate@v1`

```ts
type GoalGate = {
  schema: 'goal.gate@v1';
  verdict: 'gate-pass' | 'blocked';
  clean_streak: number;
  required_passes: 2;
  blocking_findings: Array<{
    severity: 'critical' | 'high' | 'medium';
    text: string;
    refs: string[];
    recovery_route:
      | 'retry-selected-flow'
      | 'run-fix'
      | 'run-review'
      | 'run-explore'
      | 'split-to-pursue'
      | 'checkpoint'
      | 'blocked';
  }>;
  low_findings: Array<{
    text: string;
    refs: string[];
  }>;
  passes: Array<{
    pass_id: string;
    attack_lens:
      | 'contract-and-proof'
      | 'false-done-and-recovery'
      | 'scope-and-host-boundary';
    evidence_checked: string[];
    verdict: 'gate-pass' | 'blocked';
  }>;
  next_route: 'run-next-gate-pass' | 'recover' | 'close';
};
```

Use `gate-pass` instead of `clean` because existing Pursue review semantics
require a clean verdict to have no findings at all. Goal gate V1 permits low
findings while blocking medium, high, and critical findings.

Validation rules:

- `close` requires `clean_streak >= required_passes`.
- Any blocking finding resets `clean_streak` to `0`.
- `gate-pass` requires no blocking findings.
- `blocked` requires at least one blocking finding.
- The final close must include the gate report.

### `goal.result@v1`

```ts
type GoalResult = {
  schema: 'goal.result@v1';
  outcome: 'complete' | 'needs_attention' | 'blocked' | 'failed' | 'handoff';
  summary: string;
  proven_claims: string[];
  missing_or_weak_claims: string[];
  recovery_history: string[];
  residual_risks: string[];
  rerun_commands: string[];
  evidence_links: Array<{
    report_id: string;
    path: string;
    schema: string;
  }>;
  gate: {
    clean_streak: number;
    required_passes: 2;
    final_verdict: 'gate-pass' | 'blocked';
  };
};
```

Validation rules:

- `complete` requires no missing or weak claims.
- `complete` requires `gate.clean_streak >= 2`.
- `complete` requires the final gate verdict to be `gate-pass`.
- `needs_attention` is for proved work with low findings or operator-actionable
  residual risk.
- `blocked`, `failed`, and `handoff` must include a reason in the summary and a
  next useful operator action.

## Continuation Loop

Goal V1 continuation is a Circuit flow loop, not a host `/goal` loop.

```text
read goal.contract@v1
run selected static child flow
write goal.attempt@v1
evaluate child reports against done_when
if evidence missing or contradicted, choose a recovery route
if operator judgment is needed, checkpoint
if evidence is satisfied, run gate pass
if gate streak is less than 2, run another gate pass
if gate blocks, reset streak and recover
if gate streak reaches 2, close with goal.result@v1
```

V1 should be bounded. `recovery_policy.max_attempts` prevents blind looping.
When the attempt limit is reached, close as `blocked` or `handoff`, not
`complete`.

## Static Flow-Selection Boundary

The Goal flow should statically define one child-flow step for each supported
target. Runtime selection may route to a target, but the compiled schematic must
already know the target.

This avoids unsupported dynamic child-flow loading and keeps generated manifests,
host mirrors, and drift checks honest.

Suggested static child steps:

- `goal-run-fix`
- `goal-run-build`
- `goal-run-review`
- `goal-run-explore`
- `goal-run-pursue`

Each step uses `kind: 'sub-run'`, a registered `flow_ref`, and a templated goal
string derived from `goal.contract@v1`.

## Integration With Existing Flows

### Fix

Use Fix when the Goal contract describes a concrete bug, failing test, or
false-done-prone implementation gap. Fix is the strongest V1 proving ground
because it already models proof-carrying behavior: verification, regression
proof, change-set proof, and optional review.

### Build

Use Build when the contract asks for a new feature or bounded implementation.
The Goal evaluator must require Build's verification and review evidence before
the completion gate can run.

### Review

Use Review when the goal is audit-only. Review can satisfy a Goal if the
contract's done claims are about findings, risk classification, or source-backed
recommendations rather than code changes.

### Explore

Use Explore when the goal is a decision, design option, or tradeoff. Goal should
close only after the selected decision is supported by the Explore report and
the gate confirms no medium-or-above evidence or reasoning gaps.

### Pursue

Use Pursue when the goal contains multiple related lines of work, dependency
ordering, broad cleanup, or coordination risk. Goal must not replace Pursue's
ownership contract. It should supervise Pursue and evaluate the Pursue result
against the higher-level `goal.contract@v1`.

## Checkpoint Behavior

Goal V1 should use checkpoints when continuing would otherwise guess.

Checkpoint triggers:

- scope expands beyond `goal.contract@v1`;
- selected recovery route would change behavior or public surface;
- evidence is ambiguous and no safe default exists;
- the gate finds medium-or-above issues that require operator tradeoff;
- the next route is `split-to-pursue`, `handoff`, or `blocked`.

Checkpoint responses are typed evidence. Later steps should consume the report,
not host-specific transcript wording.

## Recovery Routes

Goal V1 should avoid blind retry. Each recovery route must say what changed
about the next attempt.

| Trigger | Preferred route | Close rule |
| --- | --- | --- |
| Missing proof command output | `retry-selected-flow` or `run-fix` | No complete close until proof exists |
| Verification failed | `run-fix` | Complete only after rerun passes |
| Review or gate found medium+ issue | route named by finding | Gate streak resets |
| Scope drift | `checkpoint` or `split-to-pursue` | No silent scope expansion |
| Child flow blocked | `checkpoint`, `handoff`, or `blocked` | Must preserve blocker |
| Attempt limit reached | `blocked` or `handoff` | Never complete by exhaustion |

## Proof Packet

The operator summary for Goal should be a compact proof packet, not a long
narrative.

Default shape:

```text
Outcome: complete | needs attention | blocked | failed | handoff

Proven:
- <claim> -> <evidence>

Still weak or missing:
- <claim or none>

Checks:
- <command/report/review>

Gate:
- Pass 1: <attack lens>, <verdict>
- Pass 2: <attack lens>, <verdict>

Recovery:
- <routes taken or none>

Next:
- <rerun command, handoff, blocker, or none>
```

This keeps the operator-facing value close to the original product goal:
reduced false-done risk and less babysitting.

## Host Adapter Responsibilities

Host adapters should:

- invoke `circuit run goal --goal "<operator goal>" --progress jsonl`;
- render `task_list.updated` through the host task surface when available;
- render `user_input.requested` through the host question surface when
  available;
- read and render `operator_summary_markdown_path` verbatim at close;
- preserve `run_folder`, `result_path`, and report paths for debug/deep links.

Host adapters must not:

- treat native `/goal` status as Circuit completion;
- mark a Goal complete from transcript text alone;
- invent a final summary when Circuit provides an operator summary;
- hide a checkpoint or blocker behind a success message.

Claude Code or Codex native `/goal` may be used only as an optional wrapper for
keeping the host session active while Circuit runs. Circuit's `goal.result@v1`
remains authoritative.

## Implementation Slices

### Slice 1: Spec And Schema Scaffolding

- Add `docs/specs/goal-block-v1.md`.
- Add `src/flows/goal/reports.ts` with strict Zod schemas.
- Add schema tests for valid and invalid `goal.contract@v1`,
  `goal.evidence-evaluation@v1`, `goal.gate@v1`, and `goal.result@v1`.

### Slice 2: Block Catalog

- Add the `goal` block to `src/schemas/flow-block-definitions.ts`.
- Regenerate the block catalog.
- Verify with the generated-surface drift check.

### Slice 3: Goal Flow Package

- Add `src/flows/goal/data.ts`.
- Add `src/flows/goal/flow.ts`.
- Add `src/flows/goal/command.md`.
- Register the flow in `src/flows/catalog.ts`.
- Keep child-flow targets static.

### Slice 4: Writers

- Add writers for contract, attempt, evidence evaluation, recovery, gate, and
  close result.
- Keep writer outputs strict and report-backed.
- Ensure complete cannot be written without satisfied evidence and gate streak.

### Slice 5: Gate Relay

- Implement two-pass gate behavior with distinct attack lenses.
- Reset the clean streak on medium, high, or critical findings.
- Permit low findings only when they do not weaken the goal evidence.

### Slice 6: Checkpoint And Recovery

- Add checkpoint steps for ambiguous scope, unsafe recovery, and blocked splits.
- Ensure recovery routes are typed and bounded by `max_attempts`.

### Slice 7: Generated Surfaces

- Regenerate:
  - `docs/flows/block-catalog.json`;
  - `src/flows/goal/schematic.json`;
  - `generated/flows/goal/circuit.json`;
  - `plugins/claude/skills/goal/circuit.json`;
  - `plugins/codex/flows/goal/circuit.json`;
  - command and skill surfaces if `paths.command` is public.
- Update docs/generated-surface expectations only through the emitter.

### Slice 8: Verification

Required focused tests:

- Goal schemas reject false complete outcomes.
- Goal flow compiles.
- Static child-flow routes exist for supported targets.
- Completion gate requires two consecutive passes.
- Medium+ gate finding resets the streak.
- Missing evidence routes to recovery, not close.
- Checkpoint waits and resumes through existing checkpoint mechanics.
- Host rendering uses operator summary and does not invent final text.
- Generated surfaces pass drift checks.

Final local proof for implementation:

```bash
git diff --check
npm run check-flow-drift
npm run verify:fast
npm run verify
```

### V1 Value Test

Before making a public superiority claim, run a small head-to-head test:

- Baseline A: native host `/goal` with the same operator objective and no Circuit
  Goal flow.
- Baseline B: Circuit Goal flow with the Goal contract, evidence evaluation,
  recovery routes, and two-pass gate enabled.
- Task set: held-out false-done-prone Fix, Build, Review, and Explore tasks.
  The existing `evals/false-done-fix/README.md` defines the false-done shape for
  Fix and should anchor the first task class.
- Primary metric: fewer `complete` outcomes without required evidence.
- Secondary metric: fewer operator interventions needed to reach a defended
  final answer.
- Required output: a compact comparison report with run folders, result paths,
  proof packets, false-complete counts, and intervention counts.

Goal V1 should not claim to be superior until this test shows lower false-done
risk, lower babysitting debt, or both.

## V2 Deferrals

Do not include these in V1:

- project-level goal ledger;
- cross-run goal recall or search;
- arbitrary dynamic child-flow loading;
- multi-goal portfolio UI;
- parallel code-changing goal attempts;
- native host `/goal` projection as a required execution layer;
- background scheduled goal continuation;
- automatic goal amendment across sessions.

These can become V2 after the single-run, report-backed Goal flow proves value.

## Open Questions For Implementation

1. Should Goal V1 be public immediately, or internal until the false-done gate
   passes real held-out tasks?
2. Should `goal.gate@v1` be implemented as a Goal-specific writer first, or as a
   reusable block after one flow proves the shape?
3. Should low gate findings produce `complete` with residual risk or
   `needs_attention`? V1 should choose one policy and test it.
4. How should the parent Goal flow summarize child-flow reports without copying
   too much evidence into the operator summary?

## Adversarial Review Record

### Review 1

Findings:

- Medium: A dedicated Goal flow can imply unsupported dynamic child-flow
  loading. Resolved by requiring static child-flow targets in V1.
- Medium: A "clean" gate verdict conflicts with existing Pursue semantics where
  clean means no findings. Resolved by using `gate-pass`.
- Medium: Proof packets can become ceremony. Resolved by requiring concrete
  evidence links, rerun commands, recovery history, and compact operator output.

### Review 2

No medium-or-above findings.

Low residual risk: the value test is specified, but it must pass before any
public claim that Goal V1 is superior to native host `/goal`.

### Review 3

No medium-or-above findings.

Low residual risk: implementation should resist adding V2 ledger or cross-run
recall during the initial slice.
