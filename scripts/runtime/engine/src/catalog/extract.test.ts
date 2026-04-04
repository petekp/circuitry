import { describe, it, expect } from "vitest";
import { extract } from "./extract.js";

const SKILL_MD_CIRCUIT = `---
name: circuit:run
description: Adaptive supergraph circuit.
---

# Run`;

const SKILL_MD_UTILITY = `---
name: workers
description: Autonomous batch orchestrator.
---

# Workers`;

const CIRCUIT_YAML = `schema_version: "2"
circuit:
  id: run
  version: "2026-04-03"
  purpose: >
    Adaptive supergraph circuit.

  entry:
    command: /circuit
    expert_command: /circuit:run
    signals:
      include: [clear_approach]
      exclude: []

  entry_modes:
    default:
      start_at: triage
      description: Triage classifies to quick, researched, or adversarial.
    quick:
      start_at: triage
      description: Intent hint.

  steps: []
`;

const CIRCUIT_YAML_NO_COMMAND = `schema_version: "2"
circuit:
  id: cleanup
  version: "2026-04-01"
  purpose: Systematic cleanup.

  entry:
    expert_command: /circuit:cleanup
    signals:
      include: []
      exclude: []

  entry_modes:
    default:
      start_at: cleanup-scope
      description: Interactive cleanup.

  steps: []
`;

function makeFs(files: Record<string, string>) {
  return {
    readFile: (p: string) => {
      if (!(p in files)) throw new Error(`ENOENT: ${p}`);
      return files[p];
    },
    readDir: (p: string) => {
      const prefix = p.endsWith("/") ? p : p + "/";
      const dirs = new Set<string>();
      for (const key of Object.keys(files)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const seg = rest.split("/")[0];
          dirs.add(seg);
        }
      }
      return [...dirs].sort();
    },
    exists: (p: string) => p in files,
  };
}

describe("extract", () => {
  it("extracts a circuit entry from circuit.yaml + SKILL.md", () => {
    const fs = makeFs({
      "skills/run/SKILL.md": SKILL_MD_CIRCUIT,
      "skills/run/circuit.yaml": CIRCUIT_YAML,
    });

    const catalog = extract("skills", fs);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      kind: "circuit",
      id: "run",
      dir: "run",
      version: "2026-04-03",
      purpose: "Adaptive supergraph circuit.",
      entryCommand: "/circuit",
      expertCommand: "/circuit:run",
      entryModes: ["default", "quick"],
      skillName: "circuit:run",
      skillDescription: "Adaptive supergraph circuit.",
    });
  });

  it("extracts a utility entry when no circuit.yaml exists", () => {
    const fs = makeFs({
      "skills/workers/SKILL.md": SKILL_MD_UTILITY,
    });

    const catalog = extract("skills", fs);
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      kind: "utility",
      id: "workers",
      dir: "workers",
      skillName: "workers",
      skillDescription: "Autonomous batch orchestrator.",
    });
  });

  it("sorts entries alphabetically by directory name", () => {
    const fs = makeFs({
      "skills/workers/SKILL.md": SKILL_MD_UTILITY,
      "skills/run/SKILL.md": SKILL_MD_CIRCUIT,
      "skills/run/circuit.yaml": CIRCUIT_YAML,
      "skills/cleanup/SKILL.md": `---\nname: circuit:cleanup\ndescription: Cleanup.\n---\n# Cleanup`,
      "skills/cleanup/circuit.yaml": CIRCUIT_YAML_NO_COMMAND,
    });

    const catalog = extract("skills", fs);
    expect(catalog.map((e) => e.dir)).toEqual(["cleanup", "run", "workers"]);
  });

  it("produces deterministic output for identical input", () => {
    const fs = makeFs({
      "skills/run/SKILL.md": SKILL_MD_CIRCUIT,
      "skills/run/circuit.yaml": CIRCUIT_YAML,
      "skills/workers/SKILL.md": SKILL_MD_UTILITY,
    });

    const a = JSON.stringify(extract("skills", fs));
    const b = JSON.stringify(extract("skills", fs));
    expect(a).toBe(b);
  });

  it("throws on missing SKILL.md frontmatter", () => {
    const fs = makeFs({
      "skills/bad/SKILL.md": "# No frontmatter here",
    });

    expect(() => extract("skills", fs)).toThrow("no YAML frontmatter found");
  });

  it("throws on malformed YAML in SKILL.md frontmatter", () => {
    const fs = makeFs({
      "skills/bad/SKILL.md": "---\n: invalid: yaml: [[\n---\n# Bad",
    });

    expect(() => extract("skills", fs)).toThrow("YAML parse error");
  });

  it("throws on malformed circuit.yaml", () => {
    const fs = makeFs({
      "skills/bad/SKILL.md": `---\nname: circuit:bad\ndescription: Bad.\n---\n# Bad`,
      "skills/bad/circuit.yaml": "just: a string",
    });

    expect(() => extract("skills", fs)).toThrow("missing or invalid 'circuit' key");
  });

  it("handles circuit without entry.command (only expert_command)", () => {
    const fs = makeFs({
      "skills/cleanup/SKILL.md": `---\nname: circuit:cleanup\ndescription: Cleanup.\n---\n# Cleanup`,
      "skills/cleanup/circuit.yaml": CIRCUIT_YAML_NO_COMMAND,
    });

    const catalog = extract("skills", fs);
    expect(catalog[0]).toMatchObject({
      kind: "circuit",
      entryCommand: undefined,
      expertCommand: "/circuit:cleanup",
    });
  });
});
