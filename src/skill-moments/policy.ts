// Skill-moment policy layer — deliberately PRE-WIRED; no live caller yet.
//
// The schema half of this domain ships and runs today: Config.moments
// (SkillMomentConfig), Step.skill_moments (SkillMomentNameArray), and the
// 'skill-moment-ask' run-decision reason all flow through the runtime. This
// module is the policy/dispatch half, staged for Phase 3.5 of the run-centered
// migration ("future config surface; no dispatch yet"). By design nothing in
// the runtime, CLI, or flows invokes resolveSkillMomentPolicy /
// buildRunSkillMomentEvent yet, so esbuild tree-shakes it out of the shipped
// plugin bundle.
//
// Behavioral oracle: tests/contracts/skill-moment-policy-schema.test.ts.
// This is intentionally-staged code, not dead code: deleting it would discard
// contract-tested policy logic the live schema is already shaped to drive. When
// skill-moment dispatch is wired, this is the layer that activates.

import type { LayeredConfig } from '../schemas/config.js';
import { SkillId } from '../schemas/ids.js';
import {
  RunSkillMomentEvent,
  type RunSkillMomentEvent as RunSkillMomentEventValue,
  type SkillMomentCardinality,
  SkillMomentName,
  type SkillMomentName as SkillMomentNameValue,
  type SkillMomentPolicyResolution,
  type SkillMomentPolicyRule,
} from '../schemas/skill-moment.js';
import { type UserSkillRegistry, createUserSkillRegistry } from '../shared/user-skill-registry.js';

type PolicySource = Exclude<SkillMomentPolicyResolution['source'], 'none'>;

type ResolvedPolicy =
  | {
      readonly mode: 'none';
      readonly source: 'none';
    }
  | {
      readonly mode: SkillMomentPolicyRule['mode'];
      readonly source: PolicySource;
      readonly strict: boolean;
      readonly skills: readonly SkillId[];
      readonly policyRef?: string;
    };

export interface BuildRunSkillMomentEventInput {
  readonly eventId: string;
  readonly moment: SkillMomentNameValue;
  readonly detectedFrom: readonly string[];
  readonly cardinality: SkillMomentCardinality;
  readonly configLayers?: readonly LayeredConfig[];
  readonly registry?: UserSkillRegistry;
  readonly askDecision?: 'pending' | 'accepted' | 'rejected';
  readonly decisionPacketId?: string;
  readonly flowId?: string;
  readonly stageId?: string;
  readonly stepId?: string;
  readonly attemptId?: string;
}

function sourceForLayer(layer: LayeredConfig['layer']): PolicySource | undefined {
  if (layer === 'project') return 'project-policy';
  if (layer === 'user-global') return 'user-global-policy';
  return undefined;
}

function policyResolution(policy: ResolvedPolicy): SkillMomentPolicyResolution {
  if (policy.mode === 'none') return { mode: 'none', source: 'none' };
  return {
    mode: policy.mode,
    source: policy.source,
    strict: policy.strict,
    ...(policy.policyRef === undefined ? {} : { policy_ref: policy.policyRef }),
  };
}

export function resolveSkillMomentPolicy(
  configLayers: readonly LayeredConfig[],
  momentInput: SkillMomentNameValue,
): ResolvedPolicy {
  const moment = SkillMomentName.parse(momentInput);
  let resolved: ResolvedPolicy = { mode: 'none', source: 'none' };

  for (const layer of configLayers) {
    const source = sourceForLayer(layer.layer);
    if (source === undefined) continue;
    const rule = layer.config.moments.policy[moment];
    if (rule === undefined) continue;
    resolved =
      rule.mode === 'mute'
        ? {
            mode: 'mute',
            source,
            strict: rule.strict,
            skills: [],
            ...(layer.source_path === undefined ? {} : { policyRef: layer.source_path }),
          }
        : {
            mode: rule.mode,
            source,
            strict: rule.strict,
            skills: rule.skills ?? [],
            ...(layer.source_path === undefined ? {} : { policyRef: layer.source_path }),
          };
  }

  return resolved;
}

export function buildRunSkillMomentEvent(
  input: BuildRunSkillMomentEventInput,
): RunSkillMomentEventValue {
  const policy = resolveSkillMomentPolicy(input.configLayers ?? [], input.moment);
  const registry = input.registry ?? createUserSkillRegistry();
  const triggeredSkills: RunSkillMomentEventValue['triggered_skills'] = [];
  const unavailableSkills: RunSkillMomentEventValue['unavailable_skills'] = [];
  const askDecision = input.askDecision ?? 'pending';
  const shouldPrepare =
    policy.mode === 'auto' || (policy.mode === 'ask' && askDecision === 'accepted');

  if (shouldPrepare) {
    for (const skill of policy.skills) {
      try {
        registry.resolve(skill);
        triggeredSkills.push({
          id: SkillId.parse(skill),
          state: 'planned',
          source: policy.source,
        });
      } catch (err) {
        unavailableSkills.push({
          id: SkillId.parse(skill),
          state: 'unavailable',
          source: policy.source,
          reason: (err as Error).message,
        });
      }
    }
  }

  const decisionPacketId =
    policy.mode === 'ask' && askDecision !== 'accepted'
      ? (input.decisionPacketId ?? `${input.eventId}:ask`)
      : policy.mode !== 'none' && policy.strict && unavailableSkills.length > 0
        ? (input.decisionPacketId ?? `${input.eventId}:strict-skill-unavailable`)
        : input.decisionPacketId;

  return RunSkillMomentEvent.parse({
    schema: 'run.skill-moment@v0',
    event_id: input.eventId,
    moment: input.moment,
    detected_from: [...input.detectedFrom],
    cardinality: input.cardinality,
    policy: policyResolution(policy),
    ...(input.flowId === undefined ? {} : { flow_id: input.flowId }),
    ...(input.stageId === undefined ? {} : { stage_id: input.stageId }),
    ...(input.stepId === undefined ? {} : { step_id: input.stepId }),
    ...(input.attemptId === undefined ? {} : { attempt_id: input.attemptId }),
    ...(decisionPacketId === undefined ? {} : { decision_packet_id: decisionPacketId }),
    triggered_skills: triggeredSkills,
    ...(unavailableSkills.length === 0 ? {} : { unavailable_skills: unavailableSkills }),
  });
}
