import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolveRunFilePath } from '../../shared/run-file-paths.js';
import type { RunFileRef } from '../domain/run-file.js';
import type { ReportValidator } from './report-validator.js';

export class RunFileStore {
  constructor(
    readonly runDir: string,
    private readonly validateReport?: ReportValidator,
  ) {}

  resolve(ref: RunFileRef | string): string {
    return resolveRunFilePath(this.runDir, typeof ref === 'string' ? ref : ref.path);
  }

  async writeJson(ref: RunFileRef | string, value: unknown): Promise<string> {
    if (typeof ref !== 'string' && ref.schema !== undefined) {
      this.validateReport?.(ref.schema, value);
    }
    const fullPath = this.resolve(ref);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    return fullPath;
  }

  async writeText(ref: RunFileRef | string, value: string): Promise<string> {
    if (typeof ref !== 'string' && ref.schema !== undefined) {
      throw new Error(
        `writeText cannot write schema-tagged run file '${ref.path}'; use writeJson after parsing and validation`,
      );
    }
    const fullPath = this.resolve(ref);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, value, 'utf8');
    return fullPath;
  }

  async readText(ref: RunFileRef | string): Promise<string> {
    return await readFile(this.resolve(ref), 'utf8');
  }

  async readJson<T = unknown>(ref: RunFileRef | string): Promise<T> {
    const raw = await this.readText(ref);
    return JSON.parse(raw) as T;
  }
}
