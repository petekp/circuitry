import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { recoveryRouteForFailure } from '../../src/runtime/run/recovery-selection.js';
import { CompiledFlowId, StepId } from '../../src/schemas/ids.js';
import type { RecoveryRouteBindingV0 } from '../../src/schemas/recovery-route-kind.js';

const workContractRef = {
  kind: 'work_contract' as const,
  ref: 'runtime/work-contract/recovery-selection/test.json',
  sha256: 'a'.repeat(64),
  flow_id: CompiledFlowId.parse('recovery-selection'),
};

function binding(
  routeId: string,
  routeTarget: string,
  allowedFailureCauses: RecoveryRouteBindingV0['allowed_failure_causes'],
): RecoveryRouteBindingV0 {
  return {
    schema_version: 0,
    step_id: StepId.parse('act-step'),
    route_id: routeId,
    route_target: routeTarget,
    kind: routeId === 'stop' ? 'stop_unsafe' : 'checkpoint_authority',
    allowed_failure_causes: allowedFailureCauses,
    required_refs: ['trace'],
    operator_authority: 'not_required',
    attempt_budget: {
      consumes_step_attempt: false,
      must_respect_max_attempts: true,
      retry_target: 'declared_step',
    },
    guidance: {
      subject: 'recovery_route',
      must_match_step_completed: true,
    },
    source_ref: {
      ...workContractRef,
      ref: `compiled-flow/steps/act-step/routes/${routeId}`,
    },
  };
}

describe('recovery route selection', () => {
  it('does not expose old recovery route priority helpers as shared authority', () => {
    const recoverySelectionSource = readFileSync(
      join(process.cwd(), 'src/runtime/run/recovery-selection.ts'),
      'utf8',
    );

    expect(existsSync(join(process.cwd(), 'src/shared/recovery-route.ts'))).toBe(false);
    expect(recoverySelectionSource).not.toContain('RECOVERY_ROUTE_PRIORITY');
    expect(recoverySelectionSource).not.toContain('recoveryRouteForStep');
  });

  it('uses fallback route priority only when no WorkContract is present', () => {
    const step = {
      id: 'act-step',
      routes: {
        revise: { kind: 'step' as const, stepId: 'revise-step' },
        retry: { kind: 'step' as const, stepId: 'retry-step' },
        escalate: { kind: 'terminal' as const, target: '@escalate' as const },
      },
    };

    expect(recoveryRouteForFailure({ step, cause: 'failed_check' })).toBe('retry');
  });

  it('uses WorkContract bindings before legacy recovery priority for failed work', () => {
    const step = {
      id: 'act-step',
      routes: {
        ask: { kind: 'terminal' as const, target: '@stop' as const },
        stop: { kind: 'terminal' as const, target: '@stop' as const },
      },
    };

    expect(
      recoveryRouteForFailure({
        step,
        workContractRef,
        recoveryRouteBindings: [
          binding('ask', '@stop', ['checkpoint_boundary']),
          binding('stop', '@stop', ['failed_check']),
        ],
        cause: 'failed_check',
      }),
    ).toBe('stop');
  });

  it('keeps a declared preferred route so the graph runner can reject bad bindings', () => {
    const step = {
      id: 'act-step',
      routes: {
        'connector-failed': { kind: 'terminal' as const, target: '@escalate' as const },
        retry: { kind: 'step' as const, stepId: 'act-step' },
      },
    };

    expect(
      recoveryRouteForFailure({
        step,
        workContractRef,
        recoveryRouteBindings: [],
        cause: 'relay_connector_failed',
        preferredRoute: 'connector-failed',
      }),
    ).toBe('connector-failed');
  });
});
