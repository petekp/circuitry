import type { RouteName } from './route.js';

export type StepId = string;

export type StepKindV2 = 'compose' | 'verification' | 'checkpoint' | 'relay' | 'sub-run' | 'fanout';

export interface RouteStepOutcomeV2 {
  readonly route: RouteName;
  readonly details?: Record<string, unknown>;
}

export interface WaitingCheckpointStepOutcomeV2 {
  readonly kind: 'waiting_checkpoint';
  readonly checkpoint: {
    readonly stepId: string;
    readonly attempt: number;
    readonly requestPath: string;
    readonly allowedChoices: readonly string[];
  };
}

export type StepOutcomeV2 = RouteStepOutcomeV2 | WaitingCheckpointStepOutcomeV2;

export function isWaitingCheckpointStepOutcomeV2(
  outcome: StepOutcomeV2,
): outcome is WaitingCheckpointStepOutcomeV2 {
  return 'kind' in outcome && outcome.kind === 'waiting_checkpoint';
}
