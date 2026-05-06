import { runCompiledFlow } from '../runtime/runner.js';

import type {
  CheckpointResumeInvocation,
  CheckpointWaitingResult,
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  ComposeWriterFn,
  ComposeWriterInput,
  ProgressReporter,
  RelayFn,
  RelayInput,
  RelayResultMetadata,
  ResolvedChildCompiledFlow,
  WorktreeProvisionInput,
  WorktreeRunner,
} from '../runtime/runner-types.js';

export type {
  CheckpointResumeInvocation,
  CheckpointWaitingResult,
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
  ComposeWriterFn,
  ComposeWriterInput,
  ProgressReporter,
  RelayFn,
  RelayInput,
  RelayResultMetadata,
  ResolvedChildCompiledFlow,
  WorktreeProvisionInput,
  WorktreeRunner,
};
export {
  appendAndDerive as appendAndDeriveRetainedTrace,
  bootstrapRun as bootstrapRetainedRun,
  claimFreshRunFolder as claimRetainedFreshRunFolder,
  initRunFolder as initRetainedRunFolder,
  releaseFreshRunFolderClaim as releaseRetainedFreshRunFolderClaim,
  writeComposeReport as writeRetainedComposeReport,
  writePrototypeComposeReport as writeRetainedPrototypeComposeReport,
} from '../runtime/runner.js';
export {
  deriveRetainedSnapshot,
  readRetainedRunTrace,
  reduceRetainedRunTrace,
  resumeRetainedCompiledFlowCheckpoint,
} from './retained-checkpoint-folders.js';

export function runRetainedCompiledFlow(
  invocation: CompiledFlowInvocation,
): Promise<CompiledFlowRunResult> {
  return runCompiledFlow(invocation);
}
