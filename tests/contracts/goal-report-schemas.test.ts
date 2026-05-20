import { describe, expect, it } from 'vitest';

import {
  GoalContract,
  GoalEvidenceEvaluation,
  GoalGate,
  GoalResult,
} from '../../src/flows/goal/reports.js';

function validContract(): unknown {
  return {
    schema: 'goal.contract@v1',
    objective: 'Fix the flaky login test and prove it stays fixed.',
    source_of_truth: 'circuit-run-folder',
    scope: {
      in: ['login test and directly related auth helper'],
      out: ['unrelated auth redesign'],
      assumptions: ['local verification commands are available'],
    },
    constraints: ['Do not broaden auth behavior.'],
    done_when: [
      {
        id: 'test-fixed',
        claim: 'The flaky login test passes reliably.',
        required_evidence: [
          {
            kind: 'command',
            description: 'The focused login test passes.',
            required: true,
          },
        ],
      },
    ],
    allowed_flow_targets: ['fix', 'review'],
    selected_flow_target: 'fix',
    recovery_policy: {
      max_attempts: 3,
      routes: ['retry-selected-flow', 'run-review', 'checkpoint', 'blocked'],
    },
    check_in_triggers: ['Scope expands beyond the login test.'],
    stop_conditions: ['The failure cannot be reproduced locally.'],
    completion_gate: {
      required_passes: 2,
      blocking_severities: ['critical', 'high', 'medium'],
      reset_on_blocking_finding: true,
    },
  };
}

function validSatisfiedEvaluation(): unknown {
  return {
    schema: 'goal.evidence-evaluation@v1',
    verdict: 'satisfied',
    claim_results: [
      {
        claim_id: 'test-fixed',
        status: 'proved',
        evidence: ['reports/goal/attempts/attempt-1.json'],
        gap: null,
      },
    ],
    next_route: 'completion-gate',
  };
}

function validGate(): unknown {
  return {
    schema: 'goal.gate@v1',
    verdict: 'gate-pass',
    clean_streak: 2,
    required_passes: 2,
    blocking_findings: [],
    low_findings: [],
    passes: [
      {
        pass_id: 'gate-1',
        attack_lens: 'contract-and-proof',
        evidence_checked: ['reports/goal/contract.json'],
        verdict: 'gate-pass',
      },
      {
        pass_id: 'gate-2',
        attack_lens: 'false-done-and-recovery',
        evidence_checked: ['reports/goal/evidence-evaluation.json'],
        verdict: 'gate-pass',
      },
    ],
    next_route: 'close',
  };
}

function validResult(): unknown {
  return {
    schema: 'goal.result@v1',
    outcome: 'complete',
    summary: 'Goal complete with two gate passes.',
    proven_claims: ['The flaky login test passes reliably.'],
    missing_or_weak_claims: [],
    recovery_history: [],
    residual_risks: [],
    rerun_commands: ['npm test -- login'],
    evidence_links: [
      {
        report_id: 'goal.contract',
        path: 'reports/goal/contract.json',
        schema: 'goal.contract@v1',
      },
      {
        report_id: 'goal.attempt',
        path: 'reports/goal/attempts/attempt-1.json',
        schema: 'goal.attempt@v1',
      },
      {
        report_id: 'goal.evidence-evaluation',
        path: 'reports/goal/evidence-evaluation.json',
        schema: 'goal.evidence-evaluation@v1',
      },
      {
        report_id: 'goal.gate',
        path: 'reports/goal/gate.json',
        schema: 'goal.gate@v1',
      },
    ],
    gate: {
      clean_streak: 2,
      required_passes: 2,
      final_verdict: 'gate-pass',
    },
  };
}

describe('Goal report schemas', () => {
  it('accepts a valid goal contract', () => {
    expect(GoalContract.safeParse(validContract()).success).toBe(true);
  });

  it('rejects a contract whose selected target is outside the allowed static targets', () => {
    const raw = validContract() as {
      selected_flow_target: string;
      allowed_flow_targets: string[];
    };
    raw.selected_flow_target = 'build';
    raw.allowed_flow_targets = ['fix'];
    const result = GoalContract.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('selected_flow_target');
    }
  });

  it('rejects a contract with no required evidence for a done claim', () => {
    const raw = validContract() as {
      done_when: Array<{ required_evidence: Array<{ required: boolean }> }>;
    };
    const firstEvidence = raw.done_when[0]?.required_evidence[0];
    if (firstEvidence === undefined) throw new Error('test fixture missing first evidence');
    firstEvidence.required = false;
    const result = GoalContract.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('required evidence');
    }
  });

  it('rejects a contract whose source of truth or gate policy escapes V1', () => {
    const wrongSource = {
      ...(validContract() as Record<string, unknown>),
      source_of_truth: 'host-transcript',
    };
    expect(GoalContract.safeParse(wrongSource).success).toBe(false);

    const wrongGate = validContract() as {
      completion_gate: { required_passes: number; reset_on_blocking_finding: boolean };
    };
    wrongGate.completion_gate.required_passes = 1;
    expect(GoalContract.safeParse(wrongGate).success).toBe(false);
  });

  it('bounds recovery attempts', () => {
    const raw = validContract() as { recovery_policy: { max_attempts: number } };
    raw.recovery_policy.max_attempts = 0;
    expect(GoalContract.safeParse(raw).success).toBe(false);

    raw.recovery_policy.max_attempts = 11;
    expect(GoalContract.safeParse(raw).success).toBe(false);
  });

  it('allows evidence evaluation to enter the completion gate only when every claim is proved', () => {
    expect(GoalEvidenceEvaluation.safeParse(validSatisfiedEvaluation()).success).toBe(true);

    const raw = validSatisfiedEvaluation() as {
      claim_results: Array<{ status: string; gap: string | null }>;
    };
    const firstClaim = raw.claim_results[0];
    if (firstClaim === undefined) throw new Error('test fixture missing first claim');
    firstClaim.status = 'missing';
    firstClaim.gap = 'No command output was captured.';
    const result = GoalEvidenceEvaluation.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('satisfied');
    }
  });

  it('routes missing evidence to recovery instead of completion', () => {
    const raw = {
      schema: 'goal.evidence-evaluation@v1',
      verdict: 'missing-evidence',
      claim_results: [
        {
          claim_id: 'test-fixed',
          status: 'missing',
          evidence: [],
          gap: 'The child flow did not capture the required command output.',
        },
      ],
      next_route: 'retry-selected-flow',
    };
    expect(GoalEvidenceEvaluation.safeParse(raw).success).toBe(true);

    const falseClose = { ...raw, next_route: 'completion-gate' };
    expect(GoalEvidenceEvaluation.safeParse(falseClose).success).toBe(false);
  });

  it('requires two consecutive gate passes before close', () => {
    expect(GoalGate.safeParse(validGate()).success).toBe(true);

    const onePass = validGate() as { clean_streak: number; next_route: string };
    onePass.clean_streak = 1;
    onePass.next_route = 'close';
    const result = GoalGate.safeParse(onePass);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('clean_streak');
    }

    const inflatedStreak = validGate() as {
      clean_streak: number;
      passes: unknown[];
    };
    inflatedStreak.passes = inflatedStreak.passes.slice(0, 1);
    const inflatedResult = GoalGate.safeParse(inflatedStreak);
    expect(inflatedResult.success).toBe(false);
    if (!inflatedResult.success) {
      expect(inflatedResult.error.message).toContain('recorded gate-pass passes');
    }
  });

  it('requires distinct gate attack lenses and keeps clean passes out of recovery', () => {
    const duplicateLens = validGate() as {
      passes: Array<{ attack_lens: string }>;
    };
    const secondPass = duplicateLens.passes[1];
    if (secondPass === undefined) throw new Error('test fixture missing second gate pass');
    secondPass.attack_lens = 'contract-and-proof';
    const duplicateResult = GoalGate.safeParse(duplicateLens);
    expect(duplicateResult.success).toBe(false);
    if (!duplicateResult.success) {
      expect(duplicateResult.error.message).toContain('distinct attack lenses');
    }

    const cleanRecovery = { ...(validGate() as Record<string, unknown>), next_route: 'recover' };
    const cleanRecoveryResult = GoalGate.safeParse(cleanRecovery);
    expect(cleanRecoveryResult.success).toBe(false);
    if (!cleanRecoveryResult.success) {
      expect(cleanRecoveryResult.error.message).toContain('must not route to recover');
    }
  });

  it('resets the gate streak on medium-or-above findings', () => {
    const raw = {
      ...(validGate() as Record<string, unknown>),
      verdict: 'blocked',
      clean_streak: 1,
      blocking_findings: [
        {
          severity: 'medium',
          text: 'The evidence packet claims a command passed but does not link output.',
          refs: ['reports/goal/evidence-evaluation.json'],
          recovery_route: 'checkpoint',
        },
      ],
      next_route: 'recover',
    };
    const result = GoalGate.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('resets clean_streak');
    }

    expect(GoalGate.safeParse({ ...raw, clean_streak: 0 }).success).toBe(true);
  });

  it('rejects false complete goal results', () => {
    expect(GoalResult.safeParse(validResult()).success).toBe(true);

    const weakClaims = validResult() as { missing_or_weak_claims: string[] };
    weakClaims.missing_or_weak_claims = ['The rerun command was not captured.'];
    expect(GoalResult.safeParse(weakClaims).success).toBe(false);

    const weakGate = validResult() as { gate: { clean_streak: number; final_verdict: string } };
    weakGate.gate.clean_streak = 1;
    expect(GoalResult.safeParse(weakGate).success).toBe(false);

    const blockedGate = validResult() as { gate: { final_verdict: string } };
    blockedGate.gate.final_verdict = 'blocked';
    expect(GoalResult.safeParse(blockedGate).success).toBe(false);
  });

  it('validates result evidence link schemas against their report ids', () => {
    const raw = validResult() as {
      evidence_links: Array<{ report_id: string; schema: string }>;
    };
    const firstLink = raw.evidence_links[0];
    if (firstLink === undefined) throw new Error('test fixture missing first evidence link');
    firstLink.schema = 'goal.gate@v1';
    const result = GoalResult.safeParse(raw);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("schema must be 'goal.contract@v1'");
    }
  });
});
