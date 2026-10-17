import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const handlers = {};
const ipcHandlers = new Map();
const protocolHandlers = new Map();
const menuActions = {};
const appListeners = new Map();
let trayMenuItems = [];
const windows = [];
const runtimeDependencies = {};
const authDependencies = {};
const preferenceDependencies = {};
const appearanceDependencies = {};
const apiDependencies = {};
const settingsStoreDependencies = {};
const mainWindowDependencies = {};
const nativeApiDependencies = {};
let restoredTransactions = {};
const apiRequests = [];
const externalUrls = [];
const writtenDesktopPreferences = [];
let headersHandler;
let updateStatusHandler;
let notificationCount = 0;
let desktopLocale = "en-US";
let shortcutRegistration = { registered: true, accelerator: "Alt+Space" };
let themeUpdatedListener;
let socialCompleteResponse = { status: 201, body: null };
const menuLogoutItem = { visible: true };
const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const userDataDirectory = await mkdtemp(
  path.join(os.tmpdir(), "kitezh-main-bootstrap-"),
);

class FakeWindow {
  constructor(options = {}) {
    this.options = options;
    this.visible = options.show === true;
    this.title = options.title;
    this.minimized = false;
    this.destroyed = false;
    this.loadedUrls = [];
    this.listeners = new Map();
    this.messages = [];
    windows.push(this);
    this.webContents = {
      listeners: new Map(),
      send: (...message) => this.messages.push(message),
      executeJavaScript: async () => {},
      isDevToolsOpened: () => this.devToolsOpened === true,
      openDevTools: () => { this.devToolsOpened = true; },
      closeDevTools: () => { this.devToolsOpened = false; },
      on: (name, listener) => this.webContents.listeners.set(name, listener),
      once: (name, listener) => this.webContents.listeners.set(name, listener),
      setWindowOpenHandler() {},
    };
  }

  on(name, listener) {
    this.listeners.set(name, listener);
  }
  isDestroyed() {
    return this.destroyed;
  }
  isVisible() {
    return this.visible;
  }
  isFocused() {
    return true;
  }
  isMinimized() {
    return this.minimized;
  }
  getBounds() {
    return { x: 20, y: 30, width: 1280, height: 800 };
  }
  isMaximized() {
    return false;
  }
  loadURL(url) {
    this.loadedUrls.push(url);
    return Promise.resolve();
  }
  setBackgroundColor(color) { this.backgroundColor = color; }
  setTitle(title) {
    this.title = title;
  }
  center() {}
  show() { this.visible = true; }
  focus() { this.focused = true; }
  hide() { this.visible = false; }
  restore() { this.minimized = false; }
  setAlwaysOnTop() {}
  emit(name, ...args) {
    this.listeners.get(name)?.(...args);
  }
  close() {
    this.visible = false;
    this.listeners.get("closed")?.();
  }
  destroy() {}
}

class FakeTray {
  setToolTip() {}
  setContextMenu(menu) {
    trayMenuItems = menu.items;
  }
  on() {}
  destroy() {}
}

const app = {
  isPackaged: false,
  setName() {},
  on: (name, listener) => appListeners.set(name, listener),
  getLocale: () => desktopLocale,
  getPath: () => userDataDirectory,
  getAppPath: () => desktopDirectory,
  getVersion: () => "1.0.0",
  getLoginItemSettings: () => ({ openAtLogin: false }),
  setLoginItemSettings() {},
  setAsDefaultProtocolClient() {},
  quit() {},
};
const electron = {
  app,
  BrowserWindow: Object.assign(FakeWindow, {
    getAllWindows: () => [windowMock, ...windows],
    getFocusedWindow: () => windowMock,
  }),
  globalShortcut: { register: () => true, unregisterAll() {} },
  Menu: {
    buildFromTemplate: (items) => ({
      items,
      getMenuItemById: () => menuLogoutItem,
    }),
    setApplicationMenu() {},
  },
  nativeTheme: {
    themeSource: "system",
    shouldUseDarkColors: false,
    on: (name, listener) => {
      if (name === "updated") themeUpdatedListener = listener;
    },
  },
  nativeImage: { createFromPath: () => ({ isEmpty: () => false }) },
  Notification: Object.assign(class {}, { isSupported: () => true }),
  ipcMain: {
    handle: (name, handler) => ipcHandlers.set(name, handler),
    on: (name, handler) => ipcHandlers.set(name, handler),
  },
  net: { fetch: async (url) => new Response(url) },
  protocol: {
    registerSchemesAsPrivileged() {},
    handle: (name, handler) => protocolHandlers.set(name, handler),
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString(),
  },
  shell: { openExternal: async (url) => externalUrls.push(url) },
  screen: {
    getAllDisplays: () => [
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ],
  },
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: (handler) => {
          headersHandler = handler;
        },
      },
    },
  },
  Tray: FakeTray,
};

const windowMock = new FakeWindow();
const preferences = {
  launchAtLogin: false,
  showInMenuBar: true,
  showInDock: true,
  notifications: true,
  globalShortcut: "Alt+Space",
};
const imports = {
  "@kitezh/shared": {
    colors: { light: { background: "#fff" }, dark: { background: "#000" } },
    desktopIconMetadata: {},
    messages: {},
  },
  "./ui/native-styles": {
    nativeDialogActionsScript: () => "",
    nativeDialogCss: () => "",
    nativeDialogVariables: () => ({}),
  },
  "./config": {
    DESKTOP_PROTOCOL: "kitezh",
    RENDERER_HOST: "renderer",
    RENDERER_PROTOCOL: "app",
    findDesktopDeepLink: () => null,
    getApiBaseUrl: () => "https://kitezh.onrender.com",
    isAllowedExternalUrl: () => false,
  },
  "./security/auth-flow": {
    isPendingAuthorizationValid: (pending, state) => pending.state === state,
    exchangeAuthorizationCode: async () => ({
      version: 1,
      accessToken: "access-token",
      expiresAt: Date.now() + 60_000,
      idToken: null,
      refreshToken: null,
    }),
    sanitizedAuthCallback: (state, protocol) =>
      `${protocol}://oauth/callback?state=${state}`,
    parseLogoutCallback: (value) =>
      value === "kitezh://logout/callback" ? {} : null,
    parseSocialLinkCallback: (value) => {
      const url = new URL(value);
      return url.hostname === "social-link" && url.pathname === "/callback"
        ? {
            state: url.searchParams.get("state"),
            code: url.searchParams.get("code"),
            error: url.searchParams.get("error"),
          }
        : null;
    },
    parseAuthCallback: (value) => {
      const url = new URL(value);
      return url.pathname === "/callback"
        ? {
            state: url.searchParams.get("state"),
            code: url.searchParams.get("code"),
            error: url.searchParams.get("error"),
          }
        : null;
    },
  },
  "./security/diagnostics": {
    appendBoundedDiagnosticLine: (value) => value,
    redactDiagnosticText: (value) => value,
  },
  "./security/auth-transaction-vault": {
    readPendingAuthorizationStore: async () => restoredTransactions,
    writePendingAuthorizationStore: async () => {},
  },
  "./security/origin-policy": {
    isTrustedRendererFrame: (url) => url?.startsWith("app://renderer"),
    isTrustedRendererUrl: (url) => url?.startsWith("app://renderer"),
  },
  "./security/global-shortcut": {
    registerGlobalShortcutWithFallback: () => shortcutRegistration,
  },
  "./update": {
    configureAutoUpdater: (handler) => {
      updateStatusHandler = handler;
    },
    setAutomaticInstallOnAppQuit() {},
    installUpdate() {},
    checkForUpdates: async () => {},
    downloadUpdate: async () => {},
  },
  "./notifications": {
    showDesktopNotification() {
      notificationCount += 1;
    },
  },
  "./api/desktop-api": {
    createDesktopApiAdapter: (dependencies) => {
      Object.assign(apiDependencies, dependencies);
      return {
        request: async (request) => {
          apiRequests.push(request);
          if (request.path.endsWith("/desktop/start")) {
            const provider = request.path.split("/").at(-3);
            return {
              status: 200,
              body: {
                state: request.body.state,
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                authorizationUrl: `https://kitezh.onrender.com/account/social-links/${provider}/desktop/authorize?transaction=test-transaction`,
              },
            };
          }
          if (request.path.endsWith("/desktop/complete"))
            return socialCompleteResponse;
          return { status: 200, body: null };
        },
      };
    },
  },
  "./startup-lifecycle": {
    registerDesktopLifecycle: (_app, _process, callbacks) =>
      Object.assign(handlers, callbacks),
  },
  "./settings-window": { renderDesktopSettingsHtml: () => "" },
  "./login-window": { renderDesktopLoginHtml: () => "" },
  "./companion-window": { renderDesktopCompanionHtml: () => "" },
  "./application-menu": {
    createApplicationMenuTemplate: ({ actions }) => {
      Object.assign(menuActions, actions);
      return [];
    },
  },
  "./main-window": {
    createDesktopMainWindow: (dependencies) => {
      Object.assign(mainWindowDependencies, dependencies);
      return windowMock;
    },
  },
  "./desktop-settings-store": {
    createDesktopSettingsStore: (dependencies) => {
      Object.assign(settingsStoreDependencies, dependencies);
      return {
        defaultDesktopPreferences: () => preferences,
        readDesktopLanguageMode: async () => "system",
        readDesktopLanguage: async () => "en",
        writeDesktopLanguage: async () => {},
        writeDesktopLanguageMode: async () => {},
        readDesktopPreferences: async () => preferences,
        writeDesktopPreferences: async (value) => {
          writtenDesktopPreferences.push({ ...value });
        },
        applyLaunchAtLogin: async () => {},
      };
    },
  },
  "./update-dialogs": {
    getUpdateCheckingCopy: () => ({}),
    getUpdateResultCopy: () => ({}),
    getUpdateConfirmationCopy: () => ({}),
    getUpdateAvailableCopy: () => ({}),
    renderUpdateCheckingHtml: () => "",
    renderUpdateResultHtml: () => "",
    renderUpdateConfirmationHtml: () => "",
    renderUpdateAvailableHtml: () => "",
  },
  "./auth-ipc": {
    registerDesktopAuthIpc: (dependencies) =>
      Object.assign(authDependencies, dependencies),
  },
  "./runtime-info-ipc": {
    registerDesktopRuntimeInfoIpc: (dependencies) =>
      Object.assign(runtimeDependencies, dependencies),
  },
  "./appearance-ipc": {
    registerDesktopAppearanceIpc: (dependencies) =>
      Object.assign(appearanceDependencies, dependencies),
  },
  "./native-api-ipc": {
    registerNativeApiIpc: (dependencies) =>
      Object.assign(nativeApiDependencies, dependencies),
  },
  "./preferences-ipc": {
    registerDesktopPreferencesIpc: (dependencies) =>
      Object.assign(preferenceDependencies, dependencies),
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") return electron;
  if (request in imports) return imports[request];
  return originalLoad.call(this, request, parent, isMain);
};

try {
  await import("../dist/main.js");
} finally {
  Module._load = originalLoad;
}

test("desktop main startup registers trusted IPC, CSP, and renderer protocol", async (t) => {
  t.after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    await runtimeDependencies.readDiagnosticEvents();
    await rm(userDataDirectory, { recursive: true, force: true });
  });
  await writeFile(
    path.join(userDataDirectory, "desktop-window.json"),
    JSON.stringify({ x: 100, y: 120, width: 1280, height: 800, maximized: true }),
  );
  restoredTransactions = {
    admin: { state: "restored-transaction-state", createdAt: Date.now() },
  };
  await writeFile(
    path.join(userDataDirectory, "desktop-pending-authorizations.bin"),
    "test-only encrypted transaction marker",
  );
  shortcutRegistration = {
    registered: false,
    accelerator: "Control+Space",
  };
  await handlers.onReady();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (mainWindowDependencies.state) break;
  }

  assert.ok(ipcHandlers.has("desktop:update-status-get"));
  assert.ok(
    authDependencies.pendingAuthorizations.has("admin"),
    "a stored desktop authorization should be restored during startup",
  );
  assert.ok(protocolHandlers.has("app"));
  const serveRenderer = protocolHandlers.get("app");
  const nativePage = await serveRenderer({ url: "app://renderer/native" });
  assert.equal(nativePage.status, 200);
  assert.match(await nativePage.text(), /__KITEZH_NATIVE_BOOTSTRAP__/);
  const nativeScript = await serveRenderer({
    url: "app://renderer/native/renderer.mjs",
  });
  assert.match(nativeScript.headers.get("content-type"), /javascript/);
  assert.match(await nativeScript.text(), /globalThis\.desktopApi/);
  const brandAsset = await serveRenderer({
    url: "app://renderer/native/brand/logo-light.svg",
  });
  assert.match(brandAsset.headers.get("content-type"), /image\/svg\+xml/);
  const loginPage = await serveRenderer({ url: "app://renderer/desktop-login" });
  assert.equal(loginPage.status, 200);
  const settingsPage = await serveRenderer({
    url: "app://renderer/desktop-settings/",
  });
  assert.equal(settingsPage.status, 200);
  const companionPage = await serveRenderer({
    url: "app://renderer/desktop-companion/",
  });
  assert.equal(companionPage.status, 200);
  const unknownPage = await serveRenderer({
    url: "app://untrusted/unknown.html",
  });
  assert.equal(unknownPage.status, 404);
  const extensionlessPage = await serveRenderer({
    url: "app://renderer/missing-route",
  });
  assert.equal(extensionlessPage.status, 200);
  const rendererIndex = await serveRenderer({ url: "app://renderer/" });
  assert.equal(rendererIndex.status, 200);
  const trailingSlashPage = await serveRenderer({
    url: "app://renderer/missing-route/",
  });
  assert.equal(trailingSlashPage.status, 200);
  const directoryFallback = await serveRenderer({ url: "app://renderer/404/" });
  assert.equal(directoryFallback.status, 200);
  const traversalPage = await serveRenderer({
    url: "app://renderer/%2e%2e%2f..%2foutside.html",
  });
  assert.equal(traversalPage.status, 404);
  assert.ok(
    writtenDesktopPreferences.some(
      ({ globalShortcut }) => globalShortcut === "Control+Space",
    ),
    "an unavailable requested shortcut should persist its fallback",
  );
  shortcutRegistration = { registered: true, accelerator: "Alt+Space" };
  assert.equal(menuLogoutItem.visible, false);
  assert.equal(runtimeDependencies.getOs(), process.platform);
  assert.deepEqual(mainWindowDependencies.state, {
    x: 100,
    y: 120,
    width: 1280,
    height: 800,
    maximized: true,
  });
  await mainWindowDependencies.saveWindowState(windowMock);
  assert.deepEqual(
    JSON.parse(await readFile(path.join(userDataDirectory, "desktop-window.json"), "utf8")),
    { x: 20, y: 30, width: 1280, height: 800, maximized: false },
  );
  assert.equal(settingsStoreDependencies.userDataPath(), userDataDirectory);
  assert.equal(settingsStoreDependencies.appDataPath(), userDataDirectory);
  assert.equal(settingsStoreDependencies.appPath(), desktopDirectory);
  assert.deepEqual(settingsStoreDependencies.getLoginItemSettings(), {
    openAtLogin: false,
  });
  settingsStoreDependencies.setLoginItemSettings({ openAtLogin: true });
  assert.equal(runtimeDependencies.isSecureStorageAvailable(), true);
  assert.deepEqual(await runtimeDependencies.readDiagnosticEvents(), []);
  assert.equal(preferenceDependencies.isValidGlobalShortcut("Alt+Space"), true);
  assert.equal(preferenceDependencies.isValidGlobalShortcut("Space"), false);
  assert.equal(preferenceDependencies.registerGlobalShortcut("Alt+Space"), true);
  assert.equal(runtimeDependencies.getAppVersion(), "1.0.0");
  assert.equal(runtimeDependencies.getAppStatus().isPackaged, false);
  assert.equal(runtimeDependencies.getProcessStatus().platform, process.platform);
  await runtimeDependencies.openExternal("https://example.test");
  assert.equal(externalUrls.at(-1), "https://example.test");
  authDependencies.setLogoutMenuVisible(true);
  assert.equal(menuLogoutItem.visible, true);
  authDependencies.setLogoutMenuVisible(false);
  assert.equal(authDependencies.isEncryptionAvailable(), true);
  await appearanceDependencies.applyLanguage("tr");
  assert.equal(appearanceDependencies.getLanguage(), "tr");
  assert.equal(appearanceDependencies.getLanguageMode(), "tr");
  appearanceDependencies.applyTheme("dark");
  assert.equal(appearanceDependencies.getTheme(), "dark");
  desktopLocale = "tr-TR";
  await appearanceDependencies.applyLanguage("system");
  assert.equal(appearanceDependencies.getLanguage(), "tr");
  desktopLocale = "en-US";
  await appearanceDependencies.applyLanguage("system");
  assert.equal(appearanceDependencies.getLanguage(), "en");
  appearanceDependencies.applyTheme("system");
  assert.equal(appearanceDependencies.getTheme(), "system");
  await appearanceDependencies.applyLanguage("tr");
  const destroyedWindow = new FakeWindow();
  windows.push(destroyedWindow);
  destroyedWindow.destroyed = true;
  electron.nativeTheme.shouldUseDarkColors = true;
  themeUpdatedListener();
  assert.equal(windowMock.backgroundColor, "#000");
  destroyedWindow.destroyed = false;
  appearanceDependencies.persistTheme("light");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(
    JSON.parse(
      await readFile(path.join(userDataDirectory, "desktop-theme.json"), "utf8"),
    ),
    "light",
  );

  const initialWindowCount = windows.length;
  menuActions.about();
  for (let attempt = 0; attempt < 20 && windows.length === initialWindowCount; attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 5));
  const aboutWindow = windows.at(-1);
  assert.equal(aboutWindow.title, "Kitezh hakkında");
  menuActions.about();
  assert.equal(aboutWindow.focused, true);
  menuActions.settings();
  for (let attempt = 0; attempt < 20 && windows.length < initialWindowCount + 2; attempt += 1)
    await new Promise((resolve) => setTimeout(resolve, 5));
  const settingsWindow = windows.at(-1);
  await appearanceDependencies.applyLanguage("tr");
  assert.equal(aboutWindow.title, "Kitezh hakkında");
  assert.equal(settingsWindow.title, "Kitezh ayarları");
  await appearanceDependencies.applyLanguage("en");
  assert.equal(aboutWindow.title, "About Kitezh");
  assert.equal(settingsWindow.title, "Kitezh Settings");

  const authorization = authDependencies.createAuthorizationRequest("admin");
  assert.equal(
    authorization.authorizationUrl.searchParams.get("client_id"),
    "desktop-admin-console",
  );
  assert.match(authorization.pending.state, /^[A-Za-z0-9_-]{40,}$/);
  await authDependencies.persistPendingAuthorizations();
  assert.deepEqual(await authDependencies.readVault(), {});
  await authDependencies.writeVault({});
  await authDependencies.logoutDesktopSession("admin");
  const validTokens = {
    version: 1,
    accessToken: "stored-access-token",
    expiresAt: Date.now() + 60_000,
    idToken: null,
    refreshToken: null,
  };
  await apiDependencies.writeSession("admin", { accessToken: "invalid" });
  await assert.rejects(apiDependencies.readSession("admin"), /Invalid session/);
  await authDependencies.writeVault({});
  await apiDependencies.writeSession("admin", validTokens);
  assert.deepEqual(await apiDependencies.readSession("admin"), validTokens);
  await apiDependencies.clearSession("admin");
  assert.equal(await apiDependencies.readSession("admin"), null);
  const completeTokens = {
    ...validTokens,
    idToken: "stored-id-token",
    refreshToken: "stored-refresh-token",
  };
  await apiDependencies.writeSession("account", completeTokens);
  assert.deepEqual(await apiDependencies.readSession("account"), completeTokens);
  await apiDependencies.clearSession("account");
  await apiDependencies.writeSession("admin", { ...validTokens, idToken: 7 });
  await assert.rejects(apiDependencies.readSession("admin"), /Invalid session/);
  await authDependencies.writeVault({});
  await apiDependencies.writeSession("admin", validTokens);
  await apiDependencies.writeSession("admin", {
    ...validTokens,
    refreshToken: 7,
  });
  await assert.rejects(apiDependencies.readSession("admin"), /Invalid session/);
  await authDependencies.writeVault({});
  const originalEncryptionAvailability = electron.safeStorage.isEncryptionAvailable;
  electron.safeStorage.isEncryptionAvailable = () => false;
  assert.equal(runtimeDependencies.isSecureStorageAvailable(), false);
  await assert.rejects(apiDependencies.readSession("admin"), /Secure desktop storage/);
  electron.safeStorage.isEncryptionAvailable = originalEncryptionAvailability;
  await assert.rejects(
    authDependencies.startNativeSocialLink("GitHub"),
    /Invalid social provider/,
  );
  assert.equal((await authDependencies.startNativeSocialLink("github")).status, 202);
  const githubStart = apiRequests.at(-1);
  assert.equal(githubStart.path, "/api/account/social-links/github/desktop/start");
  assert.ok(externalUrls.at(-1).includes("/account/social-links/github/desktop/authorize"));
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://social-link/callback?state=${githubStart.body.state}&code=github-link-code`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:social-link-callback" && payload.provider === "github",
    )) break;
  }

  await handlers.onSecondInstance({}, ["kitezh://oauth/callback"]);
  let prevented = false;
  handlers.onOpenUrl({ preventDefault: () => { prevented = true; } }, "kitezh://logout/callback");
  assert.equal(prevented, true);
  const socialStart = await authDependencies.startNativeSocialLink("google");
  assert.equal(socialStart.status, 202);
  const googleState = apiRequests.at(-1).body.state;
  handlers.onOpenUrl({ preventDefault() {} }, "https://example.test/not-a-callback");
  handlers.onOpenUrl(
    { preventDefault() {} },
    "kitezh://social-link/callback?state=unknown-state&code=ignored-code",
  );
  assert.equal(
    windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:social-link-callback" && payload.provider === "google",
    ),
    false,
  );
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://social-link/callback?state=${googleState}&code=link-code`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel]) => channel === "desktop:social-link-callback")) break;
  }
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:social-link-callback" && payload.provider === "google" && !payload.error,
  ));
  assert.ok(apiRequests.some(({ path }) => path === "/api/account/social-links/desktop/complete"));
  socialCompleteResponse = { status: 403, kind: null, body: null };
  const rejectedSocialStart = await authDependencies.startNativeSocialLink("github");
  const rejectedSocialState = apiRequests.at(-1).body.state;
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://social-link/callback?state=${rejectedSocialState}&code=denied-code`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:social-link-callback" && payload.provider === "github",
    )) break;
  }
  assert.equal(rejectedSocialStart.status, 202);
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:social-link-callback" &&
    payload.provider === "github" &&
    payload.error === "link_failed",
  ));
  socialCompleteResponse = { status: 503, kind: "upstream_timeout", body: null };
  const delayedSocialStart = await authDependencies.startNativeSocialLink("linkedin");
  const delayedSocialState = apiRequests.at(-1).body.state;
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://social-link/callback?state=${delayedSocialState}&code=delayed-code`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:social-link-callback" && payload.provider === "linkedin",
    )) break;
  }
  assert.equal(delayedSocialStart.status, 202);
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:social-link-callback" &&
    payload.provider === "linkedin" &&
    payload.error === "upstream_timeout",
  ));
  socialCompleteResponse = { status: 201, body: null };
  const failedSocialStart = await authDependencies.startNativeSocialLink("microsoft");
  const failedSocialState = apiRequests.at(-1).body.state;
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://social-link/callback?state=${failedSocialState}&error=access_denied`,
  );
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:social-link-callback" && payload.provider === "microsoft" && payload.error === "access_denied",
  ));
  assert.equal(failedSocialStart.status, 202);
  const deniedAuthorization = authDependencies.createAuthorizationRequest("account");
  authDependencies.pendingAuthorizations.set("account", deniedAuthorization.pending);
  await authDependencies.persistPendingAuthorizations();
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://oauth/callback?state=${deniedAuthorization.pending.state}&error=access_denied`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:auth-callback" &&
        payload.console === "account" &&
        payload.error === "access_denied",
    )) break;
  }
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:auth-callback" &&
      payload.console === "account" &&
      payload.error === "access_denied",
  ));
  const missingCodeAuthorization = authDependencies.createAuthorizationRequest("account");
  authDependencies.pendingAuthorizations.set("account", missingCodeAuthorization.pending);
  await authDependencies.persistPendingAuthorizations();
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://oauth/callback?state=${missingCodeAuthorization.pending.state}`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:auth-callback" &&
      payload.console === "account" &&
      payload.error === "authorization_failed",
    )) break;
  }
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:auth-callback" &&
    payload.console === "account" &&
    payload.error === "authorization_failed",
  ));

  const originalExchange = imports["./security/auth-flow"].exchangeAuthorizationCode;
  imports["./security/auth-flow"].exchangeAuthorizationCode = async () => {
    throw new Error("test-only token exchange failure");
  };
  const failedAuthorization = authDependencies.createAuthorizationRequest("admin");
  authDependencies.pendingAuthorizations.set("admin", failedAuthorization.pending);
  await authDependencies.persistPendingAuthorizations();
  handlers.onOpenUrl(
    { preventDefault() {} },
    `kitezh://oauth/callback?state=${failedAuthorization.pending.state}&code=failed-code`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:auth-callback" &&
        payload.console === "admin" &&
        payload.error === "token_exchange_failed",
    )) break;
  }
  imports["./security/auth-flow"].exchangeAuthorizationCode = originalExchange;
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:auth-callback" &&
      payload.console === "admin" &&
      payload.error === "token_exchange_failed",
  ));

  authDependencies.pendingAuthorizations.set("admin", authorization.pending);
  await authDependencies.persistPendingAuthorizations();
  let authCallbackPrevented = false;
  handlers.onOpenUrl(
    { preventDefault: () => { authCallbackPrevented = true; } },
    `kitezh://oauth/callback?state=${authorization.pending.state}&code=callback-code`,
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windowMock.messages.some(([channel, payload]) =>
      channel === "desktop:auth-callback" &&
      payload.console === "admin" &&
      !payload.error,
    )) break;
  }
  assert.equal(authCallbackPrevented, true);
  assert.ok(windowMock.messages.some(([channel, payload]) =>
    channel === "desktop:auth-callback" && payload.console === "admin" && !payload.error,
  ));
  assert.equal((await apiDependencies.readSession("admin")).accessToken, "access-token");
  await mainWindowDependencies.openLogin();
  await mainWindowDependencies.sendDeepLink("kitezh://logout/callback");
  assert.equal(mainWindowDependencies.isAllowedExternalUrl("https://example.test"), false);
  mainWindowDependencies.openExternal("https://example.test");
  assert.equal((await nativeApiDependencies.request({ path: "/api/admin/dashboard" })).status, 200);
  handlers.onStartupFailure(new Error("startup"));
  handlers.onUncaughtException(new Error("uncaught"));
  handlers.onUnhandledRejection("rejected");
  handlers.onBeforeQuit();
  handlers.onWindowAllClosed();

  let trusted;
  headersHandler(
    { url: "app://renderer/native", responseHeaders: {} },
    (value) => {
      trusted = value;
    },
  );
  assert.match(
    trusted.responseHeaders["Content-Security-Policy"][0],
    /default-src 'self'/,
  );
  let external;
  headersHandler(
    { url: "https://example.test", responseHeaders: {} },
    (value) => {
      external = value;
    },
  );
  assert.deepEqual(external, {});

  const status = await ipcHandlers.get("desktop:update-status-get")({
    senderFrame: { url: "app://renderer/native" },
  });
  assert.equal(status, null);
  assert.throws(
    () =>
      ipcHandlers.get("desktop:update-status-get")({
        senderFrame: { url: "https://example.test" },
      }),
    /Untrusted IPC sender/,
  );
  await assert.rejects(
    ipcHandlers.get("desktop:auth-open-console")(
      { senderFrame: { url: "app://renderer/native" } },
      "root",
    ),
    /Invalid console/,
  );

  const event = { senderFrame: { url: "app://renderer/native" } };
  await ipcHandlers.get("desktop:auth-open-console")(event, "account");
  assert.ok(windowMock.loadedUrls.includes("app://renderer/native?console=account"));
  await ipcHandlers.get("desktop:companion-open-console")(event, "admin");
  assert.ok(windowMock.loadedUrls.includes("app://renderer/native?console=admin"));
  const windowsBeforeUpdateCheck = windows.length;
  await ipcHandlers.get("desktop:update-check")(event);
  const updateDownload = ipcHandlers.get("desktop:update-download")(event);
  let confirmationWindow;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    confirmationWindow = windows.slice(windowsBeforeUpdateCheck).find((window) =>
      window.loadedUrls.some((url) => url.startsWith("data:text/html;base64,")),
    );
    if (confirmationWindow) break;
  }
  assert.ok(confirmationWindow);
  confirmationWindow.webContents.listeners.get("will-navigate")(
    { preventDefault() {} },
    "kitezh://update-confirm/update",
  );
  await updateDownload;
  await ipcHandlers.get("desktop:update-install")(event);
  assert.equal(typeof menuActions.settings, "function");
  assert.equal(typeof menuActions.about, "function");
  menuActions.about();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(windows.some((window) => window.title === "About Kitezh"));
  menuActions.toggleDeveloperTools();
  assert.equal(windowMock.devToolsOpened, true);
  menuActions.toggleDeveloperTools();
  assert.equal(windowMock.devToolsOpened, false);
  menuActions.logout();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (windows.some((window) => window.loadedUrls.includes("app://renderer/desktop-login"))) break;
  }
  assert.ok(windows.some((window) => window.loadedUrls.includes("app://renderer/desktop-login")));
  menuActions.settings();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(windows.some((window) => window.loadedUrls.includes("app://renderer/desktop-settings")));
  await ipcHandlers.get("desktop:settings-ready")(event);
  await ipcHandlers.get("desktop:settings-close")(event);

  const traySettingsItem = trayMenuItems[1];
  const trayUpdatesItem = trayMenuItems[2];
  assert.ok(traySettingsItem, JSON.stringify(trayMenuItems));
  assert.ok(trayUpdatesItem, JSON.stringify(trayMenuItems));
  traySettingsItem.click();
  trayUpdatesItem.click();
  await new Promise((resolve) => setImmediate(resolve));
  await writeFile(
    path.join(userDataDirectory, "desktop-companion-window.json"),
    JSON.stringify({ x: 100, y: 120, width: 500, height: 400 }),
  );
  menuActions.quickAccess();
  let companion;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    companion = windows.find((window) =>
      window.loadedUrls.includes("app://renderer/desktop-companion"),
    );
    if (companion) break;
  }
  assert.ok(companion);
  assert.equal(companion.options.x, 100);
  await appearanceDependencies.applyLanguage("tr");
  assert.equal(companion.title, "Hızlı erişim");
  await appearanceDependencies.applyLanguage("en");
  assert.equal(companion.title, "Quick access");
  menuActions.quickAccess();
  assert.equal(companion.visible, false);
  menuActions.quickAccess();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(companion.visible, true);
  companion.emit("resize");
  companion.emit("move");
  companion.listeners.get("close")();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(userDataDirectory, "desktop-companion-window.json"),
        "utf8",
      ),
    ),
    { x: 20, y: 30, width: 1280, height: 800 },
  );
  companion.listeners.get("closed")();
  mainWindowDependencies.onClosed(windowMock);

  await updateStatusHandler({ state: "checking" });
  assert.equal(
    (await ipcHandlers.get("desktop:update-status-get")(event)).state,
    "checking",
  );
  menuActions.checkForUpdates();
  await updateStatusHandler({ state: "not-available" });
  menuActions.checkForUpdates();
  await updateStatusHandler({ state: "available", version: "1.1.0" });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (
      windows.some((window) => window.options.width === 760 && window.loadedUrls.length)
    ) break;
  }
  assert.ok(windows.some((window) => window.options.width === 760));
  const firstUpdateWindow = windows.findLast(
    (window) => window.options.width === 760,
  );
  firstUpdateWindow.webContents.listeners.get("will-navigate")(
    { preventDefault() {} },
    "kitezh://update-action/skip?automatic=false",
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    try {
      const savedPreferences = JSON.parse(
        await readFile(
          path.join(userDataDirectory, "desktop-update-preferences.json"),
          "utf8",
        ),
      );
      if (savedPreferences.skippedVersion === "1.1.0") break;
    } catch {
      // The update action writes its preferences asynchronously.
    }
  }
  assert.equal(
    JSON.parse(
      await readFile(
        path.join(userDataDirectory, "desktop-update-preferences.json"),
        "utf8",
      ),
    ).skippedVersion,
    "1.1.0",
  );
  await appearanceDependencies.applyLanguage("en");
  assert.equal(
    windows.find((window) => window.title === "About Kitezh")?.title,
    "About Kitezh",
  );
  windowMock.visible = false;
  await updateStatusHandler({ state: "downloaded", version: "1.1.0" });
  await updateStatusHandler({ state: "available", version: "1.1.1" });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updateWindow = windows.findLast(
      (window) => window.options.width === 760,
    );
    if (updateWindow?.loadedUrls.length) break;
  }
  const laterUpdateWindow = windows.findLast(
    (window) => window.options.width === 760,
  );
  laterUpdateWindow.webContents.listeners.get("will-navigate")(
    { preventDefault() {} },
    "kitezh://update-action/later?automatic=true",
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const savedPreferences = JSON.parse(
      await readFile(
        path.join(userDataDirectory, "desktop-update-preferences.json"),
        "utf8",
      ),
    );
    if (typeof savedPreferences.remindUntil === "number") break;
  }
  const updatePreferences = JSON.parse(
    await readFile(
      path.join(userDataDirectory, "desktop-update-preferences.json"),
      "utf8",
    ),
  );
  assert.equal(updatePreferences.automaticDownload, true);
  assert.equal(updatePreferences.skippedVersion, undefined);
  assert.ok(updatePreferences.remindUntil > Date.now());
  await updateStatusHandler({ state: "downloaded", version: "1.1.1" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(notificationCount > 0);
  await updateStatusHandler({ state: "error", message: "offline" });
  assert.equal(
    (await ipcHandlers.get("desktop:update-status-get")(event)).state,
    "error",
  );

  const response = await protocolHandlers.get("app")({
    url: "app://renderer/not-a-real-asset.xyz",
  });
  assert.equal(response.status, 404);

  for (const route of [
    "/native",
    "/native/renderer.mjs",
    "/native/brand/logo-light.svg",
    "/desktop-login",
    "/desktop-settings",
    "/desktop-companion",
  ]) {
    const routeResponse = await protocolHandlers.get("app")({
      url: `app://renderer${route}`,
    });
    assert.equal(routeResponse.status, 200, `${route} should be served`);
  }
  await runtimeDependencies.readDiagnosticEvents();
});
