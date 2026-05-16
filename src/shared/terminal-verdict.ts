import type { RunClosedOutcome, TraceEntry } from '../schemas/trace-entry.js';

// Derive the run's terminal admitted verdict for the user-visible
// result.json. Contract:
//
// - Returns the verdict from the latest relay.completed | sub_run.completed
//   trace entry whose corresponding check.evaluated for the same
//   (step_id, attempt) had check_kind='result_verdict' and outcome='pass'.
// - Returns undefined for any run that did not reach outcome=complete.
// - Returns undefined for runs that completed with no verdict-bearing
//   admitted step, such as compose-only routes, close-with-evidence
//   terminations, and fanout-only steps.
//
// Why walk backward instead of using "the closing step's verdict":
//   Every flow we ship has a non-verdict-bearing close step. A
//   "closing step's verdict" semantic would return undefined for every
//   Build / Review / Fix run. Authors place the
//   verdict-bearing step ahead of close, and expect the latest such
//   admission to surface.
//
// Why filter to check_kind='result_verdict':
//   Compose steps emit schema_sections checks, verification steps emit
//   verification checks, and fanout emits fanout_aggregate checks. Only
//   result_verdict checks represent verdict admission.
//
// Why this is safe across re-routes / retries:
//   The unrecognized runner emits check.evaluated outcome='pass' only on the
//   route actually taken to @complete. Every matching (step_id, attempt)
//   is therefore a step whose verdict was admitted on that path.
export function deriveTerminalVerdict(
  trace_entries: readonly TraceEntry[],
  runOutcome: RunClosedOutcome,
): string | undefined {
  if (runOutcome !== 'complete') return undefined;
  for (let i = trace_entries.length - 1; i >= 0; i -= 1) {
    const ev = trace_entries[i];
    if (ev === undefined) continue;
    if (ev.kind !== 'relay.completed' && ev.kind !== 'sub_run.completed') continue;
    const matchingCheckPass = trace_entries.some(
      (g) =>
        g.kind === 'check.evaluated' &&
        g.check_kind === 'result_verdict' &&
        g.outcome === 'pass' &&
        (g.step_id as unknown as string) === (ev.step_id as unknown as string) &&
        g.attempt === ev.attempt,
    );
    if (matchingCheckPass) return ev.verdict;
  }
  return undefined;
}
