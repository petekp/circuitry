import { ExploreDecisionOptions } from '../reports.js';
import type { ExploreAnalysis, ExploreBrief } from '../reports.js';

const FALLBACK_LABELS = [
  'Conservative path',
  'Ambitious path',
  'Hybrid path',
  'Defer pending evidence',
] as const;
const EXPLICIT_FILL_LABELS = [
  'Hybrid path',
  'Defer pending evidence',
  'Conservative path',
  'Ambitious path',
] as const;

export type ExploreDecisionOptionsProjectorInputs = {
  readonly brief: ExploreBrief;
  readonly analysis: ExploreAnalysis;
  readonly fallbackEvidenceRef: string;
  readonly optionCount?: number;
};

function stripDecisionPrefix(task: string): string {
  return task.replace(/^\s*(?:decide|choose|select|pick|compare)\s*:\s*/i, '').trim();
}

function cleanOptionLabel(raw: string): string | undefined {
  const label = raw
    .replace(/^\s*(?:choose|select|pick|between|among|whether to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!:;]+$/g, '')
    .trim();
  return label.length > 0 ? label : undefined;
}

function uniqueLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

function explicitOptionLabels(task: string): string[] {
  const text = stripDecisionPrefix(task);
  const between = /\bbetween\s+(.+?)\s+and\s+(.+)$/i.exec(text);
  if (between !== null) {
    return uniqueLabels(
      [between[1] ?? '', between[2] ?? ''].flatMap((label) => cleanOptionLabel(label) ?? []),
    );
  }

  const separators = /\s+(?:vs\.?|versus)\s+| ?\/ ?/i;
  if (separators.test(text)) {
    return uniqueLabels(text.split(separators).flatMap((label) => cleanOptionLabel(label) ?? []));
  }

  const commaParts = text.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i);
  if (commaParts.length > 1) {
    return uniqueLabels(commaParts.flatMap((label) => cleanOptionLabel(label) ?? []));
  }

  return [];
}

function boundedOptionLabels(task: string, optionCount: number): string[] {
  const explicit = explicitOptionLabels(task).slice(0, optionCount);
  const labels = [...explicit];
  const fallbackPool = explicit.length > 0 ? EXPLICIT_FILL_LABELS : FALLBACK_LABELS;
  for (const fallback of fallbackPool) {
    if (labels.length >= optionCount) break;
    if (!labels.some((label) => label.toLocaleLowerCase() === fallback.toLocaleLowerCase())) {
      labels.push(fallback);
    }
  }
  return labels.slice(0, optionCount);
}

function summaryForLabel(label: string, subject: string): string {
  if (label === 'Hybrid path') {
    return `Combine the strongest parts of the named options for ${subject} before locking the choice.`;
  }
  if (label === 'Defer pending evidence') {
    return `Pause the final choice for ${subject} until the missing evidence is gathered.`;
  }
  return `Choose ${label} as the best-supported path for ${subject}.`;
}

function promptForLabel(label: string, task: string): string {
  if (label === 'Hybrid path') {
    return `Make the strongest case for a hybrid path on ${task}.`;
  }
  if (label === 'Defer pending evidence') {
    return `Make the strongest case for deferring ${task} until the missing evidence is gathered.`;
  }
  return `Make the strongest case for choosing ${label} on ${task}.`;
}

export function projectExploreDecisionOptions(
  inputs: ExploreDecisionOptionsProjectorInputs,
): ExploreDecisionOptions {
  const primaryEvidence =
    inputs.analysis.aspects[0]?.evidence[0]?.source ?? inputs.fallbackEvidenceRef;
  const optionCount = inputs.optionCount ?? 3;
  const optionLabels = boundedOptionLabels(inputs.brief.task, optionCount);

  return ExploreDecisionOptions.parse({
    decision_question: `Which path should Circuit recommend for: ${inputs.brief.task}?`,
    recommendation_basis:
      'Compare the named options and bounded fallback choices against the available evidence.',
    options: optionLabels.map((label, index) => ({
      id: `option-${index + 1}`,
      label,
      summary: summaryForLabel(label, inputs.brief.subject),
      best_case_prompt: promptForLabel(label, inputs.brief.task),
      evidence_refs: [primaryEvidence],
      tradeoffs: [
        label === 'Defer pending evidence'
          ? 'Reduces decision risk'
          : 'Can move the decision forward now',
        label === 'Hybrid path'
          ? 'May blur ownership of the final direction'
          : 'May miss strengths from another option',
      ],
    })),
  });
}
