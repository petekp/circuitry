// Connector argv proof for structured-output piping.
//
// Both first-party connectors gained a path for emitting native
// structured-output flags when the runtime supplies a JSON Schema:
//   - claude-code: `--json-schema <serialized JSON>`
//   - codex:       `--output-schema <path>`
//
// These tests assert that:
//   - The flag is omitted when no schema is supplied (backward compatibility).
//   - The flag and value appear when a schema IS supplied.
//   - Codex's argv-boundary check still passes (the boundary forbids
//     anything that would widen the read-only sandbox; `--output-schema`
//     must remain admissible).

import { describe, expect, it } from 'vitest';

import {
  buildClaudeCodeArgs,
  isClaudeCodeStructuredOutputCompatible,
} from '../../src/connectors/claude-code.js';
import { assertCodexSpawnArgvBoundary, buildCodexArgs } from '../../src/connectors/codex.js';
import { buildCursorAgentArgs } from '../../src/connectors/cursor-agent.js';

describe('claude-code argv', () => {
  it('omits --json-schema when responseSchema is undefined', () => {
    const args = buildClaudeCodeArgs({ prompt: 'hi' });
    expect(args).not.toContain('--json-schema');
  });

  it('includes --json-schema followed by serialized JSON when responseSchema is set', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    const args = buildClaudeCodeArgs({ prompt: 'hi', responseSchema: schema });
    const flagIndex = args.indexOf('--json-schema');
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    const value = args[flagIndex + 1];
    expect(value).toBeDefined();
    expect(JSON.parse(value as string)).toEqual(schema);
  });

  it('places --json-schema before the prompt (the prompt is always the final positional arg)', () => {
    const args = buildClaudeCodeArgs({
      prompt: 'hi',
      responseSchema: { type: 'object' },
    });
    const flagIndex = args.indexOf('--json-schema');
    const promptIndex = args.indexOf('hi');
    expect(flagIndex).toBeLessThan(promptIndex);
  });

  it('skips --json-schema for top-level anyOf schemas and relies on runtime validation', () => {
    const schema = {
      anyOf: [
        { type: 'object', properties: { verdict: { const: 'accept' } } },
        { type: 'object', properties: { verdict: { const: 'reject' } } },
      ],
    };
    expect(isClaudeCodeStructuredOutputCompatible(schema)).toBe(false);
    const args = buildClaudeCodeArgs({ prompt: 'hi', responseSchema: schema });
    expect(args).not.toContain('--json-schema');
    expect(args.at(-1)).toBe('hi');
  });
});

describe('codex argv', () => {
  it('omits --output-schema when no schemaPath is supplied', () => {
    const args = buildCodexArgs({ prompt: 'hi' });
    expect(args).not.toContain('--output-schema');
  });

  it('includes --output-schema followed by the provided path', () => {
    const args = buildCodexArgs({ prompt: 'hi' }, '/tmp/example/schema.json');
    const flagIndex = args.indexOf('--output-schema');
    expect(flagIndex).toBeGreaterThanOrEqual(0);
    expect(args[flagIndex + 1]).toBe('/tmp/example/schema.json');
  });

  it('passes the argv-boundary assertion when --output-schema is present', () => {
    const args = buildCodexArgs({ prompt: 'hi' }, '/tmp/example/schema.json');
    expect(() => assertCodexSpawnArgvBoundary(args)).not.toThrow();
  });

  it('places --output-schema before the prompt', () => {
    const args = buildCodexArgs({ prompt: 'hi' }, '/tmp/example/schema.json');
    const flagIndex = args.indexOf('--output-schema');
    const promptIndex = args.indexOf('hi');
    expect(flagIndex).toBeLessThan(promptIndex);
  });
});

// Capability-gap pin (CH-P5). BUILTIN_CONNECTOR_SPECS declares
// `structured_output: 'json'` for every built-in connector, but only
// claude-code (`--json-schema`) and codex (`--output-schema`) consume the
// runtime-supplied `responseSchema` natively. cursor-agent accepts the field
// on its input type (via ConnectorRelayInput) but `buildCursorAgentArgs`
// deliberately ignores it: cursor-agent has no native structured-output flag,
// so it relies on the prompt shape hint plus the authoritative runtime Zod
// parse. This test pins that gap so a future change that starts emitting a
// schema flag for cursor-agent (or silently drops the claude/codex paths)
// trips a contract failure rather than drifting unnoticed.
describe('cursor-agent argv — structured-output capability gap', () => {
  const compatibleSchema = {
    type: 'object',
    properties: { verdict: { type: 'string' } },
    required: ['verdict'],
    additionalProperties: false,
  } as const;

  it('emits no native structured-output flag even when responseSchema is supplied', () => {
    const args = buildCursorAgentArgs({ prompt: 'hi', responseSchema: { ...compatibleSchema } });
    expect(args).not.toContain('--json-schema');
    expect(args).not.toContain('--output-schema');
    // The serialized schema must not leak into argv under any flag.
    expect(args.some((arg) => arg.includes('"verdict"'))).toBe(false);
  });

  it('keeps the prompt as the final positional arg regardless of responseSchema', () => {
    const withSchema = buildCursorAgentArgs({
      prompt: 'hi',
      responseSchema: { ...compatibleSchema },
    });
    const withoutSchema = buildCursorAgentArgs({ prompt: 'hi' });
    expect(withSchema.at(-1)).toBe('hi');
    // Supplying a schema does not change cursor-agent's argv at all.
    expect(withSchema).toEqual(withoutSchema);
  });
});
