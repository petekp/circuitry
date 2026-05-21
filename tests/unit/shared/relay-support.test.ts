import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { composeRelayPrompt } from '../../../src/shared/relay-support.js';

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-relay-support-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('composeRelayPrompt', () => {
  it('includes the operator goal so no-reads relay steps can clarify the task', () => {
    const goal = 'Review the current change and prove the Goal flow smoke path works.';
    const prompt = composeRelayPrompt(
      {
        id: 'clarify-goal',
        title: 'Clarify - shape Goal task',
        role: 'researcher',
        reads: [],
        writes: {
          request: { path: 'reports/relay/goal-clarify.request.json' },
          receipt: { path: 'reports/relay/goal-clarify.receipt.txt' },
          result: { path: 'reports/relay/goal-clarify.result.json' },
          report: {
            path: 'reports/goal/clarified-task.json',
            schema: 'goal.clarified-task@v1',
          },
        },
        check: { kind: 'result_verdict', pass: ['continue'] },
      } as unknown as Parameters<typeof composeRelayPrompt>[0],
      runFolder,
      [],
      undefined,
      goal,
    );

    expect(prompt).toContain('Operator Goal:');
    expect(prompt).toContain(goal);
    expect(prompt.indexOf('Operator Goal:')).toBeLessThan(prompt.indexOf('Context (from reads):'));
  });
});
