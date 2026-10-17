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

test("selects a published asset only for supported platform architectures", () => {
  const allAssets = {
    ...metadata.assets,
    linuxArm64AppImage:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-linux-arm64.AppImage",
  };
  const completeMetadata = { ...metadata, assets: allAssets };
  for (const [platform, arch] of [
    ["win32", "arm64"],
    ["darwin", "x64"],
    ["linux", "x64"],
    ["linux", "arm64"],
  ]) {
    assert.equal(
      hasNewerDesktopRelease(completeMetadata, "0.1.4", platform, arch),
      true,
      `${platform}/${arch}`,
    );
  }
  assert.equal(
    hasNewerDesktopRelease(completeMetadata, "0.1.6", "linux", "x64"),
    false,
  );
  assert.equal(
    hasNewerDesktopRelease(completeMetadata, "invalid", "linux", "x64"),
    null,
  );
  assert.equal(
    hasNewerDesktopRelease(completeMetadata, "0.1.4", "freebsd", "x64"),
    null,
  );
  assert.equal(
    hasNewerDesktopRelease(completeMetadata, "0.1.4", "darwin", "ia32"),
    null,
  );
});

test("rejects incomplete release metadata before checking its version", () => {
  for (const value of [
    null,
    [],
    { ...metadata, tag: "wrong-tag" },
    {
      ...metadata,
      releaseUrl: "http://github.com/susimsek/kitezh/releases/tag/v0.1.5",
    },
    { ...metadata, assets: [] },
    { ...metadata, version: "1.2" },
  ]) {
    assert.equal(
      hasNewerDesktopRelease(value, "0.1.4", "win32", "x64"),
      null,
    );
  }
});
