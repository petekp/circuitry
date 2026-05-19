import { describe, expect, it } from 'vitest';

import {
  isAutoOpenPathSafe,
  shouldAutoOpenPath,
  shouldSkipAutoOpen,
} from '../../plugins/claude/scripts/auto-open-policy.ts';

describe('shouldSkipAutoOpen', () => {
  function baseEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      CIRCUIT_NO_AUTO_OPEN: undefined,
      CI: undefined,
      DISPLAY: ':0',
      WAYLAND_DISPLAY: undefined,
      isTTY: true,
      platform: 'darwin',
      ...overrides,
    };
  }

  it('skips when CIRCUIT_NO_AUTO_OPEN=1', () => {
    expect(shouldSkipAutoOpen(baseEnv({ CIRCUIT_NO_AUTO_OPEN: '1' }))).toBe(true);
  });

  it('skips in CI', () => {
    expect(shouldSkipAutoOpen(baseEnv({ CI: 'true' }))).toBe(true);
    expect(shouldSkipAutoOpen(baseEnv({ CI: '1' }))).toBe(true);
    expect(shouldSkipAutoOpen(baseEnv({ CI: 'false' }))).toBe(false);
    expect(shouldSkipAutoOpen(baseEnv({ CI: '' }))).toBe(false);
  });

  it('skips when stdout is not a TTY', () => {
    expect(shouldSkipAutoOpen(baseEnv({ isTTY: false }))).toBe(true);
  });

  it('skips on Linux without DISPLAY or WAYLAND_DISPLAY', () => {
    expect(
      shouldSkipAutoOpen(
        baseEnv({ platform: 'linux', DISPLAY: undefined, WAYLAND_DISPLAY: undefined }),
      ),
    ).toBe(true);
  });

  it('does NOT skip on Linux with DISPLAY set', () => {
    expect(shouldSkipAutoOpen(baseEnv({ platform: 'linux', DISPLAY: ':0' }))).toBe(false);
  });

  it('does NOT skip on Linux with WAYLAND_DISPLAY set', () => {
    expect(
      shouldSkipAutoOpen(
        baseEnv({ platform: 'linux', DISPLAY: undefined, WAYLAND_DISPLAY: 'wayland-0' }),
      ),
    ).toBe(false);
  });

  it('does not auto-skip on macOS in normal interactive use', () => {
    expect(shouldSkipAutoOpen(baseEnv({ platform: 'darwin' }))).toBe(false);
  });
});

describe('isAutoOpenPathSafe — POSIX (darwin/linux)', () => {
  it('accepts canonical absolute .html paths', () => {
    expect(
      isAutoOpenPathSafe('/Users/me/.circuit/runs/abc/reports/operator-summary.html', 'darwin'),
    ).toBe(true);
    expect(isAutoOpenPathSafe('/home/dev/runs/run-id/reports/operator-summary.html', 'linux')).toBe(
      true,
    );
  });

  it('rejects relative paths so a leading `-` cannot be parsed as a flag by open(1)', () => {
    // The exploit: macOS `open` has no `--` end-of-options sentinel. A
    // value beginning with `-` is parsed as a flag (e.g. `-b BUNDLE_ID`).
    expect(isAutoOpenPathSafe('-b com.apple.Terminal.html', 'darwin')).toBe(false);
    expect(isAutoOpenPathSafe('-a Calculator.html', 'darwin')).toBe(false);
    expect(isAutoOpenPathSafe('reports/operator-summary.html', 'darwin')).toBe(false);
  });

  it('rejects paths that do not end in .html', () => {
    expect(isAutoOpenPathSafe('/tmp/whatever.txt', 'darwin')).toBe(false);
    expect(isAutoOpenPathSafe('/tmp/whatever', 'darwin')).toBe(false);
  });

  it('rejects empty, undefined, and non-string input', () => {
    expect(isAutoOpenPathSafe('', 'darwin')).toBe(false);
    expect(isAutoOpenPathSafe(undefined, 'darwin')).toBe(false);
    expect(isAutoOpenPathSafe(null, 'darwin')).toBe(false);
    expect(isAutoOpenPathSafe(123, 'darwin')).toBe(false);
  });
});

describe('isAutoOpenPathSafe — win32', () => {
  it('accepts a canonical drive-letter .html path', () => {
    expect(
      isAutoOpenPathSafe('C:\\Users\\me\\runs\\abc\\reports\\operator-summary.html', 'win32'),
    ).toBe(true);
    expect(isAutoOpenPathSafe('C:/Users/me/runs/abc/reports/x.html', 'win32')).toBe(true);
  });

  it('rejects POSIX-style absolute paths on win32 (could be parsed as `start /MIN`-style flag)', () => {
    expect(isAutoOpenPathSafe('/tmp/foo.html', 'win32')).toBe(false);
  });

  it('rejects paths containing cmd.exe metacharacters that would re-parse as command chains', () => {
    // The exploit: `spawn('cmd', ['/c', 'start', '""', path])` hands the
    // joined argv string to cmd, which interprets `& | < > ^` as chains.
    expect(isAutoOpenPathSafe('C:\\foo&calc.exe.html', 'win32')).toBe(false);
    expect(isAutoOpenPathSafe('C:\\foo|calc.exe.html', 'win32')).toBe(false);
    expect(isAutoOpenPathSafe('C:\\foo>out.html', 'win32')).toBe(false);
    expect(isAutoOpenPathSafe('C:\\foo<in.html', 'win32')).toBe(false);
    expect(isAutoOpenPathSafe('C:\\foo^bar.html', 'win32')).toBe(false);
    expect(isAutoOpenPathSafe('C:\\foo"bar.html', 'win32')).toBe(false);
    expect(isAutoOpenPathSafe('C:\\%PATH%\\foo.html', 'win32')).toBe(false);
  });

  it('accepts win32 paths containing spaces (canonical Program Files-style locations)', () => {
    expect(
      isAutoOpenPathSafe('C:\\Users\\Pete Petrash\\runs\\reports\\summary.html', 'win32'),
    ).toBe(true);
  });
});

describe('shouldAutoOpenPath', () => {
  function baseEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      CIRCUIT_NO_AUTO_OPEN: undefined,
      CI: undefined,
      DISPLAY: ':0',
      WAYLAND_DISPLAY: undefined,
      isTTY: true,
      platform: 'darwin',
      ...overrides,
    };
  }

  it('allows an absolute HTML summary in an interactive host', () => {
    expect(shouldAutoOpenPath('/tmp/run/reports/operator-summary.html', baseEnv())).toBe(true);
  });

  it('rejects missing and unsafe checkpoint HTML paths', () => {
    expect(shouldAutoOpenPath(undefined, baseEnv())).toBe(false);
    expect(shouldAutoOpenPath('reports/operator-summary.html', baseEnv())).toBe(false);
    expect(shouldAutoOpenPath('/tmp/run/reports/operator-summary.txt', baseEnv())).toBe(false);
  });

  it('skips otherwise safe paths when the host opted out', () => {
    expect(
      shouldAutoOpenPath(
        '/tmp/run/reports/operator-summary.html',
        baseEnv({ CIRCUIT_NO_AUTO_OPEN: '1' }),
      ),
    ).toBe(false);
  });
});
