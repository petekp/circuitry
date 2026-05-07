// Runtime manifest snapshot persistence.
//
// A run stores the exact compiled-flow bytes it started with so resume and
// status projection use the same flow even if generated files change later.
// This file owns the hash-bound snapshot read/write path; graph execution only
// passes the bytes through.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  type CompiledFlow,
  CompiledFlow as CompiledFlowSchema,
} from '../../schemas/compiled-flow.js';
import { CompiledFlowId, RunId } from '../../schemas/ids.js';
import { ManifestSnapshot, computeManifestHash } from '../../schemas/manifest.js';
import type { FlowId } from '../domain/flow.js';
import type { RunId as RuntimeRunId } from '../domain/run.js';

export const MANIFEST_SNAPSHOT_RUN_FILE = 'manifest.snapshot.json';

export function runtimeManifestSnapshotPath(runDir: string): string {
  return join(runDir, MANIFEST_SNAPSHOT_RUN_FILE);
}

export interface RuntimeManifestSnapshotInput {
  readonly runDir: string;
  readonly runId: RuntimeRunId;
  readonly flowId: FlowId;
  readonly capturedAt: string;
  readonly bytes: Uint8Array;
}

export async function writeRuntimeManifestSnapshot(
  input: RuntimeManifestSnapshotInput,
): Promise<ManifestSnapshot> {
  const bytes = Buffer.from(input.bytes);
  const snapshot = ManifestSnapshot.parse({
    schema_version: 1,
    run_id: RunId.parse(input.runId),
    flow_id: CompiledFlowId.parse(input.flowId),
    captured_at: input.capturedAt,
    algorithm: 'sha256-raw',
    hash: computeManifestHash(bytes),
    bytes_base64: bytes.toString('base64'),
  });
  const path = runtimeManifestSnapshotPath(input.runDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return snapshot;
}

export async function readRuntimeManifestSnapshot(runDir: string): Promise<ManifestSnapshot> {
  const raw = JSON.parse(await readFile(runtimeManifestSnapshotPath(runDir), 'utf8'));
  return ManifestSnapshot.parse(raw);
}

export interface RuntimeCompiledFlowManifestSnapshot {
  readonly snapshot: ManifestSnapshot;
  readonly flowBytes: Buffer;
  readonly flow: CompiledFlow;
}

export async function readRuntimeCompiledFlowManifestSnapshot(input: {
  readonly runDir: string;
  readonly expectedRunId?: string;
  readonly expectedFlowId?: string;
  readonly expectedHash?: string;
}): Promise<RuntimeCompiledFlowManifestSnapshot> {
  const snapshot = await readRuntimeManifestSnapshot(input.runDir);
  if (input.expectedRunId !== undefined && snapshot.run_id !== input.expectedRunId) {
    throw new Error(
      `manifest snapshot run_id mismatch: expected '${input.expectedRunId}' but found '${snapshot.run_id}'`,
    );
  }
  if (input.expectedFlowId !== undefined && snapshot.flow_id !== input.expectedFlowId) {
    throw new Error(
      `manifest snapshot flow_id mismatch: expected '${input.expectedFlowId}' but found '${snapshot.flow_id}'`,
    );
  }
  if (input.expectedHash !== undefined && snapshot.hash !== input.expectedHash) {
    throw new Error(
      `manifest snapshot hash mismatch: expected '${input.expectedHash}' but found '${snapshot.hash}'`,
    );
  }

  const flowBytes = Buffer.from(snapshot.bytes_base64, 'base64');
  let flow: CompiledFlow;
  try {
    flow = CompiledFlowSchema.parse(JSON.parse(flowBytes.toString('utf8')));
  } catch (error) {
    throw new Error(
      `manifest snapshot bytes do not parse as CompiledFlow: ${(error as Error).message}`,
    );
  }
  if (flow.id !== snapshot.flow_id) {
    throw new Error(
      `manifest snapshot flow_id '${snapshot.flow_id}' does not match compiled flow id '${flow.id}'`,
    );
  }

  return { snapshot, flowBytes, flow };
}
