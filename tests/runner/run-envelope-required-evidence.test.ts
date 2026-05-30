import { describe, expect, it } from 'vitest';

import {
  deriveRequiredEvidence,
  requiredEvidenceKindForProcess,
} from '../../src/app/run-envelope/source-record.js';

describe('Run done_when required-evidence derivation (S2)', () => {
  it('maps each process to a task-appropriate primary evidence kind', () => {
    expect(requiredEvidenceKindForProcess('fix')).toBe('command');
    expect(requiredEvidenceKindForProcess('build')).toBe('command');
    expect(requiredEvidenceKindForProcess('review')).toBe('review');
    expect(requiredEvidenceKindForProcess('explore')).toBe('review');
    expect(requiredEvidenceKindForProcess('pursue')).toBe('report');
    expect(requiredEvidenceKindForProcess('prototype')).toBe('report');
    // unknown processes fall back to a report-backed proof, never throw
    expect(requiredEvidenceKindForProcess('something-else')).toBe('report');
  });

  it('authors task-specific required evidence that references the objective', () => {
    const objective = 'Fix the flaky auth refresh test';
    const derived = deriveRequiredEvidence('fix', objective);
    expect(derived).toHaveLength(1);
    const first = derived[0];
    expect(first?.kind).toBe('command');
    expect(first?.required).toBe(true);
    // task-specific: references the objective, not the old generic placeholder
    expect(first?.description).toContain(objective);
    expect(first?.description).not.toBe('Normalized process evidence projection exists.');
  });

  it('always includes at least one required entry so the claim schema is satisfiable', () => {
    for (const process of ['fix', 'build', 'review', 'explore', 'pursue', 'prototype', 'create']) {
      const derived = deriveRequiredEvidence(process, 'do the thing');
      expect(derived.some((entry) => entry.required)).toBe(true);
    }
  });
});
