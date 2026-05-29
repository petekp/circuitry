import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { flowPackages } from '../../src/flows/catalog.js';
import type { CompiledFlowProgressSurface } from '../../src/flows/types.js';
import type { TraceEntry } from '../../src/runtime/domain/trace.js';
import { fromCompiledFlow } from '../../src/runtime/manifest/from-compiled-flow.js';
import { createProgressProjector } from '../../src/runtime/projections/progress.js';
import { CompiledFlow } from '../../src/schemas/compiled-flow.js';
import type { ProgressEvent } from '../../src/schemas/progress-event.js';

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const RECORDED_AT = '2026-05-15T12:00:00.000Z';

function progressSurfaceFor(flowId: string): CompiledFlowProgressSurface {
  const surface = flowPackages.find((pkg) => pkg.id === flowId)?.runtimeSurface?.progress;
  if (surface === undefined) throw new Error(`missing ${flowId} progress surface`);
  return surface;
}

function generatedFlow(flowId: string) {
  const body = JSON.parse(readFileSync(resolve(`generated/flows/${flowId}/circuit.json`), 'utf8'));
  return fromCompiledFlow(CompiledFlow.parse(body));
}

function trace(entry: Omit<TraceEntry, 'run_id' | 'recorded_at'>): TraceEntry {
  return {
    run_id: RUN_ID,
    recorded_at: RECORDED_AT,
    ...entry,
  };
}

function projectProgress(flowId: string, entries: readonly TraceEntry[]): ProgressEvent[] {
  const progress: ProgressEvent[] = [];
  const projector = createProgressProjector({
    progress: (event) => progress.push(event),
    runDir: '/tmp/circuit-progress-test',
    runId: RUN_ID,
    flow: generatedFlow(flowId),
    progressSurface: progressSurfaceFor(flowId),
  });
  for (const entry of entries) {
    projector(entry);
  }
  return progress;
}

describe('runtime progress projection', () => {
  it('keeps operator copy stable when schematic step titles change', () => {
    const body = JSON.parse(readFileSync(resolve('generated/flows/explore/circuit.json'), 'utf8'));
    for (const step of body.steps) {
      if (step.id === 'synthesize-step') {
        step.title = 'Compose — produce explore.compose (connector-bound relay)';
      }
    }

    const flow = fromCompiledFlow(CompiledFlow.parse(body));
    const progress: ProgressEvent[] = [];
    const projector = createProgressProjector({
      progress: (event) => progress.push(event),
      runDir: '/tmp/circuit-progress-test',
      runId: RUN_ID,
      flow,
      progressSurface: progressSurfaceFor('explore'),
    });

    projector(trace({ sequence: 0, kind: 'run.bootstrapped', flow_id: 'explore' }));
    projector(trace({ sequence: 1, kind: 'step.entered', step_id: 'synthesize-step', attempt: 1 }));
    projector(
      trace({
        sequence: 2,
        kind: 'step.completed',
        step_id: 'synthesize-step',
        attempt: 1,
        route_taken: 'pass',
      }),
    );

    const visibleText = progress.map((event) => event.display.text).join('\n');
    expect(visibleText).toContain('Circuit: Drafting the recommendation...');
    expect(visibleText).toContain('Finished drafting the recommendation.');
    expect(visibleText).not.toContain('explore.compose');
    expect(visibleText).not.toContain('connector-bound relay');

    const taskLists = progress.filter((event) => event.type === 'task_list.updated');
    const lastTaskList = taskLists.at(-1);
    expect(lastTaskList?.tasks.find((task) => task.id === 'synthesize-step')).toMatchObject({
      title: 'Draft the recommendation',
      status: 'completed',
    });
  });

  it('keeps Explore relay started and completed copy stable', () => {
    const progress = projectProgress('explore', [
      trace({ sequence: 0, kind: 'run.bootstrapped', flow_id: 'explore' }),
      trace({ sequence: 1, kind: 'step.entered', step_id: 'synthesize-step', attempt: 1 }),
      trace({
        sequence: 2,
        kind: 'relay.started',
        step_id: 'synthesize-step',
        role: 'implementer',
        connector: { kind: 'builtin', name: 'claude-code' },
      }),
      trace({
        sequence: 3,
        kind: 'relay.completed',
        step_id: 'synthesize-step',
        role: 'implementer',
        verdict: 'accept',
        duration_ms: 123,
      }),
    ]);

    expect(progress.find((event) => event.type === 'relay.started')?.display.text).toBe(
      'Circuit: Asking the specialist to draft the recommendation...',
    );
    expect(progress.find((event) => event.type === 'relay.started')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      slot_id: 'synthesize-step:relay',
      status_text: 'Asking the specialist to draft the recommendation...',
    });
    expect(progress.find((event) => event.type === 'relay.completed')?.display.text).toBe(
      'Circuit: Finished drafting the recommendation.',
    );
    expect(progress.find((event) => event.type === 'relay.completed')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      slot_id: 'synthesize-step:relay',
      status_text: 'Finished drafting the recommendation.',
    });
  });

  it('emits the relay.started progress line for the cursor-agent connector', () => {
    // Regression: connectorFromTrace previously recognized only claude-code
    // and codex as built-in connectors, so a cursor-agent relay silently
    // dropped its relay.started progress line that the other connectors emit.
    const progress = projectProgress('explore', [
      trace({ sequence: 0, kind: 'run.bootstrapped', flow_id: 'explore' }),
      trace({ sequence: 1, kind: 'step.entered', step_id: 'synthesize-step', attempt: 1 }),
      trace({
        sequence: 2,
        kind: 'relay.started',
        step_id: 'synthesize-step',
        role: 'implementer',
        connector: { kind: 'builtin', name: 'cursor-agent' },
      }),
    ]);

    const relayStarted = progress.find((event) => event.type === 'relay.started');
    expect(relayStarted).toBeDefined();
    expect(relayStarted).toMatchObject({
      type: 'relay.started',
      role: 'implementer',
      connector_name: 'cursor-agent',
      connector_kind: 'builtin',
      filesystem_capability: 'trusted-write',
    });
    expect(relayStarted?.display.text).toBe(
      'Circuit: Asking the specialist to draft the recommendation...',
    );
  });

  it('keeps non-Explore relay started and completed copy stable', () => {
    const progress = projectProgress('review', [
      trace({ sequence: 0, kind: 'run.bootstrapped', flow_id: 'review' }),
      trace({ sequence: 1, kind: 'step.entered', step_id: 'audit-step', attempt: 1 }),
      trace({
        sequence: 2,
        kind: 'relay.started',
        step_id: 'audit-step',
        role: 'reviewer',
        connector: { kind: 'builtin', name: 'claude-code' },
      }),
      trace({
        sequence: 3,
        kind: 'relay.completed',
        step_id: 'audit-step',
        role: 'reviewer',
        verdict: 'accept',
        duration_ms: 123,
      }),
    ]);

    expect(progress.find((event) => event.type === 'relay.started')?.display.text).toBe(
      'Circuit: Asking the reviewer to check the result...',
    );
    expect(progress.find((event) => event.type === 'relay.started')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      slot_id: 'audit-step:relay',
      status_text: 'Asking the reviewer to check the result...',
    });
    expect(progress.find((event) => event.type === 'relay.completed')?.display.text).toBe(
      'Circuit: Finished checking the result.',
    );
    expect(progress.find((event) => event.type === 'relay.completed')?.presentation).toMatchObject({
      line_mode: 'replace_slot',
      slot_id: 'audit-step:relay',
      status_text: 'Finished checking the result.',
    });
  });
});
