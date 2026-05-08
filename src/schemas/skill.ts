import { z } from 'zod';
import { SkillId, SkillSlotId } from './ids.js';

/**
 * SkillDescriptor — see docs/contracts/skill.md.
 *
 * The compiled catalog entry for a circuit-next plugin skill. A selection
 * resolver binds skills by `SkillId`; a catalog compiler enumerates them.
 *
 * This is NOT the Claude Code `SKILL.md` YAML frontmatter shape. That
 * upstream format is an external-protocol input to the catalog compiler,
 * which emits `SkillDescriptor` as an internal projection. Field sets
 * differ: CC frontmatter uses `name`/`description`/`trigger`; the
 * descriptor here uses `id`/`title`/`description`/`trigger` plus
 * `capabilities` and `domain`.
 */

export const SkillDomain = z.enum(['coding', 'design', 'research', 'ops', 'domain-general']);
export type SkillDomain = z.infer<typeof SkillDomain>;

/**
 * Raw-input own-property guard (prototype-chain defense). Required
 * catalog fields must be own properties on the raw input; inherited
 * values through the prototype chain are rejected before Zod's own
 * property access. Mirrors the same defense in continuity.ts and run.ts.
 */
const descriptorOwnPropertyGuard = z.custom<unknown>((raw) => {
  if (raw === null || typeof raw !== 'object') return true;
  const guarded = ['id', 'title', 'description', 'trigger'] as const;
  for (const f of guarded) if (!Object.hasOwn(raw, f)) return false;
  return true;
}, 'skill descriptor has inherited (not own) required field; prototype-chain smuggle rejected');

const SkillDescriptorBody = z
  .object({
    id: SkillId,
    title: z.string().min(1),
    description: z.string().min(1),
    trigger: z.string().min(1),
    /**
     * `capabilities`, when present, is a non-empty array of non-empty
     * strings. A catalog entry that has not declared any capabilities
     * should omit the field; an empty list `[]` is an ambiguity bug
     * and rejected.
     */
    capabilities: z.array(z.string().min(1)).min(1).optional(),
    domain: SkillDomain.default('domain-general'),
  })
  .strict();

export const SkillDescriptor = descriptorOwnPropertyGuard.pipe(SkillDescriptorBody);
export type SkillDescriptor = z.infer<typeof SkillDescriptor>;

const HEX64 = /^[0-9a-f]{64}$/;

export const UserSkillEntry = z
  .object({
    id: SkillId,
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    trigger: z.string().min(1).optional(),
    root: z.string().min(1),
    path: z.string().min(1),
    sha256: z.string().regex(HEX64),
    bytes: z.number().int().nonnegative(),
  })
  .strict();
export type UserSkillEntry = z.infer<typeof UserSkillEntry>;

export const SkillSlot = z
  .object({
    id: SkillSlotId,
    description: z.string().min(1),
  })
  .strict();
export type SkillSlot = z.infer<typeof SkillSlot>;

export const SkillSlotArray = z.array(SkillSlot).superRefine((slots, ctx) => {
  const seen = new Set<string>();
  for (const [index, slot] of slots.entries()) {
    const key = slot.id as unknown as string;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'id'],
        message: `duplicate skill slot '${key}'`,
      });
    }
    seen.add(key);
  }
});
export type SkillSlotArray = z.infer<typeof SkillSlotArray>;
