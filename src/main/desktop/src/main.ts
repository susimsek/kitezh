import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeTheme,
  nativeImage,
  Notification,
  ipcMain,
  net,
  protocol,
  safeStorage,
  shell,
  screen,
  session,
  type MenuItemConstructorOptions,
  type MenuItem,
  Tray,
} from "electron";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  colors,
  desktopIconMetadata,
  messages,
  type DesktopSocialLinkCompleteRequest,
  type DesktopSocialLinkStartRequest,
  type DesktopSocialLinkStartResponse,
  type ThemeMode,
} from "@kitezh/shared";
import {
  nativeDialogActionsScript,
  nativeDialogCss,
  nativeDialogVariables,
} from "./ui/native-styles";

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
  parseSocialLinkCallback,
  sanitizedAuthCallback,
  type DesktopTokens,
  type DesktopConsoleName,
  type PendingAuthorization as PendingAuthorizationData,
} from "./security/auth-flow";
import {
  appendBoundedDiagnosticLine,
  redactDiagnosticText,
} from "./security/diagnostics";
import {
  readPendingAuthorizationStore,
  writePendingAuthorizationStore,
} from "./security/auth-transaction-vault";
import {
  isTrustedRendererFrame,
  isTrustedRendererUrl,
} from "./security/origin-policy";
import { registerGlobalShortcutWithFallback } from "./security/global-shortcut";
import {
  checkForUpdates,
  configureAutoUpdater,
  downloadUpdate,
  installUpdate,
  setAutomaticInstallOnAppQuit,
  type DesktopUpdateStatus,
} from "./update";
import { showDesktopNotification } from "./notifications";
import { createDesktopApiAdapter } from "./api/desktop-api";
import { registerDesktopLifecycle } from "./startup-lifecycle";
import { renderDesktopSettingsHtml } from "./settings-window";
import { renderDesktopLoginHtml } from "./login-window";
import { renderDesktopCompanionHtml } from "./companion-window";
import { createApplicationMenuTemplate } from "./application-menu";
import { createDesktopMainWindow } from "./main-window";
import { createDesktopSettingsStore } from "./desktop-settings-store";
import {
  getUpdateCheckingCopy,
  getUpdateResultCopy,
  getUpdateConfirmationCopy,
  getUpdateAvailableCopy,
  renderUpdateCheckingHtml,
  renderUpdateResultHtml,
  renderUpdateConfirmationHtml,
  renderUpdateAvailableHtml,
} from "./update-dialogs";
import { registerDesktopAuthIpc } from "./auth-ipc";
import { registerDesktopRuntimeInfoIpc } from "./runtime-info-ipc";
import { registerDesktopAppearanceIpc } from "./appearance-ipc";
import { registerNativeApiIpc } from "./native-api-ipc";
import {
  registerDesktopPreferencesIpc,
  type DesktopPreferences,
  type UpdatePreferences,
} from "./preferences-ipc";

import { createHash, randomBytes } from "node:crypto";

const DESKTOP_APP_NAME = "Kitezh";
const UPDATE_PREFERENCES_FILE = "desktop-update-preferences.json";
const DESKTOP_THEME_FILE = "desktop-theme.json";
const COMPANION_WINDOW_STATE_FILE = "desktop-companion-window.json";
const PENDING_AUTHORIZATIONS_FILE = "desktop-pending-authorizations.bin";
const DIAGNOSTICS_LOG_FILE = "diagnostics.log";
const MAX_DIAGNOSTICS_LOG_BYTES = 64 * 1024;
let diagnosticsWriteQueue: Promise<void> = Promise.resolve();
const REMIND_LATER_WINDOW_MS = 24 * 60 * 60 * 1000;
const backgroundE2e = process.env.DESKTOP_E2E_BACKGROUND === "true";
if (
  process.platform === "linux" &&
  !app.isPackaged &&
  backgroundE2e &&
  process.env.DESKTOP_E2E_TEST_STORAGE === "true"
) {
  // CI has no desktop keyring; the E2E profile is disposable and must not use this outside tests.
  safeStorage.setUsePlainTextEncryption(true);
}
app.setName(DESKTOP_APP_NAME);

function desktopOsIdentifier() {
  return process.platform;
}

function showWindow(window: BrowserWindow) {
  if (backgroundE2e) return;
  window.show();
}

function focusWindow(window: BrowserWindow) {
  if (!backgroundE2e) window.focus();
}

type DesktopTheme = ThemeMode;
type DesktopLanguage = "en" | "tr";
type DesktopLanguageMode = DesktopLanguage | "system";

let desktopLanguage: DesktopLanguage = app
  .getLocale()
  .toLowerCase()
  .startsWith("tr")
  ? "tr"
  : "en";
let desktopLanguageMode: DesktopLanguageMode = "system";

function isTurkishDesktop() {
  return desktopLanguage === "tr";
}

function desktopBackgroundColor() {
  return nativeTheme.shouldUseDarkColors
    ? colors.dark.background
    : colors.light.background;
}

function desktopThemePath() {
  return path.join(app.getPath("userData"), DESKTOP_THEME_FILE);
}

async function readDesktopTheme(): Promise<DesktopTheme> {
  try {
    const value = JSON.parse(await readFile(desktopThemePath(), "utf8"));
    return value === "light" || value === "dark" || value === "system"
      ? value
      : "system";
  } catch {
    return "system";
  }
}

async function writeDesktopTheme(theme: DesktopTheme) {
  await mkdir(path.dirname(desktopThemePath()), { recursive: true });
  await writeFile(desktopThemePath(), JSON.stringify(theme), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function applyDesktopTheme(value: unknown) {
  const theme: DesktopTheme =
    value === "light" || value === "dark" || value === "system"
      ? value
      : "system";
  nativeTheme.themeSource = theme;
  const backgroundColor = desktopBackgroundColor();
  for (const window of BrowserWindow.getAllWindows()) {
    window.setBackgroundColor(backgroundColor);
    if (!window.isDestroyed()) {
      updateOpenWindowTheme(window);
    }
  }
}

function updateOpenWindowTheme(window: BrowserWindow) {
  const dark = nativeTheme.shouldUseDarkColors;
  window.webContents.send("desktop:theme-changed", dark ? "dark" : "light");
  void window.webContents
    .executeJavaScript(
      `(() => {
        const values = ${JSON.stringify(nativeDialogVariables(dark))};
        const root = document.documentElement;
        root.style.colorScheme = ${JSON.stringify(dark ? "dark" : "light")};
        for (const [name, value] of Object.entries(values)) root.style.setProperty(name, value);
      })()`,
    )
    .catch(() => undefined);
}

nativeTheme.on("updated", () => {
  const backgroundColor = desktopBackgroundColor();
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.setBackgroundColor(backgroundColor);
    updateOpenWindowTheme(window);
  }
});

async function applyDesktopLanguage(value: unknown) {
  desktopLanguageMode = value === "tr" || value === "en" ? value : "system";
  desktopLanguage = (() => {
    if (desktopLanguageMode === "system") {
      if (app.getLocale().toLowerCase().startsWith("tr")) {
        return "tr";
      } else {
        return "en";
      }
    } else {
      return desktopLanguageMode;
    }
  })();
  await writeDesktopLanguage(desktopLanguage);
  await writeDesktopLanguageMode(desktopLanguageMode);
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.setTitle(
      isTurkishDesktop()
        ? `${DESKTOP_APP_NAME} hakkında`
        : `About ${DESKTOP_APP_NAME}`,
    );
    void aboutWindow.webContents
      .executeJavaScript(
        `(() => {
      document.documentElement.lang = ${JSON.stringify(desktopLanguage)};
      document.getElementById("about-description").textContent = ${JSON.stringify(isTurkishDesktop() ? "Güvenli kimlik ve erişim konsolu" : "Secure identity and access console")};
      document.getElementById("about-version").textContent = ${JSON.stringify(`${isTurkishDesktop() ? "Sürüm" : "Version"} ${app.getVersion()}`)};
    })()`,
      )
      .catch(() => undefined);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setTitle(
      isTurkishDesktop()
        ? `${DESKTOP_APP_NAME} ayarları`
        : `${DESKTOP_APP_NAME} Settings`,
    );
  }
  if (companionWindow && !companionWindow.isDestroyed()) {
    companionWindow.setTitle(
      isTurkishDesktop() ? "Hızlı erişim" : "Quick access",
    );
  }
  installApplicationMenu();
  updateTrayMenu();
  updateOpenUpdateDialogLanguage();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("desktop:language-changed", desktopLanguage);
    }
  }
}

function nativeDialogThemeCss() {
  return nativeDialogCss(nativeTheme.shouldUseDarkColors);
}

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
let desktopLoginWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;
let aboutWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let updateCheckWindow: BrowserWindow | null = null;
let updateCheckWindowReady: Promise<void> | null = null;
let updateResultWindow: BrowserWindow | null = null;
let updateAvailableWindow: BrowserWindow | null = null;
let updateConfirmationWindow: BrowserWindow | null = null;
let updateConfirmationResolver: ((confirmed: boolean) => void) | null = null;
let tray: Tray | null = null;
let pendingDeepLink: string | null = null;
let promptedUpdateVersion: string | null = null;
let manualUpdateCheckRequested = false;
let suppressNextUpdateNotification = false;
let latestUpdateStatus: DesktopUpdateStatus | null = null;
let logoutMenuItem: MenuItem | null = null;
type ConsoleName = DesktopConsoleName;
const pendingAuthorizations = new Map<ConsoleName, PendingAuthorizationData>();
type PendingSocialLink = PendingAuthorizationData & { provider: string };
const pendingSocialLinks = new Map<string, PendingSocialLink>();
let pendingAuthorizationWrite: Promise<void> = Promise.resolve();
let pendingAuthorizationsRestored = false;
type StoredTokens = DesktopTokens;
const DEFAULT_GLOBAL_SHORTCUT = "Alt+Space";
const desktopSettingsStore = createDesktopSettingsStore({
  userDataPath: () => app.getPath("userData"),
  appDataPath: () => app.getPath("appData"),
  appPath: () => app.getAppPath(),
  platform: process.platform,
  appName: DESKTOP_APP_NAME,
  execPath: process.execPath,
  defaultApp: process.defaultApp,
  getLoginItemSettings: () => app.getLoginItemSettings(),
  setLoginItemSettings: (settings) => app.setLoginItemSettings(settings),
});
const GLOBAL_SHORTCUT_MODIFIERS = new Set([
  "Command",
  "CommandOrControl",
  "Control",
  "Alt",
  "AltGr",
  "Shift",
  "Super",
  "Meta",
]);
const GLOBAL_SHORTCUT_SPECIAL_KEYS = new Set([
  "Space",
  "Tab",
  "Enter",
  "Escape",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Up",
  "Down",
  "Left",
  "Right",
  "Plus",
  "PrintScreen",
  "MediaPlayPause",
  "MediaNextTrack",
  "MediaPreviousTrack",
  "MediaStop",
]);
type WindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
};
type CompanionWindowState = Pick<WindowState, "x" | "y" | "width" | "height">;

function diagnosticsLogPath() {
  return path.join(app.getPath("userData"), DIAGNOSTICS_LOG_FILE);
}

async function updateLogoutMenuVisibility() {
  try {
    const vault = await readVault();
    setLogoutMenuVisible(Boolean(vault.admin || vault.account));
  } catch {
    setLogoutMenuVisible(false);
  }
}

async function appendDiagnosticEvent(
  name: string,
  details?: Record<string, unknown>,
) {
  const safeDetails = Object.fromEntries(
    Object.entries(details ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, redactDiagnosticText(String(value))]),
  );
  const detailText = Object.keys(safeDetails).length
    ? ` ${JSON.stringify(safeDetails)}`
    : "";
  const line = `${new Date().toISOString()} ${name}${detailText}\n`;
  const write = diagnosticsWriteQueue.then(async () => {
    const current = await readFile(diagnosticsLogPath(), "utf8").catch(
      () => "",
    );
    const next = appendBoundedDiagnosticLine(
      current,
      line,
      MAX_DIAGNOSTICS_LOG_BYTES,
    );
    await mkdir(path.dirname(diagnosticsLogPath()), { recursive: true });
    await writeFile(diagnosticsLogPath(), next, {
      encoding: "utf8",
      mode: 0o600,
    });
  });
  diagnosticsWriteQueue = write.catch(() => undefined);
  try {
    await write;
  } catch {
    // Diagnostics must never interfere with the desktop application.
  }
}

async function readDiagnosticEvents() {
  try {
    await diagnosticsWriteQueue;
    const content = await readFile(diagnosticsLogPath(), "utf8");
    return content.trim().split("\n").filter(Boolean).slice(-50);
  } catch {
    return [];
  }
}

function rendererRoot() {
  return path.resolve(__dirname, "../renderer");
}

function nativeRendererRoot() {
  return path.resolve(__dirname, "native");
}

async function nativeRendererHtml() {
  const source = await readFile(
    path.join(nativeRendererRoot(), "native.html"),
    "utf8",
  );
  const bootstrap = JSON.stringify({
    apiBaseUrl: getApiBaseUrl(),
    locale: desktopLanguage,
    theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
    messages,
    colors,
    icons: desktopIconMetadata,
  }).replaceAll(/</g, String.raw`\u003c`);
  return source.replace(
    '<script type="module" src="app://renderer/native/renderer.mjs"></script>',
    `<script>globalThis.__KITEZH_NATIVE_BOOTSTRAP__=${bootstrap};</script><script type="module" src="app://renderer/native/renderer.mjs"></script>`,
  );
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
  let relative = pathname;
  if (pathname === "/") relative = "/index.html";
  else if (pathname.endsWith("/")) relative = `${pathname}index.html`;
  const file = path.resolve(root, `.${relative}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  return path.extname(pathname) ? file : path.join(root, "index.html");
}

async function desktopLoginHtml() {
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  return renderDesktopLoginHtml({
    appName: DESKTOP_APP_NAME,
    iconDataUrl: `data:image/png;base64,${icon.toString("base64")}`,
    language: desktopLanguage,
    themeCss: nativeDialogThemeCss(),
  });
}

function desktopSettingsHtml() {
  return renderDesktopSettingsHtml({
    language: desktopLanguage,
    platform: process.platform,
    themeSource: nativeTheme.themeSource,
    themeCss: nativeDialogThemeCss(),
  });
}

function registerRendererProtocol() {
  protocol.handle(RENDERER_PROTOCOL, async (request) => {
    const requestPath = new URL(request.url).pathname;
    if (requestPath === "/native" || requestPath === "/native/") {
      return new Response(await nativeRendererHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (requestPath === "/native/renderer.mjs") {
      return new Response(
        await readFile(path.join(nativeRendererRoot(), "renderer.mjs"), "utf8"),
        { headers: { "content-type": "text/javascript; charset=utf-8" } },
      );
    }
    if (
      ["/native/brand/logo-light.svg", "/native/brand/logo-dark.svg"].includes(
        requestPath,
      )
    ) {
      return new Response(
        await readFile(
          path.join(nativeRendererRoot(), "brand", path.basename(requestPath)),
          "utf8",
        ),
        { headers: { "content-type": "image/svg+xml" } },
      );
    }
    if (requestPath === "/desktop-login" || requestPath === "/desktop-login/") {
      return new Response(await desktopLoginHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (
      requestPath === "/desktop-settings" ||
      requestPath === "/desktop-settings/"
    ) {
      return new Response(desktopSettingsHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (
      requestPath === "/desktop-companion" ||
      requestPath === "/desktop-companion/"
    ) {
      return new Response(await desktopCompanionHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
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
      focusWindow(mainWindow);
    }
    return;
  }
  const socialLinkCallback = parseSocialLinkCallback(value);
  if (socialLinkCallback) {
    const pending = pendingSocialLinks.get(socialLinkCallback.state);
    if (
      !pending ||
      !isPendingAuthorizationValid(pending, socialLinkCallback.state)
    ) {
      pendingSocialLinks.delete(socialLinkCallback.state);
      return;
    }
    if (!mainWindow) {
      pendingDeepLink = value;
      return;
    }
    const sendSocialLinkCallback = (payload: {
      provider: string;
      error?: string;
    }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("desktop:social-link-callback", payload);
      }
    };
    if (socialLinkCallback.error || !socialLinkCallback.code) {
      pendingSocialLinks.delete(socialLinkCallback.state);
      sendSocialLinkCallback({
        provider: pending.provider,
        error: socialLinkCallback.error ?? "authorization_failed",
      });
      return;
    }
    const response = await desktopApiAdapter.request({
      console: "account",
      method: "POST",
      path: "/api/account/social-links/desktop/complete",
      body: {
        code: socialLinkCallback.code,
        codeVerifier: pending.codeVerifier,
      } satisfies DesktopSocialLinkCompleteRequest,
    });
    if (response.status >= 200 && response.status < 300) {
      pendingSocialLinks.delete(socialLinkCallback.state);
      sendSocialLinkCallback({ provider: pending.provider });
    } else if (response.status !== 0 && response.status < 500) {
      pendingSocialLinks.delete(socialLinkCallback.state);
      sendSocialLinkCallback({
        provider: pending.provider,
        error: response.kind ?? "link_failed",
      });
    } else {
      sendSocialLinkCallback({
        provider: pending.provider,
        error: response.kind ?? "link_failed",
      });
    }
    return;
  }
  const callback = parseAuthCallback(value);
  if (!callback) return;
  if (!pendingAuthorizationsRestored) {
    pendingDeepLink = value;
    return;
  }
  const pending = [...pendingAuthorizations.entries()].find(([, value]) =>
    isPendingAuthorizationValid(value, callback.state),
  );
  if (!pending) return;
  if (!mainWindow) {
    pendingDeepLink = value;
    return;
  }
  pendingAuthorizations.delete(pending[0]);
  await persistPendingAuthorizations();
  const sendAuthCallback = (payload: {
    console: ConsoleName;
    url: string;
    error?: string;
  }) => {
    for (const window of [mainWindow, desktopLoginWindow]) {
      if (window && !window.isDestroyed()) {
        window.webContents.send("desktop:auth-callback", payload);
      }
    }
  };
  if (callback.error || !callback.code) {
    sendAuthCallback({
      console: pending[0],
      url: sanitizedAuthCallback(callback.state, DESKTOP_PROTOCOL),
      error: callback.error ?? "authorization_failed",
    });
    return;
  }
  try {
    await storeAuthorizationCode(pending[1], callback.code, pending[0]);
  } catch {
    sendAuthCallback({
      console: pending[0],
      url: sanitizedAuthCallback(callback.state, DESKTOP_PROTOCOL),
      error: "token_exchange_failed",
    });
    return;
  }
  sendAuthCallback({
    console: pending[0],
    url: sanitizedAuthCallback(callback.state, DESKTOP_PROTOCOL),
  });
  closeDesktopLoginWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  showWindow(mainWindow);
  focusWindow(mainWindow);
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
    {
      appVersion: app.getVersion(),
      clientPlatform: "desktop",
      os: desktopOsIdentifier(),
    },
  );
  const vault = await readVault();
  vault[consoleName] = tokens;
  await writeVault(vault);
}

function storagePath() {
  return path.join(app.getPath("userData"), "desktop-sessions.bin");
}

function pendingAuthorizationsPath() {
  return path.join(app.getPath("userData"), PENDING_AUTHORIZATIONS_FILE);
}

async function persistPendingAuthorizations() {
  const snapshot = Object.fromEntries(pendingAuthorizations);
  pendingAuthorizationWrite = pendingAuthorizationWrite
    .catch(() => undefined)
    .then(() =>
      writePendingAuthorizationStore(
        pendingAuthorizationsPath(),
        snapshot,
        safeStorage,
      ),
    );
  await pendingAuthorizationWrite;
}

async function restorePendingAuthorizations() {
  const file = pendingAuthorizationsPath();
  if (existsSync(file)) {
    if (!safeStorage.isEncryptionAvailable()) {
      await appendDiagnosticEvent("auth-transaction-storage-unavailable");
      pendingAuthorizationsRestored = true;
      return;
    }
    try {
      const restored = await readPendingAuthorizationStore(file, safeStorage);
      for (const [consoleName, pending] of Object.entries(restored)) {
        if (pending)
          pendingAuthorizations.set(consoleName as ConsoleName, pending);
      }
      await persistPendingAuthorizations();
    } catch {
      await rm(file, { force: true });
      await appendDiagnosticEvent("auth-transaction-restore-failed");
    }
  }
  pendingAuthorizationsRestored = true;
}

function windowStatePath() {
  return path.join(app.getPath("userData"), "desktop-window.json");
}

function companionWindowStatePath() {
  return path.join(app.getPath("userData"), COMPANION_WINDOW_STATE_FILE);
}

async function readCompanionWindowState(): Promise<CompanionWindowState | null> {
  try {
    const value = JSON.parse(
      await readFile(companionWindowStatePath(), "utf8"),
    ) as Partial<CompanionWindowState>;
    if (
      typeof value.width !== "number" ||
      typeof value.height !== "number" ||
      !Number.isInteger(value.width) ||
      !Number.isInteger(value.height) ||
      value.width < 360 ||
      value.height < 320
    ) {
      return null;
    }
    const state: CompanionWindowState = {
      width: value.width,
      height: value.height,
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

function isWindowVisible(
  state: Pick<WindowState, "x" | "y" | "width" | "height">,
) {
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

async function saveCompanionWindowState(window: BrowserWindow) {
  if (window.isDestroyed() || window.isMinimized()) return;
  const bounds = window.getBounds();
  await mkdir(path.dirname(companionWindowStatePath()), { recursive: true });
  await writeFile(companionWindowStatePath(), JSON.stringify(bounds), {
    encoding: "utf8",
    mode: 0o600,
  });
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

const desktopApiAdapter = createDesktopApiAdapter({
  apiBaseUrl: getApiBaseUrl(),
  readSession: async (consoleName) => (await readVault())[consoleName] ?? null,
  writeSession: async (consoleName, tokens) => {
    const vault = await readVault();
    vault[consoleName] = tokens;
    await writeVault(vault);
    setLogoutMenuVisible(true);
  },
  clearSession: async (consoleName) => {
    const vault = await readVault();
    delete vault[consoleName];
    await writeVault(vault);
    setLogoutMenuVisible(Boolean(vault.admin || vault.account));
  },
});

function base64Url(value: Buffer) {
  return value
    .toString("base64")
    .replaceAll(/\+/g, "-")
    .replaceAll(/\//g, "_")
    .replaceAll(/=+$/g, "");
}

function assertSocialProvider(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(value)) {
    throw new Error("Invalid social provider");
  }
}

function nativeSocialLinkRequest(provider: string) {
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  return {
    request: {
      state,
      codeChallenge,
    } satisfies DesktopSocialLinkStartRequest,
    pending: {
      state,
      codeVerifier,
      clientId: "desktop-account-console",
      redirectUri: "kitezh://social-link/callback",
      createdAt: Date.now(),
      provider,
    } satisfies PendingSocialLink,
  };
}

async function startNativeSocialLink(providerValue: unknown) {
  assertSocialProvider(providerValue);
  if (
    [...pendingSocialLinks.values()].some(
      (pending) => pending.provider === providerValue,
    )
  ) {
    return { status: 409, kind: "http", body: null };
  }
  const nativeRequest = nativeSocialLinkRequest(providerValue);
  const response = await desktopApiAdapter.request({
    console: "account",
    method: "POST",
    path: `/api/account/social-links/${encodeURIComponent(providerValue)}/desktop/start`,
    body: nativeRequest.request,
  });
  if (response.status < 200 || response.status >= 300) {
    return { status: response.status, kind: response.kind, body: null };
  }
  const body = response.body as Partial<DesktopSocialLinkStartResponse> | null;
  if (
    !body ||
    typeof body.authorizationUrl !== "string" ||
    body.state !== nativeRequest.pending.state ||
    typeof body.expiresAt !== "string"
  ) {
    return { status: 502, kind: "server", body: null };
  }
  const authorizationUrl = new URL(body.authorizationUrl);
  if (
    authorizationUrl.origin !== getApiBaseUrl() ||
    authorizationUrl.pathname !==
      `/account/social-links/${providerValue}/desktop/authorize` ||
    !authorizationUrl.searchParams.get("transaction")
  ) {
    return { status: 502, kind: "server", body: null };
  }
  pendingSocialLinks.set(nativeRequest.pending.state, nativeRequest.pending);
  try {
    await shell.openExternal(authorizationUrl.toString());
  } catch {
    pendingSocialLinks.delete(nativeRequest.pending.state);
    return { status: 0, kind: "offline", body: null };
  }
  return { status: 202, kind: null, body: null };
}

function nativeAuthorizationRequest(consoleName: ConsoleName) {
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(32));
  const challenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  const clientId =
    consoleName === "admin"
      ? "desktop-admin-console"
      : "desktop-account-console";
  const authorizationUrl = new URL("/oauth2/authorize", getApiBaseUrl());
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    nonce: base64Url(randomBytes(32)),
    redirect_uri: "kitezh://oauth/callback",
    response_mode: "fragment",
    response_type: "code",
    scope:
      consoleName === "admin"
        ? "openid profile email admin-api"
        : "openid profile email account-api",
    state,
    ui_locales: desktopLanguage,
  }).toString();
  return {
    authorizationUrl,
    pending: {
      state,
      codeVerifier,
      clientId,
      redirectUri: "kitezh://oauth/callback",
      createdAt: Date.now(),
    } satisfies PendingAuthorizationData,
  };
}

async function logoutDesktopSession(consoleName: ConsoleName) {
  const vault = await readVault();
  const tokens = vault[consoleName];
  delete vault[consoleName];
  await writeVault(vault);
  setLogoutMenuVisible(Boolean(vault.admin || vault.account));
  if (!tokens) return;
  const logoutUrl = new URL("/connect/logout", getApiBaseUrl());
  logoutUrl.search = new URLSearchParams({
    client_id:
      consoleName === "admin"
        ? "desktop-admin-console"
        : "desktop-account-console",
    ...(tokens.idToken ? { id_token_hint: tokens.idToken } : {}),
    post_logout_redirect_uri: "kitezh://logout/callback",
  }).toString();
  await shell.openExternal(logoutUrl.toString());
}

async function showAboutDialog() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    focusWindow(aboutWindow);
    return;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = isTurkishDesktop();
  aboutWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: false,
    width: 520,
    height: 520,
    minWidth: 320,
    minHeight: 240,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: isTurkish
      ? `${DESKTOP_APP_NAME} hakkında`
      : `About ${DESKTOP_APP_NAME}`,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
    },
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isTurkish ? `${DESKTOP_APP_NAME} hakkında` : `About ${DESKTOP_APP_NAME}`}</title>
    <style>
      ${nativeDialogThemeCss()}
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { width: 100%; box-sizing: border-box; padding: 2rem 2rem 1.75rem; text-align: center; }
      img { width: 112px; height: 112px; border-radius: 24px; margin-bottom: 1.5rem; }
      h1 { margin: 0 0 1.25rem; font-size: 2rem; font-weight: 700; }
      p { margin: 0.5rem 0; font-size: 1.1rem; line-height: 1.45; color: var(--dialog-secondary); }
      .version { margin-top: 1rem; font-size: 1rem; }
      footer { margin-top: 1.5rem; font-size: 0.95rem; color: var(--dialog-secondary); }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
      <h1>${DESKTOP_APP_NAME}</h1>
      <p id="about-description">${isTurkish ? "Güvenli kimlik ve erişim konsolu" : "Secure identity and access console"}</p>
      <p id="about-version" class="version">${isTurkish ? "Sürüm" : "Version"} ${app.getVersion()}</p>
      <footer>© 2026 ${DESKTOP_APP_NAME}</footer>
    </main>
    ${nativeDialogActionsScript()}
  </body>
</html>`;
  await aboutWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  aboutWindow.center();
  showWindow(aboutWindow);
}

async function showSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    focusWindow(settingsWindow);
    return;
  }
  let settingsParent: BrowserWindow | undefined;
  if (desktopLoginWindow?.isVisible() === true) {
    settingsParent = desktopLoginWindow;
  } else if (mainWindow?.isVisible() === true) {
    settingsParent = mainWindow;
  }
  settingsWindow = new BrowserWindow({
    parent: settingsParent,
    modal: false,
    width: 1100,
    height: 720,
    minWidth: 480,
    minHeight: 360,
    title: isTurkishDesktop()
      ? `${DESKTOP_APP_NAME} ayarları`
      : `${DESKTOP_APP_NAME} Settings`,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  settingsWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  const createdSettingsWindow = settingsWindow;
  createdSettingsWindow.on("closed", () => {
    if (settingsWindow === createdSettingsWindow) settingsWindow = null;
    setTimeout(() => {
      focusVisibleConsoleWindow();
    }, 0);
  });
  await createdSettingsWindow.loadURL(
    `${RENDERER_PROTOCOL}://${RENDERER_HOST}/desktop-settings`,
  );
}

function updatePreferencesPath() {
  return path.join(app.getPath("userData"), UPDATE_PREFERENCES_FILE);
}

function defaultDesktopPreferences(): DesktopPreferences {
  return desktopSettingsStore.defaultDesktopPreferences(
    DEFAULT_GLOBAL_SHORTCUT,
  );
}

async function readDesktopPreferences(): Promise<DesktopPreferences> {
  return desktopSettingsStore.readDesktopPreferences(
    defaultDesktopPreferences(),
  );
}

const readDesktopLanguage = () =>
  desktopSettingsStore.readDesktopLanguage(desktopLanguage);
const writeDesktopLanguage = desktopSettingsStore.writeDesktopLanguage;
const readDesktopLanguageMode = desktopSettingsStore.readDesktopLanguageMode;
const writeDesktopLanguageMode = desktopSettingsStore.writeDesktopLanguageMode;
const writeDesktopPreferences = desktopSettingsStore.writeDesktopPreferences;
const applyLaunchAtLogin = desktopSettingsStore.applyLaunchAtLogin;

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  showWindow(mainWindow);
  focusWindow(mainWindow);
}

function focusVisibleConsoleWindow() {
  const window =
    desktopLoginWindow?.isVisible() === true ? desktopLoginWindow : mainWindow;
  if (!window || window.isDestroyed() || !window.isVisible()) return;
  if (window.isMinimized()) window.restore();
  showWindow(window);
  focusWindow(window);
}

async function desktopCompanionHtml() {
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  return renderDesktopCompanionHtml({
    appName: DESKTOP_APP_NAME,
    iconDataUrl: `data:image/png;base64,${icon.toString("base64")}`,
    language: desktopLanguage,
    themeCss: nativeDialogThemeCss(),
  });
}

async function showDesktopLoginWindow() {
  if (desktopLoginWindow && !desktopLoginWindow.isDestroyed()) {
    showWindow(desktopLoginWindow);
    focusWindow(desktopLoginWindow);
    return;
  }
  desktopLoginWindow = new BrowserWindow({
    parent: mainWindow?.isVisible() ? mainWindow : undefined,
    modal: Boolean(mainWindow?.isVisible()),
    width: 580,
    height: 650,
    minWidth: 320,
    minHeight: 360,
    resizable: true,
    closable: true,
    show: false,
    title: DESKTOP_APP_NAME,
    backgroundColor: desktopBackgroundColor(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  const loginWindow = desktopLoginWindow;
  loginWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  loginWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  loginWindow.on("closed", () => {
    if (desktopLoginWindow !== loginWindow) return;
    desktopLoginWindow = null;
    void readVault()
      .then((vault) => {
        if (!vault.admin && !vault.account) app.quit();
      })
      .catch(() => app.quit());
  });
  await loginWindow.loadURL(
    `${RENDERER_PROTOCOL}://${RENDERER_HOST}/desktop-login`,
  );
  if (loginWindow.isDestroyed() || desktopLoginWindow !== loginWindow) return;
  loginWindow.center();
  showWindow(loginWindow);
  focusWindow(loginWindow);
}

function closeDesktopLoginWindow() {
  const loginWindow = desktopLoginWindow;
  // Clear ownership first: a programmatic transition is not a user dismissal.
  desktopLoginWindow = null;
  if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
}

async function showCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) {
    if (companionWindow.isMinimized()) companionWindow.restore();
    showWindow(companionWindow);
    focusWindow(companionWindow);
    return;
  }
  const state = await readCompanionWindowState();
  companionWindow = new BrowserWindow({
    x: state?.x,
    y: state?.y,
    width: state?.width ?? 440,
    height: state?.height ?? 560,
    minWidth: 360,
    minHeight: 320,
    show: false,
    skipTaskbar: true,
    title: isTurkishDesktop() ? "Hızlı erişim" : "Quick access",
    backgroundColor: desktopBackgroundColor(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  companionWindow.setAlwaysOnTop(true, "floating");
  let saveTimer: NodeJS.Timeout | undefined;
  const scheduleStateSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(
      () => void saveCompanionWindowState(companionWindow!),
      250,
    );
  };
  companionWindow.on("resize", scheduleStateSave);
  companionWindow.on("move", scheduleStateSave);
  companionWindow.on("close", () => {
    if (saveTimer) clearTimeout(saveTimer);
    void saveCompanionWindowState(companionWindow!);
  });
  companionWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  companionWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  companionWindow.on("closed", () => {
    if (saveTimer) clearTimeout(saveTimer);
    companionWindow = null;
  });
  await companionWindow.loadURL(
    `${RENDERER_PROTOCOL}://${RENDERER_HOST}/desktop-companion`,
  );
  if (state?.x === undefined || state.y === undefined) companionWindow.center();
  showWindow(companionWindow);
  focusWindow(companionWindow);
}

function closeCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) {
    companionWindow.hide();
  }
}

function toggleQuickAccess() {
  void (async () => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      if (companionWindow.isVisible()) {
        closeCompanionWindow();
      } else {
        await showCompanionWindow();
      }
      return;
    }
    await showCompanionWindow();
  })().catch(() => undefined);
}

function isValidGlobalShortcut(accelerator: string) {
  const parts = accelerator.split("+");
  if (parts.length < 2 || parts.length > 5 || parts.some((part) => !part)) {
    return false;
  }
  const modifiers = parts.slice(0, -1);
  const key = parts.at(-1)!;
  if (
    modifiers.some(
      (modifier, index) =>
        !GLOBAL_SHORTCUT_MODIFIERS.has(modifier) ||
        modifiers.indexOf(modifier) !== index,
    )
  ) {
    return false;
  }
  return (
    GLOBAL_SHORTCUT_SPECIAL_KEYS.has(key) ||
    /^[A-Z0-9]$/.test(key) ||
    /^F(?:[1-9]|1\d|2[0-4])$/.test(key)
  );
}

function registerGlobalShortcut(accelerator: string) {
  return registerGlobalShortcutWithFallback(
    globalShortcut,
    accelerator,
    DEFAULT_GLOBAL_SHORTCUT,
    toggleQuickAccess,
  ).registered;
}

function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(
    path.join(app.getAppPath(), "assets/icon.png"),
  );
  tray = new Tray(icon);
  tray.setToolTip(DESKTOP_APP_NAME);
  updateTrayMenu();
  tray.on("click", focusMainWindow);
}

function setTrayVisibility(visible: boolean) {
  if (visible) {
    createTray();
    return;
  }
  tray?.destroy();
  tray = null;
}

function setDockVisibility(visible: boolean) {
  if (process.platform !== "darwin") return;
  if (visible) {
    void app.dock
      ?.show()
      .catch(() => appendDiagnosticEvent("dock-visibility-failed"));
  } else {
    app.dock?.hide();
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const isTurkish = isTurkishDesktop();
  tray.setToolTip(
    isTurkish
      ? `${DESKTOP_APP_NAME} — güvenli kimlik konsolu`
      : `${DESKTOP_APP_NAME} — secure identity console`,
  );
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: isTurkish
          ? `${DESKTOP_APP_NAME} uygulamasını aç`
          : `Open ${DESKTOP_APP_NAME}`,
        click: focusMainWindow,
      },
      {
        label: isTurkish ? "Ayarlar…" : "Settings…",
        click: () => void showSettingsWindow(),
      },
      {
        label: isTurkish ? "Güncellemeleri denetle…" : "Check for Updates…",
        click: () => void requestUpdateCheck(),
      },
      { type: "separator" },
      {
        role: "quit",
        label: isTurkish
          ? `${DESKTOP_APP_NAME}'ten çık`
          : `Quit ${DESKTOP_APP_NAME}`,
      },
    ]),
  );
}

function updateOpenUpdateDialogLanguage() {
  const isTurkish = isTurkishDesktop();
  const updateTitle = isTurkish ? "Yazılım Güncellemesi" : "Software Update";
  const checkingLabel = isTurkish
    ? "Güncellemeler denetleniyor…"
    : "Checking for updates…";
  updateNativeDialogLanguage(updateCheckWindow, updateTitle, {
    "update-check-title": checkingLabel,
    "update-check-cancel": isTurkish ? "İptal" : "Cancel",
  });
  updateNativeDialogLanguage(updateResultWindow, updateTitle, {
    "update-result-title": isTurkish
      ? `${DESKTOP_APP_NAME} güncel`
      : `${DESKTOP_APP_NAME} is up to date`,
    "update-result-detail": isTurkish
      ? `${DESKTOP_APP_NAME} için kullanılabilir yeni bir sürüm yok. ${app.getVersion()} sürümünü kullanıyorsunuz.`
      : `There are no new updates available for ${DESKTOP_APP_NAME}. You are using version ${app.getVersion()}.`,
    "update-result-done": isTurkish ? "Tamam" : "Done",
  });
  const confirmationTitle = isTurkish
    ? `${DESKTOP_APP_NAME} şimdi güncellensin mi?`
    : `Update ${DESKTOP_APP_NAME} now?`;
  updateNativeDialogLanguage(updateConfirmationWindow, confirmationTitle, {
    "update-confirm-title": confirmationTitle,
    "update-confirm-detail": isTurkish
      ? `${DESKTOP_APP_NAME}, güncellemeyi kurmak için kapanacak. Bu işlem bu makinedeki etkin yerel oturumları keser.`
      : `${DESKTOP_APP_NAME} will quit to install the update, which will interrupt active local sessions on this machine.`,
    "update-confirm-cancel": isTurkish ? "İptal" : "Cancel",
    "update-confirm-install": isTurkish ? "Güncelle" : "Update",
  });
  if (!updateAvailableWindow || updateAvailableWindow.isDestroyed()) return;
  const copy = getUpdateAvailableCopy(
    desktopLanguage,
    DESKTOP_APP_NAME,
    promptedUpdateVersion,
    app.getVersion(),
  );
  updateAvailableWindow.setTitle(copy.title);
  void updateAvailableWindow.webContents
    .executeJavaScript(
      `(() => {
        const copy = ${JSON.stringify(copy)};
        document.documentElement.lang = ${JSON.stringify(isTurkish ? "tr" : "en")};
        document.title = copy.title;
        document.getElementById("update-title").textContent = copy.title;
        document.getElementById("update-detail").textContent = copy.detail;
        document.getElementById("automatic-label").textContent = copy.automatic;
        document.getElementById("skip-update").textContent = copy.skip;
        document.getElementById("remind-later").textContent = copy.later;
        document.getElementById("install-update").textContent = copy.install;
      })()`,
    )
    .catch(() => undefined);
}

function updateNativeDialogLanguage(
  window: BrowserWindow | null,
  title: string,
  copy: Record<string, string>,
) {
  if (!window || window.isDestroyed()) return;
  window.setTitle(title);
  void window.webContents
    .executeJavaScript(
      `(() => {
    document.documentElement.lang = ${JSON.stringify(desktopLanguage)};
    document.title = ${JSON.stringify(title)};
    for (const [id, label] of Object.entries(${JSON.stringify(copy)})) {
      const element = document.getElementById(id);
      if (element) element.textContent = label;
    }
    const progress = document.querySelector('[role="progressbar"]');
    if (progress) progress.setAttribute("aria-label", document.getElementById("update-check-title").textContent);
  })()`,
    )
    .catch(() => undefined);
}

function notifyDesktop(title: string, body: string, onClick?: () => void) {
  if (!Notification.isSupported()) return;
  void readDesktopPreferences().then((preferences) => {
    if (!preferences.notifications) return;
    showDesktopNotification(
      (options) => new Notification(options),
      title,
      body,
      onClick,
    );
  });
}

function isMainWindowInBackground() {
  return (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !mainWindow.isVisible() ||
    !mainWindow.isFocused()
  );
}

async function readUpdatePreferences(): Promise<UpdatePreferences> {
  try {
    return JSON.parse(
      await readFile(updatePreferencesPath(), "utf8"),
    ) as UpdatePreferences;
  } catch {
    return {};
  }
}

async function writeUpdatePreferences(preferences: UpdatePreferences) {
  await writeFile(updatePreferencesPath(), JSON.stringify(preferences), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function sendUpdateStatus(status: DesktopUpdateStatus) {
  latestUpdateStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:update-status", status);
  }
}

async function handleAvailableUpdate(version: string) {
  const preferences = await readUpdatePreferences();
  const manualCheck = manualUpdateCheckRequested;
  manualUpdateCheckRequested = false;
  suppressNextUpdateNotification = manualCheck;
  const skipped = preferences.skippedVersion === version;
  const reminded =
    typeof preferences.remindUntil === "number" &&
    preferences.remindUntil > Date.now();
  if (!manualCheck && (skipped || reminded)) {
    sendUpdateStatus({ state: "not-available" });
    return;
  }
  if (!manualCheck && preferences.automaticDownload === true) {
    void downloadUpdate();
    return;
  }
  sendUpdateStatus({ state: "available", version });
  void showUpdateDialog(version).catch(() => undefined);
}

async function showUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) {
    focusWindow(updateCheckWindow);
    return;
  }
  const language = desktopLanguage;
  const copy = getUpdateCheckingCopy(language);
  const { windowTitle } = copy;
  updateCheckWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 800,
    height: 300,
    resizable: true,
    minWidth: 320,
    minHeight: 240,
    title: windowTitle,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
    },
  });
  const checkingWindow = updateCheckWindow;
  checkingWindow.on("closed", () => {
    if (updateCheckWindow === checkingWindow) updateCheckWindow = null;
  });
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  if (checkingWindow.isDestroyed() || updateCheckWindow !== checkingWindow)
    return;
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const html = renderUpdateCheckingHtml({
    ...copy,
    language,
    appName: DESKTOP_APP_NAME,
    iconDataUrl,
    themeCss: nativeDialogThemeCss(),
    actionsScript: nativeDialogActionsScript(),
  });
  await checkingWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  if (checkingWindow.isDestroyed() || updateCheckWindow !== checkingWindow)
    return;
  checkingWindow.center();
  showWindow(checkingWindow);
}

function closeUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) {
    updateCheckWindow.close();
  }
  updateCheckWindow = null;
}

async function showUpdateNotAvailableWindow() {
  if (updateResultWindow && !updateResultWindow.isDestroyed()) {
    focusWindow(updateResultWindow);
    return;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const language = desktopLanguage;
  const copy = getUpdateResultCopy(
    language,
    DESKTOP_APP_NAME,
    app.getVersion(),
  );
  const { windowTitle } = copy;
  updateResultWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 720,
    height: 280,
    resizable: true,
    minWidth: 320,
    minHeight: 240,
    title: windowTitle,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
    },
  });
  updateResultWindow.on("closed", () => {
    updateResultWindow = null;
  });
  const html = renderUpdateResultHtml({
    ...copy,
    language,
    appName: DESKTOP_APP_NAME,
    iconDataUrl,
    themeCss: nativeDialogThemeCss(),
    actionsScript: nativeDialogActionsScript(),
  });
  await updateResultWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  updateResultWindow.center();
  showWindow(updateResultWindow);
}

async function confirmAndInstallUpdate() {
  if (!(await showUpdateConfirmation())) return;
  if (await downloadUpdate()) installUpdate();
}

function requestUpdateCheck() {
  // A manual menu check should be able to reopen the prompt after the same
  // version was previously dismissed by the automatic check.
  promptedUpdateVersion = null;
  manualUpdateCheckRequested = true;
  return checkForUpdates();
}

async function showUpdateConfirmation() {
  if (updateConfirmationWindow && !updateConfirmationWindow.isDestroyed()) {
    focusWindow(updateConfirmationWindow);
    return false;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const language = desktopLanguage;
  const copy = getUpdateConfirmationCopy(language, DESKTOP_APP_NAME);
  const { title } = copy;
  updateConfirmationWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 560,
    height: 430,
    resizable: true,
    minWidth: 320,
    minHeight: 240,
    title,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
    },
  });
  updateConfirmationWindow.on("closed", () => {
    updateConfirmationWindow = null;
    const resolver = updateConfirmationResolver;
    updateConfirmationResolver = null;
    resolver?.(false);
  });
  updateConfirmationWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${DESKTOP_PROTOCOL}://update-confirm/`)) return;
    event.preventDefault();
    const action = new URL(url).pathname.slice(1);
    const confirmed = action === "update";
    const resolver = updateConfirmationResolver;
    updateConfirmationResolver = null;
    if (updateConfirmationWindow && !updateConfirmationWindow.isDestroyed()) {
      updateConfirmationWindow.close();
    }
    resolver?.(confirmed);
  });
  const html = renderUpdateConfirmationHtml({
    ...copy,
    language,
    appName: DESKTOP_APP_NAME,
    iconDataUrl,
    themeCss: nativeDialogThemeCss(),
    actionsScript: nativeDialogActionsScript(),
    desktopProtocol: DESKTOP_PROTOCOL,
  });
  await updateConfirmationWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  updateConfirmationWindow.center();
  showWindow(updateConfirmationWindow);
  return new Promise<boolean>((resolve) => {
    updateConfirmationResolver = resolve;
  });
}

async function showUpdateDialog(version: string, force = false) {
  const existingWindow = updateAvailableWindow;
  if (existingWindow && !existingWindow.isDestroyed()) {
    if (backgroundE2e || existingWindow.isVisible()) {
      focusWindow(existingWindow);
      return;
    }
    if (updateAvailableWindow === existingWindow) {
      updateAvailableWindow = null;
    }
  }
  if (!force && promptedUpdateVersion === version) return;
  promptedUpdateVersion = version;
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const language = desktopLanguage;
  const copy = getUpdateAvailableCopy(
    language,
    DESKTOP_APP_NAME,
    version,
    app.getVersion(),
  );
  const { title } = copy;
  const dialogWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 760,
    height: 420,
    resizable: true,
    minWidth: 320,
    minHeight: 240,
    title,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
    },
  });
  updateAvailableWindow = dialogWindow;
  dialogWindow.on("closed", () => {
    if (updateAvailableWindow === dialogWindow) {
      updateAvailableWindow = null;
    }
  });
  dialogWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${DESKTOP_PROTOCOL}://update-action/`)) return;
    event.preventDefault();
    const actionUrl = new URL(url);
    const action = actionUrl.pathname.slice(1);
    closeUpdateAvailableWindow(dialogWindow);
    const automaticDownload =
      actionUrl.searchParams.get("automatic") !== "false";
    void readUpdatePreferences()
      .then((preferences) => {
        const next: UpdatePreferences = {
          ...preferences,
          automaticDownload,
        };
        setAutomaticInstallOnAppQuit(automaticDownload);
        if (action === "skip") {
          next.skippedVersion = version;
          delete next.remindUntil;
        } else if (action === "later") {
          next.remindUntil = Date.now() + REMIND_LATER_WINDOW_MS;
          delete next.skippedVersion;
        } else {
          delete next.skippedVersion;
          delete next.remindUntil;
        }
        return writeUpdatePreferences(next);
      })
      .then(() => {
        if (action === "skip" || action === "later") {
          sendUpdateStatus({ state: "not-available" });
        }
        if (action === "download") return confirmAndInstallUpdate();
        return undefined;
      })
      .catch(() => undefined);
  });
  const html = renderUpdateAvailableHtml({
    ...copy,
    language,
    appName: DESKTOP_APP_NAME,
    iconDataUrl,
    themeCss: nativeDialogThemeCss(),
    actionsScript: nativeDialogActionsScript(),
    desktopProtocol: DESKTOP_PROTOCOL,
  });
  await dialogWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  dialogWindow.center();
  showWindow(dialogWindow);
  focusWindow(dialogWindow);
}

function closeUpdateAvailableWindow(window = updateAvailableWindow) {
  if (!window) return;
  if (!window.isDestroyed()) {
    window.close();
  }
  if (updateAvailableWindow === window) {
    updateAvailableWindow = null;
  }
}

function setLogoutMenuVisible(visible: boolean) {
  if (logoutMenuItem) logoutMenuItem.visible = visible;
}

function toggleDeveloperTools() {
  if (backgroundE2e || app.isPackaged) return;
  const targetWindow =
    BrowserWindow.getFocusedWindow() ??
    BrowserWindow.getAllWindows().find((window) => window.isVisible()) ??
    mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) return;
  if (targetWindow.webContents.isDevToolsOpened()) {
    targetWindow.webContents.closeDevTools();
  } else {
    targetWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function installApplicationMenu() {
  const template = createApplicationMenuTemplate({
    appName: DESKTOP_APP_NAME,
    language: desktopLanguage,
    platform: process.platform,
    devToolsEnabled: process.env.DESKTOP_DEVTOOLS === "true",
    actions: {
      about: () => void showAboutDialog(),
      settings: () => void showSettingsWindow(),
      checkForUpdates: () => void requestUpdateCheck(),
      logout: () => {
        void writeVault({})
          .then(() => showDesktopLoginWindow())
          .catch(() => undefined);
        mainWindow?.webContents.send("desktop:menu-logout");
      },
      quickAccess: toggleQuickAccess,
      toggleDeveloperTools,
    },
  });
  const menu = Menu.buildFromTemplate(template);
  logoutMenuItem = menu.getMenuItemById("desktop-logout");
  setLogoutMenuVisible(false);
  Menu.setApplicationMenu(menu);
}

async function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const state = await readWindowState();
  let hasStoredSession = false;
  try {
    const vault = await readVault();
    hasStoredSession = Boolean(vault.admin || vault.account);
  } catch {
    hasStoredSession = false;
  }
  const deepLink = pendingDeepLink;
  pendingDeepLink = null;
  mainWindow = createDesktopMainWindow({
    createWindow: (options) => new BrowserWindow(options),
    preloadPath: path.join(__dirname, "preload.js"),
    state,
    hasStoredSession,
    backgroundE2e,
    backgroundColor: desktopBackgroundColor(),
    rendererUrl: `${RENDERER_PROTOCOL}://${RENDERER_HOST}/native`,
    isAllowedExternalUrl,
    openExternal: (url) => void shell.openExternal(url),
    isTrustedRendererUrl,
    saveWindowState,
    appendDiagnosticEvent,
    showWindow,
    openLogin: () => void showDesktopLoginWindow().catch(() => undefined),
    pendingDeepLink: deepLink,
    sendDeepLink: (value) => void sendDeepLink(value),
    onClosed: () => {
      if (companionWindow && !companionWindow.isDestroyed()) {
        companionWindow.destroy();
      }
      mainWindow = null;
    },
  });
}

function registerIpc() {
  registerDesktopRuntimeInfoIpc({
    ipcMain,
    isTrustedRendererFrame,
    assertTrustedSender,
    getApiBaseUrl,
    protocol: DESKTOP_PROTOCOL,
    getAppVersion: () => app.getVersion(),
    getOs: desktopOsIdentifier,
    getAppStatus: () => ({ isPackaged: app.isPackaged }),
    getProcessStatus: () => ({
      versions: process.versions,
      platform: process.platform,
      architecture: process.arch,
      environment: process.env,
    }),
    isSecureStorageAvailable: () => safeStorage.isEncryptionAvailable(),
    readDiagnosticEvents,
    isAllowedExternalUrl,
    openExternal: (url) => shell.openExternal(url),
  });
  registerDesktopAuthIpc({
    ipcMain,
    assertTrustedSender,
    assertConsole,
    pendingAuthorizations,
    isPendingAuthorizationValid,
    createAuthorizationRequest: nativeAuthorizationRequest,
    persistPendingAuthorizations,
    openExternal: (url) => shell.openExternal(url),
    readVault,
    writeVault,
    setLogoutMenuVisible,
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    logoutDesktopSession,
    startNativeSocialLink,
  });
  registerDesktopPreferencesIpc({
    ipcMain,
    assertTrustedSender,
    readDesktopPreferences,
    writeDesktopPreferences,
    readUpdatePreferences,
    writeUpdatePreferences,
    applyLaunchAtLogin,
    setTrayVisibility,
    setDockVisibility,
    registerGlobalShortcut,
    isValidGlobalShortcut,
    setAutomaticInstallOnAppQuit,
    platform: process.platform,
    defaultGlobalShortcut: DEFAULT_GLOBAL_SHORTCUT,
  });
  registerDesktopAppearanceIpc({
    ipcMain,
    assertTrustedSender,
    applyTheme: applyDesktopTheme,
    persistTheme: (theme) => void writeDesktopTheme(theme),
    getTheme: () => nativeTheme.themeSource,
    applyLanguage: applyDesktopLanguage,
    getLanguage: () => desktopLanguage,
    getLanguageMode: () => desktopLanguageMode,
  });
  ipcMain.handle("desktop:settings-close", (event) => {
    assertTrustedSender(event);
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
  });
  ipcMain.handle("desktop:settings-ready", (event) => {
    assertTrustedSender(event);
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    settingsWindow.center();
    showWindow(settingsWindow);
    focusWindow(settingsWindow);
  });
  ipcMain.handle(
    "desktop:companion-open-console",
    async (event, value: unknown) => {
      assertTrustedSender(event);
      assertConsole(value);
      closeCompanionWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      await mainWindow.loadURL(
        `${RENDERER_PROTOCOL}://${RENDERER_HOST}/native?console=${value}`,
      );
      focusMainWindow();
    },
  );
  ipcMain.handle("desktop:auth-open-console", async (event, value: unknown) => {
    assertTrustedSender(event);
    assertConsole(value);
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error("Desktop window is unavailable");
    }
    await mainWindow.loadURL(
      `${RENDERER_PROTOCOL}://${RENDERER_HOST}/native?console=${value}`,
    );
    showWindow(mainWindow);
    focusWindow(mainWindow);
    closeDesktopLoginWindow();
  });
  registerNativeApiIpc({
    ipcMain,
    assertTrustedSender,
    assertConsole,
    request: (request) => desktopApiAdapter.request(request),
  });
  ipcMain.handle("desktop:update-check", (event) => {
    assertTrustedSender(event);
    return requestUpdateCheck();
  });
  ipcMain.handle("desktop:update-download", (event) => {
    assertTrustedSender(event);
    return confirmAndInstallUpdate();
  });
  ipcMain.handle("desktop:update-install", (event) => {
    assertTrustedSender(event);
    installUpdate();
  });
  ipcMain.handle("desktop:update-status-get", (event) => {
    assertTrustedSender(event);
    return latestUpdateStatus;
  });
}

function enforceContentSecurityPolicy() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (isTrustedRendererUrl(details.url)) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; connect-src 'self' https://kitezh.onrender.com http://localhost:9090; img-src 'self' https://kitezh.onrender.com http://localhost:9090 data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self' data:",
          ],
        },
      });
      return;
    }
    callback({});
  });
}

function registerDesktopProtocol() {
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [
      app.getAppPath(),
    ]);
    return;
  }
  app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
}

registerDesktopLifecycle(app, process, {
  onSecondInstance: (_event, commandLine) => {
    focusMainWindow();
    const deepLink = commandLine.find((value) =>
      value.startsWith(`${DESKTOP_PROTOCOL}://`),
    );
    if (deepLink) void sendDeepLink(deepLink);
  },
  onOpenUrl: (event, url) => {
    event.preventDefault();
    void sendDeepLink(url);
  },
  onReady: async () => {
    app.setName(DESKTOP_APP_NAME);
    applyDesktopTheme(await readDesktopTheme());
    desktopLanguageMode = await readDesktopLanguageMode();
    desktopLanguage = await readDesktopLanguage();
    if (desktopLanguageMode === "system") {
      desktopLanguage = app.getLocale().toLowerCase().startsWith("tr")
        ? "tr"
        : "en";
    }
    installApplicationMenu();
    pendingDeepLink = findDesktopDeepLink();
    await restorePendingAuthorizations();
    registerDesktopProtocol();
    registerIpc();
    const desktopPreferences = await readDesktopPreferences();
    void applyLaunchAtLogin(desktopPreferences.launchAtLogin);
    const shortcutRegistration = registerGlobalShortcutWithFallback(
      globalShortcut,
      desktopPreferences.globalShortcut,
      DEFAULT_GLOBAL_SHORTCUT,
      toggleQuickAccess,
    );
    if (
      !shortcutRegistration.registered &&
      shortcutRegistration.accelerator !== desktopPreferences.globalShortcut
    ) {
      desktopPreferences.globalShortcut = shortcutRegistration.accelerator;
      await writeDesktopPreferences(desktopPreferences);
    }
    setTrayVisibility(desktopPreferences.showInMenuBar);
    setDockVisibility(desktopPreferences.showInDock);
    const updatePreferences = await readUpdatePreferences();
    setAutomaticInstallOnAppQuit(updatePreferences.automaticDownload === true);
    void readVault()
      .then((vault) =>
        setLogoutMenuVisible(Boolean(vault.admin || vault.account)),
      )
      .catch(() => setLogoutMenuVisible(false));
    enforceContentSecurityPolicy();
    await registerRendererProtocol();
    void createWindow();
    if (backgroundE2e && process.platform === "darwin") app.hide();
    configureAutoUpdater(async (status: DesktopUpdateStatus) => {
      void appendDiagnosticEvent(`update-${status.state}`, {
        version: "version" in status ? status.version : undefined,
      });
      if (status.state === "checking") {
        if (!updateCheckWindowReady) {
          updateCheckWindowReady = showUpdateCheckWindow().catch(
            () => undefined,
          );
        }
        sendUpdateStatus(status);
        return;
      } else {
        const checkingWindowReady = updateCheckWindowReady;
        updateCheckWindowReady = null;
        await checkingWindowReady?.catch(() => undefined);
        closeUpdateCheckWindow();
      }
      if (status.state === "available") {
        const manualCheck = manualUpdateCheckRequested;
        if (!manualCheck && isMainWindowInBackground()) {
          notifyDesktop(
            isTurkishDesktop()
              ? `${DESKTOP_APP_NAME} güncellemesi kullanıma hazır`
              : `${DESKTOP_APP_NAME} update available`,
            isTurkishDesktop()
              ? `${status.version} sürümü indirilmeye hazır.`
              : `Version ${status.version} is ready to download.`,
            () => void showUpdateDialog(status.version, true),
          );
        }
        void handleAvailableUpdate(status.version);
        return;
      }
      if (status.state === "downloaded") {
        const suppressNotification = suppressNextUpdateNotification;
        suppressNextUpdateNotification = false;
        if (!suppressNotification && isMainWindowInBackground()) {
          notifyDesktop(
            isTurkishDesktop()
              ? `${DESKTOP_APP_NAME} güncellemesi hazır`
              : `${DESKTOP_APP_NAME} update ready`,
            isTurkishDesktop()
              ? `${status.version} sürümü yeniden başlattığınızda kurulacak.`
              : `Version ${status.version} will be installed when you restart.`,
            () => void showUpdateConfirmation(),
          );
        }
      } else if (status.state === "not-available") {
        const manualCheck = manualUpdateCheckRequested;
        manualUpdateCheckRequested = false;
        suppressNextUpdateNotification = false;
        if (manualCheck) {
          void showUpdateNotAvailableWindow().catch(() => undefined);
        }
      } else if (status.state === "error") {
        // Keep the retry interactive so a recovered check can reopen the
        // update dialog without requiring the user to restart the app.
        manualUpdateCheckRequested = true;
        suppressNextUpdateNotification = false;
      }
      sendUpdateStatus(status);
    });
    if (process.platform === "darwin")
      app.on(
        "activate",
        () => BrowserWindow.getAllWindows()[0] ?? createWindow(),
      );
  },
  onStartupFailure: (error) => {
    void appendDiagnosticEvent("app-startup-failed", {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    app.quit();
  },
  onUncaughtException: (error) => {
    void appendDiagnosticEvent("uncaught-exception", {
      errorType: error.name,
    });
  },
  onUnhandledRejection: (reason) => {
    void appendDiagnosticEvent("unhandled-rejection", {
      errorType: reason instanceof Error ? reason.name : typeof reason,
    });
  },
  onBeforeQuit: () => {
    globalShortcut.unregisterAll();
    tray?.destroy();
    tray = null;
  },
  onWindowAllClosed: () => {
    if (process.platform !== "darwin") app.quit();
  },
});
