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

import type { ThemeMode } from "@kitezh/shared";

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
  setAutomaticInstallOnAppQuit,
  type DesktopUpdateStatus,
} from "./update";
import { showDesktopNotification } from "./notifications";

const DESKTOP_APP_NAME = "Kitezh";
const UPDATE_PREFERENCES_FILE = "desktop-update-preferences.json";
const DESKTOP_LANGUAGE_FILE = "desktop-language.json";
const COMPANION_WINDOW_STATE_FILE = "desktop-companion-window.json";
const DIAGNOSTICS_LOG_FILE = "diagnostics.log";
const MAX_DIAGNOSTICS_LOG_BYTES = 64 * 1024;
const REMIND_LATER_WINDOW_MS = 24 * 60 * 60 * 1000;
app.setName(DESKTOP_APP_NAME);

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
  return nativeTheme.shouldUseDarkColors ? "#202124" : "#f8f9fa";
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
      window.webContents.send(
        "desktop:theme-changed",
        nativeTheme.shouldUseDarkColors ? "dark" : "light",
      );
    }
  }
}

nativeTheme.on("updated", () => {
  const backgroundColor = desktopBackgroundColor();
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.setBackgroundColor(backgroundColor);
    window.webContents.send(
      "desktop:theme-changed",
      nativeTheme.shouldUseDarkColors ? "dark" : "light",
    );
  }
});

async function applyDesktopLanguage(value: unknown) {
  desktopLanguageMode = value === "tr" || value === "en" ? value : "system";
  desktopLanguage =
    desktopLanguageMode === "system"
      ? app.getLocale().toLowerCase().startsWith("tr")
        ? "tr"
        : "en"
      : desktopLanguageMode;
  await writeDesktopLanguage(desktopLanguage);
  await writeDesktopLanguageMode(desktopLanguageMode);
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.setTitle(
      isTurkishDesktop()
        ? `${DESKTOP_APP_NAME} hakkında`
        : `About ${DESKTOP_APP_NAME}`,
    );
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
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("desktop:language-changed", desktopLanguage);
    }
  }
}

function nativeDialogThemeCss() {
  const dark = nativeTheme.shouldUseDarkColors;
  return `:root {
        color-scheme: ${dark ? "dark" : "light"};
        --dialog-background: ${dark ? "#202124" : "#f8f9fa"};
        --dialog-foreground: ${dark ? "#f1f3f4" : "#202124"};
        --dialog-secondary: ${dark ? "#d4d8da" : "#5f6368"};
        --dialog-button: ${dark ? "#343d42" : "#e8eaed"};
        --dialog-button-hover: ${dark ? "#414c52" : "#dfe1e5"};
        --dialog-border: ${dark ? "#3a4246" : "#dadce0"};
      }`;
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
type ConsoleName = "admin" | "account";
const pendingAuthorizations = new Map<ConsoleName, PendingAuthorizationData>();
type StoredTokens = DesktopTokens;
type UpdatePreferences = {
  skippedVersion?: string;
  remindUntil?: number;
  automaticDownload?: boolean;
};
type DesktopPreferences = {
  launchAtLogin: boolean;
  showInMenuBar: boolean;
  showInDock: boolean;
  notifications: boolean;
  globalShortcut: string;
};
const DEFAULT_GLOBAL_SHORTCUT = "Alt+Space";
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

function redactDiagnosticText(value: string) {
  return value
    .replace(
      /((?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|authorization|cookie|code)=)[^\s&]+/gi,
      "$1[redacted]",
    )
    .replace(
      /((?:"|'?)(?:access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|authorization|cookie|code)(?:"|'?)\s*:\s*["'])([^"']*)(["'])/gi,
      "$1[redacted]$3",
    )
    .replace(/https?:\/\/[^\s]+/gi, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}`;
      } catch {
        return "[redacted-url]";
      }
    })
    .replace(/(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^\s]+/g, "[user-path]")
    .slice(0, 500);
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
  const line = `${new Date().toISOString()} ${name}${Object.keys(safeDetails).length ? ` ${JSON.stringify(safeDetails)}` : ""}\n`;
  try {
    const current = await readFile(diagnosticsLogPath(), "utf8").catch(
      () => "",
    );
    const next = `${current}${line}`.slice(-MAX_DIAGNOSTICS_LOG_BYTES);
    await mkdir(path.dirname(diagnosticsLogPath()), { recursive: true });
    await writeFile(diagnosticsLogPath(), next, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    // Diagnostics must never interfere with the desktop application.
  }
}

async function readDiagnosticEvents() {
  try {
    const content = await readFile(diagnosticsLogPath(), "utf8");
    return content.trim().split("\n").filter(Boolean).slice(-50);
  } catch {
    return [];
  }
}

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

async function desktopLoginHtml() {
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = isTurkishDesktop();
  const labels = isTurkish
    ? {
        eyebrow: "Güvenli şekilde devam edin",
        title: "Bir konsol seçin",
        description: "Devam etmek istediğiniz konsolu seçin.",
        admin: "Admin Console’a giriş yap",
        adminDescription: "Yönetim ve erişim kontrolü.",
        account: "Account Console’a giriş yap",
        accountDescription: "Profil ve hesap ayarları.",
        browserHint:
          "Parolanız tarayıcıda kalır ve masaüstü uygulamasında saklanmaz.",
        unavailable:
          "Güvenli oturum açma başlatılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
        starting: "Tarayıcı açılıyor…",
      }
    : {
        eyebrow: "Continue securely",
        title: "Choose a console",
        description: "Select where you want to continue.",
        admin: "Sign in to Admin Console",
        adminDescription: "Administration and access control.",
        account: "Sign in to Account Console",
        accountDescription: "Profile and account settings.",
        browserHint:
          "Your password stays in the browser and is never stored by the desktop app.",
        unavailable:
          "Secure sign-in could not be started. Check your connection and try again.",
        starting: "Opening browser…",
      };
  return `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${DESKTOP_APP_NAME}</title>
    <style>
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { width: 100%; max-width: 560px; padding: 42px 36px 34px; text-align: center; }
      img { width: 84px; height: 84px; border-radius: 20px; margin-bottom: 22px; }
      .eyebrow { color: #1683ff; font-size: 14px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 12px 0 8px; font-size: 30px; line-height: 1.15; font-weight: 750; }
      .description { margin: 0 0 26px; color: var(--dialog-secondary); font-size: 16px; line-height: 1.45; }
      .option { margin-top: 14px; }
      button { width: 100%; min-height: 52px; padding: 13px 18px; border: 0; border-radius: 10px; background: #1683ff; color: #fff; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
      button:hover { background: #0b72e4; }
      button:disabled { cursor: wait; opacity: .7; }
      .option p { margin: 8px 0 0; color: var(--dialog-secondary); font-size: 13px; line-height: 1.35; }
      .hint { margin: 28px 0 0; color: var(--dialog-secondary); font-size: 13px; line-height: 1.45; }
      .error { display: none; margin: 18px 0 0; padding: 11px 14px; border: 1px solid #d93025; border-radius: 8px; color: #d93025; font-size: 13px; line-height: 1.4; }
      .error.visible { display: block; }
      .status { display: none; margin: 18px 0 0; color: var(--dialog-secondary); font-size: 14px; }
      .status.visible { display: block; }
      .spinner { display: inline-block; width: 15px; height: 15px; margin-right: 8px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -2px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
      <div class="eyebrow">${labels.eyebrow}</div>
      <h1>${labels.title}</h1>
      <p class="description">${labels.description}</p>
      <div class="option">
        <button type="button" data-console="admin">${labels.admin}</button>
        <p>${labels.adminDescription}</p>
      </div>
      <div class="option">
        <button type="button" data-console="account">${labels.account}</button>
        <p>${labels.accountDescription}</p>
      </div>
      <p class="hint">${labels.browserHint}</p>
      <p id="status" class="status"><span class="spinner"></span>${labels.starting}</p>
      <p id="error" class="error">${labels.unavailable}</p>
    </main>
    <script>
      const buttons = [...document.querySelectorAll("button[data-console]")];
      const status = document.getElementById("status");
      const error = document.getElementById("error");
      function setPending(pending) {
        buttons.forEach((button) => { button.disabled = pending; });
        status.classList.toggle("visible", pending);
      }
      buttons.forEach((button) => button.addEventListener("click", async () => {
        setPending(true);
        error.classList.remove("visible");
        try {
          await window.desktopApi.auth.openConsole(button.dataset.console);
        } catch {
          setPending(false);
          error.classList.add("visible");
        }
      }));
      window.desktopApi.onAuthCallback(({ error: callbackError }) => {
        if (callbackError) {
          setPending(false);
          error.classList.add("visible");
        }
      });
      window.desktopApi.language.onChanged(() => window.location.reload());
    </script>
  </body>
</html>`;
}

async function desktopSettingsHtml() {
  const isTurkish = isTurkishDesktop();
  const labels = isTurkish
    ? {
        title: "Ayarlar",
        general: "Genel",
        notifications: "Bildirimler",
        appearance: "Görünüm",
        updates: "Güncellemeler",
        diagnostics: "Tanı bilgileri",
        search: "Ara",
        noResults: "Sonuç bulunamadı",
        language: "Dil",
        system: "Sistem",
        english: "English",
        turkish: "Türkçe",
        theme: "Tema",
        light: "Açık",
        dark: "Koyu",
        launchAtLogin: "Oturum açıldığında Kitezh’i başlat",
        showInMenuBar: "Menü çubuğunda göster",
        showInDock: "Dock’ta göster",
        notificationsEnabled: "Masaüstü bildirimlerini göster",
        globalShortcut: "Hızlı erişim kısayolu",
        shortcutHelp: "Alanı seçip yeni bir tuş kombinasyonuna basın.",
        automaticDownload: "Güncellemeleri otomatik indir ve kur",
        checkForUpdates: "Güncellemeleri denetle",
        reset: "Varsayılanlara sıfırla",
        close: "Kapat",
        diagnosticsHelp: "Sorun giderme için redakte edilmiş tanı bilgileri.",
        copyDiagnostics: "Tanı bilgilerini kopyala",
        copied: "Kopyalandı",
        saving: "Kaydediliyor…",
        saved: "Kaydedildi",
        unavailable: "Kullanılamıyor",
      }
    : {
        title: "Settings",
        general: "General",
        notifications: "Notifications",
        appearance: "Appearance",
        updates: "Updates",
        diagnostics: "Diagnostics",
        search: "Search",
        noResults: "No results found",
        language: "Language",
        system: "System",
        english: "English",
        turkish: "Türkçe",
        theme: "Theme",
        light: "Light",
        dark: "Dark",
        launchAtLogin: "Launch Kitezh at login",
        showInMenuBar: "Show in the menu bar",
        showInDock: "Show in the Dock",
        notificationsEnabled: "Show desktop notifications",
        globalShortcut: "Quick access shortcut",
        shortcutHelp:
          "Click the field and press a key combination to change it.",
        automaticDownload: "Automatically download and install updates",
        checkForUpdates: "Check for updates",
        reset: "Reset to defaults",
        close: "Close",
        diagnosticsHelp: "Redacted runtime information for troubleshooting.",
        copyDiagnostics: "Copy diagnostics",
        copied: "Copied",
        saving: "Saving…",
        saved: "Saved",
        unavailable: "Unavailable",
      };
  const dockControl =
    process.platform === "darwin"
      ? `<label class="setting-row"><span>${labels.showInDock}</span><input id="desktop-show-in-dock" type="checkbox"></label>`
      : "";
  const currentTheme = nativeTheme.themeSource;
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  return `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${labels.title}</title>
    <style>
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }
      header { display: flex; align-items: center; gap: 14px; padding: 22px 28px 16px; border-bottom: 1px solid var(--dialog-border); }
      header img { width: 38px; height: 38px; border-radius: 10px; }
      header h1 { margin: 0; font-size: 24px; line-height: 1.2; }
      .layout { display: grid; grid-template-columns: 220px 1fr; min-height: 540px; }
      nav { padding: 18px 14px; border-right: 1px solid var(--dialog-border); }
      nav input { width: 100%; margin-bottom: 12px; }
      nav button { display: block; width: 100%; margin: 3px 0; padding: 11px 12px; border: 0; border-radius: 8px; background: transparent; color: var(--dialog-foreground); text-align: left; font: inherit; cursor: pointer; }
      nav button:hover, nav button[aria-selected="true"] { background: var(--dialog-button); }
      .no-results { margin: 8px 4px; color: var(--dialog-secondary); font-size: 13px; }
      main { padding: 30px 36px 28px; max-width: 760px; }
      section[hidden] { display: none; }
      h2 { margin: 0 0 8px; font-size: 25px; }
      .intro { margin: 0 0 24px; color: var(--dialog-secondary); line-height: 1.45; }
      .card { border: 1px solid var(--dialog-border); border-radius: 12px; padding: 18px; }
      .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 50px; padding: 7px 0; border-bottom: 1px solid var(--dialog-border); }
      .setting-row:last-child { border-bottom: 0; }
      .setting-row span { font-size: 15px; }
      select, input[type="text"] { min-height: 38px; padding: 7px 10px; border: 1px solid var(--dialog-border); border-radius: 7px; background: var(--dialog-background); color: var(--dialog-foreground); font: inherit; }
      input[type="checkbox"] { width: 19px; height: 19px; accent-color: #1683ff; }
      .theme-options { display: flex; gap: 8px; }
      .theme-options label { display: flex; align-items: center; gap: 6px; }
      .actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 24px; }
      button.action { min-height: 40px; padding: 9px 16px; border: 0; border-radius: 8px; background: #1683ff; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
      button.secondary { background: var(--dialog-button); color: var(--dialog-foreground); }
      button:disabled { cursor: wait; opacity: .65; }
      .status { min-height: 20px; margin: 18px 0 0; color: var(--dialog-secondary); font-size: 13px; }
      pre { overflow: auto; max-height: 300px; padding: 14px; border-radius: 8px; background: var(--dialog-button); color: var(--dialog-secondary); white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body>
    <header><img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo"><h1>${labels.title}</h1></header>
    <div class="layout">
      <nav aria-label="${labels.title}">
        <input id="desktop-settings-search" type="text" placeholder="${labels.search}" aria-label="${labels.search}">
        <button type="button" data-section="general" aria-selected="true">${labels.general}</button>
        <button type="button" data-section="notifications" aria-selected="false">${labels.notifications}</button>
        <button type="button" data-section="appearance" aria-selected="false">${labels.appearance}</button>
        <button type="button" data-section="updates" aria-selected="false">${labels.updates}</button>
        <button type="button" data-section="diagnostics" aria-selected="false">${labels.diagnostics}</button>
        <div id="desktop-settings-no-results" class="no-results" hidden>${labels.noResults}</div>
      </nav>
      <main>
        <section data-panel="general">
          <h2>${labels.general}</h2>
          <p class="intro">${labels.launchAtLogin}</p>
          <div class="card">
            <label class="setting-row"><span>${labels.language}</span><select id="desktop-language"><option value="system">${labels.system}</option><option value="en">${labels.english}</option><option value="tr">${labels.turkish}</option></select></label>
            <label class="setting-row"><span>${labels.launchAtLogin}</span><input id="desktop-launch-at-login" type="checkbox"></label>
            <label class="setting-row"><span>${labels.showInMenuBar}</span><input id="desktop-show-in-menu-bar" type="checkbox"></label>
            ${dockControl}
            <label class="setting-row"><span>${labels.globalShortcut}</span><input id="desktop-global-shortcut" type="text" readonly aria-describedby="shortcut-help"></label>
            <p id="shortcut-help" class="status">${labels.shortcutHelp}</p>
          </div>
        </section>
        <section data-panel="notifications" hidden>
          <h2>${labels.notifications}</h2>
          <p class="intro">${labels.notificationsEnabled}</p>
          <div class="card"><label class="setting-row"><span>${labels.notificationsEnabled}</span><input id="desktop-notifications" type="checkbox"></label></div>
        </section>
        <section data-panel="appearance" hidden>
          <h2>${labels.appearance}</h2>
          <p class="intro">${labels.theme}</p>
          <div class="card theme-options">
            <label><input type="radio" name="desktop-theme" value="system">${labels.system}</label>
            <label><input type="radio" name="desktop-theme" value="light">${labels.light}</label>
            <label><input type="radio" name="desktop-theme" value="dark">${labels.dark}</label>
          </div>
        </section>
        <section data-panel="updates" hidden>
          <h2>${labels.updates}</h2>
          <p class="intro">${labels.automaticDownload}</p>
          <div class="card"><label class="setting-row"><span>${labels.automaticDownload}</span><input id="desktop-automatic-download" type="checkbox"></label></div>
          <div class="actions"><span></span><button id="desktop-check-for-updates" class="action" type="button">${labels.checkForUpdates}</button></div>
        </section>
        <section data-panel="diagnostics" hidden>
          <h2>${labels.diagnostics}</h2>
          <p class="intro">${labels.diagnosticsHelp}</p>
          <div class="card"><pre id="desktop-diagnostics">${labels.unavailable}</pre><div class="actions"><span></span><button id="desktop-copy-diagnostics" class="action secondary" type="button">${labels.copyDiagnostics}</button></div></div>
        </section>
        <div class="actions"><span id="desktop-status" class="status"></span><button id="desktop-reset" class="action secondary" type="button">${labels.reset}</button></div>
      </main>
    </div>
    <script>
      const labels = ${JSON.stringify(labels)};
      const api = window.desktopApi;
      const sections = Array.from(document.querySelectorAll("nav button[data-section]"));
      const panels = Array.from(document.querySelectorAll("section[data-panel]"));
      const search = document.getElementById("desktop-settings-search");
      const noResults = document.getElementById("desktop-settings-no-results");
      const status = document.getElementById("desktop-status");
      const setStatus = (value) => { status.textContent = value; };
      const setBusy = (busy) => { document.querySelectorAll("button, select, input").forEach((control) => { if (control.id !== "desktop-global-shortcut") control.disabled = busy; }); };
      const showSection = (name) => { sections.forEach((button) => button.setAttribute("aria-selected", String(button.dataset.section === name))); panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; }); if (name === "diagnostics") void loadDiagnostics(); };
      sections.forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
      search.addEventListener("input", () => { const query = search.value.trim().toLocaleLowerCase(); let visible = 0; sections.forEach((button) => { const matches = !query || button.textContent.toLocaleLowerCase().includes(query); button.hidden = !matches; if (matches) visible += 1; }); noResults.hidden = visible > 0; if (visible === 0) panels.forEach((panel) => { panel.hidden = true; }); });
      const setPreferences = async (value) => { setBusy(true); setStatus(labels.saving); try { const next = await api.preferences.set(value); applyPreferences(next); setStatus(labels.saved); } catch { setStatus(labels.unavailable); } finally { setBusy(false); } };
      const applyPreferences = (value) => { document.getElementById("desktop-launch-at-login").checked = Boolean(value.launchAtLogin); document.getElementById("desktop-show-in-menu-bar").checked = Boolean(value.showInMenuBar); const dock = document.getElementById("desktop-show-in-dock"); if (dock) dock.checked = Boolean(value.showInDock); document.getElementById("desktop-notifications").checked = Boolean(value.notifications); document.getElementById("desktop-automatic-download").checked = Boolean(value.automaticDownload); document.getElementById("desktop-global-shortcut").value = value.globalShortcut || "Alt+Space"; };
      const loadPreferences = async () => { try { applyPreferences(await api.preferences.get()); const languageMode = await api.language.getMode(); document.getElementById("desktop-language").value = languageMode; document.querySelector("input[name='desktop-theme'][value='${currentTheme}']").checked = true; } catch { setStatus(labels.unavailable); } };
      const loadDiagnostics = async () => { try { const value = await api.diagnostics.get(); document.getElementById("desktop-diagnostics").textContent = JSON.stringify(value, null, 2); } catch { document.getElementById("desktop-diagnostics").textContent = labels.unavailable; } };
      document.getElementById("desktop-language").addEventListener("change", async (event) => { const value = event.target.value; setBusy(true); try { await api.language.set(value); window.location.reload(); } catch { setStatus(labels.unavailable); setBusy(false); } });
      document.getElementById("desktop-launch-at-login").addEventListener("change", (event) => void setPreferences({ launchAtLogin: event.target.checked }));
      document.getElementById("desktop-show-in-menu-bar").addEventListener("change", (event) => void setPreferences({ showInMenuBar: event.target.checked }));
      const dock = document.getElementById("desktop-show-in-dock"); if (dock) dock.addEventListener("change", (event) => void setPreferences({ showInDock: event.target.checked }));
      document.getElementById("desktop-notifications").addEventListener("change", (event) => void setPreferences({ notifications: event.target.checked }));
      document.getElementById("desktop-automatic-download").addEventListener("change", (event) => void setPreferences({ automaticDownload: event.target.checked }));
      const shortcut = document.getElementById("desktop-global-shortcut"); shortcut.addEventListener("keydown", (event) => { event.preventDefault(); const parts = []; if (event.metaKey) parts.push("Command"); else if (event.ctrlKey) parts.push("CommandOrControl"); if (event.altKey) parts.push("Alt"); if (event.shiftKey) parts.push("Shift"); const key = event.key.length === 1 ? event.key.toUpperCase() : ({ " ": "Space", Escape: "Escape", Enter: "Enter", Tab: "Tab" }[event.key] || event.key); if (parts.length && key) void setPreferences({ globalShortcut: parts.concat(key).join("+") }); });
      document.querySelectorAll("input[name='desktop-theme']").forEach((control) => control.addEventListener("change", async (event) => { setBusy(true); try { await api.theme.set(event.target.value); window.location.reload(); } catch { setStatus(labels.unavailable); setBusy(false); } }));
      document.getElementById("desktop-check-for-updates").addEventListener("click", async () => { setBusy(true); try { await api.updates.check(); } finally { setBusy(false); } });
      document.getElementById("desktop-copy-diagnostics").addEventListener("click", async () => { try { await navigator.clipboard.writeText(document.getElementById("desktop-diagnostics").textContent); setStatus(labels.copied); } catch { setStatus(labels.unavailable); } });
      document.getElementById("desktop-reset").addEventListener("click", async () => { setBusy(true); setStatus(labels.saving); try { applyPreferences(await api.preferences.reset()); await api.language.set("system"); await api.theme.set("system"); window.location.reload(); } catch { setStatus(labels.unavailable); setBusy(false); } });
      api.language.onChanged(() => window.location.reload());
      void api.settings.ready();
      void loadPreferences();
    </script>
  </body>
</html>`;
}

async function registerRendererProtocol() {
  protocol.handle(RENDERER_PROTOCOL, async (request) => {
    const requestPath = new URL(request.url).pathname;
    if (requestPath === "/desktop-login" || requestPath === "/desktop-login/") {
      return new Response(await desktopLoginHtml(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (
      requestPath === "/desktop-settings" ||
      requestPath === "/desktop-settings/"
    ) {
      return new Response(await desktopSettingsHtml(), {
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
      url: value,
      error: callback.error ?? "authorization_failed",
    });
    return;
  }
  try {
    await storeAuthorizationCode(pending[1], callback.code, pending[0]);
  } catch {
    sendAuthCallback({
      console: pending[0],
      url: value,
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
  mainWindow.show();
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

async function showAboutDialog() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
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
    resizable: false,
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
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
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
      <p>${isTurkish ? "Güvenli kimlik ve erişim konsolu" : "Secure identity and access console"}</p>
      <p class="version">${isTurkish ? "Sürüm" : "Version"} ${app.getVersion()}</p>
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

async function showSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: false,
    width: 1100,
    height: 640,
    minWidth: 900,
    minHeight: 560,
    title: isTurkishDesktop()
      ? `${DESKTOP_APP_NAME} ayarları`
      : `${DESKTOP_APP_NAME} Settings`,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
  await settingsWindow.loadURL(
    `${RENDERER_PROTOCOL}://${RENDERER_HOST}/desktop-settings`,
  );
}

function updatePreferencesPath() {
  return path.join(app.getPath("userData"), UPDATE_PREFERENCES_FILE);
}

function desktopPreferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function desktopLanguagePath() {
  return path.join(app.getPath("userData"), DESKTOP_LANGUAGE_FILE);
}

function desktopLanguageModePath() {
  return path.join(app.getPath("userData"), "desktop-language-mode.json");
}

async function readDesktopLanguage(): Promise<DesktopLanguage> {
  try {
    const value = await readFile(desktopLanguagePath(), "utf8");
    return value.trim() === "tr" ? "tr" : "en";
  } catch {
    return desktopLanguage;
  }
}

async function writeDesktopLanguage(language: DesktopLanguage) {
  await mkdir(path.dirname(desktopLanguagePath()), { recursive: true });
  await writeFile(desktopLanguagePath(), language, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function readDesktopLanguageMode(): Promise<DesktopLanguageMode> {
  try {
    const value = await readFile(desktopLanguageModePath(), "utf8");
    const normalized = value.trim();
    return normalized === "tr" || normalized === "en" ? normalized : "system";
  } catch {
    return "system";
  }
}

async function writeDesktopLanguageMode(mode: DesktopLanguageMode) {
  await mkdir(path.dirname(desktopLanguageModePath()), { recursive: true });
  await writeFile(desktopLanguageModePath(), mode, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function linuxAutostartPath() {
  return path.join(app.getPath("appData"), "autostart", "kitezh.desktop");
}

function launchAtLoginEnabled() {
  if (process.platform === "linux") return existsSync(linuxAutostartPath());
  return app.getLoginItemSettings().openAtLogin;
}

function defaultDesktopPreferences(): DesktopPreferences {
  return {
    launchAtLogin: launchAtLoginEnabled(),
    showInMenuBar: true,
    showInDock: true,
    notifications: true,
    globalShortcut: DEFAULT_GLOBAL_SHORTCUT,
  };
}

async function readDesktopPreferences(): Promise<DesktopPreferences> {
  const defaults = defaultDesktopPreferences();
  try {
    const value = JSON.parse(
      await readFile(desktopPreferencesPath(), "utf8"),
    ) as Partial<DesktopPreferences>;
    return {
      launchAtLogin:
        typeof value.launchAtLogin === "boolean"
          ? value.launchAtLogin
          : defaults.launchAtLogin,
      showInMenuBar:
        typeof value.showInMenuBar === "boolean"
          ? value.showInMenuBar
          : defaults.showInMenuBar,
      showInDock:
        typeof value.showInDock === "boolean"
          ? value.showInDock
          : defaults.showInDock,
      notifications:
        typeof value.notifications === "boolean"
          ? value.notifications
          : defaults.notifications,
      globalShortcut:
        typeof value.globalShortcut === "string" &&
        value.globalShortcut.length > 0
          ? value.globalShortcut
          : defaults.globalShortcut,
    };
  } catch {
    return defaults;
  }
}

async function writeDesktopPreferences(preferences: DesktopPreferences) {
  await mkdir(path.dirname(desktopPreferencesPath()), { recursive: true });
  await writeFile(desktopPreferencesPath(), JSON.stringify(preferences), {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function applyLaunchAtLogin(enabled: boolean) {
  if (process.platform === "linux") {
    const file = linuxAutostartPath();
    if (!enabled) {
      await rm(file, { force: true });
      return;
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `[Desktop Entry]\nType=Application\nName=${DESKTOP_APP_NAME}\nExec="${process.execPath}"\nHidden=false\nNoDisplay=false\nX-GNOME-Autostart-enabled=true\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args:
      process.defaultApp && process.argv[1]
        ? [path.resolve(process.argv[1])]
        : [],
  });
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function desktopCompanionHtml() {
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = isTurkishDesktop();
  const labels = isTurkish
    ? {
        account: "Hesap Konsolu",
        admin: "Yönetim Konsolu",
        description: "Devam etmek istediğiniz konsolu seçin.",
        eyebrow: "GÜVENLİ ERİŞİM",
        loading: "Açılıyor…",
      }
    : {
        account: "Account Console",
        admin: "Admin Console",
        description: "Choose where you want to continue.",
        eyebrow: "CONTINUE SECURELY",
        loading: "Opening…",
      };
  return `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${DESKTOP_APP_NAME}</title>
    <style>
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { display: grid; min-height: 100vh; place-items: center; padding: 2rem; }
      section { width: min(100%, 390px); text-align: center; }
      img { width: 76px; height: 76px; border-radius: 18px; margin-bottom: 1.25rem; }
      .eyebrow { color: #1677ff; font-size: .78rem; font-weight: 700; letter-spacing: .08em; }
      h1 { font-size: 1.65rem; margin: .6rem 0 .45rem; }
      p { color: var(--dialog-secondary); font-size: .98rem; margin: 0 0 1.5rem; }
      .actions { display: grid; gap: .75rem; }
      button { align-items: center; background: #1677ff; border: 0; border-radius: 10px; color: white; cursor: pointer; display: flex; font: inherit; font-weight: 700; gap: .6rem; justify-content: center; min-height: 48px; padding: .7rem 1rem; width: 100%; }
      button:hover { background: #0f5fd2; }
      button:disabled { cursor: default; opacity: .65; }
      .spinner { animation: spin 800ms linear infinite; border: 2px solid rgba(255,255,255,.45); border-radius: 50%; border-top-color: white; height: 16px; width: 16px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main>
      <section aria-labelledby="companion-title">
        <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
        <div class="eyebrow">${labels.eyebrow}</div>
        <h1 id="companion-title">${DESKTOP_APP_NAME}</h1>
        <p>${labels.description}</p>
        <div class="actions">
          <button type="button" data-console="admin">${labels.admin}</button>
          <button type="button" data-console="account">${labels.account}</button>
        </div>
      </section>
    </main>
    <script>
      const labels = ${JSON.stringify(labels)};
      let pending = false;
      for (const button of document.querySelectorAll("button[data-console]")) {
        button.addEventListener("click", async () => {
          if (pending) return;
          pending = true;
          for (const candidate of document.querySelectorAll("button[data-console]")) candidate.disabled = true;
          button.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + labels.loading;
          try {
            await window.desktopApi.companion.openConsole(button.dataset.console);
          } finally {
            pending = false;
            button.textContent = button.dataset.console === "admin" ? labels.admin : labels.account;
            for (const candidate of document.querySelectorAll("button[data-console]")) candidate.disabled = false;
          }
        });
      }
      window.desktopApi.language.onChanged(() => window.location.reload());
    </script>
  </body>
</html>`;
}

async function showDesktopLoginWindow() {
  if (desktopLoginWindow && !desktopLoginWindow.isDestroyed()) {
    desktopLoginWindow.show();
    desktopLoginWindow.focus();
    return;
  }
  desktopLoginWindow = new BrowserWindow({
    parent: mainWindow?.isVisible() ? mainWindow : undefined,
    modal: Boolean(mainWindow?.isVisible()),
    width: 580,
    height: 650,
    minWidth: 500,
    minHeight: 580,
    resizable: false,
    closable: true,
    show: false,
    title: DESKTOP_APP_NAME,
    backgroundColor: desktopBackgroundColor(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
    if (desktopLoginWindow === loginWindow) desktopLoginWindow = null;
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
  loginWindow.show();
  loginWindow.focus();
}

function closeDesktopLoginWindow() {
  if (desktopLoginWindow && !desktopLoginWindow.isDestroyed()) {
    desktopLoginWindow.close();
  }
  desktopLoginWindow = null;
}

async function showCompanionWindow() {
  if (companionWindow && !companionWindow.isDestroyed()) {
    if (companionWindow.isMinimized()) companionWindow.restore();
    companionWindow.show();
    companionWindow.focus();
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
  companionWindow.show();
  companionWindow.focus();
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
    /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key)
  );
}

function registerGlobalShortcut(accelerator: string) {
  globalShortcut.unregisterAll();
  try {
    if (globalShortcut.register(accelerator, toggleQuickAccess)) return true;
  } catch {
    // Invalid or unavailable accelerators fall back to the default shortcut.
  }
  if (!globalShortcut.register(DEFAULT_GLOBAL_SHORTCUT, toggleQuickAccess)) {
    return false;
  }
  return false;
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
    app.dock?.show();
  } else {
    app.dock?.hide();
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const isTurkish = isTurkishDesktop();
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
    updateCheckWindow.focus();
    return;
  }
  const isTurkish = isTurkishDesktop();
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
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${windowTitle}</title>
    <style>
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { width: 100%; display: grid; grid-template-columns: 110px 1fr; gap: 24px; align-items: center; padding: 24px 28px 20px; }
      img { width: 104px; height: 104px; border-radius: 22px; }
      h1 { margin: 0 0 26px; font-size: 26px; line-height: 1.15; font-weight: 700; }
      .progress { width: 100%; height: 16px; overflow: hidden; border-radius: 999px; background: var(--dialog-border); }
      .progress::after { content: ""; display: block; width: 72px; height: 100%; border-radius: inherit; background: #1683ff; transform: translateX(-80px); animation: slide 1.35s ease-in-out infinite; }
      @keyframes slide { 0% { transform: translateX(-80px); } 50% { transform: translateX(280px); } 100% { transform: translateX(680px); } }
      button { display: block; margin: 24px 0 0 auto; min-width: 180px; padding: 12px 24px; border: 0; border-radius: 999px; background: var(--dialog-button); color: var(--dialog-foreground); font: inherit; font-size: 18px; font-weight: 600; cursor: pointer; }
      button:hover { background: var(--dialog-button-hover); }
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
  await checkingWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  if (checkingWindow.isDestroyed() || updateCheckWindow !== checkingWindow)
    return;
  checkingWindow.center();
  checkingWindow.show();
}

function closeUpdateCheckWindow() {
  if (updateCheckWindow && !updateCheckWindow.isDestroyed()) {
    updateCheckWindow.close();
  }
  updateCheckWindow = null;
}

async function showUpdateNotAvailableWindow() {
  if (updateResultWindow && !updateResultWindow.isDestroyed()) {
    updateResultWindow.focus();
    return;
  }
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = isTurkishDesktop();
  const title = isTurkish
    ? `${DESKTOP_APP_NAME} güncel`
    : `${DESKTOP_APP_NAME} is up to date`;
  const detail = isTurkish
    ? `${DESKTOP_APP_NAME} için kullanılabilir yeni bir sürüm yok. ${app.getVersion()} sürümünü kullanıyorsunuz.`
    : `There are no new updates available for ${DESKTOP_APP_NAME}. You are using version ${app.getVersion()}.`;
  const doneLabel = isTurkish ? "Tamam" : "Done";
  const windowTitle = isTurkish ? "Yazılım Güncellemesi" : "Software Update";
  updateResultWindow = new BrowserWindow({
    parent: mainWindow ?? undefined,
    modal: true,
    width: 720,
    height: 280,
    resizable: false,
    title: windowTitle,
    backgroundColor: desktopBackgroundColor(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  updateResultWindow.on("closed", () => {
    updateResultWindow = null;
  });
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${windowTitle}</title>
    <style>
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { width: 100%; display: grid; grid-template-columns: 96px 1fr; gap: 24px; align-items: center; padding: 24px 28px 20px; }
      img { width: 88px; height: 88px; border-radius: 20px; }
      h1 { margin: 0 0 10px; font-size: 25px; line-height: 1.15; font-weight: 700; }
      p { margin: 0; color: var(--dialog-secondary); font-size: 16px; line-height: 1.45; }
      footer { grid-column: 2; display: flex; justify-content: flex-end; margin-top: -4px; }
      button { min-width: 112px; padding: 10px 22px; border: 0; border-radius: 999px; background: var(--dialog-button); color: var(--dialog-foreground); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
      button:hover { background: var(--dialog-button-hover); }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${DESKTOP_APP_NAME} logo">
      <section>
        <h1>${title}</h1>
        <p>${detail}</p>
      </section>
      <footer><button type="button" onclick="window.close()">${doneLabel}</button></footer>
    </main>
  </body>
</html>`;
  await updateResultWindow.loadURL(
    `data:text/html;base64,${Buffer.from(html).toString("base64")}`,
  );
  updateResultWindow.center();
  updateResultWindow.show();
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
  const isTurkish = isTurkishDesktop();
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
    backgroundColor: desktopBackgroundColor(),
    show: false,
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
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { padding: 26px 28px 14px; }
      .warning { width: 88px; height: 80px; display: grid; place-items: center; padding-top: 12px; margin: 0 0 18px 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); background: #f3c438; color: #fff; font-size: 48px; line-height: 1; font-weight: 800; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
      h1 { margin: 0 0 16px; font-size: 25px; line-height: 1.2; font-weight: 700; }
      p { margin: 0; max-width: 465px; font-size: 18px; line-height: 1.35; color: var(--dialog-secondary); }
      footer { display: flex; justify-content: flex-end; gap: 12px; padding: 0 28px 24px; }
      button { min-width: 140px; padding: 12px 22px; border: 0; border-radius: 999px; background: var(--dialog-button); color: var(--dialog-foreground); font: inherit; font-size: 18px; font-weight: 600; cursor: pointer; }
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

async function showUpdateDialog(version: string, force = false) {
  if (updateAvailableWindow && !updateAvailableWindow.isDestroyed()) {
    updateAvailableWindow.focus();
    return;
  }
  if (!force && promptedUpdateVersion === version) return;
  promptedUpdateVersion = version;
  const icon = await readFile(path.join(app.getAppPath(), "assets/icon.png"));
  const iconDataUrl = `data:image/png;base64,${icon.toString("base64")}`;
  const isTurkish = isTurkishDesktop();
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
    backgroundColor: desktopBackgroundColor(),
    show: false,
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
  const html = `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      ${nativeDialogThemeCss()}
      :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { display: grid; grid-template-columns: 112px 1fr; gap: 24px; padding: 24px 28px 18px; }
      img { width: 104px; height: 104px; border-radius: 22px; }
      h1 { margin: 4px 0 12px; font-size: 27px; line-height: 1.15; font-weight: 700; }
      p { margin: 0; max-width: 940px; font-size: 21px; line-height: 1.35; color: var(--dialog-secondary); }
      label { display: flex; align-items: center; gap: 10px; margin-top: 22px; font-size: 20px; font-weight: 600; color: var(--dialog-foreground); }
      input { width: 25px; height: 25px; accent-color: #1683ff; }
      footer { display: flex; justify-content: flex-end; gap: 14px; padding: 0 28px 24px; }
      button { min-width: 220px; padding: 13px 24px; border: 0; border-radius: 999px; background: var(--dialog-button); color: var(--dialog-foreground); font: inherit; font-size: 19px; font-weight: 600; cursor: pointer; }
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

function toggleDeveloperTools() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function installApplicationMenu() {
  const isTurkish = isTurkishDesktop();
  const applicationMenu: MenuItemConstructorOptions = {
    label: DESKTOP_APP_NAME,
    submenu: [
      {
        label: isTurkish
          ? `${DESKTOP_APP_NAME} hakkında`
          : `About ${DESKTOP_APP_NAME}`,
        click: () => void showAboutDialog(),
      },
      { type: "separator" },
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
        id: "desktop-logout",
        label: isTurkish ? "Oturumu kapat" : "Log Out",
        click: () => {
          void writeVault({})
            .then(() => showDesktopLoginWindow())
            .catch(() => undefined);
          mainWindow?.webContents.send("desktop:menu-logout");
        },
      },
      { type: "separator" },
      { role: "services", submenu: [] },
      { type: "separator" },
      {
        role: "hide",
        label: isTurkish
          ? `${DESKTOP_APP_NAME} uygulamasını gizle`
          : `Hide ${DESKTOP_APP_NAME}`,
      },
      {
        role: "hideOthers",
        label: isTurkish ? "Diğerlerini gizle" : "Hide Others",
      },
      { role: "unhide", label: isTurkish ? "Tümünü göster" : "Show All" },
      { type: "separator" },
      {
        role: "quit",
        label: isTurkish
          ? `${DESKTOP_APP_NAME}'ten çık`
          : `Quit ${DESKTOP_APP_NAME}`,
      },
    ],
  };
  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: isTurkish ? "Hızlı erişim…" : "Quick Access…",
      click: toggleQuickAccess,
    },
    { type: "separator" },
    { role: "reload" },
    { role: "forceReload" },
    { type: "separator" },
    ...(process.env.DESKTOP_DEVTOOLS === "true"
      ? [
          {
            label: isTurkish
              ? "Geliştirici araçlarını aç/kapat"
              : "Toggle Developer Tools",
            click: toggleDeveloperTools,
          },
          { type: "separator" as const },
        ]
      : []),
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];
  const template: MenuItemConstructorOptions[] = [
    applicationMenu,
    { role: "editMenu" },
    { label: isTurkish ? "Görünüm" : "View", submenu: viewSubmenu },
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
  let hasStoredSession = false;
  try {
    const vault = await readVault();
    hasStoredSession = Boolean(vault.admin || vault.account);
  } catch {
    hasStoredSession = false;
  }
  mainWindow = new BrowserWindow({
    x: state?.x,
    y: state?.y,
    width: state?.width ?? 1440,
    height: state?.height ?? 960,
    minWidth: 960,
    minHeight: 640,
    show: hasStoredSession,
    backgroundColor: desktopBackgroundColor(),
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
  mainWindow.on(
    "unresponsive",
    () => void appendDiagnosticEvent("window-unresponsive"),
  );
  mainWindow.on(
    "responsive",
    () => void appendDiagnosticEvent("window-responsive"),
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    void appendDiagnosticEvent("renderer-process-gone", {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });
  void mainWindow.loadURL(`${RENDERER_PROTOCOL}://${RENDERER_HOST}/`);
  mainWindow.on("closed", () => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.destroy();
    }
    mainWindow = null;
  });
  if (state?.maximized) mainWindow.maximize();
  if (hasStoredSession) {
    mainWindow.webContents.once("did-finish-load", () => mainWindow?.show());
  }
  if (!hasStoredSession) void showDesktopLoginWindow().catch(() => undefined);
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
  ipcMain.handle("desktop:diagnostics-get", async (event) => {
    assertTrustedSender(event);
    let apiHost = "unknown";
    try {
      apiHost = new URL(getApiBaseUrl()).host;
    } catch {
      // The configured origin is validated elsewhere; keep diagnostics safe if it is unavailable.
    }
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      apiHost,
      packaged: app.isPackaged,
      secureStorage: safeStorage.isEncryptionAvailable()
        ? "available"
        : "unavailable",
      autoUpdatesSupported:
        app.isPackaged &&
        process.env.DESKTOP_AUTO_UPDATE !== "false" &&
        (process.platform !== "linux" || Boolean(process.env.APPIMAGE)),
      events: await readDiagnosticEvents(),
    };
  });
  ipcMain.handle("desktop:theme-set", (event, value: unknown) => {
    assertTrustedSender(event);
    applyDesktopTheme(value);
  });
  ipcMain.handle("desktop:language-set", async (event, value: unknown) => {
    assertTrustedSender(event);
    await applyDesktopLanguage(value);
  });
  ipcMain.handle("desktop:language-get", async (event) => {
    assertTrustedSender(event);
    return desktopLanguage;
  });
  ipcMain.handle("desktop:language-mode-get", async (event) => {
    assertTrustedSender(event);
    return desktopLanguageMode;
  });
  ipcMain.handle("desktop:preferences-get", async (event) => {
    assertTrustedSender(event);
    const preferences = await readDesktopPreferences();
    const updatePreferences = await readUpdatePreferences();
    return {
      ...preferences,
      automaticDownload: updatePreferences.automaticDownload === true,
    };
  });
  ipcMain.handle("desktop:preferences-set", async (event, value: unknown) => {
    assertTrustedSender(event);
    if (!value || typeof value !== "object")
      throw new Error("Invalid desktop preferences");
    const input = value as Partial<DesktopPreferences> & {
      automaticDownload?: boolean;
    };
    const current = await readDesktopPreferences();
    if (
      input.globalShortcut !== undefined &&
      (typeof input.globalShortcut !== "string" ||
        !isValidGlobalShortcut(input.globalShortcut))
    ) {
      throw new Error("Invalid global shortcut");
    }
    const next: DesktopPreferences = {
      launchAtLogin:
        typeof input.launchAtLogin === "boolean"
          ? input.launchAtLogin
          : current.launchAtLogin,
      showInMenuBar:
        typeof input.showInMenuBar === "boolean"
          ? input.showInMenuBar
          : current.showInMenuBar,
      showInDock:
        typeof input.showInDock === "boolean"
          ? input.showInDock
          : current.showInDock,
      notifications:
        typeof input.notifications === "boolean"
          ? input.notifications
          : current.notifications,
      globalShortcut:
        typeof input.globalShortcut === "string" &&
        input.globalShortcut.length > 0
          ? input.globalShortcut
          : current.globalShortcut,
    };
    if (
      process.platform === "darwin" &&
      !next.showInMenuBar &&
      !next.showInDock
    ) {
      throw new Error("Keep the menu bar or Dock entry visible");
    }
    await applyLaunchAtLogin(next.launchAtLogin);
    setTrayVisibility(next.showInMenuBar);
    setDockVisibility(next.showInDock);
    if (
      next.globalShortcut !== current.globalShortcut &&
      !registerGlobalShortcut(next.globalShortcut)
    ) {
      registerGlobalShortcut(current.globalShortcut);
      throw new Error("Global shortcut is unavailable");
    }
    await writeDesktopPreferences(next);
    if (typeof input.automaticDownload === "boolean") {
      const updatePreferences = await readUpdatePreferences();
      await writeUpdatePreferences({
        ...updatePreferences,
        automaticDownload: input.automaticDownload,
      });
      setAutomaticInstallOnAppQuit(input.automaticDownload);
    }
    const updatePreferences = await readUpdatePreferences();
    return {
      ...next,
      automaticDownload: updatePreferences.automaticDownload === true,
    };
  });
  ipcMain.handle("desktop:preferences-reset", async (event) => {
    assertTrustedSender(event);
    const next: DesktopPreferences = {
      launchAtLogin: false,
      showInMenuBar: true,
      showInDock: true,
      notifications: true,
      globalShortcut: DEFAULT_GLOBAL_SHORTCUT,
    };
    await applyLaunchAtLogin(next.launchAtLogin);
    setTrayVisibility(next.showInMenuBar);
    setDockVisibility(next.showInDock);
    if (!registerGlobalShortcut(next.globalShortcut)) {
      throw new Error("Global shortcut is unavailable");
    }
    await writeDesktopPreferences(next);
    await writeUpdatePreferences({});
    setAutomaticInstallOnAppQuit(false);
    return { ...next, automaticDownload: false };
  });
  ipcMain.handle("desktop:settings-close", (event) => {
    assertTrustedSender(event);
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
  });
  ipcMain.handle("desktop:settings-ready", (event) => {
    assertTrustedSender(event);
    if (!settingsWindow || settingsWindow.isDestroyed()) return;
    settingsWindow.center();
    settingsWindow.show();
    settingsWindow.focus();
  });
  ipcMain.handle(
    "desktop:companion-open-console",
    async (event, value: unknown) => {
      assertTrustedSender(event);
      assertConsole(value);
      closeCompanionWindow();
      if (!mainWindow || mainWindow.isDestroyed()) return;
      await mainWindow.loadURL(
        `${RENDERER_PROTOCOL}://${RENDERER_HOST}/${value}?desktopSignIn=1`,
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
      `${RENDERER_PROTOCOL}://${RENDERER_HOST}/${value === "admin" ? "admin" : "account/personal-info"}?desktopSignIn=1`,
    );
    if (desktopLoginWindow && !desktopLoginWindow.isDestroyed()) {
      desktopLoginWindow.show();
      desktopLoginWindow.focus();
    }
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
    focusMainWindow();
    const deepLink = commandLine.find((value) =>
      value.startsWith(`${DESKTOP_PROTOCOL}://`),
    );
    if (deepLink) void sendDeepLink(deepLink);
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    void sendDeepLink(url);
  });
  app.whenReady().then(async () => {
    app.setName(DESKTOP_APP_NAME);
    desktopLanguageMode = await readDesktopLanguageMode();
    desktopLanguage = await readDesktopLanguage();
    if (desktopLanguageMode === "system") {
      desktopLanguage = app.getLocale().toLowerCase().startsWith("tr")
        ? "tr"
        : "en";
    }
    installApplicationMenu();
    pendingDeepLink = findDesktopDeepLink();
    registerDesktopProtocol();
    registerIpc();
    const desktopPreferences = await readDesktopPreferences();
    void applyLaunchAtLogin(desktopPreferences.launchAtLogin);
    registerGlobalShortcut(desktopPreferences.globalShortcut);
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
    configureAutoUpdater((status: DesktopUpdateStatus) => {
      void appendDiagnosticEvent(`update-${status.state}`, {
        version: "version" in status ? status.version : undefined,
        message: "message" in status ? status.message : undefined,
      });
      if (status.state === "checking") {
        void showUpdateCheckWindow().catch(() => undefined);
      } else {
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
  });
  process.on("uncaughtExceptionMonitor", (error) => {
    void appendDiagnosticEvent("uncaught-exception", {
      message: error.message,
    });
  });
  process.on("unhandledRejection", (reason) => {
    void appendDiagnosticEvent("unhandled-rejection", { reason });
  });
  app.on("before-quit", () => {
    globalShortcut.unregisterAll();
    tray?.destroy();
    tray = null;
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
