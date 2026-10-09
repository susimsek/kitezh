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

test("desktop release metadata is complete for native packaging", () => {
  assert.equal(packageJson.desktopName, "kitezh");
  assert.match(packageJson.author?.email ?? "", /@/);
  assert.equal(packageJson.build.appId, "io.github.susimsek.kitezh.desktop");
  assert.equal(packageJson.build.productName, "Kitezh");
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
  assert.match(packageJson.build.win.artifactName, /^kitezh-\$\{version\}/);
  assert.ok(
    packageJson.build.protocols.some(({ schemes }) =>
      schemes.includes("kitezh"),
    ),
  );
});
