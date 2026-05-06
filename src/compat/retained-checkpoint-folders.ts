import { reduce } from '../runtime/reducer.js';
import { resumeCompiledFlowCheckpoint } from '../runtime/runner.js';
import { deriveSnapshot } from '../runtime/snapshot-writer.js';
import { readRunTrace } from '../runtime/trace-reader.js';

import type { CheckpointResumeInvocation, CompiledFlowRunResult } from '../runtime/runner-types.js';
import type { RunTrace } from '../schemas/run.js';
import type { Snapshot } from '../schemas/snapshot.js';

export type { CheckpointResumeInvocation, CompiledFlowRunResult };

export function resumeRetainedCompiledFlowCheckpoint(
  invocation: CheckpointResumeInvocation,
): Promise<CompiledFlowRunResult> {
  return resumeCompiledFlowCheckpoint(invocation);
}

export function deriveRetainedSnapshot(runFolder: string): Snapshot {
  return deriveSnapshot(runFolder);
}

export function readRetainedRunTrace(runFolder: string): RunTrace {
  return readRunTrace(runFolder);
}

export function reduceRetainedRunTrace(log: RunTrace): Snapshot {
  return reduce(log);
}
