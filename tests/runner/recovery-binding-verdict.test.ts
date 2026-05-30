import { describe, expect, it } from 'vitest';

import {
  type RecoveryBindingVerdictInput,
  type RecoveryFailureEvidence,
  recoveryBindingVerdict,
} from '../../src/runtime/run/recovery-binding-verdict.js';
import { CompiledFlowId, RunId, StepId } from '../../src/schemas/ids.js';
import type {
  RecoveryFailureCause,
  RecoveryRouteBindingV0,
} from '../../src/schemas/recovery-route-kind.js';
import type { Ref } from '../../src/schemas/ref.js';

const workContractRef: Ref = {
  kind: 'work_contract',
  ref: 'runtime/work-contract/recovery-binding-verdict/test.json',
  sha256: 'a'.repeat(64),
  flow_id: CompiledFlowId.parse('recovery-binding-verdict'),
};

function traceRef(): Ref {
  return {
    kind: 'trace',
    ref: 'trace.ndjson#sequence=1',
    run_id: RunId.parse('40000000-0000-4000-8000-000000000001'),
    flow_id: CompiledFlowId.parse('recovery-binding-verdict'),
    step_id: StepId.parse('compose'),
    attempt: 1,
    sequence: 1,
  };
}

function evidence(cause: RecoveryFailureCause): RecoveryFailureEvidence {
  return { ref: traceRef(), cause };
}

// The verdict function reads only `kind` and `allowed_failure_causes`; the rest
// of the binding shape is irrelevant to its decision, so a minimal stub suffices.
function binding(allowedCauses: readonly RecoveryFailureCause[]): RecoveryRouteBindingV0 {
  return {
    kind: 'checkpoint_authority',
    allowed_failure_causes: allowedCauses,
  } as RecoveryRouteBindingV0;
}

function input(overrides: Partial<RecoveryBindingVerdictInput>): RecoveryBindingVerdictInput {
  return {
    workContractRef,
    stepId: 'compose',
    stepKind: 'compose',
    route: 'revise',
    routeHasRecoveryMechanics: true,
    recoveryFailure: undefined,
    recoveryBinding: undefined,
    ...overrides,
  };
}

describe('recoveryBindingVerdict', () => {
  it('passes when no WorkContract binds the run, regardless of recovery state', () => {
    expect(
      recoveryBindingVerdict(
        input({
          workContractRef: undefined,
          recoveryFailure: undefined,
          recoveryBinding: undefined,
        }),
      ),
    ).toEqual({ kind: 'ok' });
  });

  it('aborts a recovery route that lacks failure evidence', () => {
    expect(
      recoveryBindingVerdict(
        input({ routeHasRecoveryMechanics: true, recoveryFailure: undefined }),
      ),
    ).toEqual({
      kind: 'abort',
      reason: "step 'compose' selected recovery route 'revise' without failure evidence",
    });
  });

  it('does not demand evidence from a checkpoint step', () => {
    expect(
      recoveryBindingVerdict(
        input({
          stepKind: 'checkpoint',
          routeHasRecoveryMechanics: true,
          recoveryFailure: undefined,
        }),
      ),
    ).toEqual({ kind: 'ok' });
  });

  it('aborts when failure evidence has no matching binding', () => {
    expect(
      recoveryBindingVerdict(
        input({ recoveryFailure: evidence('failed_check'), recoveryBinding: undefined }),
      ),
    ).toEqual({
      kind: 'abort',
      reason:
        "step 'compose' selected recovery route 'revise' after failed_check but the WorkContract does not declare a matching recovery binding",
    });
  });

  it('aborts when the binding does not allow the failure cause', () => {
    expect(
      recoveryBindingVerdict(
        input({
          recoveryFailure: evidence('failed_check'),
          recoveryBinding: binding(['weak_proof']),
        }),
      ),
    ).toEqual({
      kind: 'abort',
      reason:
        "step 'compose' selected recovery route 'revise' for failed_check, but its WorkContract binding only allows: weak_proof",
    });
  });

  it('passes when the binding allows the failure cause', () => {
    expect(
      recoveryBindingVerdict(
        input({
          recoveryFailure: evidence('failed_check'),
          recoveryBinding: binding(['failed_check', 'weak_proof']),
        }),
      ),
    ).toEqual({ kind: 'ok' });
  });
});
