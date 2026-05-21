import type { RunClosedOutcome } from '../domain/run.js';
export { NO_VERDICT_SENTINEL } from '../../shared/relay-support.js';

export type FanoutJoinPolicy =
  | 'pick-winner'
  | 'disjoint-merge'
  | 'aggregate-only'
  | 'aggregate-survivors';

export interface ResolvedSubRunBranch {
  readonly kind: 'sub-run';
  readonly branch_id: string;
  readonly flowRef: string;
  readonly entryMode: string;
  readonly version?: string;
  readonly goal: string;
  readonly depth: string;
  readonly selection?: unknown;
}

export interface ResolvedRelayBranch {
  readonly kind: 'relay';
  readonly branch_id: string;
  readonly role: string;
  readonly goal: string;
  readonly report_schema: string;
  readonly provenance_field?: string;
  readonly connector?: string;
  readonly selection?: unknown;
}

export type ResolvedBranch = ResolvedSubRunBranch | ResolvedRelayBranch;

export interface BranchOutcome {
  readonly branch_id: string;
  readonly child_run_id: string;
  readonly worktree_path: string;
  readonly child_outcome: RunClosedOutcome;
  readonly verdict: string;
  readonly result_path: string;
  readonly result_body?: unknown;
  readonly duration_ms: number;
  readonly admitted: boolean;
  readonly failure_reason?: string;
}
