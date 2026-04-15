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
      return `${workflow}: ${step} resolved, advancing to ${extra.route ?? "?"}.`;
    case "dispatch_requested":
      return `${workflow}: ${step} dispatching.`;
    case "dispatch_reconciled_pass":
      return `${workflow}: ${step} reconciled (${extra.verdict ?? "pass"}), advancing to ${extra.route ?? "?"}.`;
    case "dispatch_reconciled_fail": {
      const completion = extra.completion ?? "incomplete";
      const verdictSuffix = extra.verdict ? `, ${extra.verdict}` : "";
      return `${workflow}: ${step} reconciled (${completion}${verdictSuffix}); not advancing.`;
    }
    case "synthesis_complete":
      return `${workflow}: ${step} synthesis complete, advancing to ${extra.route ?? "?"}.`;
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

export function terminalLabelForStatus(status: string): string | null {
  switch (status) {
    case "completed":
      return "complete";
    case "aborted":
      return "aborted";
    case "blocked":
      return "blocked";
    case "stopped":
    case "handed_off":
      return "paused";
    default:
      return null;
  }
}
