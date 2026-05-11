import { describe, expect, it } from 'vitest';

import { isPlainObjectTypeRoot } from '../../src/connectors/codex.js';

describe('isPlainObjectTypeRoot — codex --output-schema compatibility probe', () => {
  it('accepts a plain top-level object schema', () => {
    expect(isPlainObjectTypeRoot({ type: 'object', properties: {} })).toBe(true);
  });

  it('rejects a top-level anyOf (discriminated union)', () => {
    expect(
      isPlainObjectTypeRoot({
        anyOf: [
          { type: 'object', properties: { verdict: { const: 'a' } } },
          { type: 'object', properties: { verdict: { const: 'b' } } },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a top-level oneOf', () => {
    expect(isPlainObjectTypeRoot({ oneOf: [{ type: 'object' }, { type: 'string' }] })).toBe(false);
  });

  it('rejects array, string, and number roots', () => {
    expect(isPlainObjectTypeRoot({ type: 'array', items: {} })).toBe(false);
    expect(isPlainObjectTypeRoot({ type: 'string' })).toBe(false);
    expect(isPlainObjectTypeRoot({ type: 'number' })).toBe(false);
  });
});
