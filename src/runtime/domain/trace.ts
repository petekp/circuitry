import type { z } from 'zod';
import type { TraceEntry as TraceEntrySchema } from '../../schemas/trace-entry.js';

// Read-side: the runtime trace entry is the strict discriminated union the
// schema validates to. Each variant carries exactly its declared fields, with
// branded ids (`RunId`, `StepId`, …) intact, so consumers narrow on
// `entry.kind` and read fields without casts.
export type TraceEntry = z.infer<typeof TraceEntrySchema>;
export type TraceSequence = TraceEntry['sequence'];
export type TraceEntryType = TraceEntry['kind'];

// Append-side: ergonomic input shape. `TraceStore.append` auto-fills
// `schema_version`/`recorded_at`/`sequence` and `TraceEntrySchema.parse`
// validates and brands every field at the boundary, so callers pass loosely
// typed values (plain strings for branded/enum ids, mutable arrays, plain
// booleans) and the parse re-tightens them on write.
//
// Built from `z.input` of the schema (which already erases brands, leaving
// plain `string` where the output carries `string & $brand<…>`), distributed
// per variant so each entry kind keeps its own required fields required while
// auto-filled fields become optional/dropped. Each field value is then widened
// to match the prior loose append contract: string literals/enums collapse to
// `string`, boolean literals to `boolean`, and arrays to readonly arrays of
// widened elements. This is the append ergonomics the runtime relied on before
// the read-side union was tightened; the boundary `parse` is the real guard.
type ParsedTraceEntry = z.input<typeof TraceEntrySchema>;

// Widen a single field value to the loose append contract. Strings (including
// branded/enum/literal strings, already de-branded by `z.input`) collapse to
// `string`; boolean literals to `boolean`; arrays become readonly arrays of
// widened elements (so callers may pass `readonly T[]` or mutable `T[]`).
// Objects keep their `z.input` shape — append sites build them from already
// well-typed values.
type WidenInputValue<T> = T extends string
  ? string
  : T extends boolean
    ? boolean
    : T extends readonly (infer E)[]
      ? readonly WidenInputValue<E>[]
      : T;

type WidenInputFields<T> = { [K in keyof T]: WidenInputValue<T[K]> };

type DistributeTraceEntryInput<T> = T extends unknown
  ? WidenInputFields<Omit<T, 'schema_version' | 'sequence' | 'recorded_at'>> & {
      readonly schema_version?: T extends { schema_version: infer S } ? S : never;
      readonly recorded_at?: T extends { recorded_at: infer R } ? R : never;
    }
  : never;
export type TraceEntryInput = DistributeTraceEntryInput<ParsedTraceEntry>;
