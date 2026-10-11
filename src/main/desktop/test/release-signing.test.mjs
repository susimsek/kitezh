import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const signingCheckPath = path.join(
  desktopDirectory,
  "scripts",
  "require-release-signing.mjs",
);
const repositoryRoot = path.resolve(desktopDirectory, "../../..");
const releaseWorkflow = await readFile(
  path.join(repositoryRoot, ".github", "workflows", "desktop-release.yml"),
  "utf8",
);

function runSigningCheck(platform, variables = {}) {
  return spawnSync(process.execPath, [signingCheckPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      DESKTOP_RELEASE_PLATFORM: platform,
      UPDATE_MANIFEST_SIGNING_KEY: "",
      ACTIONS_ID_TOKEN_REQUEST_URL: "",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "",
      MAC_CSC_LINK: "",
      MAC_CSC_KEY_PASSWORD: "",
      APPLE_API_KEY_BASE64: "",
      APPLE_API_KEY_ID: "",
      APPLE_API_ISSUER: "",
      WIN_CSC_LINK: "",
      WIN_CSC_KEY_PASSWORD: "",
      LINUX_GPG_PRIVATE_KEY: "",
      ...variables,
    },
  });
}

test("release signing check rejects missing secrets without printing values", () => {
  const result = runSigningCheck("windows", {
    UPDATE_MANIFEST_SIGNING_KEY: "manifest-private-test-value",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WIN_CSC_LINK/);
  assert.match(result.stderr, /WIN_CSC_KEY_PASSWORD/);
  assert.doesNotMatch(result.stderr, /manifest-private-test-value/);
});

test("release signing check accepts complete platform signing configuration", () => {
  const result = runSigningCheck("windows", {
    UPDATE_MANIFEST_SIGNING_KEY: "manifest-private-test-value",
    WIN_CSC_LINK: "certificate-test-value",
    WIN_CSC_KEY_PASSWORD: "certificate-password-test-value",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("release signing check requires the platform-specific trust material", () => {
  const macos = runSigningCheck("macos", {
    UPDATE_MANIFEST_SIGNING_KEY: "manifest-private-test-value",
    MAC_CSC_LINK: "certificate-test-value",
    MAC_CSC_KEY_PASSWORD: "certificate-password-test-value",
  });
  const linux = runSigningCheck("linux", {
    UPDATE_MANIFEST_SIGNING_KEY: "manifest-private-test-value",
  });

  assert.notEqual(macos.status, 0);
  assert.match(macos.stderr, /APPLE_API_KEY_BASE64/);
  assert.notEqual(linux.status, 0);
  assert.match(linux.stderr, /ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(linux.stderr, /LINUX_GPG_PRIVATE_KEY/);
});

test("release signing check accepts complete Apple and Linux identities", () => {
  const macos = runSigningCheck("macos", {
    UPDATE_MANIFEST_SIGNING_KEY: "manifest-private-test-value",
    MAC_CSC_LINK: "certificate-test-value",
    MAC_CSC_KEY_PASSWORD: "certificate-password-test-value",
    APPLE_API_KEY_BASE64: "apple-key-test-value",
    APPLE_API_KEY_ID: "apple-key-id-test-value",
    APPLE_API_ISSUER: "apple-issuer-test-value",
  });
  const linux = runSigningCheck("linux", {
    UPDATE_MANIFEST_SIGNING_KEY: "manifest-private-test-value",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://actions.invalid/token",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "oidc-test-value",
    LINUX_GPG_PRIVATE_KEY: "gpg-private-test-value",
  });

  assert.equal(macos.status, 0, macos.stderr);
  assert.equal(linux.status, 0, linux.stderr);
  assert.equal(macos.stdout, "");
  assert.equal(linux.stdout, "");
});

test("desktop release workflow checks signing credentials before packaging", () => {
  const signingGate = releaseWorkflow.indexOf(
    "node scripts/require-release-signing.mjs",
  );
  const packageBuild = releaseWorkflow.indexOf("- name: Build desktop package");
  const jobEnvironment = releaseWorkflow.match(
    /^    env:\r?\n([\s\S]*?)^\r?\n    steps:/m,
  )?.[1];
  const dependencyInstall = releaseWorkflow.indexOf(
    "- name: Install web dependencies",
  );

  assert.notEqual(signingGate, -1);
  assert.ok(signingGate < dependencyInstall);
  assert.ok(signingGate < packageBuild);
  assert.ok(jobEnvironment);
  assert.match(jobEnvironment, /DESKTOP_RELEASE_PLATFORM/);
  assert.doesNotMatch(jobEnvironment, /secrets\./);
  assert.match(
    releaseWorkflow,
    /MAC_CSC_LINK: \$\{\{ matrix\.platform == 'macos' && secrets\.MAC_CSC_LINK/,
  );
  assert.match(
    releaseWorkflow,
    /WIN_CSC_LINK: \$\{\{ matrix\.platform == 'windows' && secrets\.WIN_CSC_LINK/,
  );
  assert.match(
    releaseWorkflow,
    /LINUX_GPG_PRIVATE_KEY: \$\{\{ matrix\.platform == 'linux' && secrets\.LINUX_GPG_PRIVATE_KEY/,
  );
  assert.doesNotMatch(releaseWorkflow, /keeping this package unsigned/);
  assert.match(releaseWorkflow, /config\.mac\.notarize=true/);
  assert.match(releaseWorkflow, /Verify Windows Authenticode signature/);
  assert.match(releaseWorkflow, /LINUX_GPG_PRIVATE_KEY/);
});
