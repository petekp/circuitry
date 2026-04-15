import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { bootstrapRun } from "./bootstrap.js";
import {
  createBuildRun,
  startAct,
  writeFrameInputs,
} from "./build-run-test-helpers.js";
import { appendValidatedEvents } from "./command-support.js";
import { requestCheckpoint } from "./checkpoint-step.js";
import { reconcileDispatch } from "./dispatch-step.js";
import {
  makeTempProject,
  writeManifestFile,
  writeRunJson,
} from "./outer-engine-test-utils.js";
import { renderActiveRun } from "./render-active-run.js";
import { REPO_ROOT } from "./schema.js";

function createWorkflowRun(workflowSlug: string, goal: string) {
  const { projectRoot, runRoot, slug } = makeTempProject();
  const manifestPath = join(projectRoot, `${workflowSlug}.manifest.yaml`);
  const manifest = parseYaml(
    readFileSync(join(REPO_ROOT, `skills/${workflowSlug}/circuit.yaml`), "utf-8"),
  ) as Record<string, unknown>;
  writeManifestFile(manifestPath, manifest);

  bootstrapRun({
    entryMode: "default",
    goal,
    headAtStart: "abc1234",
    manifestPath,
    projectRoot,
    runRoot,
  });

  return { manifestPath, projectRoot, runRoot, slug };
}

describe("render-active-run", () => {
  it("renders a new bootstrapped run at frame", () => {
    const { runRoot } = createBuildRun("Render the frame dashboard");

    const result = renderActiveRun(runRoot);

    expect(result.status).toBe("in_progress");
    expect(result.markdown).toContain("## Workflow\nBuild");
    expect(result.markdown).toContain("## Rigor\nStandard");
    expect(result.markdown).toContain("## Current Phase\nframe");
    expect(result.markdown).toContain("Write artifacts/brief.md, write checkpoints/frame-1.request.json, then run request-checkpoint for frame.");
    expect(result.markdown).toContain("## Verification Commands\nTBD during Frame phase");
    expect(result.markdown).toContain("## Blockers\nnone");
  });

  it("renders waiting checkpoint state", () => {
    const { projectRoot, runRoot } = createBuildRun();
    writeFrameInputs(runRoot);
    requestCheckpoint({ projectRoot, runRoot, step: "frame" });

    const markdown = renderActiveRun(runRoot).markdown;
    expect(markdown).toContain("## Current Phase\nframe");
    expect(markdown).toContain("Resolve checkpoints/frame-1.response.json and run resolve-checkpoint for frame.");
    expect(markdown).toContain("waiting on checkpoint response at checkpoints/frame-1.response.json");
    expect(markdown).toContain("## Verification Commands\nnpm test\nnpm run lint");
  });

  it("renders waiting worker, partial, blocked, and verdict-mismatch states", () => {
    const waiting = createBuildRun();
    startAct(waiting.runRoot, waiting.projectRoot, true);
    let markdown = renderActiveRun(waiting.runRoot).markdown;
    expect(markdown).toContain("## Current Phase\nact");
    expect(markdown).toContain("Reconcile phases/implement/jobs/act-1.result.json and run reconcile-dispatch for act.");
    expect(markdown).toContain("waiting on worker result at phases/implement/jobs/act-1.result.json");

    const partial = createBuildRun();
    startAct(partial.runRoot, partial.projectRoot);
    writeRunJson(partial.runRoot, "phases/implement/jobs/act-1.result.json", {
      completion: "partial",
      verdict: "issues_remain",
    });
    reconcileDispatch({
      projectRoot: partial.projectRoot,
      runRoot: partial.runRoot,
      step: "act",
    });
    markdown = renderActiveRun(partial.runRoot).markdown;
    expect(markdown).toContain("Retry dispatch for act with attempt 2.");
    expect(markdown).toContain("partial completion for act; retry with next dispatch attempt");

    const blocked = createBuildRun();
    startAct(blocked.runRoot, blocked.projectRoot);
    writeRunJson(blocked.runRoot, "phases/implement/jobs/act-1.result.json", {
      completion: "blocked",
      verdict: "issues_remain",
    });
    reconcileDispatch({
      projectRoot: blocked.projectRoot,
      runRoot: blocked.runRoot,
      step: "act",
    });
    markdown = renderActiveRun(blocked.runRoot).markdown;
    expect(markdown).toContain("Resolve the dependency blocking act, then retry dispatch.");
    expect(markdown).toContain("blocked completion for act; resolve dependency before retry");

    const mismatch = createBuildRun();
    startAct(mismatch.runRoot, mismatch.projectRoot);
    writeRunJson(mismatch.runRoot, "phases/implement/jobs/act-1.result.json", {
      completion: "complete",
      verdict: "issues_found",
    });
    reconcileDispatch({
      projectRoot: mismatch.projectRoot,
      runRoot: mismatch.runRoot,
      step: "act",
    });
    markdown = renderActiveRun(mismatch.runRoot).markdown;
    expect(markdown).toContain("Fix findings from verdict issues_found and re-dispatch act.");
    expect(markdown).toContain("verdict mismatch for act: issues_found");
  });

  it("renders completed runs from canonical replay state", () => {
    const completed = createBuildRun();
    appendValidatedEvents(completed.runRoot, [
      {
        eventType: "run_completed",
        payload: {
          status: "completed",
          terminal_target: "@complete",
        },
        stepId: "frame",
      },
    ]);

    const markdown = renderActiveRun(completed.runRoot).markdown;
    expect(markdown).toContain("## Current Phase\nclose");
    expect(markdown).toContain("## Next Step\ncomplete");
    expect(markdown).toContain("## Blockers\nnone");
  });

  it("emits canonical step id for Repair analyze despite humanized step title", () => {
    const { runRoot } = createWorkflowRun("repair", "Diagnose the flake");
    appendValidatedEvents(runRoot, [
      {
        eventType: "step_started",
        payload: { step_id: "analyze" },
        stepId: "analyze",
      },
    ]);

    const markdown = renderActiveRun(runRoot).markdown;
    expect(markdown).toContain("## Current Phase\nanalyze");
    expect(markdown).not.toContain("reproduce and isolate");
  });

  it("emits canonical step id for Explore decide despite humanized step title", () => {
    const { runRoot } = createWorkflowRun("explore", "Compare options");
    appendValidatedEvents(runRoot, [
      {
        eventType: "step_started",
        payload: { step_id: "decide" },
        stepId: "decide",
      },
    ]);

    const markdown = renderActiveRun(runRoot).markdown;
    expect(markdown).toContain("## Current Phase\ndecide");
    expect(markdown).not.toContain("decide/plan");
  });

  it("maps handed_off terminal status to pause", () => {
    const handoff = createBuildRun();
    appendValidatedEvents(handoff.runRoot, [
      {
        eventType: "run_completed",
        payload: {
          handoff_path: "artifacts/handoff.json",
          status: "handed_off",
          terminal_target: "@handoff",
        },
        stepId: "frame",
      },
    ]);

    const markdown = renderActiveRun(handoff.runRoot).markdown;
    expect(markdown).toContain("## Current Phase\npause");
  });

  it("maps stopped terminal status to pause", () => {
    const stopped = createBuildRun();
    appendValidatedEvents(stopped.runRoot, [
      {
        eventType: "run_completed",
        payload: {
          status: "stopped",
          terminal_target: "@stop",
        },
        stepId: "frame",
      },
    ]);

    const markdown = renderActiveRun(stopped.runRoot).markdown;
    expect(markdown).toContain("## Current Phase\npause");
  });
});
