import { describe, expect, it } from 'vitest';

import {
  CURSOR_AGENT_DISPATCH_FLAGS,
  CURSOR_AGENT_EXECUTABLE,
  CURSOR_AGENT_SUPPORTED_EFFORTS,
  buildCursorAgentArgs,
} from '../../src/connectors/cursor-agent.js';

describe('Cursor agent connector argv boundary', () => {
  it('uses the cursor-agent executable and pinned headless write flags', () => {
    expect(CURSOR_AGENT_EXECUTABLE).toBe('cursor-agent');
    expect([...CURSOR_AGENT_DISPATCH_FLAGS]).toEqual([
      '--print',
      '--output-format',
      'text',
      '--trust',
      '--force',
    ]);
  });

  it('passes workspace, Gemini model, and prompt through deterministic args', () => {
    const args = buildCursorAgentArgs({
      prompt: 'build variant',
      cwd: '/tmp/circuit-worktree',
      resolvedSelection: {
        model: { provider: 'gemini', model: 'gemini-3.5-flash' },
        effort: 'none',
        skills: [],
        invocation_options: {},
      },
    });

    expect(args).toEqual([
      ...CURSOR_AGENT_DISPATCH_FLAGS,
      '--model',
      'gemini-3.5-flash',
      '--workspace',
      '/tmp/circuit-worktree',
      'build variant',
    ]);
  });

  it('accepts only effort none', () => {
    expect([...CURSOR_AGENT_SUPPORTED_EFFORTS]).toEqual(['none']);
    expect(() =>
      buildCursorAgentArgs({
        prompt: 'build variant',
        resolvedSelection: {
          effort: 'high',
          skills: [],
          invocation_options: {},
        },
      }),
    ).toThrow(/cursor-agent connector cannot honor effort 'high'/);
  });

  it('rejects non-Gemini providers before spawn', () => {
    expect(() =>
      buildCursorAgentArgs({
        prompt: 'build variant',
        resolvedSelection: {
          model: { provider: 'openai', model: 'gpt-5.5' },
          skills: [],
          invocation_options: {},
        },
      }),
    ).toThrow(/cursor-agent connector cannot honor model provider 'openai'/);
  });
});
