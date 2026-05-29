import { describe, expect, it } from 'vitest';

import { ROUTABLE_WORKFLOWS, classifyCompiledFlowTask } from '../../src/flows/router.js';

describe('Classifier gating for the internal goal flow (S9)', () => {
  it('excludes the internal goal flow from the routable set', () => {
    expect([...ROUTABLE_WORKFLOWS]).not.toContain('goal');
  });

  it('never auto-selects goal across representative intents, including goal-signal phrasing', () => {
    const intents = [
      'goal: keep the dashboard work moving until it is done',
      'supervise: ship the auth refactor',
      'kick off a long-running goal to migrate the runtime',
      'implement the new dashboard filter',
      'fix the flaky auth test',
      'review the patch',
      'compare two caching options and decide',
      'coordinate multiple workstreams across the repo',
    ];
    for (const intent of intents) {
      expect(classifyCompiledFlowTask(intent).flowName, intent).not.toBe('goal');
    }
  });
});
