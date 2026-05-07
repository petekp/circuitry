import {
  RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE,
  RETIRED_RUNTIME_RUN_FOLDER_MESSAGE,
} from '../shared/retired-runtime-policy.js';
import type {
  CheckpointResumeInvocation,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  ComposeWriterInput,
} from './runner-types.js';

// Retired runtime public surface.
//
// The CLI and run-status layers now route supported fresh runs through
// core-v2 and fail closed for retained/v1 folders before reaching this file.
// These stubs keep any accidental programmatic imports from silently reviving
// the old execution engine.
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
} from './runner-types.js';

export interface FreshRunFolderClaim {
  readonly runFolder: string;
  readonly path: string;
}

function freshInvocationError(): Error {
  return new Error(RETIRED_RUNTIME_FRESH_INVOCATION_MESSAGE);
}

function runFolderError(): Error {
  return new Error(RETIRED_RUNTIME_RUN_FOLDER_MESSAGE);
}

export function initRunFolder(): never {
  throw freshInvocationError();
}

export function claimFreshRunFolder(): never {
  throw freshInvocationError();
}

export function releaseFreshRunFolderClaim(): void {
  // No-op. Fresh retained runs can no longer acquire a claim.
}

export function bootstrapRun(): never {
  throw freshInvocationError();
}

export function writeComposeReport(_input: ComposeWriterInput): never {
  throw freshInvocationError();
}

export function writePrototypeComposeReport(_input: ComposeWriterInput): never {
  throw freshInvocationError();
}

export async function runCompiledFlow(
  _invocation: CompiledFlowInvocation,
): Promise<CompiledFlowRunResult> {
  throw freshInvocationError();
}

export async function resumeCompiledFlowCheckpoint(
  _invocation: CheckpointResumeInvocation,
): Promise<CompiledFlowRunResult> {
  throw runFolderError();
}
