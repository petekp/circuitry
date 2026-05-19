import { describe, expect, it } from "vitest";

import { materializeRuntimeView } from "./materialize-view.js";
import type {
  ActiveRunRenderRequest,
  ContinuityClearIntent,
  ContinuitySyncIntent,
  MaterializeRuntimeViewDeps,
  ProjectionWriteRequest,
} from "./ports.js";
import type {
  CircuitId,
  EntryModeId,
  GitHead,
  ManifestSnapshotPath,
  ProjectRootPath,
  RuntimeFailure,
  RuntimeManifestSnapshot,
  RuntimeMaterializationPlan,
  RuntimeMessage,
  RuntimeProjection,
  RunId,
  RunRootPath,
  SafeRelativePath,
} from "./types.js";

const ref = {
  runRoot: "/tmp/circuit-runs/run-001" as RunRootPath,
};
const runId = "run-001" as RunId;
const projectRoot = "/tmp/project" as ProjectRootPath;

const manifest: RuntimeManifestSnapshot = {
  schema_version: "2",
  manifestPath: "circuit.manifest.yaml" as ManifestSnapshotPath,
  circuitId: "test-circuit" as CircuitId,
  version: "2026-04-17",
  steps: [],
};

const projection: RuntimeProjection = {
  runId,
  circuitId: manifest.circuitId,
  manifestVersion: manifest.version,
  status: "initialized",
  selectedEntryMode: "default" as EntryModeId,
  git: {
    headAtStart: "abc1234" as GitHead,
  },
  artifacts: [],
  jobs: [],
  checkpoints: [],
  routes: [],
};

const writeAllNoContinuity: RuntimeMaterializationPlan = {
  projection: {
    stateJson: "write",
    activeRunMarkdown: "write",
    reason: "render",
  },
  continuity: {
    kind: "none",
  },
};

function failure(message: string): RuntimeFailure<"projection_materialization_failed"> {
  return {
    kind: "projection_materialization_failed",
    message: message as RuntimeMessage,
    retryable: true,
  };
}

function deps(
  overrides: Partial<MaterializeRuntimeViewDeps> = {},
): MaterializeRuntimeViewDeps & {
  readonly stateWrites: ProjectionWriteRequest[];
  readonly activeRunRenders: ActiveRunRenderRequest[];
  readonly syncs: ContinuitySyncIntent[];
  readonly clears: ContinuityClearIntent[];
} {
  const stateWrites: ProjectionWriteRequest[] = [];
  const activeRunRenders: ActiveRunRenderRequest[] = [];
  const syncs: ContinuitySyncIntent[] = [];
  const clears: ContinuityClearIntent[] = [];

  return {
    stateWrites,
    activeRunRenders,
    syncs,
    clears,
    projectionWriter:
      overrides.projectionWriter ?? {
        writeStateProjection(request) {
          stateWrites.push(request);

          return {
            ok: true,
            value: {
              ref: request.ref,
              statePath: "state.json" as SafeRelativePath,
            },
          };
        },
      },
    activeRunRenderer:
      overrides.activeRunRenderer ?? {
        renderActiveRun(request) {
          activeRunRenders.push(request);

          return {
            ok: true,
            value: {
              ref: request.ref,
              activeRunPath: "artifacts/active-run.md" as SafeRelativePath,
            },
          };
        },
      },
    continuity:
      overrides.continuity ?? {
        syncCurrentRun(intent) {
          syncs.push(intent);

          return {
            ok: true,
            value: {
              materialization: {
                ok: true,
                projectionStatus: "written",
                continuityStatus: "applied",
              },
            },
          };
        },
        clearCurrentRun(intent) {
          clears.push(intent);

          return {
            ok: true,
            value: {
              materialization: {
                ok: true,
                projectionStatus: "written",
                continuityStatus: "applied",
              },
            },
          };
        },
      },
  };
}

describe("materializeRuntimeView", () => {
  it("writes requested projection surfaces without touching continuity", () => {
    const testDeps = deps();

    const receipt = materializeRuntimeView({
      ref,
      projection,
      plan: writeAllNoContinuity,
      deps: testDeps,
    });

    expect(receipt).toEqual({
      kind: "materialization",
      ref,
      materialization: {
        ok: true,
        projectionStatus: "written",
        continuityStatus: "skipped",
      },
    });
    expect(testDeps.stateWrites).toEqual([{ ref, projection }]);
    expect(testDeps.activeRunRenders).toEqual([{ ref, projection }]);
    expect(testDeps.syncs).toEqual([]);
    expect(testDeps.clears).toEqual([]);
  });

  it("applies explicit continuity intent after skipped projection writes", () => {
    const testDeps = deps();
    const plan: RuntimeMaterializationPlan = {
      projection: {
        stateJson: "skip",
        activeRunMarkdown: "skip",
        reason: "session_start",
      },
      continuity: {
        kind: "sync-current-run",
        projectRoot,
        runRoot: ref.runRoot,
        runId,
      },
    };

    const receipt = materializeRuntimeView({
      ref,
      projection,
      plan,
      deps: testDeps,
    });

    expect(receipt.materialization).toEqual({
      ok: true,
      projectionStatus: "skipped",
      continuityStatus: "applied",
    });
    expect(testDeps.stateWrites).toEqual([]);
    expect(testDeps.activeRunRenders).toEqual([]);
    expect(testDeps.syncs).toEqual([plan.continuity]);
  });

  it("does not render or touch continuity after state projection fails", () => {
    const writeFailure = failure("state write failed");
    const testDeps = deps({
      projectionWriter: {
        writeStateProjection() {
          return {
            ok: false,
            failure: writeFailure,
          };
        },
      },
    });

    const receipt = materializeRuntimeView({
      ref,
      projection,
      plan: {
        projection: {
          stateJson: "write",
          activeRunMarkdown: "write",
          reason: "render",
        },
        continuity: {
          kind: "clear-current-run",
          projectRoot,
          runRoot: ref.runRoot,
          runId,
        },
      },
      deps: testDeps,
    });

    expect(receipt.materialization).toEqual({
      ok: false,
      failure: writeFailure,
      projectionStatus: "failed",
      continuityStatus: "skipped",
    });
    expect(testDeps.activeRunRenders).toEqual([]);
    expect(testDeps.syncs).toEqual([]);
    expect(testDeps.clears).toEqual([]);
  });

  it("does not touch continuity after active-run render fails", () => {
    const renderFailure = failure("active run render failed");
    const testDeps = deps({
      activeRunRenderer: {
        renderActiveRun() {
          return {
            ok: false,
            failure: renderFailure,
          };
        },
      },
    });

    const receipt = materializeRuntimeView({
      ref,
      projection,
      plan: {
        projection: {
          stateJson: "write",
          activeRunMarkdown: "write",
          reason: "render",
        },
        continuity: {
          kind: "sync-current-run",
          projectRoot,
          runRoot: ref.runRoot,
          runId,
        },
      },
      deps: testDeps,
    });

    expect(receipt.materialization).toEqual({
      ok: false,
      failure: renderFailure,
      projectionStatus: "failed",
      continuityStatus: "skipped",
    });
    expect(testDeps.stateWrites).toEqual([{ ref, projection }]);
    expect(testDeps.syncs).toEqual([]);
    expect(testDeps.clears).toEqual([]);
  });

  it("reports continuity failure after successful projection writes", () => {
    const continuityFailure: RuntimeFailure<"projection_materialization_failed"> & {
      readonly diagnostics: {
        readonly source: "continuity";
        readonly details: Readonly<Record<string, unknown>>;
      };
    } = {
      kind: "projection_materialization_failed",
      message: "continuity failed" as RuntimeMessage,
      retryable: true,
      diagnostics: {
        source: "continuity",
        details: {},
      },
    };
    const testDeps = deps({
      continuity: {
        syncCurrentRun() {
          return {
            ok: false,
            failure: continuityFailure,
          };
        },
        clearCurrentRun() {
          throw new Error("clear should not be called");
        },
      },
    });

    const receipt = materializeRuntimeView({
      ref,
      projection,
      plan: {
        projection: {
          stateJson: "write",
          activeRunMarkdown: "skip",
          reason: "render",
        },
        continuity: {
          kind: "sync-current-run",
          projectRoot,
          runRoot: ref.runRoot,
          runId,
        },
      },
      deps: testDeps,
    });

    expect(receipt.materialization).toEqual({
      ok: false,
      failure: continuityFailure,
      projectionStatus: "written",
      continuityStatus: "failed",
    });
    expect(testDeps.stateWrites).toEqual([{ ref, projection }]);
    expect(testDeps.activeRunRenders).toEqual([]);
  });

  it("clears continuity when explicit clear intent succeeds", () => {
    const testDeps = deps();
    const plan: RuntimeMaterializationPlan = {
      projection: {
        stateJson: "skip",
        activeRunMarkdown: "skip",
        reason: "render",
      },
      continuity: {
        kind: "clear-current-run",
        projectRoot,
        runRoot: ref.runRoot,
        runId,
      },
    };

    const receipt = materializeRuntimeView({
      ref,
      projection,
      plan,
      deps: testDeps,
    });

    expect(receipt.materialization).toEqual({
      ok: true,
      projectionStatus: "skipped",
      continuityStatus: "applied",
    });
    expect(testDeps.syncs).toEqual([]);
    expect(testDeps.clears).toEqual([plan.continuity]);
  });
});
