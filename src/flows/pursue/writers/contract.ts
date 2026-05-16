import { requireResolvedVerificationCommands } from '../../../shared/verification-resolver.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { PursuitContract, type PursuitTouchSet } from '../reports.js';

const DEFAULT_CHECK_IN_TRIGGERS = [
  'The work requires a product or design decision that is not implied by the goal.',
  'The likely change crosses a high-risk boundary or irreversible operation.',
  'The requested proof cannot be discovered from the project.',
  'The implementation would require parallel code writes, which Pursuits V1 blocks.',
];

function slugFor(index: number): string {
  return `pursuit-${index + 1}`;
}

function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, '').trim();
}

function splitPursuits(goal: string): string[] {
  const lines = goal
    .split(/\r?\n/)
    .map((line) => stripListMarker(line))
    .filter((line) => line.length > 0);
  if (lines.length > 1) return lines;

  const semicolonParts = goal
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return semicolonParts.length > 1 ? semicolonParts : [goal.trim()];
}

function estimatedTouchSet(text: string): PursuitTouchSet {
  const pathMatches = text.match(
    /(?:[\w.-]+\/)+[\w.-]+\.(?:ts|tsx|js|jsx|json|md|mjs|cjs|css|html|yml|yaml)/g,
  );
  const commandMatches = text.match(/\bnpm run [a-z0-9:-]+\b/gi);
  const generatedOutputs = (pathMatches ?? []).filter(
    (path) =>
      path.startsWith('generated/') ||
      path.startsWith('plugins/') ||
      path.includes('/generated/') ||
      path.includes('/plugins/'),
  );
  return {
    paths: [...new Set(pathMatches ?? [])],
    symbols: [],
    commands: [...new Set(commandMatches ?? [])],
    generated_outputs: [...new Set(generatedOutputs)],
  };
}

function riskFor(touchSet: PursuitTouchSet, text: string): 'low' | 'medium' | 'high' {
  if (touchSet.generated_outputs.length > 0) return 'high';
  if (/\b(migrate|rewrite|schema|runtime|auth|security|delete|remove)\b/i.test(text)) {
    return 'high';
  }
  if (
    touchSet.paths.length > 1 ||
    /\b(refactor|integration|flow|route|verification)\b/i.test(text)
  ) {
    return 'medium';
  }
  return 'low';
}

export const pursuitContractComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'pursuit.contract@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal.trim();
    const verificationCommands = requireResolvedVerificationCommands({
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      goal,
      requestedNeeds: ['general'],
      commandIdPrefix: 'pursuit',
      timeoutMs: 120_000,
      maxOutputBytes: 200_000,
    });

    const pursuits = splitPursuits(goal).map((item, index) => {
      const touchSet = estimatedTouchSet(item);
      return {
        id: slugFor(index),
        title: item.length > 80 ? `${item.slice(0, 77)}...` : item,
        goal: item,
        scope: item,
        assumptions: [
          'Circuit may gather context and execute engineering work inside the declared scope.',
          'Code-changing work is serialized in Pursuits V1 even when discovery can run in parallel.',
        ],
        estimated_touch_set: touchSet,
        proof_plan: [
          'Use project-discovered verification commands rather than assuming a fixed script exists.',
          'Record actual files and evidence after the implementation batch runs.',
        ],
        check_in_triggers: DEFAULT_CHECK_IN_TRIGGERS,
        rollback_notes: [
          'Stop and report rather than apply parallel writes.',
          'Use the final actual touch set and git diff to recover any partial change.',
        ],
        risk: riskFor(touchSet, item),
      };
    });

    return PursuitContract.parse({
      objective: goal,
      pursuits,
      execution_policy: {
        code_writes: 'serial-only',
        read_only_parallelism: 'allowed',
        parallel_write_status: 'blocked-until-safe-apply',
      },
      verification_command_candidates: verificationCommands,
    });
  },
};
