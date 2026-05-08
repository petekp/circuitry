import { z } from 'zod';

const slugPattern = /^[a-z][a-z0-9-]*$/;

export const CompiledFlowId = z.string().regex(slugPattern).brand<'CompiledFlowId'>();
export type CompiledFlowId = z.infer<typeof CompiledFlowId>;

export const StageId = z.string().regex(slugPattern).brand<'StageId'>();
export type StageId = z.infer<typeof StageId>;

export const StepId = z.string().regex(slugPattern).brand<'StepId'>();
export type StepId = z.infer<typeof StepId>;

export const RunId = z.string().uuid().brand<'RunId'>();
export type RunId = z.infer<typeof RunId>;

export const InvocationId = z
  .string()
  .regex(/^inv_[a-f0-9-]+$/)
  .brand<'InvocationId'>();
export type InvocationId = z.infer<typeof InvocationId>;

export const SkillId = z.string().regex(slugPattern).brand<'SkillId'>();
export type SkillId = z.infer<typeof SkillId>;

export const SkillSlotId = z.string().regex(slugPattern).brand<'SkillSlotId'>();
export type SkillSlotId = z.infer<typeof SkillSlotId>;

export const ProtocolId = z
  .string()
  .regex(/^[a-z][a-z0-9-]*@v\d+$/)
  .brand<'ProtocolId'>();
export type ProtocolId = z.infer<typeof ProtocolId>;
