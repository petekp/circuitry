import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SYNC_SCRIPT = REPO_ROOT / "scripts" / "sync-to-cache.sh"


class SyncToCacheScriptTests(unittest.TestCase):
    maxDiff = None

    def run_sync(self, plugin_root: Path, cache_dir: Path, marketplace_dir: Path):
        env = os.environ.copy()
        env["CIRCUITRY_PLUGIN_ROOT"] = str(plugin_root)
        env["CLAUDE_PLUGIN_CACHE_DIR"] = str(cache_dir)
        env["CLAUDE_PLUGIN_MARKETPLACE_DIR"] = str(marketplace_dir)
        return subprocess.run(
            [str(SYNC_SCRIPT)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )

    def make_plugin_root(self, root: Path):
        (root / "hooks").mkdir(parents=True)
        (root / "skills" / "handoff" / "scripts").mkdir(parents=True)
        (root / ".claude-plugin").mkdir(parents=True)
        (root / "scripts" / "relay").mkdir(parents=True)

        (root / "hooks" / "hooks.json").write_text('{"hooks":{}}\n', encoding="utf-8")
        session_script = root / "hooks" / "session-start.sh"
        session_script.write_text("#!/usr/bin/env bash\necho synced\n", encoding="utf-8")
        session_script.chmod(0o755)

        (root / "skills" / "handoff" / "SKILL.md").write_text("# Handoff\n", encoding="utf-8")
        (root / "skills" / "handoff" / "scripts" / "gather-git-state.sh").write_text(
            "#!/usr/bin/env bash\necho gather\n",
            encoding="utf-8",
        )
        (root / ".claude-plugin" / "plugin.json").write_text('{"name":"circuitry"}\n', encoding="utf-8")
        (root / "scripts" / "relay" / "dispatch.sh").write_text(
            "#!/usr/bin/env bash\necho dispatch\n",
            encoding="utf-8",
        )

    def make_target(self, root: Path, version: str | None = None):
        target = root / version if version else root
        (target / "hooks").mkdir(parents=True)
        (target / "skills" / "crucible").mkdir(parents=True)
        (target / ".claude-plugin").mkdir(parents=True)
        (target / "scripts" / "relay").mkdir(parents=True)

        (target / "skills" / "crucible" / "SKILL.md").write_text("# Legacy\n", encoding="utf-8")
        session_script = target / "hooks" / "session-start.sh"
        session_script.write_text("#!/usr/bin/env bash\necho old\n", encoding="utf-8")
        session_script.chmod(0o644)
        (target / "hooks" / "hooks.json").write_text('{"old":true}\n', encoding="utf-8")
        (target / ".claude-plugin" / "plugin.json").write_text('{"name":"old"}\n', encoding="utf-8")
        (target / "scripts" / "relay" / "dispatch.sh").write_text(
            "#!/usr/bin/env bash\necho old-dispatch\n",
            encoding="utf-8",
        )
        return target

    def assert_synced_target(self, target: Path):
        self.assertTrue((target / "skills" / "handoff" / "SKILL.md").is_file())
        self.assertTrue((target / "skills" / "handoff" / "scripts" / "gather-git-state.sh").is_file())
        self.assertTrue((target / "skills" / "crucible" / "SKILL.md").is_file())
        self.assertEqual((target / "hooks" / "hooks.json").read_text(encoding="utf-8"), '{"hooks":{}}\n')
        self.assertEqual(
            (target / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"),
            '{"name":"circuitry"}\n',
        )
        self.assertEqual(
            (target / "scripts" / "relay" / "dispatch.sh").read_text(encoding="utf-8"),
            "#!/usr/bin/env bash\necho dispatch\n",
        )
        mode = stat.S_IMODE((target / "hooks" / "session-start.sh").stat().st_mode)
        self.assertTrue(mode & stat.S_IXUSR)

    def test_syncs_cache_versions_and_marketplace_without_deleting_target_only_dirs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            plugin_root = tmp_path / "plugin-root"
            cache_dir = tmp_path / "cache"
            marketplace_dir = tmp_path / "marketplace"

            self.make_plugin_root(plugin_root)
            cache_target = self.make_target(cache_dir, "0.2.0")
            marketplace_target = self.make_target(marketplace_dir)

            result = self.run_sync(plugin_root, cache_dir, marketplace_dir)

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn(f"Syncing local -> cache ({cache_target})", result.stdout)
            self.assertIn(f"Syncing local -> marketplace ({marketplace_target})", result.stdout)
            self.assert_synced_target(cache_target)
            self.assert_synced_target(marketplace_target)

    def test_syncs_marketplace_even_when_cache_versions_are_missing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            plugin_root = tmp_path / "plugin-root"
            cache_dir = tmp_path / "cache"
            marketplace_dir = tmp_path / "marketplace"

            self.make_plugin_root(plugin_root)
            marketplace_target = self.make_target(marketplace_dir)
            cache_dir.mkdir(parents=True)

            result = self.run_sync(plugin_root, cache_dir, marketplace_dir)

            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertIn("No cached version found", result.stdout)
            self.assert_synced_target(marketplace_target)

    def test_fails_loudly_when_a_target_cannot_be_synced(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            plugin_root = tmp_path / "plugin-root"
            cache_dir = tmp_path / "cache"
            broken_target = cache_dir / "0.2.0"

            self.make_plugin_root(plugin_root)
            broken_target.mkdir(parents=True)
            (broken_target / "hooks").write_text("not a directory\n", encoding="utf-8")

            result = self.run_sync(plugin_root, cache_dir, tmp_path / "missing-marketplace")

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("File exists", result.stderr)


if __name__ == "__main__":
    unittest.main()
