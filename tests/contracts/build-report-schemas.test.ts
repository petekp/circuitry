import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BuildBrief,
  BuildImplementation,
  BuildPlan,
  BuildResult,
  BuildResultReportPointer,
  BuildReview,
  BuildVerification,
  BuildVerificationCommand,
} from '../../src/flows/build/reports.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

const BUILD_FLOW_PATH = join('generated', 'flows', 'build', 'circuit.json');

const BUILD_ARTIFACT_IDS = [
  'build.brief',
  'build.plan',
  'build.implementation',
  'build.verification',
  'build.review',
  'build.result',
] as const;

const EXPECTED_REPORT_WRITES = {
  'build.brief': { path: 'reports/build/brief.json', schema: 'build.brief@v1' },
  'build.plan': { path: 'reports/build/plan.json', schema: 'build.plan@v1' },
  'build.implementation': {
    path: 'reports/build/implementation.json',
    schema: 'build.implementation@v1',
  },
  'build.verification': {
    path: 'reports/build/verification.json',
    schema: 'build.verification@v1',
  },
  'build.review': { path: 'reports/build/review.json', schema: 'build.review@v1' },
  'build.result': { path: 'reports/build-result.json', schema: 'build.result@v1' },
} as const;

function verificationCommand(overrides: Record<string, unknown> = {}) {
  return {
    id: 'verify',
    cwd: '.',
    argv: ['npm', 'run', 'verify'],
    timeout_ms: 120_000,
    max_output_bytes: 200_000,
    env: {},
    ...overrides,
  };
}

function resultPointers() {
  return [
    BuildResultReportPointer.parse({
      report_id: 'build.brief',
      path: 'reports/build/brief.json',
      schema: 'build.brief@v1',
    }),
    BuildResultReportPointer.parse({
      report_id: 'build.plan',
      path: 'reports/build/plan.json',
      schema: 'build.plan@v1',
    }),
    BuildResultReportPointer.parse({
      report_id: 'build.implementation',
      path: 'reports/build/implementation.json',
      schema: 'build.implementation@v1',
    }),
    BuildResultReportPointer.parse({
      report_id: 'build.verification',
      path: 'reports/build/verification.json',
      schema: 'build.verification@v1',
    }),
    BuildResultReportPointer.parse({
      report_id: 'build.review',
      path: 'reports/build/review.json',
      schema: 'build.review@v1',
    }),
  ];
}

function loadBuildFlow(): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(readFileSync(BUILD_FLOW_PATH, 'utf-8')));
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

describe('Build report schemas', () => {
  it('accepts build.brief at the Frame checkpoint with response_path set from first write', () => {
    // Production code always writes the brief with response_path set —
    // this eliminates the resume-crash window where a stamped brief on
    // disk diverges from the request hash. The schema still accepts a
    // brief without response_path for tooling/fixtures that synthesize
    // briefs offline.
    const stamped = BuildBrief.parse({
      objective: 'Add a small feature',
      scope: 'Touch the CLI and tests only',
      success_criteria: ['The requested behavior works', 'Verification passes'],
      verification_command_candidates: [verificationCommand()],
      checkpoint: {
        request_path: 'reports/checkpoints/frame-request.json',
        response_path: 'reports/checkpoints/frame-response.json',
        allowed_choices: ['proceed', 'revise', 'abort'],
      },
    });
    const unstamped = BuildBrief.parse({
      objective: 'Add a small feature',
      scope: 'Touch the CLI and tests only',
      success_criteria: ['The requested behavior works', 'Verification passes'],
      verification_command_candidates: [verificationCommand()],
      checkpoint: {
        request_path: 'reports/checkpoints/frame-request.json',
        allowed_choices: ['proceed', 'revise', 'abort'],
      },
    });

    expect(stamped.checkpoint.response_path).toBe('reports/checkpoints/frame-response.json');
    expect(unstamped.checkpoint.response_path).toBeUndefined();
  });

  it('accepts minimal valid objects for all six Build reports', () => {
    expect(
      BuildPlan.parse({
        objective: 'Add a small feature',
        approach: 'Make the smallest code change and verify it',
        slices: ['Implement the behavior'],
        verification: { commands: [verificationCommand()] },
      }),
    ).toBeDefined();
    expect(
      BuildImplementation.parse({
        verdict: 'accept',
        summary: 'Implemented the behavior',
        changed_files: ['src/example.ts'],
        evidence: ['Unit tests cover the change'],
      }),
    ).toBeDefined();
    expect(
      BuildVerification.parse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'verify',
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
      BuildReview.parse({
        verdict: 'accept',
        summary: 'No blocking issue found',
        findings: [],
      }),
    ).toBeDefined();
    expect(
      BuildReview.parse({
        verdict: 'accept-with-fixes',
        summary: 'Minor follow-up needed',
        findings: [
          {
            severity: 'low',
            text: 'Document the small follow-up',
            file_refs: [],
          },
        ],
      }),
    ).toBeDefined();
    expect(
      BuildResult.parse({
        summary: 'Feature added and verified',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        evidence_links: resultPointers(),
      }),
    ).toBeDefined();
    expect(
      BuildResult.parse({
        summary: 'Feature added and verified with follow-ups',
        outcome: 'needs_attention',
        verification_status: 'passed',
        review_verdict: 'accept-with-fixes',
        evidence_links: resultPointers(),
      }),
    ).toBeDefined();
    expect(
      BuildResult.safeParse({
        summary: 'Should not look complete with follow-ups',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept-with-fixes',
        evidence_links: resultPointers(),
      }).success,
    ).toBe(false);
  });

  it('rejects missing required fields and surplus keys across report schemas', () => {
    expect(
      BuildBrief.safeParse({
        objective: 'Add a small feature',
        scope: 'Touch the CLI and tests only',
        success_criteria: ['Verification passes'],
        checkpoint: {
          request_path: 'reports/checkpoints/frame-request.json',
          allowed_choices: ['proceed'],
        },
      }).success,
    ).toBe(false);

    expect(
      BuildImplementation.safeParse({
        verdict: 'accept',
        summary: 'Implemented the behavior',
        changed_files: [],
        evidence: ['Unit tests cover the change'],
        smuggled: true,
      }).success,
    ).toBe(false);

    expect(
      BuildImplementation.safeParse({
        verdict: 'reject',
        summary: 'Implemented the behavior',
        changed_files: ['src/example.ts'],
        evidence: ['Unit tests cover the change'],
      }).success,
    ).toBe(false);
  });

  it('rejects unsafe or incomplete verification command payloads', () => {
    expect(
      BuildVerificationCommand.safeParse({
        id: 'shell-string',
        cwd: '.',
        command: 'npm run verify',
        timeout_ms: 120_000,
        max_output_bytes: 200_000,
        env: {},
      }).success,
    ).toBe(false);
    expect(BuildVerificationCommand.safeParse(verificationCommand({ argv: [] })).success).toBe(
      false,
    );
    expect(
      BuildVerificationCommand.safeParse({
        id: 'missing-timeout',
        cwd: '.',
        argv: ['npm', 'run', 'verify'],
        max_output_bytes: 200_000,
        env: {},
      }).success,
    ).toBe(false);
    expect(
      BuildVerificationCommand.safeParse({
        id: 'missing-output-bound',
        cwd: '.',
        argv: ['npm', 'run', 'verify'],
        timeout_ms: 120_000,
        env: {},
      }).success,
    ).toBe(false);
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ cwd: '../outside' })).success,
    ).toBe(false);
    expect(BuildVerificationCommand.safeParse(verificationCommand({ cwd: '/tmp' })).success).toBe(
      false,
    );
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ cwd: 'C:\\tmp' })).success,
    ).toBe(false);
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ argv: ['sh', '-c', 'true'] })),
    ).toMatchObject({ success: false });
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ argv: ['bash', 'scripts/check'] })),
    ).toMatchObject({ success: false });
    expect(
      BuildVerificationCommand.safeParse(verificationCommand({ argv: ['cmd.exe', '/c', 'dir'] })),
    ).toMatchObject({ success: false });
  });

  it('keeps build.verification overall_status tied to command results', () => {
    expect(
      BuildVerification.safeParse({
        overall_status: 'passed',
        commands: [
          {
            command_id: 'verify',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 1,
            status: 'failed',
            duration_ms: 25,
            stdout_summary: '',
            stderr_summary: 'failed',
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      BuildVerification.safeParse({
        overall_status: 'failed',
        commands: [
          {
            command_id: 'verify',
            argv: ['npm', 'run', 'verify'],
            cwd: '.',
            exit_code: 0,
            status: 'failed',
            duration_ms: 25,
            stdout_summary: 'passed',
            stderr_summary: '',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepts critical Build review findings without downgrading severity', () => {
    expect(
      BuildReview.parse({
        verdict: 'reject',
        summary: 'A critical issue blocks the change',
        findings: [
          {
            severity: 'critical',
            text: 'The change can corrupt existing run evidence',
            file_refs: ['src/runtime/runner.ts'],
          },
        ],
      }).findings[0]?.severity,
    ).toBe('critical');
  });

  it('requires actionable findings for non-accept Build review verdicts', () => {
    expect(
      BuildReview.safeParse({
        verdict: 'accept-with-fixes',
        summary: 'Follow-up needed',
        findings: [],
      }).success,
    ).toBe(false);
    expect(
      BuildReview.safeParse({
        verdict: 'reject',
        summary: 'Blocking issue found',
        findings: [],
      }).success,
    ).toBe(false);
  });

  it('rejects build.result pointer omissions, duplicates, and schema mismatches', () => {
    expect(
      BuildResultReportPointer.safeParse({
        report_id: 'build.plan',
        path: 'reports/build/plan.json',
        schema: 'build.review@v1',
      }).success,
    ).toBe(false);

    expect(
      BuildResult.safeParse({
        summary: 'Missing pointer',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        evidence_links: resultPointers().slice(1),
      }).success,
    ).toBe(false);

    expect(
      BuildResult.safeParse({
        summary: 'Duplicate pointer',
        outcome: 'complete',
        verification_status: 'passed',
        review_verdict: 'accept',
        evidence_links: [resultPointers()[0], resultPointers()[0], ...resultPointers().slice(2)],
      }).success,
    ).toBe(false);
  });
});

describe('Build generated flow report bindings', () => {
  const writes = reportWritesBySchema(loadBuildFlow());

  it('binds all six Build reports to generated flow paths and schemas', () => {
    for (const id of BUILD_ARTIFACT_IDS) {
      const expected = EXPECTED_REPORT_WRITES[id];
      expect(writes.get(expected.schema), `${id} generated report write`).toBe(expected.path);
    }
  });

  it('keeps build.result path-distinct from the universal run result', () => {
    expect(writes.get('build.result@v1')).toBe('reports/build-result.json');
    expect(writes.get('build.result@v1')).not.toBe('reports/result.json');
  });

  it('keeps Build role reports under reports/build and path-distinct from Explore and Review', () => {
    for (const id of BUILD_ARTIFACT_IDS.filter((reportId) => reportId !== 'build.result')) {
      const expected = EXPECTED_REPORT_WRITES[id];
      expect(writes.get(expected.schema)).toMatch(/^reports\/build\/.+\.json$/);
    }

    const nonBuildCompiledFlowPaths = [
      'reports/brief.json',
      'reports/analysis.json',
      'reports/compose.json',
      'reports/review-verdict.json',
      'reports/explore-result.json',
      'reports/review-result.json',
    ];
    for (const path of nonBuildCompiledFlowPaths) {
      expect([...writes.values()]).not.toContain(path);
    }
  });
});
