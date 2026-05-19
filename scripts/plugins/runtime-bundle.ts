#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const checkMode = process.argv.includes('--check');
const entryPoint = resolve(repoRoot, 'dist/cli/circuit.js');
const versionManifestPath = resolve(repoRoot, 'plugins/version.json');
const outputPaths = ['plugins/claude/runtime/circuit.js', 'plugins/circuit/runtime/circuit.js'];

// The bundled CLI resolves git-state.ts via `new URL('./git-state.ts',
// import.meta.url)`, so the helper must live next to circuit.js in
// every plugin runtime directory. tsc -p tsconfig.build.json does not copy
// .ts assets, so we also mirror the helper into dist/ so source-tree CLI
// runs (used by npm test and by `node dist/cli/circuit.js`) find it.
const ASSET_SIDECARS: Array<{ src: string; outs: readonly string[] }> = [
  {
    src: 'src/flows/fix/writers/git-state.ts',
    outs: [
      'plugins/claude/runtime/git-state.ts',
      'plugins/circuit/runtime/git-state.ts',
      'dist/flows/fix/writers/git-state.ts',
    ],
  },
];

function readVersion(): string {
  const raw = JSON.parse(readFileSync(versionManifestPath, 'utf8')) as { version?: unknown };
  if (typeof raw.version !== 'string' || raw.version.length === 0) {
    throw new Error(`${versionManifestPath} must contain a non-empty version string`);
  }
  return raw.version;
}

async function buildRuntimeBundle(): Promise<string> {
  if (!existsSync(entryPoint)) {
    throw new Error(`compiled CLI is missing at ${entryPoint}; run npm run build first`);
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'circuit-plugin-runtime-'));
  const tempFile = resolve(tempDir, 'circuit.js');
  try {
    await build({
      entryPoints: [entryPoint],
      outfile: tempFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      sourcemap: false,
      minify: false,
      legalComments: 'none',
      banner: {
        js: [
          '#!/usr/bin/env node',
          "import { createRequire as __circuitCreateRequire } from 'node:module';",
          'const require = __circuitCreateRequire(import.meta.url);',
        ].join('\n'),
      },
      define: {
        'process.env.CIRCUIT_VERSION': JSON.stringify(readVersion()),
      },
    });
    return readFileSync(tempFile, 'utf8');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const bundle = await buildRuntimeBundle();
let drifted = false;

for (const rel of outputPaths) {
  const outAbs = resolve(repoRoot, rel);
  if (checkMode) {
    let current: string | undefined;
    try {
      current = readFileSync(outAbs, 'utf8');
    } catch {
      current = undefined;
    }
    if (current === bundle) {
      console.log(`✓ ${rel} is in sync with the compiled CLI`);
    } else {
      console.error(`✗ ${rel} drifted from the compiled CLI; run npm run build-plugin-runtime`);
      drifted = true;
    }
  } else {
    mkdirSync(dirname(outAbs), { recursive: true });
    writeFileSync(outAbs, bundle);
    console.log(`emitted ${rel}`);
  }
}

for (const sidecar of ASSET_SIDECARS) {
  const srcAbs = resolve(repoRoot, sidecar.src);
  const sourceBody = readFileSync(srcAbs, 'utf8');
  for (const rel of sidecar.outs) {
    const outAbs = resolve(repoRoot, rel);
    // dist/* targets are gitignored local-build artifacts that tsc does not
    // emit, so they need to be brought into being in --check mode too;
    // committed targets under plugins/* still go through the drift check.
    const emitOnly = rel.startsWith('dist/');
    if (checkMode && !emitOnly) {
      let current: string | undefined;
      try {
        current = readFileSync(outAbs, 'utf8');
      } catch {
        current = undefined;
      }
      if (current === sourceBody) {
        console.log(`✓ ${rel} is in sync with ${sidecar.src}`);
      } else {
        console.error(`✗ ${rel} drifted from ${sidecar.src}; run npm run build-plugin-runtime`);
        drifted = true;
      }
    } else {
      mkdirSync(dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, sourceBody);
      console.log(`emitted ${rel}`);
    }
  }
}

if (drifted) process.exit(1);
