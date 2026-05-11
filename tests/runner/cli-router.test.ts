import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../src/cli/circuit.js';
import { ReviewIntake } from '../../src/flows/review/reports.js';
import { ProgressEvent } from '../../src/schemas/progress-event.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

const EXPLORE_SYNTHESIS_BODY = JSON.stringify({
  verdict: 'accept',
  subject: 'CLI-routed explore goal',
  recommendation: 'Return the requested exploration summary',
  success_condition_alignment: 'The response satisfies the exploratory goal',
  supporting_aspects: [
    {
      aspect: 'routing',
      contribution: 'The explore flow reached the synthesize step',
      evidence_refs: ['reports/analysis.json'],
    },
  ],
});

const EXPLORE_REVIEW_VERDICT_BODY = JSON.stringify({
  verdict: 'accept',
  overall_assessment: 'The exploratory compose is acceptable',
  objections: [],
  missed_angles: [],
});

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

// Stub Review relay payload used across CLI router tests. The schema requires
// reviewer prose on every verdict, so a bare `{verdict, findings}` body would
// fail validation and abort the run.
const REVIEW_RELAY_BODY = JSON.stringify({
  verdict: 'NO_ISSUES_FOUND',
  findings: [],
  assessment: 'Stub reviewer: nothing actionable in the relayed evidence.',
  verification: ['Inspected the relayed intake report.'],
  confidence_limitations: [],
});

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function relayerWithBody(body: string): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-cli-router',
      result_body:
        input.prompt.includes('Step: act-step') && body === '{"verdict":"accept"}'
          ? BUILD_IMPLEMENTATION_BODY
          : input.prompt.includes('Step: review-step') &&
              input.prompt.includes('build.review@v1') &&
              body === '{"verdict":"accept"}'
            ? BUILD_REVIEW_BODY
            : input.prompt.includes('Step: synthesize-step') && body === '{"verdict":"accept"}'
              ? EXPLORE_SYNTHESIS_BODY
              : input.prompt.includes('Step: review-step') && body === '{"verdict":"accept"}'
                ? EXPLORE_REVIEW_VERDICT_BODY
                : body,
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
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

function migrateCliRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: RelayInput): Promise<RelayResult> => {
      if (input.prompt.includes('Step: inventory-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-cli-migrate-inventory',
          result_body: JSON.stringify({
            verdict: 'accept',
            summary: 'One legacy API site found for the CLI proof.',
            items: [
              {
                id: 'item-1',
                path: 'src/legacy-api.ts',
                category: 'import-site',
                description: 'Legacy API import site.',
              },
            ],
            batches: [
              {
                id: 'batch-1',
                title: 'Replace the legacy API import',
                item_ids: ['item-1'],
                rationale: 'Single safe batch for the CLI proof.',
              },
            ],
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }

      if (
        input.prompt.includes('Step: review-step') &&
        input.prompt.includes('Accepted verdicts: release-approved, release-with-followups')
      ) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-cli-migrate-review',
          result_body: JSON.stringify({
            verdict: 'release-approved',
            summary: 'Release approved for the synthetic migration.',
            findings: [],
          }),
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }

      if (input.prompt.includes('Step: act-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-cli-build-act',
          result_body: BUILD_IMPLEMENTATION_BODY,
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }

      if (input.prompt.includes('Step: review-step') && input.prompt.includes('build.review@v1')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-cli-build-review',
          result_body: BUILD_REVIEW_BODY,
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }

      throw new Error(`unexpected migrate CLI relay prompt: ${input.prompt.slice(0, 240)}`);
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

async function runMainJson(
  argv: readonly string[],
  relayBody: string,
  options: { readonly configCwd?: string } = {},
): Promise<Record<string, unknown>> {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      relayer: relayerWithBody(relayBody),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000001',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: options.configCwd ?? process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
  }

  const parsed: unknown = JSON.parse(captured);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('CLI output was not a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function runMainJsonWithRelayer(
  argv: readonly string[],
  relayer: RelayFn,
): Promise<Record<string, unknown>> {
  let captured = '';
  const origWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  try {
    const exit = await main(argv, {
      relayer,
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000001',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origWrite;
  }
  return JSON.parse(captured) as Record<string, unknown>;
}

async function runMainJsonWithRelayerAndProgress(
  argv: readonly string[],
  relayer: RelayFn,
): Promise<{ output: Record<string, unknown>; progress: Array<ProgressEvent> }> {
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
      relayer,
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000001',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }

  const output = JSON.parse(stdout) as Record<string, unknown>;
  const progress = stderr
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ProgressEvent.parse(JSON.parse(line)));
  return { output, progress };
}

async function runMainJsonWithProgress(
  argv: readonly string[],
  relayBody: string,
): Promise<{ output: Record<string, unknown>; progress: Array<ProgressEvent> }> {
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
      relayer: relayerWithBody(relayBody),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000001',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    expect(exit).toBe(0);
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }

  const output = JSON.parse(stdout) as Record<string, unknown>;
  const progress = stderr
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => ProgressEvent.parse(JSON.parse(line)));
  return { output, progress };
}

async function runMainExit(argv: readonly string[]): Promise<{ exit: number; stderr: string }> {
  let stderr = '';
  const origWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const exit = await main(argv, {
      relayer: relayerWithBody('{"verdict":"accept"}'),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000099',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    return { exit, stderr };
  } finally {
    process.stderr.write = origWrite;
  }
}

async function runMainUnsupportedRuntimeFailure(
  argv: readonly string[],
): Promise<{ exit: number; stderr: string }> {
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
      relayer: relayerWithBody('{"verdict":"accept"}'),
      now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
      runId: '84000000-0000-0000-0000-000000000098',
      configHomeDir: join(runFolderBase, 'empty-home'),
      configCwd: process.cwd(),
    });
    expect(stdout).toBe('');
    expect(stderr).toContain(`error: ${'unsupported runtime invocation'}`);
    const runFolderFlag = argv.indexOf('--run-folder');
    if (runFolderFlag >= 0) {
      const runFolder = argv[runFolderFlag + 1];
      if (typeof runFolder !== 'string') {
        throw new Error('expected --run-folder to be followed by a path');
      }
      expect(existsSync(runFolder)).toBe(false);
    }
    return { exit, stderr };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}

async function withStrictruntime<T>(operation: () => Promise<T>): Promise<T> {
  const originalStrictRuntime = process.env.CIRCUIT_SHOW_RUNTIME_DECISION;
  try {
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = '1';
    return await operation();
  } finally {
    process.env.CIRCUIT_SHOW_RUNTIME_DECISION = originalStrictRuntime;
  }
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-cli-router-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('CLI router', () => {
  it('omitted flow positional routes review-like goals through the classifier', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'review'),
      ],
      REVIEW_RELAY_BODY,
    );

    expect(output.flow_id).toBe('review');
    expect(output.selected_flow).toBe('review');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/review/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('complete');
  });

  it('emits parseable progress JSONL to stderr without changing final stdout JSON', async () => {
    const runFolder = join(runFolderBase, 'review-progress-jsonl');
    const { output, progress } = await runMainJsonWithProgress(
      [
        '--goal',
        'review this patch for safety problems',
        '--progress',
        'jsonl',
        '--run-folder',
        runFolder,
      ],
      REVIEW_RELAY_BODY,
    );

    expect(output.flow_id).toBe('review');
    expect(output.selected_flow).toBe('review');
    expect(output.outcome).toBe('complete');
    expect(typeof output.operator_summary_path).toBe('string');
    expect(typeof output.operator_summary_markdown_path).toBe('string');
    expect(existsSync(output.operator_summary_path as string)).toBe(true);
    expect(existsSync(output.operator_summary_markdown_path as string)).toBe(true);
    expect(progress.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        'route.selected',
        'run.started',
        'task_list.updated',
        'step.started',
        'relay.started',
        'relay.completed',
        'run.completed',
      ]),
    );
    expect(progress.slice(0, 3).map((event) => event.type)).toEqual([
      'route.selected',
      'run.started',
      'task_list.updated',
    ]);
    const progressTypes = progress.map((event) => event.type);
    expect(progressTypes.indexOf('step.started')).toBeLessThan(
      progressTypes.indexOf('relay.started'),
    );
    expect(progressTypes.indexOf('relay.started')).toBeLessThan(
      progressTypes.indexOf('relay.completed'),
    );
    expect(progressTypes.indexOf('relay.completed')).toBeLessThan(
      progressTypes.indexOf('run.completed'),
    );
    expect(progress.every((event) => event.display.text.length > 0)).toBe(true);
    expect(progress.find((event) => event.type === 'route.selected')?.display.text).toContain(
      'Circuit: Chose review',
    );
    expect(progress.find((event) => event.type === 'route.selected')?.presentation).toMatchObject({
      block_id: output.run_id,
      line_mode: 'append',
      status_text: 'Chose review.',
    });
    const taskListEvents = progress.filter((event) => event.type === 'task_list.updated');
    expect(taskListEvents.length).toBeGreaterThan(1);
    expect(taskListEvents.every((event) => event.presentation?.line_mode === 'suppress')).toBe(
      true,
    );
    expect(taskListEvents[0]?.tasks.every((task) => task.status === 'pending')).toBe(true);
    expect(
      taskListEvents.some((event) => event.tasks.some((task) => task.status === 'in_progress')),
    ).toBe(true);
    expect(
      taskListEvents.some((event) => event.tasks.some((task) => task.status === 'completed')),
    ).toBe(true);
    expect(progress.find((event) => event.type === 'relay.started')).toMatchObject({
      role: 'reviewer',
      connector_name: 'claude-code',
      filesystem_capability: 'trusted-write',
      display: {
        importance: 'major',
        tone: 'info',
      },
    });
    expect(progress.find((event) => event.type === 'relay.started')?.display.text).toBe(
      'Circuit: Asking the reviewer to check the result...',
    );
    expect(progress.find((event) => event.type === 'relay.started')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      slot_id: 'audit-step:relay',
      status_text: 'Asking the reviewer to check the result...',
    });
    expect(progress.find((event) => event.type === 'relay.completed')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      slot_id: 'audit-step:relay',
      status_text: 'Finished checking the result.',
    });
    expect(progress.find((event) => event.type === 'relay.started')?.display.text).not.toContain(
      'trusted-write',
    );
    expect(progress.find((event) => event.type === 'step.started')).toMatchObject({
      step_id: 'intake-step',
      step_title: 'Intake — resolve review scope',
      attempt: 1,
    });
    expect(progress.find((event) => event.type === 'step.started')?.display.text).toBe(
      'Circuit: Framing the work...',
    );
    expect(progress.find((event) => event.type === 'step.started')?.presentation).toMatchObject({
      line_mode: 'append',
      status_text: 'Framing the work...',
    });
  });

  it('keeps Explore progress display focused on the operator, not internal report names', async () => {
    const runFolder = join(runFolderBase, 'explore-progress-jsonl');
    const { output, progress } = await runMainJsonWithRelayerAndProgress(
      [
        'explore',
        '--goal',
        'explore better internal evals',
        '--progress',
        'jsonl',
        '--run-folder',
        runFolder,
      ],
      relayerWithBody('{"verdict":"accept"}'),
    );

    expect(output.flow_id).toBe('explore');
    const visibleText = progress
      .filter(
        (event) =>
          event.display.importance === 'major' ||
          event.display.tone === 'warning' ||
          event.display.tone === 'error' ||
          event.display.tone === 'checkpoint',
      )
      .map((event) => event.display.text)
      .join('\n');
    expect(visibleText).toContain('Circuit: Framing the work...');
    expect(visibleText).toContain('Circuit: Drafting the recommendation...');
    expect(visibleText).toContain('Circuit: Asking the reviewer to check the recommendation...');
    expect(visibleText).not.toContain('explore.brief');
    expect(visibleText).not.toContain('connector-bound relay');
    expect(visibleText).not.toContain('trusted-write');
    expect(visibleText).not.toContain('accept-with-fold-ins');
  });

  it('keeps explicit route selection machine-readable while Explore completion copy stays concise', async () => {
    const runFolder = join(runFolderBase, 'explore-progress-copy');
    const { output, progress } = await runMainJsonWithProgress(
      [
        'run',
        'explore',
        '--goal',
        'compare host rendering options',
        '--progress',
        'jsonl',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(progress.find((event) => event.type === 'route.selected')).toMatchObject({
      selected_flow: 'explore',
      routed_by: 'explicit',
    });
    const completedTexts = progress
      .filter((event) => event.type === 'step.completed' || event.type === 'task_list.updated')
      .map((event) => event.display.text);
    expect(completedTexts).toContain('Finished drafting the recommendation.');
    expect(completedTexts).toContain('Finished checking the recommendation.');
    expect(completedTexts).toContain('Finished wrapping up.');
  });

  it('routes decide: through the public CLI to the Explore tournament fixture', async () => {
    const runFolder = join(runFolderBase, 'explore-tournament-cli');
    const output = await runMainJsonWithRelayer(
      ['--goal', 'decide: React vs Vue', '--run-folder', runFolder],
      tournamentRelayer(),
    );

    const trace_entries = traceEntryLog(runFolder);
    const bootstrap = trace_entries.find((trace_entry) => trace_entry.kind === 'run.bootstrapped');
    const stressReview = trace_entries.find(
      (trace_entry) =>
        trace_entry.kind === 'relay.completed' && trace_entry.step_id === 'stress-proposals-step',
    );
    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.entry_mode).toBe('tournament');
    expect(output.entry_mode_source).toBe('classifier');
    expect(output.outcome).toBe('checkpoint_waiting');
    expect(output.checkpoint).toMatchObject({
      step_id: 'tradeoff-checkpoint-step',
      allowed_choices: ['option-1', 'option-2', 'option-3', 'option-4'],
    });
    expect(bootstrap).toMatchObject({ depth: 'tournament' });
    expect(stressReview).toBeDefined();
  });

  it('surfaces actual tournament option labels in checkpoint user input', async () => {
    const runFolder = join(runFolderBase, 'explore-tournament-progress');
    const { output, progress } = await runMainJsonWithRelayerAndProgress(
      ['--goal', 'decide: React vs Vue', '--run-folder', runFolder, '--progress', 'jsonl'],
      tournamentRelayer(),
    );

    expect(output.outcome).toBe('checkpoint_waiting');
    expect(progress.find((event) => event.type === 'fanout.started')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      status_text: 'Comparing 4 options...',
    });
    expect(
      progress
        .filter(
          (event) =>
            event.type === 'fanout.branch_started' || event.type === 'fanout.branch_completed',
        )
        .every((event) => event.presentation?.line_mode === 'suppress'),
    ).toBe(true);
    expect(progress.find((event) => event.type === 'fanout.joined')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      status_text: 'Finished comparing the options.',
    });
    const waiting = progress.find((event) => event.type === 'checkpoint.waiting');
    expect(waiting?.display.text).toContain('React, Vue');
    const userInput = progress.find((event) => event.type === 'user_input.requested');
    if (userInput?.type !== 'user_input.requested') {
      throw new Error('expected user_input.requested progress event');
    }
    const [question] = userInput.questions;
    expect(question?.question).toContain('ecosystem depth or iteration speed');
    expect(question?.options.map((option) => option.label)).toEqual([
      'React',
      'Vue',
      'Hybrid path',
      'Defer pending evidence',
    ]);
    expect(question?.options.map((option) => option.checkpoint_choice)).toEqual([
      'option-1',
      'option-2',
      'option-3',
      'option-4',
    ]);
    expect(typeof output.operator_summary_markdown_path).toBe('string');
    const markdown = readFileSync(output.operator_summary_markdown_path as string, 'utf8');
    expect(markdown).toContain('Checkpoint options: React (option-1); Vue (option-2)');
  });

  it('resolves sub-run child flows through the public CLI', async () => {
    const runFolder = join(runFolderBase, 'migrate-cli-sub-run');
    const output = await runMainJsonWithRelayer(
      ['migrate', '--goal', 'migrate a tiny legacy API', '--run-folder', runFolder],
      migrateCliRelayer(),
    );

    const trace_entries = traceEntryLog(runFolder);
    expect(output.flow_id).toBe('migrate');
    expect(output.selected_flow).toBe('migrate');
    expect(output.outcome).toBe('complete');
    expect(output.result_path).toBe(join(runFolder, 'reports/result.json'));
    expect(trace_entries).toContainEqual(
      expect.objectContaining({
        kind: 'sub_run.started',
        step_id: 'batch-step',
        child_flow_id: 'build',
        child_entry_mode: 'default',
      }),
    );
    expect(existsSync(join(runFolder, 'reports/migrate/batch-result.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports/migrate-result.json'))).toBe(true);
  }, 180_000);

  it('passes explicit untracked-content opt-in to Review evidence intake', async () => {
    const projectRoot = join(runFolderBase, 'review-untracked-cli-project');
    const runFolder = join(runFolderBase, 'review-untracked-cli-run');
    const scratch = 'CLI flag explicitly allowed this untracked content';
    mkdirSync(projectRoot, { recursive: true });
    execFileSync('git', ['init'], { cwd: projectRoot, stdio: 'pipe' });
    writeFileSync(join(projectRoot, 'scratch.txt'), `${scratch}\n`);

    const output = await runMainJson(
      [
        'review',
        '--goal',
        'review this untracked scratch file',
        '--include-untracked-content',
        '--run-folder',
        runFolder,
      ],
      REVIEW_RELAY_BODY,
      { configCwd: projectRoot },
    );

    const intake = ReviewIntake.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports', 'review-intake.json'), 'utf8')),
    );
    expect(intake.evidence.kind).toBe('git-working-tree');
    if (intake.evidence.kind !== 'git-working-tree') return;
    expect(intake.evidence.untracked_content_policy).toBe('include-content');
    expect(intake.evidence.untracked_files[0]).toMatchObject({
      path: 'scratch.txt',
      content: { text: `${scratch}\n`, truncated: false },
    });
    expect(typeof output.operator_summary_markdown_path).toBe('string');
    const markdown = readFileSync(output.operator_summary_markdown_path as string, 'utf8');
    expect(markdown).toContain('Untracked evidence: contents included for 1 file');
  });

  it('emits run.aborted progress when a run aborts', async () => {
    const { output, progress } = await runMainJsonWithProgress(
      [
        'review',
        '--goal',
        'review this malformed relay body',
        '--progress',
        'jsonl',
        '--run-folder',
        join(runFolderBase, 'review-progress-aborted'),
      ],
      '{"verdict":"NO_ISSUES_FOUND","findings":"not-an-array"}',
    );

    expect(output.outcome).toBe('aborted');
    expect(typeof output.operator_summary_markdown_path).toBe('string');
    expect(progress.map((event) => event.type)).toContain('run.aborted');
    expect(progress.find((event) => event.type === 'run.aborted')?.display.tone).toBe('error');
    expect(progress.find((event) => event.type === 'run.aborted')?.presentation).toMatchObject({
      line_mode: 'append',
      status_text: expect.stringContaining('Run aborted:'),
    });
    const lastTaskList = progress.filter((event) => event.type === 'task_list.updated').at(-1);
    expect(lastTaskList?.tasks.some((task) => task.status === 'failed')).toBe(true);
  });

  it('omitted flow positional keeps exploratory goals on explore', async () => {
    const output = await runMainJson(
      ['--goal', 'map the current project state', '--run-folder', join(runFolderBase, 'explore')],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBeUndefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted flow positional routes build-like goals through the classifier', async () => {
    const output = await runMainJson(
      ['--goal', 'develop: add a focused feature', '--run-folder', join(runFolderBase, 'build')],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('build');
    expect(output.selected_flow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/implementation Build flow/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('complete');
  }, 30_000);

  it('omitted flow positional preserves router metadata on Build checkpoint_waiting output', async () => {
    const runFolder = join(runFolderBase, 'build-router-checkpoint-waiting');
    const output = await runMainJson(
      [
        '--goal',
        'develop: add a focused feature that waits for framing',
        '--entry-mode',
        'deep',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    expect(output.schema_version).toBe(1);
    expect(output.flow_id).toBe('build');
    expect(output.selected_flow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_reason).toMatch(/implementation Build flow/i);
    expect(output.router_signal).toBeDefined();
    expect(output.outcome).toBe('checkpoint_waiting');
    expect(output).not.toHaveProperty('result_path');
    expect(output.checkpoint).toMatchObject({
      step_id: 'frame-step',
      request_path: join(runFolder, 'reports/checkpoints/frame-step-request.json'),
      allowed_choices: ['continue'],
    });
  });

  it('emits checkpoint.waiting progress for paused checkpoint runs', async () => {
    const runFolder = join(runFolderBase, 'build-router-checkpoint-progress');
    const { output, progress } = await runMainJsonWithProgress(
      [
        '--goal',
        'develop: add a focused feature that waits for framing',
        '--entry-mode',
        'deep',
        '--progress',
        'jsonl',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    expect(output.outcome).toBe('checkpoint_waiting');
    expect(typeof output.operator_summary_markdown_path).toBe('string');
    expect(existsSync(output.operator_summary_markdown_path as string)).toBe(true);
    expect(progress).toContainEqual(
      expect.objectContaining({
        type: 'run.started',
        display: expect.objectContaining({
          tone: 'warning',
          text: expect.stringContaining('A worker can edit this checkout.'),
        }),
      }),
    );
    expect(progress).toContainEqual(
      expect.objectContaining({
        type: 'checkpoint.waiting',
        step_id: 'frame-step',
        allowed_choices: ['continue'],
        display: expect.objectContaining({ tone: 'checkpoint' }),
        presentation: expect.objectContaining({
          line_mode: 'append',
          status_text: 'Waiting for your choice...',
        }),
      }),
    );
    expect(progress).toContainEqual(
      expect.objectContaining({
        type: 'user_input.requested',
        checkpoint: expect.objectContaining({
          step_id: 'frame-step',
          request_path: join(runFolder, 'reports/checkpoints/frame-step-request.json'),
          allowed_choices: ['continue'],
        }),
        questions: [
          expect.objectContaining({
            id: 'checkpoint-choice',
            header: 'Choice',
            allow_free_text: false,
            options: [
              expect.objectContaining({
                label: 'Continue',
                checkpoint_choice: 'continue',
              }),
            ],
          }),
        ],
        resume: expect.objectContaining({
          run_folder: runFolder,
          checkpoint_choice_arg: '<choice>',
        }),
        display: expect.objectContaining({ tone: 'checkpoint' }),
        presentation: expect.objectContaining({ line_mode: 'suppress' }),
      }),
    );
  });

  it('omitted flow positional keeps develop-prefixed planning goals on explore', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'develop: create a new endpoint RFC',
        '--run-folder',
        join(runFolderBase, 'develop-planning'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBeUndefined();
    expect(output.outcome).toBe('complete');
  });

  it('omitted flow positional starts a flow for plan-execution requests', async () => {
    const output = await runMainJson(
      [
        '--goal',
        'Execute this plan: ./docs/specs/headless-engine-host-api-v1.md',
        '--run-folder',
        join(runFolderBase, 'plan-execution'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('build');
    expect(output.selected_flow).toBe('build');
    expect(output.routed_by).toBe('classifier');
    expect(output.router_signal).toBe('plan-execution');
    expect(output.entry_mode).toBe('default');
    expect(output.entry_mode_source).toBe('classifier');
    expect(output.router_reason).toMatch(/first executable slice/i);
    expect(output.outcome).toBe('complete');
  }, 30_000);

  it('explicit flow positional bypasses the classifier', async () => {
    const output = await runMainJson(
      [
        'explore',
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'explicit-explore'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.selected_flow).toBe('explore');
    expect(output.routed_by).toBe('explicit');
    expect(output.router_reason).toMatch(/explicit flow/i);
    expect(output.router_signal).toBeUndefined();
  });

  it('run --goal routes through the classifier', async () => {
    const output = await runMainJson(
      [
        'run',
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'run-routed-review'),
      ],
      REVIEW_RELAY_BODY,
    );

    expect(output.flow_id).toBe('review');
    expect(output.routed_by).toBe('classifier');
    expect(output.outcome).toBe('complete');
  });

  it('run <flow> --goal bypasses the classifier', async () => {
    const output = await runMainJson(
      [
        'run',
        'explore',
        '--goal',
        'review this patch for safety problems',
        '--run-folder',
        join(runFolderBase, 'run-explicit-explore'),
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('explore');
    expect(output.routed_by).toBe('explicit');
  });

  it('uses classifier-inferred Fix lite mode only for explicit quick Fix intent', async () => {
    const runFolder = join(runFolderBase, 'fix-lite-inferred');

    const { output, progress } = await withStrictruntime(() =>
      runMainJsonWithProgress(
        [
          '--goal',
          'quick fix: restore the missing token edge case',
          '--progress',
          'jsonl',
          '--run-folder',
          runFolder,
        ],
        '{"verdict":"accept"}',
      ),
    );

    const bootstrap = traceEntryLog(runFolder).find(
      (trace_entry) => trace_entry.kind === 'run.bootstrapped',
    );
    expect(output.flow_id).toBe('fix');
    expect(output.routed_by).toBe('classifier');
    expect(output.entry_mode).toBe('lite');
    expect(output.entry_mode_source).toBe('classifier');
    expect(bootstrap).toMatchObject({ depth: 'lite' });
    expect(progress.find((event) => event.type === 'route.selected')).toMatchObject({
      entry_mode: 'lite',
      entry_mode_source: 'classifier',
    });
  });

  it('uses classifier-inferred Fix deep mode for bare serious Fix intent', async () => {
    const runFolder = join(runFolderBase, 'fix-deep-inferred');

    const { output, progress } = await withStrictruntime(() =>
      runMainJsonWithProgress(
        [
          '--goal',
          'fix: restore the missing token regression test',
          '--progress',
          'jsonl',
          '--run-folder',
          runFolder,
        ],
        '{"verdict":"accept"}',
      ),
    );

    const bootstrap = traceEntryLog(runFolder).find(
      (trace_entry) => trace_entry.kind === 'run.bootstrapped',
    );
    expect(output.flow_id).toBe('fix');
    expect(output.routed_by).toBe('classifier');
    expect(output.entry_mode).toBe('deep');
    expect(output.entry_mode_source).toBe('classifier');
    expect(bootstrap).toMatchObject({ depth: 'deep' });
    expect(progress.find((event) => event.type === 'route.selected')).toMatchObject({
      entry_mode: 'deep',
      entry_mode_source: 'classifier',
    });
  });

  it('lets explicit --mode override classifier-inferred Fix mode', async () => {
    const runFolder = join(runFolderBase, 'fix-explicit-default-mode');

    const output = await withStrictruntime(() =>
      runMainJson(
        [
          '--goal',
          'fix: restore the missing token regression test',
          '--mode',
          'default',
          '--run-folder',
          runFolder,
        ],
        '{"verdict":"accept"}',
      ),
    );

    const bootstrap = traceEntryLog(runFolder).find(
      (trace_entry) => trace_entry.kind === 'run.bootstrapped',
    );
    expect(output.flow_id).toBe('fix');
    expect(output.entry_mode).toBe('default');
    expect(output.entry_mode_source).toBe('explicit');
    expect(bootstrap).toMatchObject({ depth: 'standard' });
  });

  it('infers the matching entry mode from --depth when --mode is omitted (F-M-1)', async () => {
    const runFolder = join(runFolderBase, 'fix-depth-only');

    const output = await runMainJson(
      [
        '--goal',
        'fix: restore the missing token regression test',
        '--depth',
        'deep',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    expect(output.flow_id).toBe('fix');
    expect(output.entry_mode).toBe('deep');
    expect(output.entry_mode_source).toBe('explicit');
    const bootstrap = traceEntryLog(runFolder).find(
      (trace_entry) => trace_entry.kind === 'run.bootstrapped',
    );
    expect(bootstrap).toMatchObject({ depth: 'deep' });
  });

  it('rejects --depth values not in the per-flow allowlist before route selection (F-M-2)', async () => {
    const runFolder = join(runFolderBase, 'fix-depth-tournament');

    const result = await runMainExit([
      'fix',
      '--goal',
      'fix: a regression bug',
      '--depth',
      'tournament',
      '--run-folder',
      runFolder,
    ]);

    expect(result.exit).toBe(2);
    expect(result.stderr).toContain("--depth tournament is not supported by flow 'fix'");
    expect(result.stderr).toContain('fix supports depths:');
    expect(existsSync(runFolder)).toBe(false);
  });

  it('accepts --entry-mode and uses that mode depth when --depth is omitted', async () => {
    const runFolder = join(runFolderBase, 'build-lite-entry-mode');
    const output = await runMainJson(
      [
        'build',
        '--goal',
        'Add a tiny Build feature from the CLI',
        '--entry-mode',
        'lite',
        '--run-folder',
        runFolder,
      ],
      '{"verdict":"accept"}',
    );

    const trace_entries = traceEntryLog(runFolder);
    const bootstrap = trace_entries.find((trace_entry) => trace_entry.kind === 'run.bootstrapped');
    const relayStarted = trace_entries.find(
      (trace_entry) => trace_entry.kind === 'relay.started' && trace_entry.step_id === 'act-step',
    );
    const relayResolvedSelection = relayStarted?.resolved_selection;
    expect(output.flow_id).toBe('build');
    expect(output.outcome).toBe('complete');
    expect(bootstrap).toMatchObject({ depth: 'lite' });
    expect(relayResolvedSelection).toMatchObject({ depth: 'lite' });
  }, 30_000);

  it('fails closed when --depth overrides the selected --entry-mode into an unproven route', async () => {
    const runFolder = join(runFolderBase, 'build-entry-mode-depth-override');
    const result = await runMainUnsupportedRuntimeFailure([
      'build',
      '--goal',
      'Add a tiny Build feature from the CLI with an override',
      '--entry-mode',
      'deep',
      '--depth',
      'standard',
      '--run-folder',
      runFolder,
    ]);

    expect(result.exit).toBe(2);
    expect(result.stderr).toContain("fresh build entry mode 'deep' at depth 'standard'");
  });

  it('fails closed when explicit autonomous --depth overrides the default --entry-mode', async () => {
    const runFolder = join(runFolderBase, 'build-default-entry-autonomous-override');
    const result = await runMainUnsupportedRuntimeFailure([
      'build',
      '--goal',
      'Add a tiny Build feature from the CLI with autonomous override',
      '--entry-mode',
      'default',
      '--depth',
      'autonomous',
      '--run-folder',
      runFolder,
    ]);

    expect(result.exit).toBe(2);
    expect(result.stderr).toContain("fresh build entry mode 'default' at depth 'autonomous'");
  });

  it('lists the supported (mode/depth) pairs in the rejection message so the user can immediately retry with a valid pair', async () => {
    const runFolder = join(runFolderBase, 'build-entry-mode-depth-override-actionable');
    const result = await runMainUnsupportedRuntimeFailure([
      'build',
      '--goal',
      'Add a tiny Build feature from the CLI with an override',
      '--entry-mode',
      'deep',
      '--depth',
      'standard',
      '--run-folder',
      runFolder,
    ]);

    expect(result.exit).toBe(2);
    // Build's runtime support matrix as of the source-of-truth in cli/circuit.ts.
    expect(result.stderr).toContain(
      'build supports (mode/depth): default/standard, lite/lite, deep/deep, autonomous/autonomous',
    );
  });

  it('rejects fixture overrides whose flow id does not match the selected flow', async () => {
    await expect(
      main(
        [
          '--goal',
          'review this patch for safety problems',
          '--fixture',
          'generated/flows/explore/circuit.json',
          '--run-folder',
          join(runFolderBase, 'mismatch'),
        ],
        {
          relayer: relayerWithBody('{"verdict":"accept"}'),
          now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
          runId: '84000000-0000-0000-0000-000000000004',
          configHomeDir: join(runFolderBase, 'empty-home'),
          configCwd: join(runFolderBase, 'empty-cwd'),
        },
      ),
    ).rejects.toThrow(/flow fixture id mismatch/i);
  });

  it('rejects an unknown --entry-mode before writing a run trace', async () => {
    const runFolder = join(runFolderBase, 'unknown-build-entry-mode');
    await expect(
      main(
        [
          'build',
          '--goal',
          'Try a missing Build entry mode',
          '--entry-mode',
          'missing',
          '--run-folder',
          runFolder,
        ],
        {
          relayer: relayerWithBody('{"verdict":"accept"}'),
          now: deterministicNow(Date.UTC(2026, 3, 24, 15, 0, 0)),
          runId: '84000000-0000-0000-0000-000000000005',
          configHomeDir: join(runFolderBase, 'empty-home'),
          configCwd: join(runFolderBase, 'empty-cwd'),
        },
      ),
    ).rejects.toThrow(/entry_mode named 'missing'/);
    expect(() => traceEntryLog(runFolder)).toThrow();
  });

  it('prints a versioned checkpoint_waiting envelope without result_path', async () => {
    const runFolder = join(runFolderBase, 'checkpoint-waiting');
    const output = await runMainJson(
      ['build', '--goal', 'Frame via CLI', '--entry-mode', 'deep', '--run-folder', runFolder],
      '{"verdict":"accept"}',
    );

    expect(output.schema_version).toBe(1);
    expect(output.outcome).toBe('checkpoint_waiting');
    expect(output).not.toHaveProperty('result_path');
    expect(output.checkpoint).toMatchObject({
      step_id: 'frame-step',
      allowed_choices: ['continue'],
    });
  });

  it('fails closed when resuming a invalid checkpoint_waiting run', async () => {
    const runFolder = join(runFolderBase, 'checkpoint-resume');
    mkdirSync(runFolder, { recursive: true });
    writeFileSync(
      join(runFolder, 'trace.ndjson'),
      `${JSON.stringify({ schema_version: 1, kind: 'run.started', flow_id: 'build' })}\n`,
    );

    const resumed = await runMainExit([
      'resume',
      '--run-folder',
      runFolder,
      '--checkpoint-choice',
      'continue',
    ]);

    expect(resumed.exit).toBe(2);
    expect(resumed.stderr.trim()).toBe(
      `error: ${'run folder is not a resumable Circuit run folder'}`,
    );
  });

  it('rejects resume-only incompatible flags', async () => {
    const withDepth = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'deep',
    ]);
    expect(withDepth.exit).toBe(2);
    expect(withDepth.stderr).toMatch(/omit --depth/);

    const withFixture = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--fixture',
      join(runFolderBase, 'fixture.json'),
    ]);
    expect(withFixture.exit).toBe(2);
    expect(withFixture.stderr).toMatch(/omit --fixture/);

    const withEntryMode = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--entry-mode',
      'lite',
    ]);
    expect(withEntryMode.exit).toBe(2);
    expect(withEntryMode.stderr).toMatch(/omit --mode\/--entry-mode/);
  });

  it('rejects --depth on checkpoint resume', async () => {
    const withDepth = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'deep',
    ]);
    expect(withDepth.exit).toBe(2);
    expect(withDepth.stderr).toMatch(/omit --depth/);
  });

  it('accepts --mode as a synonym for --entry-mode', async () => {
    const withMode = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--mode',
      'lite',
    ]);
    expect(withMode.exit).toBe(2);
    expect(withMode.stderr).toMatch(/omit --mode\/--entry-mode/);
  });

  it('parses --run-folder before rejecting resume-only --depth', async () => {
    // Resume validates other flags after argv parsing; pairing --run-folder
    // with --depth exercises the downstream "omit --depth" branch. The
    // branch firing proves --run-folder parsed and populated the run-folder slot.
    const result = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'deep',
    ]);
    expect(result.exit).toBe(2);
    expect(result.stderr).toMatch(/omit --depth/);
  });

  it('rejects supplying --depth more than once', async () => {
    const conflict = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--depth',
      'standard',
      '--depth',
      'deep',
    ]);
    expect(conflict.exit).toBe(2);
    expect(conflict.stderr).toMatch(/supply --depth only once/);
  });

  it('rejects supplying both --mode and --entry-mode', async () => {
    const conflict = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'not-needed'),
      '--checkpoint-choice',
      'continue',
      '--mode',
      'lite',
      '--entry-mode',
      'deep',
    ]);
    expect(conflict.exit).toBe(2);
    expect(conflict.stderr).toMatch(/use either --mode or --entry-mode, not both/);
  });

  it('rejects supplying --run-folder more than once', async () => {
    const conflict = await runMainExit([
      'resume',
      '--run-folder',
      join(runFolderBase, 'a'),
      '--run-folder',
      join(runFolderBase, 'b'),
      '--checkpoint-choice',
      'continue',
    ]);
    expect(conflict.exit).toBe(2);
    expect(conflict.stderr).toMatch(/supply --run-folder only once/);
  });

  it('keeps CLI help text aligned with the router-supported flow set', () => {
    const source = readFileSync(join(process.cwd(), 'src/cli/circuit.ts'), 'utf-8');
    expect(source).toContain('registered explore/review/fix/build/migrate/sweep flows');
    expect(source).not.toContain('registered explore/review/build flows');
    expect(source).not.toContain('registered explore/review flows');
  });
});
