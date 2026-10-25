import assert from "node:assert/strict";
import { test } from "node:test";
import { registerDesktopPreferencesIpc } from "../dist/preferences-ipc.js";

const defaultPreferences = {
  launchAtLogin: false,
  showInMenuBar: true,
  showInDock: true,
  notifications: true,
  globalShortcut: "Alt+Space",
};

function createPreferencesHarness({
  platform = "linux",
  shortcutAvailable = true,
  current = defaultPreferences,
  update = {},
} = {}) {
  const handlers = new Map();
  const calls = [];
  let storedPreferences = { ...current };
  let storedUpdatePreferences = { ...update };
  const dependencies = {
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler);
      },
    },
    assertTrustedSender(event) {
      calls.push("assert-trusted");
      if (!event?.trusted) throw new Error("Untrusted renderer");
    },
    async readDesktopPreferences() {
      calls.push("read-preferences");
      return { ...storedPreferences };
    },
    async writeDesktopPreferences(preferences) {
      calls.push(["write-preferences", preferences]);
      storedPreferences = { ...preferences };
    },
    async readUpdatePreferences() {
      calls.push("read-update-preferences");
      return { ...storedUpdatePreferences };
    },
    async writeUpdatePreferences(preferences) {
      calls.push(["write-update-preferences", preferences]);
      storedUpdatePreferences = { ...preferences };
    },
    async applyLaunchAtLogin(enabled) {
      calls.push(["launch-at-login", enabled]);
    },
    setTrayVisibility(visible) {
      calls.push(["tray", visible]);
    },
    setDockVisibility(visible) {
      calls.push(["dock", visible]);
    },
    registerGlobalShortcut(shortcut) {
      calls.push(["register-shortcut", shortcut]);
      return shortcutAvailable || shortcut === current.globalShortcut;
    },
    isValidGlobalShortcut(shortcut) {
      return shortcut === "Alt+Space" || shortcut === "CommandOrControl+Shift+K";
    },
    setAutomaticInstallOnAppQuit(enabled) {
      calls.push(["automatic-install", enabled]);
    },
    platform,
    defaultGlobalShortcut: "Alt+Space",
  };

  registerDesktopPreferencesIpc(dependencies);
  return {
    calls,
    invoke(channel, event = { trusted: true }, value) {
      return handlers.get(channel)(event, value);
    },
  };
}

test("gets persisted app and update preferences through a trusted renderer", async () => {
  const harness = createPreferencesHarness({ update: { automaticDownload: true } });

  const result = await harness.invoke("desktop:preferences-get");

  assert.deepEqual(result, { ...defaultPreferences, automaticDownload: true });
  assert.deepEqual(harness.calls.slice(0, 3), [
    "assert-trusted",
    "read-preferences",
    "read-update-preferences",
  ]);
});

test("merges supported preference updates and applies shortcut and update side effects", async () => {
  const harness = createPreferencesHarness({
    update: { skippedVersion: "0.1.2" },
  });

  const result = await harness.invoke("desktop:preferences-set", undefined, {
    showInDock: false,
    globalShortcut: "CommandOrControl+Shift+K",
    automaticDownload: true,
  });

  assert.deepEqual(result, {
    ...defaultPreferences,
    showInDock: false,
    globalShortcut: "CommandOrControl+Shift+K",
    automaticDownload: true,
  });
  assert.ok(
    harness.calls.some(
      (call) =>
        Array.isArray(call) &&
        call[0] === "write-update-preferences" &&
        call[1].skippedVersion === "0.1.2" &&
        call[1].automaticDownload === true,
    ),
  );
  assert.ok(harness.calls.some((call) => call[0] === "automatic-install" && call[1]));
});

test("rejects invalid preferences and invalid shortcuts before applying settings", async () => {
  const harness = createPreferencesHarness();

  await assert.rejects(
    harness.invoke("desktop:preferences-set", undefined, null),
    /Invalid desktop preferences/,
  );
  await assert.rejects(
    harness.invoke("desktop:preferences-set", undefined, {
      globalShortcut: "not-a-shortcut",
    }),
    /Invalid global shortcut/,
  );

  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "tray"), false);
});

test("macOS always keeps either its menu bar or Dock entry visible", async () => {
  const harness = createPreferencesHarness({ platform: "darwin" });

  await assert.rejects(
    harness.invoke("desktop:preferences-set", undefined, {
      showInMenuBar: false,
      showInDock: false,
    }),
    /Keep the menu bar or Dock entry visible/,
  );

  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "tray"), false);
});

test("restores the previous shortcut and leaves preferences unchanged when replacement is unavailable", async () => {
  const harness = createPreferencesHarness({ shortcutAvailable: false });

  await assert.rejects(
    harness.invoke("desktop:preferences-set", undefined, {
      globalShortcut: "CommandOrControl+Shift+K",
    }),
    /Global shortcut is unavailable/,
  );

  assert.deepEqual(
    harness.calls.filter(
      (call) => Array.isArray(call) && call[0] === "register-shortcut",
    ),
    [
      ["register-shortcut", "CommandOrControl+Shift+K"],
      ["register-shortcut", "Alt+Space"],
    ],
  );
  assert.equal(
    harness.calls.some((call) => Array.isArray(call) && call[0] === "write-preferences"),
    false,
  );
});

test("resets app and update preferences to the default values", async () => {
  const harness = createPreferencesHarness({
    current: { ...defaultPreferences, launchAtLogin: true },
    update: { automaticDownload: true, skippedVersion: "0.1.2" },
  });

  const result = await harness.invoke("desktop:preferences-reset");

  assert.deepEqual(result, { ...defaultPreferences, automaticDownload: false });
  assert.ok(
    harness.calls.some(
      (call) => Array.isArray(call) && call[0] === "write-update-preferences" && call[1] && Object.keys(call[1]).length === 0,
    ),
  );
  assert.ok(harness.calls.some((call) => call[0] === "automatic-install" && call[1] === false));
});

test("does not persist reset defaults when the default shortcut cannot be registered", async () => {
  const harness = createPreferencesHarness({
    shortcutAvailable: false,
    current: { ...defaultPreferences, globalShortcut: "CommandOrControl+Shift+K" },
  });

  await assert.rejects(
    harness.invoke("desktop:preferences-reset"),
    /Global shortcut is unavailable/,
  );

  assert.equal(
    harness.calls.some((call) => Array.isArray(call) && call[0] === "write-preferences"),
    false,
  );
  assert.equal(
    harness.calls.some((call) => Array.isArray(call) && call[0] === "write-update-preferences"),
    false,
  );
});

test("does not execute an IPC handler for an untrusted sender", async () => {
  const harness = createPreferencesHarness();

  await assert.rejects(
    harness.invoke("desktop:preferences-reset", { trusted: false }),
    /Untrusted renderer/,
  );

  assert.deepEqual(harness.calls, ["assert-trusted"]);
});
