import { describe, expect, it } from 'vitest';

import { projectSummary } from '../../../../src/shared/operator-summary/projections.js';

describe('operator-summary Prototype projection', () => {
  it('summarizes Prototype model-comparison results with selected variant and evidence counts', () => {
    const projection = projectSummary({
      runFolder: '/tmp/circuit-run',
      flowId: 'prototype',
      runOutcome: 'complete',
      resultSummary: 'Circuit run complete.',
      flowReport: {
        mode: 'model-comparison',
        summary: 'Prototype model comparison verified and kept Variant B.',
        outcome: 'kept',
        verification_status: 'passed',
        checkpoint_selection: 'variant-b',
        prototype_root: '.circuit/runs/model-comparison/prototype-files',
        entry_points: [
          '.circuit/runs/model-comparison/prototype-files/variants/variant-b/index.html',
        ],
        selected_variant_id: 'variant-b',
        selected_variant_label: 'Variant B',
        selected_variant_root: '.circuit/runs/model-comparison/prototype-files/variants/variant-b',
        admitted_variant_count: 2,
        captured_provider_evidence_count: 2,
        model_evidence_status: 'captured',
        next_step: 'Inspect the chosen local prototype.',
      },
    });

    expect(projection.headline).toBe(
      'Circuit: Prototype model comparison verified and kept Variant B.',
    );
    expect(projection.details).toContain('Selected variant: Variant B (variant-b).');
    expect(projection.details).toContain('Admitted variants: 2.');
    expect(projection.details).toContain('Captured relay selection evidence: 2.');
  });
});
