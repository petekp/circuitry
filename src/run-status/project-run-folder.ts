import { constants, accessSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EngineErrorCodeV1 } from '../schemas/run-status.js';
import type { RunStatusProjectionV1 } from '../schemas/run-status.js';
import { verifyManifestSnapshotBytes } from '../shared/manifest-snapshot.js';
import {
  RETIRED_RUNTIME_RUN_FOLDER_ERROR_CODE,
  RETIRED_RUNTIME_RUN_FOLDER_MESSAGE,
} from '../shared/retired-runtime-policy.js';
import { errorMessage, invalidProjection } from './projection-common.js';
import { projectV2RunStatusFromRunFolder } from './v2-run-folder.js';

export class RunStatusFolderError extends Error {
  readonly code: Extract<EngineErrorCodeV1, 'folder_not_found' | 'folder_unreadable'>;
  readonly runFolder: string;

  constructor(
    code: Extract<EngineErrorCodeV1, 'folder_not_found' | 'folder_unreadable'>,
    runFolder: string,
    message: string,
  ) {
    super(message);
    this.name = 'RunStatusFolderError';
    this.code = code;
    this.runFolder = runFolder;
  }
}

function assertReadableRunFolder(runFolder: string): void {
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(runFolder);
  } catch (err) {
    const nodeCode = (err as NodeJS.ErrnoException).code;
    if (nodeCode === 'ENOENT' || nodeCode === 'ENOTDIR') {
      throw new RunStatusFolderError(
        'folder_not_found',
        runFolder,
        `run folder does not exist: ${runFolder}`,
      );
    }
    throw new RunStatusFolderError(
      'folder_unreadable',
      runFolder,
      `run folder is unreadable: ${runFolder} (${errorMessage(err)})`,
    );
  }

  if (!stat.isDirectory()) {
    throw new RunStatusFolderError(
      'folder_unreadable',
      runFolder,
      `run folder is not a directory: ${runFolder}`,
    );
  }

  try {
    // Directory execute permission is required to read files inside it.
    accessSync(runFolder, constants.R_OK | constants.X_OK);
  } catch (err) {
    throw new RunStatusFolderError(
      'folder_unreadable',
      runFolder,
      `run folder is unreadable: ${runFolder} (${errorMessage(err)})`,
    );
  }
}

export function projectRunStatusFromRunFolder(runFolder: string): RunStatusProjectionV1 {
  const resolvedRunFolder = resolve(runFolder);
  assertReadableRunFolder(resolvedRunFolder);

  let manifest: ReturnType<typeof verifyManifestSnapshotBytes>;
  try {
    manifest = verifyManifestSnapshotBytes(resolvedRunFolder);
  } catch (err) {
    return invalidProjection({
      runFolder: resolvedRunFolder,
      reason: 'manifest_invalid',
      code: 'manifest_invalid',
      message: `manifest snapshot is missing or invalid (${errorMessage(err)})`,
    });
  }

  const v2Projection = projectV2RunStatusFromRunFolder(resolvedRunFolder, manifest);
  if (v2Projection !== undefined) return v2Projection;

  return invalidProjection({
    runFolder: resolvedRunFolder,
    reason: 'unknown',
    code: RETIRED_RUNTIME_RUN_FOLDER_ERROR_CODE,
    message: RETIRED_RUNTIME_RUN_FOLDER_MESSAGE,
    manifestIdentity: {
      run_id: manifest.run_id as unknown as string,
      flow_id: manifest.flow_id as unknown as string,
    },
  });
}
