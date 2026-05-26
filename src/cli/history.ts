import { Command, CommanderError } from 'commander';
import {
  HistoryCommandError,
  type HistoryPathOptions,
  errorEnvelope,
  historyStatus,
  readHistoryManifest,
  rebuildHistoryIndex,
  resolveHistoryPaths,
} from '../history/indexer.js';
import { historyMemoryInputPreview } from '../history/memory-preview.js';
import { queryHistory } from '../history/query.js';
import { HistoryDocumentKindV1 } from '../schemas/index.js';

type ParsedHistoryArgs =
  | {
      readonly command: 'rebuild';
      readonly json: boolean;
      readonly runsBase?: string;
      readonly indexDir?: string;
    }
  | {
      readonly command: 'query';
      readonly json: boolean;
      readonly query: string;
      readonly format: 'json' | 'memory-input';
      readonly limit?: number;
      readonly perRunLimit?: number;
      readonly runsBase?: string;
      readonly indexDir?: string;
      readonly flow?: string;
      readonly kind?: 'run' | 'report' | 'trace' | 'checkpoint';
      readonly rebuildIfStale: boolean;
    }
  | {
      readonly command: 'status';
      readonly json: boolean;
      readonly runsBase?: string;
      readonly indexDir?: string;
    };

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function invalidInvocation(message: string, options: HistoryPathOptions = {}): number {
  writeJson(
    errorEnvelope(
      new HistoryCommandError('invalid_invocation', message, {
        ...(options.runsBase === undefined ? {} : { runsBase: options.runsBase }),
        ...(options.indexDir === undefined ? {} : { indexDir: options.indexDir }),
      }),
    ),
  );
  return 2;
}

function operationalError(error: unknown): number {
  if (error instanceof HistoryCommandError) {
    writeJson(errorEnvelope(error));
    return error.code === 'invalid_invocation' ? 2 : 1;
  }
  writeJson(
    errorEnvelope(
      new HistoryCommandError(
        'internal_error',
        error instanceof Error ? error.message : String(error),
      ),
    ),
  );
  return 1;
}

function commanderErrorMessage(err: unknown): string {
  if (err instanceof CommanderError) return err.message.replace(/^error: /, '');
  return err instanceof Error ? err.message : String(err);
}

function parsePositiveInteger(
  value: string | undefined,
  optionName: string,
): number | string | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return `${optionName} must be a positive integer`;
  return parsed;
}

function parseHistoryArgs(argv: readonly string[]): ParsedHistoryArgs | string {
  let parsed: ParsedHistoryArgs | undefined;
  const program = new Command('circuit history')
    .exitOverride()
    .configureOutput({ writeErr: () => {} });

  program
    .command('rebuild')
    .option('--json')
    .option('--runs-base <path>')
    .option('--index-dir <path>')
    .action((options: { json?: boolean; runsBase?: string; indexDir?: string }) => {
      parsed = {
        command: 'rebuild',
        json: options.json === true,
        ...(options.runsBase === undefined ? {} : { runsBase: options.runsBase }),
        ...(options.indexDir === undefined ? {} : { indexDir: options.indexDir }),
      };
    });

  program
    .command('query')
    .argument('<query...>')
    .option('--json')
    .option('--format <json|memory-input>', 'output format', 'json')
    .option('--limit <n>')
    .option('--per-run-limit <n>')
    .option('--runs-base <path>')
    .option('--index-dir <path>')
    .option('--flow <flow-id>')
    .option('--kind <run|report|trace|checkpoint>')
    .option('--rebuild-if-stale')
    .action(
      (
        queryParts: string[],
        options: {
          json?: boolean;
          format?: string;
          limit?: string;
          perRunLimit?: string;
          runsBase?: string;
          indexDir?: string;
          flow?: string;
          kind?: string;
          rebuildIfStale?: boolean;
        },
      ) => {
        const format = options.format ?? 'json';
        if (format !== 'json' && format !== 'memory-input') {
          parsed = undefined;
          throw new Error('--format must be json or memory-input');
        }
        const limit = parsePositiveInteger(options.limit, '--limit');
        if (typeof limit === 'string') throw new Error(limit);
        const perRunLimit = parsePositiveInteger(options.perRunLimit, '--per-run-limit');
        if (typeof perRunLimit === 'string') throw new Error(perRunLimit);
        const kind = options.kind;
        if (kind !== undefined && !HistoryDocumentKindV1.safeParse(kind).success) {
          throw new Error('--kind must be run, report, trace, or checkpoint');
        }
        parsed = {
          command: 'query',
          json: options.json === true,
          query: queryParts.join(' '),
          format,
          ...(limit === undefined ? {} : { limit }),
          ...(perRunLimit === undefined ? {} : { perRunLimit }),
          ...(options.runsBase === undefined ? {} : { runsBase: options.runsBase }),
          ...(options.indexDir === undefined ? {} : { indexDir: options.indexDir }),
          ...(options.flow === undefined ? {} : { flow: options.flow }),
          ...(kind === undefined
            ? {}
            : { kind: kind as 'run' | 'report' | 'trace' | 'checkpoint' }),
          rebuildIfStale: options.rebuildIfStale === true,
        };
      },
    );

  program
    .command('status')
    .option('--json')
    .option('--runs-base <path>')
    .option('--index-dir <path>')
    .action((options: { json?: boolean; runsBase?: string; indexDir?: string }) => {
      parsed = {
        command: 'status',
        json: options.json === true,
        ...(options.runsBase === undefined ? {} : { runsBase: options.runsBase }),
        ...(options.indexDir === undefined ? {} : { indexDir: options.indexDir }),
      };
    });

  try {
    program.parse(argv, { from: 'user' });
  } catch (err) {
    return commanderErrorMessage(err);
  }

  if (parsed === undefined) return 'history requires a subcommand';
  return parsed;
}

function pathOptions(parsed: ParsedHistoryArgs): HistoryPathOptions {
  return {
    ...(parsed.runsBase === undefined ? {} : { runsBase: parsed.runsBase }),
    ...(parsed.indexDir === undefined ? {} : { indexDir: parsed.indexDir }),
  };
}

export async function runHistoryCommand(argv: readonly string[]): Promise<number> {
  const parsed = parseHistoryArgs(argv);
  if (typeof parsed === 'string') return invalidInvocation(parsed);
  if (!parsed.json)
    return invalidInvocation('history commands require --json', pathOptions(parsed));

  try {
    if (parsed.command === 'rebuild') {
      const index = rebuildHistoryIndex(pathOptions(parsed));
      writeJson(index.manifest);
      return 0;
    }
    if (parsed.command === 'status') {
      writeJson(historyStatus(pathOptions(parsed)));
      return 0;
    }

    const result = queryHistory({
      ...pathOptions(parsed),
      query: parsed.query,
      ...(parsed.limit === undefined ? {} : { limit: parsed.limit }),
      ...(parsed.perRunLimit === undefined ? {} : { perRunLimit: parsed.perRunLimit }),
      ...(parsed.flow === undefined ? {} : { flow: parsed.flow }),
      ...(parsed.kind === undefined ? {} : { kind: parsed.kind }),
      rebuildIfStale: parsed.rebuildIfStale,
    });
    if (parsed.format === 'memory-input') {
      const manifest = readHistoryManifest(resolveHistoryPaths(pathOptions(parsed)));
      writeJson(
        historyMemoryInputPreview({
          query: result.query,
          indexState: result.index_state,
          rebuilt: result.rebuilt,
          warnings: result.warnings,
          hits: result.results,
          capturedAt: manifest.created_at,
        }),
      );
      return 0;
    }
    writeJson(result);
    return 0;
  } catch (error) {
    return operationalError(error);
  }
}
