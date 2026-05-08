import { describe, expect, it } from 'vitest';

import { ProgressEvent } from '../../../src/schemas/progress-event.js';
import {
  progressDisplay,
  progressPresentation,
  reportProgress,
} from '../../../src/shared/progress-output.js';

describe('shared progress output helpers', () => {
  it('swallows host progress renderer failures', () => {
    const event = ProgressEvent.parse({
      schema_version: 1,
      type: 'run.started',
      run_id: '11111111-1111-4111-8111-111111111111',
      flow_id: 'build',
      recorded_at: '2026-05-07T12:00:00.000Z',
      label: 'Build',
      run_folder: '/tmp/circuit-run',
      display: progressDisplay('Circuit started.', 'major', 'info'),
    });

    expect(() =>
      reportProgress(() => {
        throw new Error('renderer failed');
      }, event),
    ).not.toThrow();
  });

  it('truncates long display text without changing importance or tone', () => {
    const display = progressDisplay('x'.repeat(300), 'detail', 'warning');

    expect(display.text.length).toBeLessThanOrEqual(240);
    expect(display.text.endsWith(' [truncated]')).toBe(true);
    expect(display.importance).toBe('detail');
    expect(display.tone).toBe('warning');
  });

  it('normalizes status text for presentation metadata', () => {
    const presentation = progressPresentation({
      blockId: '11111111-1111-4111-8111-111111111111',
      lineMode: 'append',
      statusText: 'Circuit: Framing the work...',
    });

    expect(presentation).toEqual({
      block_id: '11111111-1111-4111-8111-111111111111',
      line_mode: 'append',
      status_text: 'Framing the work...',
    });
  });
});
