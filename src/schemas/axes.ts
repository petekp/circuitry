import { z } from 'zod';
import { StageId } from './ids.js';
import { Rigor } from './rigor.js';

export const TournamentN = z.number().int().min(2).max(4);
export type TournamentN = z.infer<typeof TournamentN>;

export const Axes = z
  .object({
    rigor: Rigor.default('standard'),
    tournament: z.boolean().default(false),
    tournament_n: TournamentN.default(3),
    autonomous: z.boolean().default(false),
  })
  .strict();
export type Axes = z.infer<typeof Axes>;

export const DEFAULT_AXES = Axes.parse({});

export const FlowAxes = z
  .object({
    allowed_rigors: z.array(Rigor).min(1),
    supports_tournament: z.boolean().default(false),
    supports_autonomous: z.boolean().default(false),
    default: Axes.default(DEFAULT_AXES),
    tournament_fan_out_stage: StageId.optional(),
  })
  .strict()
  .superRefine((axes, ctx) => {
    const seenRigors = new Set<string>();
    for (const [index, rigor] of axes.allowed_rigors.entries()) {
      if (seenRigors.has(rigor)) {
        ctx.addIssue({
          code: 'custom',
          path: ['allowed_rigors', index],
          message: `duplicate allowed rigor: ${rigor}`,
        });
      }
      seenRigors.add(rigor);
    }
    if (!seenRigors.has(axes.default.rigor)) {
      ctx.addIssue({
        code: 'custom',
        path: ['default', 'rigor'],
        message: `default rigor '${axes.default.rigor}' is not in allowed_rigors`,
      });
    }
    if (axes.default.tournament && !axes.supports_tournament) {
      ctx.addIssue({
        code: 'custom',
        path: ['default', 'tournament'],
        message: 'default tournament cannot be true when supports_tournament is false',
      });
    }
    if (axes.default.autonomous && !axes.supports_autonomous) {
      ctx.addIssue({
        code: 'custom',
        path: ['default', 'autonomous'],
        message: 'default autonomous cannot be true when supports_autonomous is false',
      });
    }
    if (axes.supports_tournament && axes.tournament_fan_out_stage === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['tournament_fan_out_stage'],
        message: 'tournament_fan_out_stage is required when supports_tournament is true',
      });
    }
    if (!axes.supports_tournament && axes.tournament_fan_out_stage !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['tournament_fan_out_stage'],
        message: 'tournament_fan_out_stage is only allowed when supports_tournament is true',
      });
    }
  });
export type FlowAxes = z.infer<typeof FlowAxes>;

export const isConsequentialAxes = (axes: Axes): boolean =>
  axes.rigor === 'deep' || axes.tournament || axes.autonomous;
