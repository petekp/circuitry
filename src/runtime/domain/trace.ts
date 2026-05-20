import type { ChangeKindDeclaration } from '../../schemas/change-kind.js';
import type { ResolvedConnector } from '../../schemas/connector.js';
import type { ResolvedSelection } from '../../schemas/selection-policy.js';
import type { FanoutFailurePolicy, RelayRole } from '../../schemas/step.js';
import type { RouteName } from './route.js';
import type { RunClosedOutcome, RunId } from './run.js';
import type { StepId } from './step.js';

export type TraceSequence = number;

export type TraceEntryType =
  | 'run.bootstrapped'
  | 'check.evaluated'
  | 'fanout.started'
  | 'fanout.branch_started'
  | 'fanout.branch_completed'
  | 'fanout.joined'
  | 'checkpoint.requested'
  | 'checkpoint.resolved'
  | 'relay.started'
  | 'skills.loaded'
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

export interface TraceEntryInput {
  readonly schema_version?: 1;
  readonly run_id: RunId;
  readonly kind: TraceEntryType;
  readonly recorded_at?: string;
  readonly flow_id?: string;
  readonly invocation_id?: string;
  readonly goal?: string;
  readonly depth?: string;
  readonly change_kind?: ChangeKindDeclaration;
  readonly manifest_hash?: string;
  readonly step_id?: StepId;
  readonly attempt?: number;
  readonly route_taken?: RouteName;
  readonly reason?: string;
  readonly check_kind?: string;
  readonly criterion_id?: string;
  readonly criterion_kind?: string;
  readonly exit_code?: number;
  readonly status?: string;
  readonly stdout_summary?: string;
  readonly stderr_summary?: string;
  readonly outcome?: string;
  readonly child_run_id?: RunId;
  readonly child_flow_id?: string;
  readonly child_entry_mode?: string;
  readonly child_depth?: string;
  readonly child_outcome?: RunClosedOutcome;
  readonly verdict?: string;
  readonly duration_ms?: number;
  readonly result_path?: string;
  readonly receipt_path?: string;
  readonly report_path?: string;
  readonly report_schema?: string;
  readonly request_path?: string;
  readonly request_report_hash?: string;
  readonly request_payload_hash?: string;
  readonly options?: readonly string[];
  readonly selection?: string;
  readonly auto_resolved?: boolean;
  readonly resolution_source?: 'operator' | 'safe-default' | 'safe-autonomous';
  readonly response_path?: string;
  readonly connector?: ResolvedConnector;
  readonly role?: RelayRole;
  readonly resolved_selection?: ResolvedSelection;
  readonly resolved_from?: unknown;
  readonly receipt_id?: string;
  readonly cli_version?: string;
  readonly result_report_hash?: string;
  readonly branch_ids?: readonly string[];
  readonly on_child_failure?: FanoutFailurePolicy;
  readonly branch_id?: string;
  readonly branch_kind?: 'relay' | 'sub-run';
  readonly worktree_path?: string;
  readonly aggregate_path?: string;
  readonly branches_completed?: number;
  readonly branches_failed?: number;
  readonly policy?: string;
  readonly selected_branch_id?: string;
  readonly skills?: readonly unknown[];
}

export interface TraceEntry extends TraceEntryInput {
  readonly sequence: TraceSequence;
}
