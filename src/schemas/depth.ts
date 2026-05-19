import { z } from 'zod';
import { type Axes, isConsequentialAxes } from './axes.js';
import { Rigor, type Rigor as RigorValue } from './rigor.js';

export const Depth = z.enum(['lite', 'standard', 'deep', 'tournament', 'autonomous']);
export type Depth = z.infer<typeof Depth>;

const axesForLegacyDepth = (depth: Depth): Axes => ({
  rigor: Rigor.safeParse(depth).success ? (depth as RigorValue) : 'standard',
  tournament: depth === 'tournament',
  autonomous: depth === 'autonomous',
  tournament_n: 3,
});

export const isConsequentialDepth = (r: Depth): boolean =>
  isConsequentialAxes(axesForLegacyDepth(r));
