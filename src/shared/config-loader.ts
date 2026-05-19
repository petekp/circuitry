import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Config, type Config as ConfigValue, LayeredConfig } from '../schemas/config.js';

const USER_GLOBAL_CONFIG_RELATIVE_PATH = ['.config', 'circuit', 'config.yaml'] as const;
const PROJECT_CONFIG_RELATIVE_PATH = ['.circuit', 'config.yaml'] as const;

interface DiscoverConfigLayersOptions {
  readonly homeDir?: string;
  readonly cwd?: string;
  readonly invocationConfig?: ConfigValue;
}

export function userGlobalConfigPath(homeDir = homedir()): string {
  return join(homeDir, ...USER_GLOBAL_CONFIG_RELATIVE_PATH);
}

export function projectConfigPath(cwd = process.cwd()): string {
  return join(cwd, ...PROJECT_CONFIG_RELATIVE_PATH);
}

function parseConfigYaml(text: string, sourcePath: string): unknown {
  try {
    return parseYaml(text);
  } catch (err) {
    throw new Error(`config YAML parse failed at ${sourcePath}: ${(err as Error).message}`);
  }
}

function loadConfigLayerFromPath(
  layer: 'user-global' | 'project',
  sourcePath: string,
): LayeredConfig | undefined {
  const abs = resolve(sourcePath);
  if (!existsSync(abs)) return undefined;

  const raw = parseConfigYaml(readFileSync(abs, 'utf8'), abs);
  try {
    return LayeredConfig.parse({
      layer,
      source_path: abs,
      config: Config.parse(raw),
    });
  } catch (err) {
    throw new Error(`config validation failed for ${layer} at ${abs}: ${(err as Error).message}`);
  }
}

export function discoverConfigLayers(
  options: DiscoverConfigLayersOptions = {},
): readonly LayeredConfig[] {
  const layers: LayeredConfig[] = [];

  const userGlobal = loadConfigLayerFromPath('user-global', userGlobalConfigPath(options.homeDir));
  if (userGlobal !== undefined) layers.push(userGlobal);

  const project = loadConfigLayerFromPath('project', projectConfigPath(options.cwd));
  if (project !== undefined) layers.push(project);

  if (options.invocationConfig !== undefined) {
    layers.push(
      LayeredConfig.parse({
        layer: 'invocation',
        config: options.invocationConfig,
      }),
    );
  }

  return layers;
}
