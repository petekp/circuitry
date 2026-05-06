// Checkpoint writer registry types.
//
// A checkpoint step optionally writes a typed report alongside its
// request/response files. Build's frame step is the canonical example:
// the policy carries a generic `report_template` object, the Build writer
// validates it and assembles a BuildBrief before operator selection.
// Future flows would add their own policy templates + builders.
//
// To add a new flow's checkpoint-with-report:
//   1. Add `policy.report_template` to the checkpoint step.
//   2. Define a CheckpointBriefBuilder in the flow package
//      (src/flows/<id>/writers/checkpoint-*.ts).
//   3. Register it on the CompiledFlowPackage's `writers.checkpoint`.
//
// Most checkpoints don't write reports at all — those skip this
// path entirely (the runner only invokes a builder when
// step.writes.report is defined).

import type { CompiledFlow } from '../../../schemas/compiled-flow.js';
import type { RelayRole } from '../../../schemas/step.js';

export type CheckpointStep = CompiledFlow['steps'][number] & {
  readonly kind: 'checkpoint';
};

export interface CheckpointBuildContext {
  readonly runFolder: string;
  readonly step: CheckpointStep;
  readonly goal: string;
  // The brief is fully populated at first write — response_path always
  // resolves to step.writes.response. There is no separate first-write
  // / re-stamp path; the report is written exactly once per
  // checkpoint instance, before the operator selection.
  readonly responsePath: string;
}

// Resume-context input the runner passes to the builder when it finds
// a waiting checkpoint with a typed report. The builder owns hash
// verification + flow-specific shape checks (e.g. Build's brief
// must match the step's choice ids and request_path). Returns the
// validated report body as `unknown` for callers that need the typed
// body after resume-time validation.
export interface CheckpointResumeContext {
  readonly runFolder: string;
  readonly step: CheckpointStep;
  readonly reportPath: string;
  readonly reportSha256?: string;
}

export interface CheckpointBriefBuilder {
  // Schema name of the report this builder produces (e.g.
  // 'build.brief@v1'). Acts as the registry key.
  readonly resultSchemaName: string;
  // CompiledFlow-specific assembly. Returns the unvalidated report —
  // the builder is responsible for validating against the registered
  // result schema before returning.
  build(context: CheckpointBuildContext): unknown;
  // Optional resume-time validator. Reads the previously-written
  // report from disk, verifies the request hash matches what the
  // checkpoint request stored, and runs flow-specific shape
  // checks. Returns the validated report body for callers that need
  // the typed report after resume-time validation. Builders may omit this
  // for checkpoint schemas they never use as `step.writes.report`,
  // but the runner fails loud at resume time if the request stored
  // a hash and no validator exists (see runner.ts
  // readCheckpointResumeReport). Real production builders should
  // always implement this.
  validateResumeContext?(context: CheckpointResumeContext): unknown;
}

// Helper used by checkpoint builders to read the choice ids the
// runner accepts for this step. Lives here (not in registry.ts) so
// builders can import it without a registry round-trip.
export function checkpointChoiceIds(step: CheckpointStep): string[] {
  return step.policy.choices.map((choice) => choice.id);
}

// Re-export for builder convenience.
export type { RelayRole };
