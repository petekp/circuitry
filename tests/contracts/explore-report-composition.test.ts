import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findCloseBuilder } from '../../src/flows/registries/close-writers/registry.js';
import { findComposeBuilder } from '../../src/flows/registries/compose-writers/registry.js';
import { parseReport } from '../../src/flows/registries/report-schemas.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';

const REPO_ROOT = resolve('.');
const EXPLORE_FIXTURE_PATH = join(REPO_ROOT, 'generated/flows/explore/circuit.json');
const ARTIFACTS_PATH = join(REPO_ROOT, 'specs/reports.json');

// Schemas whose runtime writer is a ComposeBuilder (rather than a
// CloseBuilder or an inline runner branch). After the catalog refactor
// the writer's location is implementation detail; the registry is the
// authoritative source of "schema → writer" bindings.
const SCHEMAS_IN_SYNTHESIS_REGISTRY: readonly string[] = [
  'explore.brief@v1',
  'explore.analysis@v1',
];
const SCHEMAS_IN_CLOSE_REGISTRY: readonly string[] = ['explore.result@v1'];

type ReportRow = {
  id: string;
  description: string;
  schema_file: string;
  schema_exports: string[];
};

type ReportsFile = {
  reports: ReportRow[];
};

type StepWithReport = CompiledFlow['steps'][number] & {
  writes: { report: { path: string; schema: string } };
  check: { required?: string[]; pass?: string[] };
};

const LANDED_ARTIFACTS = [
  {
    reportId: 'explore.brief',
    stepId: 'frame-step',
    schemaName: 'explore.brief@v1',
    schemaExports: ['ExploreBrief'],
    requiredFields: ['subject', 'success_condition'],
  },
  {
    reportId: 'explore.analysis',
    stepId: 'analyze-step',
    schemaName: 'explore.analysis@v1',
    schemaExports: ['ExploreAnalysis', 'ExploreAspect', 'ExploreEvidenceCitation'],
    requiredFields: ['aspects'],
  },
  {
    reportId: 'explore.compose',
    stepId: 'synthesize-step',
    schemaName: 'explore.compose@v1',
    schemaExports: ['ExploreCompose', 'ExploreComposeAspect'],
    passVerdicts: ['accept'],
    validBody: {
      verdict: 'accept',
      subject: 'Composition check',
      recommendation: 'Keep the landed schema surfaces bound together',
      success_condition_alignment: 'The proof names the cross-slice seam',
      supporting_aspects: [
        {
          aspect: 'schema-binding',
          contribution: 'The fixture, report ledger, and registry agree',
          evidence_refs: ['reports/analysis.json'],
        },
      ],
    },
  },
  {
    reportId: 'explore.review-verdict',
    stepId: 'review-step',
    schemaName: 'explore.review-verdict@v1',
    schemaExports: ['ExploreReviewVerdict', 'ExploreReviewVerdictValue'],
    passVerdicts: ['accept', 'accept-with-fold-ins'],
    validBody: {
      verdict: 'accept-with-fold-ins',
      overall_assessment: 'The compose is usable with a follow-up note',
      objections: ['Clarify close-result ownership before the next slice'],
      missed_angles: [],
    },
  },
  {
    reportId: 'explore.result',
    stepId: 'close-step',
    schemaName: 'explore.result@v1',
    schemaExports: [
      'ExploreResult',
      'ExploreResultReportId',
      'ExploreResultReportPointer',
      'ExploreResultVerdictSnapshot',
    ],
    requiredFields: ['summary', 'verdict_snapshot'],
  },
] as const;

function loadReports(): ReportRow[] {
  return (JSON.parse(readFileSync(ARTIFACTS_PATH, 'utf8')) as ReportsFile).reports;
}

function reportById(rows: ReportRow[], id: string): ReportRow {
  const report = rows.find((row) => row.id === id);
  if (report === undefined) throw new Error(`report row not found: ${id}`);
  return report;
}

function loadExploreCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse(JSON.parse(readFileSync(EXPLORE_FIXTURE_PATH, 'utf8')));
}

function stepById(flow: CompiledFlow, stepId: string): StepWithReport {
  const step = flow.steps.find((candidate) => candidate.id === stepId);
  if (step === undefined) throw new Error(`step not found: ${stepId}`);
  return step as StepWithReport;
}

describe('report-schema composition seam', () => {
  it('binds landed explore report schemas across fixture, ledger, and runtime validation', () => {
    const reports = loadReports();
    const flow = loadExploreCompiledFlow();

    for (const spec of LANDED_ARTIFACTS) {
      const row = reportById(reports, spec.reportId);
      expect(row.schema_file).toBe('src/flows/explore/reports.ts');
      expect(row.schema_exports).toEqual([...spec.schemaExports]);

      const step = stepById(flow, spec.stepId);
      expect(step.writes.report.schema).toBe(spec.schemaName);

      if ('requiredFields' in spec) {
        expect(step.check.required).toEqual([...spec.requiredFields]);
        // Each writer registers under exactly one registry. Look it up
        // by schema and require a builder is registered there. If the
        // runtime ever drops the writer, this assertion fails with the
        // schema name it couldn't find.
        if (SCHEMAS_IN_CLOSE_REGISTRY.includes(spec.schemaName)) {
          expect(
            findCloseBuilder(spec.schemaName),
            `expected a registered close builder for ${spec.schemaName}`,
          ).toBeDefined();
        } else if (SCHEMAS_IN_SYNTHESIS_REGISTRY.includes(spec.schemaName)) {
          expect(
            findComposeBuilder(spec.schemaName),
            `expected a registered compose builder for ${spec.schemaName}`,
          ).toBeDefined();
        } else {
          throw new Error(
            `test wiring missing: schema ${spec.schemaName} is not classified in SCHEMAS_IN_{CLOSE,compose}_REGISTRY`,
          );
        }
        expect(parseReport(spec.schemaName, '{}').kind).toBe('fail');
      }

      if ('passVerdicts' in spec) {
        expect(step.check.pass).toEqual([...spec.passVerdicts]);
        expect(parseReport(spec.schemaName, JSON.stringify(spec.validBody)).kind).toBe('ok');
      }
    }

    expect(parseReport('explore.result@v1', '{"summary":"x","verdict_snapshot":"y"}').kind).toBe(
      'fail',
    );
  });
});
