# Work-Pattern Policy Compiler Proof Slice

Status: architecture proof plan  
Date: 2026-04-18  
Primary falsification target: Sweep

Proof-slice update: the first concrete scaffold now lives in
`scripts/runtime/engine/src/definition-ir/`, with the Sweep fixture in
`docs/sweep-v3-definition-fixture.yaml` and the human summary target in
`docs/sweep-v3-work-policy-summary.md`. The sketch below is retained as the
planning baseline; the scaffold tightens the vocabulary to
`parameterized_fanout`, `workers_adapter`, and `review_audit` so static
patterns are distinct from runtime-discovered work-unit instances.

## Goal

Prove or disprove the narrowed schema direction from
`docs/circuit-schema-adversarial-review.md`:

> Model typed work patterns and policy controls under v2 outer steps, not every
> concrete runtime work-unit instance.

Sweep is the first proof because it is the hardest built-in workflow for static
work-unit modeling:

- survey workers are selected from the sweep type
- PROVE adjudication workers are conditional on triage
- execution batches are created from queue risk/confidence ordering
- Autonomous stops after three batches or a cap
- verify is diagnose-only and must catch false positives and injections

If Sweep cannot be made clearer with work patterns, the architecture should
stop before any schema migration.

## Non-Goals

- No runtime implementation in this slice.
- No replacement of `skills/sweep/circuit.yaml`.
- No provider model IDs in workflow definitions.
- No parsing of `skills/sweep/SKILL.md` to infer machine facts.
- No attempt to encode all Sweep judgment in YAML.

## Success Bar

The proof succeeds only if all of these are true:

1. The Sweep work-pattern source is easier to review than the current hidden
   policy scattered through v2 YAML and SKILL prose.
2. The source can project to the current v2 outer manifest without runtime-core
   changes.
3. Actual runtime-discovered categories, PROVE items, and batches can be
   represented as receipt instances of declared patterns.
4. The schema keeps provider details in config/adapters.
5. The schema leaves judgment protocols in prose while structuring
   machine-significant controls.

Fastest disproof:

- The definition needs broad `extra: {}` escape hatches.
- The compiler must inspect repo state, queue contents, or runtime artifacts to
  emit topology.
- Authors still need to read SKILL prose to find fanout count, mutation policy,
  compute floor, prompt template, or skill budget.
- The generated summary is noisier than the SKILL prose.

## WorkPatternIR Sketch

This is intentionally a type-level target, not final YAML syntax.

```ts
type WorkPatternKind =
  | "single"
  | "static_fanout"
  | "dynamic_fanout"
  | "workers_loop"
  | "tournament"
  | "audit";

type MutationPolicy =
  | "read_only"
  | "diagnose_only"
  | "safe_edit"
  | "refactor"
  | "migration";

interface WorkPatternIR {
  id: string;
  parentStepId: string;
  kind: WorkPatternKind;
  unitIdTemplate: string;
  dynamicFrom?: string;
  role: "researcher" | "implementer" | "reviewer" | "orchestrator";
  completion: "all" | "any" | "threshold" | "sequential";
  maxParallel?: number;
  prompt: PromptPolicyIR;
  skills: SkillPolicyIR;
  modelPolicy: ModelPolicyIR;
  budget: BudgetPolicyIR;
  safety: SafetyPolicyIR;
  outputContract: string;
  receiptContract: string;
  proseAnchor?: string;
}

interface PromptPolicyIR {
  template: "research" | "implement" | "review" | "ship-review" | "converge";
  headerContract: string;
  includeArtifacts: string[];
  outputContract: string;
}

interface SkillPolicyIR {
  max: number;
  required: string[];
  suggested: string[];
  domainSelected: boolean;
  forbidden: string[];
  missingOptional: "omit_with_receipt_warning" | "block";
}

interface ModelPolicyIR {
  defaultProfile: string;
  floorProfile: string;
  allowedProfiles: string[];
  allowEnsemble?: boolean;
}

interface BudgetPolicyIR {
  maxAttempts?: number;
  maxParallel?: number;
  maxBatches?: number;
  maxPremiumDispatches?: number;
  timeoutSeconds?: number;
  onCapExceeded: "checkpoint" | "defer" | "escalate" | "clamp";
}

interface SafetyPolicyIR {
  mutation: MutationPolicy;
  allowedPaths?: string[];
  independentFrom?: string[];
  checkpointOn?: string[];
}
```

## Sweep Pattern Definition Sketch

The source below is illustrative. The proof should test whether this is the
right shape, not bikeshed exact field names.

```yaml
schema_version: "work-pattern-proof-1"
circuit: sweep
source_manifest: skills/sweep/circuit.yaml

work_patterns:
  - id: survey-category
    parent_step: survey
    kind: dynamic_fanout
    unit_id: "survey.{category}"
    dynamic_from: "brief.sweep_type.category_set"
    role: researcher
    completion: all
    max_parallel: 5
    prompt:
      template: research
      header_contract: sweep-category-survey@v1
      include_artifacts: [brief]
      output_contract: category-findings@v1
    skills:
      max: 2
      required: []
      suggested: []
      domain_selected: true
      forbidden: [workers]
      missing_optional: omit_with_receipt_warning
    model_policy:
      default_profile: scan-fast
      floor_profile: scan-fast
      allowed_profiles: [scan-fast, research-standard, research-high]
    budget:
      max_parallel: 5
      on_cap_exceeded: clamp
    safety:
      mutation: read_only
    output_contract: category-findings@v1
    receipt_contract: work-unit-instance@v1
    prose_anchor: "skills/sweep/SKILL.md#phase-survey-analyze"

  - id: prove-evidence
    parent_step: triage
    kind: dynamic_fanout
    unit_id: "prove.{item_id}"
    dynamic_from: "queue.items[action=PROVE]"
    role: researcher
    completion: all
    max_parallel: 3
    prompt:
      template: research
      header_contract: sweep-prove-evidence@v1
      include_artifacts: [brief, analysis, queue]
      output_contract: prove-verdict@v1
    skills:
      max: 2
      required: []
      suggested: []
      domain_selected: true
      forbidden: [workers]
      missing_optional: omit_with_receipt_warning
    model_policy:
      default_profile: research-standard
      floor_profile: research-standard
      allowed_profiles: [research-standard, research-high]
    budget:
      max_parallel: 3
      on_cap_exceeded: checkpoint
    safety:
      mutation: read_only
    output_contract: prove-verdict@v1
    receipt_contract: work-unit-instance@v1
    prose_anchor: "skills/sweep/SKILL.md#evidence-adjudication-deep-standard-with-prove-items"

  - id: execute-batch
    parent_step: execute
    kind: workers_loop
    unit_id: "execute.{batch_id}"
    dynamic_from: "queue.batch_assignment"
    role: implementer
    completion: sequential
    prompt:
      template: implement
      header_contract: sweep-batch-charter@v1
      include_artifacts: [brief, queue]
      output_contract: workers-execute@v1
    skills:
      max: 2
      required: []
      suggested: []
      domain_selected: true
      forbidden: [workers]
      missing_optional: omit_with_receipt_warning
    model_policy:
      default_profile: code-standard
      floor_profile: code-fast
      allowed_profiles: [code-fast, code-standard, code-high]
    budget:
      max_attempts: 3
      on_cap_exceeded: defer
    safety:
      mutation: safe_edit
      checkpoint_on: [public_api, ffi, published_package, prove_high]
    output_contract: batch-result@v1
    receipt_contract: workers-loop-instance@v1
    prose_anchor: "skills/sweep/SKILL.md#phase-batch-execute-act"

  - id: verify-audit
    parent_step: verify
    kind: audit
    unit_id: "verify.audit"
    role: reviewer
    completion: all
    prompt:
      template: ship-review
      header_contract: sweep-independent-audit@v1
      include_artifacts: [brief, queue, batch-results]
      output_contract: review@v1
    skills:
      max: 2
      required: []
      suggested: []
      domain_selected: true
      forbidden: [workers]
      missing_optional: omit_with_receipt_warning
    model_policy:
      default_profile: review-high
      floor_profile: review-high
      allowed_profiles: [review-high, review-critical]
    budget:
      max_attempts: 2
      on_cap_exceeded: checkpoint
    safety:
      mutation: diagnose_only
      independent_from: [execute-batch]
    output_contract: review@v1
    receipt_contract: work-unit-instance@v1
    prose_anchor: "skills/sweep/SKILL.md#phase-verify"
```

## Mode Policy Sketch

Mode behavior should be constrained to fields that either compile statically or
become receipt-enforced runtime caps.

```yaml
mode_policy:
  lite:
    survey-category:
      dynamic_from: "brief.high_confidence_category_set"
      model_policy:
        prefer: scan-fast
    prove-evidence:
      enabled: false
    execute-batch:
      budget:
        max_batches: 1

  deep:
    prove-evidence:
      enabled: true
      model_policy:
        prefer: research-high
    verify-audit:
      model_policy:
        prefer: review-critical

  autonomous:
    execute-batch:
      budget:
        max_batches: 3
        on_cap_exceeded: defer
    verify-audit:
      required: true
    checkpoint_policy:
      auto_continue_when: evidence_clear
      defer_when: human_judgment_required
      halt_when: critical_injection
```

Red line: `mode_policy` must not silently rewrite routes or required artifacts
unless the selected mode compiles to a deterministic runtime manifest snapshot.

## Receipt Examples

### Dynamic survey instance

```json
{
  "work_unit_instance": {
    "schema_version": "1",
    "pattern_id": "survey-category",
    "unit_id": "survey.dead-code",
    "parent_step": "survey",
    "dynamic_source": "brief.sweep_type.category_set",
    "role": "researcher",
    "prompt_template": "research",
    "skills": {
      "requested": ["tdd"],
      "included": ["tdd"],
      "omitted_optional": []
    },
    "compute_selection": {
      "profile": "scan-fast",
      "floor_profile": "scan-fast",
      "allowed_profiles": ["scan-fast", "research-standard", "research-high"],
      "budget_decision": "allowed",
      "adapter": "codex-isolated",
      "binding_source": "model_profiles.scan-fast.codex"
    },
    "safety": {
      "mutation": "read_only"
    }
  }
}
```

### Autonomous batch cap

```json
{
  "work_unit_instance": {
    "schema_version": "1",
    "pattern_id": "execute-batch",
    "unit_id": "execute.batch-4",
    "parent_step": "execute",
    "status": "deferred",
    "budget": {
      "max_batches": 3,
      "decision": "deferred_by_autonomous_cap"
    }
  }
}
```

These receipts stay out of canonical runtime events. Runtime events should
continue to observe only outer request/receipt/result facts unless a later
runtime architecture explicitly adds neutral work-unit state.

## Generated Human Summary Target

A successful proof should generate a compact reviewer view like:

```markdown
# Sweep Work Policy Summary

## Dynamic Work
| Pattern | Step | Instances | Mutation | Profile Floor | Cap |
|---|---|---|---|---|---|
| survey-category | survey | selected categories | read_only | scan-fast | max_parallel 5 |
| prove-evidence | triage | queue PROVE items | read_only | research-standard | max_parallel 3 |
| execute-batch | execute | queue batches | safe_edit | code-fast | sequential, max_attempts 3 |
| verify-audit | verify | one audit | diagnose_only | review-high | max_attempts 2 |

## Mode Differences
| Mode | Difference |
|---|---|
| Lite | high-confidence survey only; PROVE disabled; one execute batch |
| Deep | PROVE enabled; stronger audit profile |
| Autonomous | max three execute batches; defer cap overflow; halt on critical injection |
```

If this summary does not make Sweep easier to review, the architecture should
not advance.

## Projection Target

The proof must keep the runtime manifest compatible with the current v2 shape:

- `frame`
- `survey`
- `triage`
- `execute`
- `verify`
- `deferred`
- `close`

The compiler/projection may add generated summaries and receipt expectations,
but it must not require runtime core to understand work-pattern authoring fields.

## Verification Tasks

1. Write `WorkPatternIR` as a type skeleton or JSON Schema draft.
2. Encode the Sweep sketch above as a fixture.
3. Validate that every pattern has:
   - stable id
   - parent step
   - role
   - prompt policy
   - skill policy
   - model policy
   - budget
   - safety/mutation
   - output contract
   - receipt contract
4. Generate the human summary target.
5. Project the outer v2 manifest unchanged.
6. Validate example receipts against the pattern ids.
7. Review against `skills/sweep/SKILL.md` and mark what remains prose-owned.

## Prose-Owned Judgment

Keep these in SKILL prose, with schema guardrails only:

- how to classify confidence and risk
- how to decide whether a PROVE item is confirmed or KEEP
- how to batch items by blast radius
- how to interpret ambiguous injection findings
- how to write deferred follow-up priorities

Move these into structured policy if the proof succeeds:

- category fanout pattern
- skill budget
- prompt template
- mutation policy
- compute profile floor/default/allowed profiles
- max parallelism
- Autonomous batch cap
- diagnose-only audit requirement

## Decision Gate

After the proof, choose one:

1. Continue with Work-Pattern Policy Compiler and draft a schema RFC.
2. Fall back to a smaller v2 dispatch-policy extension.
3. Stop schema work and instrument receipts first to gather more evidence.
