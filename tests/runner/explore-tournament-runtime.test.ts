import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resumeRetainedCompiledFlowCheckpoint as resumeCompiledFlowCheckpoint } from '../../src/compat/retained-checkpoint-folders.js';
import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
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

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'Explore tournament is documented but not executable',
    acceptance_evidence:
      'tournament fixture reaches a real checkpoint, resumes through a bounded option choice, and closes with branch receipts plus aggregate provenance',
    alternate_framing: 'document-only tournament plan',
  };
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
    const { flow, bytes } = loadTournamentFixture();
    const runFolder = join(runFolderBase, 'tournament-run');

    const waiting = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('33333333-3333-3333-3333-333333333331'),
      goal: 'decide: React vs Vue',
      depth: 'tournament',
      entryModeName: 'tournament',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 29, 16, 30, 0)),
      relayer: tournamentRelayer(),
    });

    expect(waiting.result.outcome).toBe('checkpoint_waiting');
    if (waiting.result.outcome !== 'checkpoint_waiting') {
      throw new Error('expected checkpoint_waiting');
    }
    expect(waiting.result.checkpoint).toMatchObject({
      step_id: 'tradeoff-checkpoint-step',
      allowed_choices: ['option-1', 'option-2', 'option-3', 'option-4'],
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

    const resumed = await resumeCompiledFlowCheckpoint({
      runFolder,
      selection: 'option-2',
      now: deterministicNow(Date.UTC(2026, 3, 29, 16, 40, 0)),
    });

    expect(resumed.result.outcome).toBe('complete');
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
    const { flow, bytes } = loadTournamentFixture();
    const runFolder = join(runFolderBase, 'mismatched-proposal-run');
    const relayer = tournamentRelayer();

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('33333333-3333-3333-3333-333333333332'),
      goal: 'decide: React vs Vue',
      depth: 'tournament',
      entryModeName: 'tournament',
      change_kind: change_kind(),
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

    expect(outcome.result.outcome).toBe('aborted');
    if (outcome.result.outcome !== 'aborted') {
      throw new Error('expected aborted');
    }
    expect(outcome.result.reason).toContain(
      "report field 'option_id' must equal branch_id 'option-1'",
    );
    const failedCheck = outcome.trace_entries.find(
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
