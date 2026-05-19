import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadJsonSchema, REPO_ROOT } from "../schema.js";
import { RUNTIME_EVENT_TYPES, RUNTIME_FAILURE_KINDS } from "./types.js";

interface EventSchemaShape {
  readonly properties?: {
    readonly event_type?: {
      readonly enum?: readonly string[];
    };
  };
}

interface ForbiddenImport {
  readonly label: string;
  readonly matches: (specifier: string) => boolean;
}

interface RuntimeCoreImportRule {
  readonly path: string;
  readonly forbidden: readonly ForbiddenImport[];
}

const RUNTIME_CORE_ROOT = "scripts/runtime/engine/src/runtime-core";

const RUNTIME_CORE_CONTRACT_FILES = [
  `${RUNTIME_CORE_ROOT}/types.ts`,
  `${RUNTIME_CORE_ROOT}/ports.ts`,
  `${RUNTIME_CORE_ROOT}/idempotence.ts`,
  `${RUNTIME_CORE_ROOT}/project-ledger.ts`,
  `${RUNTIME_CORE_ROOT}/inspect-runtime.ts`,
  `${RUNTIME_CORE_ROOT}/observe-facts.ts`,
  `${RUNTIME_CORE_ROOT}/plan-command.ts`,
  `${RUNTIME_CORE_ROOT}/commit-ledger.ts`,
  `${RUNTIME_CORE_ROOT}/materialize-view.ts`,
  `${RUNTIME_CORE_ROOT}/memory-ledger.ts`,
  `${RUNTIME_CORE_ROOT}/index.ts`,
  `${RUNTIME_CORE_ROOT}/node-runtime-deps.ts`,
] as const;

const OLD_COMMAND_MODULE_STEMS = new Set([
  "bootstrap",
  "checkpoint-step",
  "complete-synthesis",
  "dispatch-step",
  "abort-run",
  "resume",
  "render-active-run",
  "command-support",
  "derive-state",
]);

const EXACT_FAILURE_KINDS = [
  "precondition_failed",
  "missing_observed_file",
  "invalid_observed_file",
  "gate_failed",
  "route_invalid",
  "worker_non_passing",
  "worker_partial",
  "worker_blocked",
  "runtime_corrupt",
  "projection_materialization_failed",
  "manifest_invalid",
  "expected_revision_mismatch",
  "ledger_append_failed",
] as const;

function stripJsExtension(specifier: string): string {
  return specifier.replace(/\.(?:c|m)?js$/, "");
}

function moduleStem(specifier: string): string {
  const normalized = stripJsExtension(specifier);
  return normalized.split("/").at(-1) ?? normalized;
}

function importsOldCommandModule(specifier: string): boolean {
  return OLD_COMMAND_MODULE_STEMS.has(moduleStem(specifier));
}

function importsCliModule(specifier: string): boolean {
  return specifier.includes("/cli/") || specifier.startsWith("../cli/");
}

function importsNodeRuntime(specifier: string): boolean {
  return specifier.startsWith("node:") || specifier === "fs";
}

function importsSchemaModule(specifier: string): boolean {
  return moduleStem(specifier) === "schema" || specifier.includes("/schemas/");
}

function importsContinuityModule(specifier: string): boolean {
  return specifier.includes("continuity");
}

function importsDispatchTransport(specifier: string): boolean {
  return moduleStem(specifier) === "dispatch" || moduleStem(specifier) === "dispatch-step";
}

function importsRenderer(specifier: string): boolean {
  return moduleStem(specifier) === "render-active-run";
}

function importsInvocationLedger(specifier: string): boolean {
  return moduleStem(specifier) === "invocation-ledger";
}

function forbidden(label: string, matches: (specifier: string) => boolean): ForbiddenImport {
  return { label, matches };
}

const oldCommandImportRule = forbidden("old command mini-runtime import", importsOldCommandModule);
const cliImportRule = forbidden("CLI import", importsCliModule);
const rendererImportRule = forbidden("renderer import", importsRenderer);
const continuityImportRule = forbidden("continuity import", importsContinuityModule);
const dispatchImportRule = forbidden("dispatch transport import", importsDispatchTransport);
const invocationImportRule = forbidden("invocation ledger import", importsInvocationLedger);

const RUNTIME_CORE_IMPORT_RULES: readonly RuntimeCoreImportRule[] = [
  {
    path: `${RUNTIME_CORE_ROOT}/ports.ts`,
    forbidden: [
      forbidden("Node or filesystem import", importsNodeRuntime),
      forbidden("schema validator import", importsSchemaModule),
      cliImportRule,
      rendererImportRule,
      continuityImportRule,
      dispatchImportRule,
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/idempotence.ts`,
    forbidden: [
      forbidden("Node or filesystem import", importsNodeRuntime),
      forbidden("schema validator import", importsSchemaModule),
      cliImportRule,
      rendererImportRule,
      continuityImportRule,
      dispatchImportRule,
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/project-ledger.ts`,
    forbidden: [
      forbidden("Node or filesystem import", importsNodeRuntime),
      forbidden("schema validator import", importsSchemaModule),
      cliImportRule,
      rendererImportRule,
      continuityImportRule,
      dispatchImportRule,
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/observe-facts.ts`,
    forbidden: [
      forbidden("commit seam import", (specifier) => moduleStem(specifier) === "commit-ledger"),
      rendererImportRule,
      continuityImportRule,
      cliImportRule,
      dispatchImportRule,
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/inspect-runtime.ts`,
    forbidden: [
      forbidden("Node or filesystem import", importsNodeRuntime),
      forbidden("schema validator import", importsSchemaModule),
      forbidden("commit seam import", (specifier) => moduleStem(specifier) === "commit-ledger"),
      forbidden("planner import", (specifier) => moduleStem(specifier) === "plan-command"),
      forbidden("fact observer import", (specifier) => moduleStem(specifier) === "observe-facts"),
      forbidden("materializer import", (specifier) => moduleStem(specifier) === "materialize-view"),
      rendererImportRule,
      continuityImportRule,
      cliImportRule,
      dispatchImportRule,
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/plan-command.ts`,
    forbidden: [
      forbidden("Node or filesystem import", importsNodeRuntime),
      continuityImportRule,
      rendererImportRule,
      cliImportRule,
      dispatchImportRule,
      forbidden("schema import", importsSchemaModule),
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/commit-ledger.ts`,
    forbidden: [
      rendererImportRule,
      continuityImportRule,
      cliImportRule,
      dispatchImportRule,
      invocationImportRule,
      forbidden("projection writer import", (specifier) => moduleStem(specifier) === "derive-state"),
      forbidden("per-event append helper import", (specifier) => moduleStem(specifier) === "append-event"),
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/materialize-view.ts`,
    forbidden: [
      forbidden("event append import", (specifier) =>
        moduleStem(specifier) === "append-event" || moduleStem(specifier) === "commit-ledger",
      ),
      forbidden("planner import", (specifier) => moduleStem(specifier) === "plan-command"),
      forbidden("fact observer import", (specifier) => moduleStem(specifier) === "observe-facts"),
      dispatchImportRule,
      invocationImportRule,
      cliImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/memory-ledger.ts`,
    forbidden: [
      forbidden("Node or filesystem import", importsNodeRuntime),
      forbidden("schema validator import", importsSchemaModule),
      rendererImportRule,
      continuityImportRule,
      cliImportRule,
      dispatchImportRule,
      invocationImportRule,
      oldCommandImportRule,
    ],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/index.ts`,
    forbidden: [oldCommandImportRule],
  },
  {
    path: `${RUNTIME_CORE_ROOT}/node-runtime-deps.ts`,
    forbidden: [oldCommandImportRule],
  },
];

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf-8");
}

function stripRuntimeDiagnosticDetails(content: string): string {
  const start = content.indexOf("export interface RuntimeDiagnosticDetails");
  if (start === -1) {
    return content;
  }

  const end = content.indexOf("\n}\n", start);
  if (end === -1) {
    return content;
  }

  return `${content.slice(0, start)}${content.slice(end + "\n}\n".length)}`;
}

function findImportSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const sideEffectImportPattern = /import\s+["']([^"']+)["'];?/g;
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
  const dynamicImportPattern = /import\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of content.matchAll(sideEffectImportPattern)) {
    specifiers.push(match[1]);
  }
  for (const match of content.matchAll(importPattern)) {
    specifiers.push(match[1]);
  }
  for (const match of content.matchAll(dynamicImportPattern)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

describe("runtime-core contract ratchets", () => {
  it("keeps RuntimeEvent names in parity with schemas/event.schema.json", () => {
    const eventSchema = loadJsonSchema("schemas/event.schema.json") as EventSchemaShape;
    const schemaEventTypes = eventSchema.properties?.event_type?.enum ?? [];

    expect(new Set(schemaEventTypes).size).toBe(schemaEventTypes.length);
    expect(new Set(RUNTIME_EVENT_TYPES).size).toBe(RUNTIME_EVENT_TYPES.length);
    expect([...schemaEventTypes].sort()).toEqual([...RUNTIME_EVENT_TYPES].sort());
  });

  it("pins the exact RuntimeFailureKind union from the proof packet", () => {
    expect(RUNTIME_FAILURE_KINDS).toEqual(EXACT_FAILURE_KINDS);
  });

  it("keeps runtime-core prose examples aligned with the stricter proof packet", () => {
    const architectureSpec = readRepoFile("docs/runtime-core-architecture-spec.md");

    expect(architectureSpec).not.toContain("raw?: JsonObject");
    expect(architectureSpec).not.toContain("details?: Record<string, unknown>");
    expect(architectureSpec).toContain('| "expected_revision_mismatch"');
    expect(architectureSpec).toContain('| "ledger_append_failed"');
    expect(architectureSpec).toContain("interface RuntimeDiagnosticDetails");
  });

  it("detects every TypeScript import syntax used by runtime-core ratchets", () => {
    expect(
      findImportSpecifiers(`
        import "../bootstrap.js";
        import { x } from "../checkpoint-step.js";
        export { y } from "../dispatch-step.js";
        const z = await import("../abort-run.js");
      `),
    ).toEqual([
      "../bootstrap.js",
      "../checkpoint-step.js",
      "../dispatch-step.js",
      "../abort-run.js",
    ]);
  });

  it("keeps RuntimeDiagnosticDetails as the only arbitrary diagnostics quarantine", () => {
    const findings: string[] = [];
    const typesContent = readRepoFile(`${RUNTIME_CORE_ROOT}/types.ts`);

    expect(typesContent).toContain("export interface RuntimeDiagnosticDetails");
    expect(typesContent).toContain("readonly details: Readonly<Record<string, unknown>>;");

    for (const path of RUNTIME_CORE_CONTRACT_FILES) {
      const absolutePath = resolve(REPO_ROOT, path);
      if (!existsSync(absolutePath)) {
        continue;
      }

      const content =
        path.endsWith("/types.ts")
          ? stripRuntimeDiagnosticDetails(readRepoFile(path))
          : readRepoFile(path);

      const checks = [
        { label: "Record<string, unknown>", regex: /Record\s*<\s*string\s*,\s*unknown\s*>/ },
        { label: "unknown", regex: /\bunknown\b/ },
        { label: "any", regex: /\bany\b/ },
        { label: "raw field", regex: /(?:readonly\s+)?raw\s*[?:]/ },
      ] as const;

      for (const check of checks) {
        const match = content.match(check.regex);
        if (match) {
          const line = content.slice(0, match.index ?? 0).split("\n").length;
          findings.push(`${path}:${line} contains ${check.label}`);
        }
      }
    }

    expect(findings).toEqual([]);
  });

  it("enforces future runtime-core import boundaries while allowing missing modules", () => {
    const findings: string[] = [];

    for (const rule of RUNTIME_CORE_IMPORT_RULES) {
      const absolutePath = resolve(REPO_ROOT, rule.path);
      if (!existsSync(absolutePath)) {
        continue;
      }

      const specifiers = findImportSpecifiers(readRepoFile(rule.path));
      for (const specifier of specifiers) {
        for (const importRule of rule.forbidden) {
          if (importRule.matches(specifier)) {
            findings.push(`${rule.path} imports ${specifier}: ${importRule.label}`);
          }
        }
      }
    }

    expect(findings).toEqual([]);
  });
});
