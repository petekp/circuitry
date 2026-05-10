// Fix change-set writer.
//
// Runs after fix-verify (and after fix-regression-rerun, which sits between
// them in the schematic). Captures the post-fix git state via the same
// git-state helper used by fix-baseline-snapshot, then computes the set of
// files actually touched by the fix as:
//
//     observed = (paths newly-dirty post-fix)
//              ∪ (paths dirty at baseline whose fingerprint changed)
//
// The fingerprint check is what closes the "pre-existing dirt" hole — without
// it, an adversary could further-modify an already-dirty file, omit it from
// changed_files, and the path-set subtraction would silently drop it. With
// the check, mutated baseline-dirty paths show up in observed, where
// undeclared mutations become undeclared_extras and force status='fail'.
//
// HEAD is also compared between baseline and post-fix. If they differ the
// agent committed mid-run, which the contract does not currently allow; the
// writer flags it via reason rather than silently treating commits as no-ops.
// This is a fail-closed default — supporting committed diffs would require
// reading a baseline..HEAD range and is out of scope for this slice.
//
// hidden_index_flags from the post-fix snapshot are also a hard fail. A path
// flagged assume-unchanged or skip-worktree is invisible to git status and
// can hide tracked edits; the writer refuses status='pass' if any such flag
// exists in the working tree.

import { readFileSync } from 'node:fs';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import { reportPathForSchemaInCompiledFlow } from '../../registries/close-writers/shared.js';
import type {
  VerificationBuildContext,
  VerificationBuilder,
  VerificationCommand,
  VerificationCommandObservation,
} from '../../registries/verification-writers/types.js';
import {
  FixBaselineSnapshot,
  type FixBaselineSnapshotEntry,
  FixChange,
  FixChangeSet,
  type FixHiddenIndexFlag,
} from '../reports.js';
import {
  type GitStateHelperOutput,
  fixGitStateCommand,
  parseGitStateObservation,
} from './baseline-snapshot.js';

function fingerprintsByPath(entries: readonly FixBaselineSnapshotEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(entry.path, entry.fingerprint);
  }
  return map;
}

function hiddenFlagsByPath(flags: readonly FixHiddenIndexFlag[]): Set<string> {
  return new Set(flags.map((f) => f.path));
}

function computeChangeSet(options: {
  baseline: FixBaselineSnapshot;
  post: GitStateHelperOutput;
  declared: readonly string[];
}) {
  const { baseline, post, declared } = options;
  const baselineFingerprints = fingerprintsByPath(baseline.entries);
  const postFingerprints = fingerprintsByPath(post.entries);
  const baselinePaths = new Set(baselineFingerprints.keys());
  const postPaths = new Set(postFingerprints.keys());
  const baselineHiddenPaths = hiddenFlagsByPath(baseline.hidden_index_flags);

  // 1. Newly-dirty paths: in post, not in baseline.
  const newDirt = [...postPaths].filter((path) => !baselinePaths.has(path));

  // 2. Mutated baseline-dirty paths: in baseline, fingerprint differs (or path
  //    is no longer dirty post-fix, which still counts as a touch — the
  //    working-tree state changed). The exception is paths that were
  //    already flagged hidden at baseline; we don't trust baseline
  //    fingerprints for those because git status (and hash-object) may not
  //    reflect their true state. Surfacing them as hidden_index_flags below
  //    is enough to fail the verdict.
  const baselineDirtyMutated = [...baselinePaths].filter((path) => {
    if (baselineHiddenPaths.has(path)) return false;
    const before = baselineFingerprints.get(path);
    const after = postFingerprints.get(path);
    return before !== after;
  });

  const observedSet = new Set<string>([...newDirt, ...baselineDirtyMutated]);
  const observed = [...observedSet].sort((a, b) => a.localeCompare(b));
  const declaredSorted = [...declared].sort((a, b) => a.localeCompare(b));
  const declaredSet = new Set(declaredSorted);
  const undeclaredExtras = observed.filter((path) => !declaredSet.has(path));
  const missingDeclared = declaredSorted.filter((path) => !observedSet.has(path));
  const baselineDirtyMutatedSorted = [...baselineDirtyMutated].sort((a, b) => a.localeCompare(b));

  return {
    observed,
    declared: declaredSorted,
    undeclaredExtras,
    missingDeclared,
    baselineDirtyMutated: baselineDirtyMutatedSorted,
  };
}

export const fixChangeSetWriter: VerificationBuilder = {
  resultSchemaName: 'fix.change-set@v1',
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[] {
    // Verify that this step reads the inputs the writer requires; mirror the
    // pattern in regression-baseline so misconfigured schematics fail fast.
    const baselinePath = reportPathForSchemaInCompiledFlow(
      context.flow,
      'fix.baseline-snapshot@v1',
    );
    const changePath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.change@v1');
    if (!context.step.reads.includes(baselinePath as never)) {
      throw new Error(
        `fix.change-set@v1 requires step '${context.step.id}' to read ${baselinePath}`,
      );
    }
    if (!context.step.reads.includes(changePath as never)) {
      throw new Error(`fix.change-set@v1 requires step '${context.step.id}' to read ${changePath}`);
    }
    return [fixGitStateCommand('fix-change-set-git-state')];
  },
  buildResult(
    observations: readonly VerificationCommandObservation[],
    context: VerificationBuildContext,
  ): unknown {
    if (observations.length !== 1) {
      throw new Error(
        `fix.change-set@v1: expected 1 git-state observation, got ${observations.length}`,
      );
    }
    const observation = observations[0];
    if (observation === undefined) {
      throw new Error('fix.change-set@v1: git-state observation missing');
    }
    const post = parseGitStateObservation(observation, 'fix.change-set@v1');

    const baselinePath = reportPathForSchemaInCompiledFlow(
      context.flow,
      'fix.baseline-snapshot@v1',
    );
    const changePath = reportPathForSchemaInCompiledFlow(context.flow, 'fix.change@v1');
    const baseline = FixBaselineSnapshot.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, baselinePath), 'utf8')),
    );
    const change = FixChange.parse(
      JSON.parse(readFileSync(resolveRunRelative(context.runFolder, changePath), 'utf8')),
    );

    const computed = computeChangeSet({
      baseline,
      post,
      declared: change.changed_files,
    });

    const headDiverged = post.head_sha !== baseline.head_sha;
    const hiddenFlags: readonly FixHiddenIndexFlag[] = post.hidden_index_flags;
    const setsClean =
      computed.undeclaredExtras.length === 0 && computed.missingDeclared.length === 0;
    const status_: 'pass' | 'fail' =
      setsClean && !headDiverged && hiddenFlags.length === 0 ? 'pass' : 'fail';

    let reason: string | undefined;
    if (status_ === 'fail') {
      const parts: string[] = [];
      if (headDiverged) {
        parts.push(
          `HEAD moved during the fix run (baseline ${baseline.head_sha}, post ${post.head_sha}); the agent committed mid-run, which the change-set writer cannot reconcile against the declared file list.`,
        );
      }
      if (computed.undeclaredExtras.length > 0) {
        parts.push(`undeclared extras: ${computed.undeclaredExtras.join(', ')}`);
      }
      if (computed.missingDeclared.length > 0) {
        parts.push(`missing declared: ${computed.missingDeclared.join(', ')}`);
      }
      if (hiddenFlags.length > 0) {
        const labelled = hiddenFlags.map((f) => `${f.path} (${f.tag})`).join(', ');
        parts.push(
          `hidden index flags present (assume-unchanged or skip-worktree paths can hide tracked edits from git status): ${labelled}`,
        );
      }
      reason = parts.join('; ');
    }

    return FixChangeSet.parse({
      status: status_,
      overall_status: status_ === 'pass' ? 'passed' : 'failed',
      ...(reason === undefined ? {} : { reason }),
      baseline_head_sha: baseline.head_sha,
      head_sha: post.head_sha,
      declared: computed.declared,
      observed: computed.observed,
      undeclared_extras: computed.undeclaredExtras,
      missing_declared: computed.missingDeclared,
      baseline_dirty_mutated: computed.baselineDirtyMutated,
      hidden_index_flags: [...hiddenFlags],
    });
  },
};
