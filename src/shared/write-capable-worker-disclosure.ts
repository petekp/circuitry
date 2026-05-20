const WRITE_CAPABLE_FLOW_IDS = new Set(['build', 'fix', 'prototype', 'pursue']);

export const WRITE_CAPABLE_WORKER_DISCLOSURE = 'A worker can edit this checkout.';

export function flowMayInvokeWriteCapableWorker(flowId: string): boolean {
  return WRITE_CAPABLE_FLOW_IDS.has(flowId);
}
