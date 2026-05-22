import { z } from 'zod';
import { CompiledFlowId, RunId, StepId } from './ids.js';

export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, {
  message: 'must be a 64-character lowercase hex SHA-256 digest',
});
export type Sha256 = z.infer<typeof Sha256>;

export const RefKind = z.enum([
  'work_contract',
  'policy',
  'trace',
  'report',
  'evidence',
  'request',
  'context_packet',
  'diff',
  'patch',
  'command',
  'change_packet',
  'safe_apply',
  'memory',
  'operator_input',
]);
export type RefKind = z.infer<typeof RefKind>;

const ContentRefKinds = new Set<RefKind>([
  'work_contract',
  'report',
  'evidence',
  'request',
  'context_packet',
  'diff',
  'patch',
  'command',
  'change_packet',
  'safe_apply',
]);

export const Ref = z
  .object({
    kind: RefKind,
    ref: z.string().min(1),
    sha256: Sha256.optional(),
    run_id: RunId.optional(),
    flow_id: CompiledFlowId.optional(),
    step_id: StepId.optional(),
    attempt: z.number().int().positive().optional(),
    sequence: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((ref, ctx) => {
    if (ContentRefKinds.has(ref.kind) && ref.sha256 === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sha256'],
        message: `${ref.kind} refs require sha256`,
      });
    }

    if (ref.kind === 'work_contract' && ref.flow_id === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['flow_id'],
        message: 'work_contract refs require flow_id',
      });
    }

    if (ref.kind !== 'trace') return;
    if (ref.run_id === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['run_id'],
        message: 'trace refs require run_id',
      });
    }
    if (ref.sequence === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sequence'],
        message: 'trace refs require sequence',
      });
      return;
    }
    const expected = `trace.ndjson#sequence=${ref.sequence}`;
    if (ref.ref !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ref'],
        message: `trace refs must use ${expected}`,
      });
    }
  });
export type Ref = z.infer<typeof Ref>;
