import type { RunGoalContract } from '../schemas/run-envelope.js';

// S3: lock the proof contract authored at intake. An autonomous continuation loop
// (S7) must not be able to weaken its own done_when between attempts to declare
// victory. These pure functions compare an intake snapshot against the current
// contract and report any weakening. The loop consumes the decision: a weakened
// contract routes to a checkpoint instead of silently continuing.
//
// Reordering required evidence is intentionally NOT treated as weakening: with a
// single claim the order carries no proof strength, and entries are matched by
// (kind, description) rather than position. Strengthening (adding entries or
// making them required) is likewise allowed.

export type ContractWeakeningKind = 'claim-removed' | 'evidence-removed' | 'requirement-relaxed';

export type ContractWeakening = {
  readonly kind: ContractWeakeningKind;
  readonly claim_id: string;
  readonly detail: string;
};

export type ContractLockDecision = {
  readonly weakened: boolean;
  readonly weakenings: readonly ContractWeakening[];
  readonly route: 'continue' | 'checkpoint';
};

type RunDoneClaim = RunGoalContract['done_when'][number];
type RunRequiredEvidence = RunDoneClaim['required_evidence'][number];

function evidenceKey(entry: RunRequiredEvidence): string {
  return `${entry.kind}::${entry.description}`;
}

export function detectContractWeakening(
  intake: RunGoalContract,
  current: RunGoalContract,
): ContractWeakening[] {
  const weakenings: ContractWeakening[] = [];
  const currentClaims = new Map(current.done_when.map((claim) => [claim.id, claim]));

  for (const intakeClaim of intake.done_when) {
    const currentClaim = currentClaims.get(intakeClaim.id);
    if (currentClaim === undefined) {
      weakenings.push({
        kind: 'claim-removed',
        claim_id: intakeClaim.id,
        detail: `Claim "${intakeClaim.id}" present at intake is missing from the current contract.`,
      });
      continue;
    }
    const currentByKey = new Map(
      currentClaim.required_evidence.map((entry) => [evidenceKey(entry), entry]),
    );
    for (const intakeEntry of intakeClaim.required_evidence) {
      const match = currentByKey.get(evidenceKey(intakeEntry));
      if (match === undefined) {
        weakenings.push({
          kind: 'evidence-removed',
          claim_id: intakeClaim.id,
          detail: `Required evidence "${intakeEntry.description}" (${intakeEntry.kind}) was removed after intake.`,
        });
        continue;
      }
      if (intakeEntry.required && !match.required) {
        weakenings.push({
          kind: 'requirement-relaxed',
          claim_id: intakeClaim.id,
          detail: `Required evidence "${intakeEntry.description}" was relaxed from required to optional after intake.`,
        });
      }
    }
  }

  return weakenings;
}

export function contractLockDecision(
  intake: RunGoalContract,
  current: RunGoalContract,
): ContractLockDecision {
  const weakenings = detectContractWeakening(intake, current);
  const weakened = weakenings.length > 0;
  return { weakened, weakenings, route: weakened ? 'checkpoint' : 'continue' };
}
