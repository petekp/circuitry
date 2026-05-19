# Sandboxed parallel Pursue

Date: 2026-05-16

Idea for letting Pursue run multiple code-changing pursuits in parallel
without trusting agents to politely avoid each other. The product goal is
simple: the operator throws several goals at Circuit, Pursue coordinates
them, parallelizes what is actually safe, applies only verified change packets
to the parent checkout, and checks in only when it cannot prove safety.

This grew out of the Pursue V1 limitation: Pursue can coordinate multiple
pursuits, but code-changing work is serial-only. It may parallelize
read-only discovery, but it does not let two implementers mutate the same
checkout at once.

## Product thesis

Parallel pursuit should be a runtime-owned safety feature, not a prompt
instruction.

The coordinator can propose that two pursuits look independent. That is
useful, but it is not proof. The runtime has to isolate each branch,
measure what really changed, reject overlaps, apply safe change packets, and
run final verification on the composed result.

The rule:

> Agents may work in parallel. Only Circuit applies verified change packets to
> the parent checkout.

That keeps the user-facing experience high trust: "throw ideas at
Circuit" does not become "hope several agents do not collide."

## Current baseline

Pursue V1 already has the right coordination vocabulary:

- `pursuit.contract@v1` names the pursuits, estimated touch sets, and
  execution policy.
- `pursuit.graph@v1` records dependencies, conflicts, serial groups, and
  parallel read-only groups.
- `pursuit.wave-plan@v1` allows parallel read-only waves but rejects
  parallel code-change waves.
- `pursuit.batch@v1` requires `serialized_execution: true`.

The runtime also has useful substrate outside Pursue:

- `fanout` can run multiple branches with bounded concurrency.
- `fanout` can expand branches dynamically from an upstream report.
- sub-run fanout branches get their own git worktrees.
- `disjoint-merge` already validates per-branch changed files are
  pairwise disjoint.

The missing piece is safe apply. The current worktree runner can add,
remove, and list changed files for branch worktrees. It does not yet
produce patches or apply branch changes back into the parent checkout.

So this is not a blank-slate feature. It is a careful extension of the
fanout and sub-run substrate, plus a stronger change packet boundary.

## Why not one shared worktree

A shared worktree only works if the coordinator's prediction is perfect
and every agent behaves perfectly. That is the wrong trust boundary.

Even when estimated touch sets do not overlap, agents can still collide:

- A formatter, codegen step, package manager, or test command rewrites
  shared files.
- Two branches both update lockfiles, snapshots, generated outputs,
  exports, or docs indexes.
- One agent reads a file while another agent is halfway through editing
  it.
- One verification run sees another agent's unfinished work and reports
  false confidence or false failure.
- Git cannot cleanly attribute which agent changed which file unless the
  runtime snapshots constantly.
- File-level non-overlap can still hide symbol-level coupling.

A shared worktree is fine for read-only discovery. It is the wrong
default for parallel writes.

## Worktree isolation vs security sandboxing

There are two related but different features.

**Worktree isolation** prevents parallel agents from trampling each
other's code changes. Each agent gets a separate checkout at the same
base ref. Circuit collects each branch's patch, changed-file manifest,
logs, and proof. The parent checkout stays untouched until Circuit
applies accepted change packets.

**Security sandboxing** prevents untrusted code from reading or mutating
resources outside its boundary. That means filesystem allowlists,
network policy, no ambient secrets, process limits, cleanup guarantees,
and change-packet-only exit.

Pursue should ship worktree isolation first. True sandboxing should plug
in behind the same change packet interface.

## Clean runtime API

The runtime API should make isolation and apply explicit. Do not overload
the existing serial batch shape.

Proposed fanout join policy:

```json
{
  "kind": "fanout",
  "branches": {
    "kind": "dynamic",
    "source_report": "reports/pursuit/parallel-branches.json",
    "items_path": "branches",
    "template": {
      "branch_id": "$item.id",
      "flow_ref": {
        "flow_id": "build",
        "entry_mode": "default"
      },
      "goal": "$item.goal",
      "depth": "standard"
    },
    "max_branches": 8
  },
  "concurrency": {
    "kind": "bounded",
    "max": 4
  },
  "check": {
    "kind": "fanout_aggregate",
    "source": {
      "kind": "fanout_results",
      "ref": "aggregate"
    },
    "join": {
      "policy": "disjoint-apply",
      "isolation": {
        "kind": "worktree",
        "backend": "git-worktree"
      },
      "disjointness": "changed-files",
      "apply": {
        "method": "patch",
        "order": "topological",
        "conflict_policy": "reject"
      }
    },
    "verdicts": {
      "admit": ["complete"]
    }
  }
}
```

`disjoint-apply` should be a new policy. The runtime can keep the older
`disjoint-merge` behavior stable while the new policy carries the
stronger promise: collect branch change packets, prove disjointness, apply to
parent, then verify the composed checkout.

## Pursue contract shape

Pursue should expose parallel code execution as an execution policy, not
as a loose mode flag.

```ts
execution_policy: {
  code_writes: 'parallel-isolated-apply',
  isolation: 'worktree',
  read_only_parallelism: 'allowed',
  parallel_write_status: 'allowed-when-runtime-proves-disjoint',
  max_parallel_code_branches: 4
}
```

Serial should remain available:

```ts
execution_policy: {
  code_writes: 'serial-only',
  read_only_parallelism: 'allowed',
  parallel_write_status: 'blocked-until-safe-apply'
}
```

That lets Pursue choose conservatively. If the coordinator cannot prove
the branches are safe candidates, it falls back to serial work.

## Change packet report

Add a first-class apply report instead of hiding the important evidence
inside a generic aggregate.

```ts
pursuit.parallel_apply@v1 = {
  verdict: 'applied' | 'partial' | 'blocked',
  base_ref: string,
  branches: [
    {
      pursuit_id: string,
      child_run_id: string,
      worktree_path: string,
      declared_touch_set: PursuitTouchSet,
      actual_changed_files: string[],
      patch_path: string,
      apply_status: 'applied' | 'conflict' | 'rejected',
      evidence: string[]
    }
  ],
  applied_order: string[],
  rejected: [
    {
      pursuit_id: string,
      reason: string,
      evidence: string[]
    }
  ],
  verification_command: string,
  verification_status: 'passed' | 'failed' | 'skipped'
}
```

This report is the operator's proof packet. It should answer: what ran,
what changed, what was applied, what was rejected, and what proved the
combined result.

## Sandbox runner API

Security sandboxing should arrive as a backend behind the same change packet
pipeline. The Pursue API should not care whether isolation is a git
worktree, container, VM, microVM, or remote runner.

```ts
interface SandboxRunner {
  prepare(input: {
    repoRoot: string;
    baseRef: string;
    mounts: SandboxMount[];
    network: 'none' | 'allowlisted' | 'full';
    secrets: SandboxSecret[];
    limits: SandboxLimits;
  }): Promise<SandboxHandle>;

  run(
    handle: SandboxHandle,
    command: string,
    args: string[],
  ): Promise<SandboxCommandResult>;

  collect(handle: SandboxHandle): Promise<{
    patch: string;
    changedFiles: string[];
    logs: string[];
    evidence: string[];
  }>;

  destroy(handle: SandboxHandle): Promise<void>;
}
```

The first backend can be `git-worktree`, which is not a security
sandbox. Later backends can add real security boundaries without
changing the Pursue contract.

## Implementation slices

This is sized for a strong coding agent working in focused sessions, not
for a human calendar plan.

### Slice 1: Worktree change packet substrate

Add branch change packet collection to the existing fanout/sub-run worktree
path.

Expected changes:

- Extend `WorktreeRunner` with patch collection and apply support.
- Add changed-file and patch manifests per branch.
- Keep parent checkout untouched until join.
- Add tests where two branches change different files and produce
  distinct change packets.

Acceptance:

- Parallel branches can complete in isolated worktrees.
- The parent checkout is unchanged before apply.
- The aggregate records per-branch patch paths and changed files.

### Slice 2: Disjoint apply join policy

Add `disjoint-apply` as a new fanout join policy.

Expected changes:

- Schema support for the new join policy.
- Runtime validation that every admitted branch has a patch and changed
  files.
- Pairwise changed-file disjointness check.
- Apply patches in a deterministic order.
- Reject on overlap or patch conflict.

Acceptance:

- Disjoint branches apply cleanly to the parent checkout.
- Overlapping branches fail before apply.
- Patch conflicts fail with a clear report.
- Cleanup runs even on failure.

### Slice 3: Pursue parallel worktree mode

Let Pursue produce dynamic fanout branches for safe code-changing
pursuits.

Expected changes:

- Add `parallel-isolated-apply` to Pursue contract/report schemas.
- Add a branch-plan report for pursuits that can run in parallel.
- Route safe groups into `fanout` with `disjoint-apply`.
- Fall back to serial batch when safety is unclear.

Acceptance:

- Multiple independent pursuits run as isolated child Build runs.
- Pursue still serializes unclear or overlapping work.
- Final Pursue result shows completed, rejected, and applied counts.

### Slice 4: Change packet-only worker contract

Make the worker boundary explicit: branch agents produce change packets,
Circuit applies them.

Expected changes:

- Branch child output includes patch path, changed files, command
  evidence, and result JSON.
- Operator summary explains which change packets were applied and why.
- Final verification runs after all accepted patches are applied.

Acceptance:

- No branch mutates the parent checkout directly.
- Operator can inspect every accepted and rejected change packet.
- Final verification failure blocks a "complete" outcome.

### Slice 5: SandboxRunner abstraction

Introduce a backend interface for true sandboxing without changing
Pursue again.

Expected changes:

- Add `SandboxRunner`.
- Add an initial `worktree` backend that implements the interface
  without claiming security isolation.
- Thread isolation backend selection through runtime options.

Acceptance:

- Pursue can run through the same change packet pipeline using the
  `worktree` backend.
- Backend choice is visible in reports and trace entries.
- The API is ready for container or remote sandbox backends.

### Slice 6: Real sandbox backend

Add one true sandbox backend.

Minimum credible behavior:

- Filesystem deny-by-default, with only the repo and explicit caches
  mounted.
- No ambient access to `~/.ssh`, shell profiles, `.env` outside the
  mounted repo, browser profiles, or keychains.
- Network policy: `none` or allowlisted egress.
- Secret policy: no ambient secrets; scoped injected secrets only.
- CPU, memory, disk, process, and wall-clock limits.
- Change packet-only exit.

Acceptance:

- A sandboxed branch cannot read a known forbidden host file.
- A sandboxed branch cannot make network calls when network is disabled.
- A runaway process is terminated and cleaned up.
- The parent checkout only receives collected change packets.

## Expected effort with Codex 5.5 xhigh

Assuming a strong agent on a fast loop with adversarial review after each
slice:

| Target | Expected effort |
| --- | --- |
| Worktree change packet substrate | 1 strong session |
| `disjoint-apply` join policy | 1 strong session |
| Pursue parallel worktree mode | 1-2 strong sessions |
| Change packet-only operator proof packet | 1 strong session |
| `SandboxRunner` abstraction | 1 strong session |
| First credible sandbox backend | 3-6 strong sessions plus review |

The useful V1 is worktree isolation plus change-packet-only apply. Calling it
"true security sandboxing" requires the later backend and a threat-model
review.

## Risks

**False disjointness.** File-level disjointness is necessary but not
sufficient. Two branches can change different files but still break a
shared API. Final verification is mandatory, and high-risk branches may
still need serial ordering.

**Generated files and lockfiles.** These are collision magnets. Pursue
should treat generated outputs, lockfiles, snapshots, and package
manifests as high-risk touch points unless the runtime proves otherwise.

**Dirty parent checkout.** Parallel apply should require a clean or
explicitly snapshotted parent baseline. Otherwise Circuit cannot tell
which changes came from branch change packets.

**Overclaiming security.** Worktree isolation is not security
sandboxing. The product copy and reports must say which backend ran.

**Cleanup failure.** Failed worktree or sandbox cleanup should be
operator-visible and recoverable, but should not hide the primary
failure.

## Non-goals for V1

- Full security sandboxing.
- Automatic semantic conflict resolution.
- Parallel writes inside a single shared worktree.
- Applying change packets when final verification fails.
- Letting the coordinator override runtime safety checks.

## The narrow first build

The first build should prove one story:

1. Pursue receives three independent code goals.
2. The coordinator creates three isolated branches.
3. Branches run in parallel worktrees.
4. Circuit collects patches and changed-file manifests.
5. Circuit rejects overlaps.
6. Circuit applies disjoint patches in a deterministic order.
7. Circuit runs final verification.
8. Circuit closes with a clear proof packet.

If that works, the feature is already valuable before true security
sandboxing exists. The security backend can then improve the isolation
boundary without changing the Pursue UX.
