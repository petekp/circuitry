import {
  PrototypeArtifact,
  PrototypeBrief,
  type PrototypeCheckpointSelection,
  PrototypePlan,
  PrototypeVariantAggregate,
  PrototypeVariantChoiceOptions,
  PrototypeVariantProviderEvidence,
  PrototypeVariantReview,
  PrototypeVariantVerification,
  PrototypeVerification,
} from '../../flows/prototype/reports.js';
import { type Intent, card, chip, verdictBanner } from './components.js';
import { MAX_BULLET_LEN, MAX_PROMPT_LEN, escapeHtml, renderPage, truncate } from './page.js';
import type { HtmlProjector, JsonObject } from './projector.js';

const PROTOTYPE_BRIEF_PATH = 'reports/prototype/brief.json';
const PROTOTYPE_PLAN_PATH = 'reports/prototype/plan.json';
const PROTOTYPE_ARTIFACT_PATH = 'reports/prototype/artifact.json';
const PROTOTYPE_VERIFICATION_PATH = 'reports/prototype/verification.json';
const PROTOTYPE_VARIANT_AGGREGATE_PATH = 'reports/prototype/variant-aggregate.json';
const PROTOTYPE_VARIANT_PROVIDER_EVIDENCE_PATH = 'reports/prototype/variant-provider-evidence.json';
const PROTOTYPE_VARIANT_VERIFICATION_PATH = 'reports/prototype/variant-verification.json';
const PROTOTYPE_VARIANT_REVIEW_PATH = 'reports/prototype/variant-review.json';
const PROTOTYPE_VARIANT_CHOICES_PATH = 'reports/prototype/variant-choice-options.json';

type ChoiceCard = {
  readonly id: PrototypeCheckpointSelection;
  readonly label: string;
  readonly description: string;
  readonly intent: Intent;
};

const CHOICES: readonly ChoiceCard[] = [
  {
    id: 'keep-prototype',
    label: 'Keep Prototype',
    description: 'Save the prototype as useful evidence and stop here.',
    intent: 'positive',
  },
  {
    id: 'save-build-input',
    label: 'Save Build Input',
    description: 'Close with a Build-ready follow-up prompt, without running Build.',
    intent: 'info',
  },
  {
    id: 'discard-prototype',
    label: 'Discard Prototype',
    description: 'Mark the prototype as discarded while keeping the evidence trail.',
    intent: 'attention',
  },
];

function bulletList(items: readonly string[]): string {
  return `<ul class="tradeoffs">
          ${items.map((item) => `<li>${escapeHtml(truncate(item, MAX_BULLET_LEN))}</li>`).join('\n          ')}
        </ul>`;
}

function commandText(command: { readonly argv: readonly string[]; readonly cwd: string }): string {
  return `${command.cwd}$ ${command.argv.join(' ')}`;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function resumeCommandForChoice(runFolder: string, choiceId: string): string {
  return `circuit resume --run-folder ${shellSingleQuote(
    runFolder,
  )} --checkpoint-choice ${shellSingleQuote(choiceId)}`;
}

function load<T>(
  readJsonRunRelative: (relPath: string) => JsonObject | undefined,
  relPath: string,
  parse: (
    raw: unknown,
  ) => { readonly success: true; readonly data: T } | { readonly success: false },
): T | undefined {
  const parsed = parse(readJsonRunRelative(relPath));
  return parsed.success ? parsed.data : undefined;
}

function renderArtifactCard(artifact: PrototypeArtifact): string {
  const bodyHtml = `      <p class="summary">${escapeHtml(artifact.summary)}</p>
      <div>
        <p class="section-label">Prototype root</p>
        <div class="evidence">${chip(artifact.prototype_root)}</div>
      </div>
      <div>
        <p class="section-label">Entry points</p>
        <div class="evidence">
          ${artifact.entry_points.map((entry) => chip(entry)).join('\n          ')}
        </div>
      </div>
      <div>
        <p class="section-label">Preview</p>
        <p class="summary">${escapeHtml(artifact.preview_instructions)}</p>
      </div>`;
  return card({
    intent: 'positive',
    eyebrow: 'artifact',
    title: 'Prototype files',
    bodyHtml,
  });
}

function renderVerificationCard(verification: PrototypeVerification): string {
  const status = verification.overall_status;
  const bodyHtml = `      <p class="summary">${escapeHtml(
    status === 'passed'
      ? 'Artifact integrity and target checks passed.'
      : 'One or more checks failed.',
  )}</p>
      <div>
        <p class="section-label">Checks</p>
        <div class="evidence">
          ${verification.commands.map((command) => chip(commandText(command))).join('\n          ')}
        </div>
      </div>`;
  return card({
    intent: status === 'passed' ? 'positive' : 'negative',
    eyebrow: status,
    title: 'Verification',
    bodyHtml,
  });
}

function renderRiskCard(artifact: PrototypeArtifact, brief: PrototypeBrief): string {
  const limits = [...brief.claim_limits, ...artifact.claim_limits];
  const bodyHtml = `      <p class="summary">Prototype is local evidence, not a production or deployed result.</p>
      <div>
        <p class="section-label">Known limitations</p>
        ${artifact.known_limitations.length === 0 ? '<p class="summary">No limitations were reported.</p>' : bulletList(artifact.known_limitations)}
      </div>
      <div>
        <p class="section-label">Claim limits</p>
        <div class="evidence">
          ${Array.from(new Set(limits))
            .map((limit) => chip(limit))
            .join('\n          ')}
        </div>
      </div>`;
  return card({
    intent: 'attention',
    eyebrow: 'limits',
    title: 'Read Before Reuse',
    bodyHtml,
  });
}

function renderPlanCard(plan: PrototypePlan): string {
  const bodyHtml = `      <p class="summary">${escapeHtml(plan.preview_instructions)}</p>
      <div>
        <p class="section-label">Planned files</p>
        <div class="evidence">
          ${plan.files_to_create.map((file) => chip(file)).join('\n          ')}
        </div>
      </div>`;
  return card({
    intent: 'neutral',
    eyebrow: 'plan',
    title: 'Artifact Plan',
    bodyHtml,
  });
}

function renderChoice(choice: ChoiceCard, runFolder: string, recommendedId: string): string {
  const isRecommended = choice.id === recommendedId;
  const bodyHtml = `      <p class="summary">${escapeHtml(choice.description)}</p>
      <div class="actions">
        <button class="copy primary" data-prompt="${escapeHtml(
          truncate(resumeCommandForChoice(runFolder, choice.id), MAX_PROMPT_LEN),
        )}">Copy resume command</button>
      </div>`;
  return card({
    intent: isRecommended ? 'positive' : choice.intent,
    eyebrow: choice.id,
    title: choice.label,
    ...(isRecommended ? { badge: { text: 'Recommended', intent: 'positive' as const } } : {}),
    bodyHtml,
  });
}

function filteredChoices(allowedChoices: readonly string[]): ChoiceCard[] {
  const allowed = new Set(allowedChoices);
  return CHOICES.filter((choice) => allowed.has(choice.id));
}

function renderVariantChoice(input: {
  readonly choice: {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly entry_points: readonly string[];
    readonly recommended: boolean;
  };
  readonly aggregate: PrototypeVariantAggregate;
  readonly providerEvidence: PrototypeVariantProviderEvidence;
  readonly runFolder: string;
}): string {
  const branch = input.aggregate.branches.find(
    (candidate) => candidate.branch_id === input.choice.id,
  );
  const artifact = branch?.result_body;
  const evidence = input.providerEvidence.variants.find(
    (candidate) => candidate.variant_id === input.choice.id,
  );
  const providerLine =
    evidence?.status === 'captured'
      ? `${evidence.provider}/${evidence.model} (${evidence.effort})`
      : 'No captured relay selection evidence';
  const bodyHtml = `      <p class="summary">${escapeHtml(input.choice.description)}</p>
      <div>
        <p class="section-label">Entry points</p>
        <div class="evidence">
          ${(artifact?.entry_points ?? input.choice.entry_points).map((entry) => chip(entry)).join('\n          ')}
        </div>
      </div>
      <div>
        <p class="section-label">Captured relay selection</p>
        <p class="summary">${escapeHtml(providerLine)}</p>
      </div>
      <div class="actions">
        <button class="copy primary" data-prompt="${escapeHtml(
          truncate(resumeCommandForChoice(input.runFolder, input.choice.id), MAX_PROMPT_LEN),
        )}">Copy resume command</button>
      </div>`;
  return card({
    intent: input.choice.recommended ? 'positive' : 'neutral',
    eyebrow: input.choice.id,
    title: input.choice.label,
    ...(input.choice.recommended
      ? { badge: { text: 'Recommended', intent: 'positive' as const } }
      : {}),
    bodyHtml,
  });
}

function renderVariantCheckpoint(ctx: Parameters<HtmlProjector>[0]): string | undefined {
  const aggregate = load(ctx.readJsonRunRelative, PROTOTYPE_VARIANT_AGGREGATE_PATH, (raw) =>
    PrototypeVariantAggregate.safeParse(raw),
  );
  const providerEvidence = load(
    ctx.readJsonRunRelative,
    PROTOTYPE_VARIANT_PROVIDER_EVIDENCE_PATH,
    (raw) => PrototypeVariantProviderEvidence.safeParse(raw),
  );
  const verification = load(ctx.readJsonRunRelative, PROTOTYPE_VARIANT_VERIFICATION_PATH, (raw) =>
    PrototypeVariantVerification.safeParse(raw),
  );
  const review = load(ctx.readJsonRunRelative, PROTOTYPE_VARIANT_REVIEW_PATH, (raw) =>
    PrototypeVariantReview.safeParse(raw),
  );
  const choices = load(ctx.readJsonRunRelative, PROTOTYPE_VARIANT_CHOICES_PATH, (raw) =>
    PrototypeVariantChoiceOptions.safeParse(raw),
  );
  if (
    aggregate === undefined ||
    providerEvidence === undefined ||
    verification === undefined ||
    review === undefined ||
    choices === undefined
  ) {
    return undefined;
  }
  const allowed = new Set(ctx.checkpoint?.allowed_choices ?? []);
  const visibleChoices = choices.choices.filter((choice) => allowed.has(choice.id));
  if (visibleChoices.length === 0) return undefined;
  const recommended = choices.choices.find(
    (choice) => choice.id === choices.recommended_variant_id,
  );
  const banner = verdictBanner({
    intent: review.verdict === 'recommend' ? 'positive' : 'attention',
    badgeText: review.verdict === 'recommend' ? 'Recommended variant' : 'Operator choice',
    mainHtml: `<strong>${escapeHtml(recommended?.label ?? choices.recommended_variant_id)}</strong> &mdash; ${escapeHtml(review.comparison_summary)}`,
    aside: `${providerEvidence.captured_count} relay selections captured`,
  });
  const missingEvidenceHtml =
    providerEvidence.missing_evidence.length === 0
      ? ''
      : `<p><strong>Missing evidence.</strong> ${escapeHtml(
          providerEvidence.missing_evidence
            .map((item) => `${item.variant_id}: ${item.reason}`)
            .join('; '),
        )}</p>`;
  const cards = visibleChoices
    .map((choice) =>
      renderVariantChoice({
        choice,
        aggregate,
        providerEvidence,
        runFolder: ctx.runFolder,
      }),
    )
    .join('\n\n');
  const resumeCommand = `circuit resume --run-folder ${shellSingleQuote(
    ctx.runFolder,
  )} --checkpoint-choice '<variant-id>'`;
  const bodyHtml = `${banner}

  <div class="grid">
${cards}
  </div>

  <details>
    <summary>Comparison evidence and resume command</summary>
    <div class="body">
      <p><strong>Verification.</strong> ${escapeHtml(verification.overall_status)}</p>
      ${missingEvidenceHtml}
      <p><strong>Resume command.</strong> <code>${escapeHtml(resumeCommand)}</code></p>
      <p><strong>Reports.</strong></p>
      <div class="evidence">
        ${[
          PROTOTYPE_VARIANT_AGGREGATE_PATH,
          PROTOTYPE_VARIANT_PROVIDER_EVIDENCE_PATH,
          PROTOTYPE_VARIANT_VERIFICATION_PATH,
          PROTOTYPE_VARIANT_REVIEW_PATH,
          PROTOTYPE_VARIANT_CHOICES_PATH,
          ctx.checkpoint?.request_path ?? '',
        ]
          .filter((item) => item.length > 0)
          .map((item) => chip(item))
          .join('\n        ')}
      </div>
    </div>
  </details>
`;

  return renderPage({
    title: 'Prototype model comparison checkpoint',
    metaLine: `Prototype model comparison - ${ctx.runId}`,
    headline: 'Choose a prototype variant',
    subtitle:
      'Compare local prototype artifacts using captured relay selection evidence, then keep one variant.',
    bodyHtml,
    footerLeft: `circuit - prototype - ${ctx.runId}`,
    footerRight: PROTOTYPE_VARIANT_AGGREGATE_PATH,
  });
}

export const prototypeCheckpointProjector: HtmlProjector = (ctx) => {
  if (ctx.flowId !== 'prototype' || ctx.runOutcome !== 'checkpoint_waiting') return undefined;
  if (ctx.checkpoint?.step_id === 'prototype-variant-checkpoint-step') {
    return renderVariantCheckpoint(ctx);
  }
  if (ctx.checkpoint?.step_id !== 'prototype-checkpoint-step') return undefined;
  const brief = load(ctx.readJsonRunRelative, PROTOTYPE_BRIEF_PATH, (raw) =>
    PrototypeBrief.safeParse(raw),
  );
  const plan = load(ctx.readJsonRunRelative, PROTOTYPE_PLAN_PATH, (raw) =>
    PrototypePlan.safeParse(raw),
  );
  const artifact = load(ctx.readJsonRunRelative, PROTOTYPE_ARTIFACT_PATH, (raw) =>
    PrototypeArtifact.safeParse(raw),
  );
  const verification = load(ctx.readJsonRunRelative, PROTOTYPE_VERIFICATION_PATH, (raw) =>
    PrototypeVerification.safeParse(raw),
  );
  if (
    brief === undefined ||
    plan === undefined ||
    artifact === undefined ||
    verification === undefined
  ) {
    return undefined;
  }
  const choices = filteredChoices(ctx.checkpoint.allowed_choices);
  if (choices.length === 0) return undefined;
  const recommendedChoice = choices.find((choice) => choice.id === 'keep-prototype') ?? choices[0];
  if (recommendedChoice === undefined) return undefined;

  const banner = verdictBanner({
    intent: 'positive',
    badgeText: 'Verified local artifact',
    mainHtml: `<strong>${escapeHtml(recommendedChoice.label)}</strong> &mdash; ${escapeHtml(
      'Safe default: keep the prototype evidence and decide on Build separately.',
    )}`,
    aside: 'waiting for choice',
  });
  const choiceCards = choices
    .map((choice) => renderChoice(choice, ctx.runFolder, recommendedChoice.id))
    .join('\n\n');
  const resumeCommand = `circuit resume --run-folder ${shellSingleQuote(
    ctx.runFolder,
  )} --checkpoint-choice '<choice>'`;
  const bodyHtml = `${banner}

  <div class="grid">
${renderArtifactCard(artifact)}

${renderVerificationCard(verification)}

${renderRiskCard(artifact, brief)}

${renderPlanCard(plan)}
  </div>

  <div class="grid" style="margin-top:16px">
${choiceCards}
  </div>

  <details>
    <summary>Raw evidence and resume command</summary>
    <div class="body">
      <p><strong>Resume command.</strong> <code>${escapeHtml(resumeCommand)}</code></p>
      <p><strong>Reports.</strong></p>
      <div class="evidence">
        ${[
          PROTOTYPE_BRIEF_PATH,
          PROTOTYPE_PLAN_PATH,
          PROTOTYPE_ARTIFACT_PATH,
          PROTOTYPE_VERIFICATION_PATH,
          ctx.checkpoint.request_path,
        ]
          .map((item) => chip(item))
          .join('\n        ')}
      </div>
    </div>
  </details>
`;

  return renderPage({
    title: `${brief.objective} - Circuit Prototype checkpoint`,
    metaLine: `Prototype checkpoint - ${ctx.runId}`,
    headline: brief.objective,
    subtitle:
      'Choose whether to keep this local prototype, save it as Build input, or mark it discarded.',
    bodyHtml,
    footerLeft: `circuit - prototype - ${ctx.runId}`,
    footerRight: PROTOTYPE_ARTIFACT_PATH,
  });
};
