import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { PursuitContract, PursuitGraph, type PursuitTouchSet } from '../reports.js';

function setsOverlap(left: readonly string[], right: readonly string[]): boolean {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function touchSetsOverlap(left: PursuitTouchSet, right: PursuitTouchSet): boolean {
  return (
    setsOverlap(left.paths, right.paths) ||
    setsOverlap(left.symbols, right.symbols) ||
    setsOverlap(left.commands, right.commands) ||
    setsOverlap(left.generated_outputs, right.generated_outputs)
  );
}

export const pursuitGraphComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'pursuit.graph@v1',
  reads: [{ name: 'contract', schema: 'pursuit.contract@v1', required: true }],
  build(context: ComposeBuildContext): unknown {
    const contract = PursuitContract.parse(context.inputs.contract);
    const nodes = contract.pursuits.map((pursuit) => ({
      id: pursuit.id,
      goal: pursuit.goal,
      estimated_touch_set: pursuit.estimated_touch_set,
      risk: pursuit.risk,
      status: 'ready' as const,
      reason:
        pursuit.risk === 'high'
          ? 'High-risk pursuit is ready, but code-changing work remains serialized.'
          : 'Ready for coordinated execution.',
    }));

    const edges = [];
    for (let i = 0; i < contract.pursuits.length; i += 1) {
      const left = contract.pursuits[i];
      if (left === undefined) continue;
      for (let j = i + 1; j < contract.pursuits.length; j += 1) {
        const right = contract.pursuits[j];
        if (right === undefined) continue;
        if (touchSetsOverlap(left.estimated_touch_set, right.estimated_touch_set)) {
          edges.push({
            from: left.id,
            to: right.id,
            kind: 'conflict' as const,
            reason: 'Estimated touch sets overlap, so V1 serializes these pursuits.',
          });
        } else {
          edges.push({
            from: left.id,
            to: right.id,
            kind: 'composes-with' as const,
            reason:
              'No estimated touch-set overlap was found; discovery may run in parallel, but code writes still serialize in V1.',
          });
        }
      }
    }

    return PursuitGraph.parse({
      verdict: 'accept',
      nodes,
      edges,
      serial_groups: [
        {
          id: 'serial-code-writes',
          pursuit_ids: contract.pursuits.map((pursuit) => pursuit.id),
          reason: 'Pursuits V1 serializes all code-changing work until safe worktree apply exists.',
        },
      ],
      parallel_read_only_groups: [
        {
          id: 'parallel-discovery',
          pursuit_ids: contract.pursuits.map((pursuit) => pursuit.id),
          reason:
            'Read-only discovery can happen in parallel because it does not mutate the worktree.',
        },
      ],
      blocked: [],
    });
  },
};
