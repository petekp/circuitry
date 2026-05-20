import { Command, CommanderError } from 'commander';
import {
  RunStatusFolderError,
  projectRunStatusFromRunFolder,
} from '../run-status/project-run-folder.js';
import { type EngineErrorCodeV1, EngineErrorV1 } from '../schemas/run-status.js';

function engineError(input: {
  readonly code: EngineErrorCodeV1;
  readonly message: string;
  readonly runFolder?: string;
}): EngineErrorV1 {
  return EngineErrorV1.parse({
    api_version: 'engine-error-v1',
    schema_version: 1,
    error: {
      code: input.code,
      message: input.message,
    },
    ...(input.runFolder === undefined ? {} : { run_folder: input.runFolder }),
  });
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function invalidInvocation(message: string, runFolder?: string): number {
  writeJson(
    engineError({
      code: 'invalid_invocation',
      message,
      ...(runFolder === undefined ? {} : { runFolder }),
    }),
  );
  return 2;
}

function commanderErrorMessage(err: unknown): string {
  if (err instanceof CommanderError) return err.message.replace(/^error: /, '');
  return err instanceof Error ? err.message : String(err);
}

function parseShowArgs(argv: readonly string[]): { readonly runFolder: string } | string {
  let showOptions: { json?: boolean; runFolder?: string } | undefined;
  const program = new Command('circuit runs')
    .exitOverride()
    .configureOutput({ writeErr: () => {} });
  const show = program
    .command('show')
    .option('--json')
    .option('--run-folder <path>')
    .action(() => {
      showOptions = show.opts<{ json?: boolean; runFolder?: string }>();
    });
  try {
    program.parse(argv, { from: 'user' });
  } catch (err) {
    return commanderErrorMessage(err);
  }

  if (showOptions === undefined) return 'runs requires a subcommand';

  if (showOptions.json !== true) return 'runs show requires --json';
  if (showOptions.runFolder === undefined) return '--run-folder is required';
  return { runFolder: showOptions.runFolder };
}

export async function runRunsCommand(argv: readonly string[]): Promise<number> {
  const parsed = parseShowArgs(argv);
  if (typeof parsed === 'string') return invalidInvocation(parsed);

  try {
    writeJson(projectRunStatusFromRunFolder(parsed.runFolder));
    return 0;
  } catch (err) {
    if (err instanceof RunStatusFolderError) {
      writeJson(
        engineError({
          code: err.code,
          message: err.message,
          runFolder: err.runFolder,
        }),
      );
      return 1;
    }
    writeJson(
      engineError({
        code: 'internal_error',
        message: err instanceof Error ? err.message : String(err),
        runFolder: parsed.runFolder,
      }),
    );
    return 1;
  }
}
