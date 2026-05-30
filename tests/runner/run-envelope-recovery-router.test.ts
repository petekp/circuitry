import { describe, expect, it } from 'vitest';

import {
  RECOVERY_ROUTE_FOR_UNMET_EVIDENCE_KIND,
  followupProcessId,
  recoveryRouteForUnmetKinds,
} from '../../src/app/run-envelope/source-record.js';

describe('Run recovery router (S5)', () => {
  it('maps each unmet evidence kind to a recovery flow', () => {
    expect(RECOVERY_ROUTE_FOR_UNMET_EVIDENCE_KIND).toMatchObject({
      command: 'fix',
      report: 'build',
      review: 'review',
      source: 'explore',
      checkpoint: 'checkpoint',
    });
  });

  it('selects the highest-priority route when multiple kinds are unmet', () => {
    // command outranks report and review
    expect(recoveryRouteForUnmetKinds(['review', 'command', 'report'])).toBe('fix');
    expect(recoveryRouteForUnmetKinds(['report', 'review'])).toBe('build');
    expect(recoveryRouteForUnmetKinds(['review'])).toBe('review');
  });

  it('routes the planned follow-up by the unmet evidence kind of the primary process', () => {
    expect(followupProcessId('build')).toBe('fix'); // build proves via command -> fix
    expect(followupProcessId('fix')).toBe('fix');
    expect(followupProcessId('review')).toBe('review'); // unchanged from prior behavior
    expect(followupProcessId('pursue')).toBe('build'); // pursue proves via report -> build
  });
});
