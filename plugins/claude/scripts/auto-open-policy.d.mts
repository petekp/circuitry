export interface AutoOpenEnv {
  readonly CIRCUIT_NO_AUTO_OPEN?: string;
  readonly CI?: string;
  readonly DISPLAY?: string;
  readonly WAYLAND_DISPLAY?: string;
  readonly isTTY?: boolean;
  readonly platform?: string;
}

export function shouldSkipAutoOpen(env: AutoOpenEnv): boolean;
export function isAutoOpenPathSafe(path: unknown, platform: string): boolean;
export function shouldAutoOpenPath(path: unknown, env: AutoOpenEnv): boolean;
