# CheckpointBoundary Authority

Status: implementation-spec direction for the Circuit pivot. This is not
current runtime behavior until the matching schema, runtime, tests, docs, and
generated surfaces change.

`CheckpointBoundary` is the proposed spec name. In product prose, say
checkpoint or decision point.

## Purpose

A checkpoint is where Circuit must decide whether it has enough authority to
continue.

The rule is:

> Circuit may open a checkpoint from the work contract. Circuit may cross that
> checkpoint only by operator choice, declared default, or traced policy
> decision.

Today, checkpoint steps mix several concerns: prompt text, choices, safe
defaults, autonomous behavior, scoring policies, resume files, and the route that
continues the flow. This spec separates them.

After this cutover:

- the work contract declares the checkpoint boundary;
- PolicyEnvelope says when a default may be used;
- GuidanceDecision records any resolved choice;
- Trace records the request and the resolution;
- resume validates the saved request before continuing;
- old hidden automatic paths are rejected.

## Source Evidence

- The pivot brief defines a checkpoint as an authority boundary and says
  automatic resolution is allowed only when declared, allowed by policy, and
  traced as GuidanceDecision. See [pivot-brief.md](pivot-brief.md#checkpoint-semantics).
- The pivot brief says deleting `safe_autonomous_choice` is not enough because
  current `auto_resolution` modes also need replacement. See
  [pivot-brief.md](pivot-brief.md#checkpoint-auto-resolution-replacement).
- WorkContract Projection V0 maps checkpoint choices and route consequences into
  contract authority, replaces `safe_default_choice` with `declared_default`, and
  deletes `safe_autonomous_choice` plus old auto-resolution authority. See
  [work-contract-projection-v0.md](work-contract-projection-v0.md).
- GuidanceDecision Trace Invariant says every `checkpoint.resolved` must have a
  matching `guidance.decision` and that `safe-autonomous` is not a valid future
  resolution source. See
  [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#checkpoint-resolution).
- PolicyEnvelope Config V2 says `--autonomous` becomes a request to use declared
  defaults where allowed, and cannot cross a checkpoint without policy,
  WorkContract, and GuidanceDecision. See
  [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#current-invocation-flags).
- Current configuration docs still teach config v1, selection composition,
  connector routing, and per-flow overrides. Checkpoint defaults must move into
  the v2 policy model, not the old config authority path. See
  [docs/configuration.md](../../configuration.md) and
  [docs/contracts/config.md](../../contracts/config.md).
- Ubiquitous Language currently defines Checkpoint as a pause where Circuit needs
  operator input or a declared safe default, and lists current checkpoint trace
  kinds. See [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md).
- Current `CheckpointPolicy` accepts `prompt`, `choices`, `choices_from`,
  `safe_default_choice`, `auto_resolution`, and `report_template`.
  `safe_autonomous_choice` is rejected by the active schema. See
  [src/schemas/step.ts](../../../src/schemas/step.ts).
- Current checkpoint auto-resolution modes are `highest-score` and `refuse`.
  Earlier `accept-as-is` and `first-acceptable` modes are not part of the active
  schema. See
  [src/schemas/step.ts](../../../src/schemas/step.ts) and
  [src/schemas/operator-summary.ts](../../../src/schemas/operator-summary.ts).
- Current checkpoint execution waits in deep or tournament depth, resolves
  standard depth through `safe_default_choice`, and resolves autonomous depth
  through `auto_resolution` or the same declared default. See
  [src/runtime/executors/checkpoint.ts](../../../src/runtime/executors/checkpoint.ts).
- Current checkpoint trace allows `resolution_source` values `declared-default`,
  `operator`, and `policy`. See
  [src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts).
- Current checkpoint resume reloads the saved manifest, finds an unresolved
  checkpoint request, validates request path, request hash, choices, selected
  value, `check.allow`, execution context, and checkpoint report hash before
  re-entering the graph. See
  [src/runtime/run/checkpoint-resume.ts](../../../src/runtime/run/checkpoint-resume.ts).
- Current tests already prove useful assets: open checkpoints do not close runs,
  invalid resume choices are rejected, tampered request bytes fail, stale choices
  fail, and checkpoint report hash drift fails. See
  [tests/runtime/checkpoint-resume.test.ts](../../../tests/runtime/checkpoint-resume.test.ts).
- Current generated surfaces are source-owned and drift-checked. See
  [docs/generated-surfaces.md](../../generated-surfaces.md).
- Current host surfaces render `user_input.requested` and resume commands for
  checkpoints. See [src/commands/run.md](../../../src/commands/run.md) and
  [plugins/codex/skills/run/SKILL.md](../../../plugins/codex/skills/run/SKILL.md).

## Target Shape

```ts
type CheckpointBoundaryV0 = {
  reason_code: CheckpointReasonCode;
  authority_required: 'operator' | 'policy';
  prompt: string;
  choices: CheckpointBoundaryChoice[];
  declared_default?: DeclaredCheckpointDefault;
  writes: {
    request: RunRelativePath;
    response: RunRelativePath;
    report?: ReportRef;
  };
  proof_refs?: Ref[];
};

type CheckpointBoundaryChoice = {
  id: string;
  label?: string;
  description?: string;
  route: {
    id: DeclaredRouteId;
    target: StepId | '@complete' | '@stop' | '@handoff' | '@escalate';
  };
  consequence: string;
};

type DeclaredCheckpointDefault = {
  choice_id: string;
  allowed_when: PolicyRef[];
  reason_code: string;
};

type PolicyRef = Ref & { kind: 'policy' };
```

Plain meanings:

- `reason_code` says why Circuit needs authority.
- `authority_required` says whether policy may resolve it or an operator must.
- `prompt` is display text. It is not the authority model.
- `choices` are the only options that may be selected.
- every choice declares the route it takes and the consequence of taking it;
- `declared_default` is a possible resolution, not permission by itself;
- `writes` says where request, response, and optional checkpoint report live.

## Current Field Projection

| Current field or behavior | V0 fate | Rule |
| --- | --- | --- |
| Checkpoint step `kind: "checkpoint"` | Keep | Still the step kind for checkpoint boundaries. |
| `policy.prompt` | Keep as display text | Prompt renders the ask. The boundary is defined by reason, authority, choices, routes, and policy. |
| `policy.choices` | Keep / strengthen | Static choices become `CheckpointBoundaryChoice[]`; each choice must include a route and consequence. |
| `policy.choices_from` | Keep with limits | Dynamic choices are allowed only when they resolve to schema-valid choices and map to declared route families. |
| `safe_default_choice` | Replace | Becomes `declared_default.choice_id` with non-empty `allowed_when` policy refs. |
| `safe_autonomous_choice` | Delete | It creates a separate automatic path. Active schemas must reject it after cutover. |
| `auto_resolution.accept-as-is` | Delete as checkpoint resolver | If it meant "use the default", model that as `declared_default` plus GuidanceDecision. |
| `auto_resolution.first-acceptable` | Delete as checkpoint resolver | Picking the first option is not authority. If guidance ranks choices later, it must record rejected options. |
| `auto_resolution.highest-score` | Move / restrict | May survive as a fanout or review scoring input. It cannot cross a checkpoint unless GuidanceDecision records source report refs, rubric refs, selected option, and rejected options. |
| `auto_resolution.refuse` | Replace | Becomes wait, stop, or escalation through declared routes. |
| `report_template` | Keep | Still useful for checkpoint reports and evidence packets. It must not grant authority. |
| `writes.request` | Keep | Request file is the durable checkpoint ask. Future request body must include the boundary ref/hash. |
| `writes.response` | Keep | Response file records the selected choice after GuidanceDecision or operator resume. |
| `writes.report` | Keep | Optional checkpoint report remains evidence for the operator and resume validation. |
| `check.kind: "checkpoint_selection"` | Keep | Still validates that the response selected an allowed choice. |
| `check.allow` | Keep / simplify later | Static allow must match choices. In V0, it is validation, not a second choice list. |
| `check.allow_from: policy_choices` | Keep with limits | Dynamic allow follows the same dynamic-choice source. It must not add choices outside the boundary. |
| Current route fallback to `pass` | Replace | Every checkpoint choice must declare the route it takes. No implicit fallback. |
| Depth-driven waiting | Replace | Wait is driven by boundary plus policy. `deep`, `tournament`, or `autonomous` may inform policy, but cannot decide authority alone. |
| CLI `--autonomous` | Replace as product idea | Treat as a request to use declared defaults where allowed. It cannot resolve a checkpoint alone. |

## Boundary Rules

### 1. The WorkContract Opens The Boundary

The work contract owns the checkpoint boundary:

- reason code;
- allowed choices;
- choice routes;
- choice consequences;
- declared default, if any;
- request, response, and report paths.

The runtime may emit `checkpoint.requested` from that boundary. This opens the
decision point. It does not cross it.

### 2. Choices Must Have Route Consequences

Each choice must say what happens next.

Bad target shape:

```ts
choices: [{ id: 'continue' }];
routes: { pass: 'act-step' };
```

Target shape:

```ts
choices: [
  {
    id: 'continue',
    route: { id: 'continue', target: 'act-step' },
    consequence: 'Continue into write-capable implementation.',
  },
  {
    id: 'stop',
    route: { id: 'stop', target: '@stop' },
    consequence: 'Stop without starting implementation.',
  },
];
```

If a choice should use the success route, it must still name that route:

```ts
route: { id: 'pass', target: 'act-step' }
```

No checkpoint choice may fall through to `pass` merely because the selected
choice id has no matching route.

### 3. Dynamic Choices Are Bounded

`choices_from` can remain for tournament and generated-option cases, but it must
not become model-authored free choice.

Rules:

- the source must be a typed report or runtime evidence file;
- the source ref and hash must appear in the checkpoint request or
  GuidanceDecision inputs;
- generated choice ids must be deterministic and schema-valid;
- every dynamic choice must map to a declared route family;
- if the dynamic source has drifted by resume time, resume rejects the run;
- dynamic choices cannot add stop, ask, or recovery behavior unless those routes
  are declared in the WorkContract.

This keeps the useful Explore tournament shape while preventing a checkpoint
from offering choices that have no executable route.

### 4. Declared Defaults Need Policy

A declared default is not a permission slip.

It can resolve a checkpoint only when all of these are true:

1. The boundary declares `declared_default.choice_id`.
2. The choice exists.
3. The choice route is declared by the WorkContract.
4. `authority_required === "policy"`.
5. PolicyEnvelope allows that reason code and route to use a default.
6. No hard policy rule blocks the action.
7. A matching `guidance.decision` records the resolution before
   `checkpoint.resolved`.

If any condition fails, Circuit waits, stops, or escalates through a declared
route. It does not silently pick a nearby option.

### 5. Operator Decisions Are Still Valid

Operator choice remains the clearest way to cross a checkpoint.

An operator decision must:

- select one of the checkpoint request choices;
- match the saved request hash and request path;
- match the saved WorkContract boundary ref;
- match `check.allow` or the dynamic allowed set;
- emit `guidance.decision` with source `operator_override` before
  `checkpoint.resolved`;
- include `policy_refs` and `constraint_refs` for the rules that allowed the
  operator choice to proceed;
- write the response file and checkpoint trace entry.

The product wording can say "the operator chose." The trace still records it as
a GuidanceDecision so every consequential decision has the same audit path.

### 6. Policy Decisions Are Not "Autonomous Mode"

Do not model a separate autonomous checkpoint path.

Policy-controlled resolution is just a recorded decision inside the rules. It
uses `resolution_source: "policy"` or `resolution_source: "declared-default"` in
the future trace, never `safe-autonomous`.

`--autonomous` may ask Circuit to use declared defaults when allowed. It cannot:

- invent a default;
- ignore `authority_required: "operator"`;
- bypass proof;
- bypass protected-file rules;
- bypass resume validation;
- choose a route not declared by the WorkContract.

## Trace Model

### Request

`checkpoint.requested` means the boundary is open.

Future request trace should include or bind:

```ts
type CheckpointRequestedV0 = {
  kind: 'checkpoint.requested';
  step_id: StepId;
  attempt: number;
  options: string[];
  request_path: RunRelativePath;
  request_report_hash: string;
  boundary_ref: Ref;
  boundary_hash: string;
  auto_resolved?: false;
};
```

`checkpoint.requested` may exist without `checkpoint.resolved` when the run is
waiting.

### Resolution

`checkpoint.resolved` means Circuit crossed the boundary.

Future resolution trace should use:

```ts
resolution_source: 'operator' | 'declared-default' | 'policy'
```

Rules:

- `safe-default` is replaced by `declared-default`.
- `safe-autonomous` is rejected.
- `checkpoint.requested.auto_resolved: true` is rejected in the future trace;
  only the resolution entry records whether a checkpoint was auto-resolved.
- `auto_resolved: true` is allowed only for `declared-default` or `policy`.
- `operator` resolution always has `auto_resolved: false`.
- every `checkpoint.resolved` must have a preceding matching
  `guidance.decision` with subject `checkpoint_resolution`.

### Matching GuidanceDecision

For a checkpoint resolution, the matching `guidance.decision` must have:

- subject `checkpoint_resolution`;
- the same `run_id`, `flow_id`, `step_id`, and `attempt`;
- `selected.choice_id` equal to `checkpoint.resolved.selection`;
- `selected.route_id` equal to the choice route;
- `selected.auto_resolved` equal to `checkpoint.resolved.auto_resolved`;
- `selected.resolution_source` equal to the future trace source;
- `input_refs` for the checkpoint request and any operator input or scoring
  evidence;
- `contract_refs` for the WorkContract boundary;
- `policy_refs` and `constraint_refs` for the rules that bounded the decision;
- `evidence_refs` when scoring, proof weakness, protected files, or unsafe apply
  caused the checkpoint;
- `rejected_options` when guidance ranked multiple choices.

Opening a checkpoint can be traced by `checkpoint.requested` alone. Crossing it
requires GuidanceDecision.

## Resume Rules

Current resume validation is a good base. Keep that posture and add the new
boundary checks.

A resumed checkpoint must validate:

- the run folder is a runtime run folder;
- the run is not already closed;
- the unresolved checkpoint request is the latest open request;
- the saved manifest and WorkContract projection match the bootstrap hash;
- `checkpoint.requested.request_path` matches the saved flow path;
- request bytes hash to `request_report_hash`;
- request body `step_id`, choices, and boundary hash are not stale;
- selected choice is in the saved request choices;
- selected choice is allowed by the checkpoint check;
- selected choice route is declared by the WorkContract;
- checkpoint report hash still matches if the request carried one;
- resume reuses saved axes, policy refs, evidence policy, project root, and run
  goal;
- resume emits checkpoint GuidanceDecision before writing `checkpoint.resolved`.

Resume must not:

- load current generated flow files instead of the saved manifest;
- accept a changed request body just because it still parses;
- trust a response file without a matching trace entry;
- rerun policy/default resolution while handling an operator resume;
- accept a choice added after the checkpoint request was written;
- mutate the checkpoint report after the request hash is recorded.

## Generated Surface Rules

Generated surfaces are enforcement surfaces, not cleanup work.

After this spec lands in runtime:

- generated compiled manifests should carry or reference the WorkContract
  checkpoint boundary;
- generated host command and skill surfaces should describe checkpoints as
  decision points, not "autonomous mode";
- generated host surfaces should render request choices and resume commands from
  the runtime waiting state;
- generated docs must not mention `safe_autonomous_choice` or
  `safe-autonomous` outside migration docs;
- generated flow mirrors must not contain active checkpoint `auto_resolution`
  authority;
- drift checks must fail if source and generated mirrors disagree.

Do not hand-edit generated mirrors. Change the source or emitter, regenerate,
and run the drift check.

## Implementation Order

1. Add the CheckpointBoundary schema and projection tests.
2. Add trace schema support for `declared-default` and `policy` resolution
   sources.
3. Add trace sequence validation requiring checkpoint GuidanceDecision before
   `checkpoint.resolved`.
4. Replace checkpoint schema fields: `safe_default_choice` to
   `declared_default`; reject `safe_autonomous_choice`.
5. Reject old checkpoint `auto_resolution` as direct resolver.
6. Update checkpoint execution to open boundaries, wait, or resolve through
   GuidanceDecision.
7. Update resume validation to bind boundary refs and GuidanceDecision.
8. Update checkpoint reports and operator summaries to read the new resolution
   sources.
9. Update generated surfaces through source files and emit scripts.

## Death Tests

### Schema Tests

- `CheckpointBoundary` rejects `safe_autonomous_choice`.
- Active trace and response schemas reject `safe-autonomous`.
- Active checkpoint schema rejects `auto_resolution.accept-as-is`,
  `auto_resolution.first-acceptable`, and `auto_resolution.highest-score` as
  direct checkpoint resolvers.
- `declared_default.choice_id` must name a declared choice.
- `declared_default.allowed_when` must be non-empty.
- Each choice must include a route id, route target, and consequence.
- Each choice route id must be declared by the WorkContract.
- Dynamic choices must declare a route family and validate produced choices.
- Checkpoint request schema requires boundary ref and boundary hash.
- Checkpoint response schema rejects old `resolution_source: "safe-autonomous"`.

### Trace Tests

- `RunTrace` rejects `checkpoint.resolved` without matching
  `guidance.decision`.
- `RunTrace` rejects `checkpoint.resolved` whose selected choice, route, source,
  or auto-resolved flag differs from GuidanceDecision.
- `RunTrace` rejects `checkpoint.resolved` with `resolution_source:
  "safe-autonomous"`.
- `RunTrace` rejects `checkpoint.requested` with `auto_resolved: true`.
- `RunTrace` rejects `auto_resolved: true` with `resolution_source: "operator"`.
- `checkpoint.requested` may remain open without `run.closed`.
- A request/resolution pair must use the same boundary ref and step attempt.

### Runtime Tests

- Standard-depth checkpoint default resolution fails unless WorkContract declares
  a default, policy allows it, and GuidanceDecision records it.
- `--autonomous` cannot resolve a checkpoint by itself.
- Old `safe_autonomous_choice` fixtures fail after cutover.
- Old `highest-score` checkpoint resolution fails unless it is converted to a
  guidance policy decision with source report refs, rubric refs, selected option,
  and rejected options.
- `first-acceptable` cannot cross a checkpoint boundary.
- `accept-as-is` cannot cross a checkpoint boundary.
- A selected checkpoint choice with no declared route fails before
  `step.completed`.
- A selected checkpoint choice cannot fall through to `pass` unless the choice
  explicitly declares route `pass`.
- Operator resume emits checkpoint GuidanceDecision before
  `checkpoint.resolved`.
- Resume rejects tampered request bytes, stale choices, stale step id, request
  path mismatch, changed boundary hash, missing report, changed report hash,
  already-resolved checkpoints, and closed runs.
- Resume does not mutate the checkpoint report after request creation.

### Config And Policy Tests

- A policy layer can allow declared defaults only inside hard constraints.
- Invocation cannot loosen a project rule that requires operator checkpoints.
- Memory hints cannot change checkpoint authority.
- If no allowed policy resolution remains, GuidanceDecision routes to wait, stop,
  or escalation; it does not choose a fallback.
- Required checkpoint globs still force operator or policy boundary behavior for
  protected files.

### Generated-Surface Tests

- Generated manifests contain or reference the checkpoint boundary projection.
- Generated manifests and host mirrors contain no active `safe_autonomous_choice`.
- Generated traces or fixtures contain no future `safe-autonomous` source.
- Public generated docs do not describe checkpoint resolution as an autonomous
  mode.
- Host command and skill surfaces still show checkpoint choices and resume
  commands from the runtime waiting state.
- Drift checks fail if checkpoint boundary fields change without regenerated
  mirrors.

## Anti-Cruft Probes

Run these in the implementation branch. Some should fail until the cutover is
done.

```bash
rg -n "safe_autonomous_choice|safe-autonomous|safe autonomous" \
  src docs generated plugins tests
```

Expected hard-cut state: active schemas, runtime paths, generated manifests, and
host surfaces do not contain these terms outside migration docs or explicit
death-test fixtures.

```bash
rg -n "auto_resolution|highest-score|first-acceptable|accept-as-is|refuse" \
  src docs generated plugins tests
```

Expected hard-cut state: checkpoint runtime cannot use these as direct
checkpoint resolvers. `highest-score` may appear only as fanout/review scoring
input or migration/death-test evidence.

```bash
rg -n "resolution_source.*safe-default|resolution_source.*safe-autonomous|safe-default|safe-autonomous" \
  src docs generated plugins tests
```

Expected hard-cut state: future trace sources are `operator`,
`declared-default`, and `policy`. Old source names appear only in migration docs
or death tests.

```bash
rg -n "checkpoint\\.resolved|checkpoint\\.requested|checkpoint_resolution|GuidanceDecision" \
  src tests docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: every checkpoint resolution path has matching
GuidanceDecision schema and trace sequence coverage.

```bash
rg -n "checkpoint.*route|choices_from|allow_from|checkpoint_choice|checkpoint-choice" \
  src tests docs generated plugins
```

Expected hard-cut state: every checkpoint choice that can be selected maps to a
declared route and resume validates against the saved request.

## Still Unsettled

- Exact `CheckpointReasonCode` enum. The pivot brief proposes
  `scope_expansion`, `protected_files`, `weak_proof`, `unsafe_apply`,
  `budget_exceeded`, and `ambiguous_intent`, but implementation may need a small
  initial set.
- Exact location of `CheckpointBoundary` in generated flow manifests.
- Whether checkpoint request files should embed the full boundary object or only
  a boundary ref plus hash.
- Whether `safe-default` should be rejected immediately or supported only by a
  migration command that rewrites old run fixtures.
- Whether `highest-score` belongs in fanout policy, proof policy, or guidance
  ranking after it leaves checkpoint resolution.
- Exact name of an operator-authorized policy change event.
- Whether `check.allow` survives long term or becomes a derived field from
  `CheckpointBoundary.choices`.

## Review Record

Draft review found medium risks: route consequences were too implicit, waiting
versus resolving was not cleanly separated, resume did not bind the future
WorkContract boundary, current config docs were not cited directly, operator
checkpoint decisions did not explicitly carry policy and constraint refs, and
`declared_default.allowed_when` was too loose.

Those issues are resolved here: choices require explicit routes and
consequences, `checkpoint.requested` opens the boundary while
`checkpoint.resolved` crosses it, resume checks boundary refs and hashes, current
config docs are cited, operator decisions require policy and constraint refs, and
declared defaults use `PolicyRef`.

At completion, two clean adversarial reviews were run after those fixes. No
medium-or-above findings remained. Remaining low risks are the unsettled naming
and placement details listed above.
