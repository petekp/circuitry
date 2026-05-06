// Proof that the relay shape-hint registry is flow-agnostic.
//
// Mirrors tests/runner/compose-builder-registry.test.ts but for the
// relay shape-hint path. Verifies every registered schema returns
// its hint, unknown schemas miss the schema lookup, and the structural
// reviewer-role match fires when no schema match is available.
//
// Expected sets are DERIVED from src/flows/catalog.ts so adding a
// new flow's hint doesn't require this test to know about it. The
// invariant being checked is the round-trip: every hint declared in
// the catalog ends up in the registry, and vice versa.

import { describe, expect, it } from 'vitest';

import { flowPackages } from '../../src/flows/catalog.js';
import {
  findRelayShapeHint,
  listRegisteredSchemaHints,
  listRegisteredStructuralHints,
} from '../../src/flows/registries/shape-hints/registry.js';
import type { RelayStep } from '../../src/flows/registries/shape-hints/types.js';

const EXPECTED_SCHEMA_HINTS: readonly string[] = flowPackages.flatMap((pkg) =>
  pkg.relayReports.filter((a) => a.relayHint !== undefined).map((a) => a.schemaName),
);

const EXPECTED_STRUCTURAL_HINT_IDS: readonly string[] = flowPackages.flatMap(
  (pkg) => pkg.structuralHints?.map((hint) => hint.id) ?? [],
);

function relayStepWithSchema(schema: string): RelayStep {
  return {
    id: 'test-step',
    title: 'test',
    protocol: 'test@v1',
    reads: [],
    routes: { pass: '@complete' },
    executor: 'orchestrator',
    kind: 'relay',
    role: 'implementer',
    writes: { report: { path: 'reports/test.json', schema } },
    check: { pass: ['accept'] },
  } as unknown as RelayStep;
}

function reviewerStructuralStep(): RelayStep {
  return {
    id: 'audit-step',
    title: 'audit',
    protocol: 'review@v1',
    reads: [],
    routes: { pass: '@continue' },
    executor: 'orchestrator',
    kind: 'relay',
    role: 'reviewer',
    writes: {
      request_path: 'reports/relay/review.request.json',
      receipt_path: 'reports/relay/review.receipt.txt',
      result_path: 'reports/relay/review.result.json',
    },
    check: { pass: ['NO_ISSUES_FOUND', 'ISSUES_FOUND'] },
  } as unknown as RelayStep;
}

describe('relay shape-hint registry', () => {
  it('round-trips every catalog-declared schema hint through the registry', () => {
    // Floor: at least the seven hints landed before this refactor must
    // still be present. Prevents the derived-set test from passing
    // vacuously if some future catalog change were to drop every
    // relayHint.
    expect(EXPECTED_SCHEMA_HINTS.length).toBeGreaterThanOrEqual(7);

    const registered = listRegisteredSchemaHints().map((hint) => hint.schema);
    expect(
      [...registered].sort(),
      'registered schema hints must match the catalog set exactly (drift = a flow added a hint without registering, or vice versa)',
    ).toEqual([...EXPECTED_SCHEMA_HINTS].sort());

    for (const schema of EXPECTED_SCHEMA_HINTS) {
      const instruction = findRelayShapeHint(relayStepWithSchema(schema));
      expect(instruction, `expected hint for ${schema}`).toBeDefined();
      expect(instruction).toContain('Respond with a single raw JSON object');
      expect(instruction).toContain(schema);
    }
  });

  it('Sweep hints describe each Sweep relay report shape', () => {
    function requireHint(schema: string): string {
      const hint = findRelayShapeHint(relayStepWithSchema(schema));
      if (hint === undefined) throw new Error(`expected relay shape hint for ${schema}`);
      return hint;
    }

    const analysis = requireHint('sweep.analysis@v1');
    expect(analysis).toContain('"candidates"');
    expect(analysis).toContain('"confidence"');
    expect(analysis).toContain('"risk"');

    const batch = requireHint('sweep.batch@v1');
    expect(batch).toContain('"items"');
    expect(batch).toContain('"candidate_id"');
    expect(batch).toContain('to_execute');

    const review = requireHint('sweep.review@v1');
    expect(review).toContain('"findings"');
    expect(review).toContain('clean');
    expect(review).toContain('critical-injections');
  });

  it('Build hints keep implementation and review scoped to the requested behavior', () => {
    const implementation = findRelayShapeHint(relayStepWithSchema('build.implementation@v1'));
    const review = findRelayShapeHint(relayStepWithSchema('build.review@v1'));

    expect(implementation).toContain('smallest behaviorally scoped change');
    expect(implementation).toContain('Do not broaden semantics');
    expect(review).toContain('not just against passing tests');
    expect(review).toContain('broadens semantics beyond the goal');
  });

  it('returns undefined when the schema is not registered and no structural hint matches', () => {
    expect(findRelayShapeHint(relayStepWithSchema('unknown.schema@v1'))).toBeUndefined();
  });

  it('falls back to the structural reviewer-role hint for steps without a typed report', () => {
    const hint = findRelayShapeHint(reviewerStructuralStep());
    expect(hint).toBeDefined();
    expect(hint).toContain('NO_ISSUES_FOUND');
    expect(hint).toContain('"findings"');
  });

  it('round-trips every catalog-declared structural hint id through the registry', () => {
    // Floor: at least one structural hint exists today (review's
    // standalone audit step). Prevents vacuous pass if all structural
    // hints were dropped from the catalog.
    expect(EXPECTED_STRUCTURAL_HINT_IDS.length).toBeGreaterThanOrEqual(1);

    const registered = listRegisteredStructuralHints().map((hint) => hint.id);
    expect(
      [...registered].sort(),
      'registered structural hints must match the catalog set exactly',
    ).toEqual([...EXPECTED_STRUCTURAL_HINT_IDS].sort());
  });
});
