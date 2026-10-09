import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { restoreInstallation } from "../dist/update-watchdog.js";
import { supportsAutoUpdate } from "../dist/update.js";

test("keeps Linux system packages outside the in-app update path", () => {
  assert.equal(
    supportsAutoUpdate({
      appImage: true,
      packaged: true,
      platform: "linux",
    }),
    true,
  );
  assert.equal(
    supportsAutoUpdate({
      appImage: false,
      packaged: true,
      platform: "linux",
    }),
    false,
  );
  assert.equal(
    supportsAutoUpdate({
      appImage: false,
      packaged: true,
      platform: "darwin",
    }),
    true,
  );
  assert.equal(
    supportsAutoUpdate({
      appImage: false,
      packaged: false,
      platform: "win32",
    }),
    false,
  );
  assert.equal(
    supportsAutoUpdate({
      appImage: true,
      autoUpdate: "false",
      packaged: true,
      platform: "linux",
    }),
    false,
  );
});

test("restores a backed-up installation and removes the recovery marker", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kitezh-rollback-"));
  const targetPath = path.join(root, "current");
  const backupPath = path.join(root, "backup");
  const recoveryPath = path.join(root, "recovery.json");
  await mkdir(targetPath);
  await mkdir(backupPath);
  await writeFile(path.join(targetPath, "new-version.txt"), "new");
  await writeFile(path.join(backupPath, "old-version.txt"), "old");
  await writeFile(recoveryPath, "pending");

  await restoreInstallation(
    {
      backupPath,
      targetPath,
      targetType: "directory",
      executablePath: process.execPath,
      version: "0.2.0",
      previousVersion: "0.1.0",
      startedAt: Date.now(),
    },
    recoveryPath,
    false,
  );

  await assert.rejects(readFile(path.join(targetPath, "new-version.txt")));
  assert.equal(
    await readFile(path.join(targetPath, "old-version.txt"), "utf8"),
    "old",
  );
  await assert.rejects(readFile(recoveryPath));
  await assert.rejects(readFile(backupPath));
});
