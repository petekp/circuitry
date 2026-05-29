import type { RuntimeRunStatus } from '../domain/run.js';
import type { TraceEntry } from '../domain/trace.js';
import { isRunClosedOutcome } from '../trace/trace-fields.js';

export function projectStatusFromTrace(entries: readonly TraceEntry[]): RuntimeRunStatus {
  const closed = [...entries].reverse().find((entry) => entry.kind === 'run.closed');
  if (closed !== undefined) {
    const outcome = closed.outcome;
    if (isRunClosedOutcome(outcome)) return outcome;
    return 'aborted';
  }
  if (entries.some((entry) => entry.kind === 'run.bootstrapped')) return 'running';
  return 'not_started';
}
