import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  type Announce,
  composeTransitionLine,
  silentAnnouncer,
} from "./announcer.js";
import {
  appendValidatedEvents,
  readGitHead,
  renderRunState,
  syncIndexedCurrentRun,
  validateManifestDocument,
  writeManifestSnapshot,
} from "./command-support.js";
import {
  recordInvocationFailed,
  recordInvocationRouted,
} from "./invocation-ledger.js";
import { requireStepById } from "./manifest-utils.js";

export interface BootstrapOptions {
  announce?: Announce;
  attachment?: "attached" | "detached";
  commandArgs?: string;
  circuitId?: string;
  entryMode: string;
  goal?: string;
  headAtStart?: string;
  invocationId?: string;
  manifestPath: string;
  projectRoot?: string;
  routedCommand?: string;
  routedTargetKind?: "built_in" | "custom_global";
  runRoot: string;
}

export interface BootstrapResult {
  activeRunPath: string;
  attachment: "attached" | "detached";
  bootstrapped: boolean;
  resumeStep: string;
  runRoot: string;
  runSlug: string;
  status: string;
  workflowId: string;
}

function assertAttachedRunRoot(projectRoot: string, runRoot: string): void {
  const canonicalProjectRoot = existsSync(projectRoot)
    ? realpathSync(projectRoot)
    : projectRoot;
  const runProjectRoot = resolve(runRoot, "..", "..", "..");
  const canonicalRunProjectRoot = existsSync(runProjectRoot)
    ? realpathSync(runProjectRoot)
    : runProjectRoot;
  const runRootLooksCanonical =
    basename(dirname(runRoot)) === "circuit-runs"
    && basename(dirname(dirname(runRoot))) === ".circuit";

  if (!runRootLooksCanonical || canonicalRunProjectRoot !== canonicalProjectRoot) {
    throw new Error(
      `attached runs must live under ${resolve(projectRoot, ".circuit", "circuit-runs")}: ${runRoot}`,
    );
  }
}

export function bootstrapRun(options: BootstrapOptions): BootstrapResult {
  const announce = options.announce ?? silentAnnouncer;
  const attachment = options.attachment ?? "attached";
  const runRoot = resolve(options.runRoot);
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const manifestPath = resolve(options.manifestPath);
  const runSlug = basename(runRoot);
  const manifestSnapshotPath = join(runRoot, "circuit.manifest.yaml");
  const existingActiveRunPath = join(runRoot, "artifacts/active-run.md");

  if (attachment === "attached") {
    assertAttachedRunRoot(projectRoot, runRoot);
  }

  if (!existsSync(manifestPath)) {
    recordInvocationFailed({
      commandArgs: options.commandArgs,
      failureReason: `manifest not found: ${manifestPath}`,
      homeDir: process.env.HOME ?? undefined,
      invocationId: options.invocationId,
      projectRoot,
      requestedCommand: options.routedCommand,
    });
    throw new Error(`manifest not found: ${manifestPath}`);
  }

  if (!existsSync(manifestSnapshotPath) && existsSync(existingActiveRunPath)) {
    recordInvocationFailed({
      commandArgs: options.commandArgs,
      failureReason: `refusing to bootstrap over run root without manifest snapshot: ${runRoot}`,
      homeDir: process.env.HOME ?? undefined,
      invocationId: options.invocationId,
      projectRoot,
      requestedCommand: options.routedCommand,
    });
    throw new Error(
      `refusing to bootstrap over run root without manifest snapshot: ${runRoot}`,
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
  const startStepManifest = requireStepById(manifest, startStep);

  mkdirSync(join(runRoot, "artifacts"), { recursive: true });
  mkdirSync(join(runRoot, "phases"), { recursive: true });
  mkdirSync(join(runRoot, "checkpoints"), { recursive: true });

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

  const resolvedCircuitId =
    options.circuitId
    ?? ((manifest.circuit as Record<string, any>)?.id as string | undefined)
    ?? runSlug;

  if (bootstrapped) {
    announce(
      composeTransitionLine({
        kind: "bootstrap",
        stepId: startStep,
        stepTitle:
          typeof startStepManifest.title === "string"
            ? (startStepManifest.title as string)
            : undefined,
        workflowId: resolvedCircuitId,
      }),
    );
  }

  let renderResult: ReturnType<typeof renderRunState>;
  try {
    renderResult = renderRunState(runRoot);
  } catch (err) {
    recordInvocationFailed({
      commandArgs: options.commandArgs,
      failureReason: `render failed: ${err instanceof Error ? err.message : String(err)}`,
      homeDir: process.env.HOME ?? undefined,
      invocationId: options.invocationId,
      projectRoot,
      requestedCommand: options.routedCommand,
    });
    throw err;
  }

  if (attachment === "attached") {
    syncIndexedCurrentRun(projectRoot, runRoot, renderResult);
  }

  if (attachment === "attached") {
    // Best-effort: record successful routing in the invocation ledger.
    recordInvocationRouted({
      commandArgs: options.commandArgs,
      circuitId: resolvedCircuitId,
      entryMode: options.entryMode,
      goal: options.goal,
      homeDir: process.env.HOME ?? undefined,
      invocationId: options.invocationId,
      projectRoot,
      requestedCommand: options.routedCommand,
      routedCommand: options.routedCommand ?? `circuit:${resolvedCircuitId}`,
      routedTargetKind: options.routedTargetKind ?? "built_in",
      runId: runSlug,
      runRoot,
    });
  }

  return {
    activeRunPath: renderResult.activeRunPath,
    attachment,
    bootstrapped,
    resumeStep: startStep,
    runRoot,
    runSlug,
    status: renderResult.status,
    workflowId: resolvedCircuitId,
  };
}
