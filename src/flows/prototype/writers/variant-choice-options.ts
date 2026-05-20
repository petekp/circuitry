import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import {
  PrototypeVariantAggregate,
  PrototypeVariantChoiceOptions,
  PrototypeVariantProviderEvidence,
  PrototypeVariantReview,
  PrototypeVariantVerification,
} from '../reports.js';

export const prototypeVariantChoiceOptionsComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'prototype.variant-choice-options@v1',
  reads: [
    { name: 'aggregate', schema: 'prototype.variant-aggregate@v1', required: true },
    { name: 'providerEvidence', schema: 'prototype.variant-provider-evidence@v1', required: true },
    { name: 'verification', schema: 'prototype.variant-verification@v1', required: true },
    { name: 'review', schema: 'prototype.variant-review@v1', required: true },
  ],
  build(context: ComposeBuildContext): unknown {
    const aggregate = PrototypeVariantAggregate.parse(context.inputs.aggregate);
    const providerEvidence = PrototypeVariantProviderEvidence.parse(
      context.inputs.providerEvidence,
    );
    const verification = PrototypeVariantVerification.parse(context.inputs.verification);
    const review = PrototypeVariantReview.parse(context.inputs.review);
    const verified = new Set(
      verification.variant_results
        .filter((result) => result.status === 'passed')
        .map((result) => result.variant_id),
    );
    const providerBacked = new Set(
      providerEvidence.variants
        .filter((variant) => variant.status === 'captured')
        .map((variant) => variant.variant_id),
    );
    const branches = aggregate.branches.filter(
      (branch) =>
        branch.child_outcome === 'complete' &&
        branch.admitted &&
        branch.result_body !== undefined &&
        verified.has(branch.branch_id) &&
        providerBacked.has(branch.branch_id),
    );
    if (branches.length < 2) {
      throw new Error(
        `prototype.variant-choice-options@v1 requires at least two verified provider-evidence-backed variants; found ${branches.length}`,
      );
    }
    const recommendedBranch =
      branches.find((branch) => branch.branch_id === review.recommended_variant_id) ?? branches[0];
    if (recommendedBranch === undefined) {
      throw new Error('prototype.variant-choice-options@v1 could not choose a recommended variant');
    }
    return PrototypeVariantChoiceOptions.parse({
      schema_version: 1,
      prompt:
        'Choose which local prototype variant Circuit should keep as the Prototype result. This does not run Build or claim deployment.',
      recommended_variant_id: recommendedBranch.branch_id,
      choices: branches.map((branch) => {
        const body = branch.result_body;
        if (body === undefined) {
          throw new Error(
            `prototype.variant-choice-options@v1 branch '${branch.branch_id}' has no result_body`,
          );
        }
        return {
          id: branch.branch_id,
          variant_id: branch.branch_id,
          label: body.variant_label,
          description: body.summary,
          variant_root: body.variant_root,
          entry_points: body.entry_points,
          verification_status: 'passed',
          model_evidence_status: 'captured',
          review_recommendation: branch.branch_id === review.recommended_variant_id,
          recommended: branch.branch_id === recommendedBranch.branch_id,
        };
      }),
    });
  },
};
