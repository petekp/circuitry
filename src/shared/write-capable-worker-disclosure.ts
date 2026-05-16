import type { CompiledFlow } from '../schemas/compiled-flow.js';

const WRITE_CAPABLE_FLOW_IDS = new Set(['build', 'fix']);

export const WRITE_CAPABLE_WORKER_DISCLOSURE = 'A worker can edit this checkout.';

export function flowMayInvokeWriteCapableWorker(flowId: string): boolean {
  return WRITE_CAPABLE_FLOW_IDS.has(flowId);
}

export function compiledFlowMayInvokeWriteCapableWorker(flow: CompiledFlow): boolean {
  return (
    flowMayInvokeWriteCapableWorker(flow.id as unknown as string) ||
    flow.steps.some((step) => step.kind === 'relay' && step.role === 'implementer')
  );
}
