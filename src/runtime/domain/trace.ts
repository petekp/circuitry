import type { z } from 'zod';
import type { TraceEntry as TraceEntrySchema } from '../../schemas/trace-entry.js';

type ParsedTraceEntry = z.input<typeof TraceEntrySchema>;
type UnionKeys<T> = T extends unknown ? keyof T : never;
type UnionValue<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : never
  : never;
type TraceEntryKey = UnionKeys<ParsedTraceEntry>;
type TraceEntryValue<K extends TraceEntryKey> = UnionValue<ParsedTraceEntry, K>;
type WidenTraceValue<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? readonly unknown[]
    : T;
type LooseTraceEntryValue<K extends TraceEntryKey> = WidenTraceValue<TraceEntryValue<K>>;

type TraceEntryShape = {
  readonly [K in TraceEntryKey]?: LooseTraceEntryValue<K>;
};

export type TraceEntry = TraceEntryShape & {
  readonly schema_version?: LooseTraceEntryValue<'schema_version'>;
  readonly sequence: LooseTraceEntryValue<'sequence'>;
  readonly recorded_at?: LooseTraceEntryValue<'recorded_at'>;
  readonly run_id: LooseTraceEntryValue<'run_id'>;
  readonly kind: TraceEntryValue<'kind'>;
};
export type TraceSequence = TraceEntry['sequence'];
export type TraceEntryType = TraceEntry['kind'];

export type TraceEntryInput = Omit<TraceEntry, 'sequence'>;
