// Real recursion integration test for sub-run.
//
// Sister test to `sub-run-runtime.test.ts`, which exercises the
// parent's sub-run handler with a stubbed `childRunner` so the
// handler's own surface (path derivation, file copy, audit entries,
// check admission) can be tested in isolation. This test omits the
// stub: when `childRunner` is undefined on the CompiledFlowInvocation,
// the runner defaults to `runCompiledFlow` itself, and the parent's
// sub-run step recurses into a real child execution end-to-end.
//
// Why this is worth its own test: every other parent sub-run / fanout
// test stubs the child. The "child flow actually runs through the same
// runner code path the parent did" claim is otherwise trust-by-stubbing.
// This test pins it: a real recursive call produces a real child trace,
// a real child result.json, and a real verdict that the parent admits
// via its check.
//
// Hermetic: a fake relayer serves both parent and child (the child's
// single relay step uses it); no subprocesses spawn. Fast: ~50ms.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ChildCompiledFlowResolver } from '../../src/compat/retained-runtime.js';
import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import type { ClaudeCodeRelayInput } from '../../src/runtime/connectors/claude-code.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

const PARENT_WORKFLOW_ID = 'parent-recursion-test' as unknown as CompiledFlowId;
const CHILD_WORKFLOW_ID = 'child-recursion-test' as unknown as CompiledFlowId;

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'sub-run handler skips real child execution or shares the runner instance with the parent',
    acceptance_evidence:
      'real runCompiledFlow recurses into the child with a fresh RunId and a sibling run-folder, child emits its own trace, parent admits child verdict',
    alternate_framing:
      'integration test of sub-run + real recursive runCompiledFlow rather than handler-isolation unit test',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

// Fake relayer serves both parent and child. The parent's only
// step is a sub-run (no relay path), so this relayer is
// invoked exactly once — by the child's single relay step.
function acceptingRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => ({
      request_payload: input.prompt,
      receipt_id: 'stub-receipt-real-recursion',
      result_body: JSON.stringify({ verdict: 'accept' }),
      duration_ms: 1,
      cli_version: '0.0.0-stub',
    }),
  };
}

function buildChildCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose:
      'real-recursion test child — single relay step admits an accept verdict via the fake relayer.',
    entry: { signals: { include: ['child'], exclude: [] }, intent_prefixes: ['child'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-relay',
        depth: 'standard',
        description: 'Default child entry mode.',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['child-relay'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow real-recursion test child — only act stage carries the relay step.',
    },
    steps: [
      {
        id: 'child-relay',
        title: 'Child relay — admits an accept verdict',
        protocol: 'real-recursion-child@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'worker',
        kind: 'relay',
        role: 'implementer',
        writes: {
          request: 'reports/relay.request.json',
          receipt: 'reports/relay.receipt.json',
          result: 'reports/relay.result.json',
        },
        check: {
          kind: 'result_verdict',
          source: { kind: 'relay_result', ref: 'result' },
          pass: ['accept'],
        },
      },
    ],
  });
}

function buildParentCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose:
      'real-recursion test parent — single sub-run step recurses into the child via real runCompiledFlow.',
    entry: { signals: { include: ['parent'], exclude: [] }, intent_prefixes: ['parent'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'sub-run-step',
        depth: 'standard',
        description: 'Default parent entry mode.',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['sub-run-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow real-recursion test parent — only act stage carries the sub-run step.',
    },
    steps: [
      {
        id: 'sub-run-step',
        title: 'Sub-run — recurse into child via real runCompiledFlow',
        protocol: 'real-recursion-parent@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'sub-run',
        flow_ref: {
          flow_id: CHILD_WORKFLOW_ID as unknown as string,
          entry_mode: 'default',
        },
        goal: 'child run goal — exercise real recursion',
        depth: 'standard',
        writes: { result: 'reports/child-result.json' },
        check: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: ['accept'],
        },
      },
    ],
  });
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'sub-run-real-recursion-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('sub-run real recursion', () => {
  it('runs the child via real runCompiledFlow (no childRunner stub) and admits the child verdict', async () => {
    const parentCompiledFlow = buildParentCompiledFlow();
    const parentBytes = Buffer.from(JSON.stringify(parentCompiledFlow));
    const childCompiledFlow = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(childCompiledFlow));

    const childResolver: ChildCompiledFlowResolver = () => ({
      flow: childCompiledFlow,
      bytes: childBytes,
    });

    const parentRunId = RunId.parse('22222222-2222-2222-2222-222222222222');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    // KEY: NO `childRunner` field — runner defaults to `runCompiledFlow`
    // itself, so the sub-run step recurses through the real runner.
    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parentCompiledFlow,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent run goal — exercise real recursion',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0)),
      relayer: acceptingRelayer(),
      childCompiledFlowResolver: childResolver,
    });

    // Parent closed with verdict admitted.
    if (outcome.result.outcome === 'checkpoint_waiting') {
      throw new Error('parent unexpectedly waited at a checkpoint');
    }
    expect(outcome.result.outcome).toBe('complete');
    expect(outcome.result.verdict).toBe('accept');

    // Sub-run audit linkage on the parent's trace.
    const subRunStarted = outcome.trace_entries.find((e) => e.kind === 'sub_run.started');
    const subRunCompleted = outcome.trace_entries.find((e) => e.kind === 'sub_run.completed');
    if (subRunStarted?.kind !== 'sub_run.started') throw new Error('expected sub_run.started');
    if (subRunCompleted?.kind !== 'sub_run.completed')
      throw new Error('expected sub_run.completed');

    // RUN-I3: child run id is a fresh UUID, not the parent's.
    const childRunId = subRunStarted.child_run_id;
    expect(childRunId).not.toBe(parentRunId as unknown as string);
    expect(subRunCompleted.child_run_id).toBe(childRunId);
    expect(subRunCompleted.verdict).toBe('accept');
    expect(subRunCompleted.child_outcome).toBe('complete');

    // Child run-folder is a sibling of parent's run-folder under the
    // shared runs-base directory.
    const expectedChildRunFolder = join(runFolderBase, childRunId);

    // Child's OWN result.json was written at the child's run-folder.
    const childResultBytes = readFileSync(
      join(expectedChildRunFolder, 'reports', 'result.json'),
      'utf8',
    );
    const childResultBody = JSON.parse(childResultBytes) as {
      run_id: string;
      flow_id: string;
      verdict: string;
      outcome: string;
    };
    expect(childResultBody.run_id).toBe(childRunId);
    expect(childResultBody.flow_id).toBe(CHILD_WORKFLOW_ID as unknown as string);
    expect(childResultBody.verdict).toBe('accept');
    expect(childResultBody.outcome).toBe('complete');

    // Child has its OWN trace under its run-folder — proof the
    // recursive runner produced a separate trace_entry stream rather than
    // appending to the parent's. Real-recursion's smoking gun.
    const childTraceEntriesPath = join(expectedChildRunFolder, 'trace.ndjson');
    const childTraceEntriesRaw = readFileSync(childTraceEntriesPath, 'utf8');
    const childTraceEntryLines = childTraceEntriesRaw.split('\n').filter((line) => line.length > 0);
    expect(childTraceEntryLines.length).toBeGreaterThan(0);
    // Every child trace_entry carries the child's run_id, never the parent's.
    for (const line of childTraceEntryLines) {
      const parsed = JSON.parse(line) as { run_id: string };
      expect(parsed.run_id).toBe(childRunId);
      expect(parsed.run_id).not.toBe(parentRunId as unknown as string);
    }
    // Child trace includes the relay lifecycle trace_entries that
    // prove the child's relay step actually executed (rather than
    // being short-circuited).
    const childTraceEntryKinds = new Set(
      childTraceEntryLines.map((line) => (JSON.parse(line) as { kind: string }).kind),
    );
    expect(childTraceEntryKinds.has('relay.started')).toBe(true);
    expect(childTraceEntryKinds.has('relay.completed')).toBe(true);
    expect(childTraceEntryKinds.has('check.evaluated')).toBe(true);

    // Parent's writes.result slot received a verbatim copy of the
    // child's result.json bytes (NOT a re-derived projection).
    const parentResultCopyPath = join(parentRunFolder, 'reports', 'child-result.json');
    const parentCopyBytes = readFileSync(parentResultCopyPath, 'utf8');
    expect(parentCopyBytes).toBe(childResultBytes);

    // Parent's check admitted the child's verdict.
    const passCheck = outcome.trace_entries.find(
      (e) =>
        e.kind === 'check.evaluated' &&
        e.check_kind === 'result_verdict' &&
        e.step_id === ('sub-run-step' as unknown as typeof e.step_id),
    );
    if (passCheck?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(passCheck.outcome).toBe('pass');

    // Two distinct run-folders exist as siblings under the runs base.
    const runFolderEntries = readdirSync(runFolderBase).sort();
    expect(runFolderEntries).toContain(parentRunId as unknown as string);
    expect(runFolderEntries).toContain(childRunId);
    expect(runFolderEntries.length).toBeGreaterThanOrEqual(2);
  });
});
