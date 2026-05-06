import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main, usage } from '../../src/cli/circuit.js';
import {
  CLI_RUNTIME_ROUTING_POLICY,
  RUNTIME_POLICY_REASONS,
} from '../../src/cli/runtime-compatibility-policy.js';
import type { ComposeWriterFn } from '../../src/compat/retained-runtime.js';
import { executeComposeV2 } from '../../src/core-v2/executors/compose.js';
import type { ExecutorRegistryV2, StepExecutorV2 } from '../../src/core-v2/executors/index.js';
import { executeRelayV2 } from '../../src/core-v2/executors/relay.js';
import { BuildBrief, BuildResult } from '../../src/flows/build/reports.js';
import {
  ExploreCompose,
  ExploreDecision,
  ExploreResult,
  ExploreReviewVerdict,
  ExploreTournamentAggregate,
  ExploreTournamentProposal,
} from '../../src/flows/explore/reports.js';
import { FixBrief, FixResult, FixVerification } from '../../src/flows/fix/reports.js';
import {
  MigrateBatch,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from '../../src/flows/migrate/reports.js';
import { ReviewRelayResult, ReviewResult } from '../../src/flows/review/reports.js';
import {
  SweepAnalysis,
  SweepBatch,
  SweepBrief,
  SweepQueue,
  SweepResult,
  SweepReview,
  SweepVerification,
} from '../../src/flows/sweep/reports.js';
import { ProgressEvent } from '../../src/schemas/progress-event.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunStatusProjectionV1 } from '../../src/schemas/run-status.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

const REVIEW_RELAY_BODY = JSON.stringify({ verdict: 'NO_ISSUES_FOUND', findings: [] });
const BUILD_IMPLEMENTATION_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Implemented the requested change',
  changed_files: ['src/example.ts'],
  evidence: ['Stub implementation relay completed'],
});
const BUILD_REVIEW_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'No blocking issue found',
  findings: [],
});
const EXPLORE_COMPOSE_BODY = JSON.stringify({
  verdict: 'accept',
  subject: 'Explore v2 CLI routing',
  recommendation: 'Proceed with the opt-in Explore slice.',
  success_condition_alignment: 'The generated Explore default flow reaches close.',
  supporting_aspects: [
    {
      aspect: 'opt-in routing',
      contribution: 'The generated Explore manifest ran through default v2 executors.',
      evidence_refs: ['generated/flows/explore/circuit.json'],
    },
  ],
});
const EXPLORE_REVIEW_BODY = JSON.stringify({
  verdict: 'accept',
  overall_assessment: 'No blocking concern in the opt-in Explore smoke.',
  objections: [],
  missed_angles: [],
});
const FANOUT_PROPOSAL_BODY = JSON.stringify({
  verdict: 'accept',
  option_id: 'option-1',
  option_label: 'First option',
  case_summary: 'The fanout branch produced a deterministic proposal.',
  assumptions: ['The dedicated CLI fixture keeps one branch for stable progress evidence.'],
  evidence_refs: ['fanout-progress-fixture'],
  risks: [],
  next_action: 'Admit the branch and join the aggregate.',
});
const MIGRATE_INVENTORY_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Inventory produced by the v2 CLI Migrate smoke.',
  items: [
    {
      id: 'item-1',
      path: 'src/example.ts',
      category: 'source-file',
      description: 'Representative migration target for the v2 CLI smoke.',
    },
  ],
  batches: [
    {
      id: 'batch-1',
      title: 'Primary migration batch',
      item_ids: ['item-1'],
      rationale: 'Single-batch smoke coverage keeps the child run deterministic.',
    },
  ],
});
const MIGRATE_REVIEW_BODY = JSON.stringify({
  verdict: 'cutover-approved',
  summary: 'Cutover review approved in the v2 CLI Migrate smoke.',
  findings: [],
});
const SWEEP_ANALYSIS_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Sweep survey found one deterministic cleanup target.',
  candidates: [
    {
      id: 'candidate-1',
      category: 'cleanup',
      path: 'src/example.ts',
      description: 'Representative cleanup target for the v2 CLI Sweep smoke.',
      confidence: 'high',
      risk: 'low',
    },
  ],
});
const SWEEP_BATCH_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Sweep executed the deterministic cleanup batch.',
  changed_files: ['src/example.ts'],
  items: [
    {
      candidate_id: 'candidate-1',
      status: 'acted',
      evidence: 'Stub Sweep execution relay completed.',
    },
  ],
});
const SWEEP_REVIEW_BODY = JSON.stringify({
  verdict: 'clean',
  summary: 'Sweep review found no blocking issue.',
  findings: [],
});
const FIX_CONTEXT_BODY = JSON.stringify({
  verdict: 'accept',
  sources: [
    {
      kind: 'operator-note',
      ref: 'goal',
      summary: 'The operator supplied the fix goal.',
    },
  ],
  observations: ['The generated Fix v2 CLI smoke gathered enough context.'],
  open_questions: [],
});
const FIX_DIAGNOSIS_BODY = JSON.stringify({
  verdict: 'accept',
  reproduction_status: 'not-attempted',
  cause_summary: 'Synthetic diagnosis for opt-in v2 CLI smoke.',
  confidence: 'medium',
  evidence: ['The generated Fix manifest reached diagnosis.'],
  residual_uncertainty: ['No live reproduction was attempted in the smoke test.'],
});
const FIX_CHANGE_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Applied a synthetic Fix change for opt-in v2 CLI smoke.',
  diagnosis_ref: 'reports/fix/diagnosis.json',
  changed_files: ['src/example.ts'],
  evidence: ['Stub Fix change relay completed.'],
});
const FIX_REVIEW_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Generated Fix smoke review accepted the change.',
  findings: [],
});
const GENERATED_FLOW_MIRROR_ROOT_ENV = 'CIRCUIT_GENERATED_FLOW_MIRROR_ROOT';

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function relayerWithBody(body: string, connectorName = 'claude-code'): RelayFn {
  return {
    connectorName,
    relay: async (input: RelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: `stub-v2-${connectorName}`,
      result_body:
        input.prompt.includes('Step: act-step') && body === '{"verdict":"accept"}'
          ? BUILD_IMPLEMENTATION_BODY
          : input.prompt.includes('Step: review-step') &&
              input.prompt.includes('build.review@v1') &&
              body === '{"verdict":"accept"}'
            ? BUILD_REVIEW_BODY
            : body,
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function generatedFixRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      let result_body: string;
      if (input.prompt.includes('Step: fix-gather-context')) {
        result_body = FIX_CONTEXT_BODY;
      } else if (input.prompt.includes('Step: fix-diagnose')) {
        result_body = FIX_DIAGNOSIS_BODY;
      } else if (input.prompt.includes('Step: fix-act')) {
        result_body = FIX_CHANGE_BODY;
      } else if (input.prompt.includes('Step: fix-review')) {
        result_body = FIX_REVIEW_BODY;
      } else {
        throw new Error(`unexpected generated Fix relay prompt: ${input.prompt.slice(0, 160)}`);
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-v2-fix-generated',
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function fixProofComposeExecutor(): StepExecutorV2 {
  return async (step, context) => {
    if (step.kind !== 'compose') {
      throw new Error(`Fix proof compose executor received unexpected step kind '${step.kind}'`);
    }
    if (step.id !== 'fix-frame') {
      return await executeComposeV2(step, context);
    }
    const report = step.writes?.report;
    if (report?.schema === undefined) {
      throw new Error("Fix proof compose executor expected 'fix-frame' to write a report");
    }
    const brief = FixBrief.parse({
      problem_statement: context.goal,
      expected_behavior: `After fix: ${context.goal}`,
      observed_behavior: `Before fix: ${context.goal}`,
      scope: 'Synthetic v2 executor proof fixture.',
      regression_contract: {
        expected_behavior: `After fix: ${context.goal}`,
        actual_behavior: `Before fix: ${context.goal}`,
        repro: {
          kind: 'not-reproducible',
          deferred_reason: 'Synthetic proof fixture; no live bug reproduction is required.',
        },
        regression_test: {
          status: 'deferred',
          deferred_reason: 'Synthetic proof fixture uses a deterministic verification command.',
        },
      },
      success_criteria: ['Deterministic Fix proof verification exits 0.'],
      verification_command_candidates: [
        {
          id: 'proof-v2-executor-verify',
          cwd: '.',
          argv: ['node', '-e', 'process.exit(0)'],
          timeout_ms: 30_000,
          max_output_bytes: 200_000,
          env: {},
        },
      ],
    });
    await context.files.writeJson(report, brief);
    await context.trace.append({
      run_id: context.runId,
      kind: 'step.report_written',
      step_id: step.id,
      report_path: report.path,
      report_schema: report.schema,
    });
    return { route: 'pass', details: { writer: step.writer, proof: 'test-fix-brief' } };
  };
}

function forceFixDiagnoseAskRelayExecutor(): StepExecutorV2 {
  return async (step, context) => {
    if (step.kind !== 'relay') {
      throw new Error(`Fix autonomous relay proof received unexpected step kind '${step.kind}'`);
    }
    const outcome = await executeRelayV2(step, context);
    if (step.id !== 'fix-diagnose') return outcome;
    if ('kind' in outcome) return outcome;
    return {
      route: 'ask',
      details: { ...(outcome.details ?? {}), proof: 'force-fix-no-repro-checkpoint' },
    };
  };
}

function generatedExploreRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      let result_body: string;
      if (input.prompt.includes('Step: synthesize-step')) {
        result_body = EXPLORE_COMPOSE_BODY;
      } else if (input.prompt.includes('Step: review-step')) {
        result_body = EXPLORE_REVIEW_BODY;
      } else {
        throw new Error(`unexpected generated Explore relay prompt: ${input.prompt.slice(0, 160)}`);
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-v2-explore-generated',
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function generatedMigrateRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      let result_body: string;
      if (input.prompt.includes('Step: inventory-step')) {
        result_body = MIGRATE_INVENTORY_BODY;
      } else if (
        input.prompt.includes('Step: act-step') &&
        input.prompt.includes('Title: Act - implementation relay')
      ) {
        result_body = BUILD_IMPLEMENTATION_BODY;
      } else if (
        input.prompt.includes('Step: review-step') &&
        input.prompt.includes('Title: Review - implementation review relay')
      ) {
        result_body = BUILD_REVIEW_BODY;
      } else if (
        input.prompt.includes('Step: review-step') &&
        input.prompt.includes('Title: Cutover Review - independent audit of the migration cutover')
      ) {
        result_body = MIGRATE_REVIEW_BODY;
      } else {
        throw new Error(`unexpected generated Migrate relay prompt: ${input.prompt.slice(0, 160)}`);
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-v2-migrate-generated',
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function generatedSweepRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      let result_body: string;
      if (input.prompt.includes('Step: survey-step')) {
        result_body = SWEEP_ANALYSIS_BODY;
      } else if (input.prompt.includes('Step: execute-step')) {
        result_body = SWEEP_BATCH_BODY;
      } else if (input.prompt.includes('Step: review-step')) {
        result_body = SWEEP_REVIEW_BODY;
      } else {
        throw new Error(`unexpected generated Sweep relay prompt: ${input.prompt.slice(0, 160)}`);
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-v2-sweep-generated',
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function tournamentRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      const proposal = (option_id: string, option_label: string, case_summary: string) => ({
        verdict: 'accept',
        option_id,
        option_label,
        case_summary,
        assumptions: ['The operator accepts the stated tradeoff.'],
        evidence_refs: ['reports/decision-options.json'],
        risks: ['The proof fixture only covers synthetic decision evidence.'],
        next_action: `Run a Build plan for ${option_label}.`,
      });
      if (input.prompt.includes('Step: proposal-fanout-step-option-1')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-tournament-option-1',
          result_body: JSON.stringify(
            proposal('option-1', 'React', 'Choose React for ecosystem depth.'),
          ),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-2')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-tournament-option-2',
          result_body: JSON.stringify(
            proposal('option-2', 'Vue', 'Choose Vue for iteration speed.'),
          ),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-3')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-tournament-option-3',
          result_body: JSON.stringify(
            proposal('option-3', 'Hybrid path', 'Prototype both paths before choosing.'),
          ),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-4')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-tournament-option-4',
          result_body: JSON.stringify(
            proposal('option-4', 'Defer pending evidence', 'Gather missing constraints first.'),
          ),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-tournament-review',
        result_body: JSON.stringify({
          verdict: 'recommend',
          recommended_option_id: 'option-1',
          comparison: 'React carries ecosystem depth while Vue carries speed.',
          objections: ['The choice lacks a spike.'],
          missing_evidence: ['No production spike exists.'],
          tradeoff_question: 'Choose ecosystem depth or iteration speed.',
          confidence: 'medium',
        }),
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function traceEntryLog(runFolder: string): Array<Record<string, unknown>> {
  return readFileSync(join(runFolder, 'trace.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function expectV2Trace(runFolder: string): void {
  expect(traceEntryLog(runFolder)[0]).toMatchObject({ engine: 'core-v2' });
}

function expectRetainedTrace(runFolder: string): void {
  const first = traceEntryLog(runFolder)[0];
  expect(first).toMatchObject({ schema_version: 1 });
  expect(first).not.toMatchObject({ engine: 'core-v2' });
}

function writeV2Runtime(value: string | undefined): () => void {
  const originalRuntime = process.env.CIRCUIT_V2_RUNTIME;
  process.env.CIRCUIT_V2_RUNTIME = value;
  return () => {
    process.env.CIRCUIT_V2_RUNTIME = originalRuntime;
  };
}

function writeV2RuntimeCandidate(value: string | undefined): () => void {
  const originalRuntime = process.env.CIRCUIT_V2_RUNTIME_CANDIDATE;
  process.env.CIRCUIT_V2_RUNTIME_CANDIDATE = value;
  return () => {
    process.env.CIRCUIT_V2_RUNTIME_CANDIDATE = originalRuntime;
  };
}

function writeShowRuntimeDecision(value: string | undefined): () => void {
  const originalRuntime = process.env.CIRCUIT_SHOW_RUNTIME_DECISION;
  process.env.CIRCUIT_SHOW_RUNTIME_DECISION = value;
  return () => {
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = originalRuntime;
  };
}

function writeDisableV2Runtime(value: string | undefined): () => void {
  const originalRuntime = process.env.CIRCUIT_DISABLE_V2_RUNTIME;
  process.env.CIRCUIT_DISABLE_V2_RUNTIME = value;
  return () => {
    process.env.CIRCUIT_DISABLE_V2_RUNTIME = originalRuntime;
  };
}

function writeGeneratedFlowMirrorRoot(value: string | undefined): () => void {
  const originalRuntime = process.env[GENERATED_FLOW_MIRROR_ROOT_ENV];
  process.env[GENERATED_FLOW_MIRROR_ROOT_ENV] = value;
  return () => {
    process.env[GENERATED_FLOW_MIRROR_ROOT_ENV] = originalRuntime;
  };
}

function restoreAll(restorers: readonly (() => void)[]): void {
  for (const restore of [...restorers].reverse()) restore();
}

function writeCliFixFixture(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const composeStep = (id: string, title: string, reportPath: string, next: string) => ({
    id,
    title,
    protocol: `${id}@v1`,
    reads: [],
    routes: { pass: next },
    executor: 'orchestrator',
    kind: 'compose',
    writes: { report: { path: reportPath, schema: 'fix.brief@v1' } },
    check: {
      kind: 'schema_sections',
      source: { kind: 'report', ref: 'report' },
      required: ['problem_statement', 'success_criteria'],
    },
  });
  const steps = [
    composeStep('frame-step', 'Frame', 'reports/fix/frame-brief.json', 'analyze-step'),
    composeStep('analyze-step', 'Analyze', 'reports/fix/analyze-brief.json', 'act-step'),
    composeStep('act-step', 'Fix', 'reports/fix/act-brief.json', 'verify-step'),
    composeStep('verify-step', 'Verify', 'reports/fix/verify-brief.json', 'review-step'),
    composeStep('review-step', 'Review', 'reports/fix/review-brief.json', 'close-step'),
    composeStep('close-step', 'Close', 'reports/fix/close-brief.json', '@complete'),
  ];

  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schema_version: '2',
        id: 'fix',
        version: '0.1.0',
        purpose: 'Opt-in v2 CLI fixture for Fix fresh-run routing.',
        entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
        entry_modes: [
          {
            name: 'default',
            start_at: 'frame-step',
            depth: 'standard',
            description: 'Default Fix test mode.',
          },
          {
            name: 'lite',
            start_at: 'frame-step',
            depth: 'lite',
            description: 'Lite Fix test mode.',
          },
        ],
        stages: [
          { id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-step'] },
          {
            id: 'analyze-stage',
            title: 'Analyze',
            canonical: 'analyze',
            steps: ['analyze-step'],
          },
          { id: 'act-stage', title: 'Fix', canonical: 'act', steps: ['act-step'] },
          { id: 'verify-stage', title: 'Verify', canonical: 'verify', steps: ['verify-step'] },
          { id: 'review-stage', title: 'Review', canonical: 'review', steps: ['review-step'] },
          { id: 'close-stage', title: 'Close', canonical: 'close', steps: ['close-step'] },
        ],
        stage_path_policy: {
          mode: 'partial',
          omits: ['plan'],
          rationale: 'CLI v2 test fixture: Fix folds planning into diagnosis.',
        },
        steps,
      },
      null,
      2,
    )}\n`,
  );
}

function writeCliFanoutFixture(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schema_version: '2',
        id: 'sweep',
        version: '0.1.0',
        purpose: 'Dedicated v2 CLI fanout progress fixture.',
        entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
        entry_modes: [
          {
            name: 'default',
            start_at: 'fanout-step',
            depth: 'standard',
            description: 'Default fanout progress fixture mode.',
          },
        ],
        stages: [{ id: 'act-stage', title: 'Fanout', canonical: 'act', steps: ['fanout-step'] }],
        stage_path_policy: {
          mode: 'partial',
          omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
          rationale: 'Dedicated CLI fanout progress fixture keeps only the fanout step.',
        },
        steps: [
          {
            id: 'fanout-step',
            title: 'Fanout progress fixture',
            protocol: 'fanout-progress@v1',
            reads: [],
            routes: { pass: '@complete' },
            executor: 'orchestrator',
            kind: 'fanout',
            branches: {
              kind: 'static',
              branches: [
                {
                  branch_id: 'option-1',
                  execution: {
                    kind: 'relay',
                    role: 'reviewer',
                    goal: 'Produce a deterministic tournament proposal for option-1.',
                    report_schema: 'explore.tournament-proposal@v1',
                    provenance_field: 'option_id',
                  },
                },
              ],
            },
            concurrency: { kind: 'bounded', max: 1 },
            on_child_failure: 'abort-all',
            writes: {
              branches_dir: 'reports/fanout/branches',
              aggregate: {
                path: 'reports/fanout/aggregate.json',
                schema: 'explore.tournament-aggregate@v1',
              },
            },
            check: {
              kind: 'fanout_aggregate',
              source: { kind: 'fanout_results', ref: 'aggregate' },
              join: { policy: 'aggregate-only' },
              verdicts: { admit: ['accept'] },
            },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

function writeCustomConnectorConfig(baseDir: string, commandScript: string): void {
  writeCustomConnectorConfigWithCommand(baseDir, ['node', commandScript]);
}

function writeCustomConnectorConfigWithCommand(baseDir: string, command: readonly string[]): void {
  mkdirSync(baseDir, { recursive: true });
  writeFileSync(
    join(baseDir, 'config.yaml'),
    [
      'schema_version: 1',
      'relay:',
      '  default: local-reviewer',
      '  connectors:',
      '    local-reviewer:',
      '      kind: custom',
      '      name: local-reviewer',
      `      command: ${JSON.stringify(command)}`,
      '      prompt_transport: prompt-file',
      '      output:',
      '        kind: output-file',
      '      capabilities:',
      '        filesystem: read-only',
      '        structured_output: json',
      '',
    ].join('\n'),
  );
}

function writeReviewCustomConnectorScript(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      "const { writeFileSync } = require('node:fs');",
      'const outputFile = process.argv[process.argv.length - 1];',
      `writeFileSync(outputFile, ${JSON.stringify(REVIEW_RELAY_BODY)});`,
    ].join(' '),
  );
}

function writeFanoutCustomConnectorScript(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      "const { writeFileSync } = require('node:fs');",
      'const outputFile = process.argv[process.argv.length - 1];',
      `writeFileSync(outputFile, ${JSON.stringify(FANOUT_PROPOSAL_BODY)});`,
    ].join(' '),
  );
}

async function runMainV2Json(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
    readonly runId?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const restoreRuntime = writeV2Runtime('1');
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate(undefined);
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: options.runId ?? '85000000-0000-4000-8000-000000000001',
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
    restoreAll([
      restoreRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function expectMainV2Rejects(
  argv: readonly string[],
  message: RegExp,
  options: { readonly relayer?: RelayFn } = {},
): Promise<void> {
  const restoreRuntime = writeV2Runtime('1');
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate(undefined);
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    await expect(
      main(argv, {
        ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
        now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
        runId: '85000000-0000-4000-8000-000000000099',
        configHomeDir: join(runFolderBase, 'empty-home'),
        configCwd: process.cwd(),
      }),
    ).rejects.toThrow(message);
    expect(captured).toBe('');
  } finally {
    process.stdout.write = origWrite;
    restoreAll([
      restoreRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }
}

async function runMainV2JsonWithProgress(
  argv: readonly string[],
  options: { readonly relayer?: RelayFn; readonly configCwd?: string } = {},
): Promise<{ readonly output: Record<string, unknown>; readonly progress: readonly unknown[] }> {
  const restoreRuntime = writeV2Runtime('1');
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate(undefined);
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let stdout = '';
  let stderr = '';
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: '85000000-0000-4000-8000-000000000007',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    restoreAll([
      restoreRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  return {
    output: JSON.parse(stdout) as Record<string, unknown>,
    progress: stderr
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as unknown),
  };
}

async function runMainCandidateJson(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly composeWriter?: ComposeWriterFn;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
    readonly runId?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const restoreStrictRuntime = writeV2Runtime(undefined);
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate('1');
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.composeWriter === undefined ? {} : { composeWriter: options.composeWriter }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: options.runId ?? '86000000-0000-4000-8000-000000000001',
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
    restoreAll([
      restoreStrictRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function runMainDefaultJson(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly composeWriter?: ComposeWriterFn;
    readonly v2Executors?: Partial<ExecutorRegistryV2>;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
    readonly runId?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const restoreStrictRuntime = writeV2Runtime(undefined);
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate(undefined);
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.composeWriter === undefined ? {} : { composeWriter: options.composeWriter }),
      ...(options.v2Executors === undefined ? {} : { v2Executors: options.v2Executors }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: options.runId ?? '87000000-0000-4000-8000-000000000001',
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
    restoreAll([
      restoreStrictRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function runMainDefaultJsonWithProgress(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly v2Executors?: Partial<ExecutorRegistryV2>;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
  } = {},
): Promise<{ readonly output: Record<string, unknown>; readonly progress: readonly unknown[] }> {
  const restoreStrictRuntime = writeV2Runtime(undefined);
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate(undefined);
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let stdout = '';
  let stderr = '';
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.v2Executors === undefined ? {} : { v2Executors: options.v2Executors }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: '87000000-0000-4000-8000-000000000007',
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    restoreAll([
      restoreStrictRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  return {
    output: JSON.parse(stdout) as Record<string, unknown>,
    progress: stderr
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as unknown),
  };
}

async function runMainRollbackJson(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly composeWriter?: ComposeWriterFn;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
    readonly runId?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const restoreStrictRuntime = writeV2Runtime(undefined);
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate(undefined);
  const restoreDisabled = writeDisableV2Runtime('1');
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.composeWriter === undefined ? {} : { composeWriter: options.composeWriter }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: options.runId ?? '88000000-0000-4000-8000-000000000001',
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
    restoreAll([
      restoreStrictRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function runMainRuntimeDecisionJson(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly composeWriter?: ComposeWriterFn;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
    readonly runId?: string;
    readonly strict?: boolean;
    readonly rollback?: boolean;
    readonly showRuntimeDecision?: boolean;
    readonly candidateAlias?: boolean;
    readonly generatedMirrorRoot?: string;
  } = {},
): Promise<Record<string, unknown>> {
  const restoreStrictRuntime = writeV2Runtime(options.strict ? '1' : undefined);
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(
    options.showRuntimeDecision ? '1' : undefined,
  );
  const restoreCandidate = writeV2RuntimeCandidate(options.candidateAlias ? '1' : undefined);
  const restoreDisabled = writeDisableV2Runtime(options.rollback ? '1' : undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(
    options.generatedMirrorRoot ?? undefined,
  );
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      ...(options.composeWriter === undefined ? {} : { composeWriter: options.composeWriter }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: options.runId ?? randomUUID(),
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
    restoreAll([
      restoreStrictRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function runMainCandidateJsonWithProgress(
  argv: readonly string[],
  options: {
    readonly relayer?: RelayFn;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
  } = {},
): Promise<{ readonly output: Record<string, unknown>; readonly progress: readonly unknown[] }> {
  const restoreStrictRuntime = writeV2Runtime(undefined);
  const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
  const restoreCandidate = writeV2RuntimeCandidate('1');
  const restoreDisabled = writeDisableV2Runtime(undefined);
  const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
  let stdout = '';
  let stderr = '';
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const exit = await main(argv, {
      ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
      now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
      runId: '86000000-0000-4000-8000-000000000007',
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    restoreAll([
      restoreStrictRuntime,
      restoreShowRuntimeDecision,
      restoreCandidate,
      restoreDisabled,
      restoreGeneratedMirrorRoot,
    ]);
  }

  return {
    output: JSON.parse(stdout) as Record<string, unknown>,
    progress: stderr
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as unknown),
  };
}

async function runRunsShowJson(runFolder: string): Promise<RunStatusProjectionV1> {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(['runs', 'show', '--run-folder', runFolder, '--json']);
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
  }
  return RunStatusProjectionV1.parse(JSON.parse(captured));
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = join(tmpdir(), `circuit-next-cli-v2-${randomUUID()}`);
  mkdirSync(runFolderBase, { recursive: true });
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('CLI opt-in v2 runtime', () => {
  it('documents the runtime decision diagnostics flag and candidate alias in CLI usage', () => {
    const text = usage();
    expect(text).toContain(CLI_RUNTIME_ROUTING_POLICY);
    expect(text).toContain('CIRCUIT_SHOW_RUNTIME_DECISION=1');
    expect(text).toContain('includes runtime/runtime_reason fields');
    expect(text).toContain('CIRCUIT_V2_RUNTIME_CANDIDATE=1 is a temporary alias');
    expect(text).toContain('Custom roots created by `circuit-next create` are retained by default');
    expect(text).toContain('composeWriter');
    expect(text).toContain('arbitrary fixtures/custom roots');
    expect(text).toContain('unmarked retained checkpoint folders');
    expect(text).not.toContain('enables explicitly proven candidate rows');
  });

  it('runs a fresh Review invocation through v2 when CIRCUIT_V2_RUNTIME=1', async () => {
    const runFolder = join(runFolderBase, 'review-v2');
    const output = await runMainV2Json(
      ['run', 'review', '--goal', 'review this patch', '--run-folder', runFolder],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    expect(output).toMatchObject({
      flow_id: 'review',
      selected_flow: 'review',
      routed_by: 'explicit',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'review', depth: 'standard' }),
    });
    expect(
      RunResult.parse(JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8'))),
    ).toMatchObject({ flow_id: 'review', outcome: 'complete' });
  });

  it('runs a synthetic fresh Fix fixture through the opt-in v2 path', async () => {
    const fixturePath = join(runFolderBase, 'fixtures', 'fix.json');
    const runFolder = join(runFolderBase, 'fix-v2');
    writeCliFixFixture(fixturePath);

    const output = await runMainV2Json([
      'run',
      'fix',
      '--goal',
      'quick fix: restore the missing token edge case',
      '--fixture',
      fixturePath,
      '--mode',
      'lite',
      '--run-folder',
      runFolder,
    ]);

    const bootstrap = traceEntryLog(runFolder).find((entry) => entry.kind === 'run.bootstrapped');
    expect(output).toMatchObject({
      flow_id: 'fix',
      selected_flow: 'fix',
      entry_mode: 'lite',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'fix', depth: 'lite' }),
    });
  });

  it('runs generated Fix lite through the normal opt-in v2 fixture resolver', async () => {
    const expectedFixtureBytes = readFileSync(
      join(process.cwd(), 'generated', 'flows', 'fix', 'lite.json'),
    );
    const projectRoot = join(runFolderBase, 'fix-empty-project');
    const runFolder = join(runFolderBase, 'fix-generated-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const output = await runMainV2Json(
      [
        'run',
        'fix',
        '--goal',
        'quick fix: restore the missing token edge case',
        '--mode',
        'lite',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: generatedFixRelayer() },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    const verification = FixVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'fix', 'verification.json'), 'utf8')),
    );
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    const manifestSnapshot = JSON.parse(
      readFileSync(join(runFolder, 'manifest.snapshot.json'), 'utf8'),
    ) as { bytes_base64: string };
    expect(output).toMatchObject({
      flow_id: 'fix',
      selected_flow: 'fix',
      entry_mode: 'lite',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'fix', depth: 'lite' }),
    });
    expect(verification).toMatchObject({ overall_status: 'passed' });
    expect(
      FixResult.parse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'fix-result.json'), 'utf8')),
      ),
    ).toMatchObject({
      outcome: 'partial',
      verification_status: 'passed',
      review_status: 'skipped',
    });
    expect(result).toMatchObject({ flow_id: 'fix', outcome: 'complete' });
    expect(Buffer.from(manifestSnapshot.bytes_base64, 'base64').toString('utf8')).toBe(
      expectedFixtureBytes.toString('utf8'),
    );
  });

  it('runs generated Build lite through the opt-in v2 path', async () => {
    const projectRoot = join(runFolderBase, 'build-lite-project');
    const runFolder = join(runFolderBase, 'build-lite-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );
    const output = await runMainV2Json(
      [
        'run',
        'build',
        '--goal',
        'Add a tiny Build feature from the v2 CLI path',
        '--mode',
        'lite',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: relayerWithBody('{"verdict":"accept"}') },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    const checkpoint = entries.find((entry) => entry.kind === 'checkpoint.resolved');
    expect(output).toMatchObject({
      flow_id: 'build',
      selected_flow: 'build',
      entry_mode: 'lite',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'build', depth: 'lite' }),
    });
    expect(checkpoint).toMatchObject({
      data: expect.objectContaining({ selection: 'continue', resolution_source: 'safe-default' }),
    });
  });

  it('runs generated Build default through the opt-in v2 path', async () => {
    const projectRoot = join(runFolderBase, 'build-default-project');
    const runFolder = join(runFolderBase, 'build-default-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );
    const output = await runMainV2Json(
      [
        'run',
        'build',
        '--goal',
        'Add a tiny default Build feature from the v2 CLI path',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: relayerWithBody('{"verdict":"accept"}') },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    const checkpoint = entries.find((entry) => entry.kind === 'checkpoint.resolved');
    expect(output).toMatchObject({
      flow_id: 'build',
      selected_flow: 'build',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'build', depth: 'standard' }),
    });
    expect(checkpoint).toMatchObject({
      data: expect.objectContaining({ selection: 'continue', resolution_source: 'safe-default' }),
    });
    expect(
      RunResult.parse(JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8'))),
    ).toMatchObject({ flow_id: 'build', outcome: 'complete' });
  });

  it('runs generated Explore default through the opt-in v2 path', async () => {
    const runFolder = join(runFolderBase, 'explore-default-v2');
    const output = await runMainV2Json(
      [
        'run',
        'explore',
        '--goal',
        'Explore whether the v2 CLI path is ready for the next slice',
        '--run-folder',
        runFolder,
      ],
      { relayer: generatedExploreRelayer() },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    const relayStepIds = entries
      .filter((entry) => entry.kind === 'relay.started')
      .map((entry) => entry.step_id);
    const compose = ExploreCompose.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'compose.json'), 'utf8')),
    );
    const review = ExploreReviewVerdict.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'review-verdict.json'), 'utf8')),
    );
    const exploreResult = ExploreResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'explore-result.json'), 'utf8')),
    );
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );

    expect(output).toMatchObject({
      flow_id: 'explore',
      selected_flow: 'explore',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'explore', depth: 'standard' }),
    });
    expect(relayStepIds).toEqual(['synthesize-step', 'review-step']);
    expect(compose).toMatchObject({ verdict: 'accept' });
    expect(review).toMatchObject({ verdict: 'accept' });
    expect(exploreResult.verdict_snapshot).toMatchObject({
      compose_verdict: 'accept',
      review_verdict: 'accept',
    });
    expect(result).toMatchObject({ flow_id: 'explore', outcome: 'complete' });
  });

  it('runs generated Migrate default through the opt-in v2 path with a Build child run', async () => {
    const projectRoot = join(runFolderBase, 'migrate-project');
    const runFolder = join(runFolderBase, 'migrate-default-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const output = await runMainV2Json(
      [
        'run',
        'migrate',
        '--goal',
        'Migrate a tiny internal API surface through the v2 CLI path',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: generatedMigrateRelayer() },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    const subRunStarted = entries.find((entry) => entry.kind === 'sub_run.started');
    const subRunCompleted = entries.find((entry) => entry.kind === 'sub_run.completed');
    const childRunId = subRunStarted?.child_run_id;
    if (typeof childRunId !== 'string') {
      throw new Error('expected Migrate sub_run.started to record child_run_id');
    }
    const childRunFolder = join(dirname(runFolder), childRunId);
    const childSnapshot = JSON.parse(
      readFileSync(join(childRunFolder, 'manifest.snapshot.json'), 'utf8'),
    ) as { flow_id: string };
    const childResult = RunResult.parse(
      JSON.parse(readFileSync(join(childRunFolder, 'reports', 'result.json'), 'utf8')),
    );
    const inventory = MigrateInventory.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate', 'inventory.json'), 'utf8')),
    );
    const batch = MigrateBatch.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate', 'batch-result.json'), 'utf8')),
    );
    const verification = MigrateVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate', 'verification.json'), 'utf8')),
    );
    const review = MigrateReview.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate', 'review.json'), 'utf8')),
    );
    const migrateResult = MigrateResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate-result.json'), 'utf8')),
    );
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );

    expect(output).toMatchObject({
      flow_id: 'migrate',
      selected_flow: 'migrate',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'migrate', depth: 'standard' }),
    });
    expect(subRunStarted).toMatchObject({
      child_flow_id: 'build',
      child_entry_mode: 'default',
      child_depth: 'standard',
    });
    expect(subRunCompleted).toMatchObject({
      child_run_id: childRunId,
      child_outcome: 'complete',
      verdict: 'accept',
      data: expect.objectContaining({ admitted: true }),
    });
    expect(childSnapshot.flow_id).toBe('build');
    expect(childResult).toMatchObject({ flow_id: 'build', outcome: 'complete', verdict: 'accept' });
    expect(inventory).toMatchObject({ verdict: 'accept' });
    expect(batch).toMatchObject({ flow_id: 'build', outcome: 'complete', verdict: 'accept' });
    expect(verification).toMatchObject({ overall_status: 'passed' });
    expect(review).toMatchObject({ verdict: 'cutover-approved', findings: [] });
    expect(migrateResult).toMatchObject({
      outcome: 'complete',
      verification_status: 'passed',
      review_verdict: 'cutover-approved',
      batch_count: 1,
    });
    expect(result).toMatchObject({ flow_id: 'migrate', outcome: 'complete' });
  });

  it('runs generated Sweep default through the opt-in v2 path', async () => {
    const projectRoot = join(runFolderBase, 'sweep-project');
    const runFolder = join(runFolderBase, 'sweep-default-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const output = await runMainV2Json(
      [
        'run',
        'sweep',
        '--goal',
        'Sweep stale generated report references through the v2 CLI path',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: generatedSweepRelayer() },
    );

    const entries = traceEntryLog(runFolder);
    const bootstrap = entries.find((entry) => entry.kind === 'run.bootstrapped');
    const checkpoint = entries.find((entry) => entry.kind === 'checkpoint.resolved');
    const relayStepIds = entries
      .filter((entry) => entry.kind === 'relay.started')
      .map((entry) => entry.step_id);
    const brief = SweepBrief.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep', 'brief.json'), 'utf8')),
    );
    const analysis = SweepAnalysis.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep', 'analysis.json'), 'utf8')),
    );
    const queue = SweepQueue.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep', 'queue.json'), 'utf8')),
    );
    const batch = SweepBatch.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep', 'batch.json'), 'utf8')),
    );
    const verification = SweepVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep', 'verification.json'), 'utf8')),
    );
    const review = SweepReview.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep', 'review.json'), 'utf8')),
    );
    const sweepResult = SweepResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep-result.json'), 'utf8')),
    );
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );

    expect(output).toMatchObject({
      flow_id: 'sweep',
      selected_flow: 'sweep',
      outcome: 'complete',
    });
    expect(bootstrap).toMatchObject({
      data: expect.objectContaining({ flow_id: 'sweep', depth: 'standard' }),
    });
    expect(checkpoint).toMatchObject({
      data: expect.objectContaining({ selection: 'continue', resolution_source: 'safe-default' }),
    });
    expect(relayStepIds).toEqual(['survey-step', 'execute-step', 'review-step']);
    expect(brief).toMatchObject({ sweep_type: 'cleanup' });
    expect(analysis).toMatchObject({ verdict: 'accept' });
    expect(queue).toMatchObject({ to_execute: ['candidate-1'], deferred: [] });
    expect(batch).toMatchObject({ verdict: 'accept' });
    expect(verification).toMatchObject({ overall_status: 'passed' });
    expect(review).toMatchObject({ verdict: 'clean', findings: [] });
    expect(sweepResult).toMatchObject({
      outcome: 'complete',
      verification_status: 'passed',
      review_verdict: 'clean',
      deferred_count: 0,
    });
    expect(result).toMatchObject({ flow_id: 'sweep', outcome: 'complete' });
  });

  it('emits route and runtime progress for the opt-in v2 path', async () => {
    const runFolder = join(runFolderBase, 'review-v2-progress');
    const { output, progress } = await runMainV2JsonWithProgress(
      [
        'run',
        'review',
        '--goal',
        'review this patch with progress',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );

    const progressEvents = progress as Array<Record<string, unknown>>;
    const progressTypes = progressEvents.map((event) => event.type);
    expect(output).toMatchObject({ flow_id: 'review', outcome: 'complete' });
    expect(progressEvents[0]).toMatchObject({
      schema_version: 1,
      type: 'route.selected',
      selected_flow: 'review',
    });
    expect(progressTypes).toEqual(
      expect.arrayContaining([
        'run.started',
        'task_list.updated',
        'step.started',
        'relay.started',
        'relay.completed',
        'step.completed',
        'run.completed',
      ]),
    );
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'step.started',
          step_id: 'audit-step',
          attempt: 1,
        }),
        expect.objectContaining({
          type: 'relay.started',
          step_id: 'audit-step',
          connector_name: 'claude-code',
          filesystem_capability: 'trusted-write',
        }),
        expect.objectContaining({
          type: 'run.completed',
          outcome: 'complete',
          result_path: `${runFolder}/reports/result.json`,
        }),
      ]),
    );
  });

  it('uses project custom connector descriptors over user-global descriptors in the CLI opt-in path', async () => {
    const homeDir = join(runFolderBase, 'home');
    const projectRoot = join(runFolderBase, 'project-config-precedence');
    const runFolder = join(runFolderBase, 'review-custom-precedence');
    writeCustomConnectorConfig(join(homeDir, '.config', 'circuit-next'), 'user-reviewer.js');
    writeCustomConnectorConfig(join(projectRoot, '.circuit'), 'project-reviewer.js');

    const output = await runMainV2Json(
      ['run', 'review', '--goal', 'review this patch', '--run-folder', runFolder],
      {
        configCwd: projectRoot,
        configHomeDir: homeDir,
        relayer: relayerWithBody(REVIEW_RELAY_BODY, 'local-reviewer'),
      },
    );

    const relayStarted = traceEntryLog(runFolder).find((entry) => entry.kind === 'relay.started');
    expect(output).toMatchObject({ flow_id: 'review', outcome: 'complete' });
    expect(relayStarted).toMatchObject({
      data: expect.objectContaining({
        connector: expect.objectContaining({
          kind: 'custom',
          name: 'local-reviewer',
          command: ['node', 'project-reviewer.js'],
        }),
      }),
    });
  });

  it('runs Review through the real custom connector bridge in the CLI opt-in path', async () => {
    const projectRoot = join(runFolderBase, 'project-custom-connector');
    const connectorScript = join(projectRoot, 'connectors', 'reviewer.cjs');
    const runFolder = join(runFolderBase, 'review-real-custom-connector');
    writeReviewCustomConnectorScript(connectorScript);
    writeCustomConnectorConfigWithCommand(join(projectRoot, '.circuit'), [
      process.execPath,
      connectorScript,
    ]);

    const output = await runMainV2Json(
      ['run', 'review', '--goal', 'review this patch', '--run-folder', runFolder],
      { configCwd: projectRoot },
    );

    const relayStarted = traceEntryLog(runFolder).find((entry) => entry.kind === 'relay.started');
    const receipt = readFileSync(join(runFolder, 'reports', 'relay', 'review.receipt.txt'), 'utf8');
    const rawFindings = ReviewRelayResult.parse(
      JSON.parse(
        readFileSync(join(runFolder, 'stages', 'analyze', 'review-raw-findings.json'), 'utf8'),
      ),
    );
    const reviewResult = ReviewResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'review-result.json'), 'utf8')),
    );
    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(output).toMatchObject({ flow_id: 'review', outcome: 'complete' });
    expect(relayStarted).toMatchObject({
      data: expect.objectContaining({
        connector: expect.objectContaining({ kind: 'custom', name: 'local-reviewer' }),
      }),
    });
    expect(
      readFileSync(join(runFolder, 'reports', 'relay', 'review.request.json'), 'utf8'),
    ).toContain('Step: audit-step');
    expect(receipt).toMatch(/^custom:local-reviewer:\d+$/);
    expect(rawFindings).toMatchObject({ verdict: 'NO_ISSUES_FOUND', findings: [] });
    expect(reviewResult).toMatchObject({ verdict: 'CLEAN', findings: [] });
    expect(result).toMatchObject({ flow_id: 'review', outcome: 'complete' });
  });

  it('threads config into v2 connector safety before invoking a relayer', async () => {
    const configCwd = join(runFolderBase, 'project-config');
    const runFolder = join(runFolderBase, 'build-codex-rejected');
    mkdirSync(join(configCwd, '.circuit'), { recursive: true });
    writeFileSync(
      join(configCwd, '.circuit', 'config.yaml'),
      ['schema_version: 1', 'relay:', '  default: codex', ''].join('\n'),
    );
    let relayCalls = 0;

    const { output, progress } = await runMainV2JsonWithProgress(
      [
        'run',
        'build',
        '--goal',
        'Add a tiny Build feature with unsafe connector config',
        '--mode',
        'lite',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd,
        relayer: {
          connectorName: 'codex',
          relay: async (input) => {
            relayCalls += 1;
            return {
              request_payload: input.prompt,
              receipt_id: 'should-not-run',
              result_body: BUILD_IMPLEMENTATION_BODY,
              duration_ms: 1,
              cli_version: '0.0.0-stub',
            };
          },
        },
      },
    );
    const progressEvents = progress as Array<Record<string, unknown>>;

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(output).toMatchObject({ flow_id: 'build', outcome: 'aborted' });
    expect(result.reason).toContain("connector 'codex' is read-only");
    expect(relayCalls).toBe(0);
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'step.aborted',
          step_id: 'act-step',
          reason: expect.stringContaining("connector 'codex' is read-only"),
        }),
        expect.objectContaining({
          type: 'run.aborted',
          outcome: 'aborted',
          reason: expect.stringContaining("connector 'codex' is read-only"),
        }),
      ]),
    );
  });

  it('routes Build deep through v2 under strict opt-in', async () => {
    const projectRoot = join(runFolderBase, 'strict-build-deep-project');
    const runFolder = join(runFolderBase, 'build-deep-strict');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const output = await runMainV2Json(
      [
        'run',
        'build',
        '--goal',
        'Add a tiny Build feature with deep checkpoint wait',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: relayerWithBody('{"verdict":"accept"}') },
    );

    expect(output).toMatchObject({
      flow_id: 'build',
      entry_mode: 'deep',
      outcome: 'checkpoint_waiting',
      runtime: 'v2',
      runtime_reason: expect.stringContaining(
        "v2 supports fresh build entry mode 'deep' at depth 'deep'",
      ),
      checkpoint: {
        step_id: 'frame-step',
        allowed_choices: ['continue'],
      },
    });
    expect(traceEntryLog(runFolder)[0]).toMatchObject({ engine: 'core-v2' });
  });

  it.each([
    {
      flow: 'runtime-proof',
      goal: 'exercise the internal runtime proof fixture',
    },
  ])('keeps $flow outside the narrow opt-in CLI allowlist for now', async ({ flow, goal }) => {
    const runFolder = join(runFolderBase, `${flow}-v2-rejected`);

    await expectMainV2Rejects(
      ['run', flow, '--goal', goal, '--run-folder', runFolder],
      /flow 'runtime-proof' is not in the v2 runtime support matrix/,
      { relayer: relayerWithBody('{"verdict":"accept"}') },
    );

    expect(existsSync(runFolder)).toBe(false);
  });

  it('routes matrix-supported fresh runs through v2 by default without runtime output fields', async () => {
    const sharedProjectRoot = join(runFolderBase, 'default-selector-project');
    mkdirSync(sharedProjectRoot, { recursive: true });
    writeFileSync(
      join(sharedProjectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const cases: Array<{
      readonly label: string;
      readonly argv: readonly string[];
      readonly relayer: RelayFn;
      readonly flowId: string;
      readonly entryMode?: string;
      readonly configCwd?: string;
    }> = [
      {
        label: 'review default',
        argv: [
          'run',
          'review',
          '--goal',
          'review through default routing',
          '--run-folder',
          join(runFolderBase, 'default-review'),
        ],
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        flowId: 'review',
      },
      {
        label: 'fix default',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix default through default routing',
          '--run-folder',
          join(runFolderBase, 'default-fix-default'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix lite',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix lite through default routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'default-fix-lite'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'lite',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix deep',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix deep through default routing',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'default-fix-deep'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'deep',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix autonomous',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix autonomous through default routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'default-fix-autonomous'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build default',
        argv: [
          'run',
          'build',
          '--goal',
          'build through default routing',
          '--run-folder',
          join(runFolderBase, 'default-build'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build lite',
        argv: [
          'run',
          'build',
          '--goal',
          'build lite through default routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'default-build-lite'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        entryMode: 'lite',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build autonomous',
        argv: [
          'run',
          'build',
          '--goal',
          'build autonomous through default routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'default-build-autonomous'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'explore default',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore through default routing',
          '--run-folder',
          join(runFolderBase, 'default-explore'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
      },
      {
        label: 'explore lite',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore lite through default routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'default-explore-lite'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
        entryMode: 'lite',
      },
      {
        label: 'explore deep',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore deep through default routing',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'default-explore-deep'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
        entryMode: 'deep',
      },
      {
        label: 'explore autonomous',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore autonomous through default routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'default-explore-autonomous'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
        entryMode: 'autonomous',
      },
      {
        label: 'migrate default',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate through default routing',
          '--run-folder',
          join(runFolderBase, 'default-migrate'),
        ],
        relayer: generatedMigrateRelayer(),
        flowId: 'migrate',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'migrate autonomous',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate autonomous through default routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'default-migrate-autonomous'),
        ],
        relayer: generatedMigrateRelayer(),
        flowId: 'migrate',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep default',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep through default routing',
          '--run-folder',
          join(runFolderBase, 'default-sweep'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep lite',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep lite through default routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'default-sweep-lite'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        entryMode: 'lite',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep autonomous',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep autonomous through default routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'default-sweep-autonomous'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
    ];

    for (const candidate of cases) {
      const output = await runMainDefaultJson(candidate.argv, {
        relayer: candidate.relayer,
        ...(candidate.configCwd === undefined ? {} : { configCwd: candidate.configCwd }),
      });
      expect(output, candidate.label).toMatchObject({
        flow_id: candidate.flowId,
        outcome: 'complete',
        ...(candidate.entryMode === undefined ? {} : { entry_mode: candidate.entryMode }),
      });
      expect(output.runtime, candidate.label).toBeUndefined();
      expect(output.runtime_reason, candidate.label).toBeUndefined();
      expectV2Trace(output.run_folder as string);
    }
  }, 30_000);

  it('passes internal v2 executors to default-routed fresh core-v2 runs', async () => {
    const runFolder = join(runFolderBase, 'default-v2-executor-injection');
    const projectRoot = join(runFolderBase, 'default-v2-executor-project');
    mkdirSync(projectRoot, { recursive: true });

    const output = await runMainDefaultJson(
      [
        'run',
        'fix',
        '--goal',
        'quick fix with an internal v2 executor proof',
        '--mode',
        'lite',
        '--run-folder',
        runFolder,
      ],
      {
        relayer: generatedFixRelayer(),
        configCwd: projectRoot,
        v2Executors: { compose: fixProofComposeExecutor() },
      },
    );

    expect(output).toMatchObject({
      flow_id: 'fix',
      outcome: 'complete',
      entry_mode: 'lite',
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);

    const brief = FixBrief.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'fix', 'brief.json'), 'utf8')),
    );
    expect(brief.scope).toBe('Synthetic v2 executor proof fixture.');
    expect(brief.verification_command_candidates[0]?.id).toBe('proof-v2-executor-verify');
    expect(brief.verification_command_candidates[0]?.argv).toEqual([
      'node',
      '-e',
      'process.exit(0)',
    ]);
    const verification = FixVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'fix', 'verification.json'), 'utf8')),
    );
    expect(verification).toMatchObject({
      overall_status: 'passed',
      commands: [expect.objectContaining({ command_id: 'proof-v2-executor-verify' })],
    });
  });

  it('keeps programmatic composeWriter invocations on the retained runtime by default', async () => {
    const runFolder = join(runFolderBase, 'default-compose-writer-retained');
    const writerError = 'composeWriter retained-runtime proof';
    const output = await runMainDefaultJson(
      ['run', 'review', '--goal', 'review with compose writer hook', '--run-folder', runFolder],
      {
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        composeWriter: () => {
          throw new Error(writerError);
        },
      },
    );

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(output).toMatchObject({ flow_id: 'review', outcome: 'aborted' });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expect(result.reason).toContain(writerError);
    expectRetainedTrace(runFolder);
  });

  it('keeps candidate diagnostics plus composeWriter on the retained runtime', async () => {
    const runFolder = join(runFolderBase, 'candidate-compose-writer-retained');
    const writerError = 'composeWriter candidate retained proof';
    const output = await runMainCandidateJson(
      [
        'run',
        'review',
        '--goal',
        'candidate diagnostics with compose writer hook',
        '--run-folder',
        runFolder,
      ],
      {
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        composeWriter: () => {
          throw new Error(writerError);
        },
      },
    );

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(output).toMatchObject({
      flow_id: 'review',
      outcome: 'aborted',
      runtime: 'retained',
      runtime_reason: RUNTIME_POLICY_REASONS.composeWriter,
    });
    expect(output.runtime_reason).toContain('core-v2 customization uses executor injection');
    expect(output.runtime_reason).not.toContain('equivalent compose writer hook');
    expect(result.reason).toContain(writerError);
    expectRetainedTrace(runFolder);
  });

  it('keeps matrix-supported fresh runs on the retained runtime when rollback is enabled', async () => {
    const sharedProjectRoot = join(runFolderBase, 'rollback-project');
    mkdirSync(sharedProjectRoot, { recursive: true });
    writeFileSync(
      join(sharedProjectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const cases: Array<{
      readonly label: string;
      readonly argv: readonly string[];
      readonly relayer: RelayFn;
      readonly configCwd?: string;
    }> = [
      {
        label: 'review default',
        argv: [
          'run',
          'review',
          '--goal',
          'review through rollback',
          '--run-folder',
          join(runFolderBase, 'rollback-review'),
        ],
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
      {
        label: 'fix default',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix default through rollback',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-default'),
        ],
        relayer: generatedFixRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix lite',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix lite through rollback',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-lite'),
        ],
        relayer: generatedFixRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix deep',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix deep through rollback',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-deep'),
        ],
        relayer: generatedFixRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix autonomous',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix autonomous through rollback',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-autonomous'),
        ],
        relayer: generatedFixRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build default',
        argv: [
          'run',
          'build',
          '--goal',
          'build through rollback',
          '--run-folder',
          join(runFolderBase, 'rollback-build'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build deep',
        argv: [
          'run',
          'build',
          '--goal',
          'build deep through rollback',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-build-deep'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build autonomous',
        argv: [
          'run',
          'build',
          '--goal',
          'build autonomous through rollback',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-build-autonomous'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'explore default',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore through rollback',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-default'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore lite',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore lite through rollback',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-lite'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore deep',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore deep through rollback',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-deep'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore autonomous',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore autonomous through rollback',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-autonomous'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore tournament',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore tournament through rollback',
          '--mode',
          'tournament',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-tournament'),
        ],
        relayer: tournamentRelayer(),
      },
      {
        label: 'sweep default',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep through rollback',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-default'),
        ],
        relayer: generatedSweepRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep lite',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep lite through rollback',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-lite'),
        ],
        relayer: generatedSweepRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep deep',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep deep through rollback',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-deep'),
        ],
        relayer: generatedSweepRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'migrate default',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate through rollback',
          '--run-folder',
          join(runFolderBase, 'rollback-migrate-default'),
        ],
        relayer: generatedMigrateRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'migrate deep',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate deep through rollback',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-migrate-deep'),
        ],
        relayer: generatedMigrateRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'migrate autonomous',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate autonomous through rollback',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-migrate-autonomous'),
        ],
        relayer: generatedMigrateRelayer(),
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep autonomous',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep autonomous through rollback',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-autonomous'),
        ],
        relayer: generatedSweepRelayer(),
        configCwd: sharedProjectRoot,
      },
    ];

    for (const candidate of cases) {
      const output = await runMainRollbackJson(candidate.argv, {
        relayer: candidate.relayer,
        ...(candidate.configCwd === undefined ? {} : { configCwd: candidate.configCwd }),
      });
      expect(output, candidate.label).toMatchObject({
        runtime: 'retained',
        runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
      });
      expectRetainedTrace(output.run_folder as string);
    }
  }, 30_000);

  it('keeps rollback plus composeWriter on the retained runtime', async () => {
    const runFolder = join(runFolderBase, 'rollback-compose-writer-retained');
    const writerError = 'composeWriter rollback retained proof';
    const output = await runMainRollbackJson(
      ['run', 'review', '--goal', 'rollback with compose writer hook', '--run-folder', runFolder],
      {
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        composeWriter: () => {
          throw new Error(writerError);
        },
      },
    );

    const result = RunResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(output).toMatchObject({
      flow_id: 'review',
      outcome: 'aborted',
      runtime: 'retained',
      runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
    });
    expect(result.reason).toContain(writerError);
    expectRetainedTrace(runFolder);
  });

  it('lets strict v2 opt-in override the rollback switch for supported fresh runs', async () => {
    const runFolder = join(runFolderBase, 'strict-beats-rollback-review');
    const restoreStrict = writeV2Runtime('1');
    const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
    const restoreCandidate = writeV2RuntimeCandidate(undefined);
    const restoreDisabled = writeDisableV2Runtime('1');
    const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
    let captured = '';
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      return true;
    }) as typeof process.stdout.write;
    try {
      const exit = await main(
        ['run', 'review', '--goal', 'strict opt-in beats rollback', '--run-folder', runFolder],
        {
          relayer: relayerWithBody(REVIEW_RELAY_BODY),
          now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
          runId: '89000000-0000-4000-8000-000000000001',
          configHomeDir: join(runFolderBase, 'empty-home'),
          configCwd: process.cwd(),
        },
      );
      expect(exit).toBe(0);
    } finally {
      process.stdout.write = origWrite;
      restoreAll([
        restoreStrict,
        restoreShowRuntimeDecision,
        restoreCandidate,
        restoreDisabled,
        restoreGeneratedMirrorRoot,
      ]);
    }

    const output = JSON.parse(captured) as Record<string, unknown>;
    expect(output).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'v2',
      runtime_reason: expect.stringContaining('v2 supports fresh review'),
    });
    expectV2Trace(runFolder);
  });

  it('fails closed when strict v2 opt-in is combined with composeWriter', async () => {
    const runFolder = join(runFolderBase, 'strict-compose-writer-rejected');
    const restoreStrict = writeV2Runtime('1');
    const restoreShowRuntimeDecision = writeShowRuntimeDecision(undefined);
    const restoreCandidate = writeV2RuntimeCandidate(undefined);
    const restoreDisabled = writeDisableV2Runtime(undefined);
    const restoreGeneratedMirrorRoot = writeGeneratedFlowMirrorRoot(undefined);
    let captured = '';
    const origWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      return true;
    }) as typeof process.stdout.write;
    try {
      await expect(
        main(
          ['run', 'review', '--goal', 'strict v2 with compose writer', '--run-folder', runFolder],
          {
            relayer: relayerWithBody(REVIEW_RELAY_BODY),
            composeWriter: () => undefined,
            now: deterministicNow(Date.UTC(2026, 4, 3, 20, 0, 0)),
            runId: '89000000-0000-4000-8000-000000000002',
            configHomeDir: join(runFolderBase, 'empty-home'),
            configCwd: process.cwd(),
          },
        ),
      ).rejects.toThrow(RUNTIME_POLICY_REASONS.composeWriter);
      expect(captured).toBe('');
    } finally {
      process.stdout.write = origWrite;
      restoreAll([
        restoreStrict,
        restoreShowRuntimeDecision,
        restoreCandidate,
        restoreDisabled,
        restoreGeneratedMirrorRoot,
      ]);
    }
    expect(existsSync(runFolder)).toBe(false);
  });

  it('routes only proven public flow modes through the default-routing candidate selector', async () => {
    const sharedProjectRoot = join(runFolderBase, 'candidate-project');
    mkdirSync(sharedProjectRoot, { recursive: true });
    writeFileSync(
      join(sharedProjectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const cases: Array<{
      readonly label: string;
      readonly argv: readonly string[];
      readonly relayer: RelayFn;
      readonly flowId: string;
      readonly entryMode?: string;
      readonly configCwd?: string;
    }> = [
      {
        label: 'review default',
        argv: [
          'run',
          'review',
          '--goal',
          'review through candidate routing',
          '--run-folder',
          join(runFolderBase, 'candidate-review'),
        ],
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        flowId: 'review',
      },
      {
        label: 'fix default',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix default through candidate routing',
          '--run-folder',
          join(runFolderBase, 'candidate-fix-default'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix lite',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix through candidate routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'candidate-fix-lite'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'lite',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix deep',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix deep through candidate routing',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'candidate-fix-deep'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'deep',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'fix autonomous',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix autonomous through candidate routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'candidate-fix-autonomous'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build default',
        argv: [
          'run',
          'build',
          '--goal',
          'build through candidate routing',
          '--run-folder',
          join(runFolderBase, 'candidate-build-default'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'build lite',
        argv: [
          'run',
          'build',
          '--goal',
          'build lite through candidate routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'candidate-build-lite'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        entryMode: 'lite',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'explore default',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore through candidate routing',
          '--run-folder',
          join(runFolderBase, 'candidate-explore'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
      },
      {
        label: 'explore lite',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore lite through candidate routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'candidate-explore-lite'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
        entryMode: 'lite',
      },
      {
        label: 'explore deep',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore deep through candidate routing',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'candidate-explore-deep'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
        entryMode: 'deep',
      },
      {
        label: 'explore autonomous',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore autonomous through candidate routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'candidate-explore-autonomous'),
        ],
        relayer: generatedExploreRelayer(),
        flowId: 'explore',
        entryMode: 'autonomous',
      },
      {
        label: 'migrate default',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate through candidate routing',
          '--run-folder',
          join(runFolderBase, 'candidate-migrate'),
        ],
        relayer: generatedMigrateRelayer(),
        flowId: 'migrate',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'migrate autonomous',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate autonomous through candidate routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'candidate-migrate-autonomous'),
        ],
        relayer: generatedMigrateRelayer(),
        flowId: 'migrate',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep default',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep through candidate routing',
          '--run-folder',
          join(runFolderBase, 'candidate-sweep'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep lite',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep lite through candidate routing',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'candidate-sweep-lite'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        entryMode: 'lite',
        configCwd: sharedProjectRoot,
      },
      {
        label: 'sweep autonomous',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep autonomous through candidate routing',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'candidate-sweep-autonomous'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        entryMode: 'autonomous',
        configCwd: sharedProjectRoot,
      },
    ];

    for (const candidate of cases) {
      const output = await runMainCandidateJson(candidate.argv, {
        relayer: candidate.relayer,
        ...(candidate.configCwd === undefined ? {} : { configCwd: candidate.configCwd }),
      });
      expect(output, candidate.label).toMatchObject({
        flow_id: candidate.flowId,
        outcome: 'complete',
        runtime: 'v2',
        runtime_reason: expect.stringContaining('v2 supports fresh'),
        ...(candidate.entryMode === undefined ? {} : { entry_mode: candidate.entryMode }),
      });
    }
  }, 30_000);

  it('smokes Build deep through the default v2 checkpoint path', async () => {
    const projectRoot = join(runFolderBase, 'default-build-deep-project');
    const runFolder = join(runFolderBase, 'default-build-deep-v2');
    mkdirSync(projectRoot, { recursive: true });
    mkdirSync(join(projectRoot, '.circuit'), { recursive: true });
    const projectRootReal = realpathSync.native(projectRoot);
    const projectRootCheckScript = `node -e 'if (process.cwd() !== ${JSON.stringify(
      projectRootReal,
    )}) process.exit(7)'`;
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify(
        {
          scripts: {
            check: projectRootCheckScript,
            verify: projectRootCheckScript,
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      join(projectRoot, '.circuit', 'config.yaml'),
      ['schema_version: 1', 'defaults:', '  selection:', '    effort: high', ''].join('\n'),
    );

    const baseRelayer = relayerWithBody('{"verdict":"accept"}');
    const resolvedSelections: unknown[] = [];
    const relayer: RelayFn = {
      connectorName: baseRelayer.connectorName,
      relay: async (input) => {
        resolvedSelections.push(input.resolvedSelection);
        return baseRelayer.relay(input);
      },
    };
    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'build',
        '--goal',
        'build deep should pause through default v2',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      { configCwd: projectRoot, relayer },
    );

    expect(output).toMatchObject({
      flow_id: 'build',
      entry_mode: 'deep',
      outcome: 'checkpoint_waiting',
      checkpoint: {
        step_id: 'frame-step',
        allowed_choices: ['continue'],
      },
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expect(traceEntryLog(runFolder)[0]).toMatchObject({ engine: 'core-v2' });
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(false);
    const brief = BuildBrief.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'build', 'brief.json'), 'utf8')),
    );
    expect(brief.checkpoint).toMatchObject({
      request_path: expect.stringContaining('frame-step-request.json'),
      allowed_choices: ['continue'],
    });
    const requestBody = JSON.parse(
      readFileSync(join(runFolder, 'reports', 'checkpoints', 'frame-step-request.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      schema_version: 1,
      step_id: 'frame-step',
      execution_context: {
        project_root: projectRoot,
      },
    });
    expect(
      (requestBody.execution_context as { selection_config_layers?: unknown[] })
        .selection_config_layers,
    ).toHaveLength(1);
    const parsedProgress = progress.map((event) => ProgressEvent.parse(event));
    expect(parsedProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'frame-step',
          allowed_choices: ['continue'],
        }),
        expect.objectContaining({
          type: 'user_input.requested',
          checkpoint: expect.objectContaining({
            step_id: 'frame-step',
            allowed_choices: ['continue'],
          }),
          resume: expect.objectContaining({
            checkpoint_choice_arg: '<choice>',
            command: expect.stringContaining('circuit-next resume'),
          }),
        }),
      ]),
    );
    const waitingStatus = await runRunsShowJson(runFolder);
    expect(waitingStatus).toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      checkpoint: {
        step_id: 'frame-step',
        choices: [expect.objectContaining({ value: 'continue' })],
      },
    });

    const { output: resumed, progress: resumeProgress } = await runMainDefaultJsonWithProgress(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      { configCwd: join(runFolderBase, 'wrong-resume-cwd'), relayer },
    );
    expect(resumed).toMatchObject({
      flow_id: 'build',
      outcome: 'complete',
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    const parsedResumeProgress = resumeProgress.map((event) => ProgressEvent.parse(event));
    expect(parsedResumeProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed' }),
      ]),
    );
    expect(resolvedSelections).toEqual(
      expect.arrayContaining([expect.objectContaining({ effort: 'high' })]),
    );
    const resultPath = resumed.result_path;
    expect(resultPath).toEqual(join(runFolder, 'reports', 'result.json'));
    RunResult.parse(JSON.parse(readFileSync(resultPath as string, 'utf8')));
    BuildResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'build-result.json'), 'utf8')),
    );
    const completedStatus = await runRunsShowJson(runFolder);
    expect(completedStatus).toMatchObject({
      engine_state: 'completed',
      reason: 'run_closed',
      legal_next_actions: ['inspect'],
    });
  });

  it('routes Build autonomous through the default v2 checkpoint auto-resolution path', async () => {
    const projectRoot = join(runFolderBase, 'default-build-autonomous-project');
    const runFolder = join(runFolderBase, 'default-build-autonomous-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'build',
        '--goal',
        'build autonomous should auto-resolve through default v2',
        '--mode',
        'autonomous',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      { configCwd: projectRoot, relayer: relayerWithBody('{"verdict":"accept"}') },
    );

    expect(output).toMatchObject({
      flow_id: 'build',
      entry_mode: 'autonomous',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);

    const responseBody = JSON.parse(
      readFileSync(join(runFolder, 'reports', 'checkpoints', 'frame-step-response.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      schema_version: 1,
      step_id: 'frame-step',
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'frame-step',
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-autonomous',
      response_path: 'reports/checkpoints/frame-step-response.json',
    });
    const progressEvents = progress.map((event) => ProgressEvent.parse(event));
    const progressTypes = progressEvents.map((event) => event.type);
    expect(progressTypes).not.toContain('checkpoint.waiting');
    expect(progressTypes).not.toContain('user_input.requested');
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      BuildResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'build-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'build',
      terminal_outcome: 'complete',
    });
  });

  it('routes Explore tournament checkpoint pause and resume through core-v2 by default', async () => {
    const runFolder = join(runFolderBase, 'default-explore-tournament-v2');
    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'explore',
        '--goal',
        'decide: React vs Vue',
        '--mode',
        'tournament',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      { relayer: tournamentRelayer() },
    );

    expect(output).toMatchObject({
      flow_id: 'explore',
      entry_mode: 'tournament',
      outcome: 'checkpoint_waiting',
      checkpoint: {
        step_id: 'tradeoff-checkpoint-step',
        allowed_choices: ['option-1', 'option-2', 'option-3', 'option-4'],
      },
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/checkpoints/tradeoff-response.json'))).toBe(false);

    const aggregate = ExploreTournamentAggregate.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'tournament-aggregate.json'), 'utf8')),
    );
    expect(aggregate.branch_count).toBe(4);
    expect(aggregate.branches.map((branch) => branch.branch_id).sort()).toEqual([
      'option-1',
      'option-2',
      'option-3',
      'option-4',
    ]);
    for (const branch of ['option-1', 'option-2', 'option-3', 'option-4']) {
      const branchDir = join(runFolder, 'reports', 'tournament-branches', branch);
      expect(existsSync(join(branchDir, 'request.txt'))).toBe(true);
      expect(existsSync(join(branchDir, 'request.json'))).toBe(false);
      expect(existsSync(join(branchDir, 'receipt.txt'))).toBe(true);
      expect(existsSync(join(branchDir, 'result.json'))).toBe(true);
      expect(existsSync(join(branchDir, 'report.json'))).toBe(true);
    }

    const progressEvents = progress.map((event) => ProgressEvent.parse(event));
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'tradeoff-checkpoint-step',
          allowed_choices: ['option-1', 'option-2', 'option-3', 'option-4'],
        }),
        expect.objectContaining({
          type: 'user_input.requested',
          questions: [
            expect.objectContaining({
              question: 'Choose ecosystem depth or iteration speed.',
              options: [
                expect.objectContaining({ label: 'React', checkpoint_choice: 'option-1' }),
                expect.objectContaining({ label: 'Vue', checkpoint_choice: 'option-2' }),
                expect.objectContaining({ label: 'Hybrid path', checkpoint_choice: 'option-3' }),
                expect.objectContaining({
                  label: 'Defer pending evidence',
                  checkpoint_choice: 'option-4',
                }),
              ],
            }),
          ],
        }),
      ]),
    );
    const waitingStatus = await runRunsShowJson(runFolder);
    expect(waitingStatus).toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      checkpoint: {
        step_id: 'tradeoff-checkpoint-step',
        prompt: 'Choose ecosystem depth or iteration speed.',
        choices: [
          { id: 'option-1', label: 'React', value: 'option-1' },
          { id: 'option-2', label: 'Vue', value: 'option-2' },
          { id: 'option-3', label: 'Hybrid path', value: 'option-3' },
          { id: 'option-4', label: 'Defer pending evidence', value: 'option-4' },
        ],
      },
    });

    const { output: resumed, progress: resumeProgress } = await runMainDefaultJsonWithProgress(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'option-2',
        '--progress',
        'jsonl',
      ],
      { relayer: tournamentRelayer() },
    );
    expect(resumed).toMatchObject({
      flow_id: 'explore',
      outcome: 'complete',
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    const response = JSON.parse(
      readFileSync(join(runFolder, 'reports', 'checkpoints', 'tradeoff-response.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(response).toMatchObject({
      selection: 'option-2',
      resolution_source: 'operator',
    });
    const decision = ExploreDecision.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'decision.json'), 'utf8')),
    );
    expect(decision.selected_option_id).toBe('option-2');
    const result = ExploreResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'explore-result.json'), 'utf8')),
    );
    expect(result.verdict_snapshot).toMatchObject({ selected_option_id: 'option-2' });
    RunResult.parse(JSON.parse(readFileSync(resumed.result_path as string, 'utf8')));
    const parsedResumeProgress = resumeProgress.map((event) => ProgressEvent.parse(event));
    expect(parsedResumeProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed' }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'explore',
      terminal_outcome: 'complete',
    });
  });

  it('routes Fix deep no-repro checkpoint pause and resume through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'default-fix-deep-project');
    const runFolder = join(runFolderBase, 'default-fix-deep-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'fix',
        '--goal',
        'fix deep should wait when reproduction is uncertain',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedFixRelayer(),
        v2Executors: { relay: forceFixDiagnoseAskRelayExecutor() },
      },
    );

    expect(output).toMatchObject({
      flow_id: 'fix',
      entry_mode: 'deep',
      outcome: 'checkpoint_waiting',
      checkpoint: {
        step_id: 'fix-no-repro-decision',
        allowed_choices: ['continue'],
      },
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(false);

    const requestBody = JSON.parse(
      readFileSync(
        join(runFolder, 'reports', 'checkpoints', 'fix-no-repro-decision-request.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      schema_version: 1,
      step_id: 'fix-no-repro-decision',
      allowed_choices: ['continue'],
      execution_context: {
        project_root: projectRoot,
      },
    });
    const parsedProgress = progress.map((event) => ProgressEvent.parse(event));
    expect(parsedProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'fix-no-repro-decision',
          allowed_choices: ['continue'],
        }),
        expect.objectContaining({
          type: 'user_input.requested',
          checkpoint: expect.objectContaining({
            step_id: 'fix-no-repro-decision',
            allowed_choices: ['continue'],
          }),
          resume: expect.objectContaining({
            checkpoint_choice_arg: '<choice>',
            command: expect.stringContaining('circuit-next resume'),
          }),
        }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      checkpoint: {
        step_id: 'fix-no-repro-decision',
        choices: [expect.objectContaining({ value: 'continue' })],
      },
    });

    const { output: resumed, progress: resumeProgress } = await runMainDefaultJsonWithProgress(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      { configCwd: join(runFolderBase, 'wrong-resume-cwd'), relayer: generatedFixRelayer() },
    );
    expect(resumed).toMatchObject({
      flow_id: 'fix',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'fix-no-repro-decision',
      selection: 'continue',
      auto_resolved: false,
      resolution_source: 'operator',
      response_path: 'reports/checkpoints/fix-no-repro-decision-response.json',
    });
    const parsedResumeProgress = resumeProgress.map((event) => ProgressEvent.parse(event));
    expect(parsedResumeProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      FixResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'fix-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'fix',
      terminal_outcome: 'complete',
    });
  });

  it('routes Fix autonomous through core-v2 by default and auto-resolves the no-repro checkpoint', async () => {
    const projectRoot = join(runFolderBase, 'default-fix-autonomous-project');
    const runFolder = join(runFolderBase, 'default-fix-autonomous-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'fix',
        '--goal',
        'fix autonomous should continue after uncertain reproduction',
        '--mode',
        'autonomous',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedFixRelayer(),
        v2Executors: { relay: forceFixDiagnoseAskRelayExecutor() },
      },
    );

    expect(output).toMatchObject({
      flow_id: 'fix',
      entry_mode: 'autonomous',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);

    const responseBody = JSON.parse(
      readFileSync(
        join(runFolder, 'reports', 'checkpoints', 'fix-no-repro-decision-response.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      schema_version: 1,
      step_id: 'fix-no-repro-decision',
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'fix-no-repro-decision',
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-autonomous',
      response_path: 'reports/checkpoints/fix-no-repro-decision-response.json',
    });
    const progressEvents = progress.map((event) => ProgressEvent.parse(event));
    const progressTypes = progressEvents.map((event) => event.type);
    expect(progressTypes).not.toContain('checkpoint.waiting');
    expect(progressTypes).not.toContain('user_input.requested');
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      FixResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'fix-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'fix',
      terminal_outcome: 'complete',
    });
  });

  it('routes Sweep lite through core-v2 by default and auto-resolves triage', async () => {
    const projectRoot = join(runFolderBase, 'default-sweep-lite-project');
    const runFolder = join(runFolderBase, 'default-sweep-lite-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'sweep',
        '--goal',
        'sweep lite should auto-resolve triage',
        '--mode',
        'lite',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedSweepRelayer(),
      },
    );

    expect(output).toMatchObject({
      flow_id: 'sweep',
      entry_mode: 'lite',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);

    const responseBody = JSON.parse(
      readFileSync(join(runFolder, 'reports', 'checkpoints', 'sweep-triage-response.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      schema_version: 1,
      step_id: 'triage-checkpoint-step',
      selection: 'continue',
      resolution_source: 'safe-default',
    });
    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'triage-checkpoint-step',
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-default',
      response_path: 'reports/checkpoints/sweep-triage-response.json',
    });
    const progressEvents = progress.map((event) => ProgressEvent.parse(event));
    const progressTypes = progressEvents.map((event) => event.type);
    expect(progressTypes).not.toContain('checkpoint.waiting');
    expect(progressTypes).not.toContain('user_input.requested');
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      SweepResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'sweep',
      terminal_outcome: 'complete',
    });
  });

  it('routes Sweep deep checkpoint pause and resume through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'default-sweep-deep-project');
    const runFolder = join(runFolderBase, 'default-sweep-deep-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'sweep',
        '--goal',
        'sweep deep should pause for triage',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedSweepRelayer(),
      },
    );

    expect(output).toMatchObject({
      flow_id: 'sweep',
      entry_mode: 'deep',
      outcome: 'checkpoint_waiting',
      checkpoint: {
        step_id: 'triage-checkpoint-step',
        allowed_choices: ['continue', 'revise', 'stop'],
      },
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(false);

    const requestBody = JSON.parse(
      readFileSync(join(runFolder, 'reports', 'checkpoints', 'sweep-triage-request.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      schema_version: 1,
      step_id: 'triage-checkpoint-step',
      allowed_choices: ['continue', 'revise', 'stop'],
      execution_context: {
        project_root: projectRoot,
      },
    });
    const parsedProgress = progress.map((event) => ProgressEvent.parse(event));
    expect(parsedProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'triage-checkpoint-step',
          allowed_choices: ['continue', 'revise', 'stop'],
        }),
        expect.objectContaining({
          type: 'user_input.requested',
          checkpoint: expect.objectContaining({
            step_id: 'triage-checkpoint-step',
            allowed_choices: ['continue', 'revise', 'stop'],
          }),
          resume: expect.objectContaining({
            checkpoint_choice_arg: '<choice>',
            command: expect.stringContaining('circuit-next resume'),
          }),
        }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      checkpoint: {
        step_id: 'triage-checkpoint-step',
        choices: [
          expect.objectContaining({ value: 'continue' }),
          expect.objectContaining({ value: 'revise' }),
          expect.objectContaining({ value: 'stop' }),
        ],
      },
    });

    const { output: resumed, progress: resumeProgress } = await runMainDefaultJsonWithProgress(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      { configCwd: join(runFolderBase, 'wrong-resume-cwd'), relayer: generatedSweepRelayer() },
    );
    expect(resumed).toMatchObject({
      flow_id: 'sweep',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    const parsedResumeProgress = resumeProgress.map((event) => ProgressEvent.parse(event));
    expect(parsedResumeProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      SweepResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'sweep',
      terminal_outcome: 'complete',
    });
  });

  it('routes Sweep autonomous through core-v2 by default and auto-resolves triage', async () => {
    const projectRoot = join(runFolderBase, 'default-sweep-autonomous-project');
    const runFolder = join(runFolderBase, 'default-sweep-autonomous-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'sweep',
        '--goal',
        'sweep autonomous should auto-resolve triage',
        '--mode',
        'autonomous',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedSweepRelayer(),
      },
    );

    expect(output).toMatchObject({
      flow_id: 'sweep',
      entry_mode: 'autonomous',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);

    const responseBody = JSON.parse(
      readFileSync(join(runFolder, 'reports', 'checkpoints', 'sweep-triage-response.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      schema_version: 1,
      step_id: 'triage-checkpoint-step',
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'triage-checkpoint-step',
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-autonomous',
      response_path: 'reports/checkpoints/sweep-triage-response.json',
    });
    const progressEvents = progress.map((event) => ProgressEvent.parse(event));
    const progressTypes = progressEvents.map((event) => event.type);
    expect(progressTypes).not.toContain('checkpoint.waiting');
    expect(progressTypes).not.toContain('user_input.requested');
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      SweepResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'sweep-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'sweep',
      terminal_outcome: 'complete',
    });
  });

  it('routes Migrate deep checkpoint pause and resume through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'default-migrate-deep-project');
    const runFolder = join(runFolderBase, 'default-migrate-deep-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'migrate',
        '--goal',
        'migrate deep should pause for coexistence review',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedMigrateRelayer(),
      },
    );

    expect(output).toMatchObject({
      flow_id: 'migrate',
      entry_mode: 'deep',
      outcome: 'checkpoint_waiting',
      checkpoint: {
        step_id: 'coexistence-checkpoint-step',
        allowed_choices: ['continue', 'revise', 'stop'],
      },
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(false);

    const requestBody = JSON.parse(
      readFileSync(
        join(runFolder, 'reports', 'checkpoints', 'migrate-coexistence-request.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(requestBody).toMatchObject({
      schema_version: 1,
      step_id: 'coexistence-checkpoint-step',
      allowed_choices: ['continue', 'revise', 'stop'],
      execution_context: {
        project_root: projectRoot,
      },
    });
    const parsedProgress = progress.map((event) => ProgressEvent.parse(event));
    expect(parsedProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'coexistence-checkpoint-step',
          allowed_choices: ['continue', 'revise', 'stop'],
        }),
        expect.objectContaining({
          type: 'user_input.requested',
          checkpoint: expect.objectContaining({
            step_id: 'coexistence-checkpoint-step',
            allowed_choices: ['continue', 'revise', 'stop'],
          }),
          resume: expect.objectContaining({
            checkpoint_choice_arg: '<choice>',
            command: expect.stringContaining('circuit-next resume'),
          }),
        }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
      checkpoint: {
        step_id: 'coexistence-checkpoint-step',
        choices: [
          expect.objectContaining({ value: 'continue' }),
          expect.objectContaining({ value: 'revise' }),
          expect.objectContaining({ value: 'stop' }),
        ],
      },
    });

    const { output: resumed, progress: resumeProgress } = await runMainDefaultJsonWithProgress(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      { configCwd: join(runFolderBase, 'wrong-resume-cwd'), relayer: generatedMigrateRelayer() },
    );
    expect(resumed).toMatchObject({
      flow_id: 'migrate',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();

    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'coexistence-checkpoint-step',
      selection: 'continue',
      auto_resolved: false,
      resolution_source: 'operator',
      response_path: 'reports/checkpoints/migrate-coexistence-response.json',
    });
    const subRunStarted = trace.find((entry) => entry.kind === 'sub_run.started');
    const childRunId = subRunStarted?.child_run_id;
    if (typeof childRunId !== 'string') {
      throw new Error('expected Migrate deep sub_run.started to record child_run_id');
    }
    expect(subRunStarted).toMatchObject({
      child_flow_id: 'build',
      child_entry_mode: 'default',
      child_depth: 'standard',
    });
    expect(trace.find((entry) => entry.kind === 'sub_run.completed')).toMatchObject({
      child_run_id: childRunId,
      child_outcome: 'complete',
      verdict: 'accept',
    });
    const childRunFolder = join(dirname(runFolder), childRunId);
    expectV2Trace(childRunFolder);
    expect(
      RunResult.parse(
        JSON.parse(readFileSync(join(childRunFolder, 'reports', 'result.json'), 'utf8')),
      ),
    ).toMatchObject({ flow_id: 'build', outcome: 'complete', verdict: 'accept' });
    const parsedResumeProgress = resumeProgress.map((event) => ProgressEvent.parse(event));
    expect(parsedResumeProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      MigrateResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'migrate',
      terminal_outcome: 'complete',
    });
  });

  it('routes Migrate autonomous through core-v2 by default and auto-resolves coexistence', async () => {
    const projectRoot = join(runFolderBase, 'default-migrate-autonomous-project');
    const runFolder = join(runFolderBase, 'default-migrate-autonomous-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainDefaultJsonWithProgress(
      [
        'run',
        'migrate',
        '--goal',
        'migrate autonomous should auto-resolve coexistence',
        '--mode',
        'autonomous',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        configCwd: projectRoot,
        relayer: generatedMigrateRelayer(),
      },
    );

    expect(output).toMatchObject({
      flow_id: 'migrate',
      entry_mode: 'autonomous',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(output.runtime).toBeUndefined();
    expect(output.runtime_reason).toBeUndefined();
    expectV2Trace(runFolder);

    const responseBody = JSON.parse(
      readFileSync(
        join(runFolder, 'reports', 'checkpoints', 'migrate-coexistence-response.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(responseBody).toMatchObject({
      schema_version: 1,
      step_id: 'coexistence-checkpoint-step',
      selection: 'continue',
      resolution_source: 'safe-autonomous',
    });
    const trace = traceEntryLog(runFolder);
    expect(trace.find((entry) => entry.kind === 'checkpoint.resolved')).toMatchObject({
      step_id: 'coexistence-checkpoint-step',
      selection: 'continue',
      auto_resolved: true,
      resolution_source: 'safe-autonomous',
      response_path: 'reports/checkpoints/migrate-coexistence-response.json',
    });
    const subRunStarted = trace.find((entry) => entry.kind === 'sub_run.started');
    const childRunId = subRunStarted?.child_run_id;
    if (typeof childRunId !== 'string') {
      throw new Error('expected Migrate autonomous sub_run.started to record child_run_id');
    }
    expect(subRunStarted).toMatchObject({
      child_flow_id: 'build',
      child_entry_mode: 'default',
      child_depth: 'standard',
    });
    expect(trace.find((entry) => entry.kind === 'sub_run.completed')).toMatchObject({
      child_run_id: childRunId,
      child_outcome: 'complete',
      verdict: 'accept',
    });
    const childRunFolder = join(dirname(runFolder), childRunId);
    expectV2Trace(childRunFolder);
    expect(
      RunResult.parse(
        JSON.parse(readFileSync(join(childRunFolder, 'reports', 'result.json'), 'utf8')),
      ),
    ).toMatchObject({ flow_id: 'build', outcome: 'complete', verdict: 'accept' });

    const progressEvents = progress.map((event) => ProgressEvent.parse(event));
    const progressTypes = progressEvents.map((event) => event.type);
    expect(progressTypes).not.toContain('checkpoint.waiting');
    expect(progressTypes).not.toContain('user_input.requested');
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'run.completed', outcome: 'complete' }),
      ]),
    );
    expect(
      MigrateResult.safeParse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'migrate-result.json'), 'utf8')),
      ).success,
    ).toBe(true);
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'migrate',
      terminal_outcome: 'complete',
    });
  });

  it('keeps arbitrary explicit fixtures on the retained runtime in candidate routing', async () => {
    const fixturePath = join(runFolderBase, 'fixtures', 'review-copy.json');
    const runFolder = join(runFolderBase, 'candidate-arbitrary-fixture-retained');
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      readFileSync(join(process.cwd(), 'generated', 'flows', 'review', 'circuit.json')),
    );

    const output = await runMainCandidateJson(
      [
        'run',
        'review',
        '--goal',
        'candidate arbitrary fixture should remain retained',
        '--fixture',
        fixturePath,
        '--run-folder',
        runFolder,
      ],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );

    expect(output).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
    expect(output.runtime_reason).toContain('CIRCUIT_V2_RUNTIME=1');
    expect(traceEntryLog(runFolder)[0]).toMatchObject({ schema_version: 1 });
  });

  it('allows generated-flow explicit fixtures through candidate routing', async () => {
    const projectRoot = join(runFolderBase, 'candidate-generated-fixture-project');
    const runFolder = join(runFolderBase, 'candidate-generated-fixture-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const output = await runMainCandidateJson(
      [
        'run',
        'fix',
        '--goal',
        'candidate generated fixture can route through v2',
        '--fixture',
        join(process.cwd(), 'generated', 'flows', 'fix', 'lite.json'),
        '--mode',
        'lite',
        '--run-folder',
        runFolder,
      ],
      { configCwd: projectRoot, relayer: generatedFixRelayer() },
    );

    expect(output).toMatchObject({
      flow_id: 'fix',
      entry_mode: 'lite',
      outcome: 'complete',
      runtime: 'v2',
    });
    expect(traceEntryLog(runFolder)[0]).toMatchObject({ engine: 'core-v2' });
  });

  it('trusts only wrapper-provenanced generated plugin mirrors for default v2 routing', async () => {
    const pluginFlowRoot = join(process.cwd(), 'plugins', 'circuit', 'flows');

    const untrustedRunFolder = join(runFolderBase, 'plugin-mirror-without-marker-retained');
    const untrusted = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'plugin mirror without marker remains retained',
        '--flow-root',
        pluginFlowRoot,
        '--run-folder',
        untrustedRunFolder,
      ],
      {
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(untrusted).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
    expectRetainedTrace(untrustedRunFolder);

    const trustedRunFolder = join(runFolderBase, 'plugin-mirror-with-marker-v2');
    const trusted = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'plugin mirror with matching marker routes v2',
        '--flow-root',
        pluginFlowRoot,
        '--run-folder',
        trustedRunFolder,
      ],
      {
        showRuntimeDecision: true,
        generatedMirrorRoot: pluginFlowRoot,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(trusted).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'v2',
      runtime_reason: expect.stringContaining('v2 supports fresh review'),
    });
    expectV2Trace(trustedRunFolder);

    const mismatchRunFolder = join(runFolderBase, 'plugin-mirror-marker-mismatch-retained');
    const mismatch = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'plugin mirror with mismatched marker remains retained',
        '--flow-root',
        pluginFlowRoot,
        '--run-folder',
        mismatchRunFolder,
      ],
      {
        showRuntimeDecision: true,
        generatedMirrorRoot: join(runFolderBase, 'not-the-plugin-flow-root'),
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(mismatch).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
    expectRetainedTrace(mismatchRunFolder);
  });

  it('keeps custom flow roots retained unless strict v2 is explicitly requested', async () => {
    const customFlowRoot = join(runFolderBase, 'custom-home', 'flows');
    mkdirSync(join(customFlowRoot, 'review'), { recursive: true });
    writeFileSync(
      join(customFlowRoot, 'review', 'circuit.json'),
      readFileSync(join(process.cwd(), 'generated', 'flows', 'review', 'circuit.json')),
    );

    const retainedRunFolder = join(runFolderBase, 'custom-flow-root-retained');
    const retained = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'custom flow root remains retained',
        '--flow-root',
        customFlowRoot,
        '--run-folder',
        retainedRunFolder,
      ],
      {
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(retained).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
    expect(retained.runtime_reason).toContain('CIRCUIT_V2_RUNTIME=1');
    expectRetainedTrace(retainedRunFolder);

    const strictRunFolder = join(runFolderBase, 'custom-flow-root-strict-v2');
    const strict = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'custom flow root strict v2 experiment',
        '--flow-root',
        customFlowRoot,
        '--run-folder',
        strictRunFolder,
      ],
      {
        strict: true,
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(strict).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'v2',
      runtime_reason: expect.stringContaining('v2 supports fresh review'),
    });
    expectV2Trace(strictRunFolder);
  });

  it('keeps rollback ahead of trusted generated plugin mirrors', async () => {
    const pluginFlowRoot = join(process.cwd(), 'plugins', 'circuit', 'flows');
    const runFolder = join(runFolderBase, 'trusted-plugin-mirror-rollback-retained');
    const output = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'trusted plugin mirror rollback remains retained',
        '--flow-root',
        pluginFlowRoot,
        '--run-folder',
        runFolder,
      ],
      {
        showRuntimeDecision: true,
        rollback: true,
        generatedMirrorRoot: pluginFlowRoot,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(output).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
    });
    expectRetainedTrace(runFolder);
  });

  it('shows runtime decisions with the preferred diagnostics flag', async () => {
    const projectRoot = join(runFolderBase, 'show-runtime-decision-project');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const supportedRunFolder = join(runFolderBase, 'show-runtime-decision-review');
    const supported = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'show runtime decision for review',
        '--run-folder',
        supportedRunFolder,
      ],
      {
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(supported).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'v2',
      runtime_reason: expect.stringContaining('v2 supports fresh review'),
    });
    expectV2Trace(supportedRunFolder);

    const arbitraryFixture = join(runFolderBase, 'show-runtime-fixtures', 'review-copy.json');
    mkdirSync(dirname(arbitraryFixture), { recursive: true });
    writeFileSync(
      arbitraryFixture,
      readFileSync(join(process.cwd(), 'generated', 'flows', 'review', 'circuit.json')),
    );
    const unsupportedRunFolder = join(runFolderBase, 'show-runtime-decision-arbitrary-fixture');
    const unsupported = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'show runtime decision for retained arbitrary fixture',
        '--fixture',
        arbitraryFixture,
        '--run-folder',
        unsupportedRunFolder,
      ],
      {
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        configCwd: projectRoot,
      },
    );
    expect(unsupported).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: RUNTIME_POLICY_REASONS.externalFixtureOrRoot,
    });
    expectRetainedTrace(unsupportedRunFolder);
  });

  it('keeps the candidate env var as a runtime decision diagnostics alias', async () => {
    const preferredRunFolder = join(runFolderBase, 'preferred-runtime-decision-review');
    const preferred = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'preferred runtime diagnostics flag',
        '--run-folder',
        preferredRunFolder,
      ],
      {
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    const aliasRunFolder = join(runFolderBase, 'alias-runtime-decision-review');
    const alias = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'candidate alias runtime diagnostics flag',
        '--run-folder',
        aliasRunFolder,
      ],
      {
        candidateAlias: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    const bothRunFolder = join(runFolderBase, 'both-runtime-decision-review');
    const both = await runMainRuntimeDecisionJson(
      ['run', 'review', '--goal', 'both runtime diagnostics flags', '--run-folder', bothRunFolder],
      {
        showRuntimeDecision: true,
        candidateAlias: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );

    for (const output of [preferred, alias, both]) {
      expect(output).toMatchObject({
        flow_id: 'review',
        outcome: 'complete',
        runtime: 'v2',
        runtime_reason: expect.stringContaining('v2 supports fresh review'),
      });
    }
    expectV2Trace(preferredRunFolder);
    expectV2Trace(aliasRunFolder);
    expectV2Trace(bothRunFolder);
  });

  it('reports rollback as the runtime reason when diagnostics and rollback are both set', async () => {
    const supportedRunFolder = join(runFolderBase, 'diagnostics-rollback-review');
    const supported = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'diagnostics plus rollback for review',
        '--run-folder',
        supportedRunFolder,
      ],
      {
        showRuntimeDecision: true,
        rollback: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(supported).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
    });
    expectRetainedTrace(supportedRunFolder);

    const composeRunFolder = join(runFolderBase, 'diagnostics-rollback-compose-writer');
    const writerError = 'diagnostics rollback composeWriter retained proof';
    const composeOutput = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'diagnostics plus rollback plus compose writer',
        '--run-folder',
        composeRunFolder,
      ],
      {
        showRuntimeDecision: true,
        rollback: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        composeWriter: () => {
          throw new Error(writerError);
        },
      },
    );
    const composeResult = RunResult.parse(
      JSON.parse(readFileSync(join(composeRunFolder, 'reports', 'result.json'), 'utf8')),
    );
    expect(composeOutput).toMatchObject({
      flow_id: 'review',
      outcome: 'aborted',
      runtime: 'retained',
      runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
    });
    expect(composeResult.reason).toContain(writerError);
    expectRetainedTrace(composeRunFolder);

    const fixturePath = join(runFolderBase, 'fixtures', 'diagnostics-rollback-review-copy.json');
    const fixtureRunFolder = join(runFolderBase, 'diagnostics-rollback-arbitrary-fixture');
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(
      fixturePath,
      readFileSync(join(process.cwd(), 'generated', 'flows', 'review', 'circuit.json')),
    );
    const fixtureOutput = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'diagnostics plus rollback plus arbitrary fixture',
        '--fixture',
        fixturePath,
        '--run-folder',
        fixtureRunFolder,
      ],
      {
        showRuntimeDecision: true,
        rollback: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(fixtureOutput).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'retained',
      runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
    });
    expectRetainedTrace(fixtureRunFolder);
  });

  it('keeps strict v2 ahead of rollback when runtime diagnostics are enabled', async () => {
    const runFolder = join(runFolderBase, 'diagnostics-strict-beats-rollback');
    const output = await runMainRuntimeDecisionJson(
      [
        'run',
        'review',
        '--goal',
        'strict beats rollback with diagnostics',
        '--run-folder',
        runFolder,
      ],
      {
        strict: true,
        rollback: true,
        showRuntimeDecision: true,
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );

    expect(output).toMatchObject({
      flow_id: 'review',
      outcome: 'complete',
      runtime: 'v2',
      runtime_reason: expect.stringContaining('v2 supports fresh review'),
    });
    expectV2Trace(runFolder);
  });

  it('reports saved-engine runtime when resume diagnostics are enabled', async () => {
    const projectRoot = join(runFolderBase, 'diagnostics-resume-project');
    const runFolder = join(runFolderBase, 'diagnostics-resume-build-deep');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );
    await runMainDefaultJson(
      [
        'run',
        'build',
        '--goal',
        'pause before runtime decision resume diagnostics',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
      ],
      {
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: projectRoot,
      },
    );

    const resumed = await runMainRuntimeDecisionJson(
      ['resume', '--run-folder', runFolder, '--checkpoint-choice', 'continue'],
      {
        showRuntimeDecision: true,
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: projectRoot,
      },
    );

    expect(resumed).toMatchObject({
      flow_id: 'build',
      outcome: 'complete',
      runtime: 'v2',
      runtime_reason: 'checkpoint resume follows the saved core-v2 run folder engine marker',
    });
  });

  it('projects completed, aborted, and child-run v2 folders through runs show', async () => {
    const reviewRunFolder = join(runFolderBase, 'status-review-v2');
    await runMainCandidateJson(
      ['run', 'review', '--goal', 'status review complete', '--run-folder', reviewRunFolder],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );
    await expect(runRunsShowJson(reviewRunFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      run_folder: reviewRunFolder,
      flow_id: 'review',
      terminal_outcome: 'complete',
      result_path: `${reviewRunFolder}/reports/result.json`,
    });

    const configCwd = join(runFolderBase, 'status-aborted-config');
    const abortedRunFolder = join(runFolderBase, 'status-build-aborted-v2');
    mkdirSync(join(configCwd, '.circuit'), { recursive: true });
    writeFileSync(
      join(configCwd, '.circuit', 'config.yaml'),
      ['schema_version: 1', 'relay:', '  default: codex', ''].join('\n'),
    );
    await runMainCandidateJson(
      [
        'run',
        'build',
        '--goal',
        'status build aborted',
        '--mode',
        'lite',
        '--run-folder',
        abortedRunFolder,
      ],
      { configCwd, relayer: relayerWithBody(BUILD_IMPLEMENTATION_BODY, 'codex') },
    );
    await expect(runRunsShowJson(abortedRunFolder)).resolves.toMatchObject({
      engine_state: 'aborted',
      flow_id: 'build',
      terminal_outcome: 'aborted',
      result_path: `${abortedRunFolder}/reports/result.json`,
    });

    const projectRoot = join(runFolderBase, 'status-migrate-project');
    const migrateRunFolder = join(runFolderBase, 'status-migrate-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );
    await runMainCandidateJson(
      ['run', 'migrate', '--goal', 'status migrate child', '--run-folder', migrateRunFolder],
      { configCwd: projectRoot, relayer: generatedMigrateRelayer() },
    );
    const subRunStarted = traceEntryLog(migrateRunFolder).find(
      (entry) => entry.kind === 'sub_run.started',
    );
    const childRunId = subRunStarted?.child_run_id;
    if (typeof childRunId !== 'string') {
      throw new Error('expected child run id for v2 status projection test');
    }
    const childRunFolder = join(dirname(migrateRunFolder), childRunId);
    await expect(runRunsShowJson(migrateRunFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'migrate',
      terminal_outcome: 'complete',
    });
    await expect(runRunsShowJson(childRunFolder)).resolves.toMatchObject({
      engine_state: 'completed',
      flow_id: 'build',
      terminal_outcome: 'complete',
    });
  });

  it('streams parent and child progress for candidate Migrate runs', async () => {
    const projectRoot = join(runFolderBase, 'migrate-progress-project');
    const runFolder = join(runFolderBase, 'migrate-progress-v2');
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({ scripts: { check: 'node -e "process.exit(0)"' } }, null, 2)}\n`,
    );

    const { output, progress } = await runMainCandidateJsonWithProgress(
      [
        'run',
        'migrate',
        '--goal',
        'Migrate with nested progress',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      { configCwd: projectRoot, relayer: generatedMigrateRelayer() },
    );
    const progressEvents = progress as Array<Record<string, unknown>>;
    const startedRuns = progressEvents.filter((event) => event.type === 'run.started');
    const completedRuns = progressEvents.filter((event) => event.type === 'run.completed');

    expect(output).toMatchObject({ flow_id: 'migrate', outcome: 'complete', runtime: 'v2' });
    expect(startedRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flow_id: 'migrate' }),
        expect.objectContaining({ flow_id: 'build' }),
      ]),
    );
    expect(completedRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flow_id: 'build', outcome: 'complete' }),
        expect.objectContaining({ flow_id: 'migrate', outcome: 'complete' }),
      ]),
    );
    expect(new Set(startedRuns.map((event) => event.run_id)).size).toBeGreaterThanOrEqual(2);
  });

  it('streams fanout progress for a dedicated strict opt-in CLI fanout fixture', async () => {
    const projectRoot = join(runFolderBase, 'fanout-progress-project');
    const connectorScript = join(projectRoot, 'connectors', 'fanout-reviewer.cjs');
    const fixturePath = join(runFolderBase, 'fixtures', 'fanout-sweep.json');
    const runFolder = join(runFolderBase, 'fanout-progress-v2');
    writeFanoutCustomConnectorScript(connectorScript);
    writeCustomConnectorConfigWithCommand(join(projectRoot, '.circuit'), [
      process.execPath,
      connectorScript,
    ]);
    writeCliFanoutFixture(fixturePath);

    const { output, progress } = await runMainV2JsonWithProgress(
      [
        'run',
        'sweep',
        '--goal',
        'Fanout progress candidate fixture',
        '--fixture',
        fixturePath,
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      { configCwd: projectRoot },
    );
    const progressEvents = progress as Array<Record<string, unknown>>;
    const aggregate = ExploreTournamentAggregate.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'fanout', 'aggregate.json'), 'utf8')),
    );
    const proposal = ExploreTournamentProposal.parse(
      JSON.parse(
        readFileSync(
          join(runFolder, 'reports', 'fanout', 'branches', 'option-1', 'report.json'),
          'utf8',
        ),
      ),
    );

    expect(output).toMatchObject({ flow_id: 'sweep', outcome: 'complete', runtime: 'v2' });
    expect(aggregate).toMatchObject({
      schema_version: 1,
      join_policy: 'aggregate-only',
      branch_count: 1,
    });
    expect(proposal).toMatchObject({ verdict: 'accept', option_id: 'option-1' });
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'fanout.started',
          step_id: 'fanout-step',
          branch_count: 1,
          branch_ids: ['option-1'],
        }),
        expect.objectContaining({
          type: 'fanout.branch_started',
          step_id: 'fanout-step',
          branch_id: 'option-1',
          branch_kind: 'relay',
        }),
        expect.objectContaining({
          type: 'fanout.branch_completed',
          step_id: 'fanout-step',
          branch_id: 'option-1',
          branch_kind: 'relay',
          child_outcome: 'complete',
          verdict: 'accept',
        }),
        expect.objectContaining({
          type: 'fanout.joined',
          step_id: 'fanout-step',
          policy: 'aggregate-only',
          aggregate_path: 'reports/fanout/aggregate.json',
          branches_completed: 1,
          branches_failed: 0,
        }),
      ]),
    );
  });
});
