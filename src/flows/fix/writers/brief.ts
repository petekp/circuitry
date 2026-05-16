// Fix brief compose writer.
//
// Fabricates a default FixBrief from the run goal alone. A real Fix
// run would expect an interactive frame step (host checkpoint) to
// enrich the regression contract; the inline-compose fallback here keeps
// schematic execution honest when no operator input is available, defaulting
// to deferred repro and a verification command resolved from real package
// scripts.

import { requireResolvedVerificationCommands } from '../../../shared/verification-resolver.js';
import type {
  ComposeBuildContext,
  ComposeBuilder,
} from '../../registries/compose-writers/types.js';
import { FixBrief, type FixRegressionContract, FixVerificationCommand } from '../reports.js';

function parseSimpleArgv(command: string): string[] | undefined {
  const argv: string[] = [];
  let current = '';
  let quote: "'" | '"' | undefined;
  let tokenStarted = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === undefined) continue;

    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
        tokenStarted = true;
        continue;
      }
      if (quote === '"' && char === '\\') {
        const next = command[index + 1];
        if (next === '"' || next === '\\') {
          current += next;
          index += 1;
          tokenStarted = true;
          continue;
        }
      }
      current += char;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (tokenStarted) {
        argv.push(current);
        current = '';
        tokenStarted = false;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      tokenStarted = true;
      continue;
    }

    // This parser intentionally accepts only direct argv syntax, not shell
    // control syntax. Verification executes argv directly, so quoted spaces
    // are useful; pipes/redirection/subshells are not.
    if (/[|&;<>()`$]/.test(char)) return undefined;

    current += char;
    tokenStarted = true;
  }

  if (quote !== undefined) return undefined;
  if (tokenStarted) argv.push(current);
  if (argv.length === 0) return undefined;
  if (argv.some((part) => part.length === 0)) return undefined;
  return argv;
}

function explicitRegressionCommand(goal: string): FixVerificationCommand | undefined {
  const match =
    /\bregression command is\s+`([^`]+)`/i.exec(goal) ??
    /\bregression command:\s*`([^`]+)`/i.exec(goal);
  const rawCommand = match?.[1];
  if (rawCommand === undefined) return undefined;
  const argv = parseSimpleArgv(rawCommand);
  if (argv === undefined) return undefined;
  return FixVerificationCommand.parse({
    id: 'fix-regression',
    cwd: '.',
    argv,
    timeout_ms: 600_000,
    max_output_bytes: 200_000,
    env: {},
  });
}

function commandFromArgv(id: string, argv: readonly string[]): FixVerificationCommand {
  return FixVerificationCommand.parse({
    id,
    cwd: '.',
    argv,
    timeout_ms: 600_000,
    max_output_bytes: 200_000,
    env: {},
  });
}

function explicitObjectiveCheckCommands(goal: string): readonly FixVerificationCommand[] {
  const match =
    /\bObjective check commands:\s*\n([\s\S]*?)(?:\n\n|\nAllowed changed files:|$)/i.exec(goal);
  const rawSection = match?.[1];
  if (rawSection === undefined) return [];

  const commands: FixVerificationCommand[] = [];
  const seen = new Set<string>();
  for (const line of rawSection.split('\n')) {
    const rawCommand = /^\s*-\s+(.+?)\s*$/.exec(line)?.[1];
    if (rawCommand === undefined) continue;
    const argv = parseSimpleArgv(rawCommand);
    if (argv === undefined) continue;
    const key = argv.join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    commands.push(commandFromArgv(`fix-objective-${commands.length + 1}`, argv));
  }
  return commands;
}

function regressionContractForGoal(goal: string): FixRegressionContract {
  const command = explicitRegressionCommand(goal);
  if (command === undefined) {
    return {
      expected_behavior: `After fix: ${goal}`,
      actual_behavior: `Before fix: ${goal}`,
      repro: {
        kind: 'not-reproducible',
        deferred_reason:
          'Default Fix brief — operator-supplied repro evidence not available at frame time',
      },
      regression_test: {
        status: 'deferred',
        deferred_reason:
          'Default Fix brief — regression-test authoring deferred until repro evidence is supplied',
      },
    };
  }

  return {
    expected_behavior: `After fix: ${goal}`,
    actual_behavior: `Before fix: ${goal}`,
    repro: {
      kind: 'command',
      command,
    },
    regression_test: {
      status: 'failing-before-fix',
      command,
    },
  };
}

export const fixBriefComposeBuilder: ComposeBuilder = {
  resultSchemaName: 'fix.brief@v1',
  build(context: ComposeBuildContext): unknown {
    const goal = context.goal;
    const explicitObjectiveCommands = explicitObjectiveCheckCommands(goal);
    const verificationCommands =
      explicitObjectiveCommands.length > 0
        ? explicitObjectiveCommands
        : requireResolvedVerificationCommands({
            ...(context.projectRoot === undefined ? {} : { projectRoot: context.projectRoot }),
            goal,
            requestedNeeds: ['general'],
            commandIdPrefix: 'fix',
            timeoutMs: 600_000,
            maxOutputBytes: 200_000,
          });
    return FixBrief.parse({
      problem_statement: goal,
      expected_behavior: `Resolve: ${goal}`,
      observed_behavior: `Currently: ${goal}`,
      scope: goal,
      regression_contract: regressionContractForGoal(goal),
      success_criteria: [`Demonstrate the fix addresses: ${goal}`],
      verification_command_candidates: verificationCommands,
    });
  },
};
