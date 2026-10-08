import { autoUpdater } from "electron-updater";
import { app, net } from "electron";
import { spawn } from "node:child_process";
import { verify } from "node:crypto";
import { cp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type DesktopUpdateStatus =
  | { state: "unsupported" }
  | { state: "checking" }
  | { state: "available"; version: string }
  | { state: "not-available" }
  | { state: "downloading"; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "recovered"; version: string }
  | { state: "error"; message: string };

type UpdateListener = (status: DesktopUpdateStatus) => void;

const UPDATE_REPOSITORY = "susimsek/kitezh";
const UPDATE_RECOVERY_FILE = "desktop-update-recovery.json";
const UPDATE_WATCHDOG_FILE = "desktop-update-watchdog.js";
const UPDATE_HEALTH_WINDOW_MS = 15_000;
const UPDATE_RETRY_DELAY_MS = 2_000;

let listener: UpdateListener | null = null;
let configured = false;
let downloadedVersion: string | null = null;
let updateRetryScheduled = false;
let updateRetryAttempted = false;

export function setAutomaticInstallOnAppQuit(enabled: boolean) {
  autoUpdater.autoInstallOnAppQuit = enabled;
}

function updateManifestName() {
  if (process.platform === "darwin") return "latest-mac.yml";
  if (process.platform === "win32") return "latest.yml";
  return "latest-linux.yml";
}

function updateManifestUrl() {
  return `https://github.com/${UPDATE_REPOSITORY}/releases/latest/download/${updateManifestName()}`;
}

function updateRecoveryPath() {
  return path.join(app.getPath("userData"), UPDATE_RECOVERY_FILE);
}

function rollbackTarget() {
  if (process.platform === "darwin") {
    return {
      type: "directory" as const,
      path: path.resolve(process.execPath, "../../../"),
      executable: process.execPath,
    };
  }
  if (process.platform === "win32") {
    return {
      type: "directory" as const,
      path: path.dirname(process.execPath),
      executable: process.execPath,
    };
  }
  if (process.env.APPIMAGE) {
    return {
      type: "file" as const,
      path: process.env.APPIMAGE,
      executable: process.env.APPIMAGE,
    };
  }
  return null;
}

async function verifyPublishedManifest() {
  const manifestResponse = await net.fetch(updateManifestUrl());
  if (!manifestResponse.ok) {
    throw new Error(
      `Update manifest request failed with ${manifestResponse.status}.`,
    );
  }
  const manifest = Buffer.from(await manifestResponse.arrayBuffer());
  const signatureResponse = await net.fetch(`${updateManifestUrl()}.sig`);
  if (signatureResponse.status === 404) {
    if (process.env.DESKTOP_UPDATE_REQUIRE_SIGNATURE === "true") {
      throw new Error("The update manifest signature is missing.");
    }
    return;
  }
  if (!signatureResponse.ok) {
    throw new Error(
      `Update signature request failed with ${signatureResponse.status}.`,
    );
  }
  const signature = Buffer.from(
    (await signatureResponse.text()).trim(),
    "base64",
  );
  const publicKey = await readFile(
    path.join(app.getAppPath(), "assets", "update-manifest-public-key.pem"),
  );
  if (!verify(null, manifest, publicKey, signature)) {
    throw new Error("The update manifest signature is invalid.");
  }
}

async function markUpdatePending(version: string) {
  const target = rollbackTarget();
  if (!target) {
    throw new Error("Rollback is unavailable for this installation type.");
  }
  const backupPath = path.join(
    app.getPath("userData"),
    `desktop-update-backup-${Date.now()}`,
  );
  await mkdir(path.dirname(backupPath), { recursive: true });
  if (target.type === "directory") {
    await cp(target.path, backupPath, { recursive: true, force: true });
  } else {
    await cp(target.path, backupPath, { force: true });
  }
  await writeFile(
    updateRecoveryPath(),
    JSON.stringify({
      version,
      previousVersion: app.getVersion(),
      startedAt: Date.now(),
      backupPath,
      targetPath: target.path,
      targetType: target.type,
      executablePath: target.executable,
    }),
    { mode: 0o600 },
  );
  await startRollbackWatchdog();
}

async function markUpdateHealthy() {
  try {
    const state = JSON.parse(await readFile(updateRecoveryPath(), "utf8")) as {
      backupPath?: string;
    };
    await unlink(updateRecoveryPath());
    if (state.backupPath)
      await rm(state.backupPath, { recursive: true, force: true });
  } catch {
    // The marker is optional and may not exist on the first launch.
  }
}

async function startRollbackWatchdog() {
  const source = path.join(app.getAppPath(), "dist", UPDATE_WATCHDOG_FILE);
  const destination = path.join(app.getPath("userData"), UPDATE_WATCHDOG_FILE);
  await cp(source, destination, { force: true });
  const child = spawn(
    process.execPath,
    [destination, updateRecoveryPath(), `${process.pid}`],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      windowsHide: true,
    },
  );
  child.unref();
}

async function initializeUpdateRecovery() {
  try {
    const state = JSON.parse(await readFile(updateRecoveryPath(), "utf8")) as {
      version?: string;
      previousVersion?: string;
      startedAt?: number;
    };
    if (state.version === app.getVersion() && state.startedAt) {
      const elapsed = Date.now() - state.startedAt;
      if (elapsed >= UPDATE_HEALTH_WINDOW_MS) {
        publish({ state: "recovered", version: state.version });
        await markUpdateHealthy();
        return;
      }
      setTimeout(
        () => void markUpdateHealthy(),
        UPDATE_HEALTH_WINDOW_MS - elapsed,
      );
      return;
    }
    if (state.previousVersion === app.getVersion()) {
      publish({ state: "recovered", version: app.getVersion() });
    }
    await markUpdateHealthy();
  } catch {
    // No recovery marker means this is a normal launch.
  }
}

export function supportsAutoUpdate({
  appImage,
  autoUpdate,
  packaged,
  platform,
}: {
  appImage: boolean;
  autoUpdate?: string;
  packaged: boolean;
  platform: NodeJS.Platform;
}) {
  if (!packaged || autoUpdate === "false") return false;
  return platform !== "linux" || appImage;
}

function isSupported() {
  return supportsAutoUpdate({
    appImage: Boolean(process.env.APPIMAGE),
    autoUpdate: process.env.DESKTOP_AUTO_UPDATE,
    packaged: app.isPackaged,
    platform: process.platform,
  });
}

function isUpdatePreviewEnabled() {
  return !app.isPackaged && process.env.DESKTOP_UPDATE_PREVIEW === "true";
}

type UpdatePreviewState = "available" | "not-available" | "error";

function updatePreviewState(): UpdatePreviewState {
  const value = process.env.DESKTOP_UPDATE_PREVIEW_STATE;
  if (value === "not-available" || value === "error") return value;
  return "available";
}

function publish(status: DesktopUpdateStatus) {
  listener?.(status);
}

function scheduleUpdateRetry() {
  if (updateRetryScheduled || updateRetryAttempted || !isSupported()) return;
  updateRetryAttempted = true;
  updateRetryScheduled = true;
  setTimeout(() => {
    updateRetryScheduled = false;
    void checkForUpdates();
  }, UPDATE_RETRY_DELAY_MS);
}

export function configureAutoUpdater(nextListener: UpdateListener) {
  if (configured) return;
  configured = true;
  listener = nextListener;
  if (!isSupported()) {
    publish({ state: "unsupported" });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on("checking-for-update", () => publish({ state: "checking" }));
  autoUpdater.on("update-available", (info) =>
    publish({ state: "available", version: info.version }),
  );
  autoUpdater.on("update-not-available", () => {
    updateRetryAttempted = false;
    publish({ state: "not-available" });
  });
  autoUpdater.on("download-progress", (progress) =>
    publish({ state: "downloading", percent: progress.percent }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    updateRetryAttempted = false;
    downloadedVersion = info.version;
    publish({ state: "downloaded", version: info.version });
  });
  autoUpdater.on("error", () => {
    publish({
      state: "error",
      message: "Desktop update could not be completed.",
    });
    scheduleUpdateRetry();
  });

  void initializeUpdateRecovery();
  if (!isUpdatePreviewEnabled()) {
    setTimeout(() => void checkForUpdates(), 5_000);
  }
}

export async function checkForUpdates() {
  if (!isSupported()) {
    if (isUpdatePreviewEnabled()) {
      publish({ state: "checking" });
      const version =
        process.env.DESKTOP_UPDATE_PREVIEW_VERSION ??
        `${app.getVersion()}-preview`;
      setTimeout(() => {
        const previewState = updatePreviewState();
        if (previewState === "not-available") {
          publish({ state: "not-available" });
        } else if (previewState === "error") {
          publish({
            state: "error",
            message: "Desktop update could not be checked.",
          });
        } else {
          publish({ state: "available", version });
        }
      }, 600);
      return;
    }
    publish({ state: "unsupported" });
    return;
  }
  publish({ state: "checking" });
  try {
    await verifyPublishedManifest();
    await autoUpdater.checkForUpdates();
  } catch {
    publish({
      state: "error",
      message: "Desktop update could not be checked.",
    });
    scheduleUpdateRetry();
  }
}

export async function downloadUpdate() {
  if (!isSupported()) return false;
  try {
    await autoUpdater.downloadUpdate();
    return true;
  } catch {
    publish({
      state: "error",
      message: "Desktop update could not be downloaded.",
    });
    scheduleUpdateRetry();
    return false;
  }
}

export function installUpdate() {
  if (!isSupported() || !downloadedVersion) return;
  void markUpdatePending(downloadedVersion)
    .then(() => autoUpdater.quitAndInstall(false, true))
    .catch(() => {
      publish({
        state: "error",
        message: "Desktop update could not be prepared.",
      });
      scheduleUpdateRetry();
    });
}
