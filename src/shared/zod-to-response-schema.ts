// Convert a Zod report schema into the JSON Schema object that the
// claude-code and codex CLIs accept via their structured-output flags
// (`--json-schema` and `--output-schema` respectively).
//
// Why this lives in shared/: the connector-side wiring needs the
// converted schema, and the runtime-side wiring needs to call this
// before building the relay input. Putting it in shared/ keeps it
// out of the runtime executors and out of the connectors themselves,
// neither of which should depend on Zod.
//
// Conversion rules are intentionally conservative:
//   - target: JSON Schema draft-07 (the format both CLIs document).
//   - io: 'input' — relay schemas may use transforms that normalize a
//     worker-friendly input shape after parsing. The CLI sees the input
//     shape; runtime Zod parsing remains the output-normalization boundary.
//   - reused: 'inline' and cycles: 'throw' — both CLIs accept fully
//     inlined schemas, and inline schemas are easier to debug when a CLI
//     rejection happens. Relay response schemas should not be recursive.
//
// Conversion-fidelity note. Zod JSON Schema conversion cannot carry Zod
// constructs that don't have a structural equivalent in JSON Schema:
//   - `.superRefine` / `.refine` predicates — value-conditional rules
//     (e.g. "findings must be non-empty when verdict !== 'accept'") do
//     NOT transfer. Express such rules structurally via discriminated
//     unions when CLI-level enforcement matters; otherwise the runtime
//     Zod parse still catches the violation, but the CLI does not.
//   - `.preprocess` input-coercion is opaque to JSON Schema. Use `z.union`
//     instead when leniency needs to be visible to the CLI.

import { z } from 'zod';

export type ResponseJsonSchema = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSchemaNode(node: unknown): void {
  if (!isRecord(node)) return;

  if (Array.isArray(node.oneOf) && node.anyOf === undefined) {
    node.anyOf = node.oneOf;
    Reflect.deleteProperty(node, 'oneOf');
  }

  if (
    node.type === 'object' &&
    isRecord(node.properties) &&
    node.additionalProperties === undefined
  ) {
    node.additionalProperties = false;
  }

  if (isRecord(node.additionalProperties) && Object.keys(node.additionalProperties).length === 0) {
    node.additionalProperties = true;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) normalizeSchemaNode(item);
    } else {
      normalizeSchemaNode(value);
    }
  }
}

function assertNoReferenceSyntax(node: unknown): void {
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' || key === '$defs' || key === 'definitions') {
      throw new Error(`Zod JSON Schema conversion emitted unsupported ${key}`);
    }
    if (Array.isArray(value)) {
      for (const item of value) assertNoReferenceSyntax(item);
    } else {
      assertNoReferenceSyntax(value);
    }
  }
}

export function responseJsonSchemaFromZod(schema: z.ZodType): ResponseJsonSchema {
  const result = z.toJSONSchema(schema, {
    target: 'draft-07',
    io: 'input',
    reused: 'inline',
    cycles: 'throw',
  });
  if (typeof result !== 'object' || result === null) {
    throw new Error('Zod JSON Schema conversion returned a non-object value');
  }
  normalizeSchemaNode(result);
  assertNoReferenceSyntax(result);
  return result as ResponseJsonSchema;
}
