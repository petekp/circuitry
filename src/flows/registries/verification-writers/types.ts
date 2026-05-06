// Verification writer registry types.
//
// A verification step has three pieces of flow-specific logic:
//
//   1. Where do the commands come from? (Build sources from
//      build.plan@v1; Fix sources from fix.brief@v1.)
//   2. What's the output report's shape? (BuildVerification vs.
//      FixVerification — Fix's wider schema carries timeout/env per
//      command result.)
//   3. What's the output schema name?
//
// The runner's spawnSync loop, output summarization, and trace_entry-writing
// stay universal. Each VerificationBuilder fills the flow-specific
// holes.
//
// To add a new flow's verification step:
//   1. Define the result schema in src/flows/<wf>/reports.ts
//   2. Implement a VerificationBuilder in
//      src/flows/<wf>/writers/<schema>.ts
//   3. Register it on the flow package's `writers.verification`

import type { CompiledFlow } from '../../../schemas/compiled-flow.js';

export type VerificationStep = CompiledFlow['steps'][number] & {
  readonly kind: 'verification';
  readonly writes: { readonly report: { readonly schema: string; readonly path: string } };
};

// One command to execute. Both Build and Fix use the same command
// shape (id, cwd, argv, timeout_ms, max_output_bytes, env), so this
// type is the structural intersection.
export interface VerificationCommand {
  readonly id: string;
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly timeout_ms: number;
  readonly max_output_bytes: number;
  readonly env: Readonly<Record<string, string>>;
}

// What the runner observes after executing one command. CompiledFlow-
// specific result schemas may include a subset (Build) or superset
// (Fix carries the original timeout/env so the result is
// self-contained as repro evidence).
export interface VerificationCommandObservation {
  readonly command: VerificationCommand;
  readonly exit_code: number;
  readonly status: 'passed' | 'failed';
  readonly duration_ms: number;
  readonly stdout_summary: string;
  readonly stderr_summary: string;
}

export interface VerificationBuildContext {
  readonly runFolder: string;
  readonly flow: CompiledFlow;
  readonly step: VerificationStep;
}

export interface VerificationBuilder {
  // Schema name of the report this builder produces (e.g.
  // 'build.verification@v1', 'fix.verification@v1'). Acts as the
  // registry key.
  readonly resultSchemaName: string;
  // Source the command list for this verification step. CompiledFlow-
  // specific: Build reads from build.plan@v1; Fix reads from
  // fix.brief@v1.
  loadCommands(context: VerificationBuildContext): readonly VerificationCommand[];
  // Assemble the verification result report from the observed
  // command outcomes. CompiledFlow-specific: Build produces a narrow
  // BuildVerification; Fix produces a wider FixVerification with
  // per-command repro fields.
  buildResult(observations: readonly VerificationCommandObservation[]): unknown;
}
