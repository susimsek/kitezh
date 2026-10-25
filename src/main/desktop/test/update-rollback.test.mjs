import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

test("relaunches the restored installation after rollback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kitezh-rollback-launch-"));
  const targetPath = path.join(root, "current");
  const backupPath = path.join(root, "backup");
  const recoveryPath = path.join(root, "recovery.json");
  await mkdir(targetPath);
  await mkdir(backupPath);
  await writeFile(path.join(targetPath, "new-version.txt"), "new");
  await writeFile(path.join(backupPath, "previous-version.txt"), "previous");
  await writeFile(recoveryPath, "pending");

  try {
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
      true,
    );

    assert.equal(
      await readFile(path.join(targetPath, "previous-version.txt"), "utf8"),
      "previous",
    );
    assert.equal(await readFile(recoveryPath, "utf8"), "pending");
    await assert.rejects(readFile(backupPath));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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

test(
  "Windows watchdog leaves a healthy installation untouched after marker cleanup",
  {
    skip: process.platform !== "win32",
  },
  async () => {
    const watchdogPath = fileURLToPath(
      new URL("../dist/update-watchdog.js", import.meta.url),
    );
    const watchdogDirectory = path.dirname(watchdogPath);
    const recoveryPath = path.join(
      watchdogDirectory,
      "desktop-update-recovery.json",
    );
    const backupPath = path.join(
      watchdogDirectory,
      `desktop-update-backup-${Date.now()}`,
    );
    const targetPath = path.dirname(process.execPath);
    let parent;
    let watchdog;
    let createdBackup = false;
    let createdRecoveryMarker = false;

    try {
      await assert.rejects(readFile(recoveryPath));
      for (const pid of ["invalid-pid", "2147483647"]) {
        const invalidRun = spawn(process.execPath, [watchdogPath, pid], {
          stdio: "ignore",
          windowsHide: true,
        });
        const [exitCode] = await once(invalidRun, "exit");
        assert.equal(exitCode, 0);
      }
      await writeFile(
        recoveryPath,
        JSON.stringify({
          backupPath: path.join(watchdogDirectory, "desktop-update-backup-123"),
          targetPath: path.join(watchdogDirectory, "unexpected-target"),
          targetType: "directory",
          executablePath: process.execPath,
          version: "0.2.0",
          previousVersion: "0.1.0",
          startedAt: Date.now(),
        }),
      );
      const invalidRecovery = spawn(
        process.execPath,
        [watchdogPath, "2147483647"],
        {
          stdio: "ignore",
          windowsHide: true,
        },
      );
      const [invalidRecoveryExit] = await once(invalidRecovery, "exit");
      assert.equal(invalidRecoveryExit, 0);
      await rm(recoveryPath, { force: true });
      await mkdir(backupPath);
      createdBackup = true;
      await writeFile(
        path.join(backupPath, "previous-version.txt"),
        "previous",
      );
      await writeFile(
        recoveryPath,
        JSON.stringify({
          backupPath,
          targetPath,
          targetType: "directory",
          executablePath: process.execPath,
          version: "0.2.0",
          previousVersion: "0.1.0",
          startedAt: Date.now(),
        }),
      );
      createdRecoveryMarker = true;
      parent = spawn(process.execPath, ["-e", "setTimeout(() => {}, 100)"], {
        stdio: "ignore",
        windowsHide: true,
      });
      watchdog = spawn(process.execPath, [watchdogPath, String(parent.pid)], {
        stdio: "ignore",
        windowsHide: true,
      });

      await once(parent, "exit");
      await new Promise((resolve) => setTimeout(resolve, 100));
      await rm(recoveryPath, { force: true });
      const watchdogExit = once(watchdog, "exit");
      const watchdogTimeout = setTimeout(() => watchdog.kill(), 5_000);
      const [exitCode] = await watchdogExit;
      clearTimeout(watchdogTimeout);
      assert.equal(exitCode, 0);
      assert.equal(
        await readFile(path.join(backupPath, "previous-version.txt"), "utf8"),
        "previous",
      );
    } finally {
      if (parent && parent.exitCode === null) parent.kill();
      if (watchdog && watchdog.exitCode === null) watchdog.kill();
      if (createdRecoveryMarker) await rm(recoveryPath, { force: true });
      if (createdBackup) await rm(backupPath, { recursive: true, force: true });
    }
  },
);
