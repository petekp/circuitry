import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  appendValidatedEvents,
  readGitHead,
  renderRunState,
  updateCurrentRunPointer,
  validateManifestDocument,
  writeManifestSnapshot,
} from "./command-support.js";
import { requireStepById } from "./manifest-utils.js";

export interface BootstrapOptions {
  entryMode: string;
  goal?: string;
  headAtStart?: string;
  manifestPath: string;
  projectRoot?: string;
  runRoot: string;
}

export interface BootstrapResult {
  activeRunPath: string;
  bootstrapped: boolean;
  currentRunPointer: string;
  pointerMode: "file" | "symlink";
  resumeStep: string;
  runRoot: string;
  runSlug: string;
  status: string;
}

export function bootstrapRun(options: BootstrapOptions): BootstrapResult {
  const runRoot = resolve(options.runRoot);
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const manifestPath = resolve(options.manifestPath);
  const runSlug = basename(runRoot);
  const manifestSnapshotPath = join(runRoot, "circuit.manifest.yaml");
  const legacyActiveRunPath = join(runRoot, "artifacts/active-run.md");

  if (!existsSync(manifestPath)) {
    throw new Error(`manifest not found: ${manifestPath}`);
  }

  if (!existsSync(manifestSnapshotPath) && existsSync(legacyActiveRunPath)) {
    throw new Error(
      `refusing to bootstrap over legacy run root without manifest snapshot: ${runRoot}`,
    );
  }

  const manifestContent = readFileSync(manifestPath, "utf-8");
  const manifest = parseYaml(manifestContent) as Record<string, unknown>;
  validateManifestDocument(manifest);

  const entryModes = (manifest.circuit as Record<string, any>).entry_modes ?? {};
  const selectedMode = entryModes[options.entryMode];
  if (!selectedMode) {
    throw new Error(`entry mode not found in manifest: ${options.entryMode}`);
  }
  const startStep = selectedMode.start_at as string;
  requireStepById(manifest, startStep);

  mkdirSync(join(runRoot, "artifacts"), { recursive: true });
  mkdirSync(join(runRoot, "phases"), { recursive: true });

  let bootstrapped = false;
  if (existsSync(manifestSnapshotPath)) {
    const existingContent = readFileSync(manifestSnapshotPath, "utf-8");
    if (existingContent !== manifestContent) {
      throw new Error(
        `manifest snapshot mismatch for existing run root: ${runRoot}`,
      );
    }
  } else {
    writeManifestSnapshot(runRoot, manifestContent);
  }

  const eventsPath = join(runRoot, "events.ndjson");
  if (!existsSync(eventsPath)) {
    const payload: Record<string, unknown> = {
      manifest_path: "circuit.manifest.yaml",
      entry_mode: options.entryMode,
      head_at_start: options.headAtStart ?? readGitHead(projectRoot),
    };
    if (options.goal) {
      payload.goal = options.goal;
    }

    appendValidatedEvents(runRoot, [
      {
        eventType: "run_started",
        payload,
      },
      {
        eventType: "step_started",
        payload: {
          step_id: startStep,
        },
        stepId: startStep,
      },
    ]);
    bootstrapped = true;
  }

  const renderResult = renderRunState(runRoot);
  const pointer = updateCurrentRunPointer(projectRoot, runRoot);

  return {
    activeRunPath: renderResult.activeRunPath,
    bootstrapped,
    currentRunPointer: pointer.path,
    pointerMode: pointer.mode,
    resumeStep: startStep,
    runRoot,
    runSlug,
    status: renderResult.status,
  };
}
