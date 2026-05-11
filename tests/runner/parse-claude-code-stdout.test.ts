import { describe, expect, it } from 'vitest';

import { parseClaudeCodeStdout } from '../../src/connectors/claude-code.js';

function buildInitLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: 'system',
    subtype: 'init',
    session_id: 'session-abc',
    claude_code_version: '2.1.139',
    mcp_servers: [],
    slash_commands: [],
    ...overrides,
  });
}

describe('parseClaudeCodeStdout — structured_output precedence', () => {
  it('uses result.structured_output when the schema-piping path is in effect', () => {
    const init = buildInitLine();
    const result = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'I have submitted the structured output.',
      structured_output: {
        verdict: 'accept',
        sources: [{ kind: 'file', ref: 'a.ts', summary: 'a' }],
        observations: ['o1'],
        open_questions: [],
      },
    });
    const stdout = `${init}\n${result}\n`;

    const parsed = parseClaudeCodeStdout(stdout, 'prompt', 1);

    expect(JSON.parse(parsed.result_body)).toEqual({
      verdict: 'accept',
      sources: [{ kind: 'file', ref: 'a.ts', summary: 'a' }],
      observations: ['o1'],
      open_questions: [],
    });
  });

  it('uses result.structured_output even when result.result is the empty string', () => {
    const init = buildInitLine();
    const result = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '',
      structured_output: { verdict: 'accept', count: 0 },
    });
    const stdout = `${init}\n${result}\n`;

    const parsed = parseClaudeCodeStdout(stdout, 'prompt', 1);

    expect(JSON.parse(parsed.result_body)).toEqual({ verdict: 'accept', count: 0 });
  });

  it('falls back to result.result when structured_output is absent', () => {
    const init = buildInitLine();
    const result = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '{"verdict":"accept","note":"plain"}',
    });
    const stdout = `${init}\n${result}\n`;

    const parsed = parseClaudeCodeStdout(stdout, 'prompt', 1);

    expect(JSON.parse(parsed.result_body)).toEqual({ verdict: 'accept', note: 'plain' });
  });

  it('rejects structured_output that is not an object', () => {
    const init = buildInitLine();
    const result = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '',
      structured_output: 'not-an-object',
    });
    const stdout = `${init}\n${result}\n`;

    expect(() => parseClaudeCodeStdout(stdout, 'prompt', 1)).toThrow(
      /structured_output present but not an object/,
    );
  });
});
