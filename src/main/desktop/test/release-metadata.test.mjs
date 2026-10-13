import assert from "node:assert/strict";
import test from "node:test";
import { hasNewerDesktopRelease } from "../dist/release-metadata.js";

const metadata = {
  tag: "v0.1.5",
  version: "0.1.5",
  releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.5",
  assets: {
    windowsInstaller:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-win-x64-setup.exe",
    macosAppleSilicon:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-macos-arm64.dmg",
    macosIntel:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-macos-x64.dmg",
    linuxX64AppImage:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-linux-x86_64.AppImage",
  },
};

test("detects a newer desktop release for the current platform", () => {
  assert.equal(
    hasNewerDesktopRelease(metadata, "0.1.4", "darwin", "arm64"),
    true,
  );
});

test("reports no newer release when installed version matches", () => {
  assert.equal(
    hasNewerDesktopRelease(metadata, "0.1.5", "win32", "x64"),
    false,
  );
});

test("falls back to the native updater when the platform asset is missing", () => {
  assert.equal(
    hasNewerDesktopRelease(metadata, "0.1.4", "linux", "arm64"),
    null,
  );
});

test("rejects malformed versions and untrusted release URLs", () => {
  assert.equal(
    hasNewerDesktopRelease(
      { ...metadata, version: "latest", tag: "vlatest" },
      "0.1.4",
      "win32",
      "x64",
    ),
    null,
  );
  assert.equal(
    hasNewerDesktopRelease(
      {
        ...metadata,
        assets: {
          ...metadata.assets,
          windowsInstaller: "https://example.com/update.exe",
        },
      },
      "0.1.4",
      "win32",
      "x64",
    ),
    null,
  );
});
