import { type Axes, DEFAULT_AXES } from '../schemas/axes.js';
import type {
  CheckpointChoiceSource,
  ReportItemsSource,
  RuntimeNumberSource,
} from '../schemas/runtime-source.js';
import { resolveDottedPath } from './fanout-branch-template.js';

export interface RuntimeSourceFileReader {
  readJson(path: string): Promise<unknown>;
}

export interface CheckpointChoice {
  readonly id: string;
  readonly label?: string;
  readonly description?: string;
}

export function resolveRuntimeNumberSource(
  source: RuntimeNumberSource,
  axes: Axes = DEFAULT_AXES,
): number {
  if (source.kind === 'constant') return source.value;
  return axes[source.axis];
}

function resolvedCountLabel(source: RuntimeNumberSource): string {
  if (source.kind === 'constant') return String(source.value);
  return `axes.${source.axis}`;
}

export async function resolveReportItemsSource(input: {
  readonly source: ReportItemsSource;
  readonly files: RuntimeSourceFileReader;
  readonly axes?: Axes;
  readonly owner: string;
}): Promise<readonly unknown[]> {
  const sourceRaw = await input.files.readJson(input.source.source_report);
  const rawItems = resolveDottedPath(sourceRaw, input.source.items_path);
  if (!Array.isArray(rawItems)) {
    throw new Error(
      `${input.owner}: items_path '${input.source.items_path}' did not resolve to an array (got ${typeof rawItems})`,
    );
  }
  const items = filterItems(rawItems, input.source.filter);
  if (input.source.required_count !== undefined) {
    const expected = resolveRuntimeNumberSource(input.source.required_count, input.axes);
    if (items.length !== expected) {
      throw new Error(
        `${input.owner}: expected ${expected} items from ${input.source.source_report}.${input.source.items_path} (${resolvedCountLabel(input.source.required_count)}) but found ${items.length}`,
      );
    }
  }
  return items;
}

function filterItems(
  items: readonly unknown[],
  filter: ReportItemsSource['filter'] | undefined,
): readonly unknown[] {
  if (filter === undefined) return items;
  if (filter.kind === 'path_equals') {
    return items.filter((item) => resolveDottedPath(item, filter.path) === filter.value);
  }
  return items;
}

function requireItemString(input: {
  readonly item: unknown;
  readonly path: string;
  readonly owner: string;
  readonly index: number;
}): string {
  const value = resolveDottedPath(input.item, input.path);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${input.owner}: item ${input.index} field '${input.path}' must be a non-empty string`,
    );
  }
  return value;
}

export async function resolveCheckpointChoicesSource(input: {
  readonly source: CheckpointChoiceSource;
  readonly files: RuntimeSourceFileReader;
  readonly axes?: Axes;
  readonly owner: string;
}): Promise<readonly CheckpointChoice[]> {
  const items = await resolveReportItemsSource(input);
  return items.map((item, index) => {
    const id = requireItemString({
      item,
      path: input.source.id_path,
      owner: input.owner,
      index,
    });
    const label =
      input.source.label_path === undefined
        ? undefined
        : requireItemString({
            item,
            path: input.source.label_path,
            owner: input.owner,
            index,
          });
    const description =
      input.source.description_path === undefined
        ? undefined
        : requireItemString({
            item,
            path: input.source.description_path,
            owner: input.owner,
            index,
          });
    return {
      id,
      ...(label === undefined ? {} : { label }),
      ...(description === undefined ? {} : { description }),
    };
  });
}
