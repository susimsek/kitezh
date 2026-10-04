import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  safeStorage,
  shell,
  screen,
  session,
} from "electron";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DESKTOP_PROTOCOL,
  findDesktopDeepLink,
  getApiBaseUrl,
  isAllowedExternalUrl,
  RENDERER_HOST,
  RENDERER_PROTOCOL,
} from "./config";
import {
  exchangeAuthorizationCode,
  isPendingAuthorizationValid,
  parseAuthCallback,
  parseLogoutCallback,
  sanitizedAuthCallback,
  type DesktopTokens,
  type PendingAuthorization as PendingAuthorizationData,
} from "./security/auth-flow";
import {
  isTrustedRendererFrame,
  isTrustedRendererUrl,
} from "./security/origin-policy";
import {
  checkForUpdates,
  configureAutoUpdater,
  downloadUpdate,
  installUpdate,
  type DesktopUpdateStatus,
} from "./update";

protocol.registerSchemesAsPrivileged([
  {
    scheme: RENDERER_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let pendingDeepLink: string | null = null;
type ConsoleName = "admin" | "account";
const pendingAuthorizations = new Map<ConsoleName, PendingAuthorizationData>();
type StoredTokens = DesktopTokens;
const DESKTOP_APP_NAME = "Kitezh";
type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
};

function rendererRoot() {
  return path.resolve(__dirname, "../renderer");
}

function rendererFile(requestUrl: string) {
  const url = new URL(requestUrl);
  if (
    url.protocol !== `${RENDERER_PROTOCOL}:` ||
    url.hostname !== RENDERER_HOST
  )
    return null;
  const pathname = decodeURIComponent(url.pathname);
  const root = rendererRoot();
  const relative = pathname === "/"
    ? "/index.html"
    : pathname.endsWith("/")
      ? `${pathname}index.html`
      : pathname;
  const file = path.resolve(root, `.${relative}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  return path.extname(pathname) ? file : path.join(root, "index.html");
}

async function registerRendererProtocol() {
  protocol.handle(RENDERER_PROTOCOL, async (request) => {
    const file = rendererFile(request.url);
    if (!file || !existsSync(file))
      return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

async function sendDeepLink(value: string) {
  if (parseLogoutCallback(value)) {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    return;
  }
  const callback = parseAuthCallback(value);
  if (!callback) return;
  const pending = [...pendingAuthorizations.entries()].find(([, value]) =>
    isPendingAuthorizationValid(value, callback.state),
  );
  if (!pending) return;
  if (!mainWindow) {
    pendingDeepLink = value;
    return;
  }
  pendingAuthorizations.delete(pending[0]);
  if (callback.error || !callback.code) {
    mainWindow.webContents.send("desktop:auth-callback", {
      console: pending[0],
      url: value,
      error: callback.error ?? "authorization_failed",
    });
    return;
  }
  try {
    await storeAuthorizationCode(pending[1], callback.code, pending[0]);
  } catch {
    mainWindow.webContents.send("desktop:auth-callback", {
      console: pending[0],
      url: value,
      error: "token_exchange_failed",
    });
    return;
  }
  mainWindow.webContents.send("desktop:auth-callback", {
    console: pending[0],
    url: sanitizedAuthCallback(callback.state, DESKTOP_PROTOCOL),
  });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

async function storeAuthorizationCode(
  pending: PendingAuthorizationData,
  code: string,
  consoleName: ConsoleName,
) {
  const tokens = await exchangeAuthorizationCode(
    fetch,
    getApiBaseUrl(),
    pending,
    code,
  );
  const vault = await readVault();
  vault[consoleName] = tokens;
  await writeVault(vault);
}

function storagePath() {
  return path.join(app.getPath("userData"), "desktop-sessions.bin");
}

function windowStatePath() {
  return path.join(app.getPath("userData"), "desktop-window.json");
}

async function readWindowState(): Promise<WindowState | null> {
  const file = windowStatePath();
  if (!existsSync(file)) return null;
  try {
    const value = JSON.parse(
      await readFile(file, "utf8"),
    ) as Partial<WindowState>;
    if (
      typeof value.width !== "number" ||
      typeof value.height !== "number" ||
      !Number.isInteger(value.width) ||
      !Number.isInteger(value.height) ||
      value.width < 960 ||
      value.height < 640 ||
      typeof value.maximized !== "boolean"
    ) {
      return null;
    }
    const state: WindowState = {
      width: value.width,
      height: value.height,
      maximized: value.maximized,
    };
    if (typeof value.x === "number" && Number.isInteger(value.x))
      state.x = value.x;
    if (typeof value.y === "number" && Number.isInteger(value.y))
      state.y = value.y;
    if (
      state.x !== undefined &&
      state.y !== undefined &&
      !isWindowVisible(state)
    )
      return null;
    return state;
  } catch {
    return null;
  }
}

function isWindowVisible(state: WindowState) {
  return screen.getAllDisplays().some(({ bounds }) => {
    const right = state.x! + state.width;
    const bottom = state.y! + state.height;
    return (
      right > bounds.x &&
      state.x! < bounds.x + bounds.width &&
      bottom > bounds.y &&
      state.y! < bounds.y + bounds.height
    );
  });
}

async function saveWindowState(window: BrowserWindow) {
  if (window.isDestroyed() || window.isMinimized()) return;
  const bounds = window.getBounds();
  await mkdir(path.dirname(windowStatePath()), { recursive: true });
  await writeFile(
    windowStatePath(),
    JSON.stringify({ ...bounds, maximized: window.isMaximized() }),
    { encoding: "utf8", mode: 0o600 },
  );
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent) {
  if (!isTrustedRendererFrame(event.senderFrame?.url)) {
    throw new Error("Untrusted IPC sender");
  }
}

function assertConsole(value: unknown): asserts value is ConsoleName {
  if (value !== "admin" && value !== "account")
    throw new Error("Invalid console");
}

function assertTokens(value: unknown): asserts value is StoredTokens {
  if (!value || typeof value !== "object") throw new Error("Invalid session");
  const tokens = value as Partial<StoredTokens>;
  if (
    tokens.version !== 1 ||
    typeof tokens.accessToken !== "string" ||
    tokens.accessToken.length === 0 ||
    typeof tokens.expiresAt !== "number" ||
    !Number.isFinite(tokens.expiresAt) ||
    (tokens.idToken !== null && typeof tokens.idToken !== "string") ||
    (tokens.refreshToken !== null && typeof tokens.refreshToken !== "string")
  ) {
    throw new Error("Invalid session");
  }
}

function assertSecureStorage() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure desktop storage is unavailable");
  }
}

async function readVault(): Promise<
  Partial<Record<ConsoleName, StoredTokens>>
> {
  assertSecureStorage();
  const file = storagePath();
  if (!existsSync(file)) return {};
  const encoded = await readFile(file, "utf8");
  const plaintext = safeStorage.decryptString(Buffer.from(encoded, "base64"));
  const value = JSON.parse(plaintext) as unknown;
  if (!value || typeof value !== "object")
    throw new Error("Invalid secure session vault");
  const vault: Partial<Record<ConsoleName, StoredTokens>> = {};
  for (const consoleName of ["admin", "account"] as const) {
    const tokens = (value as Record<string, unknown>)[consoleName];
    if (tokens !== undefined) {
      assertTokens(tokens);
      vault[consoleName] = tokens;
    }
  }
  return vault;
}

async function writeVault(vault: Partial<Record<ConsoleName, StoredTokens>>) {
  assertSecureStorage();
  const file = storagePath();
  await mkdir(path.dirname(file), { recursive: true });
  const encrypted = safeStorage
    .encryptString(JSON.stringify(vault))
    .toString("base64");
  await writeFile(file, encrypted, { encoding: "utf8", mode: 0o600 });
}

async function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const state = await readWindowState();
  mainWindow = new BrowserWindow({
    x: state?.x,
    y: state?.y,
    width: state?.width ?? 1440,
    height: state?.height ?? 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#f8f9fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  let saveTimer: NodeJS.Timeout | undefined;
  const scheduleWindowStateSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveWindowState(mainWindow!), 250);
  };
  mainWindow.on("resize", scheduleWindowStateSave);
  mainWindow.on("move", scheduleWindowStateSave);
  mainWindow.on("maximize", scheduleWindowStateSave);
  mainWindow.on("unmaximize", scheduleWindowStateSave);
  mainWindow.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    void saveWindowState(mainWindow!);
  });
  void mainWindow.loadURL(`${RENDERER_PROTOCOL}://${RENDERER_HOST}/`);
  if (process.env.DESKTOP_DEVTOOLS === "true") {
    mainWindow.webContents.once("did-finish-load", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.openDevTools({ mode: "detach" });
    });
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  if (state?.maximized) mainWindow.maximize();
  if (pendingDeepLink) {
    const value = pendingDeepLink;
    pendingDeepLink = null;
    mainWindow.webContents.once(
      "did-finish-load",
      () => void sendDeepLink(value),
    );
  }
}

function registerIpc() {
  ipcMain.on("desktop:config-sync", (event) => {
    if (!isTrustedRendererFrame(event.senderFrame?.url)) {
      event.returnValue = null;
      return;
    }
    event.returnValue = {
      apiBaseUrl: getApiBaseUrl(),
      protocol: DESKTOP_PROTOCOL,
    };
  });
  ipcMain.handle("desktop:config", (event) => {
    assertTrustedSender(event);
    return { apiBaseUrl: getApiBaseUrl(), protocol: DESKTOP_PROTOCOL };
  });
  ipcMain.handle("desktop:open-external", async (event, value: unknown) => {
    assertTrustedSender(event);
    if (typeof value !== "string" || !isAllowedExternalUrl(value))
      throw new Error("External URL is not allowed");
    await shell.openExternal(value);
  });
  ipcMain.handle("desktop:app-version", (event) => {
    assertTrustedSender(event);
    return app.getVersion();
  });
  ipcMain.handle(
    "desktop:auth-start-login",
    async (event, request: unknown) => {
      assertTrustedSender(event);
      if (!request || typeof request !== "object")
        throw new Error("Invalid login request");
      const value = request as Partial<{
        console: ConsoleName;
        authorizationUrl: string;
        state: string;
        codeVerifier: string;
        clientId: string;
        redirectUri: string;
      }>;
      assertConsole(value.console);
      if (
        typeof value.authorizationUrl !== "string" ||
        !isAllowedExternalUrl(value.authorizationUrl)
      ) {
        throw new Error("Authorization URL is not allowed");
      }
      if (new URL(value.authorizationUrl).origin !== getApiBaseUrl()) {
        throw new Error(
          "Authorization URL must use the configured authorization server",
        );
      }
      if (
        typeof value.state !== "string" ||
        value.state.length < 16 ||
        value.state.length > 256
      ) {
        throw new Error("Invalid authorization state");
      }
      if (
        typeof value.codeVerifier !== "string" ||
        value.codeVerifier.length < 43 ||
        value.codeVerifier.length > 128 ||
        typeof value.clientId !== "string" ||
        !["desktop-admin-console", "desktop-account-console"].includes(
          value.clientId,
        ) ||
        value.redirectUri !== "kitezh://oauth/callback"
      ) {
        throw new Error("Invalid desktop authorization request");
      }
      pendingAuthorizations.set(value.console, {
        state: value.state,
        codeVerifier: value.codeVerifier,
        clientId: value.clientId,
        redirectUri: value.redirectUri,
        createdAt: Date.now(),
      });
      await shell.openExternal(value.authorizationUrl);
    },
  );
  ipcMain.handle(
    "desktop:auth-get-session",
    async (event, consoleName: unknown) => {
      assertTrustedSender(event);
      assertConsole(consoleName);
      const vault = await readVault();
      return vault[consoleName] ?? null;
    },
  );
  ipcMain.handle(
    "desktop:auth-set-session",
    async (event, consoleName: unknown, tokens: unknown) => {
      assertTrustedSender(event);
      assertConsole(consoleName);
      assertTokens(tokens);
      const vault = await readVault();
      vault[consoleName] = tokens;
      await writeVault(vault);
    },
  );
  ipcMain.handle(
    "desktop:auth-clear-session",
    async (event, consoleName: unknown) => {
      assertTrustedSender(event);
      assertConsole(consoleName);
      const vault = await readVault();
      delete vault[consoleName];
      await writeVault(vault);
    },
  );
  ipcMain.handle("desktop:auth-clear-all-sessions", async (event) => {
    assertTrustedSender(event);
    await writeVault({});
  });
  ipcMain.handle("desktop:auth-storage-status", (event) => {
    assertTrustedSender(event);
    return safeStorage.isEncryptionAvailable() ? "available" : "unavailable";
  });
  ipcMain.handle("desktop:update-check", (event) => {
    assertTrustedSender(event);
    return checkForUpdates();
  });
  ipcMain.handle("desktop:update-download", (event) => {
    assertTrustedSender(event);
    return downloadUpdate();
  });
  ipcMain.handle("desktop:update-install", (event) => {
    assertTrustedSender(event);
    installUpdate();
  });
}

function enforceContentSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (isTrustedRendererUrl(details.url)) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; connect-src 'self' https://kitezh.onrender.com http://localhost:9090; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:",
          ],
        },
      });
      return;
    }
    callback({});
  });
}

function registerDesktopProtocol() {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
    return;
  }
  app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    void sendDeepLink(
      commandLine.find((value) => value.startsWith(`${DESKTOP_PROTOCOL}://`)) ??
        "",
    );
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void sendDeepLink(url);
  });
  app.whenReady().then(async () => {
    app.setName(DESKTOP_APP_NAME);
    pendingDeepLink = findDesktopDeepLink();
    registerDesktopProtocol();
    registerIpc();
    enforceContentSecurityPolicy();
    await registerRendererProtocol();
    void createWindow();
    configureAutoUpdater((status: DesktopUpdateStatus) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("desktop:update-status", status);
      }
    });
    if (process.platform === "darwin")
      app.on(
        "activate",
        () => BrowserWindow.getAllWindows()[0] ?? createWindow(),
      );
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
