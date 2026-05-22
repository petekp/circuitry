import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('relay guidance authority boundary', () => {
  it('keeps production relay selection planning behind relay guidance', () => {
    const relayExecutorSource = readFileSync(
      join(process.cwd(), 'src/runtime/executors/relay.ts'),
      'utf8',
    );
    const relayGuidanceSource = readFileSync(
      join(process.cwd(), 'src/runtime/run/relay-guidance.ts'),
      'utf8',
    );

    expect(relayExecutorSource).toContain('planRelayGuidanceDecision');
    expect(relayExecutorSource).not.toContain('deriveResolvedSelection');
    expect(relayExecutorSource).not.toContain('resolveLoadedRelaySkills');
    expect(relayGuidanceSource).toContain('deriveResolvedSelection');
    expect(relayGuidanceSource).toContain('resolveLoadedRelaySkills');
  });
});
