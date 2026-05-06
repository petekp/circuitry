import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
} from '../../src/compat/retained-runtime.js';
import { runRetainedCompiledFlow as runCompiledFlow } from '../../src/compat/retained-runtime.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';

// Sub-run runtime test. Verifies that a parent flow declaring a
// `sub-run` step:
//   - Resolves the child flow through the injected resolver.
//   - Mints a fresh RunId for the child (RUN-I3 cross-run smuggling
//     stays forbidden — no shared run_id).
//   - Provisions a sibling child run-folder under the parent's runs base.
//   - Emits sub_run.{started,completed} on the parent's trace
//     carrying the child_run_id linkage and the observed verdict.
//   - Copies the child's result.json bytes into the parent's
//     `step.writes.result` slot for downstream consumers.
//   - Admits or rejects the child against `step.check.pass`.

const PARENT_WORKFLOW_ID = 'parent-test' as unknown as CompiledFlowId;
const CHILD_WORKFLOW_ID = 'child-test' as unknown as CompiledFlowId;

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'sub-run handler omits child audit linkage or shares parent run id',
    acceptance_evidence:
      'parent log carries sub_run.started + sub_run.completed with distinct child_run_id, child run-folder sibling to parent, child result.json copied verbatim into parent writes.result slot',
    alternate_framing: 'unit test of the sub-run handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function unusedRelayer(): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async () => {
      throw new Error('relayer should not run during sub-run-only parent execution');
    },
  };
}

function buildParentCompiledFlow(parentCheckPass: readonly string[]): CompiledFlow {
  const raw = {
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run runtime test parent — exercises one sub-run step end-to-end',
    entry: {
      signals: { include: ['sub-run-test'], exclude: [] },
      intent_prefixes: ['sub-run-test'],
    },
    entry_modes: [
      {
        name: 'sub-run-test',
        start_at: 'sub-run-step',
        depth: 'standard',
        description: 'Default sub-run-test entry mode.',
      },
    ],
    stages: [
      {
        id: 'act-stage',
        title: 'Act',
        canonical: 'act',
        steps: ['sub-run-step'],
      },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow sub-run runtime test — only act stage carries the sub-run step.',
    },
    steps: [
      {
        id: 'sub-run-step',
        title: 'Sub-run — invoke child flow',
        protocol: 'sub-run-protocol@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'sub-run',
        flow_ref: {
          flow_id: CHILD_WORKFLOW_ID as unknown as string,
          entry_mode: 'default',
        },
        goal: 'child run goal',
        depth: 'standard',
        writes: { result: 'reports/child-result.json' },
        check: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: parentCheckPass,
        },
      },
    ],
  };
  return CompiledFlow.parse(raw);
}

function buildChildCompiledFlow(): CompiledFlow {
  // The child has a single compose step. The child runner is stubbed
  // anyway (it never runs the child's loop), so the child flow
  // shape only has to type-check through CompiledFlow.parse — the stub
  // childRunner produces a synthetic result.json.
  const raw = {
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run runtime test child — single compose step.',
    entry: { signals: { include: ['child-test'], exclude: [] }, intent_prefixes: ['child-test'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-step',
        depth: 'standard',
        description: 'Default child entry mode.',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow stub child for sub-run test.',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child compose',
        protocol: 'child-compose@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: { path: 'reports/child-compose.json', schema: 'child-compose@v1' },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary'],
        },
      },
    ],
  };
  return CompiledFlow.parse(raw);
}

function makeChildResolver(child: {
  flow: CompiledFlow;
  bytes: Buffer;
}): ChildCompiledFlowResolver {
  return () => child;
}

// Stub childRunner that bypasses real child execution. Writes a
// synthetic child result.json (with a verdict field) into the child's
// runFolder/reports and returns a minimal CompiledFlowRunResult. This
// isolates the parent's sub-run handler logic from the child's full
// loop while still exercising the path-derivation, file-copy, and
// audit-trace_entry surface the handler is responsible for.
function makeStubChildRunner(observed: {
  verdict: string;
  outcome: 'complete' | 'aborted';
  capturedRunIds: { value: RunId | undefined };
}): CompiledFlowRunner {
  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
    observed.capturedRunIds.value = inv.runId;
    const childResultAbs = resultPath(inv.runFolder);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: inv.runId as unknown as string,
      flow_id: inv.flow.id as unknown as string,
      goal: inv.goal,
      outcome: observed.outcome,
      summary: 'stub child result',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      verdict: observed.verdict,
    });
    writeFileSync(childResultAbs, `${JSON.stringify(body, null, 2)}\n`);
    return {
      runFolder: inv.runFolder,
      result: body,
      snapshot: Snapshot.parse({
        schema_version: 1,
        run_id: body.run_id,
        flow_id: body.flow_id,
        depth: 'standard',
        change_kind: inv.change_kind,
        status: observed.outcome === 'complete' ? 'complete' : 'aborted',
        steps: [],
        trace_entries_consumed: 1,
        manifest_hash: 'stub-manifest-hash',
        updated_at: new Date(0).toISOString(),
      }),
      trace_entries: [],
      relayResults: [],
    };
  };
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-sub-run-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('sub-run runtime', () => {
  it('runs the child, copies result.json into parent writes.result, and admits an in-check verdict', async () => {
    const parentCompiledFlow = buildParentCompiledFlow(['ok']);
    const parentBytes = Buffer.from(JSON.stringify(parentCompiledFlow));
    const childCompiledFlow = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(childCompiledFlow));

    const observed = {
      verdict: 'ok',
      outcome: 'complete' as const,
      capturedRunIds: { value: undefined as RunId | undefined },
    };
    const stubChildRunner = makeStubChildRunner(observed);
    const childResolver = makeChildResolver({ flow: childCompiledFlow, bytes: childBytes });

    const parentRunId = RunId.parse('11111111-1111-1111-1111-111111111111');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parentCompiledFlow,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent run goal',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0)),
      relayer: unusedRelayer(),
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
    });

    expect(outcome.result.outcome).toBe('complete');

    // RUN-I3: child has a fresh RunId distinct from parent.
    const childRunId = observed.capturedRunIds.value;
    expect(childRunId).toBeDefined();
    expect(childRunId).not.toBe(parentRunId);

    // sub_run.started + sub_run.completed both fired with matching
    // child_run_id. (The parent's trace_entries log is the audit trail.)
    const subRunStarted = outcome.trace_entries.find((e) => e.kind === 'sub_run.started');
    const subRunCompleted = outcome.trace_entries.find((e) => e.kind === 'sub_run.completed');
    if (subRunStarted?.kind !== 'sub_run.started') throw new Error('expected sub_run.started');
    if (subRunCompleted?.kind !== 'sub_run.completed')
      throw new Error('expected sub_run.completed');
    expect(subRunStarted.child_run_id).toBe(childRunId);
    expect(subRunCompleted.child_run_id).toBe(childRunId);
    expect(subRunCompleted.verdict).toBe('ok');
    expect(subRunCompleted.child_outcome).toBe('complete');

    // Parent's check admitted the child verdict.
    const passCheck = outcome.trace_entries.find(
      (e) =>
        e.kind === 'check.evaluated' &&
        e.check_kind === 'result_verdict' &&
        e.step_id === ('sub-run-step' as unknown as typeof e.step_id),
    );
    if (passCheck?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(passCheck.outcome).toBe('pass');

    // Parent's writes.result slot received the child's result.json bytes.
    const parentResultPath = join(parentRunFolder, 'reports', 'child-result.json');
    const parentBody = JSON.parse(readFileSync(parentResultPath, 'utf8')) as { verdict: string };
    expect(parentBody.verdict).toBe('ok');

    // Child run-folder is a sibling of parent's run-folder under the same
    // runs-base directory, NOT nested under parent's run-folder.
    const expectedChildRunFolder = join(runFolderBase, childRunId as unknown as string);
    expect(observed.capturedRunIds.value).toBeDefined();
    const childResultJsonExists = readFileSync(
      join(expectedChildRunFolder, 'reports', 'result.json'),
      'utf8',
    );
    expect(childResultJsonExists).toContain('"verdict": "ok"');
  });

  it('rejects an out-of-check child verdict and aborts the parent step', async () => {
    const parentCompiledFlow = buildParentCompiledFlow(['ok']);
    const parentBytes = Buffer.from(JSON.stringify(parentCompiledFlow));
    const childCompiledFlow = buildChildCompiledFlow();
    const childBytes = Buffer.from(JSON.stringify(childCompiledFlow));

    const observed = {
      verdict: 'reject',
      outcome: 'complete' as const,
      capturedRunIds: { value: undefined as RunId | undefined },
    };
    const stubChildRunner = makeStubChildRunner(observed);
    const childResolver = makeChildResolver({ flow: childCompiledFlow, bytes: childBytes });

    const parentRunId = RunId.parse('11111111-1111-1111-1111-111111111112');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parentCompiledFlow,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'parent check-rejection test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 0, 30, 0)),
      relayer: unusedRelayer(),
      childCompiledFlowResolver: childResolver,
      childRunner: stubChildRunner,
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('reject');

    // sub_run.completed still fired with the observed verdict before
    // the check rejected — durable transcript of what the child said.
    const subRunCompleted = outcome.trace_entries.find((e) => e.kind === 'sub_run.completed');
    if (subRunCompleted?.kind !== 'sub_run.completed')
      throw new Error('expected sub_run.completed');
    expect(subRunCompleted.verdict).toBe('reject');

    const failCheck = outcome.trace_entries.find(
      (e) =>
        e.kind === 'check.evaluated' && e.check_kind === 'result_verdict' && e.outcome === 'fail',
    );
    expect(failCheck).toBeDefined();
  });

  it('aborts cleanly when the resolver is missing', async () => {
    const parentCompiledFlow = buildParentCompiledFlow(['ok']);
    const parentBytes = Buffer.from(JSON.stringify(parentCompiledFlow));

    const parentRunId = RunId.parse('11111111-1111-1111-1111-111111111113');
    const parentRunFolder = join(runFolderBase, parentRunId as unknown as string);

    const outcome = await runCompiledFlow({
      runFolder: parentRunFolder,
      flow: parentCompiledFlow,
      flowBytes: parentBytes,
      runId: parentRunId,
      goal: 'missing-resolver test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 27, 1, 0, 0)),
      relayer: unusedRelayer(),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain('childCompiledFlowResolver');
  });
});
