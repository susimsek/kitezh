import type { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

type MainWindowState = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
};

type MainWindowLike = BrowserWindow;

type MainWindowDependencies = {
  createWindow: (options: BrowserWindowConstructorOptions) => MainWindowLike;
  preloadPath: string;
  state: MainWindowState | null;
  hasStoredSession: boolean;
  backgroundE2e: boolean;
  backgroundColor: string;
  rendererUrl: string;
  isAllowedExternalUrl: (value: string) => boolean;
  openExternal: (value: string) => void;
  isTrustedRendererUrl: (value: string) => boolean;
  saveWindowState: (window: MainWindowLike) => void;
  appendDiagnosticEvent: (
    name: string,
    details?: Record<string, unknown>,
  ) => void;
  showWindow: (window: MainWindowLike) => void;
  openLogin: () => void;
  pendingDeepLink: string | null;
  sendDeepLink: (value: string) => void;
  onClosed: (window: MainWindowLike) => void;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
};

export function buildMainWindowOptions({
  preloadPath,
  state,
  hasStoredSession,
  backgroundE2e,
  backgroundColor,
}: Pick<
  MainWindowDependencies,
  | "preloadPath"
  | "state"
  | "hasStoredSession"
  | "backgroundE2e"
  | "backgroundColor"
>): BrowserWindowConstructorOptions {
  return {
    x: state?.x,
    y: state?.y,
    width: state?.width ?? 1440,
    height: state?.height ?? 960,
    minWidth: 640,
    minHeight: 640,
    show: hasStoredSession && !backgroundE2e,
    backgroundColor,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundE2e,
      preload: preloadPath,
    },
  };
}

export function createDesktopMainWindow({
  createWindow,
  preloadPath,
  state,
  hasStoredSession,
  backgroundE2e,
  backgroundColor,
  rendererUrl,
  isAllowedExternalUrl,
  openExternal,
  isTrustedRendererUrl,
  saveWindowState,
  appendDiagnosticEvent,
  showWindow,
  openLogin,
  pendingDeepLink,
  sendDeepLink,
  onClosed,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: MainWindowDependencies): MainWindowLike {
  const window = createWindow(
    buildMainWindowOptions({
      preloadPath,
      state,
      hasStoredSession,
      backgroundE2e,
      backgroundColor,
    }),
  );
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleWindowStateSave = () => {
    if (saveTimer) clearTimer(saveTimer);
    saveTimer = setTimer(() => saveWindowState(window), 250);
  };
  window.on("resize", scheduleWindowStateSave);
  window.on("move", scheduleWindowStateSave);
  window.on("maximize", scheduleWindowStateSave);
  window.on("unmaximize", scheduleWindowStateSave);
  window.on("close", () => {
    if (saveTimer) clearTimer(saveTimer);
    saveWindowState(window);
  });
  window.on("unresponsive", () => appendDiagnosticEvent("window-unresponsive"));
  window.on("responsive", () => appendDiagnosticEvent("window-responsive"));
  window.webContents.on("render-process-gone", (_event, details) => {
    appendDiagnosticEvent("renderer-process-gone", {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });
  void window.loadURL(rendererUrl);
  window.on("closed", () => onClosed(window));
  if (state?.maximized) window.maximize();
  if (hasStoredSession) {
    window.webContents.once("did-finish-load", () => showWindow(window));
  } else {
    openLogin();
  }
  if (pendingDeepLink) {
    window.webContents.once("did-finish-load", () =>
      sendDeepLink(pendingDeepLink),
    );
  }
  return window;
}
