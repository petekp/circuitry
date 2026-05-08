// Defect taxonomy: each defect is a function from a real compose.json
// to a mutated compose.json with a known, planted error. The reviewer
// step should object to the defect or surface it as a missed angle.
//
// Defects are designed to break properties the reviewer is supposed to
// guard:
//   - evidence groundedness (fabricated-evidence-ref)
//   - success-condition justification (stripped-success-condition-alignment)
//   - subject fidelity (wrong-subject)
//   - epistemic calibration (added-false-certainty)
//   - internal consistency (internal-contradiction)
//
// Why added-false-certainty replaced the older removed-uncertainty mutator
// (2026-05-08): the strip-hedge mutator skipped composes whose original
// recommendation already lacked hedge language (4/8 of our captured
// composes), giving us tiny-n results. Adding a confident overclaim
// applies uniformly to every compose and produces stable per-defect
// catch rates regardless of the source compose's house style.

import type { ComposeJsonShape, DefectId, DefectPlantResult } from './types.ts';

const FABRICATED_REF = 'reports/nonexistent-fabricated-citation.json';

export const DEFECT_DESCRIPTIONS: Record<DefectId, string> = {
  'fabricated-evidence-ref':
    'Replace one evidence_ref in supporting_aspects with a fabricated path that does not exist.',
  'stripped-success-condition-alignment':
    'Replace success_condition_alignment with a vacuous one-liner that does not justify alignment.',
  'wrong-subject': 'Append an unrelated topic to the subject so it no longer matches the brief.',
  'added-false-certainty':
    'Append a confident overclaim sentence ("no remaining risks…requires no further validation") that the cited evidence does not support.',
  'internal-contradiction':
    'Append a sentence to the recommendation that contradicts the stated direction.',
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function plantFabricatedEvidenceRef(compose: ComposeJsonShape): DefectPlantResult {
  const mutated = deepClone(compose);
  // Find the first aspect with an evidence_refs array containing at
  // least one entry. Some captured composes have a leading aspect with
  // no evidence_refs (malformed model output that still parsed); fall
  // through to the next aspect rather than crashing on `.length` of
  // undefined.
  const targetAspect = mutated.supporting_aspects.find(
    (a): a is ComposeJsonShape['supporting_aspects'][number] =>
      Array.isArray(a?.evidence_refs) && a.evidence_refs.length > 0,
  );
  if (targetAspect === undefined) {
    throw new Error('cannot plant fabricated-evidence-ref: no aspect has evidence_refs');
  }
  const [originalRef] = targetAspect.evidence_refs;
  if (originalRef === undefined) {
    throw new Error('cannot plant fabricated-evidence-ref: no evidence ref found');
  }
  targetAspect.evidence_refs[0] = FABRICATED_REF;
  return {
    id: 'fabricated-evidence-ref',
    description: DEFECT_DESCRIPTIONS['fabricated-evidence-ref'],
    mutated,
    mutation_summary: `supporting_aspects[?].evidence_refs[0] '${originalRef}' -> '${FABRICATED_REF}'`,
  };
}

function plantStrippedSuccessConditionAlignment(compose: ComposeJsonShape): DefectPlantResult {
  const mutated = deepClone(compose);
  const original = mutated.success_condition_alignment;
  mutated.success_condition_alignment = 'This satisfies the brief.';
  return {
    id: 'stripped-success-condition-alignment',
    description: DEFECT_DESCRIPTIONS['stripped-success-condition-alignment'],
    mutated,
    mutation_summary: `success_condition_alignment shortened from ${original.length} chars to vacuous one-liner`,
  };
}

function plantWrongSubject(compose: ComposeJsonShape): DefectPlantResult {
  const mutated = deepClone(compose);
  const original = mutated.subject;
  mutated.subject = `${original} [PLUS A SECOND TOPIC: regulatory implications of quantum cryptography for retail banking compliance]`;
  return {
    id: 'wrong-subject',
    description: DEFECT_DESCRIPTIONS['wrong-subject'],
    mutated,
    mutation_summary:
      'appended unrelated quantum-cryptography retail-banking subject to original subject',
  };
}

const FALSE_CERTAINTY_SUFFIX =
  ' Crucially, there are no remaining risks, edge cases, or open questions; the cited evidence is fully conclusive and this recommendation requires no further validation, testing, or operator review before implementation.';

function plantAddedFalseCertainty(compose: ComposeJsonShape): DefectPlantResult {
  const mutated = deepClone(compose);
  const original = mutated.recommendation;
  mutated.recommendation = `${original}${FALSE_CERTAINTY_SUFFIX}`;
  return {
    id: 'added-false-certainty',
    description: DEFECT_DESCRIPTIONS['added-false-certainty'],
    mutated,
    mutation_summary:
      'appended confident overclaim asserting no remaining risks/open questions and no need for further validation',
  };
}

const CONTRADICTION_SUFFIX =
  ' On reflection, none of these recommendations actually apply here and the operator should ignore the analysis above.';

function plantInternalContradiction(compose: ComposeJsonShape): DefectPlantResult {
  const mutated = deepClone(compose);
  const original = mutated.recommendation;
  mutated.recommendation = `${original}${CONTRADICTION_SUFFIX}`;
  return {
    id: 'internal-contradiction',
    description: DEFECT_DESCRIPTIONS['internal-contradiction'],
    mutated,
    mutation_summary: 'appended self-negating sentence to recommendation',
  };
}

export const DEFECT_PLANTERS: Record<DefectId, (compose: ComposeJsonShape) => DefectPlantResult> = {
  'fabricated-evidence-ref': plantFabricatedEvidenceRef,
  'stripped-success-condition-alignment': plantStrippedSuccessConditionAlignment,
  'wrong-subject': plantWrongSubject,
  'added-false-certainty': plantAddedFalseCertainty,
  'internal-contradiction': plantInternalContradiction,
};

export const DEFECT_IDS: readonly DefectId[] = [
  'fabricated-evidence-ref',
  'stripped-success-condition-alignment',
  'wrong-subject',
  'added-false-certainty',
  'internal-contradiction',
];
