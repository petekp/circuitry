import { z } from 'zod';
import { CompiledFlowId, SkillId, StageId, StepId } from './ids.js';

export const SKILL_MOMENT_VOCABULARY = [
  {
    moment: 'before:high-impact-alignment',
    detected_from: ['goal-contract:impact=high', 'operator-flag:high-impact'],
    cardinality: 'per-run',
    default_mode: 'ask',
  },
  {
    moment: 'before:architecture-analysis',
    detected_from: ['selected-process:explore-architecture', 'step-metadata:architecture-analysis'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'before:plan-implementation',
    detected_from: ['stage-transition:Plan', 'step-metadata:plan'],
    cardinality: 'per-stage',
    default_mode: 'auto',
  },
  {
    moment: 'before:implementation',
    detected_from: ['stage-transition:Plan->Act', 'stage-transition:Act'],
    cardinality: 'per-stage',
    default_mode: 'auto',
  },
  {
    moment: 'before:verification',
    detected_from: ['stage-transition:Verify', 'step-metadata:verify'],
    cardinality: 'per-stage',
    default_mode: 'auto',
  },
  {
    moment: 'after:react-ui-change',
    detected_from: ['diff:*.tsx', 'diff:*.jsx', 'config:moments.detection.react_surfaces'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'after:test-change',
    detected_from: ['diff:*.test.*', 'diff:*.spec.*', 'diff:tests/**', 'diff:__tests__/**'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'after:schema-change',
    detected_from: ['diff:*.prisma', 'diff:*.sql', 'diff:migrations/**', 'diff:schemas/**'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'after:api-surface-change',
    detected_from: ['config:moments.detection.api_surfaces'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'after:dependency-change',
    detected_from: ['diff:lockfile', 'diff:package-manifest-dependencies'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'after:verification-failed',
    detected_from: ['evidence-map:required-check-failed'],
    cardinality: 'per-step',
    default_mode: 'auto',
  },
  {
    moment: 'after:evidence-gap',
    detected_from: ['evidence-map:required-claim-missing-after-verify'],
    cardinality: 'per-stage',
    default_mode: 'auto',
  },
  {
    moment: 'before:close-run',
    detected_from: ['run-envelope:close-decision', 'stage-transition:Close'],
    cardinality: 'per-run',
    default_mode: 'auto',
  },
  {
    moment: 'before:handoff',
    detected_from: ['command:handoff', 'run-envelope:handoff-decision'],
    cardinality: 'per-run',
    default_mode: 'auto',
  },
] as const;

export const SkillMomentCardinality = z.enum(['per-run', 'per-stage', 'per-step']);
export type SkillMomentCardinality = z.infer<typeof SkillMomentCardinality>;

export const SkillMomentPolicyMode = z.enum(['auto', 'ask', 'mute']);
export type SkillMomentPolicyMode = z.infer<typeof SkillMomentPolicyMode>;

const SHIPPED_MOMENTS = new Set<string>(SKILL_MOMENT_VOCABULARY.map((entry) => entry.moment));
const CUSTOM_MOMENT_RE = /^[a-z][a-z0-9-]*\/(before|after):[a-z][a-z0-9-]*$/;
const SHIPPED_SHAPE_RE = /^(before|after):[a-z][a-z0-9-]*$/;

function momentBody(value: string): string {
  const slash = value.indexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

export const SkillMomentName = z.string().superRefine((value, ctx) => {
  if (SHIPPED_MOMENTS.has(value)) return;

  if (SHIPPED_SHAPE_RE.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `unknown shipped Skill Moment '${value}'`,
    });
    return;
  }

  if (!CUSTOM_MOMENT_RE.test(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'custom Skill Moments must be namespaced as <namespace>/<before|after>:<name>',
    });
    return;
  }

  if (SHIPPED_MOMENTS.has(momentBody(value))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'custom Skill Moments must not reuse shipped moment names',
    });
  }
});
export type SkillMomentName = z.infer<typeof SkillMomentName>;

export const SkillMomentNameArray = z.array(SkillMomentName).superRefine((moments, ctx) => {
  const seen = new Set<string>();
  for (const [index, moment] of moments.entries()) {
    if (seen.has(moment)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index],
        message: `duplicate Skill Moment '${moment}'`,
      });
    }
    seen.add(moment);
  }
});
export type SkillMomentNameArray = z.infer<typeof SkillMomentNameArray>;

export const SkillMomentPolicyRule = z
  .object({
    mode: SkillMomentPolicyMode,
    skills: z.array(SkillId).optional(),
    strict: z.boolean().default(false),
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.mode === 'mute') {
      if (rule.skills !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skills'],
          message: 'mute Skill Moment policy must not declare skills',
        });
      }
      return;
    }

    if (rule.skills === undefined || rule.skills.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['skills'],
        message: `${rule.mode} Skill Moment policy requires at least one skill`,
      });
      return;
    }

    const seen = new Set<string>();
    for (const [index, skill] of rule.skills.entries()) {
      const key = skill as unknown as string;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skills', index],
          message: `duplicate Skill Moment skill '${key}'`,
        });
      }
      seen.add(key);
    }
  });
export type SkillMomentPolicyRule = z.infer<typeof SkillMomentPolicyRule>;

export const SkillMomentDetectionConfig = z
  .object({
    react_surfaces: z.array(z.string().min(1)).optional(),
    test_surfaces: z.array(z.string().min(1)).optional(),
    schema_surfaces: z.array(z.string().min(1)).optional(),
    api_surfaces: z.array(z.string().min(1)).optional(),
    disabled_patterns: z.record(SkillMomentName, z.array(z.string().min(1))).default({}),
  })
  .strict();
export type SkillMomentDetectionConfig = z.infer<typeof SkillMomentDetectionConfig>;

export const SkillMomentConfig = z
  .object({
    policy: z.record(SkillMomentName, SkillMomentPolicyRule).default({}),
    detection: SkillMomentDetectionConfig.default({ disabled_patterns: {} }),
  })
  .strict();
export type SkillMomentConfig = z.infer<typeof SkillMomentConfig>;

export const SkillMomentSkillState = z.enum([
  'planned',
  'staged',
  'requested',
  'observed',
  'unplanned',
  'unavailable',
]);
export type SkillMomentSkillState = z.infer<typeof SkillMomentSkillState>;

export const SkillMomentPolicyResolution = z.discriminatedUnion('source', [
  z
    .object({
      mode: z.literal('none'),
      source: z.literal('none'),
    })
    .strict(),
  z
    .object({
      mode: SkillMomentPolicyMode,
      source: z.enum(['project-policy', 'user-global-policy', 'default-mapping']),
      strict: z.boolean(),
      policy_ref: z.string().min(1).optional(),
    })
    .strict(),
]);
export type SkillMomentPolicyResolution = z.infer<typeof SkillMomentPolicyResolution>;

export const SkillMomentSkillRef = z
  .object({
    id: SkillId,
    state: SkillMomentSkillState,
    source: z.enum(['project-policy', 'user-global-policy', 'default-mapping', 'host-observed']),
    reason: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((skill, ctx) => {
    if (['observed', 'unplanned'].includes(skill.state) && skill.source !== 'host-observed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source'],
        message: `${skill.state} Skill Moment activity requires host-observed source`,
      });
    }
  });
export type SkillMomentSkillRef = z.infer<typeof SkillMomentSkillRef>;

export const RunSkillMomentEvent = z
  .object({
    schema: z.literal('run.skill-moment@v0'),
    event_id: z.string().min(1),
    moment: SkillMomentName,
    detected_from: z.array(z.string().min(1)).min(1),
    cardinality: SkillMomentCardinality,
    policy: SkillMomentPolicyResolution,
    flow_id: CompiledFlowId.optional(),
    stage_id: StageId.optional(),
    step_id: StepId.optional(),
    attempt_id: z.string().min(1).optional(),
    decision_packet_id: z.string().min(1).optional(),
    triggered_skills: z.array(SkillMomentSkillRef),
    unavailable_skills: z.array(SkillMomentSkillRef).optional(),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (
      (event.policy.mode === 'none' || event.policy.mode === 'mute') &&
      event.triggered_skills.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['triggered_skills'],
        message: `${event.policy.mode} Skill Moment policy must not trigger skills`,
      });
    }

    for (const [index, skill] of event.unavailable_skills?.entries() ?? []) {
      if (skill.state !== 'unavailable') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['unavailable_skills', index, 'state'],
          message: 'unavailable_skills entries must use unavailable state',
        });
      }
    }

    for (const [index, skill] of event.triggered_skills.entries()) {
      if (skill.state === 'unavailable') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['triggered_skills', index, 'state'],
          message: 'unavailable skills belong in unavailable_skills, not triggered_skills',
        });
      }
    }
  });
export type RunSkillMomentEvent = z.infer<typeof RunSkillMomentEvent>;
