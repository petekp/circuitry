import type { AcceptanceCriteria } from '../../schemas/acceptance-criteria.js';
import type { Axes } from '../../schemas/axes.js';
import type { FanoutRubric } from '../../schemas/step.js';
import type { ExecutableStage, FlowId } from '../domain/flow.js';
import type { Routes } from '../domain/route.js';
import type { RunFileRef } from '../domain/run-file.js';
import type { Selection } from '../domain/selection.js';
import type { StepId } from '../domain/step.js';

export interface ExecutableEntryMode {
  readonly name: string;
  readonly startAt: StepId;
  readonly depth: string;
  readonly description: string;
  readonly defaultChangeKind?: string;
}

export interface BaseStep {
  readonly id: StepId;
  readonly title?: string;
  readonly protocol?: string;
  readonly routes: Routes;
  readonly reads?: readonly RunFileRef[];
  readonly writes?: Readonly<Record<string, RunFileRef>>;
  readonly selection?: Selection;
  readonly skillSlots?: readonly unknown[];
  readonly check?: unknown;
  readonly budgets?: unknown;
}

export interface ComposeStep extends BaseStep {
  readonly kind: 'compose';
  readonly writer: string;
  readonly body?: unknown;
}

export interface VerificationStep extends BaseStep {
  readonly kind: 'verification';
  readonly check: unknown;
}

export interface CheckpointStep extends BaseStep {
  readonly kind: 'checkpoint';
  readonly choices: readonly string[];
  readonly policy?: unknown;
}

export interface RelayStep extends BaseStep {
  readonly kind: 'relay';
  readonly role: string;
  readonly acceptanceCriteria?: AcceptanceCriteria;
  readonly connector?: string;
  readonly prompt?: string;
  readonly report?: RunFileRef;
}

export interface SubRunStep extends BaseStep {
  readonly kind: 'sub-run';
  readonly flowRef: FlowId;
  readonly entryMode: string;
  readonly version?: string;
  readonly goal: string;
  readonly depth: string;
}

export interface FanoutStep extends BaseStep {
  readonly kind: 'fanout';
  readonly branches: unknown;
  readonly join: unknown;
  readonly concurrency?: unknown;
  readonly onChildFailure?: string;
  readonly rubric?: FanoutRubric;
}

export type ExecutableStep =
  | ComposeStep
  | VerificationStep
  | CheckpointStep
  | RelayStep
  | SubRunStep
  | FanoutStep;

export interface ExecutableFlow {
  readonly id: FlowId;
  readonly version: string;
  readonly entry: StepId;
  readonly entryModes?: readonly ExecutableEntryMode[];
  readonly stages: readonly ExecutableStage[];
  readonly steps: readonly ExecutableStep[];
  readonly purpose?: string;
  readonly defaultSelection?: Selection;
  readonly stagePathPolicy?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly axes?: Axes;
}
