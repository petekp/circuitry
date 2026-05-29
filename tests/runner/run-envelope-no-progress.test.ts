import { describe, expect, it } from 'vitest';

import { detectNoProgress } from '../../src/run-envelope/no-progress.js';

describe('Run no-progress / oscillation detection (S6)', () => {
  it('does not escalate with fewer than two attempts', () => {
    expect(detectNoProgress([{ unmetEvidence: ['a'], route: 'fix' }])).toMatchObject({
      escalate: false,
    });
  });

  it('does not escalate while the unmet set is shrinking', () => {
    const decision = detectNoProgress([
      { unmetEvidence: ['a', 'b'], route: 'fix' },
      { unmetEvidence: ['a'], route: 'fix' },
    ]);
    expect(decision.escalate).toBe(false);
  });

  it('escalates when two consecutive attempts leave an identical unmet set', () => {
    const decision = detectNoProgress([
      { unmetEvidence: ['a', 'b'], route: 'fix' },
      { unmetEvidence: ['b', 'a'], route: 'fix' },
    ]);
    expect(decision).toMatchObject({ escalate: true, reason: 'no-progress' });
  });

  it('escalates on route oscillation with no net progress (fix -> review -> fix)', () => {
    const decision = detectNoProgress([
      { unmetEvidence: ['a'], route: 'fix' },
      { unmetEvidence: ['b'], route: 'review' },
      { unmetEvidence: ['a'], route: 'fix' },
    ]);
    expect(decision).toMatchObject({ escalate: true, reason: 'oscillation' });
  });

  it('does not treat alternating routes as oscillation when progress is real', () => {
    const decision = detectNoProgress([
      { unmetEvidence: ['a', 'b', 'c'], route: 'fix' },
      { unmetEvidence: ['a', 'b'], route: 'review' },
      { unmetEvidence: ['a'], route: 'fix' },
    ]);
    expect(decision.escalate).toBe(false);
  });
});
