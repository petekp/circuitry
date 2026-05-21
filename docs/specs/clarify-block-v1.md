# Clarify Block V1 Implementation Spec

Status: implementation spec, not current behavior.

Date: 2026-05-20

## Summary

Clarify V1 adds a reusable **Clarify** block that turns a rough operator
request into a clear task for the selected flow.

The block exists because many useful agent surfaces work better when a plain
request is shaped before execution. Goal prompts need outcome, proof,
constraints, boundaries, iteration policy, and stop conditions. Pursue needs
candidate parts, proof per part, coordination risks, check-in triggers, and stop
conditions. Other flows may need their own task-shaping guidance later.

Clarify is the shared step for that preparation. It must not become a second
router, a completion judge, a host `/goal` adapter, or a prompt-only source of
truth.

## Product Contract

Clarify answers:

1. What is the operator asking Circuit to do?
2. What outcome would make the task done?
3. What proof should the selected flow look for?
4. What constraints and scope boundaries matter?
5. What assumptions, missing information, and stop conditions should be carried
   forward?

Clarify does not answer:

- Which public flow should run.
- Whether the task is complete.
- Which dynamic child flow should be loaded.
- Whether a Goal gate has passed.
- Whether Pursue may perform parallel code writes.

The selected flow remains the authority for its own contract, routes, proof, and
close rules.

## Source-Backed Boundaries

Circuit's flow model already requires:

- Blocks are reusable kinds of work with structured inputs, typed outputs,
  checks, and routes.
- A step is a flow-specific use of a block.
- Later steps consume named reports, not arbitrary model prose.
- Prompts are delivery formats at the connector boundary, not the source of
  truth.
- Generated schematics, manifests, block catalogs, and host plugin files must be
  updated through emitters, not by hand.

Clarify must follow those rules.

## Block Definition

Add a reusable block definition in `src/schemas/flow-block-definitions.ts`:

```ts
{
  id: 'clarify',
  title: 'Clarify',
  purpose: 'Turn a rough operator request into a clear task for the selected flow.',
  input_contracts: ['task.intake@v1', 'route.decision@v1'],
  alternative_input_contracts: [['task.intake@v1']],
  output_contract: 'clarified.task@v1',
  action_surface: 'worker',
  produces_evidence: [
    'original request',
    'clarified task',
    'desired outcome',
    'proof needed',
    'constraints',
    'scope',
    'assumptions',
    'missing information',
    'stop conditions'
  ],
  check: {
    kind: 'schema',
    description:
      'The clarified task must preserve the operator request, name the outcome, identify proof, and separate assumptions from missing information.'
  },
  allowed_routes: ['continue', 'ask', 'stop'],
  human_interaction: 'optional',
  schematicPolicy: {
    executionKinds: ['relay'],
    stages: ['frame']
  }
}
```

V1 uses `relay` execution because the point is model-authored clarification, not
deterministic prompt rewriting.

## Report Contract

The block-level output contract is the generic name:

```text
clarified.task@v1
```

Flow-owned actual schemas must own the runtime reports:

```text
goal.clarified-task@v1
pursuit.clarified-task@v1
```

This preserves Circuit's report ownership rule: each flow package owns the
schemas it writes and registers.

The shared shape should be:

```ts
type ClarifiedTaskBase = {
  verdict: 'continue' | 'ask' | 'stop';
  original_request: string;

  target: {
    kind: 'flow';
    id: 'goal' | 'pursue';
  };

  guide_id: 'goal-v1' | 'pursue-v1';

  clarified_prompt: string;
  objective: string;
  desired_outcome: string;

  proof_needed: Array<{
    kind: 'command' | 'report' | 'review' | 'source' | 'checkpoint';
    description: string;
    required: boolean;
  }>;

  constraints: string[];

  scope: {
    in_bounds: string[];
    out_of_bounds: string[];
  };

  assumptions: string[];

  missing_information: Array<{
    question: string;
    why_it_matters: string;
    safe_default?: string;
  }>;

  iteration_policy: string[];
  stop_conditions: string[];

  suggested_parts: Array<{
    title: string;
    objective: string;
    proof_needed: string[];
    risk_notes: string[];
  }>;
};
```

Goal's actual schema narrows:

```ts
schema: 'goal.clarified-task@v1'
target.id: 'goal'
guide_id: 'goal-v1'
```

Pursue's actual schema narrows:

```ts
schema: 'pursuit.clarified-task@v1'
target.id: 'pursue'
guide_id: 'pursue-v1'
suggested_parts: non-empty
```

Every relay report must include top-level `verdict` because relay execution
checks verdict before materializing the report.

## Goal Integration

Goal should change from:

```text
goal-contract
```

to:

```text
clarify-goal
  -> goal-contract
```

`clarify-goal`:

- Uses block `clarify`.
- Runs in the Frame stage.
- Uses relay role `researcher`.
- Reads `task.intake@v1` and `route.decision@v1`.
- Writes `goal.clarified-task@v1`.
- Stores the report at `reports/goal/clarified-task.json`.
- Routes by `verdict`:
  - `continue` -> `goal-contract`
  - `ask` -> Goal recovery checkpoint or a clear stop path
  - `stop` -> `@stop`

`goal-contract` then reads `goal.clarified-task@v1` and writes
`goal.contract@v1`.

Goal still owns:

- `goal.contract@v1`
- `selected_flow_target`
- static `allowed_flow_targets`
- recovery policy
- evidence evaluation
- completion gate
- final close decision

Clarify may improve the prompt that Goal uses to form its contract. It must not
add adversarial review text, choose dynamic child flows, or decide completion.

## Goal Clarify Guide

The Goal guide borrows the useful parts of the local `write-goal` recipe:

- outcome
- verification surface
- constraints
- boundaries
- iteration policy
- blocked stop condition

It explicitly excludes the adversarial review loop because Goal V1 already owns
gate review as a separate flow step.

The clarified Goal prompt should be compact, auditable, and broad enough for
Circuit to choose the next action. It should not prescribe every
implementation step unless the operator already did.

## Pursue Integration

Do not wire Pursue before Goal proves the pattern.

Pursue should eventually change from:

```text
contract-step
```

to:

```text
clarify-pursuit
  -> contract-step
```

`clarify-pursuit`:

- Uses block `clarify`.
- Runs in the Frame stage.
- Uses relay role `researcher`.
- Writes `pursuit.clarified-task@v1`.
- Stores the report at `reports/pursuit/clarified-task.json`.

`contract-step` then reads `pursuit.clarified-task@v1` and writes
`pursuit.contract@v1`.

Pursue still owns:

- `pursuit.contract@v1`
- the pursuit list
- the coordination graph
- wave planning
- serial code-write policy
- verification commands
- review for interference
- final close evidence

## Pursue Clarify Guide

The Pursue guide should ask for:

- candidate work parts
- objective and proof per part
- likely shared files or generated surfaces
- dependency and conflict hints
- serial-write risks
- check-in triggers
- stop conditions

Clarify may suggest parts. The Pursue contract remains the authority for the
actual pursuit list and coordination graph.

## Key Implementation Risk

Pursue can be run directly or as a Goal child flow. Sub-run V1 currently passes a
static child `goal` string from the parent step. If Pursue is wired to Clarify
too early, it may clarify the child-flow instruction instead of the original
operator objective.

Do not wire Pursue until there is focused proof for both:

- direct `pursue` runs; and
- Pursue as the selected Goal child flow.

If that proof exposes a bad handoff, fix the Goal child-flow objective handoff
before enabling Pursue Clarify.

## Relay Shape Hints

Each flow-owned clarified report needs a shape hint:

```text
goal.clarified-task@v1 -> Goal Clarify JSON instruction
pursuit.clarified-task@v1 -> Pursue Clarify JSON instruction
```

The hints must tell the worker:

- return one raw JSON object;
- include `verdict`;
- preserve the original request;
- do not include adversarial review instructions;
- make no completion claim;
- do not choose dynamic child flows;
- do not wrap JSON in Markdown.

## Generated Surfaces

Generated files must not be hand-edited.

After editing authored sources, run:

```bash
npm run emit-flows
```

Then verify drift with:

```bash
npm run check-flow-drift
```

Expected generated surfaces include:

- `docs/flows/block-catalog.json`
- `src/flows/goal/schematic.json`
- `generated/flows/goal/circuit.json`
- public host mirrors under `plugins/`

When Pursue is later wired, the same applies to Pursue generated surfaces.

## Tests

Focused tests should prove:

- Clarify appears in the generated block catalog.
- Goal starts with `clarify-goal`.
- `goal-contract` consumes `goal.clarified-task@v1`.
- Invalid Goal clarified reports fail closed.
- Goal Clarify shape hints reject prose-only or missing-verdict results.
- Clarify does not add adversarial review text.
- Goal still cannot load dynamic child flows.
- Goal still preserves static Fix, Build, Review, Explore, and Pursue targets.
- Existing Fix, Build, Review, Explore, and Pursue behavior is unchanged.

Before Pursue wiring, add focused tests that prove:

- direct Pursue receives the real operator objective through Clarify; and
- Pursue-as-Goal-child receives the real operator objective through Clarify.

## Verification

Use focused proof while iterating:

```bash
npm run test:fast -- tests/contracts/catalog-completeness.test.ts tests/runner/flow-facts.test.ts
npm run check-flow-drift
```

Before claiming the change complete, run:

```bash
npm run verify
```

## Implementation Order

1. Add the Clarify block definition.
2. Add Goal's flow-owned clarified-task schema and relay shape hint.
3. Add `clarify-goal` before `goal-contract`.
4. Update the Goal contract writer to read `goal.clarified-task@v1`.
5. Regenerate surfaces through `npm run emit-flows`.
6. Add focused Goal tests.
7. Run focused checks and `npm run verify`.
8. Only then evaluate Pursue wiring with direct-run and Goal-child proof.

This keeps Clarify approachable and generic while preserving Circuit's existing
block, flow, report, host, generated-surface, and completion-authority
boundaries.
