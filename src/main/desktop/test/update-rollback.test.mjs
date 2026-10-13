import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isValidRecoveryState,
  restoreInstallation,
} from "../dist/update-watchdog.js";
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

test("accepts only a recovery state for the current supported installation", () => {
  const userDataPath = path.join(os.tmpdir(), "kitezh-user-data");
  const executablePath = path.join(os.tmpdir(), "Kitezh", "Kitezh.exe");
  const safeState = {
    backupPath: path.join(userDataPath, "desktop-update-backup-123"),
    targetPath: path.dirname(executablePath),
    targetType: "directory",
    executablePath,
    version: "0.2.0",
    previousVersion: "0.1.0",
    startedAt: Date.now(),
  };
  const context = {
    userDataPath,
    platform: "win32",
    executablePath,
  };

  assert.equal(isValidRecoveryState(safeState, context), true);
  assert.equal(
    isValidRecoveryState(
      { ...safeState, targetPath: path.dirname(userDataPath) },
      context,
    ),
    false,
  );
  assert.equal(
    isValidRecoveryState(
      {
        ...safeState,
        backupPath: path.join(userDataPath, "..", "outside-backup"),
      },
      context,
    ),
    false,
  );
  for (const invalidState of [
    { ...safeState, version: "" },
    { ...safeState, previousVersion: "" },
    { ...safeState, startedAt: Number.MAX_SAFE_INTEGER + 1 },
    { ...safeState, targetType: "file" },
    { ...safeState, executablePath: "relative/Kitezh.exe" },
    {
      ...safeState,
      backupPath: path.join(userDataPath, "desktop-update-backup-invalid"),
    },
  ]) {
    assert.equal(isValidRecoveryState(invalidState, context), false);
  }
  assert.equal(
    isValidRecoveryState(safeState, { ...context, platform: "aix" }),
    false,
  );
});

test("validates recovery targets for macOS and AppImage installs", () => {
  const userDataPath = path.join(os.tmpdir(), "kitezh-recovery-data");
  const backupPath = path.join(userDataPath, "desktop-update-backup-42");
  const appPath = path.join(
    os.tmpdir(),
    "Kitezh.app",
    "Contents",
    "MacOS",
    "Kitezh",
  );
  const macContext = {
    userDataPath,
    platform: "darwin",
    executablePath: appPath,
  };
  const macState = {
    backupPath,
    targetPath: path.resolve(appPath, "../../../"),
    targetType: "directory",
    executablePath: appPath,
    version: "0.2.0",
    previousVersion: "0.1.0",
    startedAt: Date.now(),
  };
  assert.equal(isValidRecoveryState(macState, macContext), true);

  const appImagePath = path.join(os.tmpdir(), "kitezh.AppImage");
  const linuxState = {
    ...macState,
    targetPath: appImagePath,
    targetType: "file",
    executablePath: appImagePath,
  };
  assert.equal(
    isValidRecoveryState(linuxState, {
      userDataPath,
      platform: "linux",
      executablePath: appImagePath,
      appImage: appImagePath,
    }),
    true,
  );
  assert.equal(
    isValidRecoveryState(linuxState, {
      userDataPath,
      platform: "linux",
      executablePath: appImagePath,
    }),
    false,
  );
});

test("restores a backed-up installation and preserves the recovery marker for startup", async () => {
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
  assert.equal(await readFile(recoveryPath, "utf8"), "pending");
  await assert.rejects(readFile(backupPath));
});

test("restores an installation when the failed target is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kitezh-missing-target-"));
  const targetPath = path.join(root, "current");
  const backupPath = path.join(root, "backup");
  const recoveryPath = path.join(root, "recovery.json");
  await mkdir(backupPath);
  await writeFile(path.join(backupPath, "previous-version.txt"), "previous");
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

  assert.equal(
    await readFile(path.join(targetPath, "previous-version.txt"), "utf8"),
    "previous",
  );
  assert.equal(await readFile(recoveryPath, "utf8"), "pending");
  await assert.rejects(readFile(backupPath));
});

test("restores an AppImage file backup and preserves the recovery marker for startup", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "kitezh-appimage-rollback-"),
  );
  const targetPath = path.join(root, "kitezh.AppImage");
  const backupPath = path.join(root, "kitezh.AppImage.backup");
  const recoveryPath = path.join(root, "recovery.json");
  await writeFile(targetPath, "failed-update");
  await writeFile(backupPath, "previous-working-version");
  await writeFile(recoveryPath, "pending");

  await restoreInstallation(
    {
      backupPath,
      targetPath,
      targetType: "file",
      executablePath: targetPath,
      version: "0.2.0",
      previousVersion: "0.1.0",
      startedAt: Date.now(),
    },
    recoveryPath,
    false,
  );

  assert.equal(await readFile(targetPath, "utf8"), "previous-working-version");
  assert.equal(await readFile(recoveryPath, "utf8"), "pending");
  await assert.rejects(readFile(backupPath));
});
