import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { bootstrapRun } from "./bootstrap.js";
import { appendValidatedEvents, loadOrDeriveValidatedState } from "./command-support.js";
import { completeSynthesisStep } from "./complete-synthesis.js";
import {
  makeTempProject,
  readEvents,
  readState,
  writeManifestFile,
  writeRunFile,
} from "./outer-engine-test-utils.js";

function makeSynthesisManifest() {
  return {
    schema_version: "2",
    circuit: {
      id: "synthesis-test",
      version: "2026-04-10",
      purpose: "Synthesis command tests",
      entry: {
        signals: {
          include: ["feature"],
        },
      },
      entry_modes: {
        default: {
          start_at: "plan",
        },
      },
      steps: [
        {
          id: "plan",
          title: "Plan",
          executor: "orchestrator",
          kind: "synthesis",
          protocol: "plan@v1",
          reads: ["user.task"],
          writes: {
            artifact: {
              path: "artifacts/plan.md",
              schema: "plan@v1",
            },
          },
          gate: {
            kind: "schema_sections",
            source: "artifacts/plan.md",
            required: ["Approach", "Verification Commands"],
          },
          routes: {
            pass: "close",
          },
        },
        {
          id: "close",
          title: "Close",
          executor: "orchestrator",
          kind: "synthesis",
          protocol: "close@v1",
          reads: ["artifacts/plan.md"],
          writes: {
            artifact: {
              path: "artifacts/result.md",
              schema: "result@v1",
            },
          },
          gate: {
            kind: "schema_sections",
            source: "artifacts/result.md",
            required: ["Changes", "Verification", "PR Summary"],
          },
          routes: {
            pass: "@complete",
          },
        },
      ],
    },
  };
}

function makePluralWritesManifest() {
  return {
    schema_version: "2",
    circuit: {
      id: "synthesis-plural-test",
      version: "2026-04-15",
      purpose: "Plural writes synthesis tests",
      entry: {
        signals: {
          include: ["decision"],
        },
      },
      entry_modes: {
        default: {
          start_at: "decide",
        },
      },
      steps: [
        {
          id: "decide",
          title: "Decide/Plan",
          executor: "orchestrator",
          kind: "synthesis",
          protocol: "plural-decide@v1",
          reads: ["user.task"],
          writes: {
            artifacts: [
              { path: "artifacts/plan.md", schema: "plan@v1" },
              { path: "artifacts/decision.md", schema: "decision@v1" },
            ],
          },
          gate: {
            kind: "schema_sections",
            source: "artifacts/plan.md",
            required: ["Approach"],
            alternate_source: "artifacts/decision.md",
            alternate_required: ["Decision", "Rationale"],
          },
          routes: {
            pass: "close",
          },
        },
        {
          id: "close",
          title: "Close",
          executor: "orchestrator",
          kind: "synthesis",
          protocol: "close@v1",
          reads: ["artifacts/plan.md"],
          writes: {
            artifact: {
              path: "artifacts/result.md",
              schema: "result@v1",
            },
          },
          gate: {
            kind: "schema_sections",
            source: "artifacts/result.md",
            required: ["Changes", "Verification", "PR Summary"],
          },
          routes: {
            pass: "@complete",
          },
        },
      ],
    },
  };
}

function createPluralWritesRun() {
  const { projectRoot, runRoot } = makeTempProject("synthesis-plural-run");
  const manifestPath = join(projectRoot, "synthesis.manifest.yaml");
  writeManifestFile(manifestPath, makePluralWritesManifest());
  bootstrapRun({
    entryMode: "default",
    goal: "Complete plural-writes synthesis",
    headAtStart: "abc1234",
    manifestPath,
    projectRoot,
    runRoot,
  });

  return { projectRoot, runRoot };
}

function createSynthesisRun() {
  const { projectRoot, runRoot } = makeTempProject("synthesis-run");
  const manifestPath = join(projectRoot, "synthesis.manifest.yaml");
  writeManifestFile(manifestPath, makeSynthesisManifest());
  bootstrapRun({
    entryMode: "default",
    goal: "Complete synthesis",
    headAtStart: "abc1234",
    manifestPath,
    projectRoot,
    runRoot,
  });

  return {
    projectRoot,
    runRoot,
  };
}

function snapshotRuntime(runRoot: string) {
  const state = loadOrDeriveValidatedState(runRoot);

  return {
    eventsBytes: readFileSync(join(runRoot, "events.ndjson"), "utf-8"),
    routes: JSON.parse(JSON.stringify(state.routes ?? {})) as Record<string, unknown>,
    state,
  };
}

function expectFailureWithoutMutation(
  runRoot: string,
  action: () => unknown,
  matcher: RegExp,
): void {
  const before = snapshotRuntime(runRoot);

  expect(action).toThrow(matcher);

  const after = snapshotRuntime(runRoot);
  expect(after.eventsBytes).toBe(before.eventsBytes);
  expect(after.state).toEqual(before.state);
  expect(after.routes).toEqual(before.routes);
}

describe("complete-synthesis", () => {
  it("passes required sections and advances", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nUse the semantic engine.\n## Verification Commands\nnpm test\n",
    );

    const result = completeSynthesisStep({ projectRoot, runRoot, step: "plan" });

    expect(result.gatePassed).toBe(true);
    expect(result.route).toBe("close");
    expect(readState(runRoot).current_step).toBe("close");
  });

  it("emits run_completed when close passes", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nUse the semantic engine.\n## Verification Commands\nnpm test\n",
    );
    completeSynthesisStep({ projectRoot, runRoot, step: "plan" });
    writeRunFile(
      runRoot,
      "artifacts/result.md",
      "# Result\n## Changes\nDone.\n## Verification\nPassed.\n## PR Summary\nReady.\n",
    );

    const result = completeSynthesisStep({ projectRoot, runRoot, step: "close" });
    const events = readEvents(runRoot);

    expect(result.route).toBe("@complete");
    expect(readState(runRoot).status).toBe("completed");
    expect(events.at(-1)?.event_type).toBe("run_completed");
  });

  it("fails without route advancement when required sections are missing", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nMissing verification commands.\n",
    );

    expect(() =>
      completeSynthesisStep({ projectRoot, runRoot, step: "plan" }),
    ).toThrow(/missing required sections/i);

    const state = readState(runRoot);
    expect(state.routes.plan).toBeUndefined();
    expect(state.current_step).toBe("plan");
    expect(state.artifacts["artifacts/plan.md"].status).toBe("complete");
  });

  it("rejects a non-current synthesis step without mutating runtime state", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/result.md",
      "# Result\n## Changes\nDone.\n## Verification\nPassed.\n## PR Summary\nReady.\n",
    );

    expectFailureWithoutMutation(
      runRoot,
      () => completeSynthesisStep({ projectRoot, runRoot, step: "close" }),
      /complete-synthesis/i,
    );
  });

  it("rejects synthesis completion outside in_progress without mutating runtime state", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nUse the semantic engine.\n## Verification Commands\nnpm test\n",
    );
    appendValidatedEvents(runRoot, [
      {
        attempt: 1,
        eventType: "dispatch_requested",
        payload: {
          attempt: 1,
          protocol: "plan@v1",
          request_path: "jobs/plan-1.request.json",
        },
        stepId: "plan",
      },
    ]);

    expectFailureWithoutMutation(
      runRoot,
      () => completeSynthesisStep({ projectRoot, runRoot, step: "plan" }),
      /complete-synthesis/i,
    );
  });

  it("rejects route overrides that do not match the manifest route without mutating runtime state", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nUse the semantic engine.\n## Verification Commands\nnpm test\n",
    );

    expectFailureWithoutMutation(
      runRoot,
      () =>
        completeSynthesisStep({
          projectRoot,
          runRoot,
          route: "@complete",
          step: "plan",
        }),
      /route/i,
    );
  });

  it("passes a plural-writes step when the primary gate source is satisfied", () => {
    const { projectRoot, runRoot } = createPluralWritesRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nChoose option A.\n",
    );
    writeRunFile(
      runRoot,
      "artifacts/decision.md",
      "# Decision\n## Decision\nGo with option A.\n## Rationale\nHighest leverage.\n",
    );

    const result = completeSynthesisStep({ projectRoot, runRoot, step: "decide" });

    expect(result.gatePassed).toBe(true);
    expect(result.route).toBe("close");
    expect(readState(runRoot).current_step).toBe("close");

    const events = readEvents(runRoot);
    const written = events
      .filter((e) => e.event_type === "artifact_written")
      .map((e) => e.payload.artifact_path);
    expect(written).toEqual([
      "artifacts/plan.md",
      "artifacts/decision.md",
    ]);
  });

  it("passes a plural-writes step when only the alternate gate source is satisfied", () => {
    const { projectRoot, runRoot } = createPluralWritesRun();
    writeRunFile(
      runRoot,
      "artifacts/decision.md",
      "# Decision\n## Decision\nGo with option B.\n## Rationale\nLower risk.\n",
    );

    const result = completeSynthesisStep({ projectRoot, runRoot, step: "decide" });

    expect(result.gatePassed).toBe(true);
    expect(result.route).toBe("close");
    expect(readState(runRoot).current_step).toBe("close");
  });

  it("fails a plural-writes step when neither source satisfies the gate", () => {
    const { projectRoot, runRoot } = createPluralWritesRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\nNo Approach heading here.\n",
    );
    writeRunFile(
      runRoot,
      "artifacts/decision.md",
      "# Decision\nNo required headings.\n",
    );

    expect(() =>
      completeSynthesisStep({ projectRoot, runRoot, step: "decide" }),
    ).toThrow(/missing required sections/i);

    const state = readState(runRoot);
    expect(state.routes.decide).toBeUndefined();
    expect(state.current_step).toBe("decide");
  });

  it("is idempotent after success", () => {
    const { projectRoot, runRoot } = createSynthesisRun();
    writeRunFile(
      runRoot,
      "artifacts/plan.md",
      "# Plan\n## Approach\nUse the semantic engine.\n## Verification Commands\nnpm test\n",
    );
    completeSynthesisStep({ projectRoot, runRoot, step: "plan" });
    const before = readEvents(runRoot).length;

    const result = completeSynthesisStep({ projectRoot, runRoot, step: "plan" });

    expect(result.noOp).toBe(true);
    expect(readEvents(runRoot)).toHaveLength(before);
  });
});
