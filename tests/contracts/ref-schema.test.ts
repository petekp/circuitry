import { describe, expect, it } from 'vitest';

import { Ref } from '../../src/index.js';

const sha = 'a'.repeat(64);
const runId = '0191d2f0-aaaa-7fff-8aaa-000000000000';

describe('shared Ref schema', () => {
  it('accepts durable work contract and policy refs', () => {
    expect(
      Ref.safeParse({
        kind: 'work_contract',
        ref: 'generated/flows/build/work-contract.json',
        sha256: sha,
        flow_id: 'build',
      }).success,
    ).toBe(true);

    expect(
      Ref.safeParse({
        kind: 'policy',
        ref: 'policy.constraints.max_effort',
      }).success,
    ).toBe(true);
  });

  it('requires hashes for content refs and work contract refs', () => {
    for (const kind of [
      'work_contract',
      'report',
      'evidence',
      'request',
      'context_packet',
      'diff',
      'patch',
      'command',
      'change_packet',
      'safe_apply',
    ] as const) {
      const parsed = Ref.safeParse({ kind, ref: `${kind}/current.json` });
      expect(parsed.success, `${kind} without sha256 should fail`).toBe(false);
    }
  });

  it('binds trace refs to a run id, sequence, and trace.ndjson sequence ref', () => {
    expect(
      Ref.safeParse({
        kind: 'trace',
        ref: 'trace.ndjson#sequence=4',
        run_id: runId,
        sequence: 4,
      }).success,
    ).toBe(true);

    expect(
      Ref.safeParse({
        kind: 'trace',
        ref: 'trace.ndjson#sequence=5',
        run_id: runId,
        sequence: 4,
      }).success,
    ).toBe(false);
  });

  it('rejects surplus fields so refs stay stable across specs', () => {
    expect(
      Ref.safeParse({
        kind: 'memory',
        ref: 'memory/repo-norms.json',
        authority: true,
      }).success,
    ).toBe(false);
  });
});
