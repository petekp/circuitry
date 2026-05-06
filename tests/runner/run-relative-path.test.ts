import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { materializeRelay } from '../../src/runtime/connectors/relay-materializer.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import type { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId, StepId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';
import { resolveRunRelative } from '../../src/shared/run-relative-path.js';

const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');

function loadFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: raw as CompiledFlow, bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'flow-controlled paths could escape the run folder',
    acceptance_evidence: 'run-relative path resolver rejects escaping read/write paths',
    alternate_framing:
      'rely only on schema parsing — rejected because runtime call sites also need containment defense if typed data is bypassed',
  };
}

function relayerWithCapture(capture: string[]): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      capture.push(input.prompt);
      return {
        request_payload: input.prompt,
        receipt_id: 'stub-receipt-run-relative',
        result_body: '{"verdict":"ok"}',
        duration_ms: 1,
        cli_version: '0.0.0-stub',
      };
    },
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-path-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('STEP-I8 runtime run-relative path containment', () => {
  it('exposes the shared helper with the same containment checks', () => {
    const runFolder = join(runFolderBase, 'run-shared-helper');

    expect(resolveRunRelative(runFolder, 'reports/result.json')).toBe(
      join(runFolder, 'reports', 'result.json'),
    );
    expect(() => resolveRunRelative(runFolder, '../escaped.json')).toThrow(/run-relative path/i);
    expect(() => resolveRunRelative(runFolder, 'reports/./result.json')).toThrow(
      /run-relative path/i,
    );
  });

  it('rejects compose writes.report.path escape or dot segment before writing', async () => {
    const { flow, bytes } = loadFixture();
    const cases = [
      ['parent', '../escaped.json', join(runFolderBase, 'escaped.json')],
      [
        'current',
        'reports/./escaped.json',
        join(runFolderBase, 'run-current', 'reports', 'escaped.json'),
      ],
    ] as const;

    for (const [label, path, forbiddenPath] of cases) {
      const runFolder = join(runFolderBase, `run-${label}`);
      const badCompiledFlow = structuredClone(flow) as CompiledFlow;
      const first = badCompiledFlow.steps[0];
      if (first === undefined || first.kind !== 'compose') throw new Error('fixture drift');
      first.writes.report.path = path as never;

      await expect(
        runCompiledFlow({
          runFolder,
          flow: badCompiledFlow,
          flowBytes: bytes,
          runId: RunId.parse('68000000-0000-0000-0000-000000000101'),
          goal: `prove compose report path cannot escape: ${label}`,
          depth: 'standard',
          change_kind: change_kind(),
          now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
          relayer: relayerWithCapture([]),
        }),
      ).rejects.toThrow(/run-relative path/i);

      expect(existsSync(forbiddenPath)).toBe(false);
    }
  });

  it('rejects relay reads escape before prompt composition can read outside runFolder', async () => {
    const { flow, bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'run');
    const secret = join(runFolderBase, 'secret.txt');
    writeFileSync(secret, 'outside-secret');
    const prompts: string[] = [];
    const badCompiledFlow = structuredClone(flow) as CompiledFlow;
    const relay = badCompiledFlow.steps.find((step) => step.kind === 'relay');
    if (relay === undefined || relay.kind !== 'relay') throw new Error('fixture drift');
    relay.reads = ['../secret.txt' as never];

    await expect(
      runCompiledFlow({
        runFolder,
        flow: badCompiledFlow,
        flowBytes: bytes,
        runId: RunId.parse('68000000-0000-0000-0000-000000000102'),
        goal: 'prove relay reads cannot escape',
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
        relayer: relayerWithCapture(prompts),
      }),
    ).rejects.toThrow(/run-relative path/i);

    expect(prompts).toEqual([]);
  });

  it('rejects relay transcript and report path escapes before writing partial files', () => {
    const validWrites = {
      request: 'reports/relay/request.txt',
      receipt: 'reports/relay/receipt.txt',
      result: 'reports/relay/result.txt',
      report: {
        path: 'reports/relay/report.json',
        schema: 'relay@v1',
      },
    };
    const cases = [
      ['request', { ...validWrites, request: '../request.txt' }],
      ['receipt', { ...validWrites, receipt: '../receipt.txt' }],
      ['result', { ...validWrites, result: '../result.txt' }],
      ['report', { ...validWrites, report: { ...validWrites.report, path: '../report.json' } }],
      ['current', { ...validWrites, request: 'reports/./request.txt' }],
    ] as const;

    for (const [field, writes] of cases) {
      const runFolder = join(runFolderBase, `run-${field}`);
      expect(() =>
        materializeRelay({
          runId: RunId.parse('68000000-0000-0000-0000-000000000103'),
          stepId: StepId.parse('relay-step'),
          attempt: 1,
          role: 'researcher',
          startingSequence: 1,
          runFolder,
          writes,
          connector: { kind: 'builtin', name: 'claude-code' },
          resolvedSelection: { skills: [], invocation_options: {} },
          resolvedFrom: { source: 'explicit' },
          relayResult: {
            request_payload: 'request payload',
            receipt_id: 'receipt-id',
            result_body: '{"verdict":"ok"}',
            duration_ms: 1,
            cli_version: '0.0.0-stub',
          },
          verdict: 'ok',
          now: () => new Date(Date.UTC(2026, 3, 24, 12, 0, 0)),
        }),
      ).toThrow(/run-relative path/i);

      expect(existsSync(join(runFolderBase, `${field}.txt`))).toBe(false);
      expect(existsSync(join(runFolderBase, `${field}.json`))).toBe(false);
      expect(existsSync(join(runFolder, 'reports'))).toBe(false);
    }
  });

  it('rejects symlinked compose, relay read, and relay write ancestors inside runFolder', async () => {
    const { flow, bytes } = loadFixture();

    const composeRunFolder = join(runFolderBase, 'run-symlink-compose');
    const composeOutside = join(runFolderBase, 'outside-compose');
    mkdirSync(composeRunFolder, { recursive: true });
    mkdirSync(composeOutside, { recursive: true });
    symlinkSync(composeOutside, join(composeRunFolder, 'reports'));
    const composeCompiledFlow = structuredClone(flow) as CompiledFlow;
    const first = composeCompiledFlow.steps[0];
    if (first === undefined || first.kind !== 'compose') throw new Error('fixture drift');
    first.writes.report.path = 'reports/escaped.json' as never;

    await expect(
      runCompiledFlow({
        runFolder: composeRunFolder,
        flow: composeCompiledFlow,
        flowBytes: bytes,
        runId: RunId.parse('68000000-0000-0000-0000-000000000104'),
        goal: 'prove compose symlink ancestors cannot escape',
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
        relayer: relayerWithCapture([]),
      }),
    ).rejects.toThrow(/symlink/i);
    expect(existsSync(join(composeOutside, 'escaped.json'))).toBe(false);

    const readRunFolder = join(runFolderBase, 'run-symlink-read');
    const readOutside = join(runFolderBase, 'outside-read');
    mkdirSync(readRunFolder, { recursive: true });
    mkdirSync(readOutside, { recursive: true });
    symlinkSync(readOutside, join(readRunFolder, 'links'));
    writeFileSync(join(readOutside, 'secret.txt'), 'outside-secret');
    const prompts: string[] = [];
    const readCompiledFlow = structuredClone(flow) as CompiledFlow;
    const relay = readCompiledFlow.steps.find((step) => step.kind === 'relay');
    if (relay === undefined || relay.kind !== 'relay') throw new Error('fixture drift');
    relay.reads = ['links/secret.txt' as never];

    await expect(
      runCompiledFlow({
        runFolder: readRunFolder,
        flow: readCompiledFlow,
        flowBytes: bytes,
        runId: RunId.parse('68000000-0000-0000-0000-000000000105'),
        goal: 'prove relay read symlink ancestors cannot escape',
        depth: 'standard',
        change_kind: change_kind(),
        now: deterministicNow(Date.UTC(2026, 3, 24, 12, 0, 0)),
        relayer: relayerWithCapture(prompts),
      }),
    ).rejects.toThrow(/symlink/i);
    expect(prompts).toEqual([]);

    const writeRunFolder = join(runFolderBase, 'run-symlink-write');
    const writeOutside = join(runFolderBase, 'outside-write');
    mkdirSync(writeRunFolder, { recursive: true });
    mkdirSync(writeOutside, { recursive: true });
    symlinkSync(writeOutside, join(writeRunFolder, 'reports'));

    expect(() =>
      materializeRelay({
        runId: RunId.parse('68000000-0000-0000-0000-000000000106'),
        stepId: StepId.parse('relay-step'),
        attempt: 1,
        role: 'researcher',
        startingSequence: 1,
        runFolder: writeRunFolder,
        writes: {
          request: 'reports/request.txt',
          receipt: 'reports/receipt.txt',
          result: 'reports/result.txt',
          report: { path: 'reports/report.json', schema: 'relay@v1' },
        },
        connector: { kind: 'builtin', name: 'claude-code' },
        resolvedSelection: { skills: [], invocation_options: {} },
        resolvedFrom: { source: 'explicit' },
        relayResult: {
          request_payload: 'request payload',
          receipt_id: 'receipt-id',
          result_body: '{"verdict":"ok"}',
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        },
        verdict: 'ok',
        now: () => new Date(Date.UTC(2026, 3, 24, 12, 0, 0)),
      }),
    ).toThrow(/symlink/i);
    expect(existsSync(join(writeOutside, 'request.txt'))).toBe(false);
  });
});
