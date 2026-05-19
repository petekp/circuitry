import type {
  IdempotenceKey,
  RuntimeEvent,
  RuntimeEventDraft,
  RuntimeRouteTarget,
  RunId,
  StepId,
} from "./types.js";

interface RuntimeNaturalKeyStepContext {
  readonly stepId?: StepId;
}

export type RuntimeEventNaturalKeyContext =
  | (RuntimeNaturalKeyStepContext & {
      readonly stepStarted: "bootstrap";
    })
  | (RuntimeNaturalKeyStepContext & {
      readonly stepStarted: "routed";
      readonly predecessorStepId: StepId;
      readonly route: RuntimeRouteTarget;
    })
  | (RuntimeNaturalKeyStepContext & {
      readonly stepStarted?: never;
    });

export interface RuntimeEventDraftNaturalKeyInput {
  readonly runId: RunId;
  readonly draft: RuntimeEventDraft;
  readonly context?: RuntimeEventNaturalKeyContext;
}

export interface RuntimeEventDraftWithNaturalKeyInput<
  Draft extends RuntimeEventDraft,
> {
  readonly runId: RunId;
  readonly draft: Draft;
  readonly context?: RuntimeEventNaturalKeyContext;
}

interface RoutedStepContext {
  readonly predecessorStepId?: StepId;
  readonly route?: RuntimeRouteTarget;
}

function key(value: string): IdempotenceKey {
  return value as IdempotenceKey;
}

function requireStepId(event: RuntimeEvent, context: RuntimeEventNaturalKeyContext): StepId {
  const payloadStepId =
    event.event_type === "gate_passed" || event.event_type === "gate_failed"
      ? event.payload.step_id
      : undefined;
  const stepId = event.step_id ?? payloadStepId ?? context.stepId;

  if (!stepId) {
    throw new Error(`cannot build natural key for ${event.event_type}: missing step id`);
  }

  return stepId;
}

function requireDraftStepId(
  draft: RuntimeEventDraft,
  context: RuntimeEventNaturalKeyContext,
): StepId {
  const payloadStepId =
    draft.event_type === "gate_passed" || draft.event_type === "gate_failed"
      ? draft.payload.step_id
      : undefined;
  const stepId = draft.step_id ?? payloadStepId ?? context.stepId;

  if (!stepId) {
    throw new Error(`cannot build natural key for ${draft.event_type}: missing step id`);
  }

  return stepId;
}

function routedStepContext(context: RuntimeEventNaturalKeyContext): RoutedStepContext {
  if (context.stepStarted === "routed") {
    return {
      predecessorStepId: context.predecessorStepId,
      route: context.route,
    };
  }

  return {};
}

function stepStartedNaturalKey(
  runId: RunId,
  stepId: StepId,
  context: RuntimeEventNaturalKeyContext,
): IdempotenceKey {
  if (context.stepStarted === undefined) {
    throw new Error("cannot build natural key for step_started: missing step start context");
  }

  const routedContext = routedStepContext(context);
  if (routedContext.predecessorStepId && routedContext.route) {
    return key(
      `run:${runId}|event:step_started|from:${routedContext.predecessorStepId}|route:${routedContext.route}|step:${stepId}`,
    );
  }

  return key(`run:${runId}|event:step_started|step:${stepId}|bootstrap`);
}

export function runtimeEventNaturalKey(
  event: RuntimeEvent,
  context: RuntimeEventNaturalKeyContext = {},
): IdempotenceKey {
  switch (event.event_type) {
    case "run_started":
      return key(`run:${event.run_id}|event:run_started`);
    case "step_started":
      return stepStartedNaturalKey(event.run_id, event.payload.step_id, context);
    case "dispatch_requested":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:dispatch_requested|attempt:${event.payload.attempt}|path:${event.payload.request_path}`,
      );
    case "dispatch_received":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:dispatch_received|attempt:${event.payload.attempt}|path:${event.payload.receipt_path}`,
      );
    case "job_completed":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:job_completed|attempt:${event.payload.attempt}|path:${event.payload.result_path}`,
      );
    case "artifact_written":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:artifact_written|path:${event.payload.artifact_path}`,
      );
    case "gate_passed":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:gate_passed|gate:${event.payload.gate_kind}|route:${event.payload.route}`,
      );
    case "gate_failed":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:gate_failed|gate:${event.payload.gate_kind}|route:${event.payload.route}`,
      );
    case "checkpoint_requested":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:checkpoint_requested|attempt:${event.payload.attempt}|path:${event.payload.request_path}`,
      );
    case "checkpoint_resolved":
      return key(
        `run:${event.run_id}|step:${requireStepId(event, context)}|event:checkpoint_resolved|attempt:${event.payload.attempt}|path:${event.payload.response_path}`,
      );
    case "run_completed":
      return key(
        `run:${event.run_id}|event:run_completed|target:${event.payload.terminal_target}`,
      );
    case "run_aborted":
      return key(`run:${event.run_id}|event:run_aborted`);
  }
}

export function runtimeEventDraftNaturalKey(
  input: RuntimeEventDraftNaturalKeyInput,
): IdempotenceKey {
  const context = input.context ?? {};
  const draft = input.draft;

  switch (draft.event_type) {
    case "run_started":
      return key(`run:${input.runId}|event:run_started`);
    case "step_started":
      return stepStartedNaturalKey(input.runId, draft.payload.step_id, context);
    case "dispatch_requested":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:dispatch_requested|attempt:${draft.payload.attempt}|path:${draft.payload.request_path}`,
      );
    case "dispatch_received":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:dispatch_received|attempt:${draft.payload.attempt}|path:${draft.payload.receipt_path}`,
      );
    case "job_completed":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:job_completed|attempt:${draft.payload.attempt}|path:${draft.payload.result_path}`,
      );
    case "artifact_written":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:artifact_written|path:${draft.payload.artifact_path}`,
      );
    case "gate_passed":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:gate_passed|gate:${draft.payload.gate_kind}|route:${draft.payload.route}`,
      );
    case "gate_failed":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:gate_failed|gate:${draft.payload.gate_kind}|route:${draft.payload.route}`,
      );
    case "checkpoint_requested":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:checkpoint_requested|attempt:${draft.payload.attempt}|path:${draft.payload.request_path}`,
      );
    case "checkpoint_resolved":
      return key(
        `run:${input.runId}|step:${requireDraftStepId(draft, context)}|event:checkpoint_resolved|attempt:${draft.payload.attempt}|path:${draft.payload.response_path}`,
      );
    case "run_completed":
      return key(
        `run:${input.runId}|event:run_completed|target:${draft.payload.terminal_target}`,
      );
    case "run_aborted":
      return key(`run:${input.runId}|event:run_aborted`);
  }
}

export function withRuntimeEventDraftNaturalKey<Draft extends RuntimeEventDraft>(
  input: RuntimeEventDraftWithNaturalKeyInput<Draft>,
): Draft {
  return {
    ...input.draft,
    idempotenceKey: runtimeEventDraftNaturalKey(input),
  };
}
