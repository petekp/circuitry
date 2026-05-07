import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resumeCompiledFlowV2 } from '../../src/core-v2/run/checkpoint-resume.js';
import { runCompiledFlowV2WithWaiting } from '../../src/core-v2/run/compiled-flow-runner.js';
import { isGraphCheckpointWaitingResultV2 } from '../../src/core-v2/run/graph-runner.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

const TOURNAMENT_FIXTURE_PATH = resolve('generated/flows/explore/tournament.json');

function loadTournamentFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(TOURNAMENT_FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function readJson(runFolder: string, path: string): unknown {
  return JSON.parse(readFileSync(join(runFolder, path), 'utf8'));
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function tournamentRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      if (input.prompt.includes('Step: proposal-fanout-step-option-1')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proposal-option-1',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-1',
            option_label: 'React',
            case_summary: 'Choose React for the broad ecosystem and hiring pool.',
            assumptions: ['The operator values ecosystem maturity.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['The larger ecosystem may add dependency sprawl.'],
            next_action: 'Run a Build plan for a React prototype.',
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-2')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proposal-option-2',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-2',
            option_label: 'Vue',
            case_summary: 'Choose Vue for a smaller surface and faster product iteration.',
            assumptions: ['The operator values implementation speed.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['Team familiarity may be thinner.'],
            next_action: 'Run a Build plan for a Vue prototype.',
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-3')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proposal-option-3',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-3',
            option_label: 'Hybrid path',
            case_summary: 'Prototype the shared requirements before locking the framework.',
            assumptions: ['A brief comparison prototype is affordable.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['The decision takes longer.'],
            next_action: 'Run a short Explore follow-up with prototype criteria.',
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: proposal-fanout-step-option-4')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'proposal-option-4',
          result_body: JSON.stringify({
            verdict: 'accept',
            option_id: 'option-4',
            option_label: 'Defer pending evidence',
            case_summary: 'Gather missing team and product constraints before choosing.',
            assumptions: ['The decision is reversible enough to pause briefly.'],
            evidence_refs: ['reports/decision-options.json'],
            risks: ['The project loses momentum.'],
            next_action: 'Collect the missing constraints and rerun the decision.',
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      expect(input.prompt).toContain('Step: stress-proposals-step');
      return {
        request_payload: input.prompt,
        receipt_id: 'proposal-review',
        result_body: JSON.stringify({
          verdict: 'recommend',
          recommended_option_id: 'option-1',
          comparison: 'React is safer on ecosystem depth, while Vue is faster to shape.',
          objections: ['Vue depends more on team-specific familiarity.'],
          missing_evidence: ['No implementation spike was gathered.'],
          tradeoff_question: 'Choose React ecosystem depth or Vue iteration speed.',
          confidence: 'medium',
        }),
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-explore-tournament-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('explore tournament runtime', () => {
  it('keeps tournament review inside the Decision stage and not as canonical Review', () => {
    const { flow } = loadTournamentFixture();
    expect(flow.stages.map((stage) => stage.canonical)).toEqual([
      'frame',
      'analyze',
      'plan',
      'close',
    ]);
    const decisionStage = flow.stages.find((stage) => stage.canonical === 'plan');
    expect(decisionStage?.title).toBe('Plan or Decision');
    expect(decisionStage?.steps).toContain('stress-proposals-step');
    expect(flow.stage_path_policy).toMatchObject({
      mode: 'partial',
      omits: ['act', 'verify', 'review'],
    });
  });

  it('fans out option proposals, pauses for a bounded choice, then resumes to a final decision', async () => {
    const { bytes } = loadTournamentFixture();
    const runFolder = join(runFolderBase, 'tournament-run');

    const waiting = await runCompiledFlowV2WithWaiting({
      runDir: runFolder,
      flowBytes: bytes,
      runId: '33333333-3333-3333-3333-333333333331',
      goal: 'decide: React vs Vue',
      depth: 'tournament',
      entryModeName: 'tournament',
      now: deterministicNow(Date.UTC(2026, 3, 29, 16, 30, 0)),
      relayer: tournamentRelayer(),
    });

    expect(waiting.outcome).toBe('checkpoint_waiting');
    if (!isGraphCheckpointWaitingResultV2(waiting)) {
      throw new Error('expected checkpoint_waiting');
    }
    expect(waiting.checkpoint).toMatchObject({
      stepId: 'tradeoff-checkpoint-step',
      allowedChoices: ['option-1', 'option-2', 'option-3', 'option-4'],
    });
    expect(existsSync(join(runFolder, 'reports/checkpoints/tradeoff-response.json'))).toBe(false);

    const options = readJson(runFolder, 'reports/decision-options.json') as {
      options: ReadonlyArray<{ id: string; label: string }>;
    };
    expect(options.options.map((option) => option.label)).toEqual([
      'React',
      'Vue',
      'Hybrid path',
      'Defer pending evidence',
    ]);

    for (const branch of ['option-1', 'option-2', 'option-3', 'option-4']) {
      const branchDir = join(runFolder, 'reports', 'tournament-branches', branch);
      expect(existsSync(join(branchDir, 'request.txt'))).toBe(true);
      expect(existsSync(join(branchDir, 'receipt.txt'))).toBe(true);
      expect(existsSync(join(branchDir, 'result.json'))).toBe(true);
      expect(existsSync(join(branchDir, 'report.json'))).toBe(true);
    }

    const aggregate = readJson(runFolder, 'reports/tournament-aggregate.json') as {
      branches: ReadonlyArray<{ branch_id: string; result_body?: { option_id: string } }>;
    };
    expect(aggregate.branches.map((branch) => branch.branch_id).sort()).toEqual([
      'option-1',
      'option-2',
      'option-3',
      'option-4',
    ]);
    for (const branch of aggregate.branches) {
      expect(branch.result_body?.option_id).toBe(branch.branch_id);
    }

    const resumed = await resumeCompiledFlowV2({
      runDir: runFolder,
      selection: 'option-2',
      now: deterministicNow(Date.UTC(2026, 3, 29, 16, 40, 0)),
      relayer: tournamentRelayer(),
    });

    expect(resumed.outcome).toBe('complete');
    const decision = readJson(runFolder, 'reports/decision.json') as {
      selected_option_id: string;
      selected_option_label: string;
      decision: string;
      follow_up_workflow: string;
    };
    expect(decision.selected_option_id).toBe('option-2');
    expect(decision.selected_option_label).toBe('Vue');
    expect(decision.decision).toMatch(/smaller surface/);
    expect(decision.follow_up_workflow).toBe('Build');

    const result = readJson(runFolder, 'reports/explore-result.json') as {
      verdict_snapshot: { selected_option_id: string };
      evidence_links: ReadonlyArray<{ report_id: string; path: string }>;
    };
    expect(result.verdict_snapshot.selected_option_id).toBe('option-2');
    expect(result.evidence_links).toContainEqual({
      report_id: 'explore.tournament-aggregate',
      path: 'reports/tournament-aggregate.json',
      schema: 'explore.tournament-aggregate@v1',
    });
  });

  it('rejects a proposal branch whose report option_id does not match the branch id', async () => {
    const { bytes } = loadTournamentFixture();
    const runFolder = join(runFolderBase, 'mismatched-proposal-run');
    const relayer = tournamentRelayer();

    const outcome = await runCompiledFlowV2WithWaiting({
      runDir: runFolder,
      flowBytes: bytes,
      runId: '33333333-3333-3333-3333-333333333332',
      goal: 'decide: React vs Vue',
      depth: 'tournament',
      entryModeName: 'tournament',
      now: deterministicNow(Date.UTC(2026, 3, 29, 16, 50, 0)),
      relayer: {
        connectorName: relayer.connectorName,
        relay: async (input) => {
          const result = await relayer.relay(input);
          if (input.prompt.includes('Step: proposal-fanout-step-option-1')) {
            return {
              ...result,
              result_body: JSON.stringify({
                ...(JSON.parse(result.result_body) as Record<string, unknown>),
                option_id: 'option-2',
              }),
            };
          }
          return result;
        },
      },
    });

    expect(outcome.outcome).toBe('aborted');
    if (isGraphCheckpointWaitingResultV2(outcome) || outcome.outcome !== 'aborted') {
      throw new Error('expected aborted');
    }
    expect(outcome.reason).toContain("report field 'option_id' must equal branch_id 'option-1'");
    const traceEntries = await new TraceStore(runFolder).load();
    const failedCheck = traceEntries.find(
      (entry) =>
        entry.kind === 'check.evaluated' &&
        entry.step_id === 'proposal-fanout-step-option-1' &&
        entry.outcome === 'fail',
    );
    expect(failedCheck).toMatchObject({
      reason: expect.stringContaining("field 'option_id' must equal branch_id 'option-1'"),
    });
  });
});
