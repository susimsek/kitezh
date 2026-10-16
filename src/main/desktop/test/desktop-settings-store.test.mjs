import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createDesktopSettingsStore } from "../dist/desktop-settings-store.js";

async function withStore(platform, callback, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "kitezh-settings-"));
  const loginSettings = [];
  const store = createDesktopSettingsStore({
    userDataPath: () => path.join(root, "user-data"),
    appDataPath: () => path.join(root, "app-data"),
    appPath: () => path.join(root, "app", "kitezh"),
    platform,
    appName: "Kitezh",
    execPath: "/opt/Kitezh/kitezh",
    defaultApp: false,
    getLoginItemSettings: () => ({ openAtLogin: options.openAtLogin ?? false }),
    setLoginItemSettings: (settings) => loginSettings.push(settings),
  });
  try {
    await callback({ root, store, loginSettings });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const defaults = {
  launchAtLogin: false,
  showInMenuBar: true,
  showInDock: true,
  notifications: true,
  globalShortcut: "Alt+Space",
};

test("desktop settings store reads defaults and safely merges persisted values", async () => {
  await withStore("darwin", async ({ root, store }) => {
    assert.deepEqual(store.defaultDesktopPreferences("Alt+Space"), defaults);
    assert.deepEqual(await store.readDesktopPreferences(defaults), defaults);

    const preferencesFile = path.join(
      root,
      "user-data",
      "desktop-preferences.json",
    );
    await mkdir(path.dirname(preferencesFile), { recursive: true });
    await writeFile(
      preferencesFile,
      JSON.stringify({
        launchAtLogin: true,
        showInMenuBar: false,
        showInDock: "invalid",
        notifications: false,
        globalShortcut: "",
      }),
    );
    assert.deepEqual(await store.readDesktopPreferences(defaults), {
      ...defaults,
      launchAtLogin: true,
      showInMenuBar: false,
      notifications: false,
    });

    await writeFile(preferencesFile, "not-json");
    assert.deepEqual(await store.readDesktopPreferences(defaults), defaults);
  });
});

test("desktop settings store persists preferences and language with private file mode", async () => {
  await withStore("win32", async ({ root, store, loginSettings }) => {
    const preferences = { ...defaults, launchAtLogin: true };
    await store.writeDesktopPreferences(preferences);
    await store.writeDesktopLanguage("tr");
    await store.writeDesktopLanguageMode("en");

    assert.deepEqual(await store.readDesktopPreferences(defaults), preferences);
    assert.equal(await store.readDesktopLanguage("en"), "tr");
    assert.equal(await store.readDesktopLanguageMode(), "en");
    assert.equal(
      (await stat(path.join(root, "user-data", "desktop-preferences.json")))
        .mode & 0o777,
      0o600,
    );
    assert.deepEqual(loginSettings, []);
  });
});

test("desktop settings store normalizes invalid language values and uses fallback only on read failure", async () => {
  await withStore("darwin", async ({ root, store }) => {
    const userData = path.join(root, "user-data");
    await mkdir(userData, { recursive: true });
    await writeFile(path.join(userData, "desktop-language.json"), "fr");
    await writeFile(path.join(userData, "desktop-language-mode.json"), "fr");
    assert.equal(await store.readDesktopLanguage("tr"), "en");
    assert.equal(await store.readDesktopLanguageMode(), "system");

    await rm(userData, { recursive: true, force: true });
    assert.equal(await store.readDesktopLanguage("tr"), "tr");
    assert.equal(await store.readDesktopLanguageMode(), "system");
  });
});

test("desktop settings store reflects Linux autostart files and manages their lifecycle", async () => {
  await withStore("linux", async ({ root, store }) => {
    const autostartFile = path.join(
      root,
      "app-data",
      "autostart",
      "kitezh.desktop",
    );
    assert.equal(store.launchAtLoginEnabled(), false);
    assert.equal(
      store.defaultDesktopPreferences("Alt+Space").launchAtLogin,
      false,
    );

    await store.applyLaunchAtLogin(true);
    assert.equal(store.launchAtLoginEnabled(), true);
    assert.match(await readFile(autostartFile, "utf8"), /Name=Kitezh/);
    assert.match(
      await readFile(autostartFile, "utf8"),
      /Exec="\/opt\/Kitezh\/kitezh"/,
    );
    assert.equal((await stat(autostartFile)).mode & 0o777, 0o600);

    await store.applyLaunchAtLogin(false);
    assert.equal(store.launchAtLoginEnabled(), false);
    await store.applyLaunchAtLogin(false);
  });
});

test("desktop settings store delegates startup login settings on non-Linux platforms", async () => {
  await withStore(
    "win32",
    async ({ store, loginSettings }) => {
      assert.equal(store.launchAtLoginEnabled(), true);
      await store.applyLaunchAtLogin(true);
      assert.deepEqual(loginSettings, [{ openAtLogin: true, args: [] }]);
    },
    { openAtLogin: true },
  );

  const calls = [];
  const root = await mkdtemp(path.join(os.tmpdir(), "kitezh-settings-app-"));
  const store = createDesktopSettingsStore({
    userDataPath: () => path.join(root, "userdata"),
    appDataPath: () => path.join(root, "appdata"),
    appPath: () => "/repo/src/main/desktop",
    platform: "darwin",
    appName: "Kitezh",
    execPath: "/usr/bin/electron",
    defaultApp: true,
    getLoginItemSettings: () => ({ openAtLogin: false }),
    setLoginItemSettings: (settings) => calls.push(settings),
  });
  try {
    await store.applyLaunchAtLogin(false);
    assert.deepEqual(calls, [
      { openAtLogin: false, args: ["/repo/src/main/desktop"] },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
