import {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  net,
  protocol,
  safeStorage,
  shell,
  screen,
  session,
  type MenuItemConstructorOptions,
  type MenuItem,
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

const DESKTOP_APP_NAME = "Kitezh";
const UPDATE_PREFERENCES_FILE = "desktop-update-preferences.json";
const REMIND_LATER_WINDOW_MS = 24 * 60 * 60 * 1000;
app.setName(DESKTOP_APP_NAME);

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
let aboutWindow: BrowserWindow | null = null;
let updateCheckWindow: BrowserWindow | null = null;
let updateAvailableWindow: BrowserWindow | null = null;
let updateConfirmationWindow: BrowserWindow | null = null;
let updateConfirmationResolver: ((confirmed: boolean) => void) | null = null;
let pendingDeepLink: string | null = null;
let promptedUpdateVersion: string | null = null;
let manualUpdateCheckRequested = false;
let logoutMenuItem: MenuItem | null = null;
type ConsoleName = "admin" | "account";
const pendingAuthorizations = new Map<ConsoleName, PendingAuthorizationData>();
type StoredTokens = DesktopTokens;
type UpdatePreferences = {
  skippedVersion?: string;
  remindUntil?: number;
  automaticDownload?: boolean;
};
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
  const relative =
    pathname === "/"
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

async function showAboutDialog() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  aboutWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: false,
    width: 520,
    height: 470,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: `About ${DESKTOP_APP_NAME}`,
    backgroundColor: "#202124",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>About ${DESKTOP_APP_NAME}</title>
    <style>
      :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8f9fa; color: #202124; }
      main { width: 100%; box-sizing: border-box; padding: 2.5rem 2rem 2rem; text-align: center; }
      img { width: 112px; height: 112px; border-radius: 24px; margin-bottom: 1.5rem; }
      h1 { margin: 0 0 1.25rem; font-size: 2rem; font-weight: 700; }
      p { margin: 0.5rem 0; font-size: 1.1rem; line-height: 1.45; color: #5f6368; }
      .version { margin-top: 1rem; font-size: 1rem; }
      footer { margin-top: 1.5rem; font-size: 0.95rem; color: #6b7280; }
      @media (prefers-color-scheme: dark) {
        body { background: #202124; color: #f1f3f4; }
        p, footer { color: #c4c7c5; }
      }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
      <h1>${DESKTOP_APP_NAME}</h1>
      <p>Secure identity and access console</p>
      <p class="version">Version ${app.getVersion()}</p>
      <footer>© 2026 ${DESKTOP_APP_NAME}</footer>
    </main>
  </body>
</html>`;
  await aboutWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  aboutWindow.center();
  aboutWindow.show();
}

function updatePreferencesPath() {
  return path.join(app.getPath("userData"), UPDATE_PREFERENCES_FILE);
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:update-status", status);
  }
}

async function handleAvailableUpdate(version: string) {
  const preferences = await readUpdatePreferences();
  const manualCheck = manualUpdateCheckRequested;
  manualUpdateCheckRequested = false;
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
    updateCheckWindow.focus();
    return;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = app.getLocale().toLowerCase().startsWith("tr");
  const checkingLabel = isTurkish
    ? "Güncellemeler denetleniyor…"
    : "Checking for updates…";
  const cancelLabel = isTurkish ? "İptal" : "Cancel";
  const windowTitle = isTurkish ? "Yazılım Güncellemesi" : "Software Update";
  updateCheckWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 800,
    height: 300,
    resizable: false,
    title: windowTitle,
    backgroundColor: "#20272b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  updateCheckWindow.on("closed", () => {
    updateCheckWindow = null;
  });
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${windowTitle}</title>
    <style>
      :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #20272b; color: #f1f3f4; }
      main { width: 100%; display: grid; grid-template-columns: 110px 1fr; gap: 24px; align-items: center; padding: 28px 48px; }
      img { width: 104px; height: 104px; border-radius: 22px; }
      h1 { margin: 0 0 26px; font-size: 26px; line-height: 1.15; font-weight: 700; }
      .progress { width: 100%; height: 16px; overflow: hidden; border-radius: 999px; background: #3a4246; }
      .progress::after { content: ""; display: block; width: 72px; height: 100%; border-radius: inherit; background: #1683ff; transform: translateX(-80px); animation: slide 1.35s ease-in-out infinite; }
      @keyframes slide { 0% { transform: translateX(-80px); } 50% { transform: translateX(280px); } 100% { transform: translateX(680px); } }
      button { display: block; margin: 28px 0 0 auto; min-width: 200px; padding: 14px 28px; border: 0; border-radius: 999px; background: #343d42; color: #f1f3f4; font: inherit; font-size: 20px; font-weight: 600; cursor: pointer; }
      button:hover { background: #414c52; }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
      <section>
        <h1>${checkingLabel}</h1>
        <div class="progress" role="progressbar" aria-label="${checkingLabel}" aria-busy="true"></div>
        <button type="button" onclick="window.close()">${cancelLabel}</button>
      </section>
    </main>
  </body>
</html>`;
  await updateCheckWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  updateCheckWindow.center();
  updateCheckWindow.show();
}

function closeUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) {
    updateCheckWindow.close();
  }
  updateCheckWindow = null;
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
    updateConfirmationWindow.focus();
    return false;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = app.getLocale().toLowerCase().startsWith("tr");
  const title = isTurkish
    ? `${DESKTOP_APP_NAME} şimdi güncellensin mi?`
    : `Update ${DESKTOP_APP_NAME} now?`;
  const detail = isTurkish
    ? `${DESKTOP_APP_NAME}, güncellemeyi kurmak için kapanacak. Bu işlem bu makinedeki etkin yerel oturumları keser.`
    : `${DESKTOP_APP_NAME} will quit to install the update, which will interrupt active local sessions on this machine.`;
  const cancelLabel = isTurkish ? "İptal" : "Cancel";
  const updateLabel = isTurkish ? "Güncelle" : "Update";
  updateConfirmationWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 560,
    height: 430,
    resizable: false,
    title,
    backgroundColor: "#20272b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #20272b; color: #f1f3f4; }
      main { padding: 30px 42px 18px; }
      .warning { width: 88px; height: 80px; display: grid; place-items: center; padding-top: 12px; margin: 0 0 18px 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); background: #f3c438; color: #fff; font-size: 48px; line-height: 1; font-weight: 800; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
      h1 { margin: 0 0 16px; font-size: 25px; line-height: 1.2; font-weight: 700; }
      p { margin: 0; max-width: 465px; font-size: 18px; line-height: 1.35; color: #d4d8da; }
      footer { display: flex; justify-content: flex-end; gap: 14px; padding: 0 42px 30px; }
      button { min-width: 150px; padding: 13px 24px; border: 0; border-radius: 999px; background: #343d42; color: #f1f3f4; font: inherit; font-size: 19px; font-weight: 600; cursor: pointer; }
      button.primary { background: #1683ff; }
      button:hover { filter: brightness(1.12); }
    </style>
  </head>
  <body>
    <main>
      <div class="warning" aria-hidden="true">!</div>
      <h1>${title}</h1>
      <p>${detail}</p>
    </main>
    <footer>
      <button type="button" onclick="window.location.href='${DESKTOP_PROTOCOL}://update-confirm/cancel'">${cancelLabel}</button>
      <button class="primary" type="button" onclick="window.location.href='${DESKTOP_PROTOCOL}://update-confirm/update'">${updateLabel}</button>
    </footer>
  </body>
</html>`;
  await updateConfirmationWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  updateConfirmationWindow.center();
  updateConfirmationWindow.show();
  return new Promise<boolean>((resolve) => {
    updateConfirmationResolver = resolve;
  });
}

async function showUpdateDialog(version: string) {
  if (promptedUpdateVersion === version) return;
  promptedUpdateVersion = version;
  if (updateAvailableWindow && !updateAvailableWindow.isDestroyed()) {
    updateAvailableWindow.focus();
    return;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = app.getLocale().toLowerCase().startsWith("tr");
  const title = isTurkish
    ? `Yeni bir ${DESKTOP_APP_NAME} sürümü var!`
    : `A new version of ${DESKTOP_APP_NAME} is available!`;
  const detail = isTurkish
    ? `${DESKTOP_APP_NAME} ${version} kullanıma hazır; mevcut sürümünüz ${app.getVersion()}. Şimdi indirmek ister misiniz?`
    : `${DESKTOP_APP_NAME} ${version} is now available—you have ${app.getVersion()}. Would you like to download it now?`;
  const automaticLabel = isTurkish
    ? "Gelecekteki güncellemeleri otomatik olarak indir ve kur"
    : "Automatically download and install updates in the future";
  const skipLabel = isTurkish ? "Bu sürümü atla" : "Skip This Version";
  const laterLabel = isTurkish ? "Daha sonra hatırlat" : "Remind Me Later";
  const installLabel = isTurkish ? "Güncellemeyi kur" : "Install Update";
  updateAvailableWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 1200,
    height: 360,
    resizable: false,
    title,
    backgroundColor: "#20272b",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  updateAvailableWindow.on("closed", () => {
    updateAvailableWindow = null;
  });
  updateAvailableWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${DESKTOP_PROTOCOL}://update-action/`)) return;
    event.preventDefault();
    const actionUrl = new URL(url);
    const action = actionUrl.pathname.slice(1);
    closeUpdateAvailableWindow();
    const automaticDownload =
      actionUrl.searchParams.get("automatic") !== "false";
    void readUpdatePreferences()
      .then((preferences) => {
        const next: UpdatePreferences = {
          ...preferences,
          automaticDownload,
        };
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
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      :root { color-scheme: dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #20272b; color: #f1f3f4; }
      main { display: grid; grid-template-columns: 112px 1fr; gap: 24px; padding: 28px 48px 24px; }
      img { width: 104px; height: 104px; border-radius: 22px; }
      h1 { margin: 4px 0 12px; font-size: 27px; line-height: 1.15; font-weight: 700; }
      p { margin: 0; max-width: 940px; font-size: 21px; line-height: 1.35; color: #d4d8da; }
      label { display: flex; align-items: center; gap: 10px; margin-top: 22px; font-size: 20px; font-weight: 600; color: #e2e5e7; }
      input { width: 25px; height: 25px; accent-color: #1683ff; }
      footer { display: flex; justify-content: flex-end; gap: 18px; padding: 0 48px 30px; }
      button { min-width: 250px; padding: 14px 28px; border: 0; border-radius: 999px; background: #343d42; color: #f1f3f4; font: inherit; font-size: 20px; font-weight: 600; cursor: pointer; }
      button.primary { background: #1683ff; }
      button:hover { filter: brightness(1.12); }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
      <section>
        <h1>${title}</h1>
        <p>${detail}</p>
        <label><input id="automatic" type="checkbox" checked>${automaticLabel}</label>
      </section>
    </main>
    <footer>
      <button type="button" onclick="window.location.href='${DESKTOP_PROTOCOL}://update-action/skip?automatic=' + document.getElementById('automatic').checked">${skipLabel}</button>
      <button type="button" onclick="window.location.href='${DESKTOP_PROTOCOL}://update-action/later?automatic=' + document.getElementById('automatic').checked">${laterLabel}</button>
      <button class="primary" type="button" onclick="window.location.href='${DESKTOP_PROTOCOL}://update-action/download?automatic=' + document.getElementById('automatic').checked">${installLabel}</button>
    </footer>
  </body>
</html>`;
  await updateAvailableWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  updateAvailableWindow.center();
  updateAvailableWindow.show();
}

function closeUpdateAvailableWindow() {
  if (updateAvailableWindow && !updateAvailableWindow.isDestroyed()) {
    updateAvailableWindow.close();
  }
  updateAvailableWindow = null;
}

function setLogoutMenuVisible(visible: boolean) {
  if (logoutMenuItem) logoutMenuItem.visible = visible;
}

function installApplicationMenu() {
  const applicationMenu: MenuItemConstructorOptions = {
    label: DESKTOP_APP_NAME,
    submenu: [
      {
        label: `About ${DESKTOP_APP_NAME}`,
        click: () => void showAboutDialog(),
      },
      { type: "separator" },
      {
        label: "Settings…",
        click: () => mainWindow?.webContents.send("desktop:menu-settings"),
      },
      {
        label: "Check for Updates…",
        click: () => void requestUpdateCheck(),
      },
      { type: "separator" },
      {
        id: "desktop-logout",
        label: "Log Out",
        click: () => {
          void writeVault({}).catch(() => undefined);
          mainWindow?.webContents.send("desktop:menu-logout");
        },
      },
      { type: "separator" },
      { role: "services", submenu: [] },
      { type: "separator" },
      { role: "hide", label: `Hide ${DESKTOP_APP_NAME}` },
      { role: "hideOthers", label: "Hide Others" },
      { role: "unhide", label: "Show All" },
      { type: "separator" },
      { role: "quit", label: `Quit ${DESKTOP_APP_NAME}` },
    ],
  };
  const template: MenuItemConstructorOptions[] = [
    applicationMenu,
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    { role: "help" },
  ];
  const menu = Menu.buildFromTemplate(template);
  logoutMenuItem = menu.getMenuItemById("desktop-logout");
  setLogoutMenuVisible(false);
  Menu.setApplicationMenu(menu);
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
      setLogoutMenuVisible(true);
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
      setLogoutMenuVisible(Boolean(vault.admin || vault.account));
    },
  );
  ipcMain.handle("desktop:auth-clear-all-sessions", async (event) => {
    assertTrustedSender(event);
    await writeVault({});
    setLogoutMenuVisible(false);
  });
  ipcMain.handle("desktop:auth-storage-status", (event) => {
    assertTrustedSender(event);
    return safeStorage.isEncryptionAvailable() ? "available" : "unavailable";
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
    installApplicationMenu();
    pendingDeepLink = findDesktopDeepLink();
    registerDesktopProtocol();
    registerIpc();
    void readVault()
      .then((vault) =>
        setLogoutMenuVisible(Boolean(vault.admin || vault.account)),
      )
      .catch(() => setLogoutMenuVisible(false));
    enforceContentSecurityPolicy();
    await registerRendererProtocol();
    void createWindow();
    configureAutoUpdater((status: DesktopUpdateStatus) => {
      if (status.state === "checking") {
        void showUpdateCheckWindow().catch(() => undefined);
      } else {
        closeUpdateCheckWindow();
      }
      if (status.state === "available") {
        void handleAvailableUpdate(status.version);
        return;
      }
      sendUpdateStatus(status);
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
