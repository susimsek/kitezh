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
const RECOVERY_FILE_NAME = "desktop-update-recovery.json";
const BACKUP_FILE_PREFIX = "desktop-update-backup-";

type RecoveryState = {
  backupPath: string;
  targetPath: string;
  targetType: "directory" | "file";
  executablePath: string;
  version: string;
  previousVersion: string;
  startedAt: number;
};

type RecoveryContext = {
  userDataPath: string;
  platform: string;
  executablePath: string;
  appImage?: string;
};

function pathsEqual(left: string, right: string, platform: string) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function expectedRollbackTarget(context: RecoveryContext) {
  if (context.platform === "darwin") {
    return {
      path: path.resolve(context.executablePath, "../../../"),
      type: "directory",
      executable: context.executablePath,
    } as const;
  }
  if (context.platform === "win32") {
    return {
      path: path.dirname(context.executablePath),
      type: "directory",
      executable: context.executablePath,
    } as const;
  }
  if (context.platform === "linux" && context.appImage) {
    return {
      path: context.appImage,
      type: "file",
      executable: context.appImage,
    } as const;
  }
  return null;
}

export function isValidRecoveryState(
  value: unknown,
  context: RecoveryContext,
): value is RecoveryState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<RecoveryState>;
  const target = expectedRollbackTarget(context);
  if (
    !target ||
    typeof state.backupPath !== "string" ||
    !path.isAbsolute(state.backupPath) ||
    typeof state.targetPath !== "string" ||
    !path.isAbsolute(state.targetPath) ||
    typeof state.executablePath !== "string" ||
    !path.isAbsolute(state.executablePath) ||
    typeof state.version !== "string" ||
    state.version.length === 0 ||
    typeof state.previousVersion !== "string" ||
    state.previousVersion.length === 0 ||
    !Number.isSafeInteger(state.startedAt) ||
    state.targetType !== target.type
  ) {
    return false;
  }

  const backupPath = path.resolve(state.backupPath);
  return (
    pathsEqual(path.dirname(backupPath), context.userDataPath, context.platform) &&
    path.basename(backupPath).startsWith(BACKUP_FILE_PREFIX) &&
    /^desktop-update-backup-\d+$/.test(path.basename(backupPath)) &&
    pathsEqual(state.targetPath, target.path, context.platform) &&
    pathsEqual(state.executablePath, target.executable, context.platform)
  );
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

type WatchdogDependencies = {
  isProcessExited: (pid: number) => boolean;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
};

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

async function waitForProcessExit(
  pid: number,
  dependencies: WatchdogDependencies,
): Promise<void> {
  if (dependencies.isProcessExited(pid)) return;
  await dependencies.sleep(RETRY_DELAY_MS);
  await waitForProcessExit(pid, dependencies);
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
  dependencies: WatchdogDependencies,
): Promise<boolean> {
  if (!(await markerExists(recoveryPath))) return false;
  if (dependencies.now() >= deadline) return true;
  await dependencies.sleep(RETRY_DELAY_MS);
  return waitForHealthWindow(recoveryPath, deadline, dependencies);
}

export async function runRecoveryWatchdog(
  watchdogPath: string,
  parentPid: number,
  context: RecoveryContext,
  dependencies: WatchdogDependencies = {
    isProcessExited: processExited,
    now: Date.now,
    sleep,
  },
  launch = true,
) {
  const recoveryPath = path.join(
    path.dirname(watchdogPath),
    RECOVERY_FILE_NAME,
  );
  if (!Number.isSafeInteger(parentPid) || parentPid <= 0) return;

  let state: unknown;
  try {
    state = JSON.parse(await readFile(recoveryPath, "utf8"));
  } catch {
    return;
  }
  if (!isValidRecoveryState(state, context)) return;

  await waitForProcessExit(parentPid, dependencies);
  const deadline = dependencies.now() + HEALTH_WINDOW_MS;
  if (!(await waitForHealthWindow(recoveryPath, deadline, dependencies))) return;
  await restoreInstallation(state, recoveryPath, launch);
}

async function run() {
  const watchdogPath = __filename;
  const parentPid = Number(process.argv[2]);
  await runRecoveryWatchdog(watchdogPath, parentPid, {
    userDataPath: path.dirname(watchdogPath),
    platform: process.platform,
    executablePath: process.execPath,
    appImage: process.env.APPIMAGE,
  });
}

if (require.main === module) void run();
