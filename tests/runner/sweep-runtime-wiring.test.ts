import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import {
  SweepAnalysis,
  SweepBatch,
  SweepBrief,
  SweepQueue,
  SweepResult,
  SweepReview,
  SweepVerification,
} from '../../src/flows/sweep/reports.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'sweep', 'circuit.json');
const REPO_ROOT = resolve('.');

function loadFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'Sweep had typed reports but no live fixture proving the seven-canonical-stage stage path through the runtime',
    acceptance_evidence:
      'sweep-runtime-wiring runs the live Sweep fixture with stubbed worker relay and parses all six typed reports plus the close result',
    alternate_framing:
      'extend the build wiring test to cover Sweep — rejected because the substrate-proof claim is that Sweep stands on its own per-flow modules',
  };
}

const DEFAULT_ANALYSIS_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Two cleanup candidates surfaced',
  candidates: [
    {
      id: 'cand-1',
      category: 'dead-code',
      path: 'src/example.ts',
      description: 'Unused helper function',
      confidence: 'high',
      risk: 'low',
    },
    {
      id: 'cand-2',
      category: 'stale-docs',
      path: 'docs/old.md',
      description: 'Outdated doc paragraph',
      confidence: 'high',
      risk: 'low',
    },
  ],
});

const DEFAULT_BATCH_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Acted on both candidates',
  changed_files: ['src/example.ts', 'docs/old.md'],
  items: [
    {
      candidate_id: 'cand-1',
      status: 'acted',
      evidence: 'removed unused helper function',
    },
    {
      candidate_id: 'cand-2',
      status: 'acted',
      evidence: 'updated docs paragraph',
    },
  ],
});

const DEFAULT_REVIEW_BODY = JSON.stringify({
  verdict: 'clean',
  summary: 'No injections detected',
  findings: [],
});

function relayerWith(
  options: {
    analysisBody?: string;
    batchBody?: string;
    reviewBody?: string;
  } = {},
): RelayFn {
  const analysisBody = options.analysisBody ?? DEFAULT_ANALYSIS_BODY;
  const batchBody = options.batchBody ?? DEFAULT_BATCH_BODY;
  const reviewBody = options.reviewBody ?? DEFAULT_REVIEW_BODY;

  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      const isSurvey = input.prompt.includes('Step: survey-step');
      const isExecute = input.prompt.includes('Step: execute-step');
      const isReview = input.prompt.includes('Step: review-step');
      expect(isSurvey || isExecute || isReview).toBe(true);
      expect(input.prompt).toContain('Respond with a single raw JSON object');
      const result_body = isSurvey ? analysisBody : isExecute ? batchBody : reviewBody;
      const receipt_id = isSurvey
        ? 'stub-sweep-survey'
        : isExecute
          ? 'stub-sweep-execute'
          : 'stub-sweep-review';
      return {
        request_payload: input.prompt,
        receipt_id,
        result_body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

function traceEntryLabel(trace_entry: { kind: string; step_id?: unknown }): string {
  return typeof trace_entry.step_id === 'string'
    ? `${trace_entry.kind}:${trace_entry.step_id}`
    : trace_entry.kind;
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-sweep-runtime-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('Sweep runtime wiring', () => {
  it('declares the seven-canonical-stage stage path with default, lite, deep, and autonomous entry modes', () => {
    const { flow } = loadFixture();
    expect(flow.entry_modes.map((mode) => mode.name)).toEqual([
      'default',
      'lite',
      'deep',
      'autonomous',
    ]);
    expect(flow.stages.map((stage) => stage.canonical)).toEqual([
      'frame',
      'analyze',
      'plan',
      'act',
      'verify',
      'review',
      'close',
    ]);
    const stepsById = new Map(flow.steps.map((step) => [step.id as unknown as string, step]));
    const visited: string[] = [];
    let current: string | undefined = flow.entry_modes[0]?.start_at as unknown as string;
    while (current !== undefined && !current.startsWith('@')) {
      visited.push(current);
      current = stepsById.get(current)?.routes.pass;
    }
    expect(visited).toEqual([
      'frame-step',
      'survey-step',
      'triage-step',
      'triage-checkpoint-step',
      'execute-step',
      'verify-step',
      'review-step',
      'close-step',
    ]);
  });

  it('runs the live Sweep fixture through compose, relay, verification, and close — proving the substrate composes a second flow with no runner.ts edits', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'complete');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('57000000-0000-0000-0000-000000000000'),
      goal: 'Sweep dead code from src/example',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 9, 0, 0)),
      relayer: relayerWith(),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');
    const labels = outcome.trace_entries.map(traceEntryLabel);
    expect(labels).toContain('relay.completed:survey-step');
    expect(labels).toContain('checkpoint.resolved:triage-checkpoint-step');
    expect(labels).toContain('relay.completed:execute-step');
    expect(labels).toContain('relay.completed:review-step');

    const brief = SweepBrief.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/brief.json'), 'utf8')),
    );
    expect(brief.objective).toBe('Sweep dead code from src/example');
    expect(brief.sweep_type).toBe('cleanup');

    const analysis = SweepAnalysis.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/analysis.json'), 'utf8')),
    );
    expect(analysis.candidates.map((c) => c.id)).toEqual(['cand-1', 'cand-2']);

    const queue = SweepQueue.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/queue.json'), 'utf8')),
    );
    expect(queue.classified.map((item) => item.action)).toEqual(['act', 'act']);
    expect(queue.to_execute).toEqual(['cand-1', 'cand-2']);
    expect(queue.deferred).toEqual([]);

    const batch = SweepBatch.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/batch.json'), 'utf8')),
    );
    expect(batch.verdict).toBe('accept');
    expect(batch.items).toHaveLength(2);

    const verification = SweepVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/verification.json'), 'utf8')),
    );
    expect(verification.overall_status).toBe('passed');
    expect(verification.commands[0]?.argv).toEqual(['npm', 'run', 'check']);

    const review = SweepReview.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/review.json'), 'utf8')),
    );
    expect(review.verdict).toBe('clean');

    const result = SweepResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('complete');
    expect(result.review_verdict).toBe('clean');
    expect(result.deferred_count).toBe(0);
    expect(result.evidence_links.map((p) => p.report_id)).toEqual([
      'sweep.brief',
      'sweep.analysis',
      'sweep.queue',
      'sweep.batch',
      'sweep.verification',
      'sweep.review',
    ]);
  });

  it('defers low-confidence high-risk candidates and surfaces deferred_count in the close result', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'deferred');

    const analysisWithDeferred = JSON.stringify({
      verdict: 'accept',
      summary: 'Mixed confidence/risk surface',
      candidates: [
        {
          id: 'safe-1',
          category: 'dead-code',
          path: 'src/safe.ts',
          description: 'Unused export',
          confidence: 'high',
          risk: 'low',
        },
        {
          id: 'risky-1',
          category: 'redundant-abstraction',
          path: 'src/risky.ts',
          description: 'Possibly load-bearing wrapper',
          confidence: 'low',
          risk: 'high',
        },
      ],
    });

    const batchActsOnSafeOnly = JSON.stringify({
      verdict: 'accept',
      summary: 'Acted on safe candidate, deferred risky',
      changed_files: ['src/safe.ts'],
      items: [
        {
          candidate_id: 'safe-1',
          status: 'acted',
          evidence: 'removed unused export',
        },
      ],
    });

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('57000000-0000-0000-0000-000000000001'),
      goal: 'Sweep with deferred items',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 10, 0, 0)),
      relayer: relayerWith({
        analysisBody: analysisWithDeferred,
        batchBody: batchActsOnSafeOnly,
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('complete');

    const queue = SweepQueue.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep/queue.json'), 'utf8')),
    );
    expect(queue.deferred).toEqual(['risky-1']);
    expect(queue.to_execute).toEqual(['safe-1']);

    const result = SweepResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/sweep-result.json'), 'utf8')),
    );
    expect(result.deferred_count).toBe(1);
  });

  it('aborts when survey relay passes the verdict check but fails sweep.analysis@v1 parsing', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'bad-analysis');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('57000000-0000-0000-0000-000000000002'),
      goal: 'Reject malformed analysis report',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 11, 0, 0)),
      relayer: relayerWith({
        analysisBody: JSON.stringify({
          verdict: 'accept',
          summary: 'Missing candidates field',
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/sweep\.analysis@v1/);
    expect(existsSync(join(runFolder, 'reports/sweep/analysis.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/relay/sweep-survey.result.json'))).toBe(true);
  });

  it('aborts on critical-injections review verdict before writing the canonical Sweep review report', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'review-critical');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('57000000-0000-0000-0000-000000000003'),
      goal: 'Reject a Sweep with critical injections',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 12, 0, 0)),
      relayer: relayerWith({
        reviewBody: JSON.stringify({
          verdict: 'critical-injections',
          summary: 'Sweep introduced a regression',
          findings: [
            {
              severity: 'critical',
              text: 'Removed export was load-bearing',
              file_refs: ['src/example.ts:1'],
            },
          ],
        }),
      }),
      projectRoot: REPO_ROOT,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toMatch(/critical-injections/);
    expect(existsSync(join(runFolder, 'reports/sweep/review.json'))).toBe(false);
    expect(existsSync(join(runFolder, 'reports/relay/sweep-review.result.json'))).toBe(true);
  });
});
