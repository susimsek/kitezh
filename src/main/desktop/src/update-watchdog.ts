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

function processExited(pid: number) {
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
  await restoreInstallationAttempt(state, launch, MAX_RESTORE_ATTEMPTS);
}

async function restoreInstallationAttempt(
  state: RecoveryState,
  launch: boolean,
  attemptsRemaining: number,
): Promise<void> {
  if (attemptsRemaining === 0) return;
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
  } catch {
    await sleep(RETRY_DELAY_MS);
    await restoreInstallationAttempt(state, launch, attemptsRemaining - 1);
  }
}

async function waitForProcessExit(pid: number): Promise<void> {
  if (processExited(pid)) return;
  await sleep(RETRY_DELAY_MS);
  await waitForProcessExit(pid);
}

async function markerExists(recoveryPath: string): Promise<boolean> {
  try {
    await readFile(recoveryPath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function waitForHealthWindow(
  recoveryPath: string,
  deadline: number,
): Promise<boolean> {
  if (!(await markerExists(recoveryPath))) return false;
  if (Date.now() >= deadline) return true;
  await sleep(RETRY_DELAY_MS);
  return waitForHealthWindow(recoveryPath, deadline);
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

  await waitForProcessExit(parentPid);
  const deadline = Date.now() + HEALTH_WINDOW_MS;
  if (!(await waitForHealthWindow(recoveryPath, deadline))) return;
  await restoreInstallation(state, recoveryPath);
}

if (require.main === module) void run();
