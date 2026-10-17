import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(desktopDirectory, "../../..");
const releaseWorkflow = await readFile(
  path.join(repositoryRoot, ".github", "workflows", "desktop-release.yml"),
  "utf8",
);
const mobileWorkflow = await readFile(
  path.join(repositoryRoot, ".github", "workflows", "mobile-release.yml"),
  "utf8",
);
const manifestSigningScript = await readFile(
  path.join(desktopDirectory, "scripts", "sign-update-manifests.mjs"),
  "utf8",
);
const require = createRequire(import.meta.url);
const { load } = require("js-yaml");

test("desktop release workflow supports configured signing and unsigned fallback", () => {
  const packageBuild = releaseWorkflow.indexOf("- name: Build desktop package");
  const jobEnvironment = releaseWorkflow.match(
    /^    env:\r?\n([\s\S]*?)^\r?\n    steps:/m,
  )?.[1];
  const dependencyInstall = releaseWorkflow.indexOf(
    "- name: Install desktop dependencies",
  );

  assert.ok(dependencyInstall < packageBuild);
  assert.ok(jobEnvironment);
  assert.match(jobEnvironment, /DESKTOP_RELEASE_PLATFORM/);
  assert.doesNotMatch(jobEnvironment, /secrets\./);
  assert.match(releaseWorkflow, /Sign Linux packages with Sigstore/);
  assert.match(releaseWorkflow, /LINUX_GPG_PRIVATE_KEY/);
  assert.match(releaseWorkflow, /No Linux GPG key configured; leaving the checksum file unsigned/);
  assert.match(releaseWorkflow, /UPDATE_MANIFEST_SIGNING_KEY/);
  assert.match(manifestSigningScript, /No update manifest signing key configured; leaving manifests unsigned/);
  assert.match(releaseWorkflow, /unset CSC_LINK CSC_KEY_PASSWORD/);
  assert.match(releaseWorkflow, /APPLE_API_KEY_BASE64/);
  assert.match(releaseWorkflow, /--mac --x64 --arm64/);
  assert.match(releaseWorkflow, /config\.mac\.notarize=true/);
  assert.doesNotMatch(releaseWorkflow, /Verify Windows Authenticode signature/);
});

test("mobile release signs only when each platform has a complete key set", () => {
  assert.match(mobileWorkflow, /Resolve Android signing mode/);
  assert.match(mobileWorkflow, /signing_configured=true/);
  assert.match(mobileWorkflow, /Android signing secrets are incomplete; the APK will be built unsigned/);
  assert.match(mobileWorkflow, /Could not remove Expo’s default debug signing/);
  assert.match(mobileWorkflow, /Resolve iOS signing mode/);
  assert.match(mobileWorkflow, /iOS signing secrets are incomplete; the IPA will be built unsigned/);
  assert.doesNotMatch(mobileWorkflow, /IOS_SIGNING_MODE/);
});

test("release packages consume one native renderer artifact and separate Mac architectures", () => {
  const workflow = load(releaseWorkflow);
  const rendererSteps = workflow.jobs.renderer.steps;
  const packageSteps = workflow.jobs.package.steps;
  const upload = rendererSteps.find((step) =>
    step.uses?.startsWith("actions/upload-artifact@"),
  );
  const downloadIndex = packageSteps.findIndex((step) =>
    step.uses?.startsWith("actions/download-artifact@"),
  );
  const packageIndex = packageSteps.findIndex(
    (step) => step.name === "Build desktop package",
  );
  const download = packageSteps[downloadIndex];
  assert.ok(downloadIndex >= 0 && downloadIndex < packageIndex);
  assert.equal(upload.with.path, download.with.path);
  assert.equal(upload.with.name, download.with.name);
  assert.equal(upload.with["retention-days"], 1);
  assert.match(upload.with.path, /dist\/native\/$/);
  const packageCommands = packageSteps.map((step) => step.run ?? "").join("\n");
  assert.doesNotMatch(
    packageCommands,
    /pnpm run build(?:\s|$)|build:native|build:renderer|--universal/,
  );
  assert.match(packageCommands, /--mac --x64 --arm64/);
  assert.match(packageCommands, /pnpm run build:main/);
});
