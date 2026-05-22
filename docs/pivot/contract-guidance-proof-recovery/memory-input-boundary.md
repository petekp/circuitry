# MemoryInput Boundary

Status: implementation-spec direction for the Circuit pivot. This is
future-facing. It does not describe current runtime behavior until the matching
schema, runtime, tests, docs, generated surfaces, and host surfaces change.

`MemoryInput` is the spec name. In product prose, say memory hint.

## Purpose

Memory can help Circuit avoid forgetting useful context. It must not become a
second source of authority.

Plain rule:

> Memory can remind. It cannot permit.

Memory may suggest repo commands, user preferences, project conventions, prior
failures, and useful context. Circuit may use those hints when recording a
GuidanceDecision. Circuit must not let memory authorize work, relax policy, skip
proof, choose undeclared routes, change checkpoint authority, or affect
SafeApply.

This spec defines the boundary. It does not design a full memory feature.

## Source Evidence

| Source | Evidence used |
| --- | --- |
| [Pivot brief](pivot-brief.md) | The doctrine says no agent action gets authority unless a contract allows it, a guidance decision traces it, and proof can verify or recover from it. See `pivot-brief.md:14-32`. The language table maps `MemoryInput` to "memory hint." See `pivot-brief.md:57-70`. The brief says MemoryInput is informational only, can suggest context, cannot permit writes or relax authority, and is out of the first runtime cutover except optional `memory_refs`. See `pivot-brief.md:242-253`. It also says ignored memory conflicts must be traced and stale memory handling is unsettled. See `pivot-brief.md:492-513` and `pivot-brief.md:831-842`. |
| [Order of operations](order-of-operations.md) | The order guide names `tests/runtime/policy-memory-conflicts.test.ts` as a policy death-test surface and says MemoryInput is out of the first cutover except optional memory refs. See `order-of-operations.md:95-114` and `order-of-operations.md:220-228`. |
| [WorkContract Projection V0](work-contract-projection-v0.md) | WorkContract projection separates contract authority from guidance seeds. Old hints may be considered with source refs, but cannot become final authority. See `work-contract-projection-v0.md:7-19` and `work-contract-projection-v0.md:48-73`. |
| [GuidanceDecision Trace Invariant](guidance-decision-trace-invariant.md) | GuidanceDecision already has optional `memory_refs`; the Ref shape includes `kind: "memory"`; memory refs are optional in the first cutover and cannot grant authority. See `guidance-decision-trace-invariant.md:66-107` and `guidance-decision-trace-invariant.md:128-177`. |
| [PolicyEnvelope Config V2 Cutover](policy-envelope-config-v2-cutover.md) | Config and policy can bound or suggest a decision, but cannot be the decision; rules and limits are hard, preferences rank allowed options, and overrides cannot loosen hard rules. See `policy-envelope-config-v2-cutover.md:10-21`, `policy-envelope-config-v2-cutover.md:337-371`, and `policy-envelope-config-v2-cutover.md:245-265`. |
| [CheckpointBoundary Authority](checkpoint-boundary-authority.md) | A checkpoint can be crossed only by operator choice, declared default, or traced policy decision; memory hints cannot change checkpoint authority. See `checkpoint-boundary-authority.md:10-32` and `checkpoint-boundary-authority.md:477-485`. |
| [ProofAssessment And Evidence Adapter](proof-assessment-evidence-adapter.md) | Proof requires runtime evidence. Agent prose and report shape are not proof. Runtime diff and generated-surface evidence have specific requirements, and write-capable close requires ProofAssessment refs. See `proof-assessment-evidence-adapter.md:10-30`, `proof-assessment-evidence-adapter.md:425-456`, and `proof-assessment-evidence-adapter.md:575-600`. |
| [RecoveryRouteKind](recovery-route-kind.md) | MemoryInput is hints only and cannot permit recovery, retry, apply, or proof skipping. Recovery route selection must match declared routes and typed recovery rules. See `recovery-route-kind.md:245-260`, `recovery-route-kind.md:615-640`, and `recovery-route-kind.md:854-862`. |
| [ChangePacket And SafeApply](change-packet-safe-apply.md) | SafeApply requires packet refs, hashes, runtime touched files, generated-surface evidence, final verification, and guidance matching. See `change-packet-safe-apply.md:1-12`, `change-packet-safe-apply.md:120-180`, `change-packet-safe-apply.md:468-500`, and `change-packet-safe-apply.md:590-620`. |
| [Generated Host Surface Reframing](generated-host-surface-reframing.md) | Host surfaces should teach intent, contract, recorded decisions, evidence checks, recovery, and safe apply. Direct controls must not sound like a way around the runtime, and generated mirrors stay drift-checked. See `generated-host-surface-reframing.md:10-24`, `generated-host-surface-reframing.md:196-226`, and `generated-host-surface-reframing.md:400-410`. |
| [Pursue SafeApply Integration](pursue-safe-apply-integration.md) | Pursue coordinates while SafeApply applies changes. Parallel write branches require ChangePackets, proof, generated-surface checks, and final verification. See `pursue-safe-apply-integration.md:10-27`, `pursue-safe-apply-integration.md:73-85`, `pursue-safe-apply-integration.md:217-240`, and `pursue-safe-apply-integration.md:405-425`. |
| [UBIQUITOUS_LANGUAGE.md](../../../UBIQUITOUS_LANGUAGE.md) | Use Circuit vocabulary: Flow, Block, Route, Relay, Trace, Report, Evidence, Checkpoint, Run folder, and continuity terms. See `UBIQUITOUS_LANGUAGE.md:1-30`, `UBIQUITOUS_LANGUAGE.md:128-142`, `UBIQUITOUS_LANGUAGE.md:158-180`, and `UBIQUITOUS_LANGUAGE.md:221-236`. |
| [Continuity contract](../../contracts/continuity.md) | Current continuity records are strict cross-session handoff reports and indexes, not freeform memory. They reject legacy parsing, require run-attached provenance for run-backed records, and defer dangling record liveness to resume handling. See `docs/contracts/continuity.md:17-27`, `docs/contracts/continuity.md:72-87`, `docs/contracts/continuity.md:117-128`, and `docs/contracts/continuity.md:211-220`. |
| [Continuity schema](../../../src/schemas/continuity.ts) | Current continuity schemas hold narrative context, run-attached provenance, resume contracts, record/index pointers, strict objects, and own-property guards. See `src/schemas/continuity.ts:28-35`, `src/schemas/continuity.ts:45-54`, `src/schemas/continuity.ts:73-110`, and `src/schemas/continuity.ts:135-193`. |
| [Handoff command](../../../src/commands/handoff.md) | The handoff command says `brief` mode is read-only host context and must not be treated as an explicit resume request. See `src/commands/handoff.md:47-54` and `src/commands/handoff.md:73-82`. |
| [Handoff CLI](../../../src/cli/handoff.ts) | The CLI validates pointed continuity records before producing `additional_context`; hooks read the host `cwd` from stdin and fail soft when context is missing or invalid. See `src/cli/handoff.ts:360-406`, `src/cli/handoff.ts:415-490`, and `src/cli/handoff.ts:725-767`. |
| [Continuity tests](../../../tests/contracts/continuity-schema.test.ts) | Current tests reject extra fields, contradictory resume flags, invalid pointer kinds, incomplete run pointers, path-unsafe record ids, and prototype-chain smuggling. See `tests/contracts/continuity-schema.test.ts:13-124`, `tests/contracts/continuity-schema.test.ts:174-230`, and `tests/contracts/continuity-schema.test.ts:321-430`. |
| [Handoff hook tests](../../../tests/runner/handoff-hook-adapters.test.ts) | Hook tests show host context injection is cwd-bound, fails soft for empty/invalid briefs, and does not fall back to ambient process cwd when hook input lacks cwd. See `tests/runner/handoff-hook-adapters.test.ts:84-122`, `tests/runner/handoff-hook-adapters.test.ts:125-149`, and `tests/runner/handoff-hook-adapters.test.ts:151-169`. |
| [Release handoff proof fixture](../../../docs/release/proofs/runs/handoff/control-plane/continuity/records/continuity-44444444-4444-4444-8444-444444444411.json) | The fixture shows a run-backed continuity record with narrative context, run provenance, and an explicit resume contract. See `docs/release/proofs/runs/handoff/control-plane/continuity/records/continuity-44444444-4444-4444-8444-444444444411.json:1-28`. |

## Plain Terms

Use formal names in specs, schemas, trace validators, and tests. Use plain words
in operator-facing text.

| Formal name | Plain wording |
| --- | --- |
| `MemoryInput` | memory hint |
| `memory_refs` | memory refs, memory hints used |
| `MemoryPacket` | saved memory note, memory record |
| `staleness` | how old the hint is |
| `conflict_status` | whether the hint agreed with the rules |
| `hint_only` | cannot permit work |

## Boundary Rule

MemoryInput is input. It is not authority.

| Object | Owns | Must not own |
| --- | --- | --- |
| Flow | Runnable shape and the WorkContract it carries. | Memory-only routes or memory-only write authority. |
| WorkContract | Allowed work, routes, proof, checkpoint boundaries, recovery, and write authority. | Repo/user/project memory. |
| PolicyEnvelope | Rules, limits, preferences, defaults, and explicit overrides. | Silent policy changes from memory. |
| GuidanceDecision | Recorded choice inside WorkContract and policy bounds. | Treating memory as permission. |
| MemoryInput | Hints, past context, prior failures, repo conventions, and user preferences. | Writes, policy relaxation, proof skipping, checkpoint crossing, recovery permission, route declaration, or SafeApply approval. |
| ProofAssessment | Whether claims are proven by evidence. | Memory as proof of current work. |
| CheckpointBoundary | Authority boundary and allowed choices. | Memory-based auto-resolution. |
| SafeApply | Apply/reject checks over proposed changes. | Memory-based apply approval. |
| Continuity record | Saved context for resuming or briefing a later session. | General authority to resume, mutate, skip proof, or change policy. |

## Current State Versus Target

| Area | Current repo evidence | Target rule |
| --- | --- | --- |
| General MemoryInput schema | No current `MemoryInput` schema is present in the source set; the pivot docs only reserve optional `memory_refs`. See `pivot-brief.md:242-253` and `guidance-decision-trace-invariant.md:128-177`. | Do not build a broad memory system in the first cutover. Add only the ref boundary needed for guidance trace. |
| Continuity records | Current continuity records are strict handoff reports with narrative, git state, run provenance, and resume contract. See `docs/contracts/continuity.md:17-27` and `src/schemas/continuity.ts:28-110`. | A continuity record can become a memory hint or input ref. It does not become policy, proof, or checkpoint authority. |
| Handoff brief | Brief mode is read-only host context and not an explicit resume request. See `src/commands/handoff.md:47-54`. | A handoff brief can remind a host. Circuit still validates any resume, route, checkpoint, proof, or apply action. |
| Hook context | Hook adapters use host stdin `cwd`, fail soft on invalid context, and avoid ambient cwd fallback. See `tests/runner/handoff-hook-adapters.test.ts:84-169`. | Memory refs must preserve source identity. Ambient or unverified memory cannot quietly steer a run. |
| Trace | GuidanceDecision has optional `memory_refs`, and memory refs are not required for the first cutover. See `guidance-decision-trace-invariant.md:66-107` and `guidance-decision-trace-invariant.md:128-177`. | If memory materially affects or is rejected by a decision, record it in `memory_refs` with reason codes. |

## MemoryInput V0 Shape

The first slice should not invent a large memory store. It only needs a stable
memory packet shape that `Ref.kind === "memory"` can point to.

```ts
type MemoryInputV0 = {
  schema_version: 1;
  memory_id: string;

  kind:
    | "repo"
    | "user"
    | "project"
    | "prior_run"
    | "continuity"
    | "handoff_brief";

  source: {
    ref: Ref;
    captured_at: string;
    source_updated_at?: string;
    sha256?: string;
  };

  summary: string;
  hints: Array<{
    id: string;
    text: string;
    applies_to:
      | "context"
      | "verification"
      | "preference"
      | "prior_failure"
      | "repo_convention"
      | "operator_note";
  }>;

  staleness: {
    status: "fresh" | "stale" | "unknown";
    checked_at: string;
    reason_codes: string[];
  };

  authority: "hint_only";
};
```

Rules:

- `authority` is always `"hint_only"`.
- `kind` says where the hint came from, not what it can do.
- `source.ref` must be stable enough for trace. File-backed or content-backed
  memory needs a hash.
- `summary` and `hints.text` are context, not proof.
- A memory packet with `staleness.status === "unknown"` can only be used as weak
  context. It cannot decide connector, route, checkpoint, proof, or apply.
- A stale memory packet can still be shown as context, but current repo evidence,
  WorkContract, PolicyEnvelope, and runtime evidence win.

## `memory_refs` Rules

`memory_refs` live on GuidanceDecision.

Use them when memory materially affected the decision or when memory was ignored
because it conflicted with a stronger rule.

Required matching rules:

1. Every `memory_refs[]` item has `kind: "memory"`.
2. File-backed or content-backed memory refs include `sha256`.
3. The referenced MemoryInput has `authority: "hint_only"`.
4. A memory ref can appear in `input_refs` or `memory_refs`.
5. A memory ref must not appear in `constraint_refs`, `contract_refs`,
   `policy_refs`, or `evidence_refs`.
6. If guidance rejects a memory hint because it conflicts with WorkContract or
   PolicyEnvelope, the GuidanceDecision must include:
   - the memory ref in `memory_refs`;
   - the stronger contract or policy ref in `constraint_refs`;
   - a reason code such as `memory_conflicts_with_policy`,
     `memory_conflicts_with_contract`, `memory_stale`, or
     `memory_unverified`;
   - a `rejected_options` entry when the rejected hint proposed a concrete
     connector, route, checkpoint choice, proof shortcut, or apply action.

Memory that was merely available but did not affect or conflict with the
decision does not need to be traced.

## Staleness Rules

Staleness is about trust in the hint, not authority. Fresh memory is still only a
hint.

V0 status:

| Status | Meaning | Allowed use |
| --- | --- | --- |
| `fresh` | Source was captured or checked for this run or current repo state. | Context, preferences, repo commands, prior-failure hints. |
| `stale` | Source is older than the current run, repo state, policy, or contract and was not rechecked. | Context only; must be downranked and can be rejected by reason code. |
| `unknown` | Circuit cannot tell when the source was captured or whether it still applies. | Weak context only; cannot materially select a route, connector, checkpoint choice, proof policy, or SafeApply action. |

Required behavior:

- Current repo files beat stale repo memory.
- Current PolicyEnvelope beats stale or fresh memory.
- Current WorkContract beats stale or fresh memory.
- Current runtime evidence beats stale or fresh memory.
- Operator input in the current run beats old user-preference memory.
- If a memory hint names a command, Circuit must still validate that command
  against WorkContract, PolicyEnvelope, and proof rules before relying on it.

## Conflict Handling

Conflict order:

```text
current operator input, when allowed by policy
> PolicyEnvelope rules and limits
> WorkContract authority
> GuidanceDecision validation
> current runtime evidence
> MemoryInput hints
```

When memory conflicts with anything above it:

1. ignore the memory hint;
2. keep the stronger decision;
3. trace the memory ref if the hint was material;
4. record the stronger contract, policy, evidence, or operator ref;
5. use a reason code that says why the hint was ignored.

Examples:

| Memory says | Stronger source says | Required result |
| --- | --- | --- |
| "Auto-apply generated files is fine." | Policy requires generated-surface evidence. | Ignore memory; require generated-surface proof. |
| "Use the old direct Fix command." | Generated-surface spec says direct controls do not bypass runtime. | Treat as host preference at most; still run guidance/proof/recovery. |
| "Retry until it passes." | WorkContract max attempts exhausted. | Stop, checkpoint, handoff, or escalate through declared recovery. |
| "This protected file was safe last time." | Policy requires checkpoint for protected files. | Open or resolve the declared checkpoint; memory cannot cross it. |
| "The last run verified this." | Current proof is weak or missing. | Run proof for the current run. |
| "Apply this packet." | SafeApply sees base mismatch or weak proof. | Reject before parent mutation. |

## Allowed Uses

Memory may:

- suggest repo commands to consider;
- suggest prior user preferences;
- remind Circuit of prior failures or risk patterns;
- provide useful context for a relay request;
- help rank otherwise allowed connectors, models, effort, skills, routes,
  checkpoints, proof profiles, or recovery options;
- seed `reason_codes` when the chosen decision stays inside WorkContract and
  PolicyEnvelope bounds;
- point to continuity or handoff context as read-only background.

Every allowed use still needs WorkContract, PolicyEnvelope, GuidanceDecision,
ProofAssessment, CheckpointBoundary, RecoveryRouteKind, and SafeApply checks
where those checks apply.

## Forbidden Uses

Memory must not:

- permit writes;
- relax policy;
- override WorkContract authority;
- choose a route not declared by the flow's work contract;
- set connector, model, effort, skill, or depth as final authority;
- skip ProofAssessment;
- count as runtime evidence;
- satisfy generated-surface evidence;
- cross a checkpoint;
- change checkpoint authority;
- auto-resolve a checkpoint;
- choose a recovery route not declared by the contract;
- reset budgets or attempt counts;
- approve SafeApply;
- mark a rejected ChangePacket complete;
- make a stale continuity record authoritative without resume validation.

## Continuity And Handoff

Continuity records and handoff briefs are the current repo's closest durable
memory-like surfaces.

They are useful, but they stay bounded:

- A continuity record is a typed report for resuming work.
- A continuity index points to a pending record and/or current run.
- A handoff brief is read-only host context.
- A run-backed record carries save-time run provenance.
- Resume must validate current state before continuing.
- A brief does not mean "resume now".
- A stale continuity record can remind Circuit what was true at save time. It
  cannot prove what is true now.

Target mapping:

| Current surface | MemoryInput mapping | Boundary |
| --- | --- | --- |
| `continuity.record@v1` | `kind: "continuity"` memory packet or `input_refs` report ref. | Context and resume input only. |
| `handoff-brief-v1` | `kind: "handoff_brief"` memory packet. | Read-only context. |
| `continuity.index@v1` | Pointer source for a memory packet. | Resolver input only; dangling refs fail resume handling. |
| Run-attached provenance | Save-time context. | Must be checked against current run state before resume. |

Do not merge MemoryInput and continuity into one concept. Continuity is a typed
handoff surface. MemoryInput is a hint boundary for guidance.

## Trace Requirements

V0 only changes trace expectations when memory affects a GuidanceDecision.

Required:

- If a relay, checkpoint, proof policy, recovery route, or safe-apply decision
  uses memory, the matching GuidanceDecision includes `memory_refs`.
- If memory was rejected due to policy, contract, proof, checkpoint, recovery, or
  SafeApply conflict, the same decision includes `memory_refs` and reason codes.
- Memory refs are never enough to satisfy `constraint_refs`, `contract_refs`,
  `policy_refs`, or `evidence_refs`.
- Memory must not appear as the cause of a route unless the route is also
  declared by WorkContract and selected by GuidanceDecision.
- A trace validator should fail if a material decision cites memory but lacks the
  stronger refs that bounded the decision.

Subject-specific rules:

| Subject | Memory may do | Memory must not do |
| --- | --- | --- |
| `flow_selection` | Suggest likely flow from prior context. | Choose a flow that fails WorkContract or policy validation. |
| `relay_execution` | Suggest worker preferences, repo habits, or prior connector failures. | Directly select connector/model/effort/skills. |
| `checkpoint_resolution` | Explain why a checkpoint was expected. | Cross the checkpoint. |
| `proof_policy` | Suggest relevant commands or previous proof gaps. | Lower required proof. |
| `recovery_route` | Suggest what failed last time. | Choose undeclared or budget-breaking recovery. |
| `safe_apply` | Flag known generated/protected-file risks. | Accept, apply, or reject a packet by itself. |

## Deferral Boundary

Do not build these in the first runtime cutover:

- a memory store;
- memory editing UI;
- memory scoring;
- memory search ranking;
- automatic memory writes;
- cross-project memory merge;
- memory-based policy changes;
- memory-based checkpoint defaults;
- memory as proof;
- memory-driven SafeApply.

First cutover scope:

1. define `MemoryInputV0` enough for `Ref.kind === "memory"`;
2. allow optional `memory_refs` on GuidanceDecision;
3. validate memory refs cannot appear as authority or proof refs;
4. trace ignored material memory conflicts;
5. add death tests for memory-as-authority failures.

## Death Tests

### Schema Death Tests

| Death test | Likely test file |
| --- | --- |
| `MemoryInputV0.authority` rejects anything except `"hint_only"`. | `tests/contracts/memory-input-schema.test.ts` |
| Memory ref without stable `ref` rejects. | `tests/contracts/guidance-decision-schema.test.ts` |
| File-backed memory ref without hash rejects. | `tests/contracts/guidance-decision-schema.test.ts` |
| GuidanceDecision rejects memory refs inside `constraint_refs`. | `tests/contracts/guidance-decision-schema.test.ts` |
| GuidanceDecision rejects memory refs inside `contract_refs`. | `tests/contracts/guidance-decision-schema.test.ts` |
| GuidanceDecision rejects memory refs inside `policy_refs`. | `tests/contracts/guidance-decision-schema.test.ts` |
| GuidanceDecision rejects memory refs inside `evidence_refs`. | `tests/contracts/guidance-decision-schema.test.ts` |
| Memory packet with `staleness.status: "unknown"` and material decision use rejects unless reason code marks weak context. | `tests/contracts/memory-input-schema.test.ts` |
| Continuity-derived memory packet must reference a valid continuity record or handoff brief ref. | `tests/contracts/memory-input-schema.test.ts` |

### Runtime Death Tests

| Death test | Likely test file |
| --- | --- |
| Memory suggesting a write cannot make a read-only contract write-capable. | `tests/runtime/memory-input-boundary.test.ts` |
| Memory suggesting a connector cannot bypass PolicyEnvelope connector limits. | `tests/runtime/policy-memory-conflicts.test.ts` |
| Memory suggesting higher effort cannot exceed policy `max_effort`. | `tests/runtime/policy-memory-conflicts.test.ts` |
| Memory suggesting a route not declared by WorkContract aborts before route use. | `tests/runtime/guidance-route-invariant.test.ts` |
| Memory suggesting checkpoint auto-resolution cannot cross a checkpoint. | `tests/runtime/checkpoint-boundary.test.ts` |
| Memory suggesting stale verification cannot close a write-capable run as complete. | `tests/runtime/proof-closure.test.ts` |
| Memory suggesting retry cannot exceed WorkContract attempt budget. | `tests/runtime/recovery-route-kind.test.ts` |
| Memory suggesting SafeApply accept cannot apply a base-mismatched packet. | `tests/runtime/safe-apply.test.ts` |
| Memory suggesting generated-surface safety cannot replace drift-check evidence. | `tests/runtime/safe-apply-generated-surfaces.test.ts` |

### Trace Death Tests

| Death test | Likely test file |
| --- | --- |
| Material memory influence without `memory_refs` fails trace consistency. | `tests/contracts/runtrace-sequence.test.ts` |
| Ignored material memory conflict without `memory_refs` and reason code fails. | `tests/contracts/runtrace-sequence.test.ts` |
| Memory conflict with hard policy must trace the policy ref that won. | `tests/contracts/runtrace-sequence.test.ts` |
| Memory conflict with WorkContract must trace the contract ref that won. | `tests/contracts/runtrace-sequence.test.ts` |
| Memory used as proof evidence fails close validation. | `tests/contracts/runtrace-sequence.test.ts` |
| SafeApply decision with only memory refs and no packet/proof refs fails. | `tests/contracts/runtrace-sequence.test.ts` |

### Continuity And Handoff Death Tests

| Death test | Likely test file |
| --- | --- |
| Handoff brief remains read-only context and cannot trigger resume by itself. | `tests/runner/handoff-hook-adapters.test.ts` |
| Missing hook `cwd` still fails soft and cannot use ambient cwd memory. | `tests/runner/handoff-hook-adapters.test.ts` |
| Invalid or dangling continuity record cannot become MemoryInput authority. | `tests/contracts/continuity-schema.test.ts` plus `tests/runtime/memory-input-boundary.test.ts` |
| Run-backed continuity memory must be revalidated against current run state before resume. | `tests/runner/handoff-continuity-resume.test.ts` |
| Continuity narrative cannot supply policy, proof, route, checkpoint, or SafeApply authority. | `tests/runtime/memory-input-boundary.test.ts` |

### Generated-Surface Death Tests

| Death test | Likely test or command |
| --- | --- |
| Public docs call MemoryInput a memory hint, not a control system. | `scripts/release/audit-public-docs.ts` |
| Generated host surfaces do not say memory can bypass guidance, proof, recovery, checkpoints, or SafeApply. | `tests/generated/generated-surface-framing.test.ts` |
| Generated mirrors stay drift-checked after any MemoryInput schema or host wording change. | `npm run check-flow-drift` |

## Anti-Cruft Probes

Run these during implementation. Some should fail until the cutover lands.

```bash
rg -n "MemoryInput|memory_refs|kind: ['\"]memory['\"]|memory.*authority|hint_only" \
  src tests docs/pivot/contract-guidance-proof-recovery
```

Expected hard-cut state: memory appears as hint/input refs only, never as
contract, policy, proof, checkpoint, recovery, or SafeApply authority.

```bash
rg -n "memory.*(allow|permit|authorize|override|relax|skip proof|auto-resolve|apply)" \
  src tests docs generated plugins
```

Expected hard-cut state: active product/runtime text does not describe memory as
permission.

```bash
rg -n "handoff brief|continuity.record|continuity.index|additional_context|resume_contract" \
  src docs tests plugins generated
```

Expected hard-cut state: continuity and handoff stay typed resume/context
surfaces. They do not become unvalidated memory authority.

## Verification Plan

For this docs-only spec:

1. Check Markdown links.
2. Check source line citations.
3. Run avoid-term probes for plain language.
4. Run `git diff --check`.
5. Run `npm run check-flow-drift`.
6. Run focused continuity and handoff tests:

   ```bash
   npm run test -- \
     tests/contracts/continuity-schema.test.ts \
     tests/runner/handoff-hook-adapters.test.ts \
     tests/contracts/runtrace-schema.test.ts
   ```

7. Run full `npm run verify`.

For implementation slices, also run:

- `tests/contracts/guidance-decision-schema.test.ts`;
- `tests/contracts/runtrace-sequence.test.ts`;
- `tests/runtime/policy-memory-conflicts.test.ts`;
- `tests/runtime/memory-input-boundary.test.ts`;
- checkpoint, proof, recovery, and SafeApply death tests touched by the slice.

## Still Unsettled

- Exact MemoryInput storage location, if any.
- Whether memory packets are generated from continuity records, external memory,
  project files, or run summaries.
- Exact freshness threshold for `fresh` versus `stale`.
- Whether `memory_refs` should include every considered memory packet or only
  material used/rejected memory.
- Exact reason-code enum names.
- Whether `MemoryInputV0` is a standalone schema or only an artifact shape for
  `Ref.kind === "memory"`.
- How user preference memory becomes a policy change when the operator truly
  wants it to change policy.
- Whether host-injected handoff context should be stored as MemoryInput or only
  kept as `input_refs`.

## Review Checklist

Before implementing this spec, attack these risks:

- Memory sounds like permission instead of context.
- Memory appears in `constraint_refs`, `contract_refs`, `policy_refs`, or
  `evidence_refs`.
- Stale memory can choose a route, checkpoint answer, proof profile, or apply
  action.
- Continuity records and MemoryInput are merged into one unclear concept.
- Handoff brief context is treated as a resume request.
- Memory conflicts are ignored without trace.
- Memory lets a rejected ChangePacket, weak proof, generated-surface drift, or
  dirty parent checkout pass.
- Public copy describes memory as a smart control layer.
