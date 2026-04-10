import { describe, expect, it } from "vitest";

import {
  createBuildRun,
  writeFrameInputs,
} from "./build-run-test-helpers.js";
import { requestCheckpoint, resolveCheckpoint } from "./checkpoint-step.js";
import { readEvents, readState, writeRunJson } from "./outer-engine-test-utils.js";

describe("checkpoint-step", () => {
  it("handles request and resolution happy path", () => {
    const { runRoot } = createBuildRun();
    writeFrameInputs(runRoot);

    requestCheckpoint({ runRoot, step: "frame" });
    writeRunJson(runRoot, "checkpoints/frame-1.response.json", {
      selection: "continue",
    });
    const result = resolveCheckpoint({ runRoot, step: "frame" });

    expect(result.gatePassed).toBe(true);
    expect(result.selection).toBe("continue");
    expect(readState(runRoot).current_step).toBe("plan");
  });

  it("supports the auto-resolve continue path for non-deep frame", () => {
    const { runRoot } = createBuildRun();
    writeFrameInputs(runRoot);
    requestCheckpoint({ runRoot, step: "frame" });
    writeRunJson(runRoot, "checkpoints/frame-1.response.json", {
      selection: "continue",
    });

    const result = resolveCheckpoint({ runRoot, step: "frame" });

    expect(result.route).toBe("plan");
    expect(readState(runRoot).routes.frame).toBe("plan");
  });

  it("leaves the step incomplete on invalid selection", () => {
    const { runRoot } = createBuildRun();
    writeFrameInputs(runRoot);
    requestCheckpoint({ runRoot, step: "frame" });
    writeRunJson(runRoot, "checkpoints/frame-1.response.json", {
      selection: "invalid",
    });

    expect(() =>
      resolveCheckpoint({ runRoot, step: "frame" }),
    ).toThrow(/does not satisfy checkpoint gate/i);

    const state = readState(runRoot);
    expect(state.current_step).toBe("frame");
    expect(state.routes.frame).toBeUndefined();
  });

  it("is idempotent after resolution", () => {
    const { runRoot } = createBuildRun();
    writeFrameInputs(runRoot);
    requestCheckpoint({ runRoot, step: "frame" });
    writeRunJson(runRoot, "checkpoints/frame-1.response.json", {
      selection: "continue",
    });
    resolveCheckpoint({ runRoot, step: "frame" });
    const before = readEvents(runRoot).length;

    const result = resolveCheckpoint({ runRoot, step: "frame" });

    expect(result.noOp).toBe(true);
    expect(readEvents(runRoot)).toHaveLength(before);
  });
});
