import { z } from 'zod';
import { CompiledFlowId, RunId } from './ids.js';
import { MAX_STATUS_TEXT_CHARS } from './progress-event.js';
import { RunClosedOutcome } from './trace-entry.js';

export const OperatorSummaryWarning = z
  .object({
    kind: z.string().min(1),
    message: z.string().min(1),
    path: z.string().min(1).optional(),
  })
  .strict();
export type OperatorSummaryWarning = z.infer<typeof OperatorSummaryWarning>;

export const OperatorSummaryReportLink = z
  .object({
    label: z.string().min(1),
    path: z.string().min(1),
    schema: z.string().min(1).optional(),
  })
  .strict();
export type OperatorSummaryReportLink = z.infer<typeof OperatorSummaryReportLink>;

export const OperatorBriefSlots = z
  .object({
    headline: z.string().min(1),
    primary: z
      .object({
        label: z.string().min(1),
        text: z.string().min(1),
      })
      .strict(),
    why: z.string().min(1).optional(),
    startWith: z.string().min(1).optional(),
    cautions: z.array(z.string().min(1)),
    nextStep: z.string().min(1).optional(),
  })
  .strict();
export type OperatorBriefSlots = z.infer<typeof OperatorBriefSlots>;

export const OperatorSummary = z
  .object({
    schema_version: z.literal(1),
    run_id: RunId,
    flow_id: CompiledFlowId,
    selected_flow: CompiledFlowId,
    routed_by: z.enum(['explicit', 'classifier']).optional(),
    router_reason: z.string().min(1).optional(),
    outcome: z.union([RunClosedOutcome, z.literal('checkpoint_waiting')]),
    headline: z.string().min(1),
    status_text: z.string().min(1).max(MAX_STATUS_TEXT_CHARS).optional(),
    brief_slots: OperatorBriefSlots.optional(),
    details: z.array(z.string().min(1)),
    evidence_warnings: z.array(OperatorSummaryWarning),
    run_folder: z.string().min(1),
    result_path: z.string().min(1).optional(),
    html_path: z.string().min(1).optional(),
    report_paths: z.array(OperatorSummaryReportLink),
    checkpoint: z
      .object({
        step_id: z.string().min(1),
        request_path: z.string().min(1),
        allowed_choices: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type OperatorSummary = z.infer<typeof OperatorSummary>;
