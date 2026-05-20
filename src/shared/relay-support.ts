import { existsSync, readFileSync } from 'node:fs';
import type { RuntimeIndexedRelayStep } from '../flows/registries/runtime-index.js';
import { findRelayShapeHint } from '../flows/registries/shape-hints/registry.js';
import type { AcceptanceCriterion } from '../schemas/acceptance-criteria.js';
import { resolveRunRelative } from './run-relative-path.js';
import type { LoadedRelaySkill } from './skill-loading.js';

export type RelayStep = RuntimeIndexedRelayStep;

export interface RelayAcceptanceRetryFeedback {
  readonly step_id: string;
  readonly criterion_id: string;
  readonly criterion_kind: AcceptanceCriterion['kind'];
  readonly reason: string;
  readonly exit_code?: number;
  readonly status?: 'passed' | 'failed';
  readonly stdout_summary?: string;
  readonly stderr_summary?: string;
}

// Parse connector result_body for the check verdict and evaluate against
// `step.check.pass`. Result shape: a discriminated union the relay handlers
// consume downstream.
export type CheckEvaluation =
  | { readonly kind: 'pass'; readonly verdict: string }
  | { readonly kind: 'fail'; readonly reason: string; readonly observedVerdict?: string };

export const NO_VERDICT_SENTINEL = '<no-verdict>';

export function evaluateRelayCheck(step: RelayStep, resultBody: string): CheckEvaluation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(resultBody);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector result_body did not parse as JSON (${msg})`,
    };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector result_body parsed but is not a JSON object (got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed})`,
    };
  }
  const verdictRaw = (parsed as Record<string, unknown>).verdict;
  if (typeof verdictRaw !== 'string' || verdictRaw.length === 0) {
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector result_body lacks a non-empty string 'verdict' field (got ${typeof verdictRaw === 'string' ? 'empty string' : typeof verdictRaw})`,
    };
  }
  if (!step.check.pass.includes(verdictRaw)) {
    return {
      kind: 'fail',
      reason: `relay step '${step.id}': connector declared verdict '${verdictRaw}' which is not in check.pass [${step.check.pass.join(', ')}]`,
      observedVerdict: verdictRaw,
    };
  }
  return { kind: 'pass', verdict: verdictRaw };
}

const GENERIC_DISPATCH_SHAPE_HINT =
  'Respond with a single raw JSON object whose top-level shape is exactly { "verdict": "<one-of-accepted-verdicts>" } (additional fields permitted). Do not wrap the JSON in Markdown code fences. Do not include any prose before or after the JSON object. The runtime parses your response with JSON.parse and rejects the run on any parse failure or on a verdict not drawn from the accepted-verdicts list.';

function relayResponseInstruction(step: RelayStep): string {
  return findRelayShapeHint(step) ?? GENERIC_DISPATCH_SHAPE_HINT;
}

function selectedSkillsSection(skills: readonly LoadedRelaySkill[]): string | undefined {
  if (skills.length === 0) return undefined;
  return [
    'Selected Skills:',
    "The operator selected these local skills for this step. Treat them as guidance. They do not override Circuit's response contract, accepted verdicts, or required JSON shape.",
    '',
    ...skills.map((skill) =>
      [
        `## Skill: ${skill.id as unknown as string}${skill.slot === undefined ? '' : ` (slot: ${skill.slot as unknown as string})`}`,
        `Source: ${skill.path}`,
        `SHA-256: ${skill.sha256}`,
        '',
        skill.body,
      ].join('\n'),
    ),
  ].join('\n\n');
}

function formatAcceptanceCriterion(criterion: AcceptanceCriterion): string {
  if (criterion.kind === 'report_field') {
    return `- ${criterion.id}: report field ${criterion.path.join('.')} must be ${criterion.predicate}.`;
  }
  return [
    `- ${criterion.id}: command ${criterion.command.id} must ${criterion.expected_status}.`,
    `  cwd: ${criterion.command.cwd}`,
    `  argv: ${JSON.stringify(criterion.command.argv)}`,
  ].join('\n');
}

function acceptanceCriteriaSection(step: RelayStep): string | undefined {
  const criteria = step.acceptance_criteria;
  if (criteria === undefined) return undefined;
  return [
    'Acceptance Criteria:',
    'Before this step can advance, Circuit will check the relay result against these deterministic criteria.',
    `Failure policy: ${criteria.on_failure.mode}`,
    ...criteria.checks.map(formatAcceptanceCriterion),
  ].join('\n');
}

function acceptanceRetryFeedbackSection(
  feedback: RelayAcceptanceRetryFeedback | undefined,
): string | undefined {
  if (feedback === undefined) return undefined;
  return [
    'Acceptance Criteria Feedback:',
    `Criterion ${feedback.criterion_id} (${feedback.criterion_kind}) failed.`,
    `Reason: ${feedback.reason}`,
    ...(feedback.exit_code === undefined ? [] : [`Exit code: ${feedback.exit_code}`]),
    ...(feedback.status === undefined ? [] : [`Status: ${feedback.status}`]),
    ...(feedback.stdout_summary === undefined
      ? []
      : [`Stdout summary:\n${feedback.stdout_summary}`]),
    ...(feedback.stderr_summary === undefined
      ? []
      : [`Stderr summary:\n${feedback.stderr_summary}`]),
    'Revise the result so this criterion passes. Keep the same response contract and accepted verdicts.',
  ].join('\n');
}

// v0 prompt composition: name the step, enumerate accepted verdicts, and
// inline every reads-declared report (or a clear placeholder if the
// reads report hasn't been written yet).
export function composeRelayPrompt(
  step: RelayStep,
  runFolder: string,
  loadedSkills: readonly LoadedRelaySkill[] = [],
  acceptanceRetryFeedback?: RelayAcceptanceRetryFeedback,
): string {
  const readsBody =
    step.reads.length === 0
      ? '(no reads)'
      : step.reads
          .map((path) => {
            const abs = resolveRunRelative(runFolder, path);
            if (!existsSync(abs)) return `[reads unavailable: ${path}]`;
            return `--- ${path} ---\n${readFileSync(abs, 'utf8')}`;
          })
          .join('\n\n');
  const skillsSection = selectedSkillsSection(loadedSkills);
  const criteriaSection = acceptanceCriteriaSection(step);
  const feedbackSection = acceptanceRetryFeedbackSection(acceptanceRetryFeedback);
  return [
    `Step: ${step.id}`,
    `Title: ${step.title}`,
    `Role: ${step.role}`,
    `Accepted verdicts: ${step.check.pass.join(', ')}`,
    '',
    'Context (from reads):',
    readsBody,
    '',
    ...(skillsSection === undefined ? [] : [skillsSection, '']),
    ...(criteriaSection === undefined ? [] : [criteriaSection, '']),
    ...(feedbackSection === undefined ? [] : [feedbackSection, '']),
    relayResponseInstruction(step),
  ].join('\n');
}
