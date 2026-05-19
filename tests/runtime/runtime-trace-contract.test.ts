import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCompiledFlowWithWaiting } from '../../src/runtime/run/compiled-flow-runner.js';
import { RunTrace } from '../../src/schemas/run.js';
import { TraceEntry } from '../../src/schemas/trace-entry.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn, RelayInput } from '../../src/shared/relay-runtime-types.js';

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
      receipt_id: 'stub-receipt-runtime-trace-contract',
      result_body: body,
      duration_ms: 1,
      cli_version: 'stub',
    }),
  };
}

function readTrace(runFolder: string): unknown[] {
  return readFileSync(join(runFolder, 'trace.ndjson'), 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = join(tmpdir(), `circuit-runtime-trace-contract-${randomUUID()}`);
  mkdirSync(runFolderBase, { recursive: true });
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('runtime trace contract', () => {
  it('emits real runtime trace entries that satisfy the public RunTrace schema', async () => {
    const runFolder = join(runFolderBase, 'review');
    const result = await runCompiledFlowWithWaiting({
      flowBytes: readFileSync(join(process.cwd(), 'generated/flows/review/circuit.json')),
      runDir: runFolder,
      runId: '85000000-0000-4000-8000-000000000101',
      goal: 'review this patch',
      now: deterministicNow(Date.UTC(2026, 4, 7, 12, 0, 0)),
      relayer: relayerWithBody(REVIEW_RELAY_BODY),
    });

    expect(result.outcome).toBe('complete');

    const trace = readTrace(runFolder);
    for (const [index, entry] of trace.entries()) {
      const parsed = TraceEntry.safeParse(entry);
      expect(
        parsed.success,
        `trace entry ${index} should parse: ${
          parsed.success ? '' : JSON.stringify(parsed.error.issues)
        }`,
      ).toBe(true);
    }

    const parsedTrace = RunTrace.safeParse(trace);
    expect(
      parsedTrace.success,
      parsedTrace.success ? '' : JSON.stringify(parsedTrace.error.issues),
    ).toBe(true);
  });
});
