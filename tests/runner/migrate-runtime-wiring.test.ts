import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ClaudeCodeRelayInput } from '../../src/connectors/claude-code.js';
import {
  MigrateBatch,
  MigrateBrief,
  MigrateCoexistence,
  MigrateInventory,
  MigrateResult,
  MigrateReview,
  MigrateVerification,
} from '../../src/flows/migrate/reports.js';
import type {
  ChildCompiledFlowResolver,
  CompiledFlowRunOptions,
  CompiledFlowRunner,
} from '../../src/runtime/run/child-runner.js';
import { runCompiledFlow } from '../../src/runtime/run/compiled-flow-runner.js';
import type { GraphRunResult } from '../../src/runtime/run/graph-runner.js';
import { TraceStore } from '../../src/runtime/trace/trace-store.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunResult } from '../../src/schemas/result.js';
import type { RelayResult } from '../../src/shared/connector-relay.js';
import type { RelayFn } from '../../src/shared/relay-runtime-types.js';
import { runResultPath as resultPath } from '../../src/shared/result-path.js';

// Migrate runtime wiring test. Loads the live Migrate compiled flow
// from src/flows/migrate/schematic.json, runs it end-to-end
// with a stub childRunner (so the batch sub-run does not descend into a
// real Build child) and a stub reviewer relayer, and asserts that
// every typed Migrate report is materialised correctly. Verification
// runs the resolver-selected `npm run check` command in a tiny temporary
// project root, keeping command execution real without making this fixture
// pay for a repo-wide typecheck.
//
// What this test proves at the substrate level:
//   - The schematic → CompiledFlow compile path supports `sub-run` execution
//     kind end-to-end (schematic schema → compiler → runtime handler).
//   - The sub-run check admits the child's terminal verdict
//     (deriveTerminalVerdict populates RunResult.verdict
//     for a Build-like child whose review relay passed).
//   - The migrate close-writer reads brief + inventory + coexistence +
//     batch (RunResult shape) + verification + review and produces a
//     valid migrate.result@v1 with the canonical 6-pointer set.

const FIXTURE_PATH = resolve('generated/flows/migrate/circuit.json');

function loadFixture(): { flow: CompiledFlow; bytes: Buffer } {
  const bytes = readFileSync(FIXTURE_PATH);
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  return { flow: CompiledFlow.parse(raw), bytes };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

const DEFAULT_REVIEW_BODY = JSON.stringify({
  verdict: 'release-approved',
  summary: 'Release review approved; no follow-ups',
  findings: [],
});

const DEFAULT_INVENTORY_BODY = JSON.stringify({
  verdict: 'accept',
  summary: 'Stub inventory for migrate-runtime-wiring test',
  items: [
    {
      id: 'item-1',
      path: 'src/legacy/auth.ts',
      category: 'import-site',
      description: 'Stub legacy auth import site',
    },
  ],
  batches: [
    {
      id: 'batch-1',
      title: 'All migration targets',
      item_ids: ['item-1'],
      rationale: 'Single-batch v0 stub',
    },
  ],
});

function migrateRelayerWith(
  reviewBody: string = DEFAULT_REVIEW_BODY,
  inventoryBody: string = DEFAULT_INVENTORY_BODY,
): RelayFn {
  return {
    connectorName: 'claude-code',
    relay: async (input: ClaudeCodeRelayInput): Promise<RelayResult> => {
      if (input.prompt.includes('Step: inventory-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-migrate-inventory',
          result_body: inventoryBody,
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      if (input.prompt.includes('Step: review-step')) {
        return {
          request_payload: input.prompt,
          receipt_id: 'stub-migrate-review',
          result_body: reviewBody,
          duration_ms: 1,
          cli_version: '0.0.0-stub',
        };
      }
      throw new Error(
        `migrateRelayerWith: unexpected relay step in prompt: ${input.prompt.slice(0, 200)}`,
      );
    },
  };
}

// Stub child flow — a single-step shape that exists only so the
// resolver can hand back a parseable CompiledFlow object. The child runner
// stub never executes the child's loop, so the child's actual step
// catalog is unused by the test.
function buildStubChildCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: 'build',
    version: '0.1.0',
    purpose: 'stub Build child for migrate-runtime-wiring test',
    entry: { signals: { include: ['stub'], exclude: [] }, intent_prefixes: ['stub'] },
    entry_modes: [
      { name: 'default', start_at: 'stub-step', depth: 'standard', description: 'stub' },
    ],
    stages: [{ id: 'act-stage', title: 'Act', canonical: 'act', steps: ['stub-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['frame', 'analyze', 'plan', 'verify', 'review', 'close'],
      rationale: 'stub child — single-step act stage only',
    },
    steps: [
      {
        id: 'stub-step',
        title: 'Stub child compose',
        protocol: 'stub-protocol@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: { report: { path: 'reports/stub.json', schema: 'stub.payload@v1' } },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary'],
        },
      },
    ],
  });
}

function makeChildResolver(): ChildCompiledFlowResolver {
  const flow = buildStubChildCompiledFlow();
  const bytes = Buffer.from(JSON.stringify(flow));
  return () => ({ flowBytes: bytes });
}

// Stub childRunner that bypasses real Build child execution. Writes a
// synthetic child result.json carrying the verdict the migrate batch-
// step check expects, then returns a minimal GraphRunResult so the
// sub-run handler's path-derivation, file-copy, and audit-trace_entry surface
// all execute against deterministic data.
function makeStubChildRunner(verdict: string): CompiledFlowRunner {
  return async (options: CompiledFlowRunOptions): Promise<GraphRunResult> => {
    const childResultAbs = resultPath(options.runDir);
    mkdirSync(dirname(childResultAbs), { recursive: true });
    const body = RunResult.parse({
      schema_version: 1,
      run_id: options.runId ?? 'build-child-run',
      flow_id: 'build',
      goal: options.goal,
      outcome: 'complete',
      summary: 'stub build child result',
      closed_at: new Date(0).toISOString(),
      trace_entries_observed: 1,
      manifest_hash: 'stub-manifest-hash',
      verdict,
    });
    writeFileSync(childResultAbs, `${JSON.stringify(body, null, 2)}\n`);
    return {
      schema_version: body.schema_version,
      run_id: body.run_id,
      flow_id: body.flow_id,
      goal: body.goal,
      outcome: body.outcome,
      summary: body.summary,
      closed_at: body.closed_at,
      trace_entries_observed: body.trace_entries_observed,
      manifest_hash: body.manifest_hash,
      ...(body.reason === undefined ? {} : { reason: body.reason }),
      ...(body.verdict === undefined ? {} : { verdict: body.verdict }),
      resultPath: childResultAbs,
    };
  };
}

function traceEntryLabel(trace_entry: { kind: string; step_id?: unknown }): string {
  return typeof trace_entry.step_id === 'string'
    ? `${trace_entry.kind}:${trace_entry.step_id}`
    : trace_entry.kind;
}

async function readTraceEntries(runFolder: string) {
  return await new TraceStore(runFolder).load();
}

function makeVerificationProjectRoot(): string {
  const projectRoot = join(runFolderBase, 'verification-project');
  mkdirSync(projectRoot, { recursive: true });
  writeFileSync(
    join(projectRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        scripts: {
          check: 'node -e "process.exit(0)"',
        },
      },
      null,
      2,
    )}\n`,
  );
  return projectRoot;
}

let runFolderBase: string;

beforeEach(() => {
  runFolderBase = mkdtempSync(join(tmpdir(), 'circuit-next-migrate-runtime-'));
});

afterEach(() => {
  rmSync(runFolderBase, { recursive: true, force: true });
});

describe('Migrate runtime wiring', () => {
  it('declares the seven-canonical-stage stage path with the parity entry modes', () => {
    const { flow } = loadFixture();
    expect(flow.entry_modes.map((mode) => mode.name)).toEqual(['default', 'deep', 'autonomous']);
    expect(flow.stages.map((stage) => stage.canonical)).toEqual([
      'frame',
      'analyze',
      'plan',
      'act',
      'verify',
      'review',
      'close',
    ]);
    const stepsById = new Map(flow.steps.map((step) => [step.id as unknown as string, step]));
    const visited: string[] = [];
    let current: string | undefined = flow.entry_modes[0]?.start_at as unknown as string;
    while (current !== undefined && !current.startsWith('@')) {
      visited.push(current);
      current = stepsById.get(current)?.routes.pass;
    }
    expect(visited).toEqual([
      'frame-step',
      'inventory-step',
      'coexistence-step',
      'coexistence-checkpoint-step',
      'batch-step',
      'verify-step',
      'review-step',
      'close-step',
    ]);
    const batchStep = stepsById.get('batch-step');
    expect(batchStep?.kind).toBe('sub-run');
  });

  it('runs the live Migrate fixture end-to-end with a stub Build child and writes all six typed reports plus the close result', async () => {
    const { bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'complete');

    const outcome = await runCompiledFlow({
      runDir: runFolder,
      flowBytes: bytes,
      runId: 'a1000000-0000-0000-0000-000000000001',
      goal: 'Migrate the legacy auth middleware to the new identity stack',
      depth: 'standard',
      now: deterministicNow(Date.UTC(2026, 3, 27, 9, 0, 0)),
      relayer: migrateRelayerWith(),
      childCompiledFlowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('accept'),
      projectRoot: makeVerificationProjectRoot(),
    });

    expect(outcome.outcome).toBe('complete');
    const labels = (await readTraceEntries(runFolder)).map(traceEntryLabel);
    expect(labels).toContain('relay.completed:inventory-step');
    expect(labels).toContain('checkpoint.resolved:coexistence-checkpoint-step');
    expect(labels).toContain('sub_run.started:batch-step');
    expect(labels).toContain('sub_run.completed:batch-step');
    expect(labels).toContain('relay.completed:review-step');

    const brief = MigrateBrief.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/brief.json'), 'utf8')),
    );
    expect(brief.objective).toBe('Migrate the legacy auth middleware to the new identity stack');
    expect(brief.coexistence_appetite).toBe('short-window');

    const inventory = MigrateInventory.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/inventory.json'), 'utf8')),
    );
    expect(inventory.batches).toHaveLength(1);
    expect(inventory.batches[0]?.id).toBe('batch-1');

    MigrateCoexistence.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/coexistence.json'), 'utf8')),
    );

    const batch = MigrateBatch.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/batch-result.json'), 'utf8')),
    );
    expect(batch.outcome).toBe('complete');
    expect(batch.verdict).toBe('accept');

    const verification = MigrateVerification.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/verification.json'), 'utf8')),
    );
    expect(verification.overall_status).toBe('passed');
    expect(verification.commands[0]?.argv).toEqual(['npm', 'run', 'check']);

    const review = MigrateReview.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/review.json'), 'utf8')),
    );
    expect(review.verdict).toBe('release-approved');

    const result = MigrateResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('complete');
    expect(result.verification_status).toBe('passed');
    expect(result.review_verdict).toBe('release-approved');
    expect(result.batch_count).toBe(1);
    expect(result.evidence_links.map((p) => p.report_id)).toEqual([
      'migrate.brief',
      'migrate.inventory',
      'migrate.coexistence',
      'migrate.batch',
      'migrate.verification',
      'migrate.review',
    ]);
  }, 180_000);

  it('marks outcome=release-deferred when the release review returns release-with-followups', async () => {
    const { bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'release-deferred');

    const reviewBody = JSON.stringify({
      verdict: 'release-with-followups',
      summary: 'Release passes verification but two follow-ups should land before sunset.',
      findings: [
        {
          severity: 'low',
          text: 'Open follow-up: rename the deprecated config key once the old reader is gone.',
          file_refs: [],
        },
      ],
    });

    const outcome = await runCompiledFlow({
      runDir: runFolder,
      flowBytes: bytes,
      runId: 'a1000000-0000-0000-0000-000000000002',
      goal: 'Migrate the search connector from the legacy provider to the new SDK',
      depth: 'standard',
      now: deterministicNow(Date.UTC(2026, 3, 27, 10, 0, 0)),
      relayer: migrateRelayerWith(reviewBody),
      childCompiledFlowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('accept-with-fixes'),
      projectRoot: makeVerificationProjectRoot(),
    });

    expect(outcome.outcome).toBe('complete');
    const result = MigrateResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('release-deferred');
    expect(result.review_verdict).toBe('release-with-followups');
  }, 180_000);

  it('marks outcome=failed and still writes the schema-tied review report when the release review returns release-blocked', async () => {
    const { bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'release-blocked');

    const reviewBody = JSON.stringify({
      verdict: 'release-blocked',
      summary: 'Release cannot ship: brief required const, batch shipped let.',
      findings: [
        {
          severity: 'critical',
          text: 'Brief objective is convert var to const but batch wrote let',
          file_refs: ['legacy.js:1'],
        },
      ],
    });

    const outcome = await runCompiledFlow({
      runDir: runFolder,
      flowBytes: bytes,
      runId: 'a1000000-0000-0000-0000-000000000004',
      goal: 'Migrate the auth flow with a release-blocked review verdict',
      depth: 'standard',
      now: deterministicNow(Date.UTC(2026, 3, 27, 12, 0, 0)),
      relayer: migrateRelayerWith(reviewBody),
      childCompiledFlowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('accept'),
      projectRoot: makeVerificationProjectRoot(),
    });

    // Run-level outcome is complete because close-step ran end-to-end
    // even on release-blocked. The flow-level outcome (migrate-result.outcome)
    // is 'failed' to reflect the product status.
    expect(outcome.outcome).toBe('complete');

    const review = MigrateReview.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate/review.json'), 'utf8')),
    );
    expect(review.verdict).toBe('release-blocked');
    expect(review.findings).toHaveLength(1);

    const result = MigrateResult.parse(
      JSON.parse(readFileSync(join(runFolder, 'reports/migrate-result.json'), 'utf8')),
    );
    expect(result.outcome).toBe('failed');
    expect(result.review_verdict).toBe('release-blocked');
    expect(result.verification_status).toBe('passed');

    const labels = (await readTraceEntries(runFolder)).map(traceEntryLabel);
    expect(labels).toContain('relay.completed:review-step');
    expect(labels).toContain('step.completed:close-step');
  }, 180_000);

  it('aborts with outcome=aborted when the child Build sub-run returns a verdict outside check.pass', async () => {
    const { bytes } = loadFixture();
    const runFolder = join(runFolderBase, 'check-rejected');

    const outcome = await runCompiledFlow({
      runDir: runFolder,
      flowBytes: bytes,
      runId: 'a1000000-0000-0000-0000-000000000003',
      goal: 'Migrate the storage layer to the new persistence engine',
      depth: 'standard',
      now: deterministicNow(Date.UTC(2026, 3, 27, 11, 0, 0)),
      relayer: migrateRelayerWith(),
      childCompiledFlowResolver: makeChildResolver(),
      childRunner: makeStubChildRunner('reject'),
      projectRoot: makeVerificationProjectRoot(),
    });

    expect(outcome.outcome).toBe('aborted');
    expect(outcome.reason).toContain('reject');
    const labels = (await readTraceEntries(runFolder)).map(traceEntryLabel);
    expect(labels).toContain('sub_run.completed:batch-step');
    expect(labels).toContain('step.aborted:batch-step');
  });
});
