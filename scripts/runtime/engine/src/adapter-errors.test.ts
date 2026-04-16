import { describe, expect, it } from "vitest";

import {
  classifyAdapterExitError,
  classifyAdapterStartError,
} from "./adapter-errors.js";

describe("classifyAdapterStartError", () => {
  it("classifies ENOENT as missing-tool with a remediation hint", () => {
    const result = classifyAdapterStartError("codex", "ENOENT", "circuit.config.yaml");
    expect(result.errorClass).toBe("missing-tool");
    expect(result.hint).toContain("missing-tool");
    expect(result.hint).toContain('adapter "codex"');
    expect(result.hint).toContain("dispatch.adapters.codex.command");
    expect(result.hint).toContain("resolved from circuit.config.yaml");
  });

  it("classifies EACCES and EPERM as permission with an exec hint", () => {
    const eaccesResult = classifyAdapterStartError("codex", "EACCES");
    expect(eaccesResult.errorClass).toBe("permission");
    expect(eaccesResult.hint).toContain("permission");
    expect(eaccesResult.hint).toContain("chmod +x");

    const epermResult = classifyAdapterStartError("codex", "EPERM");
    expect(epermResult.errorClass).toBe("permission");
  });

  it("classifies ENOBUFS as a resource error with a prompt-size hint", () => {
    const result = classifyAdapterStartError("codex", "ENOBUFS");
    expect(result.errorClass).toBe("resource");
    expect(result.hint).toContain("resource");
    expect(result.hint).toContain("ENOBUFS");
    expect(result.hint).toContain("prompt size");
  });

  it("omits the resolved-from pointer when none is provided", () => {
    const result = classifyAdapterStartError("codex", "ENOENT");
    expect(result.hint).toContain("missing-tool");
    expect(result.hint).not.toContain("resolved from");
  });

  it("returns unknown with null hint for unrecognized errno codes", () => {
    const result = classifyAdapterStartError("codex", "EFOO");
    expect(result.errorClass).toBe("unknown");
    expect(result.hint).toBeNull();
  });

  it("returns unknown with null hint when errno is undefined", () => {
    const result = classifyAdapterStartError("codex", undefined);
    expect(result.errorClass).toBe("unknown");
    expect(result.hint).toBeNull();
  });
});

describe("classifyAdapterExitError", () => {
  it("classifies non-zero exit as bad-config with a config-pointer hint", () => {
    const result = classifyAdapterExitError("codex", "circuit.config.yaml");
    expect(result.errorClass).toBe("bad-config");
    expect(result.hint).toContain("bad-config");
    expect(result.hint).toContain('adapter "codex"');
    expect(result.hint).toContain("resolved from circuit.config.yaml");
  });

  it("omits the config pointer when resolvedFrom is not provided", () => {
    const result = classifyAdapterExitError("codex");
    expect(result.errorClass).toBe("bad-config");
    expect(result.hint).not.toContain("resolved from");
  });
});
