import { autoUpdater } from "electron-updater";
import { app, net } from "electron";
import { verify } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
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
const UPDATE_HEALTH_WINDOW_MS = 15_000;

let listener: UpdateListener | null = null;
let configured = false;
let downloadedVersion: string | null = null;

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

async function verifyPublishedManifest() {
  const manifestResponse = await net.fetch(updateManifestUrl());
  if (!manifestResponse.ok) {
    throw new Error(`Update manifest request failed with ${manifestResponse.status}.`);
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
    throw new Error(`Update signature request failed with ${signatureResponse.status}.`);
  }
  const signature = Buffer.from((await signatureResponse.text()).trim(), "base64");
  const publicKey = await readFile(
    path.join(app.getAppPath(), "assets", "update-manifest-public-key.pem"),
  );
  if (!verify(null, manifest, publicKey, signature)) {
    throw new Error("The update manifest signature is invalid.");
  }
}

async function markUpdatePending(version: string) {
  await writeFile(
    updateRecoveryPath(),
    JSON.stringify({ version, previousVersion: app.getVersion(), startedAt: Date.now() }),
    { mode: 0o600 },
  );
}

async function markUpdateHealthy() {
  try {
    await unlink(updateRecoveryPath());
  } catch {
    // The marker is optional and may not exist on the first launch.
  }
}

async function initializeUpdateRecovery() {
  try {
    const state = JSON.parse(await readFile(updateRecoveryPath(), "utf8")) as {
      version?: string;
      startedAt?: number;
    };
    if (state.version === app.getVersion() && state.startedAt) {
      const elapsed = Date.now() - state.startedAt;
      if (elapsed >= UPDATE_HEALTH_WINDOW_MS) {
        publish({ state: "recovered", version: state.version });
        await markUpdateHealthy();
        return;
      }
      setTimeout(() => void markUpdateHealthy(), UPDATE_HEALTH_WINDOW_MS - elapsed);
      return;
    }
    await markUpdateHealthy();
  } catch {
    // No recovery marker means this is a normal launch.
  }
}

function isSupported() {
  if (!process.env.DESKTOP_AUTO_UPDATE || process.env.DESKTOP_AUTO_UPDATE === "true") {
    return process.platform !== "linux" || Boolean(process.env.APPIMAGE);
  }
  return false;
}

function publish(status: DesktopUpdateStatus) {
  listener?.(status);
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
  autoUpdater.on("update-not-available", () =>
    publish({ state: "not-available" }),
  );
  autoUpdater.on("download-progress", (progress) =>
    publish({ state: "downloading", percent: progress.percent }),
  );
  autoUpdater.on("update-downloaded", (info) => {
    downloadedVersion = info.version;
    publish({ state: "downloaded", version: info.version });
  });
  autoUpdater.on("error", () =>
    publish({ state: "error", message: "Desktop update could not be completed." }),
  );

  void initializeUpdateRecovery();
  setTimeout(() => void checkForUpdates(), 5_000);
}

export async function checkForUpdates() {
  if (!isSupported()) {
    publish({ state: "unsupported" });
    return;
  }
  try {
    await verifyPublishedManifest();
    await autoUpdater.checkForUpdates();
  } catch {
    publish({ state: "error", message: "Desktop update could not be checked." });
  }
}

export async function downloadUpdate() {
  if (!isSupported()) return;
  try {
    await autoUpdater.downloadUpdate();
  } catch {
    publish({ state: "error", message: "Desktop update could not be downloaded." });
  }
}

export function installUpdate() {
  if (!isSupported() || !downloadedVersion) return;
  void markUpdatePending(downloadedVersion)
    .then(() => autoUpdater.quitAndInstall(false, true))
    .catch(() =>
      publish({ state: "error", message: "Desktop update could not be prepared." }),
    );
}
