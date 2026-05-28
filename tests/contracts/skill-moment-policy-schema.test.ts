import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  Config,
  LayeredConfig,
  RelayStep,
  RunSkillMomentEvent,
  SKILL_MOMENT_VOCABULARY,
  SkillMomentConfig,
  SkillMomentName,
} from '../../src/index.js';
import { createUserSkillRegistry } from '../../src/shared/user-skill-registry.js';
import {
  buildSkillMomentAskDecisionPacket,
  buildStrictSkillUnavailableDecisionPacket,
} from '../../src/skill-moments/decision-packet.js';
import {
  buildRunSkillMomentEvent,
  resolveSkillMomentPolicy,
} from '../../src/skill-moments/policy.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'circuit-skill-moment-policy-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeSkill(root: string, id: string): void {
  const skillDir = join(root, id);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `---\nname: ${id}\n---\nUse ${id}.\n`);
}

function configLayer(
  layer: 'user-global' | 'project',
  policy: Record<string, unknown>,
): LayeredConfig {
  return LayeredConfig.parse({
    layer,
    source_path: join(tempDir, `${layer}.yaml`),
    config: {
      schema_version: 1,
      moments: { policy },
    },
  });
}

function baseRelayStep(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'review-step',
    title: 'Review',
    protocol: 'review@v1',
    executor: 'worker',
    kind: 'relay',
    role: 'reviewer',
    routes: { pass: '@complete', fail: '@fail' },
    writes: {
      request: 'reports/request.json',
      receipt: 'reports/receipt.txt',
      result: 'reports/result.json',
      report: { path: 'reports/report.json', schema: 'review.result@v1' },
    },
    check: {
      kind: 'result_verdict',
      source: { kind: 'relay_result', ref: 'result' },
      pass: ['accept'],
    },
    ...extra,
  };
}

describe('Skill Moment policy schema', () => {
  it('accepts policy modes and applies Config defaults', () => {
    const parsed = Config.parse({
      schema_version: 1,
      moments: {
        policy: {
          'after:react-ui-change': { mode: 'auto', skills: ['react-doctor'] },
          'before:high-impact-alignment': { mode: 'ask', skills: ['grill-with-docs'] },
          'before:architecture-analysis': { mode: 'mute' },
        },
      },
    });

    expect(parsed.moments.policy['after:react-ui-change']?.strict).toBe(false);
    expect(parsed.moments.detection.disabled_patterns).toEqual({});
  });

  it('rejects slot-shaped and fuzzy policy shapes', () => {
    expect(
      SkillMomentConfig.safeParse({
        policy: { 'after:react-ui-change': { mode: 'auto' } },
      }).success,
    ).toBe(false);
    expect(
      SkillMomentConfig.safeParse({
        policy: { 'before:high-impact-alignment': { mode: 'ask' } },
      }).success,
    ).toBe(false);
    expect(
      SkillMomentConfig.safeParse({
        policy: { 'before:architecture-analysis': { mode: 'mute', skills: ['seam-ripper'] } },
      }).success,
    ).toBe(false);
    expect(
      SkillMomentConfig.safeParse({
        policy: {
          'after:react-ui-change': { mode: 'auto', skills: ['react-doctor', 'react-doctor'] },
        },
      }).success,
    ).toBe(false);
    expect(
      SkillMomentConfig.safeParse({
        policy: { 'after:risky-code': { mode: 'auto', skills: ['seam-ripper'] } },
      }).success,
    ).toBe(false);
    expect(
      SkillMomentConfig.safeParse({
        policy: {
          'team/after:react-ui-change': { mode: 'auto', skills: ['react-doctor'] },
        },
      }).success,
    ).toBe(false);
    expect(
      SkillMomentConfig.safeParse({
        policy: {
          'team/after:storybook-change': { mode: 'auto', skills: ['react-doctor'], extra: true },
        },
      }).success,
    ).toBe(false);
  });

  it('layers project policy as whole-entry replacement over user-global policy', () => {
    const user = configLayer('user-global', {
      'before:architecture-analysis': { mode: 'auto', skills: ['seam-ripper'] },
      'after:react-ui-change': { mode: 'auto', skills: ['react-doctor'] },
    });
    const project = configLayer('project', {
      'before:architecture-analysis': { mode: 'mute' },
    });

    expect(resolveSkillMomentPolicy([user, project], 'before:architecture-analysis')).toMatchObject(
      {
        mode: 'mute',
        source: 'project-policy',
        skills: [],
      },
    );
    expect(resolveSkillMomentPolicy([user, project], 'after:react-ui-change')).toMatchObject({
      mode: 'auto',
      source: 'user-global-policy',
      skills: ['react-doctor'],
    });
    expect(resolveSkillMomentPolicy([user, project], 'before:handoff')).toEqual({
      mode: 'none',
      source: 'none',
    });
  });

  it('records availability without claiming the worker actually ran a skill', () => {
    const agentsRoot = join(tempDir, 'agents');
    writeSkill(agentsRoot, 'react-doctor');
    const registry = createUserSkillRegistry({ roots: [agentsRoot] });
    const layer = configLayer('project', {
      'after:react-ui-change': {
        mode: 'auto',
        skills: ['react-doctor', 'missing-skill'],
      },
    });

    const event = buildRunSkillMomentEvent({
      eventId: 'moment-1',
      moment: SkillMomentName.parse('after:react-ui-change'),
      detectedFrom: ['diff:src/component.tsx'],
      cardinality: 'per-step',
      configLayers: [layer],
      registry,
      flowId: 'build',
      stepId: 'act-step',
    });

    expect(event.triggered_skills).toEqual([
      { id: 'react-doctor', state: 'planned', source: 'project-policy' },
    ]);
    expect(event.unavailable_skills?.[0]).toMatchObject({
      id: 'missing-skill',
      state: 'unavailable',
      source: 'project-policy',
    });
  });

  it('ask mode records a decision packet before preparing skills', () => {
    const agentsRoot = join(tempDir, 'agents-ask');
    writeSkill(agentsRoot, 'grill-with-docs');
    const registry = createUserSkillRegistry({ roots: [agentsRoot] });
    const layer = configLayer('project', {
      'before:high-impact-alignment': {
        mode: 'ask',
        skills: ['grill-with-docs'],
      },
    });

    const pending = buildRunSkillMomentEvent({
      eventId: 'moment-ask',
      moment: SkillMomentName.parse('before:high-impact-alignment'),
      detectedFrom: ['operator-flag:high-impact'],
      cardinality: 'per-run',
      configLayers: [layer],
      registry,
    });
    expect(pending.decision_packet_id).toBe('moment-ask:ask');
    expect(pending.triggered_skills).toEqual([]);

    const accepted = buildRunSkillMomentEvent({
      eventId: 'moment-ask',
      moment: SkillMomentName.parse('before:high-impact-alignment'),
      detectedFrom: ['operator-flag:high-impact'],
      cardinality: 'per-run',
      configLayers: [layer],
      registry,
      askDecision: 'accepted',
      decisionPacketId: 'decision-1',
    });
    expect(accepted.decision_packet_id).toBe('decision-1');
    expect(accepted.triggered_skills).toEqual([
      { id: 'grill-with-docs', state: 'planned', source: 'project-policy' },
    ]);
  });

  it('builds shared decision packets for Skill Moment ask and strict unavailable cases', () => {
    const agentsRoot = join(tempDir, 'agents-decision');
    writeSkill(agentsRoot, 'grill-with-docs');
    const registry = createUserSkillRegistry({ roots: [agentsRoot] });
    const askLayer = configLayer('project', {
      'before:high-impact-alignment': {
        mode: 'ask',
        skills: ['grill-with-docs'],
      },
    });
    const askEvent = buildRunSkillMomentEvent({
      eventId: 'moment-ask',
      moment: SkillMomentName.parse('before:high-impact-alignment'),
      detectedFrom: ['operator-flag:high-impact'],
      cardinality: 'per-run',
      configLayers: [askLayer],
      registry,
    });

    expect(
      buildSkillMomentAskDecisionPacket({
        runId: '00000000-0000-4000-8000-00000000d001',
        event: askEvent,
      }),
    ).toMatchObject({
      reason: 'skill-moment-ask',
      decision_id: 'moment-ask:ask',
      choices: [
        { id: 'use-skills', label: 'Use skills' },
        { id: 'skip-skills', label: 'Skip skills' },
      ],
    });

    const strictLayer = configLayer('project', {
      'after:react-ui-change': {
        mode: 'auto',
        strict: true,
        skills: ['missing-skill'],
      },
    });
    const strictEvent = buildRunSkillMomentEvent({
      eventId: 'moment-strict',
      moment: SkillMomentName.parse('after:react-ui-change'),
      detectedFrom: ['diff:src/component.tsx'],
      cardinality: 'per-step',
      configLayers: [strictLayer],
      registry,
    });

    expect(
      buildStrictSkillUnavailableDecisionPacket({
        runId: '00000000-0000-4000-8000-00000000d001',
        event: strictEvent,
      }),
    ).toMatchObject({
      reason: 'strict-skill-unavailable',
      decision_id: 'moment-strict:strict-skill-unavailable',
      choices: [
        { id: 'continue-without-skill', label: 'Continue' },
        { id: 'stop', label: 'Stop' },
      ],
    });
  });

  it('keeps observed and unplanned skill activity separate from preparation states', () => {
    expect(
      RunSkillMomentEvent.safeParse({
        schema: 'run.skill-moment@v0',
        event_id: 'moment-observed',
        moment: 'after:react-ui-change',
        detected_from: ['host:skills.loaded'],
        cardinality: 'per-step',
        policy: { mode: 'none', source: 'none' },
        triggered_skills: [{ id: 'react-doctor', state: 'observed', source: 'project-policy' }],
      }).success,
    ).toBe(false);

    expect(
      RunSkillMomentEvent.safeParse({
        schema: 'run.skill-moment@v0',
        event_id: 'moment-unplanned',
        moment: 'after:react-ui-change',
        detected_from: ['host:skills.loaded'],
        cardinality: 'per-step',
        policy: { mode: 'auto', source: 'project-policy', strict: false },
        triggered_skills: [{ id: 'react-doctor', state: 'unplanned', source: 'host-observed' }],
      }).success,
    ).toBe(true);
  });

  it('adds a moment-only step field without reviving skill binding matrices', () => {
    expect(
      RelayStep.safeParse(baseRelayStep({ skill_moments: ['after:react-ui-change'] })).success,
    ).toBe(true);
    expect(
      RelayStep.safeParse(baseRelayStep({ skill_moments: [{ skills: ['react-doctor'] }] })).success,
    ).toBe(false);
    expect(RelayStep.safeParse(baseRelayStep({ skill_moments: ['react-doctor'] })).success).toBe(
      false,
    );
  });
});

describe('Skill Moment vocabulary fixtures', () => {
  it('pins the shipped V1 vocabulary to observable detection sources', () => {
    expect(SKILL_MOMENT_VOCABULARY).toHaveLength(14);
    for (const entry of SKILL_MOMENT_VOCABULARY) {
      expect(SkillMomentName.safeParse(entry.moment).success).toBe(true);
      expect(entry.detected_from.length).toBeGreaterThan(0);
      expect(entry.detected_from.join('\n')).not.toMatch(/natural-language/i);
      expect(['auto', 'ask', 'mute']).toContain(entry.default_mode);
      expect(['per-run', 'per-stage', 'per-step']).toContain(entry.cardinality);
    }
  });
});
