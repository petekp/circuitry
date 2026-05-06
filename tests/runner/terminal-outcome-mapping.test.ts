import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  runRetainedCompiledFlow as runCompiledFlow,
  writeRetainedPrototypeComposeReport as writePrototypeComposeReport,
} from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { readRunTrace } from '../../src/runtime/trace-reader.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { RunProjection } from '../../src/schemas/run.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { RunClosedOutcome } from '../../src/schemas/trace-entry.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

type TerminalRoute = '@complete' | '@stop' | '@escalate' | '@handoff';
type RichRoute = 'ask' | 'retry' | 'revise' | 'stop' | 'handoff' | 'escalate';

const CASES: Array<{
  route: TerminalRoute;
  outcome: RunClosedOutcome;
  runId: string;
  reason?: string;
}> = [
  {
    route: '@complete',
    outcome: 'complete',
    runId: '73000000-0000-0000-0000-000000000001',
  },
  {
    route: '@stop',
    outcome: 'stopped',
    runId: '73000000-0000-0000-0000-000000000002',
    reason: 'terminal route @stop',
  },
  {
    route: '@escalate',
    outcome: 'escalated',
    runId: '73000000-0000-0000-0000-000000000003',
    reason: 'terminal route @escalate',
  },
  {
    route: '@handoff',
    outcome: 'handoff',
    runId: '73000000-0000-0000-0000-000000000004',
    reason: 'terminal route @handoff',
  },
];

function terminalCompiledFlow(route: TerminalRoute): { flow: CompiledFlow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'terminal-outcome-flow',
    version: '0.1.0',
    purpose: 'Runtime regression fixture for terminal route outcome mapping.',
    entry: {
      signals: { include: ['terminal-outcome'], exclude: [] },
      intent_prefixes: ['terminal-outcome'],
    },
    entry_modes: [
      {
        name: 'default',
        start_at: 'terminal-step',
        depth: 'standard',
        description: 'Start at the only step so the pass route reaches a terminal immediately.',
      },
    ],
    stages: [
      {
        id: 'plan-stage',
        title: 'Plan',
        canonical: 'plan',
        steps: ['terminal-step'],
      },
    ],
    steps: [
      {
        id: 'terminal-step',
        title: 'Terminal route step',
        protocol: 'terminal-outcome@v1',
        reads: [],
        routes: { pass: route },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: {
            path: 'reports/terminal.json',
            schema: 'terminal-outcome@v1',
          },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary'],
        },
      },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'One-step terminal route regression keeps this fixture focused on run closure.',
    },
  };
  const flow = CompiledFlow.parse(raw);
  return { flow, bytes: Buffer.from(JSON.stringify(flow)) };
}

function richCheckpointRouteCompiledFlow(route: RichRoute): { flow: CompiledFlow; bytes: Buffer } {
  const targetByRoute: Record<RichRoute, string> = {
    ask: 'ask-step',
    retry: 'retry-step',
    revise: 'revise-step',
    stop: '@stop',
    handoff: '@handoff',
    escalate: '@escalate',
  };
  const routeSteps = (['ask', 'retry', 'revise'] as const).map((id) => ({
    id: `${id}-step`,
    title: `${id} follow-up`,
    protocol: `rich-route-${id}@v1`,
    reads: [],
    routes: { pass: '@complete' },
    executor: 'orchestrator',
    kind: 'compose',
    writes: {
      report: {
        path: `reports/${id}.json`,
        schema: 'terminal-outcome@v1',
      },
    },
    check: {
      kind: 'schema_sections',
      source: { kind: 'report', ref: 'report' },
      required: ['summary'],
    },
  }));
  const raw = {
    schema_version: '2',
    id: 'rich-route-flow',
    version: '0.1.0',
    purpose: 'Runtime regression fixture for rich checkpoint route labels.',
    entry: {
      signals: { include: ['rich-route'], exclude: [] },
      intent_prefixes: ['rich-route'],
    },
    entry_modes: [
      {
        name: 'default',
        start_at: 'checkpoint-step',
        depth: 'standard',
        description: 'Auto-select one rich checkpoint route.',
      },
    ],
    stages: [
      {
        id: 'plan-stage',
        title: 'Plan',
        canonical: 'plan',
        steps: ['checkpoint-step', 'ask-step', 'retry-step', 'revise-step'],
      },
    ],
    steps: [
      {
        id: 'checkpoint-step',
        title: 'Choose rich route',
        protocol: 'rich-route-checkpoint@v1',
        reads: [],
        routes: {
          pass: '@complete',
          ask: targetByRoute.ask,
          retry: targetByRoute.retry,
          revise: targetByRoute.revise,
          stop: targetByRoute.stop,
          handoff: targetByRoute.handoff,
          escalate: targetByRoute.escalate,
        },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy: {
          prompt: 'Choose the route to test',
          choices: [
            { id: 'ask' },
            { id: 'retry' },
            { id: 'revise' },
            { id: 'stop' },
            { id: 'handoff' },
            { id: 'escalate' },
          ],
          safe_default_choice: route,
          safe_autonomous_choice: route,
        },
        writes: {
          request: 'reports/checkpoints/rich-route-request.json',
          response: 'reports/checkpoints/rich-route-response.json',
        },
        check: {
          kind: 'checkpoint_selection',
          source: { kind: 'checkpoint_response', ref: 'response' },
          allow: ['ask', 'retry', 'revise', 'stop', 'handoff', 'escalate'],
        },
      },
      ...routeSteps,
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'One-stage rich route regression fixture.',
    },
  };
  const flow = CompiledFlow.parse(raw);
  return { flow, bytes: Buffer.from(JSON.stringify(flow)) };
}

function retryLoopCompiledFlow(): { flow: CompiledFlow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'retry-loop-flow',
    version: '0.1.0',
    purpose: 'Runtime regression fixture for bounded retry routes.',
    entry: {
      signals: { include: ['retry-loop'], exclude: [] },
      intent_prefixes: ['retry-loop'],
    },
    entry_modes: [
      {
        name: 'default',
        start_at: 'checkpoint-step',
        depth: 'standard',
        description: 'Auto-select retry until the route budget is exhausted.',
      },
    ],
    stages: [
      {
        id: 'plan-stage',
        title: 'Plan',
        canonical: 'plan',
        steps: ['checkpoint-step'],
      },
    ],
    steps: [
      {
        id: 'checkpoint-step',
        title: 'Retry checkpoint',
        protocol: 'retry-loop-checkpoint@v1',
        reads: [],
        routes: { pass: '@complete', retry: 'checkpoint-step' },
        budgets: { max_attempts: 2 },
        executor: 'orchestrator',
        kind: 'checkpoint',
        policy: {
          prompt: 'Retry until bounded',
          choices: [{ id: 'retry' }],
          safe_default_choice: 'retry',
          safe_autonomous_choice: 'retry',
        },
        writes: {
          request: 'reports/checkpoints/retry-loop-request.json',
          response: 'reports/checkpoints/retry-loop-response.json',
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
      omits: ['frame', 'analyze', 'act', 'verify', 'review', 'close'],
      rationale: 'One-step retry loop regression fixture.',
    },
  };
  const flow = CompiledFlow.parse(raw);
  return { flow, bytes: Buffer.from(JSON.stringify(flow)) };
}

function relayFailureRecoveryCompiledFlow(): { flow: CompiledFlow; bytes: Buffer } {
  const raw = {
    schema_version: '2',
    id: 'relay-failure-recovery-flow',
    version: '0.1.0',
    purpose: 'Runtime regression fixture for failed relay recovery routes.',
    entry: {
      signals: { include: ['relay-recovery'], exclude: [] },
      intent_prefixes: ['relay-recovery'],
    },
    entry_modes: [
      {
        name: 'default',
        start_at: 'relay-step',
        depth: 'standard',
        description: 'Recover from a rejected relay verdict through retry route.',
      },
    ],
    stages: [
      {
        id: 'act-stage',
        title: 'Act',
        canonical: 'act',
        steps: ['relay-step', 'fallback-step'],
      },
    ],
    steps: [
      {
        id: 'relay-step',
        title: 'Rejecting relay',
        protocol: 'relay-recovery@v1',
        reads: [],
        routes: { pass: '@complete', retry: 'fallback-step', stop: '@stop' },
        executor: 'worker',
        kind: 'relay',
        role: 'implementer',
        writes: {
          request: 'reports/relay/request.txt',
          receipt: 'reports/relay/receipt.txt',
          result: 'reports/relay/result.json',
        },
        check: {
          kind: 'result_verdict',
          source: { kind: 'relay_result', ref: 'result' },
          pass: ['accept'],
        },
      },
      {
        id: 'fallback-step',
        title: 'Fallback after retry',
        protocol: 'relay-recovery-fallback@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: {
            path: 'reports/fallback.json',
            schema: 'terminal-outcome@v1',
          },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary'],
        },
      },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'One-stage relay recovery regression fixture.',
    },
  };
  const flow = CompiledFlow.parse(raw);
  return { flow, bytes: Buffer.from(JSON.stringify(flow)) };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'non-complete terminal routes closed as complete',
    acceptance_evidence:
      'terminal route labels map to matching run.closed outcome, state.json status, and result.json outcome',
    alternate_framing:
      'schema-only coverage — rejected because the bug lived in runner outcome selection after valid route parsing',
  };
}

function unusedRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (_input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: 'unused',
      receipt_id: 'unused',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-unused',
    }),
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-terminal-outcome-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('RUN-I7 terminal route outcome mapping', () => {
  for (const c of CASES) {
    it(`${c.route} closes with outcome=${c.outcome} across run.closed, state.json, RunProjection, and result.json`, async () => {
      const { flow, bytes } = terminalCompiledFlow(c.route);
      const runFolder = join(runFolderBase, c.outcome);
      const outcome = await runCompiledFlow({
        runFolder,
        flow,
        flowBytes: bytes,
        runId: RunId.parse(c.runId),
        goal: `terminal route ${c.route} maps honestly`,
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 20, 0, 0)),
        relayer: unusedRelayer(),
        composeWriter: writePrototypeComposeReport,
      });

      expect(outcome.result.outcome).toBe(c.outcome);
      expect(outcome.snapshot.status).toBe(c.outcome);
      expect(existsSync(join(runFolder, 'trace.ndjson'))).toBe(true);
      expect(existsSync(join(runFolder, 'state.json'))).toBe(true);
      expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

      expect(outcome.trace_entries.map((trace_entry) => trace_entry.kind)).toEqual([
        'run.bootstrapped',
        'step.entered',
        'step.report_written',
        'check.evaluated',
        'step.completed',
        'run.closed',
      ]);
      expect(
        outcome.trace_entries.find((trace_entry) => trace_entry.kind === 'relay.started'),
      ).toBeUndefined();

      const completed = outcome.trace_entries.find(
        (trace_entry) => trace_entry.kind === 'step.completed',
      );
      if (completed?.kind !== 'step.completed') throw new Error('expected step.completed');
      expect(completed.route_taken).toBe('pass');

      const closed = outcome.trace_entries[outcome.trace_entries.length - 1];
      if (closed?.kind !== 'run.closed') throw new Error('expected run.closed last');
      expect(closed.outcome).toBe(c.outcome);
      if (c.reason === undefined) {
        expect(closed.reason).toBeUndefined();
      } else {
        expect(closed.reason).toBe(c.reason);
        expect(closed.reason).not.toMatch(/treating as complete/i);
      }

      const snapshot = Snapshot.parse(
        JSON.parse(readFileSync(join(runFolder, 'state.json'), 'utf8')),
      );
      expect(snapshot.status).toBe(c.outcome);
      expect(snapshot.trace_entries_consumed).toBe(outcome.trace_entries.length);
      const projectedStep = snapshot.steps.find((step) => step.step_id === 'terminal-step');
      expect(projectedStep?.status).toBe('complete');
      expect(projectedStep?.last_route_taken).toBe('pass');

      const log = readRunTrace(runFolder);
      expect(log).toHaveLength(outcome.trace_entries.length);
      expect(RunProjection.safeParse({ log, snapshot }).success).toBe(true);

      const result = RunResult.parse(
        JSON.parse(readFileSync(join(runFolder, 'reports', 'result.json'), 'utf8')),
      );
      expect(result.outcome).toBe(c.outcome);
      expect(result.trace_entries_observed).toBe(log.length);
      expect(result.reason).toBe(c.reason);
      if (result.reason !== undefined) {
        expect(result.reason).not.toMatch(/treating as complete/i);
      }
    });
  }
});

describe('REL-003 rich route execution', () => {
  const expectedTerminal: Partial<Record<RichRoute, RunClosedOutcome>> = {
    stop: 'stopped',
    handoff: 'handoff',
    escalate: 'escalated',
  };

  for (const route of ['ask', 'retry', 'revise', 'stop', 'handoff', 'escalate'] as const) {
    it(`executes checkpoint route '${route}' instead of collapsing it to pass`, async () => {
      const { flow, bytes } = richCheckpointRouteCompiledFlow(route);
      const runFolder = join(runFolderBase, `rich-${route}`);
      const outcome = await runCompiledFlow({
        runFolder,
        flow,
        flowBytes: bytes,
        runId: RunId.parse(`74000000-0000-0000-0000-00000000000${route.length}`),
        goal: `rich route ${route} maps honestly`,
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 21, 0, 0)),
        relayer: unusedRelayer(),
        composeWriter: writePrototypeComposeReport,
      });

      expect(outcome.result.outcome).toBe(expectedTerminal[route] ?? 'complete');
      const completed = outcome.trace_entries.find(
        (trace_entry) =>
          trace_entry.kind === 'step.completed' && trace_entry.step_id === 'checkpoint-step',
      );
      if (completed?.kind !== 'step.completed') throw new Error('expected checkpoint completion');
      expect(completed.route_taken).toBe(route);
      const snapshot = Snapshot.parse(
        JSON.parse(readFileSync(join(runFolder, 'state.json'), 'utf8')),
      );
      expect(snapshot.status).toBe(expectedTerminal[route] ?? 'complete');
      expect(RunProjection.safeParse({ log: readRunTrace(runFolder), snapshot }).success).toBe(
        true,
      );
    });
  }

  it('bounds retry loops by max_attempts instead of spinning forever', async () => {
    const { flow, bytes } = retryLoopCompiledFlow();
    const runFolder = join(runFolderBase, 'retry-loop');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('74000000-0000-0000-0000-000000000099'),
      goal: 'retry route stops after bounded attempts',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 22, 0, 0)),
      relayer: unusedRelayer(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain("route 'retry'");
    expect(outcome.result.reason).toContain('max_attempts=2');
    expect(
      outcome.trace_entries.filter(
        (trace_entry) =>
          trace_entry.kind === 'step.completed' && trace_entry.route_taken === 'retry',
      ),
    ).toHaveLength(2);
  });

  it('routes a failed relay check through retry when the step declares recovery', async () => {
    const { flow, bytes } = relayFailureRecoveryCompiledFlow();
    const runFolder = join(runFolderBase, 'relay-recovery');
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('74000000-0000-0000-0000-000000000100'),
      goal: 'relay check failure uses recovery route',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 24, 23, 0, 0)),
      relayer: {
        connectorName: 'claude-code',
        relay: async (): Promise<RelayResult> => ({
          request_payload: 'rejecting relay',
          receipt_id: 'rejecting-relay',
          result_body: '{"verdict":"reject"}',
          duration_ms: 1,
          cli_version: '0.0.0-test',
        }),
      },
      composeWriter: writePrototypeComposeReport,
    });

    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.trace_entries).toContainEqual(
      expect.objectContaining({
        kind: 'check.evaluated',
        step_id: 'relay-step',
        outcome: 'fail',
      }),
    );
    expect(outcome.trace_entries).toContainEqual(
      expect.objectContaining({
        kind: 'step.completed',
        step_id: 'relay-step',
        route_taken: 'retry',
      }),
    );
    expect(outcome.trace_entries).toContainEqual(
      expect.objectContaining({
        kind: 'step.completed',
        step_id: 'fallback-step',
        route_taken: 'pass',
      }),
    );
  });
});
