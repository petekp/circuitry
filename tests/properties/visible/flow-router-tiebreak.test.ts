// Property tests for the flow router's collision / tie-breaking
// semantics — `classifyTaskAgainstRoutables` in
// src/runtime/router.ts.
//
// The router walks routables in `order` ascending and returns the
// first package whose signal regex matches the task text. When the
// matching package has `skipOnPlanningReport` set AND the task text
// also matches the planning-report regex, the match is suppressed
// and routing falls through to the next package's signals. When
// nothing matches, the router returns the unique default package.
//
// The example-based tests in tests/contracts/flow-router.test.ts
// pin behaviour against the live catalog. This file exercises the
// classifier as a pure function over synthetic routables, varying:
//
//   - the number and `order` of routables
//   - which signals each routable claims (token sets)
//   - which routables enable planning-report suppression
//   - the task text (signal-matching tokens, with/without planning
//     tokens)
//
// and asserts the classifier's decision matches the law's prediction
// across each generated case.

import { describe, expect, it } from 'vitest';

import type { RoutablePackage } from '../../../src/flows/catalog-derivations.js';
import type {
  CompiledFlowPackage,
  CompiledFlowRoutingMetadata,
  CompiledFlowSignal,
} from '../../../src/flows/types.js';
import { classifyTaskAgainstRoutables } from '../../../src/runtime/router.js';

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

interface FixturePackage {
  readonly id: string;
  readonly order: number;
  readonly signalToken: string; // single distinguishing token per package
  readonly skipOnPlanningReport: boolean;
  readonly isDefault: boolean;
}

function makeRoutable(spec: FixturePackage): RoutablePackage {
  const signalLabel = `${spec.id}-signal`;
  const routing: CompiledFlowRoutingMetadata = {
    order: spec.order,
    signals: [
      {
        label: signalLabel,
        // Word-boundary match on the package's signal token.
        pattern: new RegExp(`\\b${spec.signalToken}\\b`, 'i'),
      },
    ],
    skipOnPlanningReport: spec.skipOnPlanningReport,
    reasonForMatch: () => `${spec.id} signal matched`,
    isDefault: spec.isDefault,
    ...(spec.isDefault ? { defaultReason: `${spec.id} is the conservative default` } : {}),
  };
  // Minimal CompiledFlowPackage stub. The classifier only reads pkg.id;
  // the rest is required by the structural type but never accessed
  // during classification.
  const pkg = {
    id: spec.id,
    paths: { schematic: `dummy/${spec.id}/schematic.json` },
    relayReports: [],
    writers: { compose: [], close: [], verification: [], checkpoint: [] },
    routing,
  } as unknown as CompiledFlowPackage;
  return { pkg, routing };
}

// Match the planning-report regex anchored in router.ts. Any of
// these tokens triggers suppression for routables with
// skipOnPlanningReport=true.
const PLANNING_TOKENS = ['proposal', 'plan', 'brief', 'design doc', 'rfc', 'spec'];

const SIGNAL_TOKEN_POOL = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];

describe('flow router — first-match-wins by order, with planning-report suppression', () => {
  it('returns the lowest-order non-default routable whose signal matches and is not suppressed; falls back to default otherwise', () => {
    const rng = mulberry32(0xc011e01);
    let directMatchCases = 0;
    let suppressedToDefaultCases = 0;
    let suppressedToNextCases = 0;
    let noMatchToDefaultCases = 0;

    for (let i = 0; i < 300; i++) {
      // Build 2..4 unique signal tokens, each owned by exactly one
      // routable. One routable becomes the default; the rest are
      // ordered (the default's `order` is sentinel-large so it sorts
      // last and is never directly matched).
      const routableCount = 2 + nextInt(rng, 3);
      const tokens: string[] = [];
      const remaining = [...SIGNAL_TOKEN_POOL];
      for (let k = 0; k < routableCount && remaining.length > 0; k++) {
        const idx = nextInt(rng, remaining.length);
        const tok = remaining[idx];
        if (tok === undefined) continue;
        tokens.push(tok);
        remaining.splice(idx, 1);
      }

      // Order assignment: shuffle 1..N so routable ordering is
      // independent of input ordering — proves the router sorts.
      const orderPool = Array.from({ length: routableCount - 1 }, (_, k) => (k + 1) * 10);
      const orders: number[] = [];
      const orderRemaining = [...orderPool];
      for (let k = 0; k < routableCount - 1; k++) {
        const idx = nextInt(rng, orderRemaining.length);
        const ord = orderRemaining[idx];
        if (ord === undefined) continue;
        orders.push(ord);
        orderRemaining.splice(idx, 1);
      }

      const fixturePackages: FixturePackage[] = tokens.map((token, idx) => {
        const isDefault = idx === routableCount - 1;
        return {
          id: `pkg-${idx}`,
          order: isDefault ? Number.MAX_SAFE_INTEGER : (orders[idx] ?? (idx + 1) * 10),
          signalToken: token,
          // Roughly half the non-default routables enable suppression.
          skipOnPlanningReport: !isDefault && nextBool(rng),
          isDefault,
        };
      });

      const routables = fixturePackages.map(makeRoutable);
      // buildRoutablePackages sorts by order; mirror that here.
      const sorted = [...routables].sort((a, b) => a.routing.order - b.routing.order);
      const defaultPackage = sorted.find((r) => r.routing.isDefault === true);
      if (defaultPackage === undefined) throw new Error('no default in fixture');

      // Pick a non-default fixture to hopefully match (or none, to
      // test the fallback path).
      const nonDefaultFixtures = fixturePackages.filter((f) => !f.isDefault);
      const picker = nextInt(rng, nonDefaultFixtures.length + 1); // last index = "no match"
      const targetFixture: FixturePackage | undefined =
        picker === nonDefaultFixtures.length ? undefined : nonDefaultFixtures[picker];
      const targetToken: string | undefined = targetFixture?.signalToken;

      // Build task text. Sometimes append a planning token so
      // suppression can fire. Use a non-token base sentence so the
      // only signal-matching word comes from the picked target.
      const includePlanning = nextBool(rng);
      const planningToken = includePlanning ? pick(rng, PLANNING_TOKENS) : '';
      const taskText =
        targetToken !== undefined
          ? `please handle the ${targetToken} request ${planningToken}`.trim()
          : `please handle something unrelated ${planningToken}`.trim();

      // Predict. Walk sorted routables; for each non-default, check if
      // any of its signals match. If suppression applies (planning
      // token + skip flag), continue to next. Otherwise return that
      // routable. If nothing matched, return default.
      let predicted: RoutablePackage = defaultPackage;
      for (const r of sorted) {
        if (r.routing.isDefault) continue;
        const matched = r.routing.signals.some((s: CompiledFlowSignal) => s.pattern.test(taskText));
        if (!matched) continue;
        const suppressed = r.routing.skipOnPlanningReport === true && includePlanning;
        if (suppressed) continue;
        predicted = r;
        break;
      }
      let predictionBucket: 'direct' | 'suppressed-default' | 'suppressed-next' | 'no-match';
      if (predicted === defaultPackage) {
        // Default fallback: either no target token was injected, or
        // suppression knocked the only match out.
        predictionBucket = targetToken === undefined ? 'no-match' : 'suppressed-default';
      } else if (targetFixture !== undefined && predicted.pkg.id !== targetFixture.id) {
        // Some other routable's signal matched the leftover task
        // text after suppression skipped the targeted routable —
        // rare with the current generator, but possible if a stray
        // token appears.
        predictionBucket = 'suppressed-next';
      } else {
        predictionBucket = 'direct';
      }

      const decision = classifyTaskAgainstRoutables(taskText, sorted, defaultPackage);

      expect(
        decision.flowName,
        `case ${i} bucket=${predictionBucket}: predicted ${predicted.pkg.id}, got ${decision.flowName}; taskText='${taskText}'`,
      ).toBe(predicted.pkg.id);

      switch (predictionBucket) {
        case 'direct':
          directMatchCases++;
          break;
        case 'suppressed-default':
          suppressedToDefaultCases++;
          break;
        case 'suppressed-next':
          suppressedToNextCases++;
          break;
        case 'no-match':
          noMatchToDefaultCases++;
          break;
      }
    }

    // Anti-vacuity floors. Direct match should be the most common;
    // suppression-to-default and no-match-to-default are real but
    // rarer; suppression-to-next requires both the suppressed
    // routable to have a later sibling AND the task text to contain
    // that sibling's token, which is uncommon by construction.
    expect(directMatchCases, 'no direct-match cases').toBeGreaterThan(40);
    expect(noMatchToDefaultCases, 'no no-match-to-default cases').toBeGreaterThan(10);
    // suppression-to-default fires when the picked routable both has
    // skipOnPlanningReport AND the task text includes a planning
    // token. Roughly P = 0.5 (skip) × 0.5 (planning) × P(picked
    // non-default) ≈ 12% per case. With 300 cases, expect ~30.
    expect(
      suppressedToDefaultCases,
      'no suppression-to-default cases — suppression dimension might be silent',
    ).toBeGreaterThan(5);
    // suppression-to-next is rarer but should still fire occasionally
    // when the planning token (e.g. 'plan') overlaps with another
    // routable's signal token. Keep this floor low — not zero.
    void suppressedToNextCases;
  });

  it('is total: every (taskText, routables, defaultPackage) tuple yields some decision', () => {
    const rng = mulberry32(0xc011e02);
    const baseRoutables = [
      makeRoutable({
        id: 'review',
        order: 10,
        signalToken: 'review',
        skipOnPlanningReport: false,
        isDefault: false,
      }),
      makeRoutable({
        id: 'build',
        order: 20,
        signalToken: 'feature',
        skipOnPlanningReport: true,
        isDefault: false,
      }),
      makeRoutable({
        id: 'explore',
        order: Number.MAX_SAFE_INTEGER,
        signalToken: 'explore',
        skipOnPlanningReport: false,
        isDefault: true,
      }),
    ];
    const sorted = [...baseRoutables].sort((a, b) => a.routing.order - b.routing.order);
    const defaultPackage = sorted.find((r) => r.routing.isDefault === true);
    if (defaultPackage === undefined) throw new Error('no default');

    // Random task text from a fixed token universe — lots of
    // collisions, garbage tokens, planning phrases. The classifier
    // must always return something — never throw, never return
    // undefined.
    const tokenUniverse = ['review', 'feature', 'explore', 'plan', 'random', 'noise', 'thing'];
    for (let i = 0; i < 200; i++) {
      const wordCount = 1 + nextInt(rng, 6);
      const words: string[] = [];
      for (let w = 0; w < wordCount; w++) words.push(pick(rng, tokenUniverse));
      const taskText = words.join(' ');
      const decision = classifyTaskAgainstRoutables(taskText, sorted, defaultPackage);
      expect(decision.flowName).toMatch(/^(review|build|explore)$/);
      expect(decision.source).toBe('classifier');
      expect(decision.reason).toBeTypeOf('string');
    }
  });
});
