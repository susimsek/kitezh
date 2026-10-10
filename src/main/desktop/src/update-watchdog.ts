import { spawn } from "node:child_process";
import { cp, readFile, rm, rename } from "node:fs/promises";
import path from "node:path";

// Keep the watchdog window longer than the app's health confirmation window.
// The new process removes the recovery marker after 15 seconds; waiting an
// additional window avoids racing that cleanup and rolling back a healthy
// Windows installation.
const HEALTH_WINDOW_MS = 30_000;
const RETRY_DELAY_MS = 500;
const MAX_RESTORE_ATTEMPTS = 30;

type RecoveryState = {
  backupPath: string;
  targetPath: string;
  targetType: "directory" | "file";
  executablePath: string;
  version: string;
  previousVersion: string;
  startedAt: number;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function processExited(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

export async function restoreInstallation(
  state: RecoveryState,
  recoveryPath: string,
  launch = true,
) {
  for (let attempt = 0; attempt < MAX_RESTORE_ATTEMPTS; attempt += 1) {
    try {
      if (state.targetType === "directory") {
        const failedPath = `${state.targetPath}.failed-${Date.now()}`;
        await rename(state.targetPath, failedPath).catch(() => undefined);
        await cp(state.backupPath, state.targetPath, {
          recursive: true,
          force: true,
        });
        await rm(failedPath, { recursive: true, force: true });
      } else {
        await cp(state.backupPath, state.targetPath, { force: true });
      }
      await rm(state.backupPath, { recursive: true, force: true });
      if (launch) {
        spawn(state.executablePath, [], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        }).unref();
      }
      return;
    } catch {
      await sleep(RETRY_DELAY_MS);
    }
  }
}

async function run() {
  const recoveryPath = process.argv[2];
  const parentPid = Number(process.argv[3]);
  if (!recoveryPath || !Number.isInteger(parentPid)) return;

  let state: RecoveryState;
  try {
    state = JSON.parse(await readFile(recoveryPath, "utf8")) as RecoveryState;
  } catch {
    return;
  }

  while (!(await processExited(parentPid))) await sleep(RETRY_DELAY_MS);
  const deadline = Date.now() + HEALTH_WINDOW_MS;
  while (Date.now() < deadline) {
    try {
      await readFile(recoveryPath, "utf8");
    } catch {
      return;
    }
    await sleep(RETRY_DELAY_MS);
  }

  try {
    await readFile(recoveryPath, "utf8");
  } catch {
    return;
  }
  await restoreInstallation(state, recoveryPath);
}

if (require.main === module) void run();
