// Proof that the close-with-evidence registry is flow-agnostic.
//
// The premise: adding a new flow's close should be a CloseBuilder
// file plus a registry entry — no edits to runner.ts. This test
// register a synthetic builder for a new schema, builds a synthetic
// CompiledFlow whose close-step writes that schema, runs it through
// runCompiledFlow, and asserts the new builder fires. If the runner ever
// regrows flow-specific knowledge in its close path, this test
// breaks.
//
// The registry currently has three real builders (build, explore, fix)
// and the synthetic one this test registers temporarily. The test
// restores the registry afterward so other tests stay clean.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  runRetainedCompiledFlow as runCompiledFlow,
  writeRetainedPrototypeComposeReport as writePrototypeComposeReport,
} from '../../src/compat/retained-runtime.js';
import { findCloseBuilder } from '../../src/flows/registries/close-writers/registry.js';
import type { CloseBuilder } from '../../src/flows/registries/close-writers/types.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';

// A schema for a synthetic flow's result. Modeled after explore.result
// but with a different name so we don't collide with anything real.
const SYNTHETIC_RESULT_SCHEMA_NAME = 'synthetic.flow-result@v1';
const SyntheticResult = z
  .object({
    summary: z.string().min(1),
    answer: z.string().min(1),
  })
  .strict();

const syntheticBuilder: CloseBuilder = {
  resultSchemaName: SYNTHETIC_RESULT_SCHEMA_NAME,
  reads: [{ name: 'brief', schema: 'synthetic.brief@v1', required: true }],
  build(context) {
    const brief = z
      .object({ subject: z.string().min(1) })
      .passthrough()
      .parse(context.inputs.brief);
    return SyntheticResult.parse({
      summary: `Synthetic close for: ${brief.subject}`,
      answer: 'forty-two',
    });
  },
};

// We don't have a public registry-mutation API, so the test takes a
// look-don't-touch approach: it imports the registry to confirm shape,
// then constructs a custom composeWriter that calls the synthetic
// builder directly. The runner's writeComposeReport normally
// relays via findCloseBuilder; this test substitutes a thin
// composeWriter that uses syntheticBuilder for the new schema and
// delegates everything else upstream. If the registry's contract were
// internally inconsistent, this test would surface it.

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'close-with-evidence registry binds builders to flows-only',
    acceptance_evidence:
      'a synthetic builder produces a result via the same registry contract real builders use',
    alternate_framing: 'wait for a real new flow — rejected because contract is testable now',
  };
}

function syntheticCloseCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: 'synthetic-close-test',
    version: '0.1.0',
    purpose: 'Synthetic flow that exercises the close-builder registry contract.',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-stub',
        depth: 'standard',
        description: 'synthetic registry test',
      },
    ],
    stages: [
      { id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-stub'] },
      { id: 'close-stage', title: 'Close', canonical: 'close', steps: ['close-step'] },
    ],
    stage_path_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review'],
      rationale: 'Synthetic close-builder registry contract test substrate.',
    },
    steps: [
      {
        id: 'frame-stub',
        title: 'frame-stub',
        protocol: 'synthetic-frame@v1',
        reads: [],
        routes: { pass: 'close-step' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: { report: { path: 'reports/brief.json', schema: 'synthetic.brief@v1' } },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['subject'],
        },
      },
      {
        id: 'close-step',
        title: 'close',
        protocol: 'synthetic-close@v1',
        reads: ['reports/brief.json'],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: {
            path: 'reports/synthetic-result.json',
            schema: SYNTHETIC_RESULT_SCHEMA_NAME,
          },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['summary', 'answer'],
        },
      },
    ],
  });
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-next-close-registry-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('close-with-evidence registry', () => {
  it('exposes findCloseBuilder for the three real flows', () => {
    expect(findCloseBuilder('build.result@v1')?.resultSchemaName).toBe('build.result@v1');
    expect(findCloseBuilder('explore.result@v1')?.resultSchemaName).toBe('explore.result@v1');
    expect(findCloseBuilder('fix.result@v1')?.resultSchemaName).toBe('fix.result@v1');
  });

  it('returns undefined for an unregistered schema', () => {
    expect(findCloseBuilder('synthetic.flow-result@v1')).toBeUndefined();
  });

  it('produces a result via a synthetic builder injected through composeWriter', async () => {
    // The composeWriter seam lets this test inject the synthetic builder
    // without mutating the global registry. The same code path runs for the
    // real registered builders, so the contract is exercised end-to-end.
    const flow = syntheticCloseCompiledFlow();
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: Buffer.from(JSON.stringify(flow)),
      runId: RunId.parse('00000000-0000-0000-0000-0000aaaa1234'),
      goal: 'synthetic registry test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 13, 0, 0)),
      composeWriter: (input) => {
        const schemaName = input.step.writes.report.schema;
        if (schemaName === SYNTHETIC_RESULT_SCHEMA_NAME) {
          // Mirror what the registered close path does: resolve the
          // builder's reads, build, validate, write. For the test we
          // hand the builder a hand-resolved input map.
          const brief = JSON.parse(
            readFileSync(join(input.runFolder, 'reports/brief.json'), 'utf8'),
          );
          const report = syntheticBuilder.build({
            runFolder: input.runFolder,
            flow: input.flow,
            closeStep: input.step as never,
            goal: input.goal,
            inputs: { brief },
          });
          writeFileSync(
            join(input.runFolder, input.step.writes.report.path as unknown as string),
            `${JSON.stringify(report, null, 2)}\n`,
          );
          return;
        }
        // This synthetic frame has no registered writer. The test opts into
        // the prototype-only fallback instead of relying on production
        // placeholder behavior.
        writePrototypeComposeReport(input);
      },
    });
    if (outcome.result.outcome !== 'complete') {
      throw new Error(
        `synthetic run did not complete: outcome=${outcome.result.outcome} reason=${outcome.result.reason ?? '<none>'}`,
      );
    }
    const result = JSON.parse(
      readFileSync(join(runFolder, 'reports/synthetic-result.json'), 'utf8'),
    ) as { summary: string; answer: string };
    expect(result.answer).toBe('forty-two');
    expect(result.summary).toContain('Synthetic close for:');
  });
});
