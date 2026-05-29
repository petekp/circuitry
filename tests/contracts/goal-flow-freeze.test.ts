import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { flowDefinitions, flowPackages } from '../../src/flows/catalog.js';

describe('Goal flow freeze (S8)', () => {
  it('marks the goal flow internal so it no longer publishes a public host surface', () => {
    const goalPackage = flowPackages.find((pkg) => pkg.id === 'goal');
    expect(goalPackage?.visibility).toBe('internal');
  });

  it('keeps the goal flow in the catalog so it stays runnable internally', () => {
    expect(flowDefinitions.map((definition) => definition.id)).toContain('goal');
  });

  it('preserves the internal goal flow manifest for reader-compat with old runs', () => {
    expect(existsSync(resolve('generated/flows/goal/circuit.json'))).toBe(true);
  });

  it('drops the public host mirrors for the now-internal goal flow', () => {
    expect(existsSync(resolve('plugins/claude/skills/goal'))).toBe(false);
    expect(existsSync(resolve('plugins/codex/flows/goal'))).toBe(false);
  });
});
