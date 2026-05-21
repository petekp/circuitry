#!/usr/bin/env node

import { Command } from 'commander';
import {
  formatMarkdown,
  loadJsonWithSchema,
  loadReleaseChecks,
  loadReleaseSchemas,
  loadYamlWithSchema,
  writeOrCheck,
} from './shared.ts';

const OUT_REL = 'docs/release/parity-matrix.generated.md';
const program = new Command('render-parity-matrix').option('--check');
program.parse(process.argv.slice(2), { from: 'user' });
const check = program.opts<{ check?: boolean }>().check === true;

// biome-ignore lint/suspicious/noExplicitAny: release schemas are loaded dynamically from built output.
type AnyRecord = Record<string, any>;
type CapabilityById = Map<string, AnyRecord>;
type ExceptionByCapability = Map<string, AnyRecord>;

function mdCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.length === 0 ? '' : value.map(String).join(', ');
  return String(value).replaceAll('\n', ' ');
}

function statusWithAxes(
  original: AnyRecord,
  current: AnyRecord | undefined,
  exceptionByCapability: ExceptionByCapability,
  behavioralAxisMismatches: (args: { expected: AnyRecord; actual: AnyRecord }) => unknown[],
): string {
  const exception = exceptionByCapability.get(original.id);
  if (current === undefined) {
    return String(exception?.status ?? 'missing');
  }
  if (current.status !== 'implemented') return String(exception?.status ?? current.status);
  const mismatches = behavioralAxisMismatches({ expected: original, actual: current });
  if (mismatches.length === 0) return 'implemented';
  return String(exception?.status ?? 'partial');
}

function axisCell(original: AnyRecord, current: AnyRecord | undefined, key: string): string {
  const expected = (original.axes as AnyRecord)[key];
  const actual = (current?.axes as AnyRecord | undefined)?.[key];
  const expectedText = mdCell(expected);
  const actualText = mdCell(actual);
  if (expectedText === '') return actualText;
  if (actualText === '') return `expected: ${expectedText}`;
  if (expectedText.toLowerCase() === actualText.toLowerCase()) return actualText;
  return `current: ${actualText}; expected: ${expectedText}`;
}

function renderFlowRows(
  original: AnyRecord,
  currentById: CapabilityById,
  exceptionByCapability: ExceptionByCapability,
  behavioralAxisMismatches: (args: { expected: AnyRecord; actual: AnyRecord }) => unknown[],
): string {
  const rows = (original.capabilities as AnyRecord[])
    .filter((capability: AnyRecord) => capability.kind === 'flow')
    .map((capability: AnyRecord) => {
      const current = currentById.get(capability.id);
      const status = statusWithAxes(
        capability,
        current,
        exceptionByCapability,
        behavioralAxisMismatches,
      );
      const readiness =
        exceptionByCapability.get(capability.id)?.readiness_ref ??
        (status === 'partial' ? 'REL-004' : '');
      return [
        capability.title,
        capability.id,
        status,
        axisCell(capability, current, 'modes'),
        axisCell(capability, current, 'stage_path'),
        axisCell(capability, current, 'outputs'),
        axisCell(capability, current, 'checkpoint'),
        axisCell(capability, current, 'review'),
        axisCell(capability, current, 'verification'),
        axisCell(capability, current, 'worker_handoff'),
        axisCell(capability, current, 'continuity'),
        axisCell(capability, current, 'proof'),
        readiness,
      ];
    });
  return table(
    [
      'Flow',
      'Capability',
      'Status',
      'Modes',
      'Stage Path',
      'Outputs / Reports',
      'Checkpoint',
      'Review',
      'Verification',
      'Worker Handoff',
      'Continuity',
      'Proof',
      'Readiness',
    ],
    rows,
  );
}

function renderOtherRows(
  original: AnyRecord,
  currentById: CapabilityById,
  exceptionByCapability: ExceptionByCapability,
  behavioralAxisMismatches: (args: { expected: AnyRecord; actual: AnyRecord }) => unknown[],
): string {
  const rows = (original.capabilities as AnyRecord[])
    .filter((capability: AnyRecord) => capability.kind !== 'flow')
    .map((capability: AnyRecord) => {
      const current = currentById.get(capability.id);
      const status = statusWithAxes(
        capability,
        current,
        exceptionByCapability,
        behavioralAxisMismatches,
      );
      return [
        capability.kind,
        capability.title,
        capability.id,
        status,
        mdCell(capability.axes.invocation),
        axisCell(capability, current, 'modes'),
        axisCell(capability, current, 'checkpoint'),
        axisCell(capability, current, 'review'),
        axisCell(capability, current, 'verification'),
        axisCell(capability, current, 'worker_handoff'),
        axisCell(capability, current, 'continuity'),
        axisCell(capability, current, 'proof'),
        exceptionByCapability.get(capability.id)?.readiness_ref ??
          (current?.readiness_refs as string[] | undefined)?.join(', ') ??
          '',
      ];
    });
  return table(
    [
      'Kind',
      'Name',
      'Capability',
      'Status',
      'Invocation',
      'Modes',
      'Checkpoint',
      'Review',
      'Verification',
      'Worker Handoff',
      'Continuity',
      'Proof',
      'Readiness',
    ],
    rows,
  );
}

function axisSelectionsFor(axes: AnyRecord): string[] {
  const selections = new Set<string>();
  const allowedRigors = Array.isArray(axes.allowed_rigors) ? axes.allowed_rigors : [];
  if (allowedRigors.includes('standard')) selections.add('default');
  if (allowedRigors.includes('lite')) selections.add('lite');
  if (allowedRigors.includes('deep')) selections.add('deep');
  if (axes.supports_tournament) selections.add('tournament');
  if (axes.supports_autonomous) selections.add('autonomous');
  return [...selections].sort();
}

function renderCurrentModeRows(current: AnyRecord): string {
  const rows = (current.flows as AnyRecord[]).map((flow: AnyRecord) => [
    flow.id,
    axisSelectionsFor(flow.axis_support).join(', '),
    (flow.route_outcomes as unknown[]).map(String).join(', '),
    (flow.unsupported_route_outcomes as unknown[]).map(String).join(', '),
  ]);
  return table(['Current Flow', 'Axis Selections', 'Declared Routes', 'Unsupported Routes'], rows);
}

function table(headers: string[], rows: unknown[][]): string {
  const headerLine = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`);
  return [headerLine, sep, ...body].join('\n');
}

async function main() {
  const schemas = await loadReleaseSchemas();
  const checks = await loadReleaseChecks();
  const original = loadYamlWithSchema(
    'docs/release/parity/original-circuit.yaml',
    schemas.OriginalCapabilitySnapshot,
  ) as AnyRecord;
  const current = loadJsonWithSchema(
    'generated/release/current-capabilities.json',
    schemas.CurrentCapabilitySnapshot,
  ) as AnyRecord;
  const exceptions = loadYamlWithSchema(
    'docs/release/parity/exceptions.yaml',
    schemas.ParityExceptionLedger,
  ) as AnyRecord;
  const currentById: CapabilityById = new Map(
    (current.capabilities as AnyRecord[]).map((capability: AnyRecord) => [
      capability.id,
      capability,
    ]),
  );
  const exceptionByCapability: ExceptionByCapability = new Map(
    (exceptions.exceptions as AnyRecord[])
      .filter((exception: AnyRecord) => exception.capability_id !== undefined)
      .map((exception: AnyRecord) => [exception.capability_id, exception]),
  );

  const lines = [
    '# Circuit Parity Matrix',
    '',
    '<!-- Generated by scripts/release/render-parity-matrix.ts. Do not edit by hand. -->',
    '',
    'Compares the checked-in original Circuit snapshot with the current capability snapshot. A `release_blocker` gap is known and tracked; it does not mean the release is ready.',
    '',
    '## Original Parity Surface',
    '',
    renderFlowRows(original, currentById, exceptionByCapability, checks.behavioralAxisMismatches),
    '',
    '## Utilities, Intents, Connectors, And Operator Features',
    '',
    renderOtherRows(original, currentById, exceptionByCapability, checks.behavioralAxisMismatches),
    '',
    '## Current Route And Axis Inventory',
    '',
    renderCurrentModeRows(current),
    '',
  ];

  writeOrCheck(OUT_REL, formatMarkdown(lines.join('\n')), check);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
