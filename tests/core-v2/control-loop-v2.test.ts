import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TerminalTarget } from '../../src/core-v2/domain/route.js';
import type { ExecutableFlowV2 } from '../../src/core-v2/manifest/executable-flow.js';
import { runCompiledFlowV2 } from '../../src/core-v2/run/compiled-flow-runner.js';
import { executeExecutableFlowV2 } from '../../src/core-v2/run/graph-runner.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
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

function terminalFlow(target: TerminalTarget): ExecutableFlowV2 {
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
  readonly report?: { readonly path: string; readonly schema: string };
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
      id: 'core-v2-relay-check',
      version: '0.1.0',
      purpose: 'Core-v2 control-loop fixture for relay check admission.',
      entry: {
        signals: { include: ['core-v2-relay-check'], exclude: [] },
        intent_prefixes: ['core-v2-relay-check'],
      },
      entry_modes: [
        {
          name: 'default',
          start_at: 'relay-step',
          depth: 'standard',
          description: 'Start directly at the relay step.',
        },
      ],
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
          protocol: 'core-v2-relay-check@v1',
          reads: [],
          routes,
          executor: 'worker',
          kind: 'relay',
          role: 'reviewer',
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
      id: 'core-v2-checkpoint-routes',
      version: '0.1.0',
      purpose: 'Core-v2 control-loop fixture for checkpoint route labels.',
      entry: {
        signals: { include: ['core-v2-checkpoint-routes'], exclude: [] },
        intent_prefixes: ['core-v2-checkpoint-routes'],
      },
      entry_modes: [
        {
          name: 'default',
          start_at: 'checkpoint-step',
          depth: 'standard',
          description: 'Auto-resolve a checkpoint route label.',
        },
      ],
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
          protocol: 'core-v2-checkpoint-routes@v1',
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
      id: 'core-v2-checkpoint-retry-loop',
      version: '0.1.0',
      purpose: 'Core-v2 control-loop fixture for bounded checkpoint retry routes.',
      entry: {
        signals: { include: ['core-v2-checkpoint-retry-loop'], exclude: [] },
        intent_prefixes: ['core-v2-checkpoint-retry-loop'],
      },
      entry_modes: [
        {
          name: 'default',
          start_at: 'checkpoint-step',
          depth: 'standard',
          description: 'Auto-resolve retry until the route budget is exhausted.',
        },
      ],
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
          protocol: 'core-v2-checkpoint-retry-loop@v1',
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

function verificationFlowBytes(reportSchema = 'never-registered.verification@v1'): Buffer {
  return Buffer.from(
    JSON.stringify({
      schema_version: '2',
      id: 'core-v2-verification-failure',
      version: '0.1.0',
      purpose: 'Core-v2 control-loop fixture for verification pre-write failure evidence.',
      entry: {
        signals: { include: ['core-v2-verification-failure'], exclude: [] },
        intent_prefixes: ['core-v2-verification-failure'],
      },
      entry_modes: [
        {
          name: 'default',
          start_at: 'verification-step',
          depth: 'standard',
          description: 'Start directly at the verification step.',
        },
      ],
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
          protocol: 'core-v2-verification-failure@v1',
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
      receipt_id: 'core-v2-control-loop-relay',
      result_body: resultBody,
      duration_ms: 0,
      cli_version: 'test-relayer',
    }),
  };
}

async function runRuntimeProofRelayCase(input: {
  readonly resultBody: string;
  readonly runId: string;
  readonly flowBytes?: Buffer;
  readonly connectorName?: string;
  readonly relayer?: RelayFn;
  readonly inspectRunDir?: (runDir: string) => Promise<unknown>;
}) {
  return await withTempRun('circuit-core-v2-control-loop-', async (runDir) => {
    const result = await runCompiledFlowV2({
      flowBytes: input.flowBytes ?? relayFlowBytes(),
      runDir,
      runId: input.runId,
      goal: 'prove core-v2 relay check admission',
      now: () => new Date('2026-05-06T00:00:00.000Z'),
      relayer: input.relayer ?? relayerWith(input.resultBody, input.connectorName),
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

async function runCompiledV1BytesCase(input: {
  readonly flowBytes: Buffer;
  readonly runId: string;
  readonly goal: string;
  readonly projectRoot?: string;
  readonly inspectRunDir?: (runDir: string) => Promise<unknown>;
}) {
  return await withTempRun('circuit-core-v2-control-loop-', async (runDir) => {
    const result = await runCompiledFlowV2({
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

describe('core-v2 control-loop parity twins', () => {
  it('maps every terminal target to the retained terminal outcome vocabulary', async () => {
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
      await withTempRun('circuit-core-v2-terminal-', async (runDir) => {
        const result = await executeExecutableFlowV2(terminalFlow(target), {
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
          data: { outcome, terminal_target: target },
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
          data: { admitted: true },
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
          data: expect.objectContaining({
            connector: { kind: 'builtin', name: 'codex' },
            resolved_from: { source: 'explicit' },
            role: 'reviewer',
          }),
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
            data: { admitted: false },
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
          data: { admitted: false },
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

  it('keeps transcript evidence but omits the canonical report on failed relay admission', async () => {
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
    expect(inspection).toEqual({
      requestExists: true,
      receiptExists: true,
      resultExists: true,
      reportExists: false,
    });

    const relayCompleted = trace.find(
      (entry) => entry.kind === 'relay.completed' && entry.step_id === 'relay-step',
    );
    expect(relayCompleted).toMatchObject({
      kind: 'relay.completed',
      verdict: 'reject',
      data: { admitted: false },
    });
    expect(relayCompleted).not.toHaveProperty('report_path');
  });

  it('writes the canonical report and report_path only after relay admission passes', async () => {
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
        report_path: report.path,
        data: { admitted: true },
      }),
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
      goal: 'prove core-v2 verification projectRoot failure evidence',
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
      goal: 'prove core-v2 verification unsupported-schema failure evidence',
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
