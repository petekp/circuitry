import { z } from 'zod';

const NonEmptyStringArray = z.array(z.string().min(1)).min(1);

export const GoalFlowTarget = z.enum(['fix', 'build', 'review', 'explore', 'pursue']);
export type GoalFlowTarget = z.infer<typeof GoalFlowTarget>;

export const GoalRequiredEvidenceKind = z.enum([
  'command',
  'report',
  'review',
  'source',
  'checkpoint',
]);
export type GoalRequiredEvidenceKind = z.infer<typeof GoalRequiredEvidenceKind>;

export const GoalRecoveryRoute = z.enum([
  'retry-selected-flow',
  'run-fix',
  'run-review',
  'run-explore',
  'split-to-pursue',
  'checkpoint',
  'handoff',
  'blocked',
]);
export type GoalRecoveryRoute = z.infer<typeof GoalRecoveryRoute>;

export const GoalEvaluationRoute = z.enum(['completion-gate', ...GoalRecoveryRoute.options]);
export type GoalEvaluationRoute = z.infer<typeof GoalEvaluationRoute>;

export const GoalBlockingSeverity = z.enum(['critical', 'high', 'medium']);
export type GoalBlockingSeverity = z.infer<typeof GoalBlockingSeverity>;

export const GoalGateRecoveryRoute = z.enum([
  'retry-selected-flow',
  'run-fix',
  'run-review',
  'run-explore',
  'split-to-pursue',
  'checkpoint',
  'blocked',
]);
export type GoalGateRecoveryRoute = z.infer<typeof GoalGateRecoveryRoute>;

const REQUIRED_GATE_PASSES = 2;

const GoalRequiredEvidence = z
  .object({
    kind: GoalRequiredEvidenceKind,
    description: z.string().min(1),
    required: z.boolean(),
  })
  .strict();
export type GoalRequiredEvidence = z.infer<typeof GoalRequiredEvidence>;

const GoalDoneClaim = z
  .object({
    id: z.string().min(1),
    claim: z.string().min(1),
    required_evidence: z.array(GoalRequiredEvidence).min(1),
  })
  .strict()
  .superRefine((claim, ctx) => {
    if (!claim.required_evidence.some((entry) => entry.required)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['required_evidence'],
        message: 'each done_when item must include at least one required evidence entry',
      });
    }
  });
export type GoalDoneClaim = z.infer<typeof GoalDoneClaim>;

export const GoalContract = z
  .object({
    schema: z.literal('goal.contract@v1'),
    objective: z.string().min(1),
    source_of_truth: z.literal('circuit-run-folder'),
    scope: z
      .object({
        in: z.array(z.string().min(1)),
        out: z.array(z.string().min(1)),
        assumptions: z.array(z.string().min(1)),
      })
      .strict(),
    constraints: z.array(z.string().min(1)),
    done_when: z.array(GoalDoneClaim).min(1),
    allowed_flow_targets: z.array(GoalFlowTarget).min(1),
    selected_flow_target: GoalFlowTarget,
    recovery_policy: z
      .object({
        max_attempts: z.number().int().positive().max(10),
        routes: z.array(GoalRecoveryRoute).min(1),
      })
      .strict(),
    check_in_triggers: NonEmptyStringArray,
    stop_conditions: z.array(z.string().min(1)),
    completion_gate: z
      .object({
        required_passes: z.literal(REQUIRED_GATE_PASSES),
        blocking_severities: z.array(GoalBlockingSeverity).min(1),
        reset_on_blocking_finding: z.literal(true),
      })
      .strict(),
  })
  .strict()
  .superRefine((contract, ctx) => {
    if (!contract.allowed_flow_targets.includes(contract.selected_flow_target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selected_flow_target'],
        message: 'selected_flow_target must be present in allowed_flow_targets',
      });
    }
  });
export type GoalContract = z.infer<typeof GoalContract>;

export const GoalAttempt = z
  .object({
    schema: z.literal('goal.attempt@v1'),
    attempt_id: z.string().min(1),
    flow_target: GoalFlowTarget,
    child_result_path: z.string().min(1),
    child_report_paths: z.array(z.string().min(1)),
    outcome: z.enum(['complete', 'needs_attention', 'blocked', 'failed', 'handoff']),
    summary: z.string().min(1),
  })
  .strict();
export type GoalAttempt = z.infer<typeof GoalAttempt>;

export const GoalClaimResult = z
  .object({
    claim_id: z.string().min(1),
    status: z.enum(['proved', 'missing', 'contradicted', 'blocked']),
    evidence: z.array(z.string().min(1)),
    gap: z.string().min(1).nullable(),
  })
  .strict();
export type GoalClaimResult = z.infer<typeof GoalClaimResult>;

export const GoalEvidenceEvaluation = z
  .object({
    schema: z.literal('goal.evidence-evaluation@v1'),
    verdict: z.enum(['satisfied', 'missing-evidence', 'contradicted', 'blocked']),
    claim_results: z.array(GoalClaimResult).min(1),
    next_route: GoalEvaluationRoute,
  })
  .strict()
  .superRefine((evaluation, ctx) => {
    const allProved = evaluation.claim_results.every((claim) => claim.status === 'proved');
    if (evaluation.verdict === 'satisfied' && !allProved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['claim_results'],
        message: "verdict 'satisfied' requires every claim result to be proved",
      });
    }
    if (evaluation.next_route === 'completion-gate' && evaluation.verdict !== 'satisfied') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: "next_route 'completion-gate' is allowed only when verdict is satisfied",
      });
    }
    if (evaluation.verdict === 'satisfied' && evaluation.next_route !== 'completion-gate') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: "verdict 'satisfied' must route to completion-gate",
      });
    }
    if (evaluation.verdict === 'missing-evidence') {
      const hasGap = evaluation.claim_results.some(
        (claim) => claim.status === 'missing' && claim.gap !== null,
      );
      if (!hasGap) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claim_results'],
          message: 'missing-evidence must name at least one missing claim gap',
        });
      }
    }
    if (
      (evaluation.verdict === 'contradicted' || evaluation.verdict === 'blocked') &&
      evaluation.next_route === 'completion-gate'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: `${evaluation.verdict} must not route directly to completion-gate`,
      });
    }
  });
export type GoalEvidenceEvaluation = z.infer<typeof GoalEvidenceEvaluation>;

export const GoalRecovery = z
  .object({
    schema: z.literal('goal.recovery@v1'),
    reason: z.enum([
      'missing-evidence',
      'verification-failed',
      'review-blocked',
      'scope-drift',
      'child-blocked',
      'attempt-limit',
    ]),
    selected_route: GoalRecoveryRoute,
    rationale: z.string().min(1),
    attempt_count: z.number().int().nonnegative(),
    operator_input_required: z.boolean(),
  })
  .strict();
export type GoalRecovery = z.infer<typeof GoalRecovery>;

export const GoalGateFinding = z
  .object({
    severity: GoalBlockingSeverity,
    text: z.string().min(1),
    refs: z.array(z.string().min(1)),
    recovery_route: GoalGateRecoveryRoute,
  })
  .strict();
export type GoalGateFinding = z.infer<typeof GoalGateFinding>;

export const GoalGateLowFinding = z
  .object({
    text: z.string().min(1),
    refs: z.array(z.string().min(1)),
  })
  .strict();
export type GoalGateLowFinding = z.infer<typeof GoalGateLowFinding>;

export const GoalGatePass = z
  .object({
    pass_id: z.string().min(1),
    attack_lens: z.enum([
      'contract-and-proof',
      'false-done-and-recovery',
      'scope-and-host-boundary',
    ]),
    evidence_checked: NonEmptyStringArray,
    verdict: z.enum(['gate-pass', 'blocked']),
  })
  .strict();
export type GoalGatePass = z.infer<typeof GoalGatePass>;

export const GoalGate = z
  .object({
    schema: z.literal('goal.gate@v1'),
    verdict: z.enum(['gate-pass', 'blocked']),
    clean_streak: z.number().int().nonnegative(),
    required_passes: z.literal(REQUIRED_GATE_PASSES),
    blocking_findings: z.array(GoalGateFinding),
    low_findings: z.array(GoalGateLowFinding),
    passes: z.array(GoalGatePass).min(1),
    next_route: z.enum(['run-next-gate-pass', 'recover', 'close']),
  })
  .strict()
  .superRefine((gate, ctx) => {
    const attackLenses = new Set<string>();
    const cleanPassCount = gate.passes.filter((pass) => pass.verdict === 'gate-pass').length;
    for (const [index, pass] of gate.passes.entries()) {
      if (attackLenses.has(pass.attack_lens)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['passes', index, 'attack_lens'],
          message: 'gate passes in the same report must use distinct attack lenses',
        });
      }
      attackLenses.add(pass.attack_lens);
    }
    if (gate.clean_streak > cleanPassCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clean_streak'],
        message: 'clean_streak must not exceed the number of recorded gate-pass passes',
      });
    }
    if (gate.blocking_findings.length > 0 && gate.clean_streak !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clean_streak'],
        message: 'any blocking finding resets clean_streak to 0',
      });
    }
    if (gate.verdict === 'gate-pass' && gate.blocking_findings.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocking_findings'],
        message: 'gate-pass requires no blocking findings',
      });
    }
    if (gate.verdict === 'blocked' && gate.blocking_findings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['blocking_findings'],
        message: 'blocked requires at least one blocking finding',
      });
    }
    if (gate.verdict === 'blocked' && gate.next_route !== 'recover') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: "blocked gate verdict must route to 'recover'",
      });
    }
    if (gate.verdict === 'gate-pass' && gate.next_route === 'recover') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: 'gate-pass must not route to recover',
      });
    }
    if (gate.next_route === 'close' && gate.clean_streak < gate.required_passes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clean_streak'],
        message: 'close requires clean_streak >= required_passes',
      });
    }
    if (gate.next_route === 'close' && cleanPassCount < gate.required_passes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['passes'],
        message: 'close requires recorded gate-pass passes to meet required_passes',
      });
    }
    if (gate.next_route === 'close' && gate.verdict !== 'gate-pass') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verdict'],
        message: "close requires final gate verdict 'gate-pass'",
      });
    }
    if (gate.next_route === 'run-next-gate-pass' && gate.verdict !== 'gate-pass') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: 'run-next-gate-pass requires a gate-pass verdict',
      });
    }
    if (gate.next_route === 'run-next-gate-pass' && gate.clean_streak >= gate.required_passes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['next_route'],
        message: 'run-next-gate-pass is allowed only before the required pass streak is met',
      });
    }
  });
export type GoalGate = z.infer<typeof GoalGate>;

export const GoalResultReportId = z.enum([
  'goal.contract',
  'goal.attempt',
  'goal.evidence-evaluation',
  'goal.recovery',
  'goal.gate',
]);
export type GoalResultReportId = z.infer<typeof GoalResultReportId>;

const GOAL_RESULT_SCHEMA_BY_REPORT_ID = {
  'goal.contract': 'goal.contract@v1',
  'goal.attempt': 'goal.attempt@v1',
  'goal.evidence-evaluation': 'goal.evidence-evaluation@v1',
  'goal.recovery': 'goal.recovery@v1',
  'goal.gate': 'goal.gate@v1',
} as const satisfies Record<GoalResultReportId, string>;

export const GoalResultEvidenceLink = z
  .object({
    report_id: GoalResultReportId,
    path: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict()
  .superRefine((link, ctx) => {
    const expected = GOAL_RESULT_SCHEMA_BY_REPORT_ID[link.report_id];
    if (link.schema !== expected) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schema'],
        message: `schema must be '${expected}' for report_id '${link.report_id}'`,
      });
    }
  });
export type GoalResultEvidenceLink = z.infer<typeof GoalResultEvidenceLink>;

export const GoalResult = z
  .object({
    schema: z.literal('goal.result@v1'),
    outcome: z.enum(['complete', 'needs_attention', 'blocked', 'failed', 'handoff']),
    summary: z.string().min(1),
    proven_claims: z.array(z.string().min(1)),
    missing_or_weak_claims: z.array(z.string().min(1)),
    recovery_history: z.array(z.string().min(1)),
    residual_risks: z.array(z.string().min(1)),
    rerun_commands: z.array(z.string().min(1)),
    evidence_links: z.array(GoalResultEvidenceLink).min(1),
    gate: z
      .object({
        clean_streak: z.number().int().nonnegative(),
        required_passes: z.literal(REQUIRED_GATE_PASSES),
        final_verdict: z.enum(['gate-pass', 'blocked']),
      })
      .strict(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.outcome === 'complete') {
      if (result.missing_or_weak_claims.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['missing_or_weak_claims'],
          message: 'complete requires no missing or weak claims',
        });
      }
      if (result.gate.clean_streak < result.gate.required_passes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gate', 'clean_streak'],
          message: 'complete requires gate.clean_streak >= 2',
        });
      }
      if (result.gate.final_verdict !== 'gate-pass') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gate', 'final_verdict'],
          message: "complete requires final gate verdict 'gate-pass'",
        });
      }
    }
    if (['blocked', 'failed', 'handoff'].includes(result.outcome)) {
      const hasUsefulAction =
        result.summary.toLowerCase().includes(result.outcome) || result.rerun_commands.length > 0;
      if (!hasUsefulAction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['summary'],
          message: `${result.outcome} must include a reason or next useful operator action`,
        });
      }
    }
  });
export type GoalResult = z.infer<typeof GoalResult>;
