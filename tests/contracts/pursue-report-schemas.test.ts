import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PursuitBatch,
  PursuitContract,
  PursuitGraph,
  PursuitResult,
  PursuitResultReportPointer,
  PursuitReview,
  PursuitVerification,
  PursuitWavePlan,
} from '../../src/flows/pursue/reports.js';
import { findCloseBuilder } from '../../src/flows/registries/close-writers/registry.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

const PURSUE_FLOW_PATH = join('generated', 'flows', 'pursue', 'circuit.json');

const EXPECTED_REPORT_WRITES = {
  'pursuit.contract': { path: 'reports/pursuit/contract.json', schema: 'pursuit.contract@v1' },
  'pursuit.graph': { path: 'reports/pursuit/graph.json', schema: 'pursuit.graph@v1' },
  'pursuit.wave-plan': {
    path: 'reports/pursuit/wave-plan.json',
    schema: 'pursuit.wave-plan@v1',
  },
  'pursuit.batch': { path: 'reports/pursuit/batch.json', schema: 'pursuit.batch@v1' },
  'pursuit.verification': {
    path: 'reports/pursuit/verification.json',
    schema: 'pursuit.verification@v1',
  },
  'pursuit.review': { path: 'reports/pursuit/review.json', schema: 'pursuit.review@v1' },
  'pursuit.result': { path: 'reports/pursuit-result.json', schema: 'pursuit.result@v1' },
} as const;

function touchSet(overrides: Record<string, unknown> = {}) {
  return {
    paths: ['src/example.ts'],
    symbols: [],
    commands: ['npm run verify'],
    generated_outputs: [],
    ...overrides,
  };
}

function verificationCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pursuit-proof',
    cwd: '.',
    argv: ['npm', 'run', 'verify'],
    timeout_ms: 120_000,
    max_output_bytes: 200_000,
    env: {},
    ...overrides,
  };
}

function batchItem(status: 'completed' | 'skipped' | 'blocked' | 'failed') {
  return {
    pursuit_id: 'pursuit-1',
    status,
    summary: `${status} pursuit`,
    evidence: ['reports/pursuit/batch.json'],
  };
}

function resultPointers() {
  return [
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.contract',
      path: 'reports/pursuit/contract.json',
      schema: 'pursuit.contract@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.graph',
      path: 'reports/pursuit/graph.json',
      schema: 'pursuit.graph@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.wave-plan',
      path: 'reports/pursuit/wave-plan.json',
      schema: 'pursuit.wave-plan@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.batch',
      path: 'reports/pursuit/batch.json',
      schema: 'pursuit.batch@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.verification',
      path: 'reports/pursuit/verification.json',
      schema: 'pursuit.verification@v1',
    }),
    PursuitResultReportPointer.parse({
      report_id: 'pursuit.review',
      path: 'reports/pursuit/review.json',
      schema: 'pursuit.review@v1',
    }),
  ];
}

function loadFlow(path: string): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(readFileSync(path, 'utf-8')));
}

function reportWritesBySchema(flow: CompiledFlow): Map<string, string> {
  const writes = new Map<string, string>();
  for (const step of flow.steps) {
    const writesSlot = 'writes' in step ? step.writes : undefined;
    if (writesSlot !== undefined && 'report' in writesSlot && writesSlot.report !== undefined) {
      const report = writesSlot.report;
      writes.set(report.schema, report.path);
    }
  }
  return writes;
}

describe('Pursue report schemas', () => {
  it('accepts minimal valid Pursue reports', () => {
    expect(
      PursuitContract.parse({
        objective: 'Ship two coordinated changes without collisions',
        pursuits: [
          {
            id: 'pursuit-1',
            title: 'Update runtime contract',
            goal: 'Update src/example.ts',
            scope: 'Only the named file',
            assumptions: ['No external service changes are required'],
            estimated_touch_set: touchSet(),
            proof_plan: ['Run npm run verify'],
            check_in_triggers: ['A shared file needs a conflicting edit'],
            rollback_notes: ['Revert the local file edit'],
            risk: 'medium',
          },
        ],
        execution_policy: {
          code_writes: 'serial-only',
          read_only_parallelism: 'allowed',
          parallel_write_status: 'blocked-until-safe-apply',
        },
        verification_command_candidates: [verificationCommand()],
      }),
    ).toBeDefined();
    expect(
      PursuitGraph.parse({
        verdict: 'accept',
        nodes: [
          {
            id: 'pursuit-1',
            goal: 'Update src/example.ts',
            estimated_touch_set: touchSet(),
            risk: 'medium',
            status: 'ready',
            reason: 'Ready after framing',
          },
        ],
        edges: [],
        serial_groups: [
          {
            id: 'serial-code-writes',
            pursuit_ids: ['pursuit-1'],
            reason: 'Code writes are serial in Pursuits V1',
          },
        ],
        parallel_read_only_groups: [
          {
            id: 'parallel-discovery',
            pursuit_ids: ['pursuit-1'],
            reason: 'Read-only discovery can happen before writes',
          },
        ],
        blocked: [],
      }),
    ).toBeDefined();
    expect(
      PursuitWavePlan.parse({
        verdict: 'accept',
        waves: [
          {
            id: 'discovery',
            kind: 'read-only',
            pursuit_ids: ['pursuit-1'],
            execution: 'parallel',
            reason: 'Gather context first',
            re_ground_after: true,
          },
          {
            id: 'serial-code-writes',
            kind: 'code-change',
            pursuit_ids: ['pursuit-1'],
            execution: 'serial',
            reason: 'Avoid write collisions',
            re_ground_after: true,
          },
        ],
        no_parallel_writes_reason: 'V1 does not apply parallel worktree edits.',
      }),
    ).toBeDefined();
    expect(
      PursuitBatch.parse({
        verdict: 'accept',
        summary: 'Completed the coordinated batch',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['npm run verify passed'],
      }),
    ).toBeDefined();
    expect(
      PursuitVerification.parse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'pursuit-proof',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 0,
            status: 'passed',
            duration_ms: 25,
            stdout_summary: 'All checks passed',
            stderr_summary: '',
          },
        ],
      }),
    ).toBeDefined();
    expect(
      PursuitReview.parse({
        verdict: 'clean',
        summary: 'No coordination issues found',
        findings: [],
      }),
    ).toBeDefined();
    expect(
      PursuitResult.parse({
        summary: 'All pursuits completed',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'clean',
        total_pursuits: 1,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }),
    ).toBeDefined();
  });

  it('blocks parallel code-change waves', () => {
    expect(
      PursuitWavePlan.safeParse({
        verdict: 'accept',
        waves: [
          {
            id: 'unsafe-code-wave',
            kind: 'code-change',
            pursuit_ids: ['pursuit-1', 'pursuit-2'],
            execution: 'parallel',
            reason: 'This would collide',
            re_ground_after: true,
          },
        ],
        no_parallel_writes_reason: 'Code writes must be serial.',
      }).success,
    ).toBe(false);
  });

  it('rejects coordination graphs that reference unknown pursuits', () => {
    expect(
      PursuitGraph.safeParse({
        verdict: 'accept',
        nodes: [
          {
            id: 'pursuit-1',
            goal: 'Update src/example.ts',
            estimated_touch_set: touchSet(),
            risk: 'medium',
            status: 'ready',
            reason: 'Ready after framing',
          },
        ],
        edges: [{ from: 'pursuit-1', to: 'missing-pursuit', kind: 'conflict', reason: 'bad ref' }],
        serial_groups: [
          {
            id: 'serial-code-writes',
            pursuit_ids: ['missing-pursuit'],
            reason: 'bad ref',
          },
        ],
        parallel_read_only_groups: [
          {
            id: 'parallel-discovery',
            pursuit_ids: ['pursuit-1'],
            reason: 'Read-only discovery can happen before writes',
          },
        ],
        blocked: [{ pursuit_id: 'missing-pursuit', reason: 'bad ref' }],
      }).success,
    ).toBe(false);
  });

  it('keeps batch verdicts and item buckets honest', () => {
    expect(
      PursuitBatch.safeParse({
        verdict: 'accept',
        summary: 'Should not accept failed work',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [batchItem('failed')],
        actual_touch_set: touchSet(),
        proof_evidence: ['failed proof'],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'partial',
        summary: 'Wrong bucket status',
        serialized_execution: true,
        completed: [batchItem('blocked')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['bucket mismatch'],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'accept',
        summary: 'Should not accept skipped work',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [batchItem('skipped')],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['partial proof'],
      }).success,
    ).toBe(false);
    expect(
      PursuitBatch.safeParse({
        verdict: 'blocked',
        summary: 'Blocked verdict needs blocked or failed items',
        serialized_execution: true,
        completed: [batchItem('completed')],
        skipped: [],
        blocked: [],
        failed: [],
        actual_touch_set: touchSet(),
        proof_evidence: ['blocked without blocked item'],
      }).success,
    ).toBe(false);
  });

  it('keeps review verdicts aligned with finding severity', () => {
    expect(
      PursuitReview.safeParse({
        verdict: 'needs-followup',
        summary: 'A follow-up is required',
        findings: [],
      }).success,
    ).toBe(false);
    expect(
      PursuitReview.safeParse({
        verdict: 'clean',
        summary: 'Findings cannot be hidden behind clean',
        findings: [{ severity: 'low', text: 'Low finding', file_refs: ['src/example.ts:1'] }],
      }).success,
    ).toBe(false);
    expect(
      PursuitReview.safeParse({
        verdict: 'needs-followup',
        summary: 'Medium findings must retry before close',
        findings: [{ severity: 'medium', text: 'Medium finding', file_refs: ['src/example.ts:1'] }],
      }).success,
    ).toBe(false);
    expect(
      PursuitReview.safeParse({
        verdict: 'needs-followup',
        summary: 'Low findings can close as follow-up work',
        findings: [{ severity: 'low', text: 'Low finding', file_refs: ['src/example.ts:1'] }],
      }).success,
    ).toBe(true);
  });

  it('keeps complete results tied to clean review, passed verification, and exact counts', () => {
    expect(
      PursuitResult.safeParse({
        summary: 'Verification failed',
        outcome: 'complete',
        verification_status: 'failed',
        review_verdict: 'clean',
        total_pursuits: 1,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      PursuitResult.safeParse({
        summary: 'Counts do not add up',
        outcome: 'needs_attention',
        verification_status: 'passed',
        review_verdict: 'needs-followup',
        total_pursuits: 3,
        completed_count: 1,
        skipped_count: 0,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      PursuitResult.safeParse({
        summary: 'Skipped work cannot be complete',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'clean',
        total_pursuits: 2,
        completed_count: 1,
        skipped_count: 1,
        blocked_count: 0,
        failed_count: 0,
        serial_code_writes: true,
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
    expect(
      PursuitResultReportPointer.safeParse({
        report_id: 'pursuit.graph',
        path: 'reports/pursuit/wrong.json',
        schema: 'pursuit.graph@v1',
      }).success,
    ).toBe(false);
  });

  it('rejects close reports when the batch does not cover every contracted pursuit once', () => {
    const flow = loadFlow(PURSUE_FLOW_PATH);
    const closeStep = flow.steps.find((step) => step.id === 'close-step');
    if (closeStep?.kind !== 'compose' || closeStep.writes?.report === undefined) {
      throw new Error('Pursue close step must be a compose step with a report write');
    }
    const closeBuilder = findCloseBuilder('pursuit.result@v1');
    if (closeBuilder === undefined) throw new Error('Pursue close builder must be registered');

    const contract = PursuitContract.parse({
      objective: 'Ship two coordinated changes without collisions',
      pursuits: [
        {
          id: 'pursuit-1',
          title: 'Update runtime contract',
          goal: 'Update src/example.ts',
          scope: 'Only the named file',
          assumptions: ['No external service changes are required'],
          estimated_touch_set: touchSet(),
          proof_plan: ['Run npm run verify'],
          check_in_triggers: ['A shared file needs a conflicting edit'],
          rollback_notes: ['Revert the local file edit'],
          risk: 'medium',
        },
        {
          id: 'pursuit-2',
          title: 'Update docs',
          goal: 'Update docs/example.md',
          scope: 'Only the named docs file',
          assumptions: ['No external service changes are required'],
          estimated_touch_set: touchSet({ paths: ['docs/example.md'] }),
          proof_plan: ['Run npm run verify'],
          check_in_triggers: ['A shared file needs a conflicting edit'],
          rollback_notes: ['Revert the local file edit'],
          risk: 'low',
        },
      ],
      execution_policy: {
        code_writes: 'serial-only',
        read_only_parallelism: 'allowed',
        parallel_write_status: 'blocked-until-safe-apply',
      },
      verification_command_candidates: [verificationCommand()],
    });
    const graph = PursuitGraph.parse({
      verdict: 'accept',
      nodes: contract.pursuits.map((pursuit) => ({
        id: pursuit.id,
        goal: pursuit.goal,
        estimated_touch_set: pursuit.estimated_touch_set,
        risk: pursuit.risk,
        status: 'ready',
        reason: 'Ready after framing',
      })),
      edges: [],
      serial_groups: [
        {
          id: 'serial-code-writes',
          pursuit_ids: ['pursuit-1', 'pursuit-2'],
          reason: 'Code writes are serial in Pursuits V1',
        },
      ],
      parallel_read_only_groups: [
        {
          id: 'parallel-discovery',
          pursuit_ids: ['pursuit-1', 'pursuit-2'],
          reason: 'Read-only discovery can happen before writes',
        },
      ],
      blocked: [],
    });
    const wavePlan = PursuitWavePlan.parse({
      verdict: 'accept',
      waves: [
        {
          id: 'serial-code-writes',
          kind: 'code-change',
          pursuit_ids: ['pursuit-1', 'pursuit-2'],
          execution: 'serial',
          reason: 'Avoid write collisions',
          re_ground_after: true,
        },
      ],
      no_parallel_writes_reason: 'V1 does not apply parallel worktree edits.',
    });
    const incompleteBatch = PursuitBatch.parse({
      verdict: 'accept',
      summary: 'Completed only one pursuit',
      serialized_execution: true,
      completed: [batchItem('completed')],
      skipped: [],
      blocked: [],
      failed: [],
      actual_touch_set: touchSet(),
      proof_evidence: ['npm run verify passed'],
    });

    expect(() =>
      closeBuilder.build({
        runFolder: '.',
        flow,
        closeStep,
        goal: 'two pursuits',
        inputs: {
          contract,
          graph,
          wavePlan,
          batch: incompleteBatch,
          verification: PursuitVerification.parse({
            overall_status: 'passed',
            commands: [
              {
                command_id: 'pursuit-proof',
                argv: ['npm', 'run', 'verify'],
                cwd: '.',
                exit_code: 0,
                status: 'passed',
                duration_ms: 25,
                stdout_summary: 'All checks passed',
                stderr_summary: '',
              },
            ],
          }),
          review: PursuitReview.parse({
            verdict: 'clean',
            summary: 'No coordination issues found',
            findings: [],
          }),
        },
      }),
    ).toThrow(/missing pursuit id 'pursuit-2'/);
  });
});

describe('Pursue generated flow report bindings', () => {
  const writes = reportWritesBySchema(loadFlow(PURSUE_FLOW_PATH));

  it('binds Pursue reports to generated flow paths and schemas', () => {
    for (const expected of Object.values(EXPECTED_REPORT_WRITES)) {
      expect(writes.get(expected.schema), `${expected.schema} generated report write`).toBe(
        expected.path,
      );
    }
  });

  it('gives the close writer every required upstream Pursue report', () => {
    const flow = loadFlow(PURSUE_FLOW_PATH);
    const closeStep = flow.steps.find((step) => step.id === 'close-step');
    expect(closeStep?.reads).toEqual(
      expect.arrayContaining([
        'reports/pursuit/contract.json',
        'reports/pursuit/graph.json',
        'reports/pursuit/wave-plan.json',
        'reports/pursuit/batch.json',
        'reports/pursuit/verification.json',
        'reports/pursuit/review.json',
      ]),
    );
  });
});
