import { describe, expect, it } from "vitest";

import {
  advanceToReview,
  buildPlanMarkdown,
  createBuildRun,
  startAct,
  writeFrameInputs,
} from "./build-run-test-helpers.js";
import { appendValidatedEvents } from "./command-support.js";
import { requestCheckpoint } from "./checkpoint-step.js";
import { reconcileDispatch } from "./dispatch-step.js";
import { writeRunJson } from "./outer-engine-test-utils.js";
import { renderActiveRun } from "./render-active-run.js";

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
    const { runRoot } = createBuildRun();
    writeFrameInputs(runRoot);
    requestCheckpoint({ runRoot, step: "frame" });

    const markdown = renderActiveRun(runRoot).markdown;
    expect(markdown).toContain("## Current Phase\nframe");
    expect(markdown).toContain("Resolve checkpoints/frame-1.response.json and run resolve-checkpoint for frame.");
    expect(markdown).toContain("waiting on checkpoint response at checkpoints/frame-1.response.json");
    expect(markdown).toContain("## Verification Commands\nnpm test\nnpm run lint");
  });

  it("renders waiting worker, partial, blocked, and verdict-mismatch states", () => {
    const waiting = createBuildRun();
    startAct(waiting.runRoot, true);
    let markdown = renderActiveRun(waiting.runRoot).markdown;
    expect(markdown).toContain("## Current Phase\nact");
    expect(markdown).toContain("Reconcile phases/implement/jobs/act-1.result.json and run reconcile-dispatch for act.");
    expect(markdown).toContain("waiting on worker result at phases/implement/jobs/act-1.result.json");

    const partial = createBuildRun();
    startAct(partial.runRoot);
    writeRunJson(partial.runRoot, "phases/implement/jobs/act-1.result.json", {
      completion: "partial",
      verdict: "issues_remain",
    });
    reconcileDispatch({ runRoot: partial.runRoot, step: "act" });
    markdown = renderActiveRun(partial.runRoot).markdown;
    expect(markdown).toContain("Retry dispatch for act with attempt 2.");
    expect(markdown).toContain("partial completion for act; retry with next dispatch attempt");

    const blocked = createBuildRun();
    startAct(blocked.runRoot);
    writeRunJson(blocked.runRoot, "phases/implement/jobs/act-1.result.json", {
      completion: "blocked",
      verdict: "issues_remain",
    });
    reconcileDispatch({ runRoot: blocked.runRoot, step: "act" });
    markdown = renderActiveRun(blocked.runRoot).markdown;
    expect(markdown).toContain("Resolve the dependency blocking act, then retry dispatch.");
    expect(markdown).toContain("blocked completion for act; resolve dependency before retry");

    const mismatch = createBuildRun();
    startAct(mismatch.runRoot);
    writeRunJson(mismatch.runRoot, "phases/implement/jobs/act-1.result.json", {
      completion: "complete",
      verdict: "issues_found",
    });
    reconcileDispatch({ runRoot: mismatch.runRoot, step: "act" });
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
    expect(markdown).toContain("## Current Phase\ncompleted");
    expect(markdown).toContain("## Next Step\ncomplete");
    expect(markdown).toContain("## Blockers\nnone");
  });
});
