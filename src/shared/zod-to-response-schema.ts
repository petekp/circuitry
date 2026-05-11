// Convert a Zod report schema into the JSON Schema object that the
// claude-code and codex CLIs accept via their structured-output flags
// (`--json-schema` and `--output-schema` respectively).
//
// Why this lives in shared/: the connector-side wiring needs the
// converted schema, and the runtime-side wiring needs to call this
// before building the relay input. Putting it in shared/ keeps it
// out of the runtime executors and out of the connectors themselves,
// neither of which should depend on Zod or on `zod-to-json-schema`.
//
// Conversion rules are intentionally conservative:
//   - target: JSON Schema draft-07 (the format both CLIs document).
//   - $refStrategy: 'none' — both CLIs accept fully inlined schemas,
//     and inline schemas are easier to debug when a CLI rejection
//     happens.
//   - definitionPath omitted (no $defs / definitions block).
// If a flow's schema can't be expressed in draft-07 without $ref,
// `zod-to-json-schema` will still emit a usable schema; the strictness
// is best-effort, not load-bearing.
//
// Conversion-fidelity note. `zod-to-json-schema` silently drops Zod
// constructs that don't have a structural equivalent in JSON Schema:
//   - `.superRefine` / `.refine` predicates — value-conditional rules
//     (e.g. "findings must be non-empty when verdict !== 'accept'") do
//     NOT transfer. Express such rules structurally via discriminated
//     unions when CLI-level enforcement matters; otherwise the runtime
//     Zod parse still catches the violation, but the CLI does not.
//   - `.preprocess` input-coercion — the JSON Schema reflects the
//     post-coercion type, so lenient input shapes are lost. Use
//     `z.union` instead of `z.preprocess` when the leniency needs to
//     be visible to the CLI.
//
// Migration debt: `zod-to-json-schema` ends active maintenance in 2025
// per its README; Zod 4 ships a native `z.toJSONSchema` that supersedes
// this wrapper. Replace the dependency when the repo upgrades to Zod 4.

import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type ResponseJsonSchema = Record<string, unknown>;

export function responseJsonSchemaFromZod(schema: ZodTypeAny): ResponseJsonSchema {
  const result = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  });
  if (typeof result !== 'object' || result === null) {
    throw new Error('zod-to-json-schema returned a non-object value');
  }
  return result as ResponseJsonSchema;
}
