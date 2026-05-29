import { describe, expect, it } from 'vitest';

import {
  reportPathForSchemaInRuntimeFlow,
  requireRuntimeIndexedStep,
} from '../../src/flows/registries/runtime-index.js';
import type { ExecutableFlow } from '../../src/runtime/manifest/executable-flow.js';
import { buildRuntimePackageIndex } from '../../src/runtime/manifest/runtime-package-index.js';

function flowWithReports(reports: readonly { readonly stepId: string; readonly schema: string }[]) {
  return {
    id: 'index-test',
    version: '0.0.0',
    entry: reports[0]?.stepId ?? 'first',
    stages: [{ id: 'stage', stepIds: reports.map((report) => report.stepId) }],
    steps: reports.map((report) => ({
      id: report.stepId,
      title: report.stepId,
      protocol: `${report.stepId}@v1`,
      kind: 'compose' as const,
      writer: `${report.stepId}@v1`,
      check: {
        kind: 'schema_sections' as const,
        source: { kind: 'report' as const, ref: 'report' as const },
        required: ['summary'],
      },
      routes: { pass: { kind: 'terminal' as const, target: '@complete' as const } },
      writes: {
        report: { path: `reports/${report.stepId}.json`, schema: report.schema },
      },
    })),
  } satisfies ExecutableFlow;
}

function flowWithFanoutAggregate() {
  return {
    id: 'index-test',
    version: '0.0.0',
    entry: 'fanout',
    stages: [{ id: 'stage', stepIds: ['fanout'] }],
    steps: [
      {
        id: 'fanout',
        title: 'fanout',
        protocol: 'fanout@v1',
        kind: 'fanout' as const,
        branches: {
          kind: 'static' as const,
          branches: [
            {
              branch_id: 'branch-1',
              execution: {
                kind: 'relay' as const,
                role: 'reviewer' as const,
                goal: 'review the option',
                report_schema: 'aggregate@v1',
              },
            },
          ],
        },
        join: {
          aggregate: { path: 'reports/aggregate.json', schema: 'aggregate@v1' },
          on_child_failure: 'continue-others' as const,
        },
        concurrency: { kind: 'bounded' as const, max: 4 },
        onChildFailure: 'continue-others' as const,
        routes: { pass: { kind: 'terminal' as const, target: '@complete' as const } },
        writes: {
          branches_dir: { path: 'reports/branches' },
          aggregate: { path: 'reports/aggregate.json', schema: 'aggregate@v1' },
        },
        check: {
          kind: 'fanout_aggregate' as const,
          source: { kind: 'fanout_results' as const, ref: 'aggregate' as const },
          join: { policy: 'aggregate-survivors' as const },
          verdicts: { admit: ['accept'] },
        },
      },
    ],
  } satisfies ExecutableFlow;
}

describe('runtime package index', () => {
  it('fails closed when a report schema resolves to multiple writers', () => {
    const index = buildRuntimePackageIndex(
      flowWithReports([
        { stepId: 'first', schema: 'duplicate@v1' },
        { stepId: 'second', schema: 'duplicate@v1' },
      ]),
    );

    expect(() => reportPathForSchemaInRuntimeFlow(index.flow, 'duplicate@v1')).toThrow(
      "expected exactly one report writer for schema 'duplicate@v1', found 2",
    );
  });

  it('fails closed when a report schema has no writer', () => {
    const index = buildRuntimePackageIndex(
      flowWithReports([{ stepId: 'first', schema: 'known@v1' }]),
    );

    expect(() => reportPathForSchemaInRuntimeFlow(index.flow, 'missing@v1')).toThrow(
      "expected exactly one report writer for schema 'missing@v1', found 0",
    );
  });

  it('resolves schema-bearing fanout aggregate writes', () => {
    const index = buildRuntimePackageIndex(flowWithFanoutAggregate());

    expect(reportPathForSchemaInRuntimeFlow(index.flow, 'aggregate@v1')).toBe(
      'reports/aggregate.json',
    );
  });

  it('fails closed when a registered step is requested as the wrong kind', () => {
    const index = buildRuntimePackageIndex(
      flowWithReports([{ stepId: 'first', schema: 'known@v1' }]),
    );

    expect(() => requireRuntimeIndexedStep(index, 'first', 'relay')).toThrow(
      "runtime package index step 'first' has kind 'compose', expected 'relay'",
    );
  });
});
