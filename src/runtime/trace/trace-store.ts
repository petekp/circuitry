// Append-only trace.ndjson store.
//
// This is the sequence authority for runtime events. Callers provide event
// bodies; TraceStore assigns contiguous sequence numbers, persists one JSON
// object per line, rejects writes after run.closed, and lets projection hooks
// fail without corrupting the trace.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TraceEntry, TraceEntryInput } from '../domain/trace.js';

export interface TraceStoreOptions {
  readonly now?: () => Date;
  readonly onAppend?: (entry: TraceEntry) => void | Promise<void>;
}

export class TraceStore {
  private readonly tracePath: string;
  private entries: TraceEntry[] = [];
  private nextSequence = 0;
  private closed = false;
  private appendTail: Promise<void> = Promise.resolve();

  constructor(
    readonly runDir: string,
    private readonly options: TraceStoreOptions = {},
  ) {
    this.tracePath = join(runDir, 'trace.ndjson');
  }

  async load(): Promise<readonly TraceEntry[]> {
    await this.appendTail;
    let raw = '';
    try {
      raw = await readFile(this.tracePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.entries = [];
        this.nextSequence = 0;
        this.closed = false;
        return this.entries;
      }
      throw error;
    }

    const parsed = raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as unknown);
    for (const [index, entry] of parsed.entries()) {
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(`trace entry ${index} is not an object`);
      }
      const candidate = entry as TraceEntry;
      if (typeof candidate.sequence !== 'number' || !Number.isInteger(candidate.sequence)) {
        throw new Error(`trace entry ${index} has no integer sequence`);
      }
      if (candidate.sequence !== index) {
        throw new Error(
          `trace sequence mismatch at entry ${index}: expected ${index}, found ${candidate.sequence}`,
        );
      }
    }
    const entries = parsed as TraceEntry[];
    const closedIndex = entries.findIndex((entry) => entry.kind === 'run.closed');
    if (closedIndex !== -1 && closedIndex !== parsed.length - 1) {
      throw new Error(`trace entry after run.closed at sequence ${closedIndex}`);
    }
    this.entries = entries;
    this.nextSequence =
      entries.length === 0 ? 0 : Math.max(...entries.map((entry) => entry.sequence)) + 1;
    this.closed = entries.some((entry) => entry.kind === 'run.closed');
    return this.entries;
  }

  async append(input: TraceEntryInput): Promise<TraceEntry> {
    const appendOne = async (): Promise<TraceEntry> => {
      if (this.closed) {
        throw new Error('cannot append trace entry after run close');
      }

      const entry: TraceEntry = {
        ...input,
        recorded_at: input.recorded_at ?? (this.options.now ?? (() => new Date()))().toISOString(),
        sequence: this.nextSequence,
      };
      await mkdir(this.runDir, { recursive: true });
      await appendFile(this.tracePath, `${JSON.stringify(entry)}\n`, 'utf8');

      this.nextSequence += 1;
      this.entries.push(entry);

      if (entry.kind === 'run.closed') {
        this.closed = true;
      }

      try {
        await this.options.onAppend?.(entry);
      } catch {
        // Progress/projection side channels must not corrupt trace persistence.
      }

      return entry;
    };

    const result = this.appendTail.then(appendOne, appendOne);
    this.appendTail = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }

  getAll(): readonly TraceEntry[] {
    return this.entries;
  }
}
