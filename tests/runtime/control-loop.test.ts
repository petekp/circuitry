import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TerminalTarget } from '../../src/runtime/domain/route.js';
import type { ExecutableFlow } from '../../src/runtime/manifest/executable-flow.js';
import { runCompiledFlow } from '../../src/runtime/run/compiled-flow-runner.js';
import { executeExecutableFlow } from '../../src/runtime/run/graph-runner.js';
import { TraceStore } from '../../src/runtime/trace/trace-store.js';
import { type RunResult as ParsedRunResult, RunResult } from '../../src/schemas/result.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';
import { NO_VERDICT_SENTINEL } from '../../src/shared/relay-support.js';

type RichCheckpointRoute = 'ask' | 'retry' | 'revise' | 'stop' | 'handoff' | 'escalate';

async function withTempRun<T>(prefix: string, fn: (runDir: string) => Promise<T>): Promise<T> {
  const runDir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(runDir);
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

function terminalFlow(target: TerminalTarget): ExecutableFlow {
  return {
    id: `terminal-${target.slice(1)}`,
    version: '0.1.0',
    entry: 'close',
    stages: [{ id: 'main', stepIds: ['close'] }],
    steps: [
      {
        id: 'close',
        kind: 'compose',
        writer: 'terminal-writer',
        body: { target },
        writes: { report: { path: 'reports/terminal.json' } },
        routes: { pass: { kind: 'terminal', target } },
      },
    ],
  };
}

type RelayFlowFixtureOptions = {
  readonly pass?: readonly string[];
  readonly routes?: Record<string, string>;
  readonly budgets?: { readonly max_attempts: number };
  readonly report?: { readonly path: string; readonly schema: string };
  readonly acceptanceCriteria?: unknown;
};

function isRelayPassList(
  value: readonly string[] | RelayFlowFixtureOptions,
): value is readonly string[] {
  return Array.isArray(value);
}

function relayFlowBytes(options: readonly string[] | RelayFlowFixtureOptions = ['ok']): Buffer {
  const fixtureOptions: RelayFlowFixtureOptions = isRelayPassList(options)
    ? { pass: options }
    : options;
  const pass = fixtureOptions.pass ?? ['ok'];
  const routes = fixtureOptions.routes ?? { pass: '@complete' };
  const writes: Record<string, string | { readonly path: string; readonly schema: string }> = {
    request: 'reports/relay.request.txt',
    receipt: 'reports/relay.receipt.txt',
    result: 'reports/relay.result.json',
  };
  if (fixtureOptions.report !== undefined) writes.report = fixtureOptions.report;

  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'runtime-relay-check',
      version: '0.1.0',
      purpose: 'Runtime control-loop fixture for relay check admission.',
      entry: {
        signals: { include: ['runtime-relay-check'], exclude: [] },
        intent_prefixes: ['runtime-relay-check'],
      },
      axes: {
        allowed_rigors: ['standard'],
        supports_tournament: false,
        supports_autonomous: false,
      },
      starts_at: 'relay-step',
      stages: [
        {
          id: 'act-stage',
          title: 'Act',
          canonical: 'act',
          steps: ['relay-step'],
        },
      ],
      steps: [
        {
          id: 'relay-step',
          title: 'Relay check',
          protocol: 'runtime-relay-check@v1',
          reads: [],
          routes,
          ...(fixtureOptions.budgets === undefined ? {} : { budgets: fixtureOptions.budgets }),
          executor: 'worker',
          kind: 'relay',
          role: 'reviewer',
          ...(fixtureOptions.acceptanceCriteria === undefined
            ? {}
            : { acceptance_criteria: fixtureOptions.acceptanceCriteria }),
          writes,
          check: {
            kind: 'result_verdict',
            source: { kind: 'relay_result', ref: 'result' },
            pass,
          },
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
        rationale: 'Minimal relay check control-loop fixture.',
      },
    }),
  );
}

function multiRelayVerdictFlowBytes(): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'runtime-multi-relay-verdict',
      version: '0.1.0',
      purpose: 'Runtime control-loop fixture for terminal verdict derivation.',
      entry: {
        signals: { include: ['runtime-multi-relay-verdict'], exclude: [] },
        intent_prefixes: ['runtime-multi-relay-verdict'],
      },
      axes: {
        allowed_rigors: ['standard'],
        supports_tournament: false,
        supports_autonomous: false,
      },
      starts_at: 'first-relay',
      stages: [
        {
          id: 'act-stage',
          title: 'Act',
          canonical: 'act',
          steps: ['first-relay', 'second-relay'],
        },
      ],
      steps: [
        {
          id: 'first-relay',
          title: 'First relay',
          protocol: 'runtime-multi-relay-verdict@v1',
          reads: [],
          routes: { pass: 'second-relay' },
          executor: 'worker',
          kind: 'relay',
          role: 'implementer',
          writes: {
            request: 'reports/first.request.txt',
            receipt: 'reports/first.receipt.txt',
            result: 'reports/first.result.json',
          },
          check: {
            kind: 'result_verdict',
            source: { kind: 'relay_result', ref: 'result' },
            pass: ['intermediate'],
          },
        },
        {
          id: 'second-relay',
          title: 'Second relay',
          protocol: 'runtime-multi-relay-verdict@v1',
          reads: ['reports/first.result.json'],
          routes: { pass: '@complete' },
          executor: 'worker',
          kind: 'relay',
          role: 'implementer',
          writes: {
            request: 'reports/second.request.txt',
            receipt: 'reports/second.receipt.txt',
            result: 'reports/second.result.json',
          },
          check: {
            kind: 'result_verdict',
            source: { kind: 'relay_result', ref: 'result' },
            pass: ['final'],
          },
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
        rationale: 'Minimal multi-relay terminal verdict derivation fixture.',
      },
    }),
  );
}

function checkpointRouteFlowBytes(selection: RichCheckpointRoute): Buffer {
  const terminalByRoute: Record<RichCheckpointRoute, string> = {
    ask: '@stop',
    retry: '@handoff',
    revise: '@escalate',
    stop: '@stop',
    handoff: '@handoff',
    escalate: '@escalate',
  };
  const choices: readonly RichCheckpointRoute[] = [
    'ask',
    'retry',
    'revise',
    'stop',
    'handoff',
    'escalate',
  ];

  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'runtime-checkpoint-routes',
      version: '0.1.0',
      purpose: 'Runtime control-loop fixture for checkpoint route labels.',
      entry: {
        signals: { include: ['runtime-checkpoint-routes'], exclude: [] },
        intent_prefixes: ['runtime-checkpoint-routes'],
      },
      axes: {
        allowed_rigors: ['standard'],
        supports_tournament: false,
        supports_autonomous: false,
      },
      starts_at: 'checkpoint-step',
      stages: [
        {
          id: 'frame-stage',
          title: 'Frame',
          canonical: 'frame',
          steps: ['checkpoint-step'],
        },
      ],
      steps: [
        {
          id: 'checkpoint-step',
          title: 'Choose route',
          protocol: 'runtime-checkpoint-routes@v1',
          reads: [],
          routes: {
            pass: '@complete',
            ask: terminalByRoute.ask,
            retry: terminalByRoute.retry,
            revise: terminalByRoute.revise,
            stop: terminalByRoute.stop,
            handoff: terminalByRoute.handoff,
            escalate: terminalByRoute.escalate,
          },
          executor: 'orchestrator',
          kind: 'checkpoint',
          policy: {
            prompt: 'Choose the route to prove.',
            choices: choices.map((id) => ({ id })),
            safe_default_choice: selection,
            safe_autonomous_choice: selection,
          },
          writes: {
            request: 'reports/checkpoints/route-request.json',
            response: 'reports/checkpoints/route-response.json',
          },
          check: {
            kind: 'checkpoint_selection',
            source: { kind: 'checkpoint_response', ref: 'response' },
            allow: choices,
          },
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
        rationale: 'Minimal checkpoint route control-loop fixture.',
      },
    }),
  );
}

function checkpointRetryLoopFlowBytes(): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'runtime-checkpoint-retry-loop',
      version: '0.1.0',
      purpose: 'Runtime control-loop fixture for bounded checkpoint retry routes.',
      entry: {
        signals: { include: ['runtime-checkpoint-retry-loop'], exclude: [] },
        intent_prefixes: ['runtime-checkpoint-retry-loop'],
      },
      axes: {
        allowed_rigors: ['standard'],
        supports_tournament: false,
        supports_autonomous: false,
      },
      starts_at: 'checkpoint-step',
      stages: [
        {
          id: 'frame-stage',
          title: 'Frame',
          canonical: 'frame',
          steps: ['checkpoint-step'],
        },
      ],
      steps: [
        {
          id: 'checkpoint-step',
          title: 'Retry checkpoint',
          protocol: 'runtime-checkpoint-retry-loop@v1',
          reads: [],
          routes: { pass: '@complete', retry: 'checkpoint-step' },
          budgets: { max_attempts: 2 },
          executor: 'orchestrator',
          kind: 'checkpoint',
          policy: {
            prompt: 'Retry until bounded.',
            choices: [{ id: 'retry' }],
            safe_default_choice: 'retry',
            safe_autonomous_choice: 'retry',
          },
          writes: {
            request: 'reports/checkpoints/retry-request.json',
            response: 'reports/checkpoints/retry-response.json',
          },
          check: {
            kind: 'checkpoint_selection',
            source: { kind: 'checkpoint_response', ref: 'response' },
            allow: ['retry'],
          },
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
        rationale: 'Minimal checkpoint retry-loop control-loop fixture.',
      },
    }),
  );
}

function checkpointMissingSafeChoiceFlowBytes(input: {
  readonly depth: 'standard' | 'autonomous';
  readonly safeDefaultChoice?: string;
  readonly safeAutonomousChoice?: string;
}): Buffer {
  const policy: Record<string, unknown> = {
    prompt: 'Try to auto-resolve without the required safe choice.',
    choices: [{ id: 'continue' }],
  };
  if (input.safeDefaultChoice !== undefined) {
    policy.safe_default_choice = input.safeDefaultChoice;
  }
  if (input.safeAutonomousChoice !== undefined) {
    policy.safe_autonomous_choice = input.safeAutonomousChoice;
  }
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: `runtime-checkpoint-missing-${input.depth}`,
      version: '0.1.0',
      purpose: 'Runtime control-loop fixture for checkpoint auto-resolution failure.',
      entry: {
        signals: { include: ['runtime-checkpoint-missing-safe-choice'], exclude: [] },
        intent_prefixes: ['runtime-checkpoint-missing-safe-choice'],
      },
      axes: {
        allowed_rigors: ['standard'],
        supports_tournament: false,
        supports_autonomous: input.depth === 'autonomous',
        default: {
          rigor: 'standard',
          tournament: false,
          tournament_n: 3,
          autonomous: input.depth === 'autonomous',
        },
      },
      starts_at: 'checkpoint-step',
      stages: [
        {
          id: 'frame-stage',
          title: 'Frame',
          canonical: 'frame',
          steps: ['checkpoint-step'],
        },
      ],
      steps: [
        {
          id: 'checkpoint-step',
          title: 'Missing safe choice checkpoint',
          protocol: 'runtime-checkpoint-missing-safe-choice@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'checkpoint',
          policy,
          writes: {
            request: 'reports/checkpoints/missing-safe-choice-request.json',
            response: 'reports/checkpoints/missing-safe-choice-response.json',
          },
          check: {
            kind: 'checkpoint_selection',
            source: { kind: 'checkpoint_response', ref: 'response' },
            allow: ['continue'],
          },
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
        rationale: 'Minimal checkpoint auto-resolution failure fixture.',
      },
    }),
  );
}

function verificationFlowBytes(reportSchema = 'never-registered.verification@v1'): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'runtime-verification-failure',
      version: '0.1.0',
      purpose: 'Runtime control-loop fixture for verification pre-write failure evidence.',
      entry: {
        signals: { include: ['runtime-verification-failure'], exclude: [] },
        intent_prefixes: ['runtime-verification-failure'],
      },
      axes: {
        allowed_rigors: ['standard'],
        supports_tournament: false,
        supports_autonomous: false,
      },
      starts_at: 'verification-step',
      stages: [
        {
          id: 'verify-stage',
          title: 'Verify',
          canonical: 'verify',
          steps: ['verification-step'],
        },
      ],
      steps: [
        {
          id: 'verification-step',
          title: 'Verification pre-write failure',
          protocol: 'runtime-verification-failure@v1',
          reads: [],
          routes: { pass: '@complete' },
          executor: 'orchestrator',
          kind: 'verification',
          writes: {
            report: { path: 'reports/verification.json', schema: reportSchema },
          },
          check: {
            kind: 'schema_sections',
            source: { kind: 'report', ref: 'report' },
            required: ['overall_status'],
          },
        },
      ],
      stage_path_policy: {
        mode: 'partial',
        omits: ['frame', 'analyze', 'plan', 'act', 'review', 'close'],
        rationale: 'Minimal verification pre-write failure fixture.',
      },
    }),
  );
}

function relayerWith(resultBody: string, connectorName = 'claude-code'): RelayFn {
  return {
    connectorName,
    relay: async (input): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'runtime-control-loop-relay',
      result_body: resultBody,
      duration_ms: 0,
      cli_version: 'test-relayer',
    }),
  };
}

function sequenceRelayerWith(resultBodies: readonly string[]): RelayFn {
  let call = 0;
  return {
    connectorName: 'claude-code',
    relay: async (input): Promise<RelayResult> => {
      const resultBody = resultBodies[call++];
      if (resultBody === undefined) {
        throw new Error(`sequence relayer exhausted at call ${call}`);
      }
      return {
        request_payload: input.prompt,
        receipt_id: `runtime-control-loop-relay-${call}`,
        result_body: resultBody,
        duration_ms: 0,
        cli_version: 'test-relayer',
      };
    },
  };
}

async function runRuntimeProofRelayCase(input: {
  readonly resultBody: string;
  readonly runId: string;
  readonly flowBytes?: Buffer;
  readonly connectorName?: string;
  readonly relayer?: RelayFn;
  readonly projectRootForRunDir?: (runDir: string) => Promise<string>;
  readonly inspectRunDir?: (runDir: string) => Promise<unknown>;
}) {
  return await withTempRun('circuit-runtime-control-loop-', async (runDir) => {
    const projectRoot =
      input.projectRootForRunDir === undefined
        ? undefined
        : await input.projectRootForRunDir(runDir);
    const result = await runCompiledFlow({
      flowBytes: input.flowBytes ?? relayFlowBytes(),
      runDir,
      runId: input.runId,
      goal: 'prove runtime relay check admission',
      now: () => new Date('2026-05-06T00:00:00.000Z'),
      relayer: input.relayer ?? relayerWith(input.resultBody, input.connectorName),
      ...(projectRoot === undefined ? {} : { projectRoot }),
    });
    const trace = await new TraceStore(runDir).load();
    const resultJson = RunResult.parse(
      JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
    );
    const inspection =
      input.inspectRunDir === undefined ? undefined : await input.inspectRunDir(runDir);
    return { result, trace, resultJson, inspection };
  });
}

async function runCompiledV1RelayCase(input: {
  readonly flowBytes: Buffer;
  readonly runId: string;
  readonly goal: string;
  readonly relayer: RelayFn;
}) {
  return await withTempRun('circuit-runtime-control-loop-', async (runDir) => {
    const result = await runCompiledFlow({
      flowBytes: input.flowBytes,
      runDir,
      runId: input.runId,
      goal: input.goal,
      now: () => new Date('2026-05-06T00:00:00.000Z'),
      relayer: input.relayer,
    });
    const trace = await new TraceStore(runDir).load();
    const resultJson = RunResult.parse(
      JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
    );
    return { result, trace, resultJson };
  });
}

async function runCompiledV1BytesCase(input: {
  readonly flowBytes: Buffer;
  readonly runId: string;
  readonly goal: string;
  readonly projectRoot?: string;
  readonly inspectRunDir?: (runDir: string) => Promise<unknown>;
}) {
  return await withTempRun('circuit-runtime-control-loop-', async (runDir) => {
    const result = await runCompiledFlow({
      flowBytes: input.flowBytes,
      runDir,
      runId: input.runId,
      goal: input.goal,
      now: () => new Date('2026-05-06T00:00:00.000Z'),
      ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }),
    });
    const trace = await new TraceStore(runDir).load();
    const resultJson = RunResult.parse(
      JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
    );
    const inspection =
      input.inspectRunDir === undefined ? undefined : await input.inspectRunDir(runDir);
    return { result, trace, resultJson, inspection };
  });
}

describe('runtime control-loop parity twins', () => {
  it('maps every terminal target to the kept terminal outcome vocabulary', async () => {
    const cases: Array<{
      target: TerminalTarget;
      outcome: ParsedRunResult['outcome'];
      runId: string;
    }> = [
      {
        target: '@complete',
        outcome: 'complete',
        runId: '10000000-0000-4000-8000-000000000001',
      },
      {
        target: '@stop',
        outcome: 'stopped',
        runId: '10000000-0000-4000-8000-000000000002',
      },
      {
        target: '@handoff',
        outcome: 'handoff',
        runId: '10000000-0000-4000-8000-000000000003',
      },
      {
        target: '@escalate',
        outcome: 'escalated',
        runId: '10000000-0000-4000-8000-000000000004',
      },
    ];

    for (const { target, outcome, runId } of cases) {
      await withTempRun('circuit-runtime-terminal-', async (runDir) => {
        const result = await executeExecutableFlow(terminalFlow(target), {
          runDir,
          runId,
          goal: `terminal ${target}`,
          now: () => new Date('2026-05-06T00:00:00.000Z'),
        });
        const trace = await new TraceStore(runDir).load();
        const resultJson = RunResult.parse(
          JSON.parse(await readFile(join(runDir, 'reports', 'result.json'), 'utf8')),
        );

        expect(result.outcome).toBe(outcome);
        expect(result.summary).toBe(`Run closed with outcome ${outcome} via ${target}.`);
        expect(result.trace_entries_observed).toBe(4);
        expect(resultJson).toMatchObject({
          run_id: runId,
          flow_id: `terminal-${target.slice(1)}`,
          outcome,
          trace_entries_observed: 4,
        });
        expect(trace.map((entry) => entry.kind)).toEqual([
          'run.bootstrapped',
          'step.entered',
          'step.completed',
          'run.closed',
        ]);
        expect(trace.at(-1)).toMatchObject({
          kind: 'run.closed',
          outcome,
        });
      });
    }
  });

  it('admits a relay verdict from the connector body instead of assuming check.pass[0]', async () => {
    const { result, trace, resultJson } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes(['ok', 'ok-with-caveats']),
      resultBody: '{"verdict":"ok-with-caveats"}',
      runId: 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaa1111',
    });

    expect(result.outcome).toBe('complete');
    expect(result.verdict).toBe('ok-with-caveats');
    expect(resultJson.verdict).toBe('ok-with-caveats');
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'relay.completed',
          step_id: 'relay-step',
          verdict: 'ok-with-caveats',
        }),
        expect.objectContaining({
          kind: 'check.evaluated',
          step_id: 'relay-step',
          check_kind: 'result_verdict',
          outcome: 'pass',
        }),
      ]),
    );
  });

  it('uses the later admitted relay verdict for the final result', async () => {
    const { result, trace, resultJson } = await runCompiledV1RelayCase({
      flowBytes: multiRelayVerdictFlowBytes(),
      runId: 'aaaaaaaa-2222-4aaa-8aaa-aaaaaaaa2222',
      goal: 'prove runtime terminal verdict derivation uses the latest admitted relay',
      relayer: sequenceRelayerWith(['{"verdict":"intermediate"}', '{"verdict":"final"}']),
    });

    expect(result.outcome).toBe('complete');
    expect(result.verdict).toBe('final');
    expect(resultJson.verdict).toBe('final');
    expect(
      trace
        .filter((entry) => entry.kind === 'relay.completed')
        .map((entry) => ({ step_id: entry.step_id, verdict: entry.verdict })),
    ).toEqual([
      { step_id: 'first-relay', verdict: 'intermediate' },
      { step_id: 'second-relay', verdict: 'final' },
    ]);
  });

  it('omits admitted relay verdicts from aborted final results', async () => {
    const { result, trace, resultJson } = await runCompiledV1RelayCase({
      flowBytes: multiRelayVerdictFlowBytes(),
      runId: 'aaaaaaaa-3333-4aaa-8aaa-aaaaaaaa3333',
      goal: 'prove runtime omits terminal verdicts when a later step aborts',
      relayer: sequenceRelayerWith(['{"verdict":"intermediate"}', '{"verdict":"reject"}']),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.verdict).toBeUndefined();
    expect(resultJson.verdict).toBeUndefined();
    expect(
      trace
        .filter((entry) => entry.kind === 'relay.completed')
        .map((entry) => ({ step_id: entry.step_id, verdict: entry.verdict })),
    ).toEqual([
      { step_id: 'first-relay', verdict: 'intermediate' },
      { step_id: 'second-relay', verdict: 'reject' },
    ]);
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'step.aborted',
          step_id: 'second-relay',
          reason: expect.stringMatching(/not in check\.pass/),
        }),
        expect.objectContaining({
          kind: 'run.closed',
          outcome: 'aborted',
        }),
      ]),
    );
  });

  it('carries production relayer connector identity and provenance into relay.started', async () => {
    const { result, trace } = await runRuntimeProofRelayCase({
      resultBody: '{"verdict":"ok"}',
      connectorName: 'codex',
      runId: 'eeeeeeee-1111-4eee-8eee-eeeeeeee1111',
    });

    expect(result.outcome).toBe('complete');
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'relay.started',
          step_id: 'relay-step',
          connector: { kind: 'builtin', name: 'codex' },
          resolved_from: { source: 'explicit' },
          role: 'reviewer',
        }),
      ]),
    );
  });

  it('executes checkpoint route labels instead of collapsing them to pass', async () => {
    const cases: Array<{
      selection: RichCheckpointRoute;
      outcome: ParsedRunResult['outcome'];
      runId: string;
    }> = [
      {
        selection: 'ask',
        outcome: 'stopped',
        runId: '20000000-0000-4000-8000-000000000001',
      },
      {
        selection: 'retry',
        outcome: 'handoff',
        runId: '20000000-0000-4000-8000-000000000002',
      },
      {
        selection: 'revise',
        outcome: 'escalated',
        runId: '20000000-0000-4000-8000-000000000003',
      },
      {
        selection: 'stop',
        outcome: 'stopped',
        runId: '20000000-0000-4000-8000-000000000004',
      },
      {
        selection: 'handoff',
        outcome: 'handoff',
        runId: '20000000-0000-4000-8000-000000000005',
      },
      {
        selection: 'escalate',
        outcome: 'escalated',
        runId: '20000000-0000-4000-8000-000000000006',
      },
    ];

    for (const { selection, outcome, runId } of cases) {
      const { result, trace, resultJson } = await runCompiledV1BytesCase({
        flowBytes: checkpointRouteFlowBytes(selection),
        runId,
        goal: `prove checkpoint route ${selection}`,
      });

      expect(result.outcome, selection).toBe(outcome);
      expect(resultJson.outcome, selection).toBe(outcome);
      expect(trace).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'checkpoint.resolved',
            step_id: 'checkpoint-step',
            selection,
            resolution_source: 'safe-default',
          }),
          expect.objectContaining({
            kind: 'step.completed',
            step_id: 'checkpoint-step',
            route_taken: selection,
          }),
          expect.objectContaining({
            kind: 'run.closed',
            outcome,
          }),
        ]),
      );
    }
  });

  it('bounds checkpoint retry loops by max_attempts instead of spinning forever', async () => {
    const { result, trace, resultJson } = await runCompiledV1BytesCase({
      flowBytes: checkpointRetryLoopFlowBytes(),
      runId: '30000000-0000-4000-8000-000000000001',
      goal: 'prove checkpoint retry loops are bounded',
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toBe("route 'retry' for step 'checkpoint-step' exhausted max_attempts=2");
    expect(resultJson.reason).toBe(result.reason);
    const completedRetries = trace.filter(
      (entry) => entry.kind === 'step.completed' && entry.route_taken === 'retry',
    );
    expect(completedRetries).toHaveLength(2);
    expect(completedRetries.map((entry) => entry.attempt)).toEqual([1, 2]);
    expect(trace).toContainEqual(
      expect.objectContaining({
        kind: 'step.aborted',
        step_id: 'checkpoint-step',
        attempt: 3,
        reason: result.reason,
      }),
    );
  });

  it('records checkpoint auto-resolution failures when safe choices are missing', async () => {
    const cases = [
      {
        name: 'standard',
        flowBytes: checkpointMissingSafeChoiceFlowBytes({ depth: 'standard' }),
        runId: '40000000-0000-4000-8000-000000000010',
        reason: /cannot resolve standard depth without a declared safe default choice/,
      },
      {
        name: 'autonomous',
        flowBytes: checkpointMissingSafeChoiceFlowBytes({
          depth: 'autonomous',
          safeDefaultChoice: 'continue',
        }),
        runId: '40000000-0000-4000-8000-000000000011',
        reason: /cannot auto-resolve autonomous depth without a declared safe autonomous choice/,
      },
    ] as const;

    for (const testCase of cases) {
      const { result, trace, resultJson } = await runCompiledV1BytesCase({
        flowBytes: testCase.flowBytes,
        runId: testCase.runId,
        goal: `prove checkpoint ${testCase.name} missing safe choice failure`,
      });

      expect(result.outcome, testCase.name).toBe('aborted');
      expect(result.reason, testCase.name).toMatch(testCase.reason);
      expect(resultJson.reason, testCase.name).toBe(result.reason);
      expect(
        trace.map((entry) => entry.kind),
        testCase.name,
      ).toEqual([
        'run.bootstrapped',
        'step.entered',
        'checkpoint.requested',
        'check.evaluated',
        'step.aborted',
        'run.closed',
      ]);
      expect(trace, testCase.name).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'checkpoint.requested',
            step_id: 'checkpoint-step',
          }),
          expect.objectContaining({
            kind: 'check.evaluated',
            step_id: 'checkpoint-step',
            check_kind: 'checkpoint_selection',
            outcome: 'fail',
            reason: expect.stringMatching(testCase.reason),
          }),
          expect.objectContaining({
            kind: 'step.aborted',
            step_id: 'checkpoint-step',
            reason: expect.stringMatching(testCase.reason),
          }),
        ]),
      );
      expect(trace).not.toContainEqual(
        expect.objectContaining({ kind: 'checkpoint.resolved', step_id: 'checkpoint-step' }),
      );
    }
  });

  it('does not carry rejected or malformed relay verdicts into the final result', async () => {
    const cases = [
      {
        name: 'rejected-verdict',
        resultBody: '{"verdict":"reject"}',
        expectedRelayVerdict: 'reject',
        expectedReason: /not in check\.pass/,
        runId: 'bbbbbbbb-1111-4bbb-8bbb-bbbbbbbb1111',
      },
      {
        name: 'unparseable-body',
        resultBody: 'not-json{',
        expectedRelayVerdict: NO_VERDICT_SENTINEL,
        expectedReason: /did not parse as JSON/,
        runId: 'cccccccc-1111-4ccc-8ccc-cccccccc1111',
      },
      {
        name: 'missing-verdict',
        resultBody: '{"summary":"no verdict"}',
        expectedRelayVerdict: NO_VERDICT_SENTINEL,
        expectedReason: /lacks a non-empty string 'verdict' field/,
        runId: 'dddddddd-1111-4ddd-8ddd-dddddddd1111',
      },
      {
        name: 'array-body',
        resultBody: '[]',
        expectedRelayVerdict: NO_VERDICT_SENTINEL,
        expectedReason: /parsed but is not a JSON object \(got array\)/,
        runId: 'dddddddd-2222-4ddd-8ddd-dddddddd2222',
      },
      {
        name: 'null-body',
        resultBody: 'null',
        expectedRelayVerdict: NO_VERDICT_SENTINEL,
        expectedReason: /parsed but is not a JSON object \(got null\)/,
        runId: 'dddddddd-3333-4ddd-8ddd-dddddddd3333',
      },
      {
        name: 'empty-verdict',
        resultBody: '{"verdict":""}',
        expectedRelayVerdict: NO_VERDICT_SENTINEL,
        expectedReason: /lacks a non-empty string 'verdict' field \(got empty string\)/,
        runId: 'dddddddd-4444-4ddd-8ddd-dddddddd4444',
      },
    ] as const;

    for (const testCase of cases) {
      const { result, trace, resultJson } = await runRuntimeProofRelayCase({
        resultBody: testCase.resultBody,
        runId: testCase.runId,
      });

      expect(result.outcome, testCase.name).toBe('aborted');
      expect(result.verdict, testCase.name).toBeUndefined();
      expect(resultJson.verdict, testCase.name).toBeUndefined();

      expect(trace).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'relay.completed',
            step_id: 'relay-step',
            verdict: testCase.expectedRelayVerdict,
          }),
          expect.objectContaining({
            kind: 'check.evaluated',
            step_id: 'relay-step',
            check_kind: 'result_verdict',
            outcome: 'fail',
            reason: expect.stringMatching(testCase.expectedReason),
          }),
          expect.objectContaining({
            kind: 'step.aborted',
            step_id: 'relay-step',
            reason: expect.stringMatching(testCase.expectedReason),
          }),
        ]),
      );
      expect(trace).not.toContainEqual(
        expect.objectContaining({ kind: 'step.completed', step_id: 'relay-step' }),
      );
    }
  });

  it('records production relay transcript entries in order on admitted relay checks', async () => {
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      resultBody: '{"verdict":"ok"}',
      runId: 'ffffffff-8888-4fff-8fff-ffffffff8888',
      inspectRunDir: async (runDir) => ({
        requestExists: existsSync(join(runDir, 'reports', 'relay.request.txt')),
        receiptExists: existsSync(join(runDir, 'reports', 'relay.receipt.txt')),
        resultExists: existsSync(join(runDir, 'reports', 'relay.result.json')),
      }),
    });

    expect(result.outcome).toBe('complete');
    expect(result.verdict).toBe('ok');
    expect(resultJson.verdict).toBe('ok');
    expect(inspection).toEqual({
      requestExists: true,
      receiptExists: true,
      resultExists: true,
    });
    expect(trace.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'relay.started',
      'relay.request',
      'relay.receipt',
      'relay.result',
      'relay.completed',
      'check.evaluated',
      'step.completed',
      'run.closed',
    ]);
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'step.aborted', step_id: 'relay-step' }),
    );
  });

  it('records production relay transcript entries in order on failed relay checks', async () => {
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      resultBody: '{"verdict":"reject"}',
      runId: 'ffffffff-9999-4fff-8fff-ffffffff9999',
      inspectRunDir: async (runDir) => ({
        requestExists: existsSync(join(runDir, 'reports', 'relay.request.txt')),
        receiptExists: existsSync(join(runDir, 'reports', 'relay.receipt.txt')),
        resultExists: existsSync(join(runDir, 'reports', 'relay.result.json')),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.verdict).toBeUndefined();
    expect(resultJson.verdict).toBeUndefined();
    expect(inspection).toEqual({
      requestExists: true,
      receiptExists: true,
      resultExists: true,
    });
    expect(trace.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'relay.started',
      'relay.request',
      'relay.receipt',
      'relay.result',
      'relay.completed',
      'check.evaluated',
      'step.aborted',
      'run.closed',
    ]);
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'step.completed', step_id: 'relay-step' }),
    );
  });

  it('records production relay failure entries without completed relay evidence on connector throws', async () => {
    const throwingRelayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async () => {
        throw new Error('connector sequence fail');
      },
    };
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      resultBody: '{"verdict":"unused"}',
      runId: 'ffffffff-aaaa-4fff-8fff-ffffffffaaaa',
      relayer: throwingRelayer,
      inspectRunDir: async (runDir) => ({
        requestExists: existsSync(join(runDir, 'reports', 'relay.request.txt')),
        receiptExists: existsSync(join(runDir, 'reports', 'relay.receipt.txt')),
        resultExists: existsSync(join(runDir, 'reports', 'relay.result.json')),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain('connector sequence fail');
    expect(resultJson.verdict).toBeUndefined();
    expect(inspection).toEqual({
      requestExists: true,
      receiptExists: false,
      resultExists: false,
    });
    expect(trace.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'relay.started',
      'relay.request',
      'relay.failed',
      'step.aborted',
      'run.closed',
    ]);
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'relay.completed', step_id: 'relay-step' }),
    );
  });

  it('routes a failed relay check through a declared recovery route without admitting its verdict', async () => {
    const { result, trace, resultJson } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        pass: ['accept'],
        routes: { pass: '@complete', retry: '@stop' },
      }),
      resultBody: '{"verdict":"reject"}',
      runId: 'ffffffff-1111-4fff-8fff-ffffffff1111',
    });

    expect(result.outcome).toBe('stopped');
    expect(result.verdict).toBeUndefined();
    expect(resultJson.verdict).toBeUndefined();
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'relay.completed',
          step_id: 'relay-step',
          verdict: 'reject',
        }),
        expect.objectContaining({
          kind: 'check.evaluated',
          step_id: 'relay-step',
          outcome: 'fail',
          reason: expect.stringMatching(/not in check\.pass/),
        }),
        expect.objectContaining({
          kind: 'step.completed',
          step_id: 'relay-step',
          route_taken: 'retry',
        }),
        expect.objectContaining({
          kind: 'run.closed',
          outcome: 'stopped',
        }),
      ]),
    );
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'step.aborted', step_id: 'relay-step' }),
    );
  });

  it('keeps transcript evidence and writes the canonical report on failed relay admission when body parses', async () => {
    const report = { path: 'reports/relay-canonical.json', schema: 'runtime-proof-canonical@v1' };
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        pass: ['accept'],
        report,
      }),
      resultBody: '{"verdict":"reject"}',
      runId: 'ffffffff-2222-4fff-8fff-ffffffff2222',
      inspectRunDir: async (runDir) => ({
        requestExists: existsSync(join(runDir, 'reports', 'relay.request.txt')),
        receiptExists: existsSync(join(runDir, 'reports', 'relay.receipt.txt')),
        resultExists: existsSync(join(runDir, 'reports', 'relay.result.json')),
        reportExists: existsSync(join(runDir, report.path)),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.verdict).toBeUndefined();
    expect(resultJson.verdict).toBeUndefined();
    // The verdict check fails ('reject' is not in pass=['accept']), but the
    // body parses against runtime-proof-canonical@v1, so the schema-tied
    // report is still materialized for downstream readers.
    expect(inspection).toEqual({
      requestExists: true,
      receiptExists: true,
      resultExists: true,
      reportExists: true,
    });

    const relayCompleted = trace.find(
      (entry) => entry.kind === 'relay.completed' && entry.step_id === 'relay-step',
    );
    expect(relayCompleted).toMatchObject({
      kind: 'relay.completed',
      verdict: 'reject',
    });
  });

  it('writes the canonical report only after relay admission passes', async () => {
    const report = { path: 'reports/relay-canonical.json', schema: 'runtime-proof-canonical@v1' };
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        report,
      }),
      resultBody: '{"verdict":"ok","summary":"accepted"}',
      runId: 'ffffffff-3333-4fff-8fff-ffffffff3333',
      inspectRunDir: async (runDir) => ({
        reportExists: existsSync(join(runDir, report.path)),
        reportBody: JSON.parse(await readFile(join(runDir, report.path), 'utf8')),
      }),
    });

    expect(result.outcome).toBe('complete');
    expect(result.verdict).toBe('ok');
    expect(resultJson.verdict).toBe('ok');
    expect(inspection).toEqual({
      reportExists: true,
      reportBody: { verdict: 'ok', summary: 'accepted' },
    });
    expect(trace).toContainEqual(
      expect.objectContaining({
        kind: 'relay.completed',
        step_id: 'relay-step',
        verdict: 'ok',
      }),
    );
  });

  it('hard-fails relay acceptance criteria without writing the canonical report', async () => {
    const report = { path: 'reports/relay-canonical.json', schema: 'runtime-proof-canonical@v1' };
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        report,
        acceptanceCriteria: {
          checks: [
            {
              kind: 'report_field',
              id: 'evidence-non-empty',
              path: ['evidence'],
              predicate: 'non_empty',
            },
          ],
        },
      }),
      resultBody: '{"verdict":"ok","evidence":[]}',
      runId: 'ffffffff-5555-4fff-8fff-ffffffff5555',
      inspectRunDir: async (runDir) => ({
        reportExists: existsSync(join(runDir, report.path)),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain('evidence-non-empty');
    expect(resultJson.outcome).toBe('aborted');
    expect(resultJson.reason).toContain('evidence-non-empty');
    expect(inspection).toEqual({ reportExists: false });
    expect(trace.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'relay.started',
      'relay.request',
      'relay.receipt',
      'relay.result',
      'relay.completed',
      'check.evaluated',
      'check.evaluated',
      'step.aborted',
      'run.closed',
    ]);
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'check.evaluated',
          step_id: 'relay-step',
          check_kind: 'result_verdict',
          outcome: 'pass',
        }),
        expect.objectContaining({
          kind: 'check.evaluated',
          step_id: 'relay-step',
          check_kind: 'acceptance_criteria',
          criterion_id: 'evidence-non-empty',
          criterion_kind: 'report_field',
          outcome: 'fail',
          reason: expect.stringContaining('evidence-non-empty'),
        }),
      ]),
    );
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'step.completed', step_id: 'relay-step' }),
    );
  });

  it('records command acceptance criteria output in the trace', async () => {
    const { result, trace } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        acceptanceCriteria: {
          checks: [
            {
              kind: 'command',
              id: 'command-must-pass',
              expected_status: 'passed',
              command: {
                id: 'node-fails',
                cwd: '.',
                argv: [
                  process.execPath,
                  '-e',
                  'console.log("bad output"); console.error("bad error"); process.exit(1);',
                ],
                timeout_ms: 5000,
                max_output_bytes: 256,
                env: {},
              },
            },
          ],
        },
      }),
      resultBody: '{"verdict":"ok"}',
      runId: 'ffffffff-6666-4fff-8fff-ffffffff6666',
      projectRootForRunDir: async (runDir) => runDir,
    });

    expect(result.outcome).toBe('aborted');
    expect(trace).toContainEqual(
      expect.objectContaining({
        kind: 'check.evaluated',
        step_id: 'relay-step',
        check_kind: 'acceptance_criteria',
        criterion_id: 'command-must-pass',
        criterion_kind: 'command',
        outcome: 'fail',
        exit_code: 1,
        status: 'failed',
        stdout_summary: expect.stringContaining('bad output'),
        stderr_summary: expect.stringContaining('bad error'),
      }),
    );
  });

  it('retries relay acceptance criteria with feedback through the existing retry route', async () => {
    const report = { path: 'reports/relay-canonical.json', schema: 'runtime-proof-canonical@v1' };
    const prompts: string[] = [];
    const relayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async (input): Promise<RelayResult> => {
        prompts.push(input.prompt);
        const resultBody =
          prompts.length === 1
            ? '{"verdict":"ok","evidence":[]}'
            : '{"verdict":"ok","evidence":["fixed"]}';
        return {
          request_payload: input.prompt,
          receipt_id: `runtime-control-loop-relay-${prompts.length}`,
          result_body: resultBody,
          duration_ms: 0,
          cli_version: 'test-relayer',
        };
      },
    };

    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        routes: { pass: '@complete', retry: 'relay-step' },
        report,
        acceptanceCriteria: {
          checks: [
            {
              kind: 'report_field',
              id: 'evidence-non-empty',
              path: ['evidence'],
              predicate: 'non_empty',
            },
          ],
          on_failure: { mode: 'retry-with-feedback' },
        },
      }),
      resultBody: '{"verdict":"unused"}',
      runId: 'ffffffff-7777-4fff-8fff-ffffffff7777',
      relayer,
      inspectRunDir: async (runDir) => ({
        reportBody: JSON.parse(await readFile(join(runDir, report.path), 'utf8')),
      }),
    });

    expect(result.outcome).toBe('complete');
    expect(result.verdict).toBe('ok');
    expect(resultJson.verdict).toBe('ok');
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toContain('Acceptance Criteria:');
    expect(prompts[0]).not.toContain('Acceptance Criteria Feedback:');
    expect(prompts[1]).toContain('Acceptance Criteria Feedback:');
    expect(prompts[1]).toContain('evidence-non-empty');
    expect(inspection).toEqual({
      reportBody: { verdict: 'ok', evidence: ['fixed'] },
    });
    expect(
      trace
        .filter((entry) => entry.kind === 'check.evaluated')
        .map((entry) => [entry.check_kind, entry.outcome]),
    ).toEqual([
      ['result_verdict', 'pass'],
      ['acceptance_criteria', 'fail'],
      ['result_verdict', 'pass'],
      ['acceptance_criteria', 'pass'],
    ]);
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'step.completed',
          step_id: 'relay-step',
          attempt: 1,
          route_taken: 'retry',
        }),
        expect.objectContaining({
          kind: 'step.completed',
          step_id: 'relay-step',
          attempt: 2,
          route_taken: 'pass',
        }),
      ]),
    );
  });

  it('bounds relay acceptance retries with the existing max_attempts budget', async () => {
    const report = { path: 'reports/relay-canonical.json', schema: 'runtime-proof-canonical@v1' };
    const prompts: string[] = [];
    const relayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async (input): Promise<RelayResult> => {
        prompts.push(input.prompt);
        return {
          request_payload: input.prompt,
          receipt_id: `runtime-control-loop-relay-${prompts.length}`,
          result_body: '{"verdict":"ok","evidence":[]}',
          duration_ms: 0,
          cli_version: 'test-relayer',
        };
      },
    };

    const { result, trace, resultJson } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        routes: { pass: '@complete', retry: 'relay-step' },
        budgets: { max_attempts: 2 },
        report,
        acceptanceCriteria: {
          checks: [
            {
              kind: 'report_field',
              id: 'evidence-non-empty',
              path: ['evidence'],
              predicate: 'non_empty',
            },
          ],
          on_failure: { mode: 'retry-with-feedback' },
        },
      }),
      resultBody: '{"verdict":"unused"}',
      runId: 'ffffffff-8888-4fff-8fff-ffffffff8888',
      relayer,
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toContain("route 'retry' for step 'relay-step' exhausted max_attempts=2");
    expect(resultJson.outcome).toBe('aborted');
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).not.toContain('Acceptance Criteria Feedback:');
    expect(prompts[1]).toContain('Acceptance Criteria Feedback:');
    expect(
      trace
        .filter(
          (entry) => entry.kind === 'check.evaluated' && entry.check_kind === 'acceptance_criteria',
        )
        .map((entry) => ({ attempt: entry.attempt, outcome: entry.outcome })),
    ).toEqual([
      { attempt: 1, outcome: 'fail' },
      { attempt: 2, outcome: 'fail' },
    ]);
    expect(trace).toContainEqual(
      expect.objectContaining({
        kind: 'step.aborted',
        step_id: 'relay-step',
        attempt: 3,
        reason: expect.stringContaining('max_attempts=2'),
      }),
    );
  });

  it('does not trace relay completion when the canonical report write fails', async () => {
    const report = {
      path: 'reports/relay.request.txt/canonical.json',
      schema: 'runtime-proof-canonical@v1',
    };
    const { result, trace, resultJson, inspection } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        report,
      }),
      resultBody: '{"verdict":"ok","summary":"accepted"}',
      runId: 'ffffffff-4444-4fff-8fff-ffffffff4444',
      inspectRunDir: async (runDir) => ({
        requestExists: existsSync(join(runDir, 'reports', 'relay.request.txt')),
        receiptExists: existsSync(join(runDir, 'reports', 'relay.receipt.txt')),
        resultExists: existsSync(join(runDir, 'reports', 'relay.result.json')),
        reportExists: existsSync(join(runDir, report.path)),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/relay\.request\.txt/);
    expect(resultJson.outcome).toBe('aborted');
    expect(inspection).toEqual({
      requestExists: true,
      receiptExists: true,
      resultExists: true,
      reportExists: false,
    });
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'relay.completed', step_id: 'relay-step' }),
    );
    expect(trace).toContainEqual(
      expect.objectContaining({ kind: 'step.aborted', step_id: 'relay-step' }),
    );
  });

  it('routes connector invocation failures through declared recovery with no admitted verdict', async () => {
    const throwingRelayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async () => {
        throw new Error('connector boom');
      },
    };
    const { result, trace, resultJson } = await runRuntimeProofRelayCase({
      flowBytes: relayFlowBytes({
        routes: { pass: '@complete', retry: '@stop' },
      }),
      resultBody: '{"verdict":"unused"}',
      runId: 'ffffffff-4444-4fff-8fff-ffffffff4444',
      relayer: throwingRelayer,
    });

    expect(result.outcome).toBe('stopped');
    expect(result.verdict).toBeUndefined();
    expect(resultJson.verdict).toBeUndefined();
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'relay.failed',
          step_id: 'relay-step',
          reason: expect.stringContaining('connector boom'),
        }),
        expect.objectContaining({
          kind: 'step.completed',
          step_id: 'relay-step',
          route_taken: 'retry',
        }),
        expect.objectContaining({
          kind: 'run.closed',
          outcome: 'stopped',
        }),
      ]),
    );
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'relay.completed', step_id: 'relay-step' }),
    );
  });

  it('aborts connector invocation failures without recovery and leaves final verdict empty', async () => {
    const throwingRelayer: RelayFn = {
      connectorName: 'claude-code',
      relay: async () => {
        throw new Error('connector hard fail');
      },
    };
    const { result, trace, resultJson } = await runRuntimeProofRelayCase({
      resultBody: '{"verdict":"unused"}',
      runId: 'ffffffff-5555-4fff-8fff-ffffffff5555',
      relayer: throwingRelayer,
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/connector hard fail/);
    expect(result.verdict).toBeUndefined();
    expect(resultJson.verdict).toBeUndefined();
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'relay.failed',
          step_id: 'relay-step',
          reason: expect.stringContaining('connector hard fail'),
        }),
        expect.objectContaining({
          kind: 'step.aborted',
          step_id: 'relay-step',
          reason: expect.stringContaining('connector hard fail'),
        }),
      ]),
    );
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'relay.completed', step_id: 'relay-step' }),
    );
  });

  it('records verification projectRoot pre-write failures as check failures without writing reports', async () => {
    const { result, trace, resultJson, inspection } = await runCompiledV1BytesCase({
      flowBytes: verificationFlowBytes(),
      runId: 'ffffffff-6666-4fff-8fff-ffffffff6666',
      goal: 'prove runtime verification projectRoot failure evidence',
      inspectRunDir: async (runDir) => ({
        reportExists: existsSync(join(runDir, 'reports', 'verification.json')),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/requires projectRoot for project-relative cwd resolution/);
    expect(resultJson.outcome).toBe('aborted');
    expect(resultJson.reason).toBe(result.reason);
    expect(inspection).toEqual({ reportExists: false });
    expect(trace.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'check.evaluated',
      'step.aborted',
      'run.closed',
    ]);
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'check.evaluated',
          step_id: 'verification-step',
          check_kind: 'schema_sections',
          outcome: 'fail',
          reason: expect.stringMatching(/requires projectRoot for project-relative cwd resolution/),
        }),
        expect.objectContaining({
          kind: 'step.aborted',
          step_id: 'verification-step',
          reason: expect.stringMatching(/requires projectRoot/),
        }),
      ]),
    );
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'step.report_written', step_id: 'verification-step' }),
    );
  });

  it('records unsupported verification schemas as check failures without writing reports', async () => {
    const { result, trace, resultJson, inspection } = await runCompiledV1BytesCase({
      flowBytes: verificationFlowBytes('definitely-not-registered.verification@v9'),
      runId: 'ffffffff-7777-4fff-8fff-ffffffff7777',
      goal: 'prove runtime verification unsupported-schema failure evidence',
      projectRoot: process.cwd(),
      inspectRunDir: async (runDir) => ({
        reportExists: existsSync(join(runDir, 'reports', 'verification.json')),
      }),
    });

    expect(result.outcome).toBe('aborted');
    expect(result.reason).toMatch(/verification step 'verification-step': report writer failed/);
    expect(resultJson.outcome).toBe('aborted');
    expect(resultJson.reason).toBe(result.reason);
    expect(inspection).toEqual({ reportExists: false });
    expect(trace.map((entry) => entry.kind)).toEqual([
      'run.bootstrapped',
      'step.entered',
      'check.evaluated',
      'step.aborted',
      'run.closed',
    ]);
    expect(trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'check.evaluated',
          step_id: 'verification-step',
          check_kind: 'schema_sections',
          outcome: 'fail',
          reason: expect.stringMatching(/has unsupported report schema/),
        }),
        expect.objectContaining({
          kind: 'step.aborted',
          step_id: 'verification-step',
          reason: expect.stringMatching(/has unsupported report schema/),
        }),
      ]),
    );
    expect(trace).not.toContainEqual(
      expect.objectContaining({ kind: 'step.report_written', step_id: 'verification-step' }),
    );
  });
});
