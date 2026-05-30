import type { SpinePolicy } from '../schemas/stage.js';
import type {
  FlowDefinitionCanonicalStagePolicy,
  FlowDefinitionCanonicalStagePolicyVariant,
} from './flow-definition.js';

type EnforcedCanonicalStagePolicy = Extract<
  FlowDefinitionCanonicalStagePolicy,
  { readonly kind: 'enforce' }
>;

type PartialStagePathPolicy = Extract<SpinePolicy, { readonly mode: 'partial' }>;

export interface EnforcedStagePolicyInput
  extends Omit<
    EnforcedCanonicalStagePolicy,
    'kind' | 'canonicals' | 'omits' | 'optional_canonicals' | 'variants'
  > {
  readonly canonicals: PartialStagePathPolicy['omits'];
  readonly omits: PartialStagePathPolicy['omits'];
  readonly optional_canonicals?: PartialStagePathPolicy['omits'];
  readonly variants?: readonly FlowDefinitionCanonicalStagePolicyVariant[];
  readonly rationale: string;
}

export interface EnforcedStagePolicyDeclaration {
  readonly stagePathPolicy: PartialStagePathPolicy;
  readonly canonicalStagePolicy: EnforcedCanonicalStagePolicy;
}

export function defineEnforcedStagePolicy(
  input: EnforcedStagePolicyInput,
): EnforcedStagePolicyDeclaration {
  const canonicals = [...input.canonicals];
  const omits = [...input.omits];
  const optionalCanonicals = [...(input.optional_canonicals ?? [])];
  const variants = (input.variants ?? []).map((variant) => ({
    ...variant,
    canonicals: [...variant.canonicals],
    omits: [...variant.omits],
  }));

  return {
    stagePathPolicy: {
      mode: 'partial',
      omits,
      rationale: input.rationale,
    },
    canonicalStagePolicy: {
      kind: 'enforce',
      canonicals,
      omits,
      optional_canonicals: optionalCanonicals,
      variants,
      title: input.title,
      authority: input.authority,
    },
  };
}
