import { createHash } from 'node:crypto';
import {
  type CheckpointBoundaryChoice,
  CheckpointBoundaryProjectionV0,
  type CheckpointBoundaryProjectionV0 as CheckpointBoundaryProjectionValue,
  type CheckpointBoundaryRejectedAuthority,
  type CheckpointBoundaryRoute,
  type CheckpointReasonCode,
  type PolicyRef,
} from '../schemas/checkpoint-boundary.js';
import type { CompiledFlowId } from '../schemas/ids.js';
import type { Ref } from '../schemas/ref.js';
import type { CheckpointStep } from '../schemas/step.js';

export {
  CheckpointBoundaryProjectionV0,
  CheckpointBoundaryRequestedTraceV0,
  CheckpointBoundaryResolutionV0,
} from '../schemas/checkpoint-boundary.js';

export class CheckpointBoundaryProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckpointBoundaryProjectionError';
  }
}

interface ProjectCheckpointBoundaryInput {
  readonly step: CheckpointStep;
  readonly flowId: CompiledFlowId;
  readonly reasonCode?: CheckpointReasonCode;
  readonly declaredDefaultPolicyRefs?: readonly PolicyRef[];
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function rejectOldAuthority(
  path: string,
  field: string,
  reason: string,
): CheckpointBoundaryRejectedAuthority {
  return { path, field, reason };
}

function routeForChoice(
  step: CheckpointStep,
  choiceId: string,
  rejectedOldAuthority: CheckpointBoundaryRejectedAuthority[],
): CheckpointBoundaryRoute {
  const directTarget = step.routes[choiceId];
  if (directTarget !== undefined) {
    return { id: choiceId, target: directTarget as CheckpointBoundaryRoute['target'] };
  }
  const passTarget = step.routes.pass;
  if (passTarget !== undefined) {
    rejectedOldAuthority.push(
      rejectOldAuthority(
        `compiled-flow/steps/${step.id}/routes/pass`,
        'implicit_pass_route',
        `checkpoint choice '${choiceId}' would currently fall through to route 'pass'; future boundaries require an explicit choice route`,
      ),
    );
    return { id: 'pass', target: passTarget as CheckpointBoundaryRoute['target'] };
  }
  throw new CheckpointBoundaryProjectionError(
    `checkpoint choice '${choiceId}' on step '${step.id}' has no matching route and no pass fallback`,
  );
}

function consequenceForChoice(choice: {
  readonly id: string;
  readonly label?: string | undefined;
  readonly description?: string | undefined;
}): string {
  return (
    choice.description ??
    choice.label ??
    `Select checkpoint choice '${choice.id}' and follow its declared route.`
  );
}

function dynamicRouteFamily(
  step: CheckpointStep,
  rejectedOldAuthority: CheckpointBoundaryRejectedAuthority[],
): CheckpointBoundaryRoute {
  const selectTarget = step.routes.select;
  if (selectTarget !== undefined) {
    return { id: 'select', target: selectTarget as CheckpointBoundaryRoute['target'] };
  }
  const passTarget = step.routes.pass;
  if (passTarget !== undefined) {
    rejectedOldAuthority.push(
      rejectOldAuthority(
        `compiled-flow/steps/${step.id}/routes/pass`,
        'implicit_pass_route',
        'dynamic checkpoint choices would currently fall through to route pass; future boundaries require a route family',
      ),
    );
    return { id: 'pass', target: passTarget as CheckpointBoundaryRoute['target'] };
  }
  throw new CheckpointBoundaryProjectionError(
    `dynamic checkpoint step '${step.id}' has no route family for produced choices`,
  );
}

function staticChoices(
  step: CheckpointStep,
  rejectedOldAuthority: CheckpointBoundaryRejectedAuthority[],
): CheckpointBoundaryChoice[] {
  const choices = step.policy.choices;
  if (choices === undefined) {
    throw new CheckpointBoundaryProjectionError(
      `checkpoint step '${step.id}' has no static choices`,
    );
  }
  return choices.map((choice) => ({
    id: choice.id,
    ...(choice.label === undefined ? {} : { label: choice.label }),
    ...(choice.description === undefined ? {} : { description: choice.description }),
    route: routeForChoice(step, choice.id, rejectedOldAuthority),
    consequence: consequenceForChoice(choice),
  }));
}

export function projectCheckpointBoundaryV0(
  input: ProjectCheckpointBoundaryInput,
): CheckpointBoundaryProjectionValue {
  const { step } = input;
  const rejectedOldAuthority: CheckpointBoundaryRejectedAuthority[] = [];
  const declaredDefaultPolicyRefs = input.declaredDefaultPolicyRefs ?? [];

  if (step.policy.safe_autonomous_choice !== undefined) {
    rejectedOldAuthority.push(
      rejectOldAuthority(
        `compiled-flow/steps/${step.id}/policy/safe_autonomous_choice`,
        'safe_autonomous_choice',
        'safe-autonomous checkpoint resolution is old hidden authority; future resolution must be declared and traced',
      ),
    );
  }

  if (step.policy.auto_resolution !== undefined) {
    rejectedOldAuthority.push(
      rejectOldAuthority(
        `compiled-flow/steps/${step.id}/policy/auto_resolution`,
        `auto_resolution.${step.policy.auto_resolution.policy}`,
        'checkpoint auto-resolution must become declared default or traced guidance, not a direct resolver',
      ),
    );
  }

  const choices =
    step.policy.choices !== undefined
      ? {
          kind: 'static' as const,
          items: staticChoices(step, rejectedOldAuthority),
        }
      : (() => {
          const routeFamily = dynamicRouteFamily(step, rejectedOldAuthority);
          return {
            kind: 'dynamic' as const,
            source: step.policy.choices_from,
            route_family: routeFamily,
            consequence_template: `Select one dynamic checkpoint choice and take route '${routeFamily.id}' to '${routeFamily.target}'.`,
          };
        })();

  const declaredDefault =
    step.policy.safe_default_choice !== undefined &&
    choices.kind === 'static' &&
    declaredDefaultPolicyRefs.length > 0
      ? {
          choice_id: step.policy.safe_default_choice,
          allowed_when: declaredDefaultPolicyRefs,
          reason_code: 'safe_default_choice',
        }
      : undefined;

  if (step.policy.safe_default_choice !== undefined && declaredDefault === undefined) {
    rejectedOldAuthority.push(
      rejectOldAuthority(
        `compiled-flow/steps/${step.id}/policy/safe_default_choice`,
        'safe_default_choice',
        'safe default choices require static choices and explicit policy refs before they become declared defaults',
      ),
    );
  }

  const boundary = {
    schema_version: 0,
    step_id: step.id,
    reason_code: input.reasonCode ?? 'ambiguous_intent',
    authority_required: declaredDefault === undefined ? 'operator' : 'policy',
    prompt: step.policy.prompt,
    choices,
    ...(declaredDefault === undefined ? {} : { declared_default: declaredDefault }),
    writes: step.writes,
    check: step.check,
    proof_refs: [],
  };
  const boundaryHash = sha256(boundary);
  const boundaryRef: Ref = {
    kind: 'work_contract',
    ref: `compiled-flow/steps/${step.id}/checkpoint-boundary.v0`,
    sha256: boundaryHash,
    flow_id: input.flowId,
    step_id: step.id,
  };

  return CheckpointBoundaryProjectionV0.parse({
    schema_version: 0,
    boundary,
    request_trace: {
      boundary_ref: boundaryRef,
      boundary_hash: boundaryHash,
    },
    allowed_resolution_sources: ['operator', 'declared-default', 'policy'],
    resume_validation: {
      request_path_matches_step: true,
      request_hash_required: true,
      choices_match_request: true,
      selected_choice_allowed: true,
      report_hash_matches_when_present: true,
      boundary_hash_required: true,
      guidance_decision_required_before_resolution: true,
    },
    rejected_old_authority: rejectedOldAuthority,
  });
}
