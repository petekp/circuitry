export type Announce = (line: string) => void;

export const silentAnnouncer: Announce = () => {};

export function stderrAnnouncer(): Announce {
  return (line) => {
    const trimmed = line.replace(/\n+$/, "");
    process.stderr.write(`${trimmed}\n`);
  };
}

export type TransitionKind =
  | "bootstrap"
  | "checkpoint_requested"
  | "checkpoint_resolved"
  | "dispatch_requested"
  | "dispatch_reconciled_pass"
  | "dispatch_reconciled_fail"
  | "synthesis_complete"
  | "aborted"
  | "terminal";

export interface ComposeTransitionLineOptions {
  workflowId: string;
  stepId?: string;
  stepTitle?: string;
  kind: TransitionKind;
  extra?: {
    route?: string;
    verdict?: string;
    completion?: string;
    terminalLabel?: string;
  };
}

function capitalizeWorkflow(workflowId: string): string {
  if (!workflowId || workflowId.length === 0) {
    return workflowId;
  }

  return workflowId[0].toUpperCase() + workflowId.slice(1).toLowerCase();
}

function humanStepLabel(options: ComposeTransitionLineOptions): string {
  if (options.stepTitle && options.stepTitle.length > 0) {
    return options.stepTitle.toLowerCase();
  }
  if (options.stepId && options.stepId.length > 0) {
    return options.stepId.toLowerCase();
  }
  return "step";
}

export function composeTransitionLine(
  options: ComposeTransitionLineOptions,
): string {
  const workflow = capitalizeWorkflow(options.workflowId);
  const step = humanStepLabel(options);
  const extra = options.extra ?? {};

  switch (options.kind) {
    case "bootstrap":
      return `${workflow}: run started at ${step}.`;
    case "checkpoint_requested":
      return `${workflow}: ${step} waiting on checkpoint.`;
    case "checkpoint_resolved":
      return `${workflow}: ${step} resolved; moving to ${extra.route ?? "?"}.`;
    case "dispatch_requested":
      return `${workflow}: ${step} running.`;
    case "dispatch_reconciled_pass":
      return `${workflow}: ${step} passed (${extra.verdict ?? "pass"}); moving to ${extra.route ?? "?"}.`;
    case "dispatch_reconciled_fail": {
      const completion = extra.completion ?? "incomplete";
      const verdictSuffix = extra.verdict ? `, ${extra.verdict}` : "";
      return `${workflow}: ${step} failed (${completion}${verdictSuffix}); holding.`;
    }
    case "synthesis_complete":
      return `${workflow}: ${step} summary ready; moving to ${extra.route ?? "?"}.`;
    case "aborted":
      return `${workflow}: run aborted.`;
    case "terminal":
      return `${workflow} ${extra.terminalLabel ?? "complete"}.`;
    default: {
      const never: never = options.kind;
      throw new Error(`unsupported announcer kind: ${String(never)}`);
    }
  }
}

// Canonical terminal label per run status. `stopped` and `handed_off` share
// the "paused" framing because both represent work that is pausable and
// resumable. Batch-step statuses like "done" are intentionally absent -- they
// describe a step inside a run, not the run itself.
const TERMINAL_LABEL_BY_STATUS: Readonly<Record<string, string>> = Object.freeze({
  aborted: "aborted",
  blocked: "blocked",
  completed: "complete",
  handed_off: "paused",
  stopped: "paused",
});

export function terminalLabelForStatus(status: string): string | null {
  return TERMINAL_LABEL_BY_STATUS[status] ?? null;
}
