import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

/**
 * Write a text file via temp-file + rename so readers never observe a partial write.
 */
export function writeTextFileAtomic(path: string, content: string): void {
  const parentDir = dirname(path);
  mkdirSync(parentDir, { recursive: true });

  const tempPath = join(
    parentDir,
    `.tmp-${process.pid}-${randomUUID()}`,
  );

  try {
    writeFileSync(tempPath, content, "utf-8");
    renameSync(tempPath, path);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}
