# ProofAssessment And Evidence Adapter

Status: implementation-spec direction for the Circuit pivot. This is not
current runtime behavior until the matching schema, runtime, tests, docs, and
generated surfaces change.

`ProofAssessment` and `Evidence Adapter` are proposed spec names. In product
prose, say proof check, evidence check, or converting checks into evidence.

## Purpose

Circuit needs a proof layer that is stronger than "the report has the right
shape" or "the agent said it is done."

The rule is:

> A claim is proven only when runtime evidence covers it. Agent prose and report
> shape are not proof.

Today, Circuit already has useful proof inputs: relay verdict checks,
acceptance criteria, verification commands, report schemas, close reports,
trace hashes, generated-surface drift checks, and Fix change-set checks. This
spec turns those inputs into a shared proof check:

- `Claim` says what must be true.
- `Evidence` says what the runtime observed.
- `ProofAssessment` says whether each claim is proven, weak, contradicted, or
  unproved.
- The Evidence Adapter converts today's acceptance criteria and checks into
  evidence without letting them close write-capable work by themselves.

## Source Evidence

- The pivot brief says acceptance-criteria-only proof must be replaced with
  Claim, Evidence, and ProofAssessment, and says agent prose is not proof. See
  [pivot-brief.md](pivot-brief.md#proof-and-recovery-model).
- The pivot brief says acceptance criteria should become Evidence and feed
  ProofAssessment, with claim coverage coming from WorkContract proof policy.
  See [pivot-brief.md](pivot-brief.md#acceptancecriteria-to-evidence-adapter).
- WorkContract Projection V0 classifies acceptance criteria as contract proof
  inputs that cannot close write-capable work by themselves. See
  [work-contract-projection-v0.md](work-contract-projection-v0.md).
- GuidanceDecision Trace Invariant requires proof policy guidance before proof
  assessment and says write-capable completion requires proof assessment refs.
  See
  [guidance-decision-trace-invariant.md](guidance-decision-trace-invariant.md#proof-policy).
- PolicyEnvelope Config V2 says proof requirements are hard rules that compose
  restrictively. See
  [policy-envelope-config-v2-cutover.md](policy-envelope-config-v2-cutover.md#hard-constraint-composition).
- CheckpointBoundary Authority routes weak proof through checkpoint, policy, or
  declared recovery, not hidden automatic action. See
  [checkpoint-boundary-authority.md](checkpoint-boundary-authority.md).
- Ubiquitous Language defines Acceptance criteria, Trace, Report, Evidence,
  Run folder, Relay, Check, and Generated surface. See
  [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md).
- Current acceptance criteria support only command checks and report-field
  checks, with `hard-fail` or `retry-with-feedback`. See
  [src/schemas/acceptance-criteria.ts](../../../src/schemas/acceptance-criteria.ts).
- Current acceptance criteria evaluation parses relay result JSON, checks report
  fields, runs proof-plan commands, and returns retry feedback. See
  [src/runtime/acceptance-criteria.ts](../../../src/runtime/acceptance-criteria.ts).
- Current relay execution writes request/result hashes, parses report schemas,
  runs acceptance criteria after the result-verdict check passes, writes
  `check.evaluated` entries, and may retry with feedback. See
  [src/runtime/executors/relay.ts](../../../src/runtime/executors/relay.ts).
- Current trace accepts `check.evaluated` entries with acceptance-criteria
  fields, relay request hashes, relay result hashes, report-written entries,
  fanout entries, and run close entries, but has no ProofAssessment event. See
  [src/schemas/trace-entry.ts](../../../src/schemas/trace-entry.ts).
- Current verification execution runs verification commands through the shared
  proof-plan executor, writes verification reports, and routes on
  `overall_status`. See
  [src/runtime/executors/verification.ts](../../../src/runtime/executors/verification.ts),
  [src/shared/proof-plan.ts](../../../src/shared/proof-plan.ts), and
  [src/schemas/verification.ts](../../../src/schemas/verification.ts).
- Current close writers read upstream reports and write final result reports
  with evidence links, but run close still depends on routes and the latest
  admitted verdict. See
  [src/flows/registries/close-writers/types.ts](../../../src/flows/registries/close-writers/types.ts),
  [src/runtime/run/graph-runner.ts](../../../src/runtime/run/graph-runner.ts),
  and [src/runtime/run/result-writer.ts](../../../src/runtime/run/result-writer.ts).
- Current Fix proof reports already show the intended direction: regression
  proof, regression rerun, verification, and change-set status all constrain
  the final Fix outcome. See
  [src/flows/fix/reports.ts](../../../src/flows/fix/reports.ts) and
  [src/flows/fix/writers/result-projection.ts](../../../src/flows/fix/writers/result-projection.ts).
- Current Fix change-set evidence is runtime-owned: it compares before and
  after git state, catches undeclared touched files, HEAD movement, hidden index
  flags, and baseline-dirty mutation. See
  [src/flows/fix/writers/baseline-snapshot.ts](../../../src/flows/fix/writers/baseline-snapshot.ts),
  [src/flows/fix/writers/change-set.ts](../../../src/flows/fix/writers/change-set.ts),
  and
  [tests/runner/fix-change-set-writer.test.ts](../../../tests/runner/fix-change-set-writer.test.ts).
- Current Goal already has a claim/evidence-shaped flow-local model, but it is
  not yet the shared runtime proof model. See
  [src/flows/goal/reports.ts](../../../src/flows/goal/reports.ts).
- Current tests prove acceptance criteria failure, command-output tracing,
  retry feedback, and max-attempt bounds. See
  [tests/runtime/control-loop.test.ts](../../../tests/runtime/control-loop.test.ts).
- Current generated surfaces are source-owned and drift-checked; generated
  proof must use the emit check or generated-surface proof, not prose. See
  [docs/generated-surfaces.md](../../generated-surfaces.md).

## Target Shapes

### Claim

```ts
type Claim = {
  schema_version: 1;
  id: ClaimId;
  kind:
    | 'bug_fixed'
    | 'behavior_changed'
    | 'test_added'
    | 'docs_changed'
    | 'refactor_only'
    | 'generated_surface_synced'
    | 'absence_of_change'
    | 'scope_respected'
    | 'verification_passed'
    | 'review_clean';
  statement: string;
  scope_refs: Ref[];
  risk: 'low' | 'medium' | 'high';
  required: boolean;
  source: 'work_contract' | 'runtime' | 'operator';
};
```

Plain meaning: a claim is one thing Circuit might need to prove.

Rules:

- WorkContract proof policy creates the required claim set.
- Runtime may add derived claims such as `scope_respected` or
  `absence_of_change` when it computes diff or touched-file evidence.
- Operator input may add a required claim only through a traced policy or
  checkpoint decision.
- Worker reports may suggest claims, but they cannot add required claims or
  mark claims proven.
- A worker-authored claim can be recorded only as report evidence or as an
  unproved suggested claim. It is not a valid required-claim source.
- Unsupported worker claims are either ignored as prose or recorded as unproved
  claims. They do not expand authority.

### Evidence

```ts
type Evidence = {
  schema_version: 1;
  id: EvidenceId;
  kind:
    | 'command'
    | 'report_field'
    | 'diff'
    | 'generated_surface'
    | 'review'
    | 'report'
    | 'trace'
    | 'source_citation'
    | 'absence_of_change';
  producer: 'runtime' | 'worker' | 'independent_worker' | 'operator';
  independence: 'self' | 'runtime' | 'independent' | 'external';
  ref: Ref;
  input_refs: Ref[];
  covers_claims: ClaimId[];
  result: 'pass' | 'fail' | 'unknown';
  summary?: string;
};
```

Plain meaning: evidence is something Circuit can point at.

Rules:

- Evidence refs must be stable and hashed when they point to content.
- `covers_claims` is assigned by the runtime from WorkContract proof policy,
  not by worker prose.
- `producer: "worker"` with `independence: "self"` may support context, but it
  cannot prove a write-capable completion claim by itself.
- `result: "unknown"` is allowed only when the evidence records an input whose
  value is not enough to prove or disprove a claim.
- Required coverage can use only `result: "pass"`. Unknown evidence can explain
  context or gaps, but it cannot prove a claim.

### ProofAssessment

```ts
type ProofAssessment = {
  schema_version: 1;
  assessment_id: ProofAssessmentId;
  scope: {
    run_id: RunId;
    flow_id: CompiledFlowId;
    step_id?: StepId;
    attempt?: number;
  };
  proof_policy_decision_id: GuidanceDecisionId;
  claims: Claim[];
  evidence: Evidence[];
  results: ProofAssessmentResult[];
  overall_status: 'proven' | 'weak' | 'contradicted' | 'unproved';
  close_allowed: boolean;
};

type ProofAssessmentResult = {
  claim_id: ClaimId;
  status: 'proven' | 'weak' | 'contradicted' | 'unproved';
  evidence_refs: EvidenceId[];
  missing: string[];
  contradictions: string[];
  recovery?: {
    route_id: DeclaredRouteId;
    kind: RecoveryRouteKind;
    reason_code: string;
  };
};
```

Plain meaning: a proof assessment is Circuit's judgment over the evidence.

Rules:

- Every required claim must have exactly one assessment result.
- `overall_status` is the worst required-claim status, ordered as
  `contradicted`, `unproved`, `weak`, `proven`.
- `close_allowed` is true only when the WorkContract close rules and policy
  rules are satisfied.
- A proof assessment must reference the matching `proof_policy`
  GuidanceDecision.
- Recovery route ids must be declared by the WorkContract.
- A proven result does not list recovery. A weak, contradicted, or unproved
  result lists recovery only when the WorkContract declares a matching recovery
  route; otherwise `missing` or `contradictions` must say that no declared
  recovery route exists.

## Claim Coverage

Claim coverage connects required claims to allowed evidence.

V0 should put coverage in the WorkContract proof policy, not inside today's
acceptance-criteria schema.

```ts
type ClaimCoverageRule = {
  claim_id: ClaimId;
  required_evidence: Array<{
    kind: Evidence['kind'];
    min_result: 'pass';
    min_independence: 'runtime' | 'independent' | 'external';
    refs?: Ref[];
    accepted_sources?: string[];
  }>;
  optional_evidence?: Array<{
    kind: Evidence['kind'];
    refs?: Ref[];
  }>;
};
```

Rules:

- Acceptance criteria do not need a new `covers_claims` field in their old
  schema. The adapter may map criterion ids to claim ids through
  WorkContract proof policy.
- Report fields can prove that a worker supplied a field. They do not prove the
  field is true unless paired with runtime or independent evidence.
- Verification commands can cover a claim only when the WorkContract names the
  command, command family, or proof profile that makes that command relevant.
- Diff and generated-surface coverage must come from runtime-computed evidence,
  not a worker's `changed_files` list.
- Independent review coverage requires a reviewer that is separate from the
  worker whose claim is being reviewed.

Example:

```ts
{
  claim_id: 'scope-respected',
  required_evidence: [
    { kind: 'diff', min_result: 'pass', min_independence: 'runtime' },
  ],
}
```

Example:

```ts
{
  claim_id: 'implementation-has-evidence-field',
  required_evidence: [
    {
      kind: 'report_field',
      min_result: 'pass',
      min_independence: 'runtime',
      accepted_sources: ['acceptance_criteria:evidence-non-empty'],
    },
  ],
}
```

That second claim proves only that the report had a non-empty evidence field.
It does not prove the implementation worked.

## AcceptanceCriteria To Evidence Adapter

The adapter converts current acceptance criteria and `check.evaluated` entries
into Evidence.

Current acceptance criteria remain useful because they are deterministic,
runtime-run checks. They are too narrow to be the whole proof system.

### Command Criterion

Current shape:

```ts
{
  kind: 'command',
  id: 'command-must-pass',
  command: VerificationCommand,
  expected_status: 'passed',
}
```

Evidence output:

```ts
{
  kind: 'command',
  producer: 'runtime',
  independence: 'runtime',
  ref: { kind: 'command', ref: 'trace.ndjson#sequence=<check>', sha256: '<hash>' },
  input_refs: [
    { kind: 'work_contract', ref: '<criterion-ref>', sha256: '<hash>' },
    { kind: 'trace', ref: 'trace.ndjson#sequence=<relay-request>', sequence: 4 },
  ],
  covers_claims: ['<from WorkContract coverage>'],
  result: 'pass' | 'fail',
}
```

Rules:

- The command must be run by Circuit through the proof-plan command runner or
  a future equivalent runtime command runner.
- The evidence must include exit code, status, stdout summary, stderr summary,
  command id, cwd, argv, timeout, and output cap either directly or through a
  content ref.
- A worker saying "I ran tests" produces no command evidence.
- A command that cannot run because the project root, cwd, package script, or
  executable is invalid produces failed or blocked proof, not proven proof.

### Report-Field Criterion

Current shape:

```ts
{
  kind: 'report_field',
  id: 'evidence-non-empty',
  path: ['evidence'],
  predicate: 'non_empty',
}
```

Evidence output:

```ts
{
  kind: 'report_field',
  producer: 'runtime',
  independence: 'runtime',
  ref: { kind: 'trace', ref: 'trace.ndjson#sequence=<check>', sequence: 7 },
  input_refs: [
    { kind: 'evidence', ref: 'reports/relay/<step>.result.json', sha256: '<hash>' },
  ],
  covers_claims: ['<from WorkContract coverage>'],
  result: 'pass' | 'fail',
}
```

Rules:

- Report-field evidence proves the field was present or non-empty in the
  checked JSON body.
- The checked body is the relay result body. It may exist even when the
  canonical typed report was not written because acceptance failed.
- It does not prove the content is true.
- A report-field pass may support low-level claims such as
  `worker-declared-changed-files` or `worker-supplied-evidence-field`.
- It cannot by itself prove `bug_fixed`, `scope_respected`,
  `generated_surface_synced`, or `verification_passed`.
- Failed report-field criteria produce failed evidence and usually
  `weak`, `unproved`, or `contradicted` proof assessment depending on the
  claim.

### Failure Policy

Current `on_failure` maps into recovery:

| Current failure policy | Evidence result | Proof result | Recovery |
| --- | --- | --- | --- |
| `hard-fail` | failed Evidence | `contradicted` or `unproved` for covered claims | declared stop, escalation, or fail route |
| `retry-with-feedback` | failed Evidence plus retry feedback | `weak`, `unproved`, or `contradicted` until a later attempt proves the claim | `retry_same_step_with_feedback` |

Retry does not erase failed evidence. Later passing evidence may prove the claim,
but the assessment should keep refs to failed earlier attempts when they matter
for recovery and audit.

## Evidence Rules

### Command Evidence

Command evidence is runtime-captured command output.

Required:

- command spec ref;
- exit code and pass/fail status;
- stdout and stderr summaries or hashed refs;
- project root and cwd policy result;
- trace ref for the command-producing check or verification step.

Command evidence can prove verification and regression claims only when the
WorkContract coverage rule says the command is relevant.

### Diff Evidence

Diff evidence is runtime-computed change evidence.

Required:

- base ref or baseline snapshot ref;
- current tree or post-change ref;
- touched files computed by Circuit;
- patch or diff hash when a patch exists;
- hidden-file or dirty-state policy result when relevant.

Worker-reported `changed_files` is a claim input. It is not diff evidence.
Current Fix change-set proof is the closest repo precedent: runtime compares
baseline and post-fix git state, then fails when observed touched files differ
from the worker's declaration.

### Generated-Surface Evidence

Generated-surface evidence proves generated mirrors are in sync.

Required:

- source refs;
- generated output refs;
- command evidence for the emit or drift check;
- pass/fail status;
- list of generated surfaces covered.

For this repo, the relevant current check is the emit drift check described in
[docs/generated-surfaces.md](../../generated-surfaces.md). A worker report that
says "generated surfaces updated" is not generated-surface evidence.

### Review Evidence

Review evidence is a reviewer judgment over claims and evidence.

Required:

- reviewer producer;
- reviewed claim ids;
- reviewed evidence refs;
- verdict;
- findings or limitations;
- independence.

Rules:

- `independence: "self"` cannot satisfy an independent-review requirement.
- A review report with no evidence refs may still be useful context, but it is
  weak proof.
- A clean review cannot prove absence of defects outside its declared scope.
- Findings with medium, high, or critical severity usually contradict or weaken
  affected completion claims.

### Report Evidence

Report evidence proves a typed report exists, parses, and was written at the
declared path.

Required:

- report path;
- report schema;
- hash of the report body;
- `step.report_written` trace ref when the report is runtime-written;
- parser result.

Rules:

- Report evidence proves report shape and existence.
- Report evidence does not prove worker assertions inside the report.
- `evidence_links` in a close report are pointers. They are not proof unless
  the pointed-to reports and runtime evidence satisfy claim coverage.

### Trace Evidence

Trace evidence proves an event was recorded in the run trace.

Required:

- trace sequence;
- trace kind;
- run id;
- relevant step id and attempt when present;
- hash when the trace entry is referenced as content.

Trace evidence can prove facts such as "relay request hash X was submitted" or
"checkpoint choice Y was resolved." It cannot prove that a worker's claim is
true unless paired with evidence that covers that claim.

### Source-Citation Evidence

Source-citation evidence supports research and review claims.

Required:

- source ref;
- excerpt or summary ref;
- producer;
- scope note.

Source citations are useful for Explore and Review. They do not prove code
change behavior without command, diff, review, or generated-surface evidence
when those are required by the WorkContract.

### Absence-Of-Change Evidence

Absence-of-change evidence proves something did not change.

Required:

- before ref;
- after ref;
- runtime-computed comparison;
- covered path or glob list.

Use this for claims such as `refactor_only`, `absence_of_change`, protected
files untouched, or generated files unchanged.

## Proof Status Rules

| Status | Meaning | Typical recovery |
| --- | --- | --- |
| `proven` | Required coverage passed, no contradiction, independence satisfied. | May continue or close if every required claim is proven. |
| `weak` | Some evidence exists, but coverage, independence, scope, or command strength is insufficient. | Run verification, run independent review, checkpoint, or narrow scope. |
| `contradicted` | Evidence conflicts with the claim. | Retry, reject safe apply, stop unsafe, or checkpoint. |
| `unproved` | No relevant evidence covers the claim. | Run verification, ask, narrow, or stop. |

Weak proof is not success. It means Circuit needs a recovery path.

## Weak-Proof Recovery

Recovery must use declared WorkContract routes and typed recovery kinds.

| Condition | Proof status | Recovery kind |
| --- | --- | --- |
| Command missing or blocked | `unproved` | `run_verification` or `checkpoint` |
| Command failed for a required claim | `contradicted` | `retry_same_step_with_feedback`, `run_verification`, or `stop_unsafe` |
| Report field present but no runtime evidence | `weak` | `run_verification` or `run_independent_review` |
| Worker changed files differ from runtime diff | `contradicted` | `retry_same_step_with_feedback`, `safe_apply_reject`, or `stop_unsafe` |
| Generated surface drift without drift proof | `unproved` or `contradicted` | `run_verification` with generated-surface evidence, or `safe_apply_reject` |
| Independent review required but self-review only | `weak` | `run_independent_review` |
| Protected files touched without authority | `contradicted` | `checkpoint` or `safe_apply_reject` |
| Repeated weak proof after retry budget | `weak` | `stop_unsafe` or `escalate` |

If the WorkContract does not declare a matching recovery route, guidance must
route to a declared stop, escalation, ask, or contract-missing path. It must not
invent a new route.

The V0 assessment may omit `recovery` when no declared route matches. That is
not permission to continue; it is an explicit proof gap that the next recovery
slice must route to a declared stop, escalation, ask, or contract-missing path.

## Write-Capable Close Rules

Write-capable work can close as complete only when the WorkContract marks the
scope as write-capable and all required close claims are proven.

Minimum close gate:

1. There is a matching `proof_policy` GuidanceDecision.
2. Every required claim has one ProofAssessment result.
3. Every required claim is `proven`.
4. No required or high-risk optional claim is `contradicted`.
5. Runtime diff or ChangePacket evidence exists for touched files.
6. Generated-surface claims have generated-surface evidence when generated
   outputs are touched or required by policy.
7. Independent review evidence exists when WorkContract or PolicyEnvelope
   requires it.
8. SafeApply evidence exists once SafeApply is active. Before SafeApply, the
   trusted-write path must be explicitly classified and diff-captured.
9. The close report points to ProofAssessment refs, not just upstream reports.
10. `run.closed: complete` references or is sequence-validated against the
    passing ProofAssessment.

Report schemas such as `build.result@v1`, `fix.result@v1`, and
`pursuit.result@v1` can keep their current outcome fields. The cutover adds a
runtime proof gate beneath them. A close writer can summarize proof; it cannot
replace ProofAssessment.

Read-only flows may close with weaker evidence if the WorkContract says the
claims are low risk and policy allows it, but the result should still say
whether claims are proven, weak, contradicted, or unproved.

## Current Field Projection

| Current surface | V0 fate | Rule |
| --- | --- | --- |
| `AcceptanceCriteria.checks[].kind: "command"` | Evidence input | Produces runtime command Evidence. Does not close work by itself. |
| `AcceptanceCriteria.checks[].kind: "report_field"` | Evidence input | Produces report-field Evidence. Proves shape/presence only. |
| `AcceptanceCriteria.on_failure: "hard-fail"` | Recovery input | Failed evidence routes to declared failure, stop, or escalation. |
| `AcceptanceCriteria.on_failure: "retry-with-feedback"` | Recovery input | Failed evidence may route to same-step retry with feedback. Retry needs a declared route and budget. |
| `check.evaluated` | Evidence input | Becomes trace evidence and may back command/report-field evidence. |
| `result_verdict` check | Evidence input | Admits worker result verdict. It is not proof of the claim itself. |
| `schema_sections` check | Evidence input | Proves required report sections exist. It is report-shape evidence. |
| `step.report_written` | Report evidence input | Proves a typed report was written. |
| Relay `result_report_hash` | Evidence ref | Binds the worker result body. |
| Relay report schema parse | Report evidence input | Proves the response matches schema. It does not prove truth. |
| Verification reports | Command evidence input | Commands become Evidence; `overall_status` summarizes command evidence. |
| Close `evidence_links` | Evidence refs | Useful pointers, but not proof unless covered by ProofAssessment. |
| Fix regression proof and rerun reports | Claim evidence input | Strong precedent for command-backed bug-fix proof. |
| Fix change-set report | Diff evidence input | Strong precedent for runtime-computed touched files. |
| Goal evidence evaluation | Flow-local precedent | Useful shape, but shared ProofAssessment owns the future model. |
| Generated-surface drift checks | Generated-surface evidence | Drift proof must be runtime command evidence plus generated refs. |
| Agent report `evidence` string arrays | Worker context | Never sufficient proof for write-capable close. |

## Trace Model

V0 adds a first-class proof trace entry. A normal `step.report_written` entry is
not enough because it proves a file was written, not that the claims were
assessed.

```ts
type ProofAssessedTraceEntry = TraceEntryBase & {
  kind: 'proof.assessed';
  assessment_id: ProofAssessmentId;
  scope: {
    run_id: RunId;
    flow_id: CompiledFlowId;
    step_id?: StepId;
    attempt?: number;
  };
  proof_policy_decision_id: GuidanceDecisionId;
  assessment_ref: Ref;
  overall_status: 'proven' | 'weak' | 'contradicted' | 'unproved';
  close_allowed: boolean;
};
```

Sequence rules:

- `proof.assessed` requires a preceding matching `guidance.decision` with
  subject `proof_policy`.
- `proof.assessed.assessment_ref` must point to the durable ProofAssessment
  report or evidence file.
- A write-capable `run.closed: complete` requires a preceding `proof.assessed`
  with `overall_status: "proven"` and `close_allowed: true`.
- A recovery route selected because proof is weak requires a preceding
  `guidance.decision` with subject `recovery_route` that references the
  ProofAssessment.

## Generated Surface Rules

- Generated compiled manifests should include or reference WorkContract proof
  policy: claims, coverage rules, required evidence kinds, and close rules.
- Generated host command and skill surfaces should say Circuit checks evidence,
  not that a report shape proves completion.
- Generated docs must not tell operators to trust worker prose as proof.
- Generated drift checks must include any generated proof-policy mirrors.
- Do not hand-edit generated host mirrors. Change source files or emit scripts,
  regenerate, and run drift checks.

## Death Tests

Schema tests:

- `Claim` rejects empty `id`, empty `statement`, empty `scope_refs`, unsupported
  `kind`, and worker-authored `source`.
- `Evidence` rejects content refs without hashes.
- `Evidence` rejects worker-produced command, diff, generated-surface, and
  absence-of-change evidence.
- `Evidence` rejects command, diff, generated-surface, review, report, and
  trace proof without the required runtime refs named by that evidence kind.
- `Evidence` rejects `covers_claims` values not declared by WorkContract proof
  policy.
- `ProofAssessment` rejects missing assessment results for required claims.
- `ProofAssessment` rejects duplicate assessment results for one claim.
- `ProofAssessment` rejects `status: "proven"` when required evidence coverage
  is missing.
- `ProofAssessment` rejects `status: "proven"` when the covering evidence lacks
  required runtime refs, command refs, diff refs, generated-surface refs, or
  trace refs.
- `ProofAssessment` rejects `close_allowed: true` unless all required claims are
  proven and no required claim is contradicted.
- `ProofAssessment` rejects recovery on proven results.
- Runtime proof assessment never invents route ids. If no WorkContract recovery
  route matches the proof outcome, the result omits `recovery` and records that
  no declared recovery route covers the outcome.

Acceptance adapter tests:

- Command acceptance criteria produce command Evidence with runtime producer,
  command details, trace refs, and pass/fail result.
- Report-field acceptance criteria produce report-field Evidence, not proof of
  the report field's truth.
- Acceptance criteria pass cannot by itself close write-capable work.
- Acceptance criteria failure with `retry-with-feedback` produces failed
  Evidence and a recovery route, then later passing evidence may prove the
  claim.
- Acceptance criteria failure with `hard-fail` cannot be converted into weak
  success.
- A report-field criterion checking `evidence` non-empty cannot prove
  `bug_fixed`, `generated_surface_synced`, `scope_respected`, or
  `verification_passed`.

Runtime and trace tests:

- `RunTrace` accepts `proof.assessed` only with matching prior proof-policy
  GuidanceDecision.
- `RunTrace` rejects write-capable `run.closed: complete` without a passing
  ProofAssessment ref.
- `RunTrace` rejects proof recovery routes without recovery GuidanceDecision
  refs.
- Relay result schema pass plus report-field acceptance pass still leaves
  write-capable close blocked until ProofAssessment proves required claims.
- Runtime command output, not worker prose, is required for command evidence.
- Runtime diff/touched-file evidence overrides worker `changed_files`.
- Generated-surface drift blocks complete unless generated-surface evidence
  proves drift is resolved or no generated surfaces were touched.
- Independent review requirements fail on self-review evidence.

Close tests:

- Build cannot close `complete` only from `build.result@v1` shape; it needs
  ProofAssessment refs.
- Fix cannot close `fixed` when regression proof, regression rerun,
  verification, change-set, or required review claim is weak, contradicted, or
  unproved.
- Pursue cannot close `complete` when any required child claim is weak,
  contradicted, unproved, blocked, or failed.
- Read-only flow completion must surface weak or unproved claims instead of
  silently calling them proven.

Generated-surface tests:

- Generated manifests include proof policy refs or fail drift checks.
- Generated host surfaces do not say report shape proves completion.
- Generated host surfaces do not tell users to trust agent prose as proof.
- Generated docs use evidence, report, trace, and proof check in plain language.

## Anti-Cruft Probes

Run these during the implementation branch. Some should fail until the cutover
lands.

```bash
rg -n "ProofAssessment|proof\\.assessed|ClaimCoverage|covers_claims|Evidence Adapter" \
  src tests docs generated plugins
```

Expected hard-cut state: shared schemas, trace tests, and runtime close tests
exist. Mentions in pivot docs are not enough.

```bash
rg -n "acceptance_criteria|check_kind: 'acceptance_criteria'|check_kind: \"acceptance_criteria\"" \
  src tests generated
```

Expected hard-cut state: acceptance criteria still exist, but are adapted into
Evidence and cannot close write-capable work by themselves.

```bash
rg -n "evidence:\\s*\\[|evidence_links|changed_files|verification_status|review_verdict" \
  src/flows tests generated
```

Expected hard-cut state: these report fields are inputs or summaries. They are
not the final proof authority unless tied to ProofAssessment.

```bash
rg -n "run\\.closed|outcome:\\s*['\\\"]complete['\\\"]|latestAdmittedVerdict|writeRuntimeRunResult" \
  src/runtime tests
```

Expected hard-cut state: write-capable complete paths require ProofAssessment
refs, not only terminal route and latest admitted verdict.

```bash
rg -n "emit\\.ts --check|check-flow-drift|generated_surface|generated surface|generated-surface" \
  docs src tests generated plugins
```

Expected hard-cut state: generated-surface proof is a command-backed evidence
kind or explicit absence-of-change evidence, not prose.

## Implementation Order

1. Add shared Claim, Evidence, ProofAssessment, and ClaimCoverageRule schemas.
2. Add the acceptance-criteria-to-evidence adapter without changing current
   relay behavior.
3. Add proof-policy GuidanceDecision matching for proof assessment.
4. Add `proof.assessed` trace entries and sequence validation.
5. Add write-capable close gates that require passing ProofAssessment refs.
6. Add diff/touched-file evidence for write-capable relays and ChangePacket
   preparation.
7. Add generated-surface evidence and drift-proof gates.
8. Update generated surfaces through source files and emit scripts.

Do not build SafeApply before ProofAssessment exists. SafeApply needs proof
refs to know whether a proposed change can be applied.

## Still Unsettled

- Exact file path for durable ProofAssessment records.
- Whether proof assessment is one report per step, one report per run, or both.
- Exact `RecoveryRouteKind` enum names.
- Exact generated-surface evidence shape.
- Whether existing flow-local Goal evidence evaluation migrates to the shared
  ProofAssessment shape or stays flow-local until a later slice.
- Whether the first cutover blocks all write-capable close paths or starts with
  Build, Fix, and Pursue only.
- Exact treatment of low-risk read-only claims when proof is weak.

## Review Record

Draft review attacked these risks:

- report-field checks accidentally proving behavior;
- close reports becoming a second proof system;
- generated-surface sync being asserted by prose;
- worker `changed_files` being trusted over runtime diff;
- weak proof closing write-capable work;
- unsupported worker claims expanding the contract.

The first draft pass found medium risks: the trace model left a report-written
escape hatch, report-field evidence pointed at raw relay output as if it were a
typed report, `result: "unknown"` could be misread as enough for required
coverage, and write-capable close did not say the WorkContract marks the scope.

The second draft pass found one medium gap: death tests did not explicitly fail
proof when required runtime refs were missing.

Those issues are resolved here: V0 uses a first-class `proof.assessed` trace
entry, report-field evidence points at raw relay output as evidence, unknown
evidence cannot prove required coverage, write-capable close is explicitly
gated by WorkContract plus ProofAssessment, and missing runtime refs are death
tests for Evidence and ProofAssessment.

Completion still requires two consecutive adversarial reviews with no
medium-or-above findings after this revision.
