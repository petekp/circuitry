import type { RunGoalContract, RunRequiredEvidenceKind } from '../schemas/run-envelope.js';

// S4: contract-quality gate lens. Where the other gate passes check evidence
// against the contract, this lens attacks the contract itself: is the required
// evidence strong enough that satisfying it actually proves the objective? It
// catches the self-grading failure mode where a contract is weak enough to pass
// even though the work is not really done (for example, an implementation
// objective whose only required proof is that a report exists).

export type ObjectiveKind = 'implementation' | 'review' | 'explore' | 'other';

const IMPLEMENTATION_INTENT =
  /\b(build|fix|implement|add|change|create|refactor|ship|integrate|update|wire)\b/;
const REVIEW_INTENT = /\b(review|audit|assess|inspect|findings?)\b/;
const EXPLORE_INTENT = /\b(explore|compare|decide|decision|tradeoffs?|options?)\b/;

export function objectiveKind(objective: string): ObjectiveKind {
  const text = objective.toLowerCase();
  if (IMPLEMENTATION_INTENT.test(text)) return 'implementation';
  if (REVIEW_INTENT.test(text)) return 'review';
  if (EXPLORE_INTENT.test(text)) return 'explore';
  return 'other';
}

// Minimum required evidence kind an objective of a given kind must demand before
// Run may close it complete. Objectives without an entry impose no minimum.
const MIN_REQUIRED_KIND_BY_OBJECTIVE: Partial<Record<ObjectiveKind, RunRequiredEvidenceKind>> = {
  implementation: 'command',
  review: 'review',
};

export type ContractQualitySeverity = 'critical' | 'high' | 'medium' | 'low';

export type ContractQualityFinding = {
  readonly severity: ContractQualitySeverity;
  readonly text: string;
};

export type ContractQualityReview = {
  readonly verdict: 'gate-pass' | 'blocked';
  readonly attack_lens: 'contract-quality';
  readonly findings: readonly ContractQualityFinding[];
};

function hasRequiredEvidenceOfKind(
  contract: RunGoalContract,
  kind: RunRequiredEvidenceKind,
): boolean {
  return contract.done_when.some((claim) =>
    claim.required_evidence.some((entry) => entry.required && entry.kind === kind),
  );
}

export function contractQualityReview(contract: RunGoalContract): ContractQualityReview {
  const findings: ContractQualityFinding[] = [];
  const kind = objectiveKind(contract.objective);
  const minKind = MIN_REQUIRED_KIND_BY_OBJECTIVE[kind];

  if (minKind !== undefined && !hasRequiredEvidenceOfKind(contract, minKind)) {
    findings.push({
      severity: 'high',
      text: `A ${kind} objective needs at least one required '${minKind}' evidence entry, but the contract has none. Satisfying this contract would not prove the objective.`,
    });
  }

  const blocking = findings.some(
    (finding) =>
      finding.severity === 'critical' ||
      finding.severity === 'high' ||
      finding.severity === 'medium',
  );
  return {
    verdict: blocking ? 'blocked' : 'gate-pass',
    attack_lens: 'contract-quality',
    findings,
  };
}
