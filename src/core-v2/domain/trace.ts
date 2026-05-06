import type { RouteName } from './route.js';
import type { RunId } from './run.js';
import type { StepId } from './step.js';

export type TraceSequence = number;

export type TraceEntryTypeV2 =
  | 'run.bootstrapped'
  | 'check.evaluated'
  | 'fanout.started'
  | 'fanout.branch_started'
  | 'fanout.branch_completed'
  | 'fanout.joined'
  | 'checkpoint.requested'
  | 'checkpoint.resolved'
  | 'relay.started'
  | 'relay.request'
  | 'relay.receipt'
  | 'relay.result'
  | 'relay.completed'
  | 'relay.failed'
  | 'step.report_written'
  | 'step.entered'
  | 'step.completed'
  | 'step.aborted'
  | 'sub_run.started'
  | 'sub_run.completed'
  | 'run.closed';

export interface TraceEntryInputV2 {
  readonly run_id: RunId;
  readonly kind: TraceEntryTypeV2;
  readonly engine?: 'core-v2';
  readonly recorded_at?: string;
  readonly flow_id?: string;
  readonly goal?: string;
  readonly depth?: string;
  readonly manifest_hash?: string;
  readonly step_id?: StepId;
  readonly attempt?: number;
  readonly route_taken?: RouteName;
  readonly reason?: string;
  readonly check_kind?: string;
  readonly outcome?: string;
  readonly child_run_id?: RunId;
  readonly child_flow_id?: string;
  readonly child_entry_mode?: string;
  readonly child_depth?: string;
  readonly child_outcome?: string;
  readonly verdict?: string;
  readonly duration_ms?: number;
  readonly result_path?: string;
  readonly report_path?: string;
  readonly report_schema?: string;
  readonly request_path?: string;
  readonly request_report_hash?: string;
  readonly allowed_choices?: readonly string[];
  readonly checkpoint_report_sha256?: string;
  readonly selection?: string;
  readonly auto_resolved?: boolean;
  readonly resolution_source?: 'operator' | 'safe-default' | 'safe-autonomous';
  readonly response_path?: string;
  readonly branch_ids?: readonly string[];
  readonly branch_id?: string;
  readonly branch_kind?: 'relay' | 'sub-run';
  readonly worktree_path?: string;
  readonly aggregate_path?: string;
  readonly branches_completed?: number;
  readonly branches_failed?: number;
  readonly policy?: string;
  readonly selected_branch_id?: string;
  readonly data?: Record<string, unknown>;
}

export interface TraceEntryV2 extends TraceEntryInputV2 {
  readonly sequence: TraceSequence;
}
