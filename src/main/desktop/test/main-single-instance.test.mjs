import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const originalLoad = Module._load;
const registeredSchemes = [];
let quitCalls = 0;
let readyCalls = 0;

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      app: {
        isPackaged: false,
        getLocale: () => "en-US",
        setName: () => {},
        requestSingleInstanceLock: () => false,
        quit: () => {
          quitCalls += 1;
        },
        whenReady: () => {
          readyCalls += 1;
          return Promise.resolve();
        },
      },
      nativeTheme: { on: () => {}, shouldUseDarkColors: false },
      protocol: {
        registerSchemesAsPrivileged: (schemes) =>
          registeredSchemes.push(...schemes),
      },
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

test("a second desktop process exits without starting the app again", () => {
  assert.equal(quitCalls, 1);
  assert.equal(readyCalls, 0);
  assert.deepEqual(registeredSchemes, [
    {
      scheme: "app",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
});
