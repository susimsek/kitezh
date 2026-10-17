import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import Module from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const originalLoad = Module._load;
const originalFsPromises = originalLoad("node:fs/promises", null);
const originalChildProcess = originalLoad("node:child_process", null);
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
const updateOperations = [];
let recoveryMarker;
let recoveryState;
let quitAndInstallCalls = 0;
let failNextBackupCopy = false;
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
  releaseMetadataResponse: null,
  updateDownload: async () => undefined,
};
const successfulManifestFetch = runtime.netFetch;
const autoUpdater = {
  autoInstallOnAppQuit: false,
  autoDownload: true,
  allowDowngrade: true,
  on: (event, handler) => updateHandlers.set(event, handler),
  checkForUpdates: (...args) => runtime.updateCheck(...args),
  downloadUpdate: (...args) => runtime.updateDownload(...args),
  quitAndInstall: async (...args) => {
    quitAndInstallCalls += 1;
    updateOperations.push({ operation: "quitAndInstall", args });
  },
};

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        get isPackaged() {
          return runtime.packaged;
        },
        getPath: () => runtime.userData,
        getVersion: () => runtime.version,
        getAppPath: () => runtime.appPath,
      },
      net: { fetch: (...args) => runtime.netFetch(...args) },
    };
  }
  if (request === "electron-updater") return { autoUpdater };
  if (request === "node:fs/promises") {
    return {
      ...originalFsPromises,
      mkdir: async (...args) =>
        updateOperations.push({ operation: "mkdir", args }),
      cp: async (...args) => {
        if (
          failNextBackupCopy &&
          String(args[1]).includes("desktop-update-backup-")
        ) {
          failNextBackupCopy = false;
          throw new Error("test-only backup preparation failure");
        }
        updateOperations.push({ operation: "cp", args });
      },
      writeFile: async (...args) => {
        updateOperations.push({ operation: "writeFile", args });
        recoveryMarker = JSON.parse(String(args[1]));
      },
      readFile: async (...args) => {
        if (String(args[0]).endsWith("update-manifest-public-key.pem"))
          return originalFsPromises.readFile(...args);
        if (
          String(args[0]).endsWith("desktop-update-recovery.json") &&
          recoveryState
        )
          return JSON.stringify(recoveryState);
        throw new Error("No recovery marker in isolated updater test.");
      },
      unlink: async (...args) => {
        if (
          String(args[0]).endsWith("desktop-update-recovery.json") &&
          recoveryState
        ) {
          recoveryState = undefined;
          return;
        }
        return originalFsPromises.unlink(...args);
      },
    };
  }
  if (request === "node:child_process") {
    return {
      ...originalChildProcess,
      spawn: (...args) => {
        updateOperations.push({ operation: "spawn", args });
        return { unref: () => updateOperations.push({ operation: "unref" }) };
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const update = await import("../dist/update.js");
Module._load = originalLoad;

after(async () => {
  await rm(updateDirectory, { recursive: true, force: true });
});

test("configures the updater, checks signed release metadata, and reports update events", async () => {
  const previousAutoUpdate = process.env.DESKTOP_AUTO_UPDATE;
  const backupPath = path.join(updateDirectory, "startup-recovery-backup");
  await writeFile(backupPath, "previous-version");
  recoveryState = {
    version: runtime.version,
    previousVersion: "0.1.2",
    startedAt: Date.now() - 20_000,
    backupPath,
  };
  delete process.env.DESKTOP_AUTO_UPDATE;
  update.configureAutoUpdater((status) => publishedStatuses.push(status));

  assert.equal(autoUpdater.autoDownload, false);
  assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  assert.equal(autoUpdater.allowDowngrade, false);

  await update.checkForUpdates();
  assert.ok(publishedStatuses.some(({ state }) => state === "checking"));
  assert.equal(runtime.updateCheck !== undefined, true);
  for (
    let turn = 0;
    turn < 20 && !publishedStatuses.some(({ state }) => state === "recovered");
    turn += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.ok(
    publishedStatuses.some(
      (status) =>
        status.state === "recovered" && status.version === runtime.version,
    ),
  );
  await assert.rejects(originalFsPromises.readFile(backupPath));
  recoveryState = undefined;

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

test("checks unsigned update manifests when no verification key is bundled", async () => {
  const originalAppPath = runtime.appPath;
  const unsignedAppPath = path.join(updateDirectory, "unsigned-build");
  await mkdir(path.join(unsignedAppPath, "assets"), { recursive: true });
  runtime.appPath = unsignedAppPath;
  runtime.netFetch = async (url) => {
    if (url.endsWith(".sig")) return { status: 404, ok: false };
    return {
      status: 200,
      ok: true,
      arrayBuffer: async () => signedManifest,
    };
  };
  const beforeCheck = publishedStatuses.length;

  try {
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeCheck), [
      { state: "checking" },
      { state: "available", version: "0.1.4" },
    ]);
  } finally {
    runtime.appPath = originalAppPath;
    runtime.netFetch = successfulManifestFetch;
  }
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

test("fails closed when the signed manifest or updater metadata is unavailable", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 2_000 || delay === 5_000) {
      return /** @type {NodeJS.Timeout} */ ({});
    }
    return originalSetTimeout(callback, delay, ...args);
  };

  try {
    update.configureAutoUpdater((status) => publishedStatuses.push(status));
    runtime.netFetch = async () => ({ status: 503, ok: false });
    const beforeManifestFailure = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeManifestFailure), [
      { state: "checking" },
      { state: "error", message: "Desktop update could not be checked." },
    ]);
    assert.equal(await update.downloadUpdate(), false);

    runtime.netFetch = successfulManifestFetch;
    const beforeMissingSignature = publishedStatuses.length;
    runtime.netFetch = async (url) =>
      url.endsWith(".sig")
        ? { status: 404, ok: false }
        : {
            status: 200,
            ok: true,
            arrayBuffer: async () => signedManifest,
          };
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeMissingSignature), [
      { state: "checking" },
      { state: "error", message: "Desktop update could not be checked." },
    ]);

    runtime.netFetch = async (url) =>
      url.endsWith(".sig")
        ? { status: 503, ok: false }
        : {
            status: 200,
            ok: true,
            arrayBuffer: async () => signedManifest,
          };
    const beforeFailedSignatureRequest = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeFailedSignatureRequest), [
      { state: "checking" },
      { state: "error", message: "Desktop update could not be checked." },
    ]);

    runtime.netFetch = successfulManifestFetch;
    runtime.updateCheck = async () => null;
    const beforeMissingMetadata = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeMissingMetadata), [
      { state: "checking" },
      { state: "error", message: "Desktop update could not be checked." },
    ]);

    runtime.updateCheck = async () => ({
      isUpdateAvailable: false,
      updateInfo: { version: "0.1.4" },
    });
    const beforeNoUpdate = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeNoUpdate), [
      { state: "checking" },
      { state: "not-available" },
    ]);

    runtime.updateCheck = async () => ({
      isUpdateAvailable: true,
      updateInfo: { version: "0.1.5" },
    });
    const beforeMetadataMismatch = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeMetadataMismatch), [
      { state: "checking" },
      { state: "error", message: "Desktop update could not be checked." },
    ]);
    runtime.updateCheck = async () => ({
      isUpdateAvailable: true,
      updateInfo: { version: "0.1.4" },
    });
    await update.checkForUpdates();
    updateHandlers.get("update-downloaded")({ version: "0.1.4" });
    const beforeUpdaterError = publishedStatuses.length;
    updateHandlers.get("error")(new Error("test-only updater failure"));
    assert.deepEqual(publishedStatuses.slice(beforeUpdaterError), [
      {
        state: "error",
        message: "Desktop update could not be completed.",
      },
    ]);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    runtime.netFetch = successfulManifestFetch;
    runtime.updateCheck = async () => ({
      isUpdateAvailable: true,
      updateInfo: { version: "0.1.4" },
    });
  }
});

test("rejects non-object signed manifest metadata before comparing releases", () => {
  assert.throws(
    () =>
      update.assertUpdateInfoMatchesSignedManifest(
        Buffer.from("null", "utf8"),
        { version: "0.1.4" },
      ),
    /Update manifest metadata is invalid/,
  );
  assert.throws(
    () => update.assertUpdateInfoMatchesSignedManifest(signedManifest, null),
    /Update manifest metadata is invalid/,
  );
});

test("skips the signed manifest when shared metadata says the release is current", async () => {
  const originalFetch = runtime.netFetch;
  const originalVersion = runtime.version;
  const requests = [];
  runtime.releaseMetadataResponse = {
    status: 200,
    ok: true,
    json: async () => ({
      tag: `v${runtime.version}`,
      version: runtime.version,
      releaseUrl: `https://github.com/susimsek/kitezh/releases/tag/v${runtime.version}`,
      assets: {
        windowsInstaller: `https://github.com/susimsek/kitezh/releases/download/v${runtime.version}/kitezh.exe`,
        macosAppleSilicon: `https://github.com/susimsek/kitezh/releases/download/v${runtime.version}/kitezh-macos-arm64.dmg`,
        macosIntel: `https://github.com/susimsek/kitezh/releases/download/v${runtime.version}/kitezh-macos-x64.dmg`,
        linuxX64AppImage: `https://github.com/susimsek/kitezh/releases/download/v${runtime.version}/kitezh-linux-x64.AppImage`,
        linuxArm64AppImage: `https://github.com/susimsek/kitezh/releases/download/v${runtime.version}/kitezh-linux-arm64.AppImage`,
      },
    }),
  };
  runtime.netFetch = async (url) => {
    requests.push(url);
    if (url.endsWith("/api/public/app-release"))
      return runtime.releaseMetadataResponse;
    return originalFetch(url);
  };

  try {
    const before = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(before), [
      { state: "checking" },
      { state: "not-available" },
    ]);
    assert.deepEqual(requests, [
      "https://kitezh.onrender.com/api/public/app-release",
    ]);
  } finally {
    runtime.netFetch = originalFetch;
    runtime.version = originalVersion;
    runtime.releaseMetadataResponse = null;
    await update.checkForUpdates();
  }
});

test("checks the signed updater manifest when shared release metadata is newer", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) =>
    delay === 5_000
      ? /** @type {NodeJS.Timeout} */ ({})
      : originalSetTimeout(callback, delay, ...args);
  update.configureAutoUpdater((status) => publishedStatuses.push(status));
  globalThis.setTimeout = originalSetTimeout;
  const requests = [];
  const assetKey =
    process.platform === "win32"
      ? "windowsInstaller"
      : process.platform === "darwin"
        ? process.arch === "arm64"
          ? "macosAppleSilicon"
          : "macosIntel"
        : process.arch === "arm64"
          ? "linuxArm64AppImage"
          : "linuxX64AppImage";
  const manifestName =
    process.platform === "darwin"
      ? "latest-mac.yml"
      : process.platform === "win32"
        ? "latest.yml"
        : "latest-linux.yml";
  const originalFetch = runtime.netFetch;
  const originalUpdateCheck = runtime.updateCheck;
  runtime.releaseMetadataResponse = {
    status: 200,
    ok: true,
    json: async () => ({
      tag: "v0.1.5",
      version: "0.1.5",
      releaseUrl: "https://github.com/susimsek/kitezh/releases/tag/v0.1.5",
      assets: {
        [assetKey]:
          "https://github.com/susimsek/kitezh/releases/download/v0.1.5/kitezh-installer",
      },
    }),
  };
  runtime.netFetch = async (url) => {
    requests.push(url);
    if (url.endsWith("/api/public/app-release"))
      return runtime.releaseMetadataResponse;
    return originalFetch(url);
  };
  runtime.updateCheck = async () => ({
    isUpdateAvailable: true,
    updateInfo: { version: "0.1.4" },
  });

  try {
    const before = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(before), [
      { state: "checking" },
      { state: "available", version: "0.1.4" },
    ]);
    assert.deepEqual(requests, [
      "https://kitezh.onrender.com/api/public/app-release",
      `https://github.com/susimsek/kitezh/releases/latest/download/${manifestName}`,
      `https://github.com/susimsek/kitezh/releases/latest/download/${manifestName}.sig`,
    ]);
  } finally {
    runtime.netFetch = originalFetch;
    runtime.updateCheck = originalUpdateCheck;
    runtime.releaseMetadataResponse = null;
  }
});

test("prepares a reversible update for the current install type before starting installation", async () => {
  updateOperations.length = 0;
  quitAndInstallCalls = 0;
  updateHandlers.get("update-downloaded")({ version: "0.1.4" });

  update.installUpdate();
  for (let turn = 0; turn < 20 && quitAndInstallCalls === 0; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  assert.ok(recoveryMarker);
  assert.equal(recoveryMarker.version, "0.1.4");
  assert.equal(recoveryMarker.previousVersion, "0.1.3");
  const appImagePath =
    process.platform === "linux" ? process.env.APPIMAGE : undefined;
  assert.equal(recoveryMarker.targetType, appImagePath ? "file" : "directory");
  assert.equal(recoveryMarker.executablePath, appImagePath ?? process.execPath);
  assert.ok(
    updateOperations.findIndex(({ operation }) => operation === "spawn") <
      updateOperations.findIndex(
        ({ operation }) => operation === "quitAndInstall",
      ),
  );
  assert.equal(quitAndInstallCalls, 1);
  assert.deepEqual(
    updateOperations.find(({ operation }) => operation === "writeFile").args[2],
    { mode: 0o600 },
  );
});

test("reports all development update preview outcomes without contacting the updater", async () => {
  const previousPreview = process.env.DESKTOP_UPDATE_PREVIEW;
  const previousState = process.env.DESKTOP_UPDATE_PREVIEW_STATE;
  const previousVersion = process.env.DESKTOP_UPDATE_PREVIEW_VERSION;
  runtime.packaged = false;
  process.env.DESKTOP_UPDATE_PREVIEW = "true";
  process.env.DESKTOP_UPDATE_PREVIEW_VERSION = "0.1.5-preview";

  try {
    for (const [preview, expected] of [
      ["not-available", "not-available"],
      ["error", "error"],
      ["unknown", "available"],
    ]) {
      process.env.DESKTOP_UPDATE_PREVIEW_STATE = preview;
      const before = publishedStatuses.length;
      await update.checkForUpdates();
      await new Promise((resolve) => setTimeout(resolve, 1_550));
      assert.equal(publishedStatuses[before].state, "checking");
      assert.equal(publishedStatuses.at(-1).state, expected);
      if (expected === "available")
        assert.equal(publishedStatuses.at(-1).version, "0.1.5-preview");
    }
    assert.equal(await update.downloadUpdate(), false);
    update.installUpdate();
    assert.equal(quitAndInstallCalls, 1);
  } finally {
    runtime.packaged = true;
    for (const [name, value] of [
      ["DESKTOP_UPDATE_PREVIEW", previousPreview],
      ["DESKTOP_UPDATE_PREVIEW_STATE", previousState],
      ["DESKTOP_UPDATE_PREVIEW_VERSION", previousVersion],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("keeps unsupported update installs disabled and reports backup preparation failures", async () => {
  const previousPreview = process.env.DESKTOP_UPDATE_PREVIEW;
  const previousSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay, ...args) =>
    delay === 2_000
      ? /** @type {NodeJS.Timeout} */ ({})
      : previousSetTimeout(callback, delay, ...args);

  try {
    runtime.packaged = false;
    delete process.env.DESKTOP_UPDATE_PREVIEW;
    const beforeUnsupported = publishedStatuses.length;
    await update.checkForUpdates();
    assert.deepEqual(publishedStatuses.slice(beforeUnsupported), [
      { state: "unsupported" },
    ]);

    runtime.packaged = true;
    updateOperations.length = 0;
    quitAndInstallCalls = 0;
    failNextBackupCopy = true;
    updateHandlers.get("update-downloaded")({ version: "0.1.4" });
    const beforePreparationFailure = publishedStatuses.length;
    update.installUpdate();
    for (
      let turn = 0;
      turn < 20 &&
      !publishedStatuses
        .slice(beforePreparationFailure)
        .some(
          ({ message }) => message === "Desktop update could not be prepared.",
        );
      turn += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.ok(
      publishedStatuses
        .slice(beforePreparationFailure)
        .some(
          ({ state, message }) =>
            state === "error" &&
            message === "Desktop update could not be prepared.",
        ),
    );
    assert.equal(
      updateOperations.some(({ operation }) => operation === "writeFile"),
      false,
    );
    assert.equal(quitAndInstallCalls, 0);
  } finally {
    globalThis.setTimeout = previousSetTimeout;
    runtime.packaged = true;
    failNextBackupCopy = false;
    if (previousPreview === undefined)
      delete process.env.DESKTOP_UPDATE_PREVIEW;
    else process.env.DESKTOP_UPDATE_PREVIEW = previousPreview;
  }
});

test("macOS updater selects its manifest and backs up the application bundle", async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(
    process,
    "platform",
  );
  const originalNetFetch = runtime.netFetch;
  let manifestUrl = "";
  Object.defineProperty(process, "platform", {
    ...platformDescriptor,
    value: "darwin",
  });
  runtime.netFetch = async (url) => {
    manifestUrl = url;
    return successfulManifestFetch(url);
  };
  try {
    update.configureAutoUpdater((status) => publishedStatuses.push(status));
    runtime.packaged = true;
    runtime.updateCheck = async () => ({
      isUpdateAvailable: true,
      updateInfo: { version: "0.1.4" },
    });
    await update.checkForUpdates();
    assert.match(manifestUrl, /latest-mac\.yml(?:\.sig)?$/);
    updateHandlers.get("update-downloaded")({ version: "0.1.4" });
    updateOperations.length = 0;
    const installedBefore = quitAndInstallCalls;
    update.installUpdate();
    for (
      let turn = 0;
      turn < 20 && quitAndInstallCalls === installedBefore;
      turn += 1
    )
      await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(
      updateOperations.some(
        ({ operation, args }) =>
          operation === "cp" &&
          args[1].includes("desktop-update-backup-") &&
          args[2]?.recursive === true,
      ),
    );
    assert.equal(quitAndInstallCalls, installedBefore + 1);
  } finally {
    runtime.netFetch = originalNetFetch;
    Object.defineProperty(process, "platform", platformDescriptor);
  }
});
