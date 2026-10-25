import assert from "node:assert/strict";
import test from "node:test";

import {
  compareVersions,
  parseLatestRelease,
  RELEASES_PAGE_URL,
} from "./release-check.ts";

const release = {
  tag: "v0.1.5",
  version: "0.1.5",
  releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.5",
  assets: {
    androidApk:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-android.apk",
    iosUnsignedIpa:
      "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-0.1.5-ios-unsigned.ipa",
  },
};

test("compares numeric version segments", () => {
  assert.equal(compareVersions("0.1.10", "0.1.4"), 1);
  assert.equal(compareVersions("0.1.4", "0.1.4"), 0);
  assert.equal(compareVersions("0.1.3", "0.1.4"), -1);
  assert.equal(compareVersions("latest", "0.1.4"), null);
});

test("selects only the platform's expected release asset", () => {
  assert.deepEqual(parseLatestRelease(release, "0.1.4", "android"), {
    version: "0.1.5",
    pageUrl: release.releaseUrl,
    asset: {
      name: "kitezh-0.1.5-android.apk",
      url: release.assets.androidApk,
    },
  });
  assert.deepEqual(parseLatestRelease(release, "0.1.4", "ios")?.asset, {
    name: "kitezh-0.1.5-ios-unsigned.ipa",
    url: release.assets.iosUnsignedIpa,
  });
});

test("ignores same, older, and invalid release tags", () => {
  assert.equal(parseLatestRelease(release, "0.1.5", "android"), null);
  assert.equal(parseLatestRelease(release, "0.2.0", "android"), null);
  assert.equal(
    parseLatestRelease({ ...release, version: "nightly" }, "0.1.4", "android"),
    null,
  );
  assert.equal(
    parseLatestRelease({ ...release, version: "0.1.6" }, "0.1.4", "android"),
    null,
  );
});

test("rejects download URLs outside the Kitezh GitHub release path", () => {
  const invalid = {
    ...release,
    assets: { androidApk: "https://attacker.example/update.apk" },
  };
  assert.deepEqual(parseLatestRelease(invalid, "0.1.4", "android"), {
    version: "0.1.5",
    pageUrl: release.releaseUrl,
    asset: null,
  });
  assert.equal(
    parseLatestRelease(
      { ...release, releaseUrl: "https://attacker.example/release" },
      "0.1.4",
      "android",
    )?.pageUrl,
    RELEASES_PAGE_URL,
  );
});

test("rejects release assets whose tag or filename does not match the release", () => {
  const mismatchedTag = {
    ...release,
    assets: {
      androidApk:
        "https://github.com/susimsek/kitezh/releases/download/v0.1.4/kitezh-0.1.5-android.apk",
    },
  };
  const mismatchedFilename = {
    ...release,
    assets: {
      androidApk:
        "https://github.com/susimsek/kitezh/releases/download/v0.1.5/other-0.1.5-android.apk",
    },
  };

  assert.equal(parseLatestRelease(mismatchedTag, "0.1.4", "android")?.asset, null);
  assert.equal(
    parseLatestRelease(mismatchedFilename, "0.1.4", "android")?.asset,
    null,
  );
});

test("uses the shared backend release metadata and tolerates missing assets", () => {
  const missingAsset = parseLatestRelease(
    { ...release, assets: {} },
    "0.1.4",
    "android",
  );
  assert.equal(missingAsset?.version, "0.1.5");
  assert.equal(missingAsset?.asset, null);
});
