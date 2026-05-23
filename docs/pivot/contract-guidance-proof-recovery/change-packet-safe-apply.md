# ChangePacket And SafeApply

Status: implementation-spec direction, not current runtime truth.

This spec defines the first safe-apply slice for the Circuit pivot. It is
docs-only. It does not change runtime code, schemas, tests, or generated host
surfaces.

Plain rule:

> Agents propose changes. Circuit checks them. Circuit applies or rejects them.

## Source Evidence

This spec is grounded in the current pivot docs and local repo evidence:

| Source | Evidence used |
| --- | --- |
| [Pivot brief](pivot-brief.md) | Safe apply is a runtime boundary, not a Pursue-only feature. The target ChangePacket includes base refs, patch refs and hashes, runtime touched files, claims, evidence, proof refs, risks, protected-file and generated-surface checks, final verification, and an apply recommendation. See `pivot-brief.md:678-732`. |
| [WorkContract Projection V0](work-contract-projection-v0.md) | WorkContract owns write authority, proof requirements, recovery routes, and the rule that writable branches stay serial until SafeApply exists. See `work-contract-projection-v0.md:55-73` and `work-contract-projection-v0.md:114-122`. |
| [GuidanceDecision Trace Invariant](guidance-decision-trace-invariant.md) | SafeApply choices must be traced by `guidance.decision.subject === "safe_apply"` before accept, reject, or apply. See `guidance-decision-trace-invariant.md:312-330` and `guidance-decision-trace-invariant.md:351-356`. |
| [PolicyEnvelope Config V2 Cutover](policy-envelope-config-v2-cutover.md) | Policy owns hard rules and limits; it can tighten budget and write limits but cannot loosen contract authority without an explicit policy change. See `policy-envelope-config-v2-cutover.md:245-265` and `policy-envelope-config-v2-cutover.md:337-345`. |
| [CheckpointBoundary Authority](checkpoint-boundary-authority.md) | Protected files, unsafe apply, and budget boundaries become checkpoint reasons with declared choices and traced resolution. See `checkpoint-boundary-authority.md:340-352` and `checkpoint-boundary-authority.md:547-552`. |
| [ProofAssessment And Evidence Adapter](proof-assessment-evidence-adapter.md) | Runtime diff evidence, generated-surface evidence, and write-capable close rules feed ProofAssessment. See `proof-assessment-evidence-adapter.md:420-456` and `proof-assessment-evidence-adapter.md:575-595`. |
| [RecoveryRouteKind](recovery-route-kind.md) | Apply conflicts, weak proof, unsafe retry, and safe-apply reject have typed recovery routes. See `recovery-route-kind.md:462-485`, `recovery-route-kind.md:615-630`, and `recovery-route-kind.md:854-862`. |
| [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md) | Use current Circuit vocabulary: flow, schematic, block, route, relay, connector, trace, report, evidence, and checkpoint. See `UBIQUITOUS_LANGUAGE.md:128-142` and `UBIQUITOUS_LANGUAGE.md:221-232`. |
| [Pursue docs](../../flows/pursue.md) | Pursue V1 serializes code-changing work until runtime-owned safe apply exists. Estimated touch sets are not proof. See `docs/flows/pursue.md:22-67` and `docs/flows/pursue.md:180-215`. |
| [Pursue contract projection](../../../src/flows/pursue/writers/contract-projection.ts) | Current Pursue reports `code_writes: "serial-only"` and `parallel_write_status: "blocked-until-safe-apply"`. See `src/flows/pursue/writers/contract-projection.ts:1-112`. |
| [Pursue graph writer](../../../src/flows/pursue/writers/graph.ts) | Current Pursue serializes all code-changing work and treats read-only discovery differently. See `src/flows/pursue/writers/graph.ts:1-87`. |
| [Pursue runtime test](../../../tests/runner/pursue-runtime-wiring.test.ts) | Current tests assert serialized code-changing execution and `serial_code_writes === true`. See `tests/runner/pursue-runtime-wiring.test.ts:1-213`. |
| [Fanout executor](../../../src/runtime/executors/fanout.ts) | Writable relay fanout is serialized because branches share the parent checkout. Sub-run branches may use worktrees and discover changed files. See `src/runtime/executors/fanout.ts:1-95`, `src/runtime/executors/fanout.ts:170-286`, and `src/runtime/executors/fanout.ts:286-330`. |
| [Worktree runner](../../../src/runtime/fanout/worktree.ts) | Current worktree support creates/removes git worktrees and computes changed files using `git diff --name-only`. See `src/runtime/fanout/worktree.ts:1-42`. |
| [Fanout join policy](../../../src/shared/fanout-join-policy.ts) | Current `disjoint-merge` only checks branch admission, changed-file discovery, and file overlap. File disjointness is not enough for SafeApply. See `src/shared/fanout-join-policy.ts:1-95`. |
| [Fanout tests](../../../tests/runtime/fanout.test.ts) | Current tests reject relay branch disjoint-merge, reject overlapping files, fail changed-file discovery errors, and clean up worktrees. See `tests/runtime/fanout.test.ts:813-895`, `tests/runtime/fanout.test.ts:1153-1240`, and `tests/runtime/fanout.test.ts:1634-1678`. |
| [Relay executor](../../../src/runtime/executors/relay.ts) | Current relays write request/result files and pass `context.projectRoot` as connector cwd, so write-capable connectors can mutate the checkout today. See `src/runtime/executors/relay.ts:419-512` and `src/runtime/executors/relay.ts:575-610`. |
| [Connector resolver](../../../src/runtime/connectors/resolver.ts) | Current connector resolution rejects read-only connectors for implementer relays. See `src/runtime/connectors/resolver.ts:46-58`. |
| [Codex connector](../../../src/connectors/codex.ts) | Current Codex connector is write-capable and forces workspace-write behavior. See `src/connectors/codex.ts:15-29` and `src/connectors/codex.ts:97-115`. |
| [Claude Code connector](../../../src/connectors/claude-code.ts) | Current Claude Code connector can expose write tools and bypass-related flags must be guarded. See `src/connectors/claude-code.ts:23-43` and `src/connectors/claude-code.ts:31-80`. |
| [Fix change-set writer](../../../src/flows/fix/writers/change-set-projection.ts) | Fix already compares worker-declared files against runtime-observed changes, detects HEAD movement, and fails closed on hidden index flags. See `src/flows/fix/writers/change-set-projection.ts:58-146`. |
| [Fix reports](../../../src/flows/fix/reports.ts) | Fix baseline/change-set schemas capture dirty paths, fingerprints, hidden index flags, observed files, declared files, HEAD divergence, and close-blocking failures. See `src/flows/fix/reports.ts:420-606`. |
| [Fix change-set tests](../../../tests/runner/fix-change-set-writer.test.ts) | Tests prove undeclared extras, missing declared files, baseline-dirty mutation, HEAD divergence, hidden index flags, renames, and paths with spaces. See `tests/runner/fix-change-set-writer.test.ts:215-690`. |
| [Generated surfaces map](../../generated-surfaces.md) | Generated host surfaces are source-owned and drift-checked; do not hand-edit mirrors. See `docs/generated-surfaces.md:1-70`. |

## Terms

Keep product wording plain. Formal names are allowed in schemas, tests, and spec
sections.

| Formal name | Plain wording |
| --- | --- |
| `ChangePacket` | proposed change |
| `SafeApply` | check and apply path |
| `base.ref` | starting commit or tree |
| `tree_hash` | tree fingerprint |
| `runtime_touched_files` | files Circuit saw change |
| `patch.ref` | saved patch file |
| `proof_assessment_refs` | proof checks |
| `apply_recommendation` | worker recommendation |

Avoid product prose that turns SafeApply into a grand product category. It is
the runtime-owned path for checking proposed changes before they touch the
parent checkout.

## Purpose

SafeApply exists because prompt instructions cannot make multi-agent writes
safe. A write-capable relay can claim it touched one file while mutating
another. Two file-disjoint changes can still break a shared API. Generated
surfaces can drift. A patch can apply cleanly and still fail final verification.

Circuit needs a simple rule:

1. A worker returns a `ChangePacket`.
2. Circuit verifies the packet against the WorkContract, PolicyEnvelope,
   GuidanceDecision, and ProofAssessment.
3. Circuit applies the patch in a controlled way or rejects it.
4. Circuit records the decision, evidence, result, and recovery route.

This is not a new flow. It is a boundary every write-capable relay should
eventually pass through.

## Current State Versus Target

| Area | Current repo evidence | Target rule |
| --- | --- | --- |
| Write-capable relay | Relay passes `context.projectRoot` to connectors, and write-capable connectors can mutate that checkout. See `src/runtime/executors/relay.ts:419-512`, `src/connectors/codex.ts:15-29`, and `src/connectors/claude-code.ts:23-43`. | Write-capable relays either run in isolation, are diff-captured before/after, or are explicitly marked pre-SafeApply trusted write. Trusted write cannot unlock more autonomy. |
| Pursue writes | Pursue serializes code-changing work and reports safe apply as future work. See `docs/flows/pursue.md:22-67` and `src/flows/pursue/writers/contract-projection.ts:1-112`. | Pursue cannot run parallel code-changing branches until ChangePacket and SafeApply gates pass. |
| Fanout worktrees | Sub-run branches can run in worktrees and report changed files; writable relay branches are serialized. See `src/runtime/executors/fanout.ts:1-95` and `src/runtime/fanout/worktree.ts:1-42`. | Isolated write branches must produce ChangePackets from known bases before Circuit applies anything to the parent checkout. |
| File overlap | Current `disjoint-merge` rejects changed-file discovery failures and overlapping files. See `src/shared/fanout-join-policy.ts:1-95`. | File disjointness is only a precheck. SafeApply still requires proof, generated-surface checks, protected-file checks, conflict checks, and final verification. |
| Runtime touched files | Fix already computes observed touched files from a baseline and post snapshot. See `src/flows/fix/writers/change-set-projection.ts:58-146`. | ChangePacket must use runtime-computed touched files. Worker-declared files are input, not proof. |
| Generated surfaces | Generated surfaces are source-owned and drift checked. See `docs/generated-surfaces.md:1-70`. | A packet touching generated surfaces needs generated-surface evidence or SafeApply rejects it. |

## Boundary Ownership

| Object | Owns | Must not own |
| --- | --- | --- |
| Flow | Runnable shape: stages, blocks, routes, relays, reports, generated surfaces. | Final authority to apply a write. |
| WorkContract | Allowed write scope, proof requirements, recovery routes, checkpoint boundaries, close conditions. | Connector/model/effort selection or hidden apply approval. |
| GuidanceDecision | Recorded choice to accept, reject, or apply a ChangePacket, and the reason codes for that choice. | New routes, skipped proof, or silent policy relaxation. |
| PolicyEnvelope | Hard rules, limits, preferences, defaults, and explicit overrides. | Right-biased safety precedence or direct final selection. |
| ProofAssessment | Claim and evidence judgment: proven, weak, contradicted, or unproved. | Agent prose as proof. |
| RecoveryRouteKind | Typed path after rejected apply, weak proof, conflict, budget limit, or unknown failure. | Freeform retry loops. |
| ChangePacket | Proposed change plus refs to base, patch, runtime touched files, claims, evidence, proof, risks, and recommendation. | Permission to mutate the parent checkout by itself. |
| SafeApply | Runtime-owned accept/reject/apply path, conflict checks, proof gate, and final verification. | Pursue-only behavior or prompt-only safety. |
| Pursue | Broad-goal coordination, serial writes before SafeApply, isolated write branches after SafeApply. | Parallel code-changing work before SafeApply gates exist. |

## Write Modes

SafeApply V0 must classify every write-capable relay into exactly one mode.

| Mode | Meaning | Allowed to unlock higher autonomy? |
| --- | --- | --- |
| `isolated_worktree` | The worker writes outside the parent checkout and returns a patch. | Yes, after all SafeApply gates pass. |
| `parent_checkout_diff_capture` | The worker writes in the parent checkout, but Circuit captures a before/after diff and dirty-state proof. | No, except as a transition path for current flows. |
| `pre_safe_apply_trusted_write` | The current relay path writes directly and relies on existing proof/report gates. | No. This is a named transition state, not SafeApply. |

The default target is `isolated_worktree`. The other modes exist only so the
cutover can be honest about the current runtime.

## ChangePacket V0 Shape

The exact Zod schema belongs in implementation. This is the required shape.

```ts
type ChangePacketV0 = {
  schema_version: 1;
  packet_id: string;

  producer: {
    run_id: string;
    flow_id: string;
    step_id: string;
    attempt: number;
    branch_id?: string;
    connector?: string;
    model?: string;
    work_root_kind:
      | "isolated_worktree"
      | "parent_checkout_diff_capture"
      | "pre_safe_apply_trusted_write";
    work_root_ref: Ref;
  };

  base: {
    ref: string;
    tree_hash: string;
    status_ref: Ref;
    dirty_parent: {
      state: "clean" | "dirty_allowed" | "dirty_rejected";
      policy_ref: Ref;
      baseline_snapshot_ref?: Ref;
      dirty_paths: string[];
      hidden_index_flags: Array<{ tag: string; path: string }>;
    };
  };

  patch: {
    ref: Ref;
    sha256: string;
    format: "unified_diff";
    applies_to_base: boolean;
    apply_precheck_ref?: Ref;
  };

  touched_files: {
    runtime_ref: Ref;
    files: Array<{
      path: string;
      status: "added" | "modified" | "deleted" | "renamed";
      source: "runtime_diff";
      hunks_ref?: Ref;
      generated_surface: boolean;
      protected: boolean;
    }>;
    worker_claim_ref?: Ref;
    worker_claim_matches_runtime: boolean;
  };

  claims: Ref[];
  evidence: Ref[];
  proof_assessment_refs: Ref[];
  commands_run: Ref[];

  risks: Array<{
    kind:
      | "protected_file"
      | "generated_surface"
      | "schema_change"
      | "dependency_change"
      | "migration"
      | "semantic_overlap"
      | "verification_gap"
      | "dirty_parent"
      | "base_mismatch"
      | "apply_conflict";
    severity: "low" | "medium" | "high";
    refs: Ref[];
  }>;

  generated_surfaces: {
    status: "not_touched" | "synced" | "drift_detected" | "unknown";
    source_refs: Ref[];
    output_refs: Ref[];
    drift_check_ref?: Ref;
  };

  protected_files: {
    decision: "allowed" | "rejected" | "checkpointed";
    policy_ref: Ref;
    checkpoint_ref?: Ref;
    files: string[];
  };

  apply_recommendation: "apply" | "review" | "reject";
};
```

### Field Rules

| Field | Required rule |
| --- | --- |
| `packet_id` | Stable within the run. It must appear in trace refs and SafeApply result refs. |
| `producer` | Identifies the relay, branch, connector, and work root that produced the change. |
| `base.ref` | The commit or tree the patch was produced from. It cannot be omitted. |
| `base.tree_hash` | Required so SafeApply can reject patches built from the wrong tree. |
| `base.status_ref` | Points to runtime-captured git status or equivalent base-state evidence. |
| `dirty_parent` | Required even when clean. Unknown dirty state is not allowed. |
| `patch.ref` | Points to a saved patch artifact in the run folder or isolated work root. |
| `patch.sha256` | Hash of the patch bytes. SafeApply must recompute it before apply. |
| `touched_files.runtime_ref` | Points to runtime-computed touched files. Worker-reported files cannot fill this role. |
| `worker_claim_matches_runtime` | Must be `true` before apply. Mismatch routes to recovery. |
| `claims` and `evidence` | Must reference Claim and Evidence records from the proof spec. |
| `proof_assessment_refs` | Required for all write-capable packets. Weak, contradicted, or unproved required claims block apply. |
| `commands_run` | Points to runtime command evidence, not model-written summaries. |
| `risks` | Required when protected files, generated surfaces, schemas, dependencies, migrations, dirty parent, base mismatch, conflicts, or proof gaps are present. |
| `generated_surfaces` | Required even when not touched so SafeApply can distinguish `not_touched` from `unknown`. |
| `protected_files` | Required even when no protected files are touched. Empty `files` with `decision: "allowed"` means none were protected. |
| `apply_recommendation` | Worker input only. It is never authority. |

## Ref Shape

Use the `Ref` shape from the GuidanceDecision spec. SafeApply needs refs to be
small, hashable, and stable:

```ts
type Ref = {
  kind:
    | "trace"
    | "report"
    | "evidence"
    | "policy"
    | "contract"
    | "patch"
    | "diff"
    | "command"
    | "worktree"
    | "generated_surface";
  ref: string;
  sha256?: string;
};
```

Open question: the final GuidanceDecision spec must own the exact `Ref` enum.
This SafeApply spec requires at least the kinds above.

## Runtime Touched Files

Circuit must compute touched files. A worker can report what it believes it
touched, but that is only a claim.

V0 can reuse the Fix flow pattern:

1. Capture base HEAD, dirty paths, per-path fingerprints, and hidden index
   flags before write work.
2. Capture the same state after write work or inside the isolated worktree.
3. Compute touched files as:
   - paths newly dirty after the write, plus
   - paths that were dirty at baseline and whose fingerprint changed.
4. Fail closed when:
   - HEAD moved unexpectedly,
   - hidden index flags are present,
   - worker-declared files do not match runtime-observed files,
   - changed-file discovery fails,
   - a path cannot be hashed or classified.

Fix already proves the pattern locally. Its change-set writer compares observed
files against declared files, flags HEAD divergence, and fails on hidden index
flags (`src/flows/fix/writers/change-set-projection.ts:58-146`). Its tests cover
undeclared extras, missing declared files, baseline-dirty mutation, HEAD
divergence, hidden index flags, renames, and paths with spaces
(`tests/runner/fix-change-set-writer.test.ts:215-690`).

## Dirty Parent Policy

Default: SafeApply requires a clean parent checkout before applying.

Allowed states:

| State | Meaning | SafeApply behavior |
| --- | --- | --- |
| `clean` | Parent checkout has no unrelated dirt and no hidden index flags. | Apply may continue. |
| `dirty_allowed` | Policy explicitly allows dirty parent apply, and runtime has a baseline snapshot with fingerprints for every dirty path. | Apply may continue only if the patch does not mutate unrelated dirt and the final diff still reconciles. |
| `dirty_rejected` | Parent checkout is dirty and policy does not allow apply. | Reject before patch application. |

Rules:

- Unknown parent state is a hard fail.
- Hidden index flags are a hard fail.
- A worker may not clean, rewrite, or hide pre-existing operator changes unless
  that path is part of the WorkContract write scope and proof covers it.
- `dirty_allowed` must be rare and policy-bound. It is not a default.

## SafeApply Gates

SafeApply must pass these gates in order. A failure stops the apply and routes
through a typed RecoveryRouteKind.

| Gate | Check | Failure route |
| --- | --- | --- |
| 1. Guidance | A prior matching `guidance.decision` exists with `subject: "safe_apply"` and selected packet/action refs. | `escalate` or `stop_unsafe` |
| 2. Packet schema | ChangePacket parses, refs resolve, and hashes match the referenced files. | `safe_apply_reject` |
| 3. Base | Current parent base matches `base.ref` and `base.tree_hash`, unless applying in an isolated compose root with a known rebase step. | `safe_apply_reject` with `base_mismatch` |
| 4. Dirty parent | Parent checkout state matches the policy. | `checkpoint_authority` or `safe_apply_reject` |
| 5. Patch precheck | Patch hash matches, patch applies to the base in a temporary apply root, and no partial parent mutation occurs. | `apply_conflict` |
| 6. Touched files | Runtime-computed touched files exist and match the packet. | `scope_drift` or `safe_apply_reject` |
| 7. Protected files | Protected paths are absent, explicitly allowed, or checkpointed. | `checkpoint_authority` or `safe_apply_reject` |
| 8. Generated surfaces | Generated surfaces are either not touched or have generated-surface proof and a drift check. | `run_verification` with generated-surface evidence, or `safe_apply_reject` |
| 9. Proof | Required claims are proven. Weak, contradicted, or unproved required claims block apply. | `run_verification`, `run_independent_review`, or `safe_apply_reject` |
| 10. Risk | Dependency, migration, schema, semantic overlap, or verification-gap risks are allowed by WorkContract and policy. | `checkpoint_authority`, `narrow_scope`, or `safe_apply_reject` |
| 11. Apply | Patch applies to the parent checkout only after all earlier gates pass. | `apply_conflict` |
| 12. Final verification | The composed result passes required verification. | `run_verification`, `retry_same_step_with_feedback`, or `safe_apply_reject` |
| 13. Trace and report | SafeApply result, proof refs, recovery route, and final close data are recorded. | `escalate` |

Gate 11 is the only point where the parent checkout may be mutated.

## SafeApply Result Shape

Implementation should add a trace/report object like this before runtime code
depends on it:

```ts
type SafeApplyResultV0 = {
  schema_version: 1;
  kind: "safe_apply.result";
  decision_id: string;
  change_packet_ref: Ref;
  action: "rejected" | "accepted_for_review" | "applied";
  outcome: "pass" | "fail";
  reason_codes: string[];

  base_check: {
    status: "pass" | "fail";
    expected_ref: string;
    actual_ref?: string;
    tree_hash_match: boolean;
  };

  dirty_parent_check: {
    status: "pass" | "fail";
    policy_ref: Ref;
    refs: Ref[];
  };

  patch_check: {
    status: "pass" | "fail";
    conflict_files: string[];
    partial_mutation: "none" | "possible" | "confirmed";
  };

  touched_file_check: {
    status: "pass" | "fail";
    runtime_ref: Ref;
    worker_claim_ref?: Ref;
  };

  proof_check: {
    status: "pass" | "fail";
    proof_assessment_refs: Ref[];
  };

  protected_file_check: {
    status: "pass" | "fail" | "checkpoint_required";
    files: string[];
    checkpoint_ref?: Ref;
  };

  generated_surface_check: {
    status: "pass" | "fail" | "not_required";
    drift_check_ref?: Ref;
  };

  final_verification: {
    status: "pass" | "fail" | "not_run";
    ref?: Ref;
  };

  applied_patch_ref?: Ref;
};
```

Rules:

- `outcome: "pass"` requires every required check to pass.
- `action: "applied"` requires `final_verification.status === "pass"`.
- Pre-apply failures must have `partial_mutation: "none"`.
- `partial_mutation: "possible"` or `"confirmed"` routes to `stop_unsafe` and
  blocks close until runtime evidence proves the parent checkout state.
- `reason_codes` must be enum-backed in implementation. No freeform blame text.

## Guidance Matching

SafeApply cannot act from a packet alone. It must have a matching
GuidanceDecision:

```ts
GuidanceDecision {
  subject: "safe_apply",
  scope: { run_id, flow_id, step_id?, attempt? },
  selected: {
    action: "accept" | "reject" | "apply",
    change_packet_ref: Ref,
    base_ref: Ref,
    protected_file_decision?: "allowed" | "rejected" | "checkpointed",
    final_verification_ref?: Ref
  },
  input_refs: [...],
  constraint_refs: [...],
  contract_refs: [...],
  policy_refs: [...],
  evidence_refs: [...]
}
```

Matching requires:

- same `run_id`;
- same `flow_id`;
- same `step_id` and `attempt` when present;
- same ChangePacket ref and hash;
- same base ref and tree hash;
- same selected action;
- same protected-file decision when protected paths are present;
- evidence refs that cover proof, touched files, generated surfaces, and final
  verification when those checks are required.

SafeApply must reject a packet if a later trace entry tries to accept, reject,
or apply it without this decision.

## Protected Files

Protected-file handling belongs to WorkContract and PolicyEnvelope, and it may
cross a CheckpointBoundary.

Rules:

- SafeApply must compute protected status from policy/contract refs, not from
  worker prose.
- A packet that touches protected files must have `protected_files.files`
  populated.
- `decision: "allowed"` requires policy or checkpoint authority refs.
- `decision: "checkpointed"` requires a checkpoint trace ref and a matching
  checkpoint GuidanceDecision.
- `decision: "rejected"` blocks apply and routes to `safe_apply_reject`.

Protected-file decisions are evidence-backed authority decisions. They are not
review comments.

## Generated Surfaces

Generated host surfaces are source-owned and drift-checked. SafeApply must
treat them as a special risk because hand edits to generated mirrors can make
the product surface lie.

Rules:

- If generated outputs are touched, the packet must identify both the source
  refs and output refs.
- The packet must carry generated-surface evidence and a drift-check ref.
- `generated_surfaces.status === "unknown"` blocks apply.
- `generated_surfaces.status === "drift_detected"` routes to
  `run_verification` with generated-surface evidence, or
  `safe_apply_reject`.
- A packet that edits generated mirrors without source changes must be rejected
  unless the WorkContract explicitly allows that maintenance action.

For this repo, the generated-surface map and drift command live in
`docs/generated-surfaces.md:1-70` and `package.json:25-47`.

## Patch Conflicts And Partial Mutation

SafeApply must never leave a half-applied patch in the parent checkout.

Rules:

- Patch apply is prechecked in a temporary apply root or equivalent dry run.
- Base mismatch rejects before any parent mutation.
- Patch conflict rejects before any parent mutation.
- File-disjoint packets still require final composed verification.
- Semantic overlap risks must be surfaced as risks even when file paths do not
  overlap.
- If a parent mutation starts and then fails, Circuit must roll back completely
  and prove `partial_mutation: "none"` with runtime diff evidence.
- If Circuit cannot prove rollback, it records `partial_mutation: "possible"` or
  `"confirmed"` and routes to `stop_unsafe`.

Current fanout `disjoint-merge` is not SafeApply. It checks admission, changed
files, and overlap, but does not prove final composed behavior
(`src/shared/fanout-join-policy.ts:1-95`).

## Final Verification

Apply is not complete when the patch lands. Apply is complete when the composed
checkout passes the WorkContract proof requirements.

Rules:

- Final verification runs after the patch is applied to the parent checkout or
  compose root.
- Final verification must write command evidence and feed ProofAssessment.
- Failed final verification routes to `run_verification`,
  `retry_same_step_with_feedback`, or `safe_apply_reject`.
- A write-capable run cannot close as complete when final verification failed,
  was skipped, or has no ref.
- For generated surfaces, final verification must include the relevant drift
  check when source or output files were touched.

## Pursue Implications

Pursue remains serial for code-changing work until SafeApply is real.

Before SafeApply:

- Pursue may coordinate broad goals.
- Pursue may run read-only discovery in parallel.
- Pursue must serialize code-changing work.
- Pursue must not auto-apply branch outputs from multiple writers.
- Pursue must keep reporting `serial_code_writes: true` and
  `parallel_write_status: "blocked-until-safe-apply"`.

After SafeApply exists, Pursue may consider parallel code-changing branches only
when all of these are true:

1. each writer uses an isolated work root;
2. each writer returns a valid ChangePacket;
3. each packet has a known base ref and tree hash;
4. runtime-computed touched files are present;
5. protected-file and generated-surface checks pass;
6. ProofAssessment proves required claims;
7. SafeApply detects file conflicts and semantic risks;
8. the composed result passes final verification;
9. rejected packets do not count as completed pursuits.

File-disjoint patches are not enough. Pursue still needs proof and final
verification.

## Death Tests

These tests should be written before or with runtime implementation.

### ChangePacket Schema Tests

| Death test | Likely test file |
| --- | --- |
| Reject missing `base.ref`. | `tests/contracts/change-packet-schema.test.ts` |
| Reject missing `base.tree_hash`. | `tests/contracts/change-packet-schema.test.ts` |
| Reject missing `patch.ref` or `patch.sha256`. | `tests/contracts/change-packet-schema.test.ts` |
| Reject missing `touched_files.runtime_ref`. | `tests/contracts/change-packet-schema.test.ts` |
| Reject worker touched files used as runtime touched files. | `tests/contracts/change-packet-schema.test.ts` |
| Reject missing `proof_assessment_refs` for write-capable packets. | `tests/contracts/change-packet-schema.test.ts` |
| Reject `generated_surfaces.status === "unknown"` when generated outputs are touched. | `tests/contracts/change-packet-schema.test.ts` |
| Reject protected files with no policy or checkpoint ref. | `tests/contracts/change-packet-schema.test.ts` |
| Reject unknown dirty parent state. | `tests/contracts/change-packet-schema.test.ts` |

### SafeApply Runtime Tests

| Death test | Likely test file |
| --- | --- |
| SafeApply rejects a base ref mismatch before patch apply. | future SafeApply runtime test |
| SafeApply rejects a tree hash mismatch before patch apply. | future SafeApply runtime test |
| SafeApply rejects dirty parent checkout unless policy allows it and baseline snapshot evidence exists. | future SafeApply runtime test |
| SafeApply rejects hidden index flags. | future SafeApply runtime test |
| SafeApply rejects patch hash mismatch. | future SafeApply runtime test |
| SafeApply rejects patch conflict without partial parent mutation. | future SafeApply runtime test |
| SafeApply rejects worker-reported touched files that differ from runtime touched files. | future SafeApply runtime test |
| SafeApply rejects protected-file changes without checkpoint or policy authority. | future SafeApply runtime test |
| SafeApply rejects generated-surface drift without generated-surface proof. | `tests/runtime/safe-apply-generated-surfaces.test.ts` |
| SafeApply rejects weak, contradicted, or unproved required claims. | future SafeApply runtime test |
| SafeApply rejects final verification failure. | future SafeApply runtime test |
| SafeApply emits a failure result with `partial_mutation: "none"` for every pre-apply failure. | future SafeApply runtime test |
| SafeApply result with `partial_mutation: "possible"` or `"confirmed"` cannot close the run as complete. | future SafeApply runtime test |

### Trace And Guidance Tests

| Death test | Likely test file |
| --- | --- |
| SafeApply accept/reject/apply fails without prior matching `guidance.decision`. | `tests/contracts/runtrace-sequence.test.ts` |
| SafeApply action with mismatched packet ref fails. | `tests/contracts/runtrace-sequence.test.ts` |
| SafeApply action with mismatched base ref/tree hash fails. | `tests/contracts/runtrace-sequence.test.ts` |
| SafeApply result with freeform reason instead of enum reason codes fails. | `tests/contracts/runtrace-schema.test.ts` |
| SafeApply result that applies without final verification ref fails. | `tests/contracts/runtrace-sequence.test.ts` |

### Pursue And Fanout Tests

| Death test | Likely test file |
| --- | --- |
| Pursue rejects parallel code-changing branches unless SafeApply is enabled. | `tests/runner/pursue-runtime.test.ts` |
| Pursue keeps serial write behavior before SafeApply. | `tests/runner/pursue-runtime-wiring.test.ts` |
| Writable relay fanout remains serialized without branch-local write roots. | `tests/runtime/fanout.test.ts` |
| Disjoint file paths do not bypass final composed verification. | future SafeApply runtime test |
| Rejected ChangePacket does not count as a completed pursuit. | `tests/runner/pursue-runtime.test.ts` |
| Parallel write branch with missing ChangePacket is rejected. | `tests/runner/pursue-runtime.test.ts` |

### Generated-Surface Tests

| Death test | Likely test file |
| --- | --- |
| Generated mirror edit without source ref is rejected. | `tests/runtime/safe-apply-generated-surfaces.test.ts` |
| Generated output touched without drift-check evidence is rejected. | `tests/runtime/safe-apply-generated-surfaces.test.ts` |
| Generated host surfaces stay drift-checked after SafeApply docs and source changes. | existing `check-flow-drift` |

## Anti-Cruft Probes

Run these during implementation. Some should fail until the cutover lands.

```bash
rg -n "ChangePacket|SafeApply|safe apply|safe-apply|patch_path|changed_files|changedFiles|dirty|hidden_index_flags" \
  src docs tests plugins generated
```

Expected hard-cut state: ChangePacket and SafeApply appear in schemas, runtime,
tests, and docs with the meaning in this spec. Old direct-write paths are either
isolated, diff-captured, or marked pre-SafeApply trusted write.

```bash
rg -n "projectRoot|cwd|workspace-write|pre-SafeApply|trusted write|bypassPermissions" \
  src/connectors src/runtime tests docs
```

Expected hard-cut state: write-capable connectors cannot silently mutate the
parent checkout in any path that claims SafeApply.

```bash
rg -n "parallel.*write|serial-only|blocked-until-safe-apply|disjoint-merge|worktree|changedFiles" \
  src docs tests
```

Expected hard-cut state: Pursue and fanout only allow parallel code-changing
work when isolated ChangePackets and SafeApply gates are present.

```bash
rg -n "generated_surface|generated surfaces|check-flow-drift|emit.ts --check|drift" \
  src docs tests scripts plugins generated
```

Expected hard-cut state: generated-surface changes require drift evidence before
apply and before close.

## Implementation Order

1. Add `ChangePacketV0` schema and schema death tests.
2. Add `safe_apply.result` trace/report shape and trace sequence tests.
3. Add a runtime touched-file adapter using the Fix baseline/change-set pattern.
4. Classify existing write-capable relays as isolated, diff-captured, or
   pre-SafeApply trusted write.
5. Add SafeApply reject-only mode. It should validate packets and record why it
   refused apply before it can mutate the parent checkout.
6. Add SafeApply apply mode in a temporary apply root, then parent checkout
   mutation after all gates pass.
7. Add final verification and ProofAssessment close gates.
8. Integrate Pursue parallel write branches only after SafeApply death tests
   pass.

Do not skip reject-only mode. It gives the trace and proof shape before parent
mutation is possible.

## Unsettled Items

These are intentionally not decided here:

| Question | Why it remains unsettled |
| --- | --- |
| Exact patch storage path | Needs runtime run-folder layout decision. |
| Exact tree hash algorithm | Should align with git tree hash or a repo-independent tree fingerprint. |
| Whether `safe_apply.result` is trace-only, report-only, or both | Needs trace schema and report ownership decision. |
| Whether ChangePacket is produced by the worker, runtime wrapper, or both | Isolated relays may return a patch, but runtime still must compute touched files and refs. |
| How to migrate parent-checkout write relays | Current connectors can write directly; the transition needs a careful compatibility slice. |
| Protected-file glob source | PolicyEnvelope and WorkContract both need to contribute, but the exact merge rules belong in the policy and contract specs. |
| Exact generated-surface drift command per host | The repo has `check-flow-drift`; host-specific proof may need narrower commands. |
| Multi-packet apply order | Pursue needs this after SafeApply V0, not before. |
| Semantic conflict detection | V0 can flag risk and require final verification; deeper API-level analysis can come later. |

## Spec-Readiness Checklist

Before runtime implementation starts, the next spec pass must confirm:

- every ChangePacket field has a schema owner;
- SafeApply result is placed in trace, report, or both;
- GuidanceDecision matching covers SafeApply action and packet refs;
- PolicyEnvelope defines dirty-parent and protected-file rules;
- ProofAssessment defines which statuses block apply;
- RecoveryRouteKind covers every SafeApply failure path;
- generated-surface proof has an exact command and ref shape;
- Pursue still blocks parallel writes until SafeApply tests pass.

## Review Notes

Adversarial review should focus on these failure modes:

- a worker can mutate the parent checkout before producing a packet;
- worker-declared files are treated as proof;
- dirty parent state hides operator edits;
- generated mirrors drift from their sources;
- protected-file writes pass without checkpoint or policy authority;
- weak proof closes write-capable work;
- a patch conflict leaves partial parent mutation;
- Pursue treats file-disjoint packets as safe without final verification;
- direct relay writes are renamed SafeApply without isolation or diff capture.

Medium-or-above findings in any of those areas block implementation.
