import type { WriteRunEnvelopeRecordResult } from '../run-envelope/source-record.js';
import type { OperatorSummaryWriteResult } from '../shared/operator-summary-writer.js';

export interface RouteOutputFieldsInput {
  readonly selectedFlow: string;
  readonly routedBy: 'explicit' | 'classifier';
  readonly routerReason: string;
  readonly routerSignal?: string;
  readonly entryMode?: string;
  readonly entryModeSource?: 'explicit' | 'classifier';
}

export interface OperatorSummaryOutputFieldsInput {
  readonly operatorSummary: OperatorSummaryWriteResult;
}

export interface RunEnvelopeOutputFieldsInput {
  readonly runEnvelope: WriteRunEnvelopeRecordResult;
}

export function routeOutputFields(input: RouteOutputFieldsInput): Record<string, unknown> {
  return {
    selected_flow: input.selectedFlow,
    routed_by: input.routedBy,
    router_reason: input.routerReason,
    ...(input.routerSignal === undefined ? {} : { router_signal: input.routerSignal }),
    ...(input.entryMode === undefined ? {} : { entry_mode: input.entryMode }),
    ...(input.entryModeSource === undefined ? {} : { entry_mode_source: input.entryModeSource }),
  };
}

export function operatorSummaryOutputFields(
  input: OperatorSummaryOutputFieldsInput,
): Record<string, unknown> {
  const operatorSummary = input.operatorSummary;
  return {
    operator_summary_path: operatorSummary.jsonPath,
    operator_summary_markdown_path: operatorSummary.markdownPath,
    ...(operatorSummary.summary.status_text === undefined
      ? {}
      : { operator_summary_status_text: operatorSummary.summary.status_text }),
    ...(operatorSummary.htmlPath === undefined
      ? {}
      : { operator_summary_html_path: operatorSummary.htmlPath }),
  };
}

export function runEnvelopeOutputFields(
  input: RunEnvelopeOutputFieldsInput,
): Record<string, unknown> {
  return {
    run_envelope_path: input.runEnvelope.path,
    run_process_evidence_path: input.runEnvelope.processEvidencePath,
    run_surface_markdown_path: input.runEnvelope.surfacePath,
    run_surface_status_text: input.runEnvelope.record.surface_output.status_text,
    ...(input.runEnvelope.decisionPacketPaths.length === 0
      ? {}
      : { run_decision_packet_paths: input.runEnvelope.decisionPacketPaths }),
  };
}
