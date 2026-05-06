// End-to-end runtime wiring for the lite Fix flow.
//
// Loads `generated/flows/fix/lite.json` (the compiled lite-mode
// CompiledFlow) and runs it through `runCompiledFlow` with stubbed relayers
// for context/diagnose/act and a custom composeWriter that overrides
// fix-frame to produce a brief with a fast no-op verification command.
// Other compose steps fall through to the registered writer, so this
// is a real proof that fix.brief, fix.verify, and fix.result close
// writers compose correctly through the actual CompiledFlow + runner.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type ComposeWriterInput,
  runRetainedCompiledFlow as runCompiledFlow,
  writeRetainedComposeReport as writeComposeReport,
} from '../../src/compat/retained-runtime.js';
import { FixBrief, FixResult } from '../../src/flows/fix/reports.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const FIX_LITE_FIXTURE_PATH = resolve('.claude-plugin', 'skills', 'fix', 'lite.json');

function loadLiteFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIX_LITE_FIXTURE_PATH);
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
    failure_mode: 'lite Fix had no end-to-end runtime proof through close',
    acceptance_evidence:
      'runCompiledFlow closes the lite Fix flow via real CompiledFlow with stubbed relayers and a fast verification command',
    alternate_framing:
      'defer until full Fix is wired — rejected because lite is the proving substrate per flow-authoring-model.md',
  };
}

// Custom compose writer for the e2e test: overrides fix-frame to
// produce a brief with a fast no-op verification command (so fix-verify
// runs in milliseconds instead of executing real `npm run verify`),
// and falls through to the standard writeComposeReport for every
// other compose step (notably fix-close-lite, which exercises the
// registered fix.result close writer).
function frameOverrideComposeWriter(input: ComposeWriterInput): void {
  if ((input.step.id as unknown as string) === 'fix-frame') {
    const brief = FixBrief.parse({
      problem_statement: input.goal,
      expected_behavior: `After fix: ${input.goal}`,
      observed_behavior: `Before fix: ${input.goal}`,
      scope: 'test scope',
      regression_contract: {
        expected_behavior: `After fix: ${input.goal}`,
        actual_behavior: `Before fix: ${input.goal}`,
        repro: {
          kind: 'not-reproducible',
          deferred_reason: 'e2e test — repro deferred',
        },
        regression_test: {
          status: 'deferred',
          deferred_reason: 'e2e test — regression test deferred',
        },
      },
      success_criteria: [`Verify exits 0 for: ${input.goal}`],
      verification_command_candidates: [
        {
          id: 'noop-verify',
          cwd: '.',
          argv: [process.execPath, '-e', 'process.exit(0)'],
          timeout_ms: 30_000,
          max_output_bytes: 200_000,
          env: {},
        },
      ],
    });
    const abs = join(input.runFolder, input.step.writes.report.path as unknown as string);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(brief, null, 2)}\n`);
    return;
  }
  writeComposeReport(input);
}

function relayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      const isContext = input.prompt.includes('Step: fix-gather-context');
      const isDiagnose = input.prompt.includes('Step: fix-diagnose');
      const isAct = input.prompt.includes('Step: fix-act');
      expect(isContext || isDiagnose || isAct).toBe(true);
      const body = isContext
        ? JSON.stringify({
            verdict: 'accept',
            sources: [{ kind: 'file', ref: 'src/test.ts:1', summary: 'stub source for e2e test' }],
            observations: ['Stubbed gather-context observation'],
            open_questions: [],
          })
        : isDiagnose
          ? JSON.stringify({
              verdict: 'accept',
              reproduction_status: 'reproduced',
              cause_summary: 'e2e test cause',
              confidence: 'high',
              evidence: ['Stubbed diagnose evidence'],
              residual_uncertainty: [],
            })
          : JSON.stringify({
              verdict: 'accept',
              summary: 'Stubbed change summary',
              diagnosis_ref: 'fix.diagnosis@v1',
              changed_files: ['src/test.ts'],
              evidence: ['Stubbed change evidence'],
            });
      return {
        request_payload: input.prompt,
        receipt_id: isContext
          ? 'stub-fix-context'
          : isDiagnose
            ? 'stub-fix-diagnose'
            : 'stub-fix-act',
        result_body: body,
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-fix-runtime-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('Lite Fix runtime wiring', () => {
  it('runs the live lite Fix CompiledFlow end-to-end and closes with a FixResult', async () => {
    const { flow, bytes } = loadLiteFixture();
    const runFolder = join(runFolderBase, 'lite-complete');

    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: bytes,
      runId: RunId.parse('f1000000-0000-0000-0000-000000000000'),
      goal: 'fix off-by-one in pagination',
      depth: 'lite',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 10, 0, 0)),
      relayer: relayer(),
      composeWriter: frameOverrideComposeWriter,
      projectRoot: resolve('.'),
    });

    if (outcome.result.outcome !== 'complete') {
      throw new Error(
        `lite Fix run did not complete: outcome=${outcome.result.outcome} reason=${outcome.result.reason ?? '<none>'} trace_entries=${outcome.trace_entries.map((e) => e.kind).join(',')}`,
      );
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(existsSync(join(runFolder, 'reports/fix/brief.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports/fix/context.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports/fix/diagnosis.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports/fix/change.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports/fix/verification.json'))).toBe(true);
    expect(existsSync(join(runFolder, 'reports/fix-result.json'))).toBe(true);

    const result = FixResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/fix-result.json'), 'utf8')),
    );
    expect(result.review_status).toBe('skipped');
    expect(result.verification_status).toBe('passed');
    expect(['fixed', 'partial']).toContain(result.outcome);
    // Required pointers — review absent in lite.
    const ids = result.evidence_links.map((p) => p.report_id);
    expect(ids).toEqual([
      'fix.brief',
      'fix.context',
      'fix.diagnosis',
      'fix.change',
      'fix.verification',
    ]);
  });
});
