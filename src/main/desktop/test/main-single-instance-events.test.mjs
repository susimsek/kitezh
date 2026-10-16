import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const originalLoad = Module._load;
const appListeners = new Map();
const processListenersBeforeImport = new Set([
  ...process.listeners("uncaughtExceptionMonitor"),
  ...process.listeners("unhandledRejection"),
]);
let quitCalls = 0;
let preventedOpenUrl = false;
let startupPromise;

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        isPackaged: false,
        getLocale: () => "en-US",
        setName: () => {},
        requestSingleInstanceLock: () => true,
        quit: () => {
          quitCalls += 1;
        },
        on: (event, listener) => appListeners.set(event, listener),
        whenReady: () => {
          startupPromise = new Promise(() => {});
          return startupPromise;
        },
      },
      globalShortcut: { unregisterAll: () => {} },
      nativeTheme: { on: () => {}, shouldUseDarkColors: false },
      protocol: { registerSchemesAsPrivileged: () => {} },
    };
  }
  if (request === "electron-updater")
    return { autoUpdater: { on: () => {} } };
  return originalLoad.call(this, request, parent, isMain);
};

try {
  await import("../dist/main.js");
} finally {
  Module._load = originalLoad;
}

test("single-instance lifecycle handles deep links and quits cleanly", async () => {
  try {
    assert.ok(startupPromise);
    appListeners.get("second-instance")?.({}, ["kitezh://unknown-callback"]);
    const event = {
      preventDefault() {
        preventedOpenUrl = true;
      },
    };
    appListeners.get("open-url")?.(event, "kitezh://unknown-callback");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(preventedOpenUrl, true);

    appListeners.get("before-quit")?.();
    assert.equal(quitCalls, 0);
    appListeners.get("window-all-closed")?.();
    assert.equal(quitCalls, process.platform === "darwin" ? 0 : 1);
  } finally {
    for (const listener of process.listeners("uncaughtExceptionMonitor")) {
      if (!processListenersBeforeImport.has(listener))
        process.removeListener("uncaughtExceptionMonitor", listener);
    }
    for (const listener of process.listeners("unhandledRejection")) {
      if (!processListenersBeforeImport.has(listener))
        process.removeListener("unhandledRejection", listener);
    }
  }
});
