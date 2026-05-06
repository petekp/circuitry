import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CheckpointChoicePresentationV2 {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface CheckpointPresentationV2 {
  readonly prompt: string;
  readonly choices: readonly CheckpointChoicePresentationV2[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}.`;
}

function readJson(runDir: string, path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(join(runDir, path), 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function optionPresentationById(
  runDir: string,
): ReadonlyMap<string, CheckpointChoicePresentationV2> {
  const raw = readJson(runDir, 'reports/decision-options.json');
  if (!isRecord(raw) || !Array.isArray(raw.options)) return new Map();
  const entries: [string, CheckpointChoicePresentationV2][] = [];
  for (const option of raw.options) {
    if (!isRecord(option)) continue;
    const id = option.id;
    const label = option.label;
    if (typeof id !== 'string' || typeof label !== 'string') continue;
    const description =
      typeof option.summary === 'string'
        ? option.summary
        : typeof option.best_case_prompt === 'string'
          ? option.best_case_prompt
          : `Resume with '${id}'.`;
    entries.push([
      id,
      {
        id,
        label: boundedText(label, 80),
        description: boundedText(description, 160),
      },
    ]);
  }
  return new Map(entries);
}

function tournamentQuestion(runDir: string): string | undefined {
  const raw = readJson(runDir, 'reports/tournament-review.json');
  if (!isRecord(raw)) return undefined;
  const question = raw.tradeoff_question;
  return typeof question === 'string' && question.trim().length > 0
    ? boundedText(question.trim(), 240)
    : undefined;
}

export function tournamentCheckpointPresentationV2(input: {
  readonly runDir: string;
  readonly allowedChoices: readonly string[];
  readonly fallbackPrompt: string;
  readonly fallbackLabel: (choice: string) => string;
  readonly fallbackDescription: (choice: string) => string;
}): CheckpointPresentationV2 {
  const byId = optionPresentationById(input.runDir);
  return {
    prompt: tournamentQuestion(input.runDir) ?? boundedText(input.fallbackPrompt, 240),
    choices: input.allowedChoices.map((choice) => {
      const dynamic = byId.get(choice);
      if (dynamic !== undefined) return dynamic;
      return {
        id: choice,
        label: boundedText(input.fallbackLabel(choice), 80),
        description: boundedText(input.fallbackDescription(choice), 160),
      };
    }),
  };
}
