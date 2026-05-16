import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { PursuitContract, PursuitGraph, PursuitWavePlan } from '../reports.js';

export const pursuitWavePlanComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'pursuit.wave-plan@v1',
  reads: [
    { name: 'contract', schema: 'pursuit.contract@v1', required: true },
    { name: 'graph', schema: 'pursuit.graph@v1', required: true },
  ],
  build(context: ComposeBuildContext): unknown {
    const contract = PursuitContract.parse(context.inputs.contract);
    const graph = PursuitGraph.parse(context.inputs.graph);
    const allPursuitIds = contract.pursuits.map((pursuit) => pursuit.id);

    return PursuitWavePlan.parse({
      verdict: 'accept',
      waves: [
        {
          id: 'read-only-discovery',
          kind: 'read-only',
          pursuit_ids: graph.parallel_read_only_groups[0]?.pursuit_ids ?? allPursuitIds,
          execution: 'parallel',
          reason: 'Gather context for each pursuit before code-changing work begins.',
          re_ground_after: false,
        },
        ...graph.serial_groups.map((group, index) => ({
          id: index === 0 ? 'serial-code-writes' : `serial-code-writes-${index + 1}`,
          kind: 'code-change' as const,
          pursuit_ids: group.pursuit_ids,
          execution: 'serial' as const,
          reason: group.reason,
          re_ground_after: true,
        })),
      ],
      no_parallel_writes_reason:
        'Pursuits V1 does not apply parallel worktree edits. Code-changing work runs serially until safe apply and shared post-apply verification exist.',
    });
  },
};
