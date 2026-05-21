// Behavioral guarantees of the catalog-driven router, verified against
// synthetic mini-catalogs so the assertions don't depend on incidental
// properties of the live flow set.
//
// Unlike tests/contracts/flow-router.test.ts, which exercises the live
// classifier against real-world phrases, these tests isolate:
//   - routing.order precedence
//   - isDefault selection
//   - skipOnPlanningReport suppression

import { describe, expect, it } from 'vitest';

import { classifyTaskAgainstRoutables, deriveRoutingForTesting } from '../../src/flows/router.js';
import type { CompiledFlowPackage } from '../../src/flows/types.js';

function fakePackage(
  opts: Partial<CompiledFlowPackage> & { readonly id: string },
): CompiledFlowPackage {
  return {
    id: opts.id,
    visibility: opts.visibility ?? 'public',
    paths: opts.paths ?? { schematic: `synthetic/${opts.id}.schematic.json` },
    ...(opts.routing === undefined ? {} : { routing: opts.routing }),
    relayReports: opts.relayReports ?? [],
    writers: opts.writers ?? { compose: [], close: [], verification: [], checkpoint: [] },
  };
}

describe('router.classifyTaskAgainstRoutables — behavioral isolation', () => {
  it('routing.order precedence: a lower-order package wins on overlapping signals', () => {
    // Both packages match the same signal; lower order should win.
    const earlyMatcher = fakePackage({
      id: 'early',
      routing: {
        order: 10,
        signals: [{ label: 'shared', pattern: /\bfoo\b/i }],
        reasonForMatch: () => 'early matched',
      },
    });
    const lateMatcher = fakePackage({
      id: 'late',
      routing: {
        order: 20,
        signals: [{ label: 'shared', pattern: /\bfoo\b/i }],
        reasonForMatch: () => 'late matched',
      },
    });
    const fallback = fakePackage({
      id: 'fallback',
      routing: {
        order: 99,
        signals: [],
        reasonForMatch: () => 'fallback matched',
        isDefault: true,
        defaultReason: 'fallback default',
      },
    });
    // Input order intentionally puts late first so order-by-array would
    // pick the wrong winner.
    const { routables, defaultPackage } = deriveRoutingForTesting([
      lateMatcher,
      earlyMatcher,
      fallback,
    ]);
    const decision = classifyTaskAgainstRoutables('this is foo', routables, defaultPackage);
    expect(decision.flowName).toBe('early');
    expect(decision.matched_signal).toBe('shared');
  });

  it('routing.order is also the default tie-break — equal orders fall back to input order', () => {
    const a = fakePackage({
      id: 'a',
      routing: {
        order: 10,
        signals: [{ label: 'sigA', pattern: /\bbar\b/i }],
        reasonForMatch: () => 'a',
      },
    });
    const b = fakePackage({
      id: 'b',
      routing: {
        order: 10,
        signals: [{ label: 'sigB', pattern: /\bbar\b/i }],
        reasonForMatch: () => 'b',
      },
    });
    const fallback = fakePackage({
      id: 'fallback',
      routing: {
        order: 99,
        signals: [],
        reasonForMatch: () => 'fallback',
        isDefault: true,
      },
    });
    const { routables, defaultPackage } = deriveRoutingForTesting([a, b, fallback]);
    const decision = classifyTaskAgainstRoutables('bar', routables, defaultPackage);
    expect(decision.flowName).toBe('a');
  });

  it('isDefault: selected on no signal match independent of input position', () => {
    const matcher = fakePackage({
      id: 'matcher',
      routing: {
        order: 10,
        signals: [{ label: 'specific', pattern: /\bspecific\b/i }],
        reasonForMatch: () => 'specific matched',
      },
    });
    // Default package is at the START of input; a naive "last package
    // wins on no match" would pick matcher even when it shouldn't.
    const fallback = fakePackage({
      id: 'fallback',
      routing: {
        order: 99,
        signals: [],
        reasonForMatch: () => 'fallback (should not be called)',
        isDefault: true,
        defaultReason: 'fell through to default',
      },
    });
    const { routables, defaultPackage } = deriveRoutingForTesting([fallback, matcher]);
    const decision = classifyTaskAgainstRoutables(
      'unrelated text with no signals',
      routables,
      defaultPackage,
    );
    expect(decision.flowName).toBe('fallback');
    expect(decision.matched_signal).toBeUndefined();
    expect(decision.reason).toBe('fell through to default');
  });

  it('isDefault package never matches via its own signals (default branch is skipped in the loop)', () => {
    // Put a signal on the default package; the loop should still skip
    // it because routing.isDefault is true. This guards against future
    // refactors that forget the `if (routing.isDefault) continue;`.
    const fallback = fakePackage({
      id: 'fallback',
      routing: {
        order: 10,
        signals: [{ label: 'fallback-signal', pattern: /\banything\b/i }],
        reasonForMatch: () => 'fallback as match (should NOT happen)',
        isDefault: true,
        defaultReason: 'fell through',
      },
    });
    const { routables, defaultPackage } = deriveRoutingForTesting([fallback]);
    const decision = classifyTaskAgainstRoutables('anything goes', routables, defaultPackage);
    // Even though "anything" matches the signal on the default
    // package, the classifier should fall through to the default path
    // (which here picks the same package, but via the default reason
    // rather than the signal-match path).
    expect(decision.flowName).toBe('fallback');
    expect(decision.matched_signal).toBeUndefined();
    expect(decision.reason).toBe('fell through');
  });

  it('skipOnPlanningReport: a positive match is suppressed when text mentions a planning report', () => {
    const guarded = fakePackage({
      id: 'guarded',
      routing: {
        order: 10,
        signals: [{ label: 'guarded-signal', pattern: /\bbuild\b/i }],
        skipOnPlanningReport: true,
        reasonForMatch: () => 'guarded matched',
      },
    });
    const fallback = fakePackage({
      id: 'fallback',
      routing: {
        order: 99,
        signals: [],
        reasonForMatch: () => 'fallback',
        isDefault: true,
        defaultReason: 'planning suppression: fell through',
      },
    });
    const { routables, defaultPackage } = deriveRoutingForTesting([guarded, fallback]);
    // 'build' matches the signal AND 'proposal' triggers the planning
    // report regex → the match is suppressed and we fall through.
    const suppressed = classifyTaskAgainstRoutables(
      'build a proposal for foo',
      routables,
      defaultPackage,
    );
    expect(suppressed.flowName).toBe('fallback');
    expect(suppressed.reason).toBe('planning suppression: fell through');
    // 'build' alone, without a planning report, should match.
    const matched = classifyTaskAgainstRoutables('build something', routables, defaultPackage);
    expect(matched.flowName).toBe('guarded');
  });

  it('skipOnPlanningReport only suppresses packages that opt in', () => {
    // 'review' does NOT set skipOnPlanningReport; even with a
    // planning-report word in the request, it should still match.
    const unguarded = fakePackage({
      id: 'unguarded',
      routing: {
        order: 10,
        signals: [{ label: 'unguarded-signal', pattern: /\breview\b/i }],
        // skipOnPlanningReport intentionally omitted
        reasonForMatch: () => 'unguarded matched',
      },
    });
    const fallback = fakePackage({
      id: 'fallback',
      routing: {
        order: 99,
        signals: [],
        reasonForMatch: () => 'fallback',
        isDefault: true,
      },
    });
    const { routables, defaultPackage } = deriveRoutingForTesting([unguarded, fallback]);
    const decision = classifyTaskAgainstRoutables('review my proposal', routables, defaultPackage);
    expect(decision.flowName).toBe('unguarded');
  });
});
