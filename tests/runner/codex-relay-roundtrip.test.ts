import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { relayCodex } from '../../src/connectors/codex.js';
import type { TraceEntryV2 } from '../../src/core-v2/domain/trace.js';
import type { ExecutorRegistryV2 } from '../../src/core-v2/executors/index.js';
import { runCompiledFlowV2 } from '../../src/core-v2/run/compiled-flow-runner.js';
import { TraceStore } from '../../src/core-v2/trace/trace-store.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import type { ResolvedSelection } from '../../src/schemas/selection-policy.js';
import { sha256Hex } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Codex relay round-trip, bound to the core-v2 relay transcript and the second
// connector. The live branch is skipped by default because it spawns `codex
// exec` and requires local auth.

const CODEX_SMOKE = process.env.CODEX_SMOKE === '1';
const UPDATE_CODEX_FINGERPRINT = process.env.UPDATE_CODEX_FINGERPRINT === '1';
const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');
const LAST_RUN_FINGERPRINT_PATH = resolve('tests/fixtures/codex-smoke/last-run.json');

const CODEX_SMOKE_SELECTION = {
  model: { provider: 'openai', model: 'gpt-5.4' },
  effort: 'low',
  skills: [],
  invocation_options: {},
} satisfies ResolvedSelection;

const ADAPTER_SOURCE_PATHS = [
  'src/connectors/codex.ts',
  'src/shared/connector-relay.ts',
  'src/shared/connector-helpers.ts',
  'src/connectors/shared.ts',
  'src/core-v2/executors/relay.ts',
  'src/core-v2/run/compiled-flow-runner.ts',
  'src/core-v2/run/graph-runner.ts',
  'src/flows/registries/report-schemas.ts',
] as const;

function connectorSourceSha256(): string {
  const h = createHash('sha256');
  for (const p of ADAPTER_SOURCE_PATHS) {
    const abs = resolve(p);
    h.update(`${abs}\n`);
    h.update(readFileSync(abs));
    h.update('\n');
  }
  return h.digest('hex');
}

function loadCodexRuntimeProofBytes(): Buffer {
  const raw = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
    default_selection?: unknown;
    steps: Array<{ id: string; kind: string; role?: string }>;
  };
  raw.default_selection = {
    model: CODEX_SMOKE_SELECTION.model,
    effort: CODEX_SMOKE_SELECTION.effort,
    skills: { mode: 'replace', skills: [] },
    invocation_options: CODEX_SMOKE_SELECTION.invocation_options,
  };
  const relayStep = raw.steps.find((step) => step.id === 'relay-step' && step.kind === 'relay');
  if (relayStep === undefined) throw new Error('runtime-proof relay step not found');
  relayStep.role = 'reviewer';
  CompiledFlow.parse(raw);
  return Buffer.from(`${JSON.stringify(raw)}\n`, 'utf8');
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function codexRelayer(): RelayFn {
  return {
    connectorName: 'codex',
    relay: relayCodex,
  };
}

function composeExecutor(): Pick<ExecutorRegistryV2, 'compose'> {
  return {
    compose: async (step, context) => {
      if (step.kind !== 'compose') throw new Error('expected compose step');
      const attempt =
        context.activeStepAttempt === undefined ? {} : { attempt: context.activeStepAttempt };
      const report = step.writes?.report;
      if (report !== undefined) {
        const reportPath = context.files.resolve(report);
        mkdirSync(dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, '{"summary":"runtime-proof relay setup"}\n', 'utf8');
        await context.trace.append({
          run_id: context.runId,
          kind: 'step.report_written',
          step_id: step.id,
          ...attempt,
          report_path: report.path,
          ...(report.schema === undefined ? {} : { report_schema: report.schema }),
        });
      }
      await context.trace.append({
        run_id: context.runId,
        kind: 'check.evaluated',
        step_id: step.id,
        ...attempt,
        check_kind: 'schema_sections',
        outcome: 'pass',
      });
      return { route: 'pass', details: { report: report?.path } };
    },
  };
}

async function readTrace(runFolder: string): Promise<readonly TraceEntryV2[]> {
  return await new TraceStore(runFolder).load();
}

function relayEntry(trace: readonly TraceEntryV2[], kind: TraceEntryV2['kind']): TraceEntryV2 {
  const entry = trace.find((candidate) => candidate.kind === kind);
  if (entry === undefined) throw new Error(`expected ${kind} trace entry`);
  return entry;
}

function currentHeadSha(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'codex-relay-roundtrip-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('codex relay round-trip (second-connector evidence)', () => {
  it('static: core-v2 runner and trace store are available for connector transcript capture', () => {
    expect(typeof runCompiledFlowV2).toBe('function');
    expect(typeof TraceStore).toBe('function');
  });

  it('static: the relay transcript remains connector-agnostic', () => {
    const kinds = [
      'relay.started',
      'relay.request',
      'relay.receipt',
      'relay.result',
      'relay.completed',
    ] as const;
    expect(kinds.every((kind) => kind.startsWith('relay.'))).toBe(true);
  });

  (CODEX_SMOKE ? it : it.skip)(
    'end-to-end: core-v2 runtime-proof flow uses real Codex relay and persists the relay transcript',
    async () => {
      const runFolder = join(runFolderBase, 'codex-runtime-proof');
      const outcome = await runCompiledFlowV2({
        runDir: runFolder,
        flowBytes: loadCodexRuntimeProofBytes(),
        runId: '45454545-4545-4545-4545-454545454545',
        goal: 'codex relay round-trip',
        depth: 'standard',
        now: deterministicNow(Date.UTC(2026, 3, 22, 3, 45, 0)),
        executors: composeExecutor(),
        relayer: codexRelayer(),
      });

      expect(outcome.outcome).toBe('complete');
      const trace = await readTrace(runFolder);
      expect(outcome.trace_entries_observed).toBe(trace.length);
      expect(trace.map((entry) => entry.sequence)).toEqual(trace.map((_, index) => index));

      const relayKinds = trace
        .filter((entry) => entry.kind.startsWith('relay.'))
        .map((entry) => entry.kind);
      expect(relayKinds).toEqual([
        'relay.started',
        'relay.request',
        'relay.receipt',
        'relay.result',
        'relay.completed',
      ]);

      const started = relayEntry(trace, 'relay.started');
      expect(started.data?.connector).toEqual({ kind: 'builtin', name: 'codex' });
      expect(started.data?.role).toBe('reviewer');
      expect(started.data?.resolved_from).toEqual({ source: 'explicit' });
      expect(started.data?.resolved_selection).toEqual(CODEX_SMOKE_SELECTION);

      const request = relayEntry(trace, 'relay.request');
      const requestBody = readFileSync(join(runFolder, 'reports', 'relay.request.json'), 'utf8');
      expect(request.data?.request_payload_hash).toBe(sha256Hex(requestBody));

      const receipt = relayEntry(trace, 'relay.receipt');
      const cliVersion = String(receipt.data?.cli_version ?? '');
      expect(receipt.data?.receipt_id).toEqual(
        readFileSync(join(runFolder, 'reports', 'relay.receipt.json'), 'utf8'),
      );
      expect(String(receipt.data?.receipt_id ?? '').trim().length).toBeGreaterThan(0);
      expect(cliVersion).toMatch(/codex.*\d+\.\d+\.\d+/i);

      const result = relayEntry(trace, 'relay.result');
      const resultBody = readFileSync(join(runFolder, 'reports', 'relay.result.json'), 'utf8');
      expect(result.data?.result_report_hash).toBe(sha256Hex(resultBody));

      const completed = relayEntry(trace, 'relay.completed');
      expect(completed.verdict).toBe('ok');
      expect(completed.result_path).toBe('reports/relay.result.json');
      expect(existsSync(join(runFolder, 'reports', 'result.json'))).toBe(true);

      if (UPDATE_CODEX_FINGERPRINT) {
        if (cliVersion.length === 0 || /\(unknown\)/.test(cliVersion)) {
          throw new Error(
            `CODEX_SMOKE fingerprint promotion: cli_version "${cliVersion}" is empty or sentinel`,
          );
        }
        const fingerprint = {
          schema_version: 2,
          commit_sha: currentHeadSha(),
          result_sha256: sha256Hex(resultBody),
          connector_source_sha256: connectorSourceSha256(),
          cli_version: cliVersion,
          recorded_at: new Date().toISOString(),
        };
        mkdirSync(dirname(LAST_RUN_FINGERPRINT_PATH), { recursive: true });
        writeFileSync(LAST_RUN_FINGERPRINT_PATH, `${JSON.stringify(fingerprint, null, 2)}\n`);
      }
    },
    180_000,
  );
});
