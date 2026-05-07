// End-to-end runtime wiring for the lite Fix flow.
//
// Loads `generated/flows/fix/lite.json` (the compiled lite-mode
// CompiledFlow) and runs it through `runCompiledFlow` with stubbed relayers
// for context/diagnose/act and a custom compose executor that overrides
// fix-frame to produce a brief with a fast no-op verification command.
// Other compose steps fall through to the registered writer, so this
// is a real proof that fix.brief, fix.verify, and fix.result close
// writers compose correctly through the actual CompiledFlow + runtime runner.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FixBrief, FixResult } from '../../src/flows/fix/reports.js';
import { executeCompose } from '../../src/runtime/executors/compose.js';
import type { ExecutorRegistry } from '../../src/runtime/executors/index.js';
import { runCompiledFlow } from '../../src/runtime/run/compiled-flow-runner.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const FIX_LITE_FIXTURE_PATH = resolve('generated/flows/fix/lite.json');

function loadLiteFixture(): { bytes: Buffer } {
  return { bytes: readFileSync(FIX_LITE_FIXTURE_PATH) };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

// Custom compose executor for the e2e test: overrides fix-frame to
// produce a brief with a fast no-op verification command (so fix-verify
// runs in milliseconds instead of executing real `npm run verify`),
// and falls through to the standard registered compose executor for every
// other compose step (notably fix-close-lite, which exercises the
// registered fix.result close writer).
function frameOverrideExecutors(): Pick<ExecutorRegistry, 'compose'> {
  return {
    compose: async (step, context) => {
      if (step.kind !== 'compose') throw new Error('expected compose step');
      if (step.id !== 'fix-frame') {
        return await executeCompose(step, context);
      }
      const report = step.writes?.report;
      if (report === undefined) {
        throw new Error("Fix proof compose executor expected 'fix-frame' to write a report");
      }
      const brief = FixBrief.parse({
        problem_statement: context.goal,
        expected_behavior: `After fix: ${context.goal}`,
        observed_behavior: `Before fix: ${context.goal}`,
        scope: 'test scope',
        regression_contract: {
          expected_behavior: `After fix: ${context.goal}`,
          actual_behavior: `Before fix: ${context.goal}`,
          repro: {
            kind: 'not-reproducible',
            deferred_reason: 'e2e test - repro deferred',
          },
          regression_test: {
            status: 'deferred',
            deferred_reason: 'e2e test - regression test deferred',
          },
        },
        success_criteria: [`Verify exits 0 for: ${context.goal}`],
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
      await context.files.writeJson(report, brief);
      await context.trace.append({
        run_id: context.runId,
        kind: 'step.report_written',
        step_id: step.id,
        attempt: context.activeStepAttempt ?? 1,
        report_path: report.path,
        ...(report.schema === undefined ? {} : { report_schema: report.schema }),
      });
      return { route: 'pass', details: { writer: step.writer, proof: 'test-fix-brief' } };
    },
  };
}

function relayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input): Promise<RelayResult> => {
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
    const { bytes } = loadLiteFixture();
    const runFolder = join(runFolderBase, 'lite-complete');

    const outcome = await runCompiledFlow({
      runDir: runFolder,
      flowBytes: bytes,
      runId: 'f1000000-0000-0000-0000-000000000000',
      goal: 'fix off-by-one in pagination',
      depth: 'lite',
      now: deterministicNow(Date.UTC(2026, 3, 26, 10, 0, 0)),
      relayer: relayer(),
      executors: frameOverrideExecutors(),
      projectRoot: resolve('.'),
    });

    if (outcome.outcome !== 'complete') {
      throw new Error(
        `lite Fix run did not complete: outcome=${outcome.outcome} reason=${outcome.reason ?? '<none>'}`,
      );
    }
    expect(outcome.outcome).toBe('complete');
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
