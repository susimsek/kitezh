import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runRecoveryWatchdog } from "../dist/update-watchdog.js";

async function createRecoveryFixture() {
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "kitezh-watchdog-"));
  const watchdogPath = path.join(userDataPath, "watchdog.js");
  const recoveryPath = path.join(userDataPath, "desktop-update-recovery.json");
  const targetPath = path.join(userDataPath, "kitezh.AppImage");
  const backupPath = path.join(userDataPath, "desktop-update-backup-123");
  await writeFile(targetPath, "failed-version");
  await writeFile(backupPath, "previous-version");

  const state = {
    backupPath,
    targetPath,
    targetType: "file",
    executablePath: targetPath,
    version: "0.2.0",
    previousVersion: "0.1.0",
    startedAt: Date.now(),
  };
  await writeFile(recoveryPath, JSON.stringify(state));

  return {
    userDataPath,
    watchdogPath,
    recoveryPath,
    targetPath,
    backupPath,
    state,
    context: {
      userDataPath,
      platform: "linux",
      executablePath: targetPath,
      appImage: targetPath,
    },
  };
}

test("ignores invalid parent process IDs and unreadable recovery markers", async () => {
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "kitezh-watchdog-"));
  const watchdogPath = path.join(userDataPath, "watchdog.js");
  const context = {
    userDataPath,
    platform: "linux",
    executablePath: "/tmp/kitezh.AppImage",
    appImage: "/tmp/kitezh.AppImage",
  };

  try {
    let processChecks = 0;
    const dependencies = {
      isProcessExited: () => {
        processChecks += 1;
        return true;
      },
      now: Date.now,
      sleep: async () => undefined,
    };
    await runRecoveryWatchdog(watchdogPath, 0, context, dependencies, false);
    assert.equal(processChecks, 0);

    await runRecoveryWatchdog(
      watchdogPath,
      123,
      context,
      dependencies,
      false,
    );
    assert.equal(processChecks, 0);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});

test("ignores malformed and invalid recovery states without waiting", async () => {
  const fixture = await createRecoveryFixture();
  let processChecks = 0;
  const dependencies = {
    isProcessExited: () => {
      processChecks += 1;
      return true;
    },
    now: Date.now,
    sleep: async () => undefined,
  };

  try {
    await writeFile(fixture.recoveryPath, "not-json");
    await runRecoveryWatchdog(
      fixture.watchdogPath,
      123,
      fixture.context,
      dependencies,
      false,
    );
    assert.equal(processChecks, 0);

    await writeFile(
      fixture.recoveryPath,
      JSON.stringify({ ...fixture.state, targetPath: "/tmp/other.AppImage" }),
    );
    await runRecoveryWatchdog(
      fixture.watchdogPath,
      123,
      fixture.context,
      dependencies,
      false,
    );
    assert.equal(processChecks, 0);
    assert.equal(await readFile(fixture.backupPath, "utf8"), "previous-version");
  } finally {
    await rm(fixture.userDataPath, { recursive: true, force: true });
  }
});

test("waits for the parent and health window, then restores the previous AppImage", async () => {
  const fixture = await createRecoveryFixture();
  let processChecks = 0;
  let sleepCalls = 0;
  let clockCalls = 0;
  const dependencies = {
    isProcessExited: () => ++processChecks > 1,
    now: () => (clockCalls++ === 0 ? 1_000 : 31_000),
    sleep: async () => {
      sleepCalls += 1;
    },
  };

  try {
    await runRecoveryWatchdog(
      fixture.watchdogPath,
      123,
      fixture.context,
      dependencies,
      false,
    );

    assert.equal(processChecks, 2);
    assert.equal(sleepCalls, 1);
    assert.equal(await readFile(fixture.targetPath, "utf8"), "previous-version");
    await assert.rejects(readFile(fixture.backupPath));
  } finally {
    await rm(fixture.userDataPath, { recursive: true, force: true });
  }
});

test("does not roll back after the healthy app removes its recovery marker", async () => {
  const fixture = await createRecoveryFixture();
  let clock = 1_000;
  const dependencies = {
    isProcessExited: () => true,
    now: () => clock,
    sleep: async () => {
      clock += 500;
      await rm(fixture.recoveryPath, { force: true });
    },
  };

  try {
    await runRecoveryWatchdog(
      fixture.watchdogPath,
      123,
      fixture.context,
      dependencies,
      false,
    );

    assert.equal(await readFile(fixture.targetPath, "utf8"), "failed-version");
    assert.equal(await readFile(fixture.backupPath, "utf8"), "previous-version");
  } finally {
    await rm(fixture.userDataPath, { recursive: true, force: true });
  }
});
