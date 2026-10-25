import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDesktopRuntimeInfoIpc } from "../dist/runtime-info-ipc.js";

function createRuntimeHarness({
  apiBaseUrl = "https://kitezh.onrender.com/",
  platform = "linux",
  packaged = true,
  environment = { APPIMAGE: "/tmp/kitezh.AppImage" },
  secureStorage = true,
  allowedExternalUrl = (value) => value.startsWith("https://docs.example/"),
} = {}) {
  const handlers = new Map();
  const listeners = new Map();
  const calls = [];
  const dependencies = {
    ipcMain: {
      on(channel, listener) {
        listeners.set(channel, listener);
      },
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    },
    isTrustedRendererFrame(url) {
      return url?.startsWith("kitezh://app/") === true;
    },
    assertTrustedSender(event) {
      calls.push("assert-trusted");
      if (!event?.trusted) throw new Error("Untrusted IPC sender");
    },
    getApiBaseUrl() {
      return apiBaseUrl;
    },
    protocol: "kitezh",
    getAppVersion: () => "0.1.4",
    getOs: () => platform,
    getAppStatus: () => ({ isPackaged: packaged }),
    getProcessStatus: () => ({
      versions: { electron: "44.5.1", chrome: "144.0", node: "24.0" },
      platform,
      architecture: "arm64",
      environment,
    }),
    isSecureStorageAvailable: () => secureStorage,
    async readDiagnosticEvents() {
      return [{ event: "startup" }];
    },
    isAllowedExternalUrl: allowedExternalUrl,
    async openExternal(url) {
      calls.push(["open-external", url]);
    },
  };
  registerDesktopRuntimeInfoIpc(dependencies);
  return {
    calls,
    handle(channel, event = { trusted: true }, value) {
      return handlers.get(channel)(event, value);
    },
    sendSyncConfig(url) {
      const event = { senderFrame: { url }, returnValue: undefined };
      listeners.get("desktop:config-sync")(event);
      return event.returnValue;
    },
  };
}

test("returns runtime config only to a trusted synchronous renderer", async () => {
  const harness = createRuntimeHarness();

  assert.equal(harness.sendSyncConfig("https://untrusted.example/"), null);
  assert.deepEqual(harness.sendSyncConfig("kitezh://app/native"), {
    apiBaseUrl: "https://kitezh.onrender.com/",
    protocol: "kitezh",
    appVersion: "0.1.4",
    os: "linux",
  });
  assert.deepEqual(
    await harness.handle("desktop:config"),
    harness.sendSyncConfig("kitezh://app/native"),
  );
});

test("opens only allowed external HTTPS URLs after sender validation", async () => {
  const harness = createRuntimeHarness();

  await harness.handle("desktop:open-external", undefined, "javascript:alert(1)").then(
    () => assert.fail("Unsafe URL should be rejected"),
    (error) => assert.match(error.message, /External URL is not allowed/),
  );
  await harness.handle("desktop:open-external", undefined, "https://docs.example/guide");

  assert.deepEqual(harness.calls.at(-1), ["open-external", "https://docs.example/guide"]);
});

test("requires a trusted renderer before opening external destinations", async () => {
  const harness = createRuntimeHarness();

  await assert.rejects(
    harness.handle("desktop:open-external", { trusted: false }, "https://docs.example/guide"),
    /Untrusted IPC sender/,
  );
  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "open-external"), false);
});

test("reports runtime diagnostics and enables Linux auto-updates only for supported AppImage installs", async () => {
  const harness = createRuntimeHarness();

  const diagnostics = await harness.handle("desktop:diagnostics-get");

  assert.deepEqual(diagnostics, {
    appVersion: "0.1.4",
    electronVersion: "44.5.1",
    chromeVersion: "144.0",
    nodeVersion: "24.0",
    platform: "linux",
    architecture: "arm64",
    apiHost: "kitezh.onrender.com",
    packaged: true,
    secureStorage: "available",
    autoUpdatesSupported: true,
    events: [{ event: "startup" }],
  });
});

test("handles unavailable API origin, storage, and disabled or unsupported auto-updates", async () => {
  const invalidOrigin = createRuntimeHarness({
    apiBaseUrl: "not a URL",
    secureStorage: false,
  });
  const developmentApp = createRuntimeHarness({ packaged: false });
  const disabledUpdates = createRuntimeHarness({
    environment: { DESKTOP_AUTO_UPDATE: "false", APPIMAGE: "/tmp/app" },
  });
  const linuxSystemPackage = createRuntimeHarness({ environment: {} });

  const invalidDiagnostics = await invalidOrigin.handle("desktop:diagnostics-get");
  assert.equal(invalidDiagnostics.apiHost, "unknown");
  assert.equal(invalidDiagnostics.secureStorage, "unavailable");
  assert.equal(invalidDiagnostics.autoUpdatesSupported, true);
  assert.equal((await developmentApp.handle("desktop:diagnostics-get")).autoUpdatesSupported, false);
  assert.equal((await disabledUpdates.handle("desktop:diagnostics-get")).autoUpdatesSupported, false);
  assert.equal((await linuxSystemPackage.handle("desktop:diagnostics-get")).autoUpdatesSupported, false);
});

test("returns the application version only through a trusted invoke request", async () => {
  const harness = createRuntimeHarness();

  assert.equal(await harness.handle("desktop:app-version"), "0.1.4");
  await assert.rejects(
    Promise.resolve().then(() =>
      harness.handle("desktop:app-version", { trusted: false }),
    ),
    /Untrusted IPC sender/,
  );
});
