import { describe, expect, it } from 'vitest';

import { MemoryInputV0 } from '../../src/index.js';

const sha = 'd'.repeat(64);

function reportRef(ref = 'reports/continuity/records/continuity-1.json') {
  return {
    kind: 'report',
    ref,
    sha256: sha,
  };
}

function contextPacketRef(ref = 'context/handoff-brief.json') {
  return {
    kind: 'context_packet',
    ref,
    sha256: sha,
  };
}

function memoryInput(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    memory_id: 'repo-norms',
    kind: 'repo',
    source: {
      ref: reportRef('docs/project-memory.json'),
      captured_at: '2026-04-18T05:00:00.000Z',
      source_updated_at: '2026-04-18T04:00:00.000Z',
      sha256: sha,
    },
    summary: 'Use the repo verification scripts before closing.',
    hints: [
      {
        id: 'verify-script',
        text: 'Prefer npm run verify when the change touches src or tests.',
        applies_to: 'verification',
      },
    ],
    staleness: {
      status: 'fresh',
      checked_at: '2026-04-18T05:01:00.000Z',
      reason_codes: ['checked_current_run'],
    },
    authority: 'hint_only',
    ...overrides,
  };
}

describe('MemoryInputV0 schema', () => {
  it('accepts a memory hint with stable source refs', () => {
    expect(MemoryInputV0.parse(memoryInput())).toBeDefined();
  });

  it('rejects memory as authority', () => {
    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          authority: 'can_authorize',
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects hint categories that would turn memory into runtime authority', () => {
    for (const appliesTo of ['route', 'checkpoint', 'proof', 'safe_apply', 'policy'] as const) {
      expect(
        MemoryInputV0.safeParse(
          memoryInput({
            hints: [
              {
                id: 'authority-hint',
                text: 'Use this old context as permission.',
                applies_to: appliesTo,
              },
            ],
          }),
        ).success,
        `${appliesTo} should stay outside MemoryInput hint categories`,
      ).toBe(false);
    }
  });

  it('keeps source hashes and hint ids stable', () => {
    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          source: {
            ref: reportRef('docs/project-memory.json'),
            captured_at: '2026-04-18T05:00:00.000Z',
            sha256: 'e'.repeat(64),
          },
        }),
      ).success,
    ).toBe(false);

    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          hints: [
            {
              id: 'verify-script',
              text: 'Run npm run verify.',
              applies_to: 'verification',
            },
            {
              id: 'verify-script',
              text: 'Run npm run test.',
              applies_to: 'verification',
            },
          ],
        }),
      ).success,
    ).toBe(false);
  });

  it('keeps stale and unknown memory visibly weak', () => {
    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          staleness: {
            status: 'unknown',
            checked_at: '2026-04-18T05:01:00.000Z',
            reason_codes: ['checked_current_run'],
          },
        }),
      ).success,
    ).toBe(false);

    expect(
      MemoryInputV0.parse(
        memoryInput({
          staleness: {
            status: 'unknown',
            checked_at: '2026-04-18T05:01:00.000Z',
            reason_codes: ['memory_unverified'],
          },
        }),
      ),
    ).toBeDefined();

    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          staleness: {
            status: 'stale',
            checked_at: '2026-04-18T05:01:00.000Z',
            reason_codes: ['checked_current_run'],
          },
        }),
      ).success,
    ).toBe(false);
  });

  it('bounds continuity and handoff-derived memory to context sources', () => {
    expect(
      MemoryInputV0.parse(
        memoryInput({
          kind: 'continuity',
          source: {
            ref: reportRef('continuity/records/continuity-1.json'),
            captured_at: '2026-04-18T05:00:00.000Z',
          },
        }),
      ),
    ).toBeDefined();

    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          kind: 'continuity',
          source: {
            ref: contextPacketRef('context/continuity.json'),
            captured_at: '2026-04-18T05:00:00.000Z',
          },
        }),
      ).success,
    ).toBe(false);

    expect(
      MemoryInputV0.safeParse(
        memoryInput({
          kind: 'continuity',
          source: {
            ref: reportRef('reports/pursuit-result.json'),
            captured_at: '2026-04-18T05:00:00.000Z',
          },
        }),
      ).success,
    ).toBe(false);

    expect(
      MemoryInputV0.parse(
        memoryInput({
          kind: 'handoff_brief',
          source: {
            ref: contextPacketRef(),
            captured_at: '2026-04-18T05:00:00.000Z',
          },
        }),
      ),
    ).toBeDefined();
  });

  it('rejects surplus fields so memory cannot smuggle authority', () => {
    expect(
      MemoryInputV0.safeParse({
        ...memoryInput(),
        may_write: true,
      }).success,
    ).toBe(false);
  });
});
