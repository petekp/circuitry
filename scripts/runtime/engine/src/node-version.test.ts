import { describe, expect, it } from "vitest";

import { checkNodeMajor } from "./node-version.js";

describe("checkNodeMajor", () => {
  it("accepts a version at the minimum major", () => {
    expect(checkNodeMajor("20.0.0", 20)).toEqual({ ok: true });
  });

  it("accepts a version above the minimum major", () => {
    expect(checkNodeMajor("22.14.0", 20)).toEqual({ ok: true });
  });

  it("rejects a version below the minimum major with an actionable message", () => {
    const result = checkNodeMajor("18.19.1", 20);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain("Node 20+ required");
      expect(result.message).toContain("18.19.1");
      expect(result.message).toContain("Upgrade");
    }
  });

  it("rejects a malformed version string", () => {
    const result = checkNodeMajor("not-a-version", 20);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain("Node 20+ required");
    }
  });
});
