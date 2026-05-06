import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../../src/cli/circuit.js';
import type { ComposeWriterFn } from '../../src/compat/retained-runtime.js';
import {
  ExploreDecision,
  ExploreResult,
  ExploreTournamentAggregate,
  ExploreTournamentProposal,
} from '../../src/flows/explore/reports.js';
import { ReviewRelayResult, ReviewResult } from '../../src/flows/review/reports.js';
import { ManifestSnapshot } from '../../src/schemas/manifest.js';
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
  subject: 'Explore v2 soak',
  recommendation: 'Proceed with the selector soak.',
  success_condition_alignment: 'The generated Explore default flow reaches close.',
  supporting_aspects: [
    {
      aspect: 'selector soak',
      contribution: 'The generated Explore manifest ran through default v2 executors.',
      evidence_refs: ['generated/flows/explore/circuit.json'],
    },
  ],
});
const EXPLORE_REVIEW_BODY = JSON.stringify({
  verdict: 'accept',
  overall_assessment: 'No blocking concern in the selector soak.',
  objections: [],
  missed_angles: [],
});
const FANOUT_PROPOSAL_BODY = JSON.stringify({
  verdict: 'accept',
  option_id: 'option-1',
  option_label: 'First option',
  case_summary: 'The fanout branch produced a deterministic proposal.',
  assumptions: ['The dedicated soak fixture keeps one branch for stable progress evidence.'],
  evidence_refs: ['fanout-progress-fixture'],
  risks: [],
  next_action: 'Admit the branch and join the aggregate.',
});
const MIGRATE_INVENTORY_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Inventory produced by the v2 soak.',
  items: [
    {
      id: 'item-1',
      path: 'src/example.ts',
      category: 'source-file',
      description: 'Representative migration target for the v2 soak.',
    },
  ],
  batches: [
    {
      id: 'batch-1',
      title: 'Primary migration batch',
      item_ids: ['item-1'],
      rationale: 'Single-batch soak coverage keeps the child run deterministic.',
    },
  ],
});
const MIGRATE_REVIEW_BODY = JSON.stringify({
  verdict: 'cutover-approved',
  summary: 'Cutover review approved in the v2 soak.',
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
      description: 'Representative cleanup target for the v2 soak.',
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
  observations: ['The generated Fix v2 soak gathered enough context.'],
  open_questions: [],
});
const FIX_DIAGNOSIS_BODY = JSON.stringify({
  verdict: 'accept',
  reproduction_status: 'not-attempted',
  cause_summary: 'Synthetic diagnosis for v2 soak.',
  confidence: 'medium',
  evidence: ['The generated Fix manifest reached diagnosis.'],
  residual_uncertainty: ['No live reproduction was attempted in the soak test.'],
});
const FIX_CHANGE_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Applied a synthetic Fix change for v2 soak.',
  diagnosis_ref: 'reports/fix/diagnosis.json',
  changed_files: ['src/example.ts'],
  evidence: ['Stub Fix change relay completed.'],
});
const FIX_REVIEW_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Generated Fix soak review accepted the change.',
  findings: [],
});

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = join(tmpdir(), `circuit-next-v2-soak-${randomUUID()}`);
  mkdirSync(runFolderBase, { recursive: true });
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function setEnv(name: string, value: string | undefined): () => void {
  const existed = Object.prototype.hasOwnProperty.call(process.env, name);
  const original = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  return () => {
    if (existed) {
      process.env[name] = original;
    } else {
      delete process.env[name];
    }
  };
}

function restoreAll(restorers: readonly (() => void)[]): void {
  for (const restore of [...restorers].reverse()) restore();
}

function traceEntries(runFolder: string): Array<Record<string, unknown>> {
  return readFileSync(join(runFolder, 'trace.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function expectV2Trace(runFolder: string): void {
  expect(traceEntries(runFolder)[0]).toMatchObject({ engine: 'core-v2' });
}

function expectRetainedTrace(runFolder: string): void {
  const first = traceEntries(runFolder)[0];
  expect(first).toMatchObject({ schema_version: 1 });
  expect(first).not.toMatchObject({ engine: 'core-v2' });
}

function writeProjectPackage(root: string): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify(
      { scripts: { check: 'node -e "process.exit(0)"', verify: 'node -e "process.exit(0)"' } },
      null,
      2,
    )}\n`,
  );
}

function relayerWithBody(body: string, connectorName = 'claude-code'): RelayFn {
  return {
    connectorName,
    relay: async (input: RelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: `stub-v2-soak-${connectorName}`,
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
        receipt_id: 'stub-v2-soak-fix',
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
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
        receipt_id: 'stub-v2-soak-explore',
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
        risks: ['The soak fixture only covers synthetic decision evidence.'],
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
        receipt_id: 'stub-v2-soak-migrate',
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
        receipt_id: 'stub-v2-soak-sweep',
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function writeCustomConnectorConfig(baseDir: string, command: readonly string[]): void {
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

function writeFanoutFixture(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schema_version: '2',
        id: 'sweep',
        version: '0.1.0',
        purpose: 'Dedicated v2 soak fanout progress fixture.',
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
          rationale: 'Dedicated v2 soak fixture keeps only the fanout step.',
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

async function runMainJson(
  argv: readonly string[],
  options: {
    readonly mode?: 'default' | 'strict' | 'rollback' | 'strict-plus-rollback';
    readonly relayer?: RelayFn;
    readonly composeWriter?: ComposeWriterFn;
    readonly configCwd?: string;
    readonly configHomeDir?: string;
    readonly runId?: string;
  } = {},
): Promise<{
  readonly output: Record<string, unknown>;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const mode = options.mode ?? 'default';
  const restorers = [
    setEnv(
      'CIRCUIT_V2_RUNTIME',
      mode === 'strict' || mode === 'strict-plus-rollback' ? '1' : undefined,
    ),
    setEnv('CIRCUIT_SHOW_RUNTIME_DECISION', undefined),
    setEnv('CIRCUIT_V2_RUNTIME_CANDIDATE', undefined),
    setEnv('CIRCUIT_GENERATED_FLOW_MIRROR_ROOT', undefined),
    setEnv(
      'CIRCUIT_DISABLE_V2_RUNTIME',
      mode === 'rollback' || mode === 'strict-plus-rollback' ? '1' : undefined,
    ),
  ];
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
      ...(options.composeWriter === undefined ? {} : { composeWriter: options.composeWriter }),
      now: deterministicNow(Date.UTC(2026, 4, 5, 12, 0, 0)),
      runId: options.runId ?? `90000000-0000-4000-8000-${randomUUID().slice(24)}`,
      configHomeDir: options.configHomeDir ?? join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    restoreAll(restorers);
  }

  const parsed: unknown = JSON.parse(stdout);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return { output: parsed as Record<string, unknown>, stdout, stderr };
}

async function expectMainRejects(
  argv: readonly string[],
  message: RegExp,
  options: {
    readonly mode?: 'default' | 'strict' | 'rollback' | 'strict-plus-rollback';
    readonly relayer?: RelayFn;
    readonly configCwd?: string;
  } = {},
): Promise<void> {
  const mode = options.mode ?? 'strict';
  const restorers = [
    setEnv(
      'CIRCUIT_V2_RUNTIME',
      mode === 'strict' || mode === 'strict-plus-rollback' ? '1' : undefined,
    ),
    setEnv('CIRCUIT_SHOW_RUNTIME_DECISION', undefined),
    setEnv('CIRCUIT_V2_RUNTIME_CANDIDATE', undefined),
    setEnv('CIRCUIT_GENERATED_FLOW_MIRROR_ROOT', undefined),
    setEnv(
      'CIRCUIT_DISABLE_V2_RUNTIME',
      mode === 'rollback' || mode === 'strict-plus-rollback' ? '1' : undefined,
    ),
  ];
  let stdout = '';
  const origStdoutWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    await expect(
      main(argv, {
        ...(options.relayer === undefined ? {} : { relayer: options.relayer }),
        now: deterministicNow(Date.UTC(2026, 4, 5, 12, 0, 0)),
        runId: `91000000-0000-4000-8000-${randomUUID().slice(24)}`,
        configHomeDir: join(runFolderBase, 'empty-home'),
        configCwd: options.configCwd ?? process.cwd(),
      }),
    ).rejects.toThrow(message);
    expect(stdout).toBe('');
  } finally {
    process.stdout.write = origStdoutWrite;
    restoreAll(restorers);
  }
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

function parseProgress(stderr: string): ProgressEvent[] {
  return stderr
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ProgressEvent.parse(JSON.parse(line)));
}

async function expectV2RunConsistency(
  runFolder: string,
  flowId: string,
  options: { readonly expectOperatorSummary?: boolean } = {},
): Promise<void> {
  const entries = traceEntries(runFolder);
  const bootstrap = entries[0];
  const closed = entries.at(-1);
  const snapshot = ManifestSnapshot.parse(
    JSON.parse(readFileSync(join(runFolder, 'manifest.snapshot.json'), 'utf8')),
  );
  const resultPath = join(runFolder, 'reports', 'result.json');
  const result = RunResult.parse(JSON.parse(readFileSync(resultPath, 'utf8')));
  const status = await runRunsShowJson(runFolder);

  expect(bootstrap).toMatchObject({
    kind: 'run.bootstrapped',
    engine: 'core-v2',
    flow_id: flowId,
    manifest_hash: snapshot.hash,
  });
  expect(closed).toMatchObject({ kind: 'run.closed' });
  expect(result).toMatchObject({
    flow_id: flowId,
    outcome: 'complete',
    manifest_hash: snapshot.hash,
    trace_entries_observed: entries.length,
  });
  expect(status).toMatchObject({
    engine_state: 'completed',
    flow_id: flowId,
    terminal_outcome: 'complete',
    result_path: resultPath,
  });
  if (options.expectOperatorSummary ?? true) {
    expect(existsSync(join(runFolder, 'reports', 'operator-summary.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports', 'operator-summary.md'))).toBe(true);
  }
}

describe('v2 selector soak', () => {
  it('routes every matrix-supported fresh run through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'matrix-project');
    writeProjectPackage(projectRoot);
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
          'review through selector soak',
          '--run-folder',
          join(runFolderBase, 'matrix-review'),
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
          'fix default through selector soak',
          '--run-folder',
          join(runFolderBase, 'matrix-fix-default'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        configCwd: projectRoot,
      },
      {
        label: 'fix lite',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix lite through selector soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'matrix-fix-lite'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'lite',
        configCwd: projectRoot,
      },
      {
        label: 'fix deep',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix deep through selector soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'matrix-fix-deep'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'deep',
        configCwd: projectRoot,
      },
      {
        label: 'fix autonomous',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix autonomous through selector soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'matrix-fix-autonomous'),
        ],
        relayer: generatedFixRelayer(),
        flowId: 'fix',
        entryMode: 'autonomous',
        configCwd: projectRoot,
      },
      {
        label: 'build default',
        argv: [
          'run',
          'build',
          '--goal',
          'build through selector soak',
          '--run-folder',
          join(runFolderBase, 'matrix-build-default'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        configCwd: projectRoot,
      },
      {
        label: 'build lite',
        argv: [
          'run',
          'build',
          '--goal',
          'build lite through selector soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'matrix-build-lite'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        entryMode: 'lite',
        configCwd: projectRoot,
      },
      {
        label: 'build autonomous',
        argv: [
          'run',
          'build',
          '--goal',
          'build autonomous through selector soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'matrix-build-autonomous'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
        flowId: 'build',
        entryMode: 'autonomous',
        configCwd: projectRoot,
      },
      {
        label: 'explore default',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore through selector soak',
          '--run-folder',
          join(runFolderBase, 'matrix-explore'),
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
          'explore lite through selector soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'matrix-explore-lite'),
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
          'explore deep through selector soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'matrix-explore-deep'),
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
          'explore autonomous through selector soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'matrix-explore-autonomous'),
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
          'migrate through selector soak',
          '--run-folder',
          join(runFolderBase, 'matrix-migrate'),
        ],
        relayer: generatedMigrateRelayer(),
        flowId: 'migrate',
        configCwd: projectRoot,
      },
      {
        label: 'migrate autonomous',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate autonomous through selector soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'matrix-migrate-autonomous'),
        ],
        relayer: generatedMigrateRelayer(),
        flowId: 'migrate',
        entryMode: 'autonomous',
        configCwd: projectRoot,
      },
      {
        label: 'sweep default',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep through selector soak',
          '--run-folder',
          join(runFolderBase, 'matrix-sweep'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        configCwd: projectRoot,
      },
      {
        label: 'sweep lite',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep lite through selector soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'matrix-sweep-lite'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        entryMode: 'lite',
        configCwd: projectRoot,
      },
      {
        label: 'sweep autonomous',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep autonomous through selector soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'matrix-sweep-autonomous'),
        ],
        relayer: generatedSweepRelayer(),
        flowId: 'sweep',
        entryMode: 'autonomous',
        configCwd: projectRoot,
      },
    ];

    for (const candidate of cases) {
      const { output } = await runMainJson(candidate.argv, {
        relayer: candidate.relayer,
        ...(candidate.configCwd === undefined ? {} : { configCwd: candidate.configCwd }),
      });
      const runFolder = output.run_folder;
      expect(runFolder, candidate.label).toEqual(expect.any(String));
      expect(output, candidate.label).toMatchObject({
        flow_id: candidate.flowId,
        outcome: 'complete',
        ...(candidate.entryMode === undefined ? {} : { entry_mode: candidate.entryMode }),
      });
      expect(output.runtime, candidate.label).toBeUndefined();
      expect(output.runtime_reason, candidate.label).toBeUndefined();
      expectV2Trace(runFolder as string);
      await expectV2RunConsistency(runFolder as string, candidate.flowId);
    }
  }, 30_000);

  it('routes Build deep checkpoint pause and resume through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'matrix-build-deep-project');
    writeProjectPackage(projectRoot);
    const runFolder = join(runFolderBase, 'matrix-build-deep');

    const { output, stderr } = await runMainJson(
      [
        'run',
        'build',
        '--goal',
        'build deep checkpoint default soak',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: projectRoot,
      },
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
    expectV2Trace(runFolder);
    expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(false);
    expect(parseProgress(stderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'checkpoint.waiting', step_id: 'frame-step' }),
        expect.objectContaining({ type: 'user_input.requested' }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
    });

    const { output: resumed, stderr: resumeStderr } = await runMainJson(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      {
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: join(runFolderBase, 'wrong-resume-cwd'),
      },
    );
    expect(resumed).toMatchObject({
      flow_id: 'build',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    expect(parseProgress(resumeStderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed' }),
      ]),
    );
    await expectV2RunConsistency(runFolder, 'build');
  });

  it('routes Explore tournament checkpoint pause and resume through core-v2 by default', async () => {
    const runFolder = join(runFolderBase, 'matrix-explore-tournament');

    const { output, stderr } = await runMainJson(
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
    const aggregate = ExploreTournamentAggregate.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'tournament-aggregate.json'), 'utf8')),
    );
    expect(aggregate.branch_count).toBe(4);
    expect(parseProgress(stderr)).toEqual(
      expect.arrayContaining([
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
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      checkpoint: {
        prompt: 'Choose ecosystem depth or iteration speed.',
        choices: [
          { id: 'option-1', label: 'React', value: 'option-1' },
          { id: 'option-2', label: 'Vue', value: 'option-2' },
          { id: 'option-3', label: 'Hybrid path', value: 'option-3' },
          { id: 'option-4', label: 'Defer pending evidence', value: 'option-4' },
        ],
      },
    });

    const { output: resumed, stderr: resumeStderr } = await runMainJson(
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
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    const decision = ExploreDecision.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'decision.json'), 'utf8')),
    );
    expect(decision.selected_option_id).toBe('option-2');
    const result = ExploreResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'explore-result.json'), 'utf8')),
    );
    expect(result.verdict_snapshot).toMatchObject({ selected_option_id: 'option-2' });
    expect(parseProgress(resumeStderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed', flow_id: 'explore' }),
      ]),
    );
    await expectV2RunConsistency(runFolder, 'explore');
  });

  it('routes Sweep deep checkpoint pause and resume through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'matrix-sweep-deep-project');
    writeProjectPackage(projectRoot);
    const runFolder = join(runFolderBase, 'matrix-sweep-deep');

    const { output, stderr } = await runMainJson(
      [
        'run',
        'sweep',
        '--goal',
        'sweep deep checkpoint default soak',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        relayer: generatedSweepRelayer(),
        configCwd: projectRoot,
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
    expect(parseProgress(stderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'triage-checkpoint-step',
        }),
        expect.objectContaining({ type: 'user_input.requested' }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
    });

    const { output: resumed, stderr: resumeStderr } = await runMainJson(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      {
        relayer: generatedSweepRelayer(),
        configCwd: join(runFolderBase, 'wrong-resume-cwd'),
      },
    );
    expect(resumed).toMatchObject({
      flow_id: 'sweep',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    expect(parseProgress(resumeStderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed', flow_id: 'sweep' }),
      ]),
    );
    await expectV2RunConsistency(runFolder, 'sweep');
  });

  it('routes Migrate deep checkpoint pause and resume through core-v2 by default', async () => {
    const projectRoot = join(runFolderBase, 'matrix-migrate-deep-project');
    writeProjectPackage(projectRoot);
    const runFolder = join(runFolderBase, 'matrix-migrate-deep');

    const { output, stderr } = await runMainJson(
      [
        'run',
        'migrate',
        '--goal',
        'migrate deep checkpoint default soak',
        '--mode',
        'deep',
        '--run-folder',
        runFolder,
        '--progress',
        'jsonl',
      ],
      {
        relayer: generatedMigrateRelayer(),
        configCwd: projectRoot,
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
    expect(parseProgress(stderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'checkpoint.waiting',
          step_id: 'coexistence-checkpoint-step',
        }),
        expect.objectContaining({ type: 'user_input.requested' }),
      ]),
    );
    await expect(runRunsShowJson(runFolder)).resolves.toMatchObject({
      engine_state: 'waiting_checkpoint',
      reason: 'checkpoint_waiting',
      legal_next_actions: ['inspect', 'resume'],
    });

    const { output: resumed, stderr: resumeStderr } = await runMainJson(
      [
        'resume',
        '--run-folder',
        runFolder,
        '--checkpoint-choice',
        'continue',
        '--progress',
        'jsonl',
      ],
      {
        relayer: generatedMigrateRelayer(),
        configCwd: join(runFolderBase, 'wrong-resume-cwd'),
      },
    );
    expect(resumed).toMatchObject({
      flow_id: 'migrate',
      outcome: 'complete',
      result_path: join(runFolder, 'reports', 'result.json'),
    });
    expect(resumed.runtime).toBeUndefined();
    expect(resumed.runtime_reason).toBeUndefined();
    expect(parseProgress(resumeStderr)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.completed' }),
        expect.objectContaining({ type: 'run.completed', flow_id: 'migrate' }),
      ]),
    );
    const subRunStarted = traceEntries(runFolder).find((entry) => entry.kind === 'sub_run.started');
    const childRunId = subRunStarted?.child_run_id;
    expect(childRunId).toEqual(expect.any(String));
    await expectV2RunConsistency(join(dirname(runFolder), childRunId as string), 'build', {
      expectOperatorSummary: false,
    });
    await expectV2RunConsistency(runFolder, 'migrate');
  });

  it('keeps retained-runtime-owned paths retained by default', async () => {
    const projectRoot = join(runFolderBase, 'retained-project');
    writeProjectPackage(projectRoot);
    const arbitraryFixture = join(runFolderBase, 'fixtures', 'review-copy.json');
    mkdirSync(dirname(arbitraryFixture), { recursive: true });
    writeFileSync(
      arbitraryFixture,
      readFileSync(join(process.cwd(), 'generated', 'flows', 'review', 'circuit.json')),
    );

    const retainedCases: Array<{
      readonly label: string;
      readonly argv: readonly string[];
      readonly relayer: RelayFn;
      readonly configCwd?: string;
    }> = [
      {
        label: 'arbitrary fixture',
        argv: [
          'run',
          'review',
          '--goal',
          'arbitrary fixture retained in soak',
          '--fixture',
          arbitraryFixture,
          '--run-folder',
          join(runFolderBase, 'retained-arbitrary-fixture'),
        ],
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    ];

    for (const candidate of retainedCases) {
      const { output } = await runMainJson(candidate.argv, {
        relayer: candidate.relayer,
        ...(candidate.configCwd === undefined ? {} : { configCwd: candidate.configCwd }),
      });
      expect(output.runtime, candidate.label).toBeUndefined();
      expect(output.runtime_reason, candidate.label).toBeUndefined();
      expectRetainedTrace(output.run_folder as string);
    }

    const composeRunFolder = join(runFolderBase, 'retained-compose-writer');
    const { output: composeOutput } = await runMainJson(
      [
        'run',
        'review',
        '--goal',
        'composeWriter retained in soak',
        '--run-folder',
        composeRunFolder,
      ],
      {
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
        composeWriter: () => {
          throw new Error('composeWriter retained-runtime proof');
        },
      },
    );
    expect(composeOutput).toMatchObject({ flow_id: 'review', outcome: 'aborted' });
    expectRetainedTrace(composeRunFolder);
  });

  it('keeps rollback and strict opt-in precedence explicit', async () => {
    const projectRoot = join(runFolderBase, 'rollback-project');
    writeProjectPackage(projectRoot);

    for (const candidate of [
      {
        label: 'review rollback',
        argv: [
          'run',
          'review',
          '--goal',
          'review rollback soak',
          '--run-folder',
          join(runFolderBase, 'rollback-review'),
        ],
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
      {
        label: 'fix default rollback',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix default rollback soak',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-default'),
        ],
        relayer: generatedFixRelayer(),
      },
      {
        label: 'fix lite rollback',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix lite rollback soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-lite'),
        ],
        relayer: generatedFixRelayer(),
      },
      {
        label: 'fix deep rollback',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix deep rollback soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-deep'),
        ],
        relayer: generatedFixRelayer(),
      },
      {
        label: 'fix autonomous rollback',
        argv: [
          'run',
          'fix',
          '--goal',
          'fix autonomous rollback soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-fix-autonomous'),
        ],
        relayer: generatedFixRelayer(),
      },
      {
        label: 'build default rollback',
        argv: [
          'run',
          'build',
          '--goal',
          'build rollback soak',
          '--run-folder',
          join(runFolderBase, 'rollback-build'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
      },
      {
        label: 'build deep rollback',
        argv: [
          'run',
          'build',
          '--goal',
          'build deep rollback soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-build-deep'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
      },
      {
        label: 'build autonomous rollback',
        argv: [
          'run',
          'build',
          '--goal',
          'build autonomous rollback soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-build-autonomous'),
        ],
        relayer: relayerWithBody('{"verdict":"accept"}'),
      },
      {
        label: 'explore default rollback',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore rollback soak',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-default'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore lite rollback',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore lite rollback soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-lite'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore deep rollback',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore deep rollback soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-deep'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore autonomous rollback',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore autonomous rollback soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-autonomous'),
        ],
        relayer: generatedExploreRelayer(),
      },
      {
        label: 'explore tournament rollback',
        argv: [
          'run',
          'explore',
          '--goal',
          'explore tournament rollback soak',
          '--mode',
          'tournament',
          '--run-folder',
          join(runFolderBase, 'rollback-explore-tournament'),
        ],
        relayer: tournamentRelayer(),
      },
      {
        label: 'sweep default rollback',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep rollback soak',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-default'),
        ],
        relayer: generatedSweepRelayer(),
      },
      {
        label: 'sweep lite rollback',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep lite rollback soak',
          '--mode',
          'lite',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-lite'),
        ],
        relayer: generatedSweepRelayer(),
      },
      {
        label: 'sweep deep rollback',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep deep rollback soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-deep'),
        ],
        relayer: generatedSweepRelayer(),
      },
      {
        label: 'sweep autonomous rollback',
        argv: [
          'run',
          'sweep',
          '--goal',
          'sweep autonomous rollback soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-sweep-autonomous'),
        ],
        relayer: generatedSweepRelayer(),
      },
      {
        label: 'migrate default rollback',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate rollback soak',
          '--run-folder',
          join(runFolderBase, 'rollback-migrate-default'),
        ],
        relayer: generatedMigrateRelayer(),
      },
      {
        label: 'migrate deep rollback',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate deep rollback soak',
          '--mode',
          'deep',
          '--run-folder',
          join(runFolderBase, 'rollback-migrate-deep'),
        ],
        relayer: generatedMigrateRelayer(),
      },
      {
        label: 'migrate autonomous rollback',
        argv: [
          'run',
          'migrate',
          '--goal',
          'migrate autonomous rollback soak',
          '--mode',
          'autonomous',
          '--run-folder',
          join(runFolderBase, 'rollback-migrate-autonomous'),
        ],
        relayer: generatedMigrateRelayer(),
      },
    ]) {
      const { output } = await runMainJson(candidate.argv, {
        mode: 'rollback',
        relayer: candidate.relayer,
        configCwd: projectRoot,
      });
      expect(output, candidate.label).toMatchObject({
        runtime: 'retained',
        runtime_reason: expect.stringContaining('CIRCUIT_DISABLE_V2_RUNTIME=1'),
      });
      expectRetainedTrace(output.run_folder as string);
    }

    const strictRunFolder = join(runFolderBase, 'strict-beats-rollback');
    const { output } = await runMainJson(
      [
        'run',
        'review',
        '--goal',
        'strict opt-in beats rollback in soak',
        '--run-folder',
        strictRunFolder,
      ],
      {
        mode: 'strict-plus-rollback',
        relayer: relayerWithBody(REVIEW_RELAY_BODY),
      },
    );
    expect(output).toMatchObject({
      runtime: 'v2',
      runtime_reason: expect.stringContaining('v2 supports fresh review'),
    });
    expectV2Trace(strictRunFolder);
  }, 30_000);

  it('fails closed for unsupported strict opt-in invocations before unsafe writes', async () => {
    const unsupportedRunFolder = join(runFolderBase, 'strict-runtime-proof-rejected');
    await expectMainRejects(
      [
        'run',
        'runtime-proof',
        '--goal',
        'unsupported strict runtime proof soak',
        '--run-folder',
        unsupportedRunFolder,
      ],
      /flow 'runtime-proof' is not in the v2 runtime support matrix/,
      { mode: 'strict', relayer: relayerWithBody('{"verdict":"accept"}') },
    );
    expect(existsSync(unsupportedRunFolder)).toBe(false);

    const checkpointProjectRoot = join(runFolderBase, 'strict-build-deep-project');
    writeProjectPackage(checkpointProjectRoot);
    const checkpointRunFolder = join(runFolderBase, 'strict-build-deep-waiting');
    const { output } = await runMainJson(
      [
        'run',
        'build',
        '--goal',
        'checkpoint strict candidate soak',
        '--mode',
        'deep',
        '--run-folder',
        checkpointRunFolder,
      ],
      {
        mode: 'strict',
        relayer: relayerWithBody('{"verdict":"accept"}'),
        configCwd: checkpointProjectRoot,
      },
    );
    expect(output).toMatchObject({
      flow_id: 'build',
      entry_mode: 'deep',
      outcome: 'checkpoint_waiting',
      runtime: 'v2',
    });
    expectV2Trace(checkpointRunFolder);
  });

  it('soaks progress, connector safety, child runs, and fanout lifecycle events', async () => {
    const projectRoot = join(runFolderBase, 'surface-project');
    writeProjectPackage(projectRoot);

    const reviewRunFolder = join(runFolderBase, 'progress-review');
    const review = await runMainJson(
      [
        'run',
        'review',
        '--goal',
        'review progress soak',
        '--run-folder',
        reviewRunFolder,
        '--progress',
        'jsonl',
      ],
      { relayer: relayerWithBody(REVIEW_RELAY_BODY) },
    );
    const reviewProgressTypes = parseProgress(review.stderr).map((event) => event.type);
    expect(reviewProgressTypes).toEqual(
      expect.arrayContaining([
        'route.selected',
        'run.started',
        'task_list.updated',
        'step.started',
        'relay.started',
        'relay.completed',
        'step.completed',
        'run.completed',
      ]),
    );

    const configCwd = join(runFolderBase, 'unsafe-connector-project');
    mkdirSync(join(configCwd, '.circuit'), { recursive: true });
    writeFileSync(
      join(configCwd, '.circuit', 'config.yaml'),
      ['schema_version: 1', 'relay:', '  default: codex', ''].join('\n'),
    );
    let relayCalls = 0;
    const unsafeRunFolder = join(runFolderBase, 'unsafe-connector');
    const unsafe = await runMainJson(
      [
        'run',
        'build',
        '--goal',
        'connector safety soak',
        '--mode',
        'lite',
        '--run-folder',
        unsafeRunFolder,
        '--progress',
        'jsonl',
      ],
      {
        mode: 'strict',
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
    const unsafeProgress = parseProgress(unsafe.stderr);
    expect(unsafe.output).toMatchObject({ flow_id: 'build', outcome: 'aborted' });
    expect(relayCalls).toBe(0);
    expect(unsafeProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'step.aborted', step_id: 'act-step' }),
        expect.objectContaining({ type: 'run.aborted', outcome: 'aborted' }),
      ]),
    );

    const migrateRunFolder = join(runFolderBase, 'progress-migrate');
    const migrate = await runMainJson(
      [
        'run',
        'migrate',
        '--goal',
        'migrate child progress soak',
        '--run-folder',
        migrateRunFolder,
        '--progress',
        'jsonl',
      ],
      { configCwd: projectRoot, relayer: generatedMigrateRelayer() },
    );
    const migrateProgress = parseProgress(migrate.stderr);
    const subRunStarted = traceEntries(migrateRunFolder).find(
      (entry) => entry.kind === 'sub_run.started',
    );
    const childRunId = subRunStarted?.child_run_id;
    if (typeof childRunId !== 'string') throw new Error('missing child run id');
    const childRunFolder = join(dirname(migrateRunFolder), childRunId);
    await expectV2RunConsistency(migrateRunFolder, 'migrate');
    await expectV2RunConsistency(childRunFolder, 'build', { expectOperatorSummary: false });
    expect(migrateProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'run.started', flow_id: 'migrate' }),
        expect.objectContaining({ type: 'run.started', flow_id: 'build' }),
        expect.objectContaining({ type: 'run.completed', flow_id: 'build' }),
        expect.objectContaining({ type: 'run.completed', flow_id: 'migrate' }),
      ]),
    );

    const fanoutProject = join(runFolderBase, 'fanout-project');
    const connectorScript = join(fanoutProject, 'connectors', 'fanout-reviewer.cjs');
    const fanoutFixture = join(runFolderBase, 'fixtures', 'fanout-sweep.json');
    const fanoutRunFolder = join(runFolderBase, 'fanout-progress');
    writeFanoutCustomConnectorScript(connectorScript);
    writeCustomConnectorConfig(join(fanoutProject, '.circuit'), [
      process.execPath,
      connectorScript,
    ]);
    writeFanoutFixture(fanoutFixture);
    const fanout = await runMainJson(
      [
        'run',
        'sweep',
        '--goal',
        'fanout progress soak',
        '--fixture',
        fanoutFixture,
        '--run-folder',
        fanoutRunFolder,
        '--progress',
        'jsonl',
      ],
      { mode: 'strict', configCwd: fanoutProject },
    );
    const fanoutProgress = parseProgress(fanout.stderr);
    const aggregate = ExploreTournamentAggregate.parse(
      JSON.parse(
        readFileSync(join(fanoutRunFolder, 'reports', 'fanout', 'aggregate.json'), 'utf8'),
      ),
    );
    const proposal = ExploreTournamentProposal.parse(
      JSON.parse(
        readFileSync(
          join(fanoutRunFolder, 'reports', 'fanout', 'branches', 'option-1', 'report.json'),
          'utf8',
        ),
      ),
    );
    expect(fanout.output).toMatchObject({ flow_id: 'sweep', outcome: 'complete', runtime: 'v2' });
    expect(aggregate).toMatchObject({ branch_count: 1, join_policy: 'aggregate-only' });
    expect(proposal).toMatchObject({ verdict: 'accept', option_id: 'option-1' });
    expect(fanoutProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'fanout.started', step_id: 'fanout-step' }),
        expect.objectContaining({ type: 'fanout.branch_started', branch_id: 'option-1' }),
        expect.objectContaining({ type: 'fanout.branch_completed', branch_id: 'option-1' }),
        expect.objectContaining({ type: 'fanout.joined', step_id: 'fanout-step' }),
      ]),
    );
  });

  it('soaks the real custom connector bridge and descriptor precedence', async () => {
    const homeDir = join(runFolderBase, 'home');
    const projectRoot = join(runFolderBase, 'custom-connector-project');
    const connectorScript = join(projectRoot, 'connectors', 'reviewer.cjs');
    const runFolder = join(runFolderBase, 'custom-connector-review');
    writeCustomConnectorConfig(join(homeDir, '.config', 'circuit-next'), [
      'node',
      'user-reviewer.js',
    ]);
    writeReviewCustomConnectorScript(connectorScript);
    writeCustomConnectorConfig(join(projectRoot, '.circuit'), [process.execPath, connectorScript]);

    const { output } = await runMainJson(
      ['run', 'review', '--goal', 'real custom connector soak', '--run-folder', runFolder],
      { mode: 'strict', configCwd: projectRoot, configHomeDir: homeDir },
    );

    const relayStarted = traceEntries(runFolder).find((entry) => entry.kind === 'relay.started');
    const receipt = readFileSync(join(runFolder, 'reports', 'relay', 'review.receipt.txt'), 'utf8');
    const rawFindings = ReviewRelayResult.parse(
      JSON.parse(
        readFileSync(join(runFolder, 'stages', 'analyze', 'review-raw-findings.json'), 'utf8'),
      ),
    );
    const reviewResult = ReviewResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'review-result.json'), 'utf8')),
    );

    expect(output).toMatchObject({ flow_id: 'review', outcome: 'complete', runtime: 'v2' });
    expect(relayStarted).toMatchObject({
      data: expect.objectContaining({
        connector: expect.objectContaining({
          kind: 'custom',
          name: 'local-reviewer',
          command: [process.execPath, connectorScript],
        }),
      }),
    });
    expect(receipt).toMatch(/^custom:local-reviewer:\d+$/);
    expect(rawFindings).toMatchObject({ verdict: 'NO_ISSUES_FOUND', findings: [] });
    expect(reviewResult).toMatchObject({ verdict: 'CLEAN', findings: [] });
    await expectV2RunConsistency(runFolder, 'review');
  });
});
