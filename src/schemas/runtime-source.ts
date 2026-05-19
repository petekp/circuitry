import { z } from 'zod';
import { RunRelativePath } from './scalars.js';

export const RuntimeNumberSource = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('constant'),
      value: z.number().int().nonnegative().max(256),
    })
    .strict(),
  z
    .object({
      kind: z.literal('axis'),
      axis: z.literal('tournament_n'),
    })
    .strict(),
]);
export type RuntimeNumberSource = z.infer<typeof RuntimeNumberSource>;

export const ReportItemsFilter = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('path_equals'),
      path: z.string().min(1),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
    .strict(),
]);
export type ReportItemsFilter = z.infer<typeof ReportItemsFilter>;

export const ReportItemsSource = z
  .object({
    kind: z.literal('report_items'),
    source_report: RunRelativePath,
    items_path: z.string().min(1),
    filter: ReportItemsFilter.optional(),
    required_count: RuntimeNumberSource.optional(),
  })
  .strict();
export type ReportItemsSource = z.infer<typeof ReportItemsSource>;

export const CheckpointChoiceSource = ReportItemsSource.extend({
  id_path: z.string().min(1),
  label_path: z.string().min(1).optional(),
  description_path: z.string().min(1).optional(),
}).strict();
export type CheckpointChoiceSource = z.infer<typeof CheckpointChoiceSource>;
