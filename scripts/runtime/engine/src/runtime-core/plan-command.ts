import type {
  AbortCommand,
  AbortPlan,
  IdempotenceKey,
  IsoTimestamp,
  RuntimeCommand,
  RuntimeFacts,
  RuntimeMaterializationPlan,
  RuntimePlan,
  RuntimeProjection,
  RuntimeRevision,
  RuntimeStatus,
} from "./types.js";
import { withRuntimeEventDraftNaturalKey } from "./idempotence.js";

export interface PlanRuntimeCommandInput {
  readonly command: RuntimeCommand;
  readonly projection: RuntimeProjection;
  readonly facts: RuntimeFacts;
  readonly expectedRevision: RuntimeRevision;
  readonly plannedAt: IsoTimestamp;
}

export type PlanRuntimeCommand = (input: PlanRuntimeCommandInput) => RuntimePlan;

const TERMINAL_STATUSES = new Set<RuntimeStatus>([
  "aborted",
  "blocked",
  "completed",
  "failed",
  "handed_off",
  "stopped",
]);

const SKIP_MATERIALIZATION: RuntimeMaterializationPlan = {
  projection: {
    stateJson: "skip",
    activeRunMarkdown: "skip",
    reason: "execute",
  },
  continuity: {
    kind: "none",
  },
};

function abortMaterialization(
  command: AbortCommand,
  projection: RuntimeProjection,
): RuntimeMaterializationPlan {
  return {
    projection: {
      stateJson: "write",
      activeRunMarkdown: "write",
      reason: "execute",
    },
    continuity: {
      kind: "clear-current-run",
      projectRoot: command.projectRoot,
      runRoot: command.ref.runRoot,
      runId: projection.runId,
    },
  };
}

function planAbortRun(input: PlanRuntimeCommandInput & { readonly command: AbortCommand }): AbortPlan {
  const isTerminal = TERMINAL_STATUSES.has(input.projection.status);

  return {
    kind: "abort-run",
    command: input.command,
    expectedRevision: input.expectedRevision,
    observationDrafts: [],
    decisionDrafts: isTerminal
      ? []
      : [
          withRuntimeEventDraftNaturalKey({
            runId: input.projection.runId,
            draft: {
              event_type: "run_aborted",
              commitClass: "decision",
              idempotenceKey: "" as IdempotenceKey,
              payload: {
                reason: input.command.reason,
                aborted_at: input.plannedAt,
              },
            },
          }),
        ],
    materialization: isTerminal
      ? SKIP_MATERIALIZATION
      : abortMaterialization(input.command, input.projection),
  };
}

function unsupportedCommand(command: RuntimeCommand): never {
  throw new Error(`planRuntimeCommand: unsupported command kind ${command.kind}`);
}

export const planRuntimeCommand: PlanRuntimeCommand = (input) => {
  switch (input.command.kind) {
    case "abort-run":
      return planAbortRun({
        ...input,
        command: input.command,
      });
    case "bootstrap":
    case "complete-synthesis":
    case "request-checkpoint":
    case "resolve-checkpoint":
    case "dispatch-step":
    case "reconcile-dispatch":
      return unsupportedCommand(input.command);
  }
};
