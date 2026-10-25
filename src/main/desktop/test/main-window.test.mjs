import assert from "node:assert/strict";
import test from "node:test";

import {
  createDesktopMainWindow,
  buildMainWindowOptions,
} from "../dist/main-window.js";

class FakeWebContents {
  listeners = new Map();
  oneTimeListeners = new Map();
  openHandler;
  loadedUrl;

  setWindowOpenHandler(handler) {
    this.openHandler = handler;
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  once(event, listener) {
    const listeners = this.oneTimeListeners.get(event) ?? [];
    listeners.push(listener);
    this.oneTimeListeners.set(event, listeners);
  }

  loadURL(url) {
    this.loadedUrl = url;
    return Promise.resolve();
  }

  emit(event, ...args) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
    for (const listener of this.oneTimeListeners.get(event) ?? [])
      listener(...args);
    this.oneTimeListeners.delete(event);
  }
}

class FakeWindow {
  webContents = new FakeWebContents();
  listeners = new Map();
  options;
  maximized = false;
  loadedUrl;

  constructor(options) {
    this.options = options;
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit(event, ...args) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  maximize() {
    this.maximized = true;
  }

  loadURL(url) {
    this.loadedUrl = url;
    return Promise.resolve();
  }
}

function createFactory(overrides = {}) {
  const calls = {
    external: [],
    diagnostics: [],
    saves: [],
    shown: [],
    deepLinks: [],
    login: 0,
    closed: 0,
    timers: [],
    clearedTimers: [],
  };
  const window = new FakeWindow();
  const deps = {
    createWindow: (options) => {
      window.options = options;
      return window;
    },
    preloadPath: "/app/preload.js",
    state: { x: 15, y: 20, width: 1200, height: 800, maximized: true },
    hasStoredSession: true,
    backgroundE2e: false,
    backgroundColor: "#fff",
    rendererUrl: "app://renderer/native",
    isAllowedExternalUrl: (url) => url.startsWith("https://safe.example/"),
    openExternal: (url) => calls.external.push(url),
    isTrustedRendererUrl: (url) => url.startsWith("app://renderer/"),
    saveWindowState: (target) => calls.saves.push(target),
    appendDiagnosticEvent: (...event) => calls.diagnostics.push(event),
    showWindow: (target) => calls.shown.push(target),
    openLogin: () => calls.login++,
    pendingDeepLink: "kitezh://oauth/callback?state=abc",
    sendDeepLink: (value) => calls.deepLinks.push(value),
    onClosed: () => calls.closed++,
    setTimer: (callback, delay) => {
      const timer = { callback, delay };
      calls.timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => calls.clearedTimers.push(timer),
    ...overrides,
  };
  return { calls, deps, window };
}

test("main window config applies secure web preferences and session visibility", () => {
  const visible = buildMainWindowOptions({
    preloadPath: "/app/preload.js",
    state: { x: 12, y: 34, width: 1000, height: 700, maximized: false },
    hasStoredSession: true,
    backgroundE2e: false,
    backgroundColor: "#123456",
  });
  const hidden = buildMainWindowOptions({
    preloadPath: "/app/preload.js",
    state: null,
    hasStoredSession: false,
    backgroundE2e: true,
    backgroundColor: "#000000",
  });

  assert.deepEqual(
    [visible.x, visible.y, visible.width, visible.height],
    [12, 34, 1000, 700],
  );
  assert.equal(visible.show, true);
  assert.deepEqual(visible.webPreferences, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    backgroundThrottling: true,
    preload: "/app/preload.js",
  });
  assert.deepEqual(
    [hidden.width, hidden.height, hidden.show],
    [1440, 960, false],
  );
  assert.equal(hidden.webPreferences.backgroundThrottling, false);
});

test("main window blocks untrusted navigation and only opens approved external URLs", () => {
  const { deps, window, calls } = createFactory();
  createDesktopMainWindow(deps);

  assert.deepEqual(
    window.webContents.openHandler({ url: "https://safe.example/docs" }),
    { action: "deny" },
  );
  assert.deepEqual(
    window.webContents.openHandler({ url: "javascript:alert(1)" }),
    { action: "deny" },
  );
  assert.deepEqual(calls.external, ["https://safe.example/docs"]);

  let denied = 0;
  let allowed = 0;
  window.webContents.emit(
    "will-navigate",
    { preventDefault: () => denied++ },
    "https://evil.example/",
  );
  window.webContents.emit(
    "will-navigate",
    { preventDefault: () => allowed++ },
    "app://renderer/native",
  );
  assert.equal(denied, 1);
  assert.equal(allowed, 0);
});

test("main window persists debounced bounds and reports renderer lifecycle events", () => {
  const { deps, window, calls } = createFactory();
  createDesktopMainWindow(deps);

  window.emit("resize");
  window.emit("move");
  assert.equal(calls.timers.length, 2);
  assert.deepEqual(calls.clearedTimers, [calls.timers[0]]);
  assert.equal(calls.timers[1].delay, 250);
  calls.timers[1].callback();
  window.emit("close");
  window.emit("unresponsive");
  window.emit("responsive");
  window.webContents.emit(
    "render-process-gone",
    {},
    { reason: "crashed", exitCode: 9 },
  );
  window.emit("closed");

  assert.deepEqual(calls.saves, [window, window]);
  assert.deepEqual(calls.diagnostics, [
    ["window-unresponsive"],
    ["window-responsive"],
    ["renderer-process-gone", { reason: "crashed", exitCode: 9 }],
  ]);
  assert.equal(calls.closed, 1);
});

test("main window restores, loads the renderer, and waits for load before session and deep-link actions", () => {
  const { deps, window, calls } = createFactory();
  const created = createDesktopMainWindow(deps);

  assert.equal(created, window);
  assert.equal(window.maximized, true);
  assert.equal(window.loadedUrl, "app://renderer/native");
  assert.deepEqual(calls.shown, []);
  assert.deepEqual(calls.deepLinks, []);
  window.webContents.emit("did-finish-load");
  assert.deepEqual(calls.shown, [window]);
  assert.deepEqual(calls.deepLinks, ["kitezh://oauth/callback?state=abc"]);
});

test("main window opens login when there is no stored session", () => {
  const { deps, window, calls } = createFactory({
    state: null,
    hasStoredSession: false,
    pendingDeepLink: null,
  });
  createDesktopMainWindow(deps);

  assert.equal(calls.login, 1);
  assert.deepEqual(calls.shown, []);
  assert.deepEqual(calls.deepLinks, []);
  assert.equal(window.maximized, false);
});
