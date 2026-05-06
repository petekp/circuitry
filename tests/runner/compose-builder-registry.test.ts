// Proof that the compose writer registry is flow-agnostic.
//
// Mirrors tests/runner/close-builder-registry.test.ts but for the
// upstream compose path. A synthetic ComposeBuilder produces a
// fresh schema's report end-to-end via runCompiledFlow — no runner.ts
// edits required. If any compose step in the runner ever regrows
// flow-specific knowledge, this test breaks.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  runRetainedCompiledFlow as runCompiledFlow,
  writeRetainedComposeReport as writeComposeReport,
} from '../../src/compat/retained-runtime.js';
import { findComposeBuilder } from '../../src/flows/registries/compose-writers/registry.js';
import type { ComposeBuilder } from '../../src/flows/registries/compose-writers/types.js';
import type { ChangeKindDeclaration } from '../../src/schemas/change-kind.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import { RunId } from '../../src/schemas/ids.js';

const SYNTHETIC_BRIEF_SCHEMA = 'synthetic.brief@v1';
const SyntheticBrief = z
  .object({
    subject: z.string().min(1),
    motto: z.string().min(1),
  })
  .strict();

const syntheticBriefBuilder: ComposeBuilder = {
  resultSchemaName: SYNTHETIC_BRIEF_SCHEMA,
  build(context) {
    return SyntheticBrief.parse({
      subject: context.goal,
      motto: 'Composability over inheritance.',
    });
  },
};

function change_kind(): ChangeKindDeclaration {
  return {
    change_kind: 'ratchet-advance',
    failure_mode: 'compose writer registry binds builders to flows-only',
    acceptance_evidence:
      'a synthetic builder produces an report via the same registry contract real builders use',
    alternate_framing: 'wait for a real new flow — rejected because contract is testable now',
  };
}

function deterministicNow(startMs: number): () => Date {
  let n = 0;
  return () => new Date(startMs + n++ * 1000);
}

function syntheticComposeCompiledFlow(): CompiledFlow {
  return CompiledFlow.parse({
    schema_version: '2',
    id: 'synthetic-compose-test',
    version: '0.1.0',
    purpose: 'Synthetic flow that exercises the compose-writer registry contract.',
    entry: { signals: { include: [], exclude: [] }, intent_prefixes: [] },
    entry_modes: [
      {
        name: 'default',
        start_at: 'frame-step',
        depth: 'standard',
        description: 'synthetic compose registry test',
      },
    ],
    stages: [{ id: 'frame-stage', title: 'Frame', canonical: 'frame', steps: ['frame-step'] }],
    stage_path_policy: {
      mode: 'partial',
      omits: ['analyze', 'plan', 'act', 'verify', 'review', 'close'],
      rationale: 'Synthetic compose-writer registry contract test substrate.',
    },
    steps: [
      {
        id: 'frame-step',
        title: 'frame-step',
        protocol: 'synthetic-frame@v1',
        reads: [],
        routes: { pass: '@complete' },
        executor: 'orchestrator',
        kind: 'compose',
        writes: {
          report: { path: 'reports/synthetic-brief.json', schema: SYNTHETIC_BRIEF_SCHEMA },
        },
        check: {
          kind: 'schema_sections',
          source: { kind: 'report', ref: 'report' },
          required: ['subject', 'motto'],
        },
      },
    ],
  });
}

let runFolder: string;

beforeEach(() => {
  runFolder = mkdtempSync(join(tmpdir(), 'circuit-next-compose-registry-'));
});

afterEach(() => {
  rmSync(runFolder, { recursive: true, force: true });
});

describe('compose writer registry', () => {
  it('exposes findComposeBuilder for every registered schema', () => {
    expect(findComposeBuilder('build.plan@v1')?.resultSchemaName).toBe('build.plan@v1');
    expect(findComposeBuilder('explore.brief@v1')?.resultSchemaName).toBe('explore.brief@v1');
    expect(findComposeBuilder('explore.analysis@v1')?.resultSchemaName).toBe('explore.analysis@v1');
    expect(findComposeBuilder('review.intake@v1')?.resultSchemaName).toBe('review.intake@v1');
    expect(findComposeBuilder('review.result@v1')?.resultSchemaName).toBe('review.result@v1');
    expect(findComposeBuilder('fix.brief@v1')?.resultSchemaName).toBe('fix.brief@v1');
  });

  it('returns undefined for an unregistered schema', () => {
    expect(findComposeBuilder(SYNTHETIC_BRIEF_SCHEMA)).toBeUndefined();
  });

  it('aborts the default runtime path when no compose writer is registered', async () => {
    const flow = syntheticComposeCompiledFlow();
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: Buffer.from(JSON.stringify(flow)),
      runId: RunId.parse('00000000-0000-0000-0000-0000bbbb5678'),
      goal: 'missing compose registry test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 14, 5, 0)),
    });

    expect(outcome.result.outcome).toBe('aborted');
    expect(outcome.result.reason).toContain(
      "no compose report writer registered for schema 'synthetic.brief@v1'",
    );
    expect(existsSync(join(runFolder, 'reports/synthetic-brief.json'))).toBe(false);
  });

  it('produces a synthetic report end-to-end via the registry contract', async () => {
    // The composeWriter seam lets this test inject the synthetic builder
    // without mutating the global registry. The relay path is the same
    // shape every registered builder uses — proving the contract works
    // for arbitrary new schemas with zero runner.ts changes.
    const flow = syntheticComposeCompiledFlow();
    const outcome = await runCompiledFlow({
      runFolder,
      flow,
      flowBytes: Buffer.from(JSON.stringify(flow)),
      runId: RunId.parse('00000000-0000-0000-0000-0000bbbb1234'),
      goal: 'synthetic compose registry test',
      depth: 'standard',
      change_kind: change_kind(),
      now: deterministicNow(Date.UTC(2026, 3, 26, 14, 0, 0)),
      composeWriter: (input) => {
        const schemaName = input.step.writes.report.schema;
        if (schemaName === SYNTHETIC_BRIEF_SCHEMA) {
          const report = syntheticBriefBuilder.build({
            runFolder: input.runFolder,
            flow: input.flow,
            step: input.step,
            goal: input.goal,
            inputs: {},
          });
          const abs = join(input.runFolder, input.step.writes.report.path as unknown as string);
          mkdirSync(dirname(abs), { recursive: true });
          writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        writeComposeReport(input);
      },
    });

    if (outcome.result.outcome !== 'complete') {
      throw new Error(
        `synthetic run did not complete: outcome=${outcome.result.outcome} reason=${outcome.result.reason ?? '<none>'}`,
      );
    }
    expect(outcome.result.outcome).toBe('complete');
    const result = JSON.parse(
      readFileSync(join(runFolder, 'reports/synthetic-brief.json'), 'utf8'),
    ) as { subject: string; motto: string };
    expect(result.subject).toBe('synthetic compose registry test');
    expect(result.motto).toBe('Composability over inheritance.');
  });
});
