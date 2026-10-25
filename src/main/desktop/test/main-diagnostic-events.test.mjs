import assert from "node:assert/strict";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import test from "node:test";

test("main process records startup and rejection diagnostics with safe error types", async (t) => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "kitezh-main-diagnostics-"));
  const originalLoad = Module._load;
  let callbacks;
  let quitCalls = 0;
  const electron = {
    app: {
      isPackaged: false,
      setName() {},
      getLocale: () => "en-US",
      getPath: () => userData,
      getAppPath: () => userData,
      getVersion: () => "1.0.0",
      getLoginItemSettings: () => ({ openAtLogin: false }),
      setLoginItemSettings() {},
      setAsDefaultProtocolClient() {},
      quit: () => { quitCalls += 1; },
    },
    safeStorage: { isEncryptionAvailable: () => true },
    nativeTheme: { shouldUseDarkColors: false, on() {} },
    protocol: { registerSchemesAsPrivileged() {} },
  };
  const desktopSettingsStore = {
    defaultDesktopPreferences: () => ({}),
    readDesktopPreferences: async () => ({}),
    readDesktopLanguage: async (fallback) => fallback,
    writeDesktopLanguage: async () => {},
    readDesktopLanguageMode: async () => "system",
    writeDesktopLanguageMode: async () => {},
    writeDesktopPreferences: async () => {},
    applyLaunchAtLogin: async () => {},
  };
  const mockedImports = {
    "@kitezh/shared": {
      colors: { light: { background: "#fff" }, dark: { background: "#000" } },
      desktopIconMetadata: {},
      messages: {},
    },
    "./desktop-settings-store": {
      createDesktopSettingsStore: () => desktopSettingsStore,
    },
    "./api/desktop-api": {
      createDesktopApiAdapter: () => ({ request: async () => ({ status: 200 }) }),
    },
    "./security/diagnostics": {
      appendBoundedDiagnosticLine: (content, line) => content + line,
      redactDiagnosticText: (value) => value,
    },
    "./startup-lifecycle": {
      registerDesktopLifecycle: (_app, _process, handlers) => {
        callbacks = handlers;
      },
    },
  };

  t.after(async () => {
    Module._load = originalLoad;
    await rm(userData, { recursive: true, force: true });
  });
  Module._load = function (request, parent, isMain) {
    if (request === "electron") return electron;
    if (Object.hasOwn(mockedImports, request)) return mockedImports[request];
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    await import("../dist/main.js");
  } finally {
    Module._load = originalLoad;
  }
  assert.ok(callbacks);
  callbacks.onStartupFailure(new Error("failure details are not logged"));
  callbacks.onStartupFailure("configuration failure");
  callbacks.onUncaughtException(new TypeError("exception details are not logged"));
  callbacks.onUnhandledRejection(new RangeError("rejection details are not logged"));
  callbacks.onUnhandledRejection("primitive rejection");
  assert.equal(quitCalls, 2);

  await new Promise((resolve) => setTimeout(resolve, 25));
  const diagnostics = await readFile(path.join(userData, "diagnostics.log"), "utf8");
  assert.match(diagnostics, /app-startup-failed \{"errorType":"Error"\}/);
  assert.match(diagnostics, /app-startup-failed \{"errorType":"string"\}/);
  assert.match(diagnostics, /uncaught-exception \{"errorType":"TypeError"\}/);
  assert.match(diagnostics, /unhandled-rejection \{"errorType":"RangeError"\}/);
  assert.match(diagnostics, /unhandled-rejection \{"errorType":"string"\}/);
  assert.doesNotMatch(
    diagnostics,
    /failure details|configuration failure|exception details|primitive rejection/,
  );
});
