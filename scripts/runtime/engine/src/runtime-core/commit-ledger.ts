import type {
  CommitLedgerInput,
  RuntimePortResult,
} from "./ports.js";
import { loadJsonSchemaCached, validate } from "../schema.js";
import type {
  AttemptNumber,
  CircuitId,
  EventId,
  IsoTimestamp,
  LedgerAppendReceipt,
  RuntimeFailure,
  RuntimeMessage,
  RuntimeEvent,
  RuntimeEventDraft,
  RunId,
  StepId,
} from "./types.js";

export type CommitLedgerFailure =
  RuntimeFailure<"expected_revision_mismatch" | "ledger_append_failed" | "runtime_corrupt">;

export type CommitLedgerPlan = (
  input: CommitLedgerInput,
) => RuntimePortResult<LedgerAppendReceipt, CommitLedgerFailure>;

const EVENT_SCHEMA_PATH = "schemas/event.schema.json";

interface MaterializeDraftInput {
  readonly runId: RunId;
  readonly circuitId?: CircuitId;
  readonly eventId: EventId;
  readonly occurredAt: IsoTimestamp;
  readonly draft: RuntimeEventDraft;
}

interface RuntimeEventBaseFields {
  readonly schema_version: "1";
  readonly event_id: EventId;
  readonly occurred_at: IsoTimestamp;
  readonly run_id: RunId;
  readonly circuit_id?: CircuitId;
}

interface RuntimeEventContextFields {
  readonly step_id?: StepId;
  readonly attempt?: AttemptNumber;
}

function assertNever(value: never): never {
  throw new Error(`unhandled runtime event draft: ${JSON.stringify(value)}`);
}

function baseFields(input: MaterializeDraftInput): RuntimeEventBaseFields {
  return {
    schema_version: "1",
    event_id: input.eventId,
    occurred_at: input.occurredAt,
    run_id: input.runId,
    ...(input.circuitId !== undefined ? { circuit_id: input.circuitId } : {}),
  };
}

function contextFields(draft: RuntimeEventDraft): RuntimeEventContextFields {
  return {
    ...(draft.step_id !== undefined ? { step_id: draft.step_id } : {}),
    ...(draft.attempt !== undefined ? { attempt: draft.attempt } : {}),
  };
}

function materializeDraft(input: MaterializeDraftInput): RuntimeEvent {
  const base = baseFields(input);
  const context = contextFields(input.draft);

  switch (input.draft.event_type) {
    case "run_started":
      return {
        ...base,
        ...context,
        event_type: "run_started",
        payload: input.draft.payload,
      };
    case "step_started":
      return {
        ...base,
        ...context,
        event_type: "step_started",
        payload: input.draft.payload,
      };
    case "dispatch_requested":
      return {
        ...base,
        ...context,
        event_type: "dispatch_requested",
        payload: input.draft.payload,
      };
    case "dispatch_received":
      return {
        ...base,
        ...context,
        event_type: "dispatch_received",
        payload: input.draft.payload,
      };
    case "job_completed":
      return {
        ...base,
        ...context,
        event_type: "job_completed",
        payload: input.draft.payload,
      };
    case "artifact_written":
      return {
        ...base,
        ...context,
        event_type: "artifact_written",
        payload: input.draft.payload,
      };
    case "gate_passed":
      return {
        ...base,
        ...context,
        event_type: "gate_passed",
        payload: input.draft.payload,
      };
    case "gate_failed":
      return {
        ...base,
        ...context,
        event_type: "gate_failed",
        payload: input.draft.payload,
      };
    case "checkpoint_requested":
      return {
        ...base,
        ...context,
        event_type: "checkpoint_requested",
        payload: input.draft.payload,
      };
    case "checkpoint_resolved":
      return {
        ...base,
        ...context,
        event_type: "checkpoint_resolved",
        payload: input.draft.payload,
      };
    case "run_completed":
      return {
        ...base,
        ...context,
        event_type: "run_completed",
        payload: input.draft.payload,
      };
    case "run_aborted":
      return {
        ...base,
        ...context,
        event_type: "run_aborted",
        payload: input.draft.payload,
      };
    default:
      return assertNever(input.draft);
  }
}

function validateRuntimeEvents(events: readonly RuntimeEvent[]): CommitLedgerFailure | undefined {
  const eventSchema = loadJsonSchemaCached(EVENT_SCHEMA_PATH);
  const validationErrors = events.flatMap((event) => validate(eventSchema, event));

  if (validationErrors.length === 0) {
    return undefined;
  }

  return {
    kind: "runtime_corrupt",
    message: "runtime event failed schema validation" as RuntimeMessage,
    retryable: false,
    diagnostics: {
      source: "schema",
      details: {
        validationErrors,
      },
    },
  };
}

export const commitLedgerPlan: CommitLedgerPlan = (input) => {
  const events = input.batch.drafts.map((draft) =>
    materializeDraft({
      runId: input.runId,
      circuitId: input.circuitId,
      eventId: input.deps.ids.newEventId(),
      occurredAt: input.deps.clock.now(),
      draft,
    }),
  );
  const validationFailure = validateRuntimeEvents(events);

  if (validationFailure) {
    return {
      ok: false,
      failure: validationFailure,
    };
  }

  return input.deps.appender.appendEvents({
    ref: input.ref,
    commitClass: input.batch.commitClass,
    expectedRevision: input.batch.expectedRevision,
    events,
  });
};
