// Property tests for the fanout join policies — pick-winner,
// disjoint-merge, aggregate-only, aggregate-survivors — driven through the pure
// `evaluateFanoutJoinPolicy` helper in src/shared/fanout-join-policy.ts.
//
// The example-based tests in tests/runtime/fanout.test.ts
// pin one or two witnesses per policy through the full async runner
// harness. Table-driven helper checks add width with hundreds of
// deterministically-generated outcome sets per policy and confirm the
// helper's decision matches the policy's law:
//
//   pick-winner       : winner is the first admit-order verdict that
//                       at least one `complete` branch produced; if no
//                       branch matched, the join fails.
//   disjoint-merge    : all branches must be admitted; with admitted
//                       outcomes, the join passes iff per-branch file
//                       lists are pairwise disjoint.
//   aggregate-only    : the join passes iff every branch reached a
//                       terminal child outcome AND every branch closed
//                       'complete' with a parseable result body.
//   aggregate-survivors: the join passes iff at least two branches closed
//                       'complete' with a parseable result body.
//
// Refactor note (2026-04-27): the join logic was extracted from
// 2026-05-06 note: the helper now lives in src/shared/fanout-join-policy.ts.
// Current fanout paths both call the shared helper after hoisting the
// only impure dimension (disjoint-merge's per-branch changed-file discovery)
// ahead of the call.

import { describe, expect, it } from 'vitest';

import {
  type FanoutJoinOutcome,
  evaluateFanoutJoinPolicy,
} from '../../../src/shared/fanout-join-policy.js';

type ChildOutcome = FanoutJoinOutcome['child_outcome'];

const CHILD_OUTCOMES: readonly ChildOutcome[] = [
  'complete',
  'aborted',
  'handoff',
  'stopped',
  'escalated',
];

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

function nextInt(rng: () => number, mod: number): number {
  return Math.floor((rng() / 0x100000000) * mod);
}

function nextBool(rng: () => number): boolean {
  return (rng() & 0x80000000) !== 0;
}

function pick<T>(rng: () => number, choices: readonly T[]): T {
  const value = choices[nextInt(rng, choices.length)];
  if (value === undefined) throw new Error('pick() on empty choices');
  return value;
}

describe('evaluateFanoutJoinPolicy — pick-winner', () => {
  // Property: among all complete+verdict-in-admit branches, the
  // winner is the one whose verdict appears earliest in admit order.
  // If no admit verdict matched any complete branch, fail with a
  // policy-specific reason.
  it('chooses the branch with the highest-priority admitted verdict, else fails with admit-order context', () => {
    const rng = mulberry32(0xfa1c01);
    const stepId = 'fanout-pick';
    let acceptedCount = 0;
    let rejectedCount = 0;

    const verdictPool = ['gold', 'silver', 'bronze', 'rust', 'noverdict'];

    for (let i = 0; i < 250; i++) {
      const branchCount = 1 + nextInt(rng, 5); // 1..5 branches
      // admitOrder is a random non-empty subset of verdictPool in
      // random order. Length up to 4 to keep priorities meaningful.
      const admitLength = 1 + nextInt(rng, 4);
      const admitOrder: string[] = [];
      const remaining = [...verdictPool];
      for (let k = 0; k < admitLength; k++) {
        if (remaining.length === 0) break;
        const idx = nextInt(rng, remaining.length);
        const item = remaining[idx];
        if (item === undefined) continue;
        admitOrder.push(item);
        remaining.splice(idx, 1);
      }

      const outcomes: FanoutJoinOutcome[] = [];
      for (let b = 0; b < branchCount; b++) {
        const branchId = `branch-${b}`;
        const childOutcome = pick(rng, CHILD_OUTCOMES);
        const verdict = pick(rng, verdictPool);
        const admitted = admitOrder.includes(verdict);
        outcomes.push({
          branch_id: branchId,
          child_outcome: childOutcome,
          verdict,
          admitted,
          ...(childOutcome === 'complete' ? { result_body: { verdict } } : {}),
        });
      }

      // Compute expected: scan admit order; first verdict for which
      // some branch is `complete` AND has that verdict wins. The
      // winner is the FIRST branch (in outcomes order) matching that
      // verdict.
      let expectedWinner: string | undefined;
      for (const v of admitOrder) {
        const found = outcomes.find((o) => o.child_outcome === 'complete' && o.verdict === v);
        if (found !== undefined) {
          expectedWinner = found.branch_id;
          break;
        }
      }

      const result = evaluateFanoutJoinPolicy({
        policy: 'pick-winner',
        stepId,
        admitOrder,
        outcomes,
      });

      if (expectedWinner !== undefined) {
        acceptedCount++;
        expect(result.joinedSuccessfully, `case ${i}: expected accept`).toBe(true);
        expect(result.winnerBranchId, `case ${i}: winner mismatch`).toBe(expectedWinner);
        expect(result.failureReason).toBeUndefined();
      } else {
        rejectedCount++;
        expect(result.joinedSuccessfully, `case ${i}: expected reject`).toBe(false);
        expect(result.winnerBranchId).toBeUndefined();
        expect(result.failureReason ?? '').toContain('pick-winner');
        expect(result.failureReason ?? '').toContain(admitOrder.join(', '));
      }
    }

    expect(acceptedCount).toBeGreaterThan(40);
    expect(rejectedCount).toBeGreaterThan(40);
  });
});

describe('evaluateFanoutJoinPolicy — disjoint-merge', () => {
  // Property: pass iff every branch is admitted AND per-branch file
  // lists are pairwise disjoint. If any branch is not admitted the
  // failure reason names the admission check; if a file collision
  // exists the failure reason names the colliding file and the two
  // branches.
  it('passes iff all admitted and file lists pairwise disjoint, else fails with the diagnostic reason', () => {
    const rng = mulberry32(0xfa1c02);
    const stepId = 'fanout-disjoint';
    let acceptedAll = 0;
    let rejectedNotAdmitted = 0;
    let rejectedFileCollision = 0;

    const filePool = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/shared.ts'];

    for (let i = 0; i < 300; i++) {
      const branchCount = 2 + nextInt(rng, 3); // 2..4 branches
      const outcomes: FanoutJoinOutcome[] = [];
      const branchFiles = new Map<string, readonly string[]>();
      let allAdmitted = true;
      for (let b = 0; b < branchCount; b++) {
        const branchId = `branch-${b}`;
        // Roughly 75% admitted to keep the not-admitted reject path
        // populated but not dominant.
        const admitted = !nextBool(rng) || !nextBool(rng);
        if (!admitted) allAdmitted = false;
        outcomes.push({
          branch_id: branchId,
          child_outcome: 'complete',
          verdict: admitted ? 'ok' : 'rejected',
          admitted,
          result_body: { verdict: admitted ? 'ok' : 'rejected' },
        });
        // Random file subset of size 1..3.
        const fileCount = 1 + nextInt(rng, 3);
        const files: string[] = [];
        const remaining = [...filePool];
        for (let f = 0; f < fileCount && remaining.length > 0; f++) {
          const idx = nextInt(rng, remaining.length);
          const item = remaining[idx];
          if (item === undefined) continue;
          files.push(item);
          remaining.splice(idx, 1);
        }
        branchFiles.set(branchId, files);
      }

      // Predict whether file lists are pairwise disjoint.
      let collidingFile: string | undefined;
      let collidingPriorBranch: string | undefined;
      let collidingNewBranch: string | undefined;
      const seenFile = new Map<string, string>();
      for (const o of outcomes) {
        const files = branchFiles.get(o.branch_id) ?? [];
        for (const f of files) {
          const prior = seenFile.get(f);
          if (prior !== undefined && prior !== o.branch_id) {
            collidingFile = f;
            collidingPriorBranch = prior;
            collidingNewBranch = o.branch_id;
            break;
          }
          seenFile.set(f, o.branch_id);
        }
        if (collidingFile !== undefined) break;
      }

      const result = evaluateFanoutJoinPolicy({
        policy: 'disjoint-merge',
        stepId,
        admitOrder: ['ok'],
        outcomes,
        branchFiles,
      });

      if (!allAdmitted) {
        rejectedNotAdmitted++;
        expect(result.joinedSuccessfully, `case ${i}: expected reject (not all admitted)`).toBe(
          false,
        );
        expect(result.failureReason ?? '').toContain('not all branches closed');
      } else if (collidingFile !== undefined) {
        rejectedFileCollision++;
        expect(result.joinedSuccessfully, `case ${i}: expected reject (file collision)`).toBe(
          false,
        );
        // Helper picks the FIRST collision in iteration order; both
        // colliding branches must be named in the reason.
        expect(result.failureReason ?? '').toContain(`'${collidingFile}'`);
        expect(result.failureReason ?? '').toContain(collidingPriorBranch ?? '');
        expect(result.failureReason ?? '').toContain(collidingNewBranch ?? '');
      } else {
        acceptedAll++;
        expect(
          result.joinedSuccessfully,
          `case ${i}: expected accept (all admitted, files disjoint)`,
        ).toBe(true);
        expect(result.failureReason).toBeUndefined();
      }
    }

    expect(acceptedAll, 'no all-disjoint accept cases').toBeGreaterThan(20);
    expect(rejectedNotAdmitted, 'no not-admitted reject cases').toBeGreaterThan(20);
    expect(rejectedFileCollision, 'no file-collision reject cases').toBeGreaterThan(20);
  });

  // Property: when the runner reports a file-discovery error
  // (branchFilesError) the helper surfaces it in the failure reason
  // unchanged, regardless of whether collisions could have occurred.
  it('forwards branchFilesError unchanged when file discovery fails', () => {
    const rng = mulberry32(0xfa1c03);
    for (let i = 0; i < 50; i++) {
      const errorMessage = `git diff failed (case ${i})`;
      const outcomes: FanoutJoinOutcome[] = Array.from({ length: 1 + nextInt(rng, 3) }, (_, b) => ({
        branch_id: `branch-${b}`,
        child_outcome: 'complete',
        verdict: 'ok',
        admitted: true,
        result_body: { verdict: 'ok' },
      }));

      const result = evaluateFanoutJoinPolicy({
        policy: 'disjoint-merge',
        stepId: 'fanout-disjoint-error',
        admitOrder: ['ok'],
        outcomes,
        branchFilesError: errorMessage,
      });

      expect(result.joinedSuccessfully).toBe(false);
      expect(result.failureReason ?? '').toContain('file-disjoint validation failed');
      expect(result.failureReason ?? '').toContain(errorMessage);
    }
  });
});

describe('evaluateFanoutJoinPolicy — aggregate-only', () => {
  // Property: pass iff every branch closed at a terminal child
  // outcome AND every branch closed 'complete' with a parseable
  // result body. Verdict admission is intentionally ignored.
  it('passes iff all complete with parseable body, regardless of verdict admission', () => {
    const rng = mulberry32(0xfa1c04);
    const stepId = 'fanout-aggregate';
    let acceptedAll = 0;
    let rejectedNotParseable = 0;

    // Note: aggregate-only's "did not close cleanly" reject path is
    // unreachable from this generator because CHILD_OUTCOMES is the
    // exhaustive set of terminal child outcomes. The helper still
    // implements the not-closed branch defensively (it would matter
    // if a non-terminal value were ever added to the union); the
    // example-based tests cover that branch via the runner harness.
    // Here we cover the two reachable verdicts: accept (all complete
    // + parseable) and reject (some branch not parseable).

    for (let i = 0; i < 300; i++) {
      const branchCount = 1 + nextInt(rng, 4);
      const outcomes: FanoutJoinOutcome[] = [];
      let allParseable = true;
      // Happy mode (50%) forces complete+body on every branch so the
      // accept branch sees enough cases. Random mode (50%) draws
      // child_outcome uniformly from the full union and randomly omits
      // result_body — drives the reject branch.
      const happyMode = nextBool(rng);
      for (let b = 0; b < branchCount; b++) {
        const branchId = `branch-${b}`;
        const childOutcome = happyMode ? 'complete' : pick(rng, CHILD_OUTCOMES);
        const includeBody = childOutcome === 'complete' && (happyMode || nextBool(rng));
        if (childOutcome !== 'complete') {
          allParseable = false;
        }
        if (childOutcome === 'complete' && !includeBody) {
          allParseable = false;
        }
        outcomes.push({
          branch_id: branchId,
          child_outcome: childOutcome,
          verdict: 'whatever', // aggregate-only ignores verdict
          admitted: false, // aggregate-only ignores admission
          ...(includeBody ? { result_body: { verdict: 'whatever' } } : {}),
        });
      }

      const result = evaluateFanoutJoinPolicy({
        policy: 'aggregate-only',
        stepId,
        admitOrder: ['ok'],
        outcomes,
      });

      if (!allParseable) {
        rejectedNotParseable++;
        expect(result.joinedSuccessfully, `case ${i}: expected reject (not all parseable)`).toBe(
          false,
        );
        expect(result.failureReason ?? '').toContain('aggregate-only');
        expect(result.failureReason ?? '').toMatch(/parseable result body|did not close cleanly/);
      } else {
        acceptedAll++;
        expect(
          result.joinedSuccessfully,
          `case ${i}: expected accept (all complete + parseable)`,
        ).toBe(true);
      }
    }

    expect(acceptedAll, 'no all-clean accept cases').toBeGreaterThan(20);
    expect(rejectedNotParseable, 'no not-parseable reject cases').toBeGreaterThan(20);
  });
});

describe('evaluateFanoutJoinPolicy — aggregate-survivors', () => {
  // Property: pass iff at least two branches closed 'complete' with a
  // parseable result body. Failed or unparseable siblings do not block
  // the survivor join as long as two usable strands remain.
  it('passes iff at least two complete branches have parseable bodies', () => {
    const rng = mulberry32(0xfa1c05);
    const stepId = 'fanout-survivors';
    let acceptedEnoughSurvivors = 0;
    let rejectedCollapsed = 0;

    for (let i = 0; i < 300; i++) {
      const forceEnoughSurvivors = nextBool(rng);
      const branchCount = forceEnoughSurvivors ? 2 + nextInt(rng, 4) : 1 + nextInt(rng, 5);
      const outcomes: FanoutJoinOutcome[] = [];
      let parseableSurvivorCount = 0;

      for (let b = 0; b < branchCount; b++) {
        const branchId = `branch-${b}`;
        const forcedSurvivor = forceEnoughSurvivors && b < 2;
        const childOutcome = forcedSurvivor ? 'complete' : pick(rng, CHILD_OUTCOMES);
        const includeBody = forcedSurvivor || (childOutcome === 'complete' && nextBool(rng));
        if (includeBody) parseableSurvivorCount += 1;
        outcomes.push({
          branch_id: branchId,
          child_outcome: childOutcome,
          verdict: includeBody ? 'accept' : 'whatever',
          admitted: includeBody,
          ...(includeBody ? { result_body: { verdict: 'accept' } } : {}),
        });
      }

      const result = evaluateFanoutJoinPolicy({
        policy: 'aggregate-survivors',
        stepId,
        admitOrder: ['accept'],
        outcomes,
      });

      if (parseableSurvivorCount >= 2) {
        acceptedEnoughSurvivors++;
        expect(
          result.joinedSuccessfully,
          `case ${i}: expected accept with ${parseableSurvivorCount} parseable survivors`,
        ).toBe(true);
      } else {
        rejectedCollapsed++;
        expect(
          result.joinedSuccessfully,
          `case ${i}: expected collapse with ${parseableSurvivorCount} parseable survivors`,
        ).toBe(false);
        expect(result.failureReason ?? '').toContain('tournament collapsed:');
      }
    }

    expect(acceptedEnoughSurvivors, 'no enough-survivor accept cases').toBeGreaterThan(20);
    expect(rejectedCollapsed, 'no collapsed reject cases').toBeGreaterThan(20);
  });
});
