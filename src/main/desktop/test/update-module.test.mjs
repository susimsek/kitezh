import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import Module from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const originalLoad = Module._load;
const originalAppImage = process.env.APPIMAGE;
if (process.platform === "linux" && !process.env.APPIMAGE) {
  process.env.APPIMAGE = "/tmp/kitezh-test.AppImage";
}
after(() => {
  if (originalAppImage === undefined) delete process.env.APPIMAGE;
  else process.env.APPIMAGE = originalAppImage;
});

const updateHandlers = new Map();
const publishedStatuses = [];
const updateDirectory = await mkdtemp(path.join(os.tmpdir(), "kitezh-update-"));
await mkdir(path.join(updateDirectory, "assets"), { recursive: true });
const signingKeys = generateKeyPairSync("ed25519");
const signedManifest = Buffer.from("version: 0.1.4\n");
const signedManifestSignature = sign(
  null,
  signedManifest,
  signingKeys.privateKey,
).toString("base64");
await writeFile(
  path.join(updateDirectory, "assets", "update-manifest-public-key.pem"),
  signingKeys.publicKey.export({ type: "spki", format: "pem" }),
);
const runtime = {
  packaged: true,
  version: "0.1.3",
  userData: "C:/kitezh-test-update-data",
  appPath: updateDirectory,
  netFetch: async (url) =>
    url.endsWith(".sig")
      ? {
          status: 200,
          ok: true,
          text: async () => signedManifestSignature,
        }
      : {
          status: 200,
          ok: true,
          arrayBuffer: async () => signedManifest,
        },
  updateCheck: async () => ({
    isUpdateAvailable: true,
    updateInfo: { version: "0.1.4" },
  }),
  updateDownload: async () => undefined,
};
const autoUpdater = {
  autoInstallOnAppQuit: false,
  autoDownload: true,
  allowDowngrade: true,
  on: (event, handler) => updateHandlers.set(event, handler),
  checkForUpdates: (...args) => runtime.updateCheck(...args),
  downloadUpdate: (...args) => runtime.updateDownload(...args),
  quitAndInstall: async () => undefined,
};

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        isPackaged: runtime.packaged,
        getPath: () => runtime.userData,
        getVersion: () => runtime.version,
        getAppPath: () => runtime.appPath,
      },
      net: { fetch: (...args) => runtime.netFetch(...args) },
    };
  }
  if (request === "electron-updater") return { autoUpdater };
  return originalLoad.call(this, request, parent, isMain);
};

const update = await import("../dist/update.js");
Module._load = originalLoad;

after(async () => {
  await rm(updateDirectory, { recursive: true, force: true });
});

test("configures the updater, checks signed release metadata, and reports update events", async () => {
  const previousAutoUpdate = process.env.DESKTOP_AUTO_UPDATE;
  delete process.env.DESKTOP_AUTO_UPDATE;
  update.configureAutoUpdater((status) => publishedStatuses.push(status));

  assert.equal(autoUpdater.autoDownload, false);
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  assert.equal(autoUpdater.allowDowngrade, false);

  await update.checkForUpdates();
  assert.equal(publishedStatuses[0].state, "checking");
  assert.equal(runtime.updateCheck !== undefined, true);

  updateHandlers.get("checking-for-update")();
  updateHandlers.get("update-available")({ version: "0.1.4" });
  updateHandlers.get("download-progress")({ percent: 51.25 });
  updateHandlers.get("update-downloaded")({ version: "0.1.4" });
  updateHandlers.get("update-not-available")();

  assert.deepEqual(
    publishedStatuses.slice(-5).map(({ state }) => state),
    ["checking", "available", "downloading", "downloaded", "not-available"],
  );
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  update.setAutomaticInstallOnAppQuit(true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  if (previousAutoUpdate === undefined) delete process.env.DESKTOP_AUTO_UPDATE;
  else process.env.DESKTOP_AUTO_UPDATE = previousAutoUpdate;
});

test("returns download results and publishes download errors", async () => {
  runtime.updateDownload = async () => undefined;
  assert.equal(await update.downloadUpdate(), true);

  runtime.updateDownload = async () => {
    throw new Error("download failed");
  };
  assert.equal(await update.downloadUpdate(), false);
  assert.deepEqual(publishedStatuses.at(-1), {
    state: "error",
    message: "Desktop update could not be downloaded.",
  });
});
