import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const originalLoad = Module._load;
const listeners = new Map();
const invocations = [];
const ipcRenderer = {
  sendSync: (channel) => {
    assert.equal(channel, "desktop:config-sync");
    return {
      apiBaseUrl: "http://localhost:9090",
      protocol: "kitezh",
      appVersion: "0.1.4",
      os: "darwin",
    };
  },
  invoke: (channel, ...args) => {
    invocations.push([channel, ...args]);
    return channel === "desktop:update-status-get"
      ? Promise.resolve({ state: "available", version: "1.2.3" })
      : Promise.resolve(channel);
  },
  on: (channel, listener) => listeners.set(channel, listener),
  removeListener: (channel, listener) => {
    if (listeners.get(channel) === listener) listeners.delete(channel);
  },
};
let exposedApi;

Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return {
      contextBridge: {
        exposeInMainWorld: (key, api) => {
          assert.equal(key, "desktopApi");
          exposedApi = api;
        },
      },
      ipcRenderer,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

await import("../dist/preload.js");
Module._load = originalLoad;

test("exposes the narrow desktop API and forwards IPC operations", async () => {
  assert.equal(exposedApi.isDesktop, true);
  assert.equal(exposedApi.apiBaseUrl, "http://localhost:9090");
  assert.equal(exposedApi.protocol, "kitezh");
  assert.equal(exposedApi.appVersion, "0.1.4");
  assert.equal(exposedApi.os, "darwin");

  await exposedApi.auth.startLogin("account");
  await exposedApi.auth.cancelLogin("account");
  await exposedApi.auth.hasSession("account");
  await exposedApi.auth.clearSession("account");
  await exposedApi.auth.clearAllSessions();
  await exposedApi.auth.getStorageStatus();
  await exposedApi.auth.logout("account");
  await exposedApi.auth.openConsole("admin");
  await exposedApi.auth.socialLink.start("github");
  await exposedApi.getConfig();
  await exposedApi.getAppVersion();
  await exposedApi.api.request({ path: "/api/admin/dashboard" });
  await exposedApi.preferences.get();
  await exposedApi.preferences.set({ notifications: false });
  await exposedApi.preferences.reset();
  await exposedApi.diagnostics.get();
  await exposedApi.theme.set("dark");
  await exposedApi.theme.get();
  await exposedApi.language.get();
  await exposedApi.language.getMode();
  await exposedApi.language.set("tr");
  await exposedApi.settings.close();
  await exposedApi.settings.ready();
  await exposedApi.companion.openConsole("account");
  await exposedApi.updates.check();
  await exposedApi.updates.download();
  await exposedApi.updates.install();
  await exposedApi.openExternal("https://example.test");

  assert.deepEqual(invocations, [
    ["desktop:auth-start-login", "account"],
    ["desktop:auth-cancel-login", "account"],
    ["desktop:auth-has-session", "account"],
    ["desktop:auth-clear-session", "account"],
    ["desktop:auth-clear-all-sessions"],
    ["desktop:auth-storage-status"],
    ["desktop:auth-logout", "account"],
    ["desktop:auth-open-console", "admin"],
    ["desktop:social-link-start", "github"],
    ["desktop:config"],
    ["desktop:app-version"],
    ["desktop:api-request", { path: "/api/admin/dashboard" }],
    ["desktop:preferences-get"],
    ["desktop:preferences-set", { notifications: false }],
    ["desktop:preferences-reset"],
    ["desktop:diagnostics-get"],
    ["desktop:theme-set", "dark"],
    ["desktop:theme-get"],
    ["desktop:language-get"],
    ["desktop:language-mode-get"],
    ["desktop:language-set", "tr"],
    ["desktop:settings-close"],
    ["desktop:settings-ready"],
    ["desktop:companion-open-console", "account"],
    ["desktop:update-check"],
    ["desktop:update-download"],
    ["desktop:update-install"],
    ["desktop:open-external", "https://example.test"],
  ]);
});

test("filters locale and theme events and cleans up bridge listeners", async () => {
  const themes = [];
  const removeThemeListener = exposedApi.theme.onChanged((theme) =>
    themes.push(theme),
  );
  const themeListener = listeners.get("desktop:theme-changed");
  themeListener({}, "invalid");
  themeListener({}, "dark");
  removeThemeListener();
  assert.deepEqual(themes, ["dark"]);
  assert.equal(listeners.has("desktop:theme-changed"), false);

  const languages = [];
  const removeLanguageListener = exposedApi.language.onChanged((language) =>
    languages.push(language),
  );
  const languageListener = listeners.get("desktop:language-changed");
  languageListener({}, "fr");
  languageListener({}, "tr");
  removeLanguageListener();
  assert.deepEqual(languages, ["tr"]);

  const callbacks = [];
  const removeAuthCallback = exposedApi.onAuthCallback((value) =>
    callbacks.push(value),
  );
  const authListener = listeners.get("desktop:auth-callback");
  const callback = { console: "account", url: "kitezh://oauth/callback" };
  authListener({}, callback);
  removeAuthCallback();
  assert.deepEqual(callbacks, [callback]);

  const logouts = [];
  const removeLogoutListener = exposedApi.onMenuLogout(() =>
    logouts.push("logout"),
  );
  const logoutListener = listeners.get("desktop:menu-logout");
  logoutListener();
  removeLogoutListener();
  assert.deepEqual(logouts, ["logout"]);

  const socialCallbacks = [];
  const removeSocialCallback = exposedApi.auth.socialLink.onCallback((value) =>
    socialCallbacks.push(value),
  );
  const socialLinkListener = listeners.get("desktop:social-link-callback");
  const socialCallback = { provider: "github", error: "access_denied" };
  socialLinkListener({}, socialCallback);
  removeSocialCallback();
  assert.deepEqual(socialCallbacks, [socialCallback]);
  assert.equal(listeners.has("desktop:social-link-callback"), false);
});

test("replays the latest update status and lets subscribers unsubscribe", async () => {
  const statuses = [];
  const removeStatusListener = exposedApi.updates.onStatus((status) =>
    statuses.push(status),
  );
  const statusListener = listeners.get("desktop:update-status");
  await Promise.resolve();
  statusListener({}, { state: "checking" });
  removeStatusListener();
  statusListener({}, { state: "downloaded" });

  assert.deepEqual(statuses, [
    { state: "available", version: "1.2.3" },
    { state: "checking" },
  ]);
  assert.equal(listeners.has("desktop:update-status"), false);
});
