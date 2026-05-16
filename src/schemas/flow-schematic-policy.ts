import type { FlowBlock as FlowBlockValue } from './flow-blocks.js';
import type { StepExecutionKind } from './flow-schematic.js';
import { CANONICAL_STAGES, type CanonicalStage as CanonicalStageValue } from './stage.js';

// Schematic-author-selectable execution kinds for a block. The catalog's
// `action_surface` describes the block's typical role, but committed flows
// intentionally use some blocks flexibly: Build's plan is inline compose even
// though the catalog calls plan a worker block, and Build's frame is a
// checkpoint even though frame is orchestrator-shaped.
export function acceptedSchematicExecutionKindsForBlock(
  block: FlowBlockValue,
): readonly StepExecutionKind[] {
  if (block.id === 'run-verification') return ['verification'];
  switch (block.action_surface) {
    case 'worker':
      return ['relay', 'compose', 'fanout'];
    case 'host':
      return ['checkpoint'];
    case 'orchestrator':
      return ['compose', 'checkpoint', 'sub-run', 'fanout'];
    case 'mixed':
      return ['compose', 'relay', 'verification', 'checkpoint', 'sub-run', 'fanout'];
  }
}

export function acceptedSchematicStagesForBlock(
  block: FlowBlockValue,
): readonly CanonicalStageValue[] {
  switch (block.id) {
    case 'intake':
    case 'route':
    case 'frame':
      return ['frame'];
    case 'gather-context':
    case 'diagnose':
      return ['analyze'];
    case 'plan':
    case 'coordinate-pursuits':
    case 'queue':
      return ['plan'];
    case 'pursue':
      return ['frame'];
    case 'act':
    case 'batch':
      return ['act'];
    case 'run-verification':
      return ['verify'];
    case 'review':
      // Review block runs in the canonical review stage by default, but the
      // audit-only Review flow places its reviewer relay in analyze.
      return ['review', 'analyze'];
    case 'risk-rollback-check':
      return ['verify', 'close'];
    case 'close-with-evidence':
    case 'handoff':
      return ['close'];
    case 'human-decision':
      return CANONICAL_STAGES;
  }
}
