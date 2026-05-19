import { z } from 'zod';
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

export const isConsequentialAxes = (axes: Axes): boolean =>
  axes.rigor === 'deep' || axes.tournament || axes.autonomous;
