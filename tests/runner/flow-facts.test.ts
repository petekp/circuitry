import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { flowDefinitions, flowPackages } from '../../src/flows/catalog.js';

const RETAINED_FLOW_IDS = ['review', 'fix', 'pursue', 'runtime-proof', 'build', 'explore'] as const;

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('fact-owned retained flow authoring', () => {
  it('keeps retained flow adapters thin and facts-owned', () => {
    for (const flowId of RETAINED_FLOW_IDS) {
      const flowSource = readSource(`src/flows/${flowId}/flow.ts`);
      const factSource = readSource(`src/flows/${flowId}/facts.ts`);

      expect(flowSource, `${flowId} flow adapter should use fact authoring`).toContain(
        'defineFlowFromFacts',
      );
      expect(flowSource, `${flowId} flow adapter should not own an inline schematic`).not.toContain(
        'schematic:',
      );
      expect(factSource, `${flowId} facts should stay typed as FlowFact data`).toContain(
        'satisfies readonly FlowFact[]',
      );
    }
  });

  it('keeps generated schematics in parity with catalog definitions', () => {
    for (const definition of flowDefinitions) {
      const generated = JSON.parse(readSource(`src/flows/${definition.id}/schematic.json`));
      expect(definition.schematic, definition.id).toEqual(generated);
    }
  });

  it('keeps migrate and sweep outside the retained production catalog', () => {
    const retainedIds = flowDefinitions.map((definition) => definition.id);
    const packageIds = flowPackages.map((pkg) => pkg.id);

    expect(retainedIds).toEqual(RETAINED_FLOW_IDS);
    expect(packageIds).toEqual(retainedIds);
    expect(retainedIds).not.toContain('migrate');
    expect(retainedIds).not.toContain('sweep');
  });
});
