// Auto-open gating policy for the Claude wrapper. Pure functions kept in
// their own module so tests can exercise them without spawning the
// wrapper or importing its top-level CLI dispatch.

// Auto-open is best-effort and silently skipped in environments where it
// cannot succeed or could disrupt other tooling: explicit opt-out,
// non-interactive contexts (CI, no TTY), or Linux without a display
// server. Callers must always still surface the HTML path inline so the
// operator never loses access when auto-open skips.
export function shouldSkipAutoOpen(env) {
  if (env.CIRCUIT_NO_AUTO_OPEN === '1') return true;
  if (env.CI !== undefined && env.CI !== '' && env.CI !== 'false') return true;
  if (env.isTTY === false) return true;
  if (
    env.platform === 'linux' &&
    (env.DISPLAY === undefined || env.DISPLAY === '') &&
    (env.WAYLAND_DISPLAY === undefined || env.WAYLAND_DISPLAY === '')
  ) {
    return true;
  }
  return false;
}

// Validate a path before handing it to a platform-native opener. Three
// classes of failure to defeat:
//   1. argv-flag injection: macOS `open(1)` and most `xdg-open` wrappers
//      have no `--` end-of-options sentinel. A path beginning with `-`
//      gets parsed as a flag, e.g. `open -b com.apple.Terminal` would
//      launch Terminal instead of opening a file. Requiring an absolute
//      path (POSIX `/` or Windows drive-letter) blocks this.
//   2. Wrong file: defense-in-depth that we are opening an HTML
//      summary, not an arbitrary file the runtime might emit.
//   3. cmd.exe metacharacter re-parse on Windows: `spawn('cmd', ...)`
//      hands the joined argv string to cmd which interprets `& | < > ^`
//      and `%var%` expansion. Reject paths containing those chars.
export function isAutoOpenPathSafe(path, platform) {
  if (typeof path !== 'string' || path.length === 0) return false;
  if (!path.toLowerCase().endsWith('.html')) return false;
  if (platform === 'win32') {
    if (!/^[A-Za-z]:[\\/]/.test(path)) return false;
    if (/[&|<>^"%]/.test(path)) return false;
  } else {
    if (!path.startsWith('/')) return false;
  }
  return true;
}

export function shouldAutoOpenPath(path, env) {
  if (shouldSkipAutoOpen(env)) return false;
  return isAutoOpenPathSafe(path, env.platform);
}
