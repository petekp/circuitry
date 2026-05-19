import type { FlowAxes } from '../schemas/axes.js';
import type { FlowAxisSelection } from '../schemas/flow-schematic.js';

export function axisSelectionsForAxes(
  flowId: string,
  axes: FlowAxes,
): readonly FlowAxisSelection[] {
  const selections: FlowAxisSelection[] = [
    {
      name: 'default',
      depth: axes.default.rigor,
      description: `Default ${flowId} axis tuple.`,
    },
  ];

  for (const rigor of axes.allowed_rigors) {
    if (rigor === axes.default.rigor) continue;
    selections.push({
      name: rigor,
      depth: rigor,
      description: `${rigor} ${flowId} axis tuple.`,
    });
  }

  if (axes.supports_tournament) {
    selections.push({
      name: 'tournament',
      depth: 'tournament',
      description: `Tournament ${flowId} axis tuple.`,
    });
  }

  if (axes.supports_autonomous) {
    selections.push({
      name: 'autonomous',
      depth: 'autonomous',
      description: `Autonomous ${flowId} axis tuple.`,
    });
  }

  return selections;
}
