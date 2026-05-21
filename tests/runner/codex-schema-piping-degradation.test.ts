import { describe, expect, it } from 'vitest';

import { isCodexOutputSchemaCompatible } from '../../src/connectors/codex.js';
import { PrototypeVariantArtifact } from '../../src/flows/prototype/reports.js';
import { responseJsonSchemaFromZod } from '../../src/shared/zod-to-response-schema.js';

describe('isCodexOutputSchemaCompatible — codex --output-schema compatibility probe', () => {
  it('accepts a strict top-level object schema inside the Codex structured-output subset', () => {
    expect(
      isCodexOutputSchemaCompatible({
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
        additionalProperties: false,
      }),
    ).toBe(true);
  });

  it('rejects a top-level anyOf (discriminated union)', () => {
    expect(
      isCodexOutputSchemaCompatible({
        anyOf: [
          { type: 'object', properties: { verdict: { const: 'a' } } },
          { type: 'object', properties: { verdict: { const: 'b' } } },
        ],
      }),
    ).toBe(false);
  });

  it('rejects a top-level oneOf', () => {
    expect(isCodexOutputSchemaCompatible({ oneOf: [{ type: 'object' }, { type: 'string' }] })).toBe(
      false,
    );
  });

  it('rejects array, string, and number roots', () => {
    expect(isCodexOutputSchemaCompatible({ type: 'array', items: {} })).toBe(false);
    expect(isCodexOutputSchemaCompatible({ type: 'string' })).toBe(false);
    expect(isCodexOutputSchemaCompatible({ type: 'number' })).toBe(false);
  });

  it('rejects validation-only draft-07 keywords that can make Codex exit before generation', () => {
    expect(
      isCodexOutputSchemaCompatible({
        type: 'object',
        properties: {
          variant_id: { type: 'string', pattern: '^[a-z0-9-]+$', minLength: 1 },
        },
        required: ['variant_id'],
        additionalProperties: false,
      }),
    ).toBe(false);
  });

  it('rejects object maps expressed through additionalProperties schemas', () => {
    expect(
      isCodexOutputSchemaCompatible({
        type: 'object',
        properties: {
          judgments: {
            type: 'object',
            additionalProperties: { type: 'string', enum: ['pass', 'concern', 'fail'] },
          },
        },
        required: ['judgments'],
        additionalProperties: false,
      }),
    ).toBe(false);
  });

  it('rejects the Prototype variant-artifact report schema so Codex relies on prompt shape and runtime validation', () => {
    const schema = responseJsonSchemaFromZod(PrototypeVariantArtifact);
    expect(isCodexOutputSchemaCompatible(schema)).toBe(false);
  });
});
