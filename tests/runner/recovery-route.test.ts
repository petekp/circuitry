import { describe, expect, it } from 'vitest';

import { recoveryRouteForFailure } from '../../src/runtime/run/recovery-selection.js';
import { CompiledFlowId, StepId } from '../../src/schemas/ids.js';
import type { RecoveryRouteBindingV0 } from '../../src/schemas/recovery-route-kind.js';
import { RECOVERY_ROUTE_PRIORITY, recoveryRouteForStep } from '../../src/shared/recovery-route.js';

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
  it('uses the shared priority order for runtime route selection', () => {
    const step = {
      routes: {
        revise: 'revise-step',
        retry: 'retry-step',
        escalate: '@escalate',
      },
    };

    expect(RECOVERY_ROUTE_PRIORITY).toEqual([
      'retry',
      'revise',
      'ask',
      'stop',
      'handoff',
      'escalate',
    ]);
    expect(recoveryRouteForStep(step)).toBe('retry');
  });

  it('honors an allowed-route subset without changing the canonical order', () => {
    const step = {
      routes: {
        retry: 'retry-step',
        ask: 'ask-step',
        handoff: '@handoff',
      },
    };

    expect(recoveryRouteForStep(step, ['handoff', 'ask'])).toBe('ask');
    expect(recoveryRouteForStep(step, ['escalate'])).toBeUndefined();
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
