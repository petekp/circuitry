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
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  claimRetainedFreshRunFolder as claimFreshRunFolder,
  releaseRetainedFreshRunFolderClaim as releaseFreshRunFolderClaim,
  runRetainedCompiledFlow as runCompiledFlow,
} from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import { manifestSnapshotPath } from '../../src/runtime/manifest-snapshot-writer.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import { snapshotPath } from '../../src/runtime/snapshot-writer.js';
import { traceEntryLogPath } from '../../src/runtime/trace-writer.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const FIXTURE_PATH = resolve('generated/flows/runtime-proof/circuit.json');

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
    failure_mode: 'run-folder reuse can corrupt prior run evidence',
    acceptance_evidence:
      'fresh run-folder guard rejects reuse before trace_entries, manifest, state, or result bytes change',
    alternate_framing:
      'implement resume mode — rejected because this slice only adds a fresh-run guard',
  };
}

function stubRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-fresh-run-folder',
      result_body: '{"verdict":"ok"}',
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

async function closeFixtureRun(input: {
  runFolder: string;
  runId: string;
  goal: string;
  startMs: number;
}): Promise<void> {
  const { flow, bytes } = loadFixture();
  await runCompiledFlow({
    runFolder: input.runFolder,
    flow,
    flowBytes: bytes,
    runId: RunId.parse(input.runId),
    goal: input.goal,
    depth: 'standard',
    change_kind: change_kind(),
    now: deterministicNow(input.startMs),
    relayer: stubRelayer(),
  });
}

function persistentRunBytes(runFolder: string): ReadonlyMap<string, string> {
  return new Map(
    [
      traceEntryLogPath(runFolder),
      manifestSnapshotPath(runFolder),
      snapshotPath(runFolder),
      resultPath(runFolder),
    ].map((path) => [path, readFileSync(path, 'utf8')] as const),
  );
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-fresh-root-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('runtime-safety-floor fresh run-folder guard', () => {
  it('claims an empty run-folder before the first persistent report is written', () => {
    const runFolder = join(runFolderBase, 'claimed-before-first-write');
    const claim = claimFreshRunFolder(runFolder);
    try {
      expect(existsSync(traceEntryLogPath(runFolder))).toBe(false);
      expect(existsSync(manifestSnapshotPath(runFolder))).toBe(false);
      expect(existsSync(snapshotPath(runFolder))).toBe(false);
      expect(existsSync(resultPath(runFolder))).toBe(false);

      expect(() => claimFreshRunFolder(runFolder)).toThrow(/run-folder reuse.*checkpoint resume/i);

      expect(existsSync(traceEntryLogPath(runFolder))).toBe(false);
      expect(existsSync(manifestSnapshotPath(runFolder))).toBe(false);
      expect(existsSync(snapshotPath(runFolder))).toBe(false);
      expect(existsSync(resultPath(runFolder))).toBe(false);
    } finally {
      releaseFreshRunFolderClaim(claim);
    }
  });

  it('rejects run-folder reuse before trace_entries, manifest, state, or result bytes change', async () => {
    const runFolder = join(runFolderBase, 'reused-root');
    await closeFixtureRun({
      runFolder,
      runId: '69000000-0000-0000-0000-000000000201',
      goal: 'first run owns this root',
      startMs: Date.UTC(2026, 3, 24, 14, 0, 0),
    });
    const before = persistentRunBytes(runFolder);

    await expect(
      closeFixtureRun({
        runFolder,
        runId: '69000000-0000-0000-0000-000000000202',
        goal: 'second run must not mutate this root',
        startMs: Date.UTC(2026, 3, 24, 15, 0, 0),
      }),
    ).rejects.toThrow(/run-folder reuse.*checkpoint resume/i);

    for (const [path, contents] of before) {
      expect(readFileSync(path, 'utf8')).toBe(contents);
    }
  });

  it('permits an existing empty run-folder directory', async () => {
    const runFolder = join(runFolderBase, 'precreated-empty-root');
    mkdirSync(runFolder, { recursive: true });

    await closeFixtureRun({
      runFolder,
      runId: '69000000-0000-0000-0000-000000000203',
      goal: 'precreated empty root is still a fresh run',
      startMs: Date.UTC(2026, 3, 24, 16, 0, 0),
    });

    expect(existsSync(traceEntryLogPath(runFolder))).toBe(true);
    expect(existsSync(manifestSnapshotPath(runFolder))).toBe(true);
    expect(existsSync(snapshotPath(runFolder))).toBe(true);
    expect(existsSync(resultPath(runFolder))).toBe(true);
  });

  it('rejects an existing file or symlink run-folder with the reuse/no-resume message', () => {
    const fileRoot = join(runFolderBase, 'file-root');
    writeFileSync(fileRoot, 'not a directory');
    expect(() => claimFreshRunFolder(fileRoot)).toThrow(/run-folder reuse.*checkpoint resume/i);
    expect(readFileSync(fileRoot, 'utf8')).toBe('not a directory');

    const symlinkTarget = join(runFolderBase, 'symlink-target');
    const symlinkRoot = join(runFolderBase, 'symlink-root');
    mkdirSync(symlinkTarget, { recursive: true });
    symlinkSync(symlinkTarget, symlinkRoot);
    expect(() => claimFreshRunFolder(symlinkRoot)).toThrow(/run-folder reuse.*checkpoint resume/i);
    expect(existsSync(traceEntryLogPath(symlinkTarget))).toBe(false);
  });

  it('rejects each canonical run report marker before writing new bytes', async () => {
    const cases = [
      ['trace_entries', traceEntryLogPath],
      ['manifest', manifestSnapshotPath],
      ['state', snapshotPath],
      ['result', resultPath],
    ] as const;

    for (const [index, [label, pathFor]] of cases.entries()) {
      const runFolder = join(runFolderBase, `marker-${label}`);
      const markerPath = pathFor(runFolder);
      mkdirSync(dirname(markerPath), { recursive: true });
      writeFileSync(markerPath, `sentinel-${label}`);

      await expect(
        closeFixtureRun({
          runFolder,
          runId: `69000000-0000-0000-0000-00000000030${index}`,
          goal: `marker ${label} must reject reuse`,
          startMs: Date.UTC(2026, 3, 24, 17, 0, 0),
        }),
      ).rejects.toThrow(/run-folder reuse.*checkpoint resume/i);

      expect(readFileSync(markerPath, 'utf8')).toBe(`sentinel-${label}`);
    }
  });
});
