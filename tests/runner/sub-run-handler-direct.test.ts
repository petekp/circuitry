// Direct unit tests for the sub-run step handler.
//
// `sub-run-runtime.test.ts` exercises the handler transitively (3 cases
// — happy path, out-of-check verdict, missing resolver), and
// `sub-run-real-recursion.test.ts` proves real recursion works
// end-to-end. Neither covers the handler-local early-abort branches that
// fire BEFORE child execution: divergent writes.report path, resolver
// throw, resolver-returns-wrong-id, child invocation throw,
// child-returned-checkpoint-waiting, and the full evaluateChildVerdict
// shape lattice (parse fail, non-object, missing verdict). This file
// invokes `runSubRunStep` directly against a minimal in-memory
// `StepHandlerContext` to pin each branch's reason string + trace
// sequence.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  ChildCompiledFlowResolver,
  CompiledFlowInvocation,
  CompiledFlowRunResult,
  CompiledFlowRunner,
} from '../../src/compat/retained-runtime.js';
import { resultPath } from '../../src/runtime/result-writer.js';
import { runSubRunStep } from '../../src/runtime/step-handlers/sub-run.js';
import type { RunState, StepHandlerContext } from '../../src/runtime/step-handlers/types.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { type CompiledFlowId, RunId } from '../../src/schemas/ids.js';
import { RunResult } from '../../src/schemas/result.js';
import { Snapshot } from '../../src/schemas/snapshot.js';
import type { TraceEntry } from '../../src/schemas/trace-entry.js';
import { expectStepAborted } from '../helpers/failure-message.js';

const PARENT_WORKFLOW_ID = 'sub-run-direct-parent' as unknown as CompiledFlowId;
const CHILD_WORKFLOW_ID = 'sub-run-direct-child' as unknown as CompiledFlowId;
const PARENT_RUN_ID = RunId.parse('55555555-5555-5555-5555-555555555555');

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode:
      'sub-run handler emits the wrong trace_entry sequence on a known early-abort or verdict-shape path',
    acceptance_evidence:
      'each handler-local error path emits the expected check.evaluated/fail + step.aborted pair with the right reason',
    alternate_framing: 'unit test of the sub-run step handler in isolation',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function buildParentCompiledFlow(opts: {
  passVerdicts: readonly string[];
  divergentReportPath?: string;
}): CompiledFlow {
  const writes: Record<string, unknown> = { result: 'reports/child-result.json' };
  if (opts.divergentReportPath !== undefined) {
    writes.report = {
      path: opts.divergentReportPath,
      schema: 'sub-run-direct-result@v1',
    };
  }
  return CompiledFlow.parse({
    schema_version: '2',
    id: PARENT_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run handler direct-test fixture (parent).',
    entry: { signals: { include: ['x'], exclude: [] }, intent_prefixes: ['x'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'sub-run-step',
        depth: 'standard',
        description: 'parent fixture',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['sub-run-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct sub-run handler test fixture',
    },
    steps: [
      {
        id: 'sub-run-step',
        title: 'Sub-run — direct handler test',
        protocol: 'sub-run-direct@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'sub-run',
        flow_ref: {
          flow_id: CHILD_WORKFLOW_ID as unknown as string,
          entry_mode: 'default',
        },
        goal: 'direct handler child goal',
        depth: 'standard',
        writes,
        check: {
          kind: 'result_verdict',
          source: { kind: 'sub_run_result', ref: 'result' },
          pass: opts.passVerdicts,
        },
      },
    ],
  });
}

function buildChildCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: CHILD_WORKFLOW_ID as unknown as string,
    version: '0.1.0',
    purpose: 'sub-run handler direct-test fixture (child) — never executed end-to-end.',
    entry: { signals: { include: ['y'], exclude: [] }, intent_prefixes: ['y'] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'child-step',
        depth: 'standard',
        description: 'child fixture',
      },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['child-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'narrow direct sub-run handler test child',
    },
    steps: [
      {
        id: 'child-step',
        title: 'Child compose stub',
        protocol: 'sub-run-direct-child@v1',
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
  });
}

interface ChildRunnerSpec {
  // If set, the runner throws this error.
  readonly throwError?: Error;
  // If set, the runner returns checkpoint_waiting with this stepId.
  readonly checkpointStepId?: string;
  // Otherwise, the runner writes this result_body verbatim into the
  // child's result.json and returns outcome='complete' with that body.
  readonly resultBody?: string;
}

function makeStubChildRunner(spec: ChildRunnerSpec): CompiledFlowRunner {
  return async (inv: CompiledFlowInvocation): Promise<CompiledFlowRunResult> => {
    if (spec.throwError !== undefined) throw spec.throwError;
    const childRunId = inv.runId;
    if (spec.checkpointStepId !== undefined) {
      // Per result-writer semantics, a checkpoint_waiting result is
      // not written to disk — the runner returns it on the CompiledFlowRunResult.
      return {
        runFolder: inv.runFolder,
        result: {
          schema_version: 1,
          run_id: childRunId,
          flow_id: inv.flow.id,
          goal: inv.goal,
          outcome: 'checkpoint_waiting',
          summary: 'stub child waiting at checkpoint',
          trace_entries_observed: 1,
          manifest_hash: 'stub-manifest-hash',
          checkpoint: {
            step_id: spec.checkpointStepId,
            request_path: 'reports/checkpoint.request.json',
            allowed_choices: ['proceed', 'abort'],
          },
        },
        snapshot: Snapshot.parse({
          schema_version: 1,
          run_id: childRunId as unknown as string,
          flow_id: inv.flow.id as unknown as string,
          depth: inv.depth ?? 'standard',
          change_kind: inv.change_kind,
          status: 'in_progress',
          steps: [],
          trace_entries_consumed: 1,
          manifest_hash: 'stub-manifest-hash',
          updated_at: new Date(0).toISOString(),
        }),
        trace_entries: [],
        relayResults: [],
      };
    }
    // Default path: write the requested body into the child's result.json.
    const childResultAbs = resultPath(inv.runFolder);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = spec.resultBody ?? '';
    writeFileSync(childResultAbs, body);
    // Build a RunResult shape for the return value. The handler reads
    // from the file on disk for verdict evaluation, so the in-memory
    // .result body just needs `outcome` to be set.
    let runResult: unknown;
    try {
      runResult = RunResult.parse(JSON.parse(body));
    } catch {
      // Body is intentionally malformed for some tests — return a
      // minimum valid shape so the handler can read the file and
      // observe its parse failure on its own.
      runResult = RunResult.parse({
        schema_version: 1,
        run_id: childRunId as unknown as string,
        flow_id: inv.flow.id as unknown as string,
        goal: inv.goal,
        outcome: 'complete',
        summary: 'stub for direct test',
        closed_at: new Date(0).toISOString(),
        trace_entries_observed: 1,
        manifest_hash: 'stub-manifest-hash',
      });
    }
    return {
      runFolder: inv.runFolder,
      result: runResult as CompiledFlowRunResult['result'],
      snapshot: Snapshot.parse({
        schema_version: 1,
        run_id: childRunId as unknown as string,
        flow_id: inv.flow.id as unknown as string,
        depth: inv.depth ?? 'standard',
        change_kind: inv.change_kind,
        status: 'complete',
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

interface BuildHarnessOpts {
  readonly passVerdicts: readonly string[];
  readonly divergentReportPath?: string;
  readonly skipResolver?: boolean;
  readonly resolverThrow?: Error;
  readonly resolverReturnsWrongId?: boolean;
  readonly childRunner?: ChildRunnerSpec;
}

interface Harness {
  readonly trace_entries: TraceEntry[];
  readonly state: RunState;
  readonly ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'sub-run' };
  };
}

function buildHarness(opts: BuildHarnessOpts, parentRunFolder: string): Harness {
  const parentCompiledFlow = buildParentCompiledFlow({
    passVerdicts: opts.passVerdicts,
    ...(opts.divergentReportPath === undefined
      ? {}
      : { divergentReportPath: opts.divergentReportPath }),
  });
  const childCompiledFlow = buildChildCompiledFlow();
  const step = parentCompiledFlow.steps[0];
  if (step === undefined || step.kind !== 'sub-run') {
    throw new Error('test fixture invariant: step[0] must be a sub-run step');
  }

  let resolver: ChildCompiledFlowResolver | undefined;
  if (opts.skipResolver === true) {
    resolver = undefined;
  } else if (opts.resolverThrow !== undefined) {
    resolver = () => {
      throw opts.resolverThrow;
    };
  } else if (opts.resolverReturnsWrongId === true) {
    const altCompiledFlow = CompiledFlow.parse({
      ...JSON.parse(JSON.stringify(childCompiledFlow)),
      id: 'wrong-flow-id',
    });
    resolver = () => ({
      flow: altCompiledFlow,
      bytes: Buffer.from(JSON.stringify(altCompiledFlow)),
    });
  } else {
    resolver = () => ({
      flow: childCompiledFlow,
      bytes: Buffer.from(JSON.stringify(childCompiledFlow)),
    });
  }

  const trace_entries: TraceEntry[] = [];
  const state: RunState = { trace_entries, sequence: 0, relayResults: [] };
  const now = deterministicNow(Date.UTC(2026, 3, 27, 0, 0, 0));
  const recordedAt = (): string => now().toISOString();
  const childRunnerSpec = opts.childRunner ?? { resultBody: JSON.stringify({ verdict: 'accept' }) };
  const childRunner = makeStubChildRunner(childRunnerSpec);
  const ctx: StepHandlerContext & {
    readonly step: CompiledFlow['steps'][number] & { kind: 'sub-run' };
  } = {
    runFolder: parentRunFolder,
    flow: parentCompiledFlow,
    runId: PARENT_RUN_ID,
    goal: 'direct sub-run handler test goal',
    change_kind: change_kind(),
    depth: 'standard',
    executionSelectionConfigLayers: [],
    relayer: {
      connectorName: 'claude-code',
      relay: async () => {
        throw new Error('relayer should not be invoked by these tests');
      },
    },
    composeWriter: () => {
      throw new Error('composeWriter should not be invoked by these tests');
    },
    now,
    recordedAt,
    state,
    push: (ev: TraceEntry) => {
      trace_entries.push({ ...ev, sequence: state.sequence });
      state.sequence += 1;
    },
    step,
    attempt: 1,
    isResumedCheckpoint: false,
    childRunner,
    ...(resolver === undefined ? {} : { childCompiledFlowResolver: resolver }),
  };
  return { trace_entries, state, ctx };
}

let runFolderBase: string;
let parentRunFolder: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'sub-run-handler-direct-'));
  parentRunFolder = join(runFolderBase, 'parent');
  mkdirSync(parentRunFolder, { recursive: true });
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('runSubRunStep direct — early aborts (before child execution)', () => {
  it('aborts when writes.report.path is divergent from writes.result', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        divergentReportPath: 'reports/divergent.json',
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/writes\.report materialization at a path different/);
    expect(harness.trace_entries.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
    const check = harness.trace_entries.find((e) => e.kind === 'check.evaluated');
    if (check?.kind !== 'check.evaluated') throw new Error('expected check.evaluated');
    expect(check.outcome).toBe('fail');
    expect(harness.trace_entries.some((e) => e.kind === 'step.aborted')).toBe(true);
  });

  it('aborts when childCompiledFlowResolver is undefined', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        skipResolver: true,
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    expectStepAborted(
      result,
      'sub-run handler: a sub-run step requires a childCompiledFlowResolver in context; missing resolver aborts before sub_run.started fires',
      { reason: /childCompiledFlowResolver is required/ },
    );
    expect(harness.trace_entries.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
  });

  it('aborts with resolution-failed reason when the resolver throws', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        resolverThrow: new Error('resolver blew up'),
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child flow resolution failed.*resolver blew up/);
    expect(harness.trace_entries.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
  });

  it('aborts when the resolver returns a flow with a different id than flow_ref names', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        resolverReturnsWrongId: true,
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/resolver returned flow id 'wrong-flow-id'/);
    expect(harness.trace_entries.find((e) => e.kind === 'sub_run.started')).toBeUndefined();
  });
});

describe('runSubRunStep direct — child execution failures', () => {
  it('aborts with child-invocation-failed reason when the child runner throws', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { throwError: new Error('child blew up') },
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child flow invocation failed.*child blew up/);
    // sub_run.started fires BEFORE the child runner is called, so it
    // should be present even on child throw.
    expect(harness.trace_entries.some((e) => e.kind === 'sub_run.started')).toBe(true);
    // sub_run.completed should NOT fire — the child invocation
    // failed.
    expect(harness.trace_entries.find((e) => e.kind === 'sub_run.completed')).toBeUndefined();
  });

  it('aborts with checkpoint-resume-not-supported reason when the child returns checkpoint_waiting', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { checkpointStepId: 'frame-checkpoint' },
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(
      /child flow waited at checkpoint 'frame-checkpoint'.*nested checkpoint resume is not yet supported/,
    );
  });
});

describe('runSubRunStep direct — child verdict evaluation', () => {
  it('aborts when child result body does not parse as JSON', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { resultBody: 'not-json{{{' },
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child result body did not parse as JSON/);
    // sub_run.completed fires before verdict evaluation finalizes —
    // verdict slot carries the no-verdict sentinel.
    const completed = harness.trace_entries.find((e) => e.kind === 'sub_run.completed');
    if (completed?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('aborts when child result body parses to an array (not an object)', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: { resultBody: JSON.stringify(['accept']) },
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child result body parsed but is not a JSON object/);
  });

  it('aborts when child result body lacks a verdict field', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: {
          resultBody: JSON.stringify({
            schema_version: 1,
            run_id: '11111111-1111-1111-1111-111111111111',
            flow_id: CHILD_WORKFLOW_ID as unknown as string,
            goal: 'no-verdict goal',
            outcome: 'complete',
            summary: 'no verdict here',
            closed_at: '1970-01-01T00:00:00.000Z',
            trace_entries_observed: 1,
            manifest_hash: 'stub',
          }),
        },
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/lacks a non-empty string 'verdict' field/);
    const completed = harness.trace_entries.find((e) => e.kind === 'sub_run.completed');
    if (completed?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(completed.verdict).toBe('<no-verdict>');
  });

  it('aborts and surfaces the observed verdict when not in check.pass', async () => {
    const harness = buildHarness(
      {
        passVerdicts: ['accept'],
        childRunner: {
          resultBody: JSON.stringify({
            schema_version: 1,
            run_id: '11111111-1111-1111-1111-111111111111',
            flow_id: CHILD_WORKFLOW_ID as unknown as string,
            goal: 'reject goal',
            outcome: 'complete',
            summary: 'rejected',
            closed_at: '1970-01-01T00:00:00.000Z',
            trace_entries_observed: 1,
            manifest_hash: 'stub',
            verdict: 'reject',
          }),
        },
      },
      parentRunFolder,
    );

    const result = await runSubRunStep(harness.ctx);

    if (result.kind !== 'aborted') throw new Error('expected aborted');
    expect(result.reason).toMatch(/child verdict 'reject' is not in check\.pass \[accept\]/);
    const completed = harness.trace_entries.find((e) => e.kind === 'sub_run.completed');
    if (completed?.kind !== 'sub_run.completed') throw new Error('expected sub_run.completed');
    expect(completed.verdict).toBe('reject');
  });
});
