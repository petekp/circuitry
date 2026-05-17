// Build brief checkpoint writer.
//
// Assembles a fresh BuildBrief from the run goal plus the
// policy.report_template object. The brief is fully populated at first
// write — checkpoint.response_path always points at step.writes.response
// — so no re-stamp happens after operator resolution. This eliminates
// the crash window between a stamped-brief write and the
// checkpoint.resolved trace_entry.
//
// Resume-time validator: reads the on-disk brief, verifies its hash
// against the value the checkpoint request stored, parses it through
// the BuildBrief schema, and asserts the brief.checkpoint.* shape
// belongs to the waiting step.

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { VerificationCommand } from '../../../schemas/verification.js';
import { sha256Hex } from '../../../shared/connector-relay.js';
import { resolveRunRelative } from '../../../shared/run-relative-path.js';
import {
  inferBuildVerificationNeeds,
  requireResolvedVerificationCommands,
} from '../../../shared/verification-resolver.js';
import {
  type CheckpointBriefBuilder,
  type CheckpointBuildContext,
  type CheckpointResumeContext,
  checkpointChoiceIds,
} from '../../registries/checkpoint-writers/types.js';
import { BuildBrief, type BuildCheckpointPacket } from '../reports.js';

const BuildBriefReportTemplate = z
  .object({
    scope: z.string().min(1),
    success_criteria: z.array(z.string().min(1)).min(1),
    verification_command_candidates: z.array(VerificationCommand).min(1).optional(),
  })
  .strict();

function titleCaseChoice(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join(' ');
}

function routeForChoice(
  step: CheckpointBuildContext['step'],
  choiceId: string,
): { readonly key: string; readonly target: string } | undefined {
  const direct = step.routes[choiceId];
  if (direct !== undefined) return { key: choiceId, target: direct };
  const fallback = step.routes.pass;
  if (fallback !== undefined) return { key: 'pass', target: fallback };
  return undefined;
}

function recommendedChoiceId(step: CheckpointBuildContext['step']): string {
  const allowed = new Set(checkpointChoiceIds(step));
  const safeDefault = step.policy.safe_default_choice;
  if (safeDefault !== undefined && allowed.has(safeDefault)) return safeDefault;
  const safeAutonomous = step.policy.safe_autonomous_choice;
  if (safeAutonomous !== undefined && allowed.has(safeAutonomous)) return safeAutonomous;
  return checkpointChoiceIds(step)[0] ?? 'continue';
}

function buildCheckpointPacket(input: {
  readonly context: CheckpointBuildContext;
  readonly template: z.infer<typeof BuildBriefReportTemplate>;
  readonly verificationCommands: readonly z.infer<typeof VerificationCommand>[];
}): BuildCheckpointPacket {
  const allowedChoices = checkpointChoiceIds(input.context.step);
  const recommendationId = recommendedChoiceId(input.context.step);
  const choices = input.context.step.policy.choices
    .filter((choice) => allowedChoices.includes(choice.id))
    .flatMap((choice) => {
      const route = routeForChoice(input.context.step, choice.id);
      if (route === undefined) return [];
      return [
        {
          id: choice.id,
          label: choice.label ?? titleCaseChoice(choice.id),
          description:
            choice.description ??
            (choice.id === recommendationId
              ? 'Proceed on the recommended executable route.'
              : `Resume the Build flow with checkpoint choice '${choice.id}'.`),
          route,
        },
      ];
    });
  const recommendedChoice = choices.find((choice) => choice.id === recommendationId) ?? choices[0];
  if (recommendedChoice === undefined) {
    throw new Error(
      `checkpoint step '${input.context.step.id}' has no executable checkpoint choices`,
    );
  }
  const verificationCommandText = input.verificationCommands
    .map((command) => command.argv.join(' '))
    .join('; ');

  return {
    kind: 'build.checkpoint_packet@v1',
    salience: {
      summary: 'Confirm the Build brief before Circuit starts write-capable implementation work.',
      why_now: [
        'The next route can edit the checkout.',
        `The requested objective is: ${input.context.goal}`,
        'This is the last low-cost point to correct scope before implementation begins.',
      ],
      hidden_routine_work: [
        'Formatting, test execution, and ordinary implementation chores stay inside the Build flow after approval.',
        'Raw traces and request files are linked as evidence instead of dominating the decision surface.',
      ],
    },
    decision: {
      question: input.context.step.policy.prompt,
      operator_judgment:
        'Decide whether this scope, success bar, and proof plan are good enough for Circuit to proceed.',
    },
    recommendation: {
      choice_id: recommendedChoice.id,
      label: recommendedChoice.label,
      rationale: `${recommendedChoice.label} is recommended because the packet has a bounded scope, explicit success criteria, and a concrete verification plan.`,
    },
    artifact: {
      title: 'Build brief',
      preview: `Objective: ${input.context.goal}`,
      scope: input.template.scope,
      success_criteria: input.template.success_criteria,
    },
    proof: {
      status: 'planned',
      summary: `Circuit will verify the implementation with: ${verificationCommandText}.`,
      commands: [...input.verificationCommands],
      evidence: [
        'Verification is planned before implementation begins; no implementation proof has been collected yet.',
        'The final Build close report must carry the actual verification and review evidence after resume.',
      ],
    },
    risk: {
      summary:
        'The meaningful risk is scope mismatch: continuing spends implementation effort on this exact brief.',
      tradeoffs: [
        'If the brief is too narrow, the implementation may satisfy tests while missing the operator intent.',
        'If the brief is too broad, the worker may touch more surface area than this request warrants.',
      ],
    },
    choices,
    internal: {
      request_path: input.context.step.writes.request,
      response_path: input.context.responsePath,
      report_path: input.context.step.writes.report?.path ?? 'reports/build/brief.json',
      raw_evidence: [
        input.context.step.writes.request,
        input.context.responsePath,
        input.context.step.writes.report?.path ?? 'reports/build/brief.json',
      ],
    },
  };
}

export const buildBriefCheckpointBuilder: CheckpointBriefBuilder = {
  resultSchemaName: 'build.brief@v1',
  build(context: CheckpointBuildContext): unknown {
    const rawTemplate = context.step.policy.report_template;
    if (rawTemplate === undefined) {
      throw new Error(
        `checkpoint step '${context.step.id}' writing build.brief@v1 requires policy.report_template`,
      );
    }
    const template = BuildBriefReportTemplate.parse(rawTemplate);
    const verificationCommands = requireResolvedVerificationCommands({
      ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
      goal: context.goal,
      requestedNeeds: inferBuildVerificationNeeds(context.goal),
      commandIdPrefix: 'build',
      timeoutMs: 120_000,
      maxOutputBytes: 200_000,
    });
    return BuildBrief.parse({
      objective: context.goal,
      scope: template.scope,
      success_criteria: template.success_criteria,
      verification_command_candidates: verificationCommands,
      checkpoint: {
        request_path: context.step.writes.request,
        response_path: context.responsePath,
        allowed_choices: checkpointChoiceIds(context.step),
      },
      checkpoint_packet: buildCheckpointPacket({
        context,
        template,
        verificationCommands,
      }),
    });
  },
  validateResumeContext(context: CheckpointResumeContext): BuildBrief {
    const reportAbs = resolveRunRelative(context.runFolder, context.reportPath);
    const raw = readFileSync(reportAbs, 'utf8');
    if (context.reportSha256 === undefined) {
      throw new Error(
        'checkpoint resume rejected: checkpoint request is missing checkpoint_report_sha256',
      );
    }
    const observedHash = sha256Hex(raw);
    if (observedHash !== context.reportSha256) {
      throw new Error('checkpoint resume rejected: waiting Build brief hash differs from request');
    }
    const brief = BuildBrief.parse(JSON.parse(raw));
    const expectedChoices = checkpointChoiceIds(context.step);
    if (
      brief.checkpoint.request_path !== context.step.writes.request ||
      brief.checkpoint.response_path !== context.step.writes.response ||
      brief.checkpoint.allowed_choices.length !== expectedChoices.length ||
      brief.checkpoint.allowed_choices.some((choice, index) => choice !== expectedChoices[index])
    ) {
      throw new Error(
        `checkpoint resume rejected: waiting Build brief does not belong to checkpoint '${context.step.id}'`,
      );
    }
    return brief;
  },
};
