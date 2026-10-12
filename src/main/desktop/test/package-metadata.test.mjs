import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const packageJson = JSON.parse(
  await readFile(path.join(desktopDirectory, "package.json"), "utf8"),
);
const pnpmLockfile = await readFile(
  path.join(desktopDirectory, "pnpm-lock.yaml"),
  "utf8",
);

test("desktop release metadata is complete for native packaging", () => {
  assert.equal(packageJson.desktopName, "kitezh");
  assert.match(packageJson.author?.email ?? "", /@/);
  assert.equal(packageJson.build.directories.output, "release");
  assert.equal(packageJson.build.appId, "io.github.susimsek.kitezh.desktop");
  assert.equal(packageJson.build.productName, "Kitezh");
  assert.equal(packageJson.build.icon, "assets/icon.png");
  assert.notEqual(packageJson.build.asar, false);
  assert.ok(
    ["dist/**/*", "renderer/**/*", "assets/**/*", "package.json"].every(
      (file) => packageJson.build.files.includes(file),
    ),
  );
  assert.deepEqual(packageJson.build.electronLanguages, ["en-US", "tr"]);
  assert.equal(packageJson.build.mac.compression, "maximum");
  assert.equal(packageJson.build.linux.maintainer, packageJson.author.email);
  assert.equal(packageJson.build.linux.syncDesktopName, true);
  assert.deepEqual(packageJson.build.linux.target, [
    "AppImage",
    "deb",
    "rpm",
    "snap",
  ]);
  assert.match(packageJson.build.linux.artifactName, /^kitezh-\$\{version\}/);
  assert.match(packageJson.build.mac.artifactName, /^kitezh-\$\{version\}/);
  assert.deepEqual(packageJson.build.mac.target, ["dmg", "zip"]);
  assert.match(packageJson.build.win.artifactName, /^kitezh-\$\{version\}/);
  assert.deepEqual(packageJson.build.win.target, ["nsis", "portable", "appx"]);
  assert.equal(packageJson.build.appx.applicationId, "KitezhDesktop");
  assert.equal(
    packageJson.build.appx.publisherDisplayName,
    packageJson.build.productName,
  );
  assert.ok(
    packageJson.build.protocols.some(
      ({ name, schemes }) =>
        name === "Kitezh OAuth callback" && schemes.includes("kitezh"),
    ),
  );
});

test("uses a live shared-package link for clean build ordering", () => {
  assert.equal(packageJson.dependencies["@kitezh/shared"], "link:../shared");
  assert.match(
    pnpmLockfile,
    /^\s+specifier: link:\.\.\/shared\s*\n\s+version: link:\.\.\/shared$/m,
  );
  assert.doesNotMatch(
    pnpmLockfile,
    /^\s*resolution: \{directory: \.\.\/shared, type: directory\}$/m,
  );
});
