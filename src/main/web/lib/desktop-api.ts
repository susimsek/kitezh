import type {
  ConsoleName,
  DesktopLanguageMode,
  DesktopUpdateStatus,
} from "@kitezh/shared/contracts";

export type DesktopConfig = {
  apiBaseUrl: string;
  protocol: string;
};

export type DesktopConsole = ConsoleName;
export type DesktopTokens = {
  accessToken: string;
  expiresAt: number;
  idToken: string | null;
  refreshToken: string | null;
  version: 1;
};
export type DesktopAuthCallback = { console: DesktopConsole; url: string; error?: string };
export type { DesktopLanguageMode, DesktopUpdateStatus };

export type DesktopPreferences = {
  launchAtLogin: boolean;
  showInMenuBar: boolean;
  showInDock: boolean;
  notifications: boolean;
  globalShortcut: string;
  automaticDownload: boolean;
};

export type DesktopDiagnostics = {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  apiHost: string;
  packaged: boolean;
  secureStorage: "available" | "unavailable";
  autoUpdatesSupported: boolean;
  events: string[];
};

let desktopConnectivity: "unknown" | "online" | "offline" = "unknown";

export class DesktopOfflineError extends Error {
  constructor() {
    super("The desktop application is offline; write requests are disabled.");
    this.name = "DesktopOfflineError";
  }
}

export type DesktopApi = {
  isDesktop: true;
  apiBaseUrl: string;
  protocol: string;
  auth: {
    startLogin: (request: {
      console: DesktopConsole;
      authorizationUrl: string;
      state: string;
      codeVerifier: string;
      clientId: string;
      redirectUri: string;
    }) => Promise<void>;
    getSession: (console: DesktopConsole) => Promise<DesktopTokens | null>;
    setSession: (console: DesktopConsole, tokens: DesktopTokens) => Promise<void>;
    clearSession: (console: DesktopConsole) => Promise<void>;
    clearAllSessions: () => Promise<void>;
    getStorageStatus: () => Promise<"available" | "unavailable">;
    openConsole: (consoleName: DesktopConsole) => Promise<void>;
  };
  getConfig: () => Promise<DesktopConfig>;
  getAppVersion: () => Promise<string>;
  preferences: {
    get: () => Promise<DesktopPreferences>;
    set: (value: Partial<DesktopPreferences>) => Promise<DesktopPreferences>;
    reset: () => Promise<DesktopPreferences>;
  };
  diagnostics: {
    get: () => Promise<DesktopDiagnostics>;
  };
  theme: {
    set: (value: "system" | "light" | "dark") => Promise<void>;
  };
  language: {
    get: () => Promise<"en" | "tr">;
    getMode: () => Promise<DesktopLanguageMode>;
    set: (value: "system" | "en" | "tr") => Promise<void>;
    onChanged: (listener: (locale: "en" | "tr") => void) => () => void;
  };
  settings: {
    close: () => Promise<void>;
    ready: () => Promise<void>;
  };
  companion: {
    openConsole: (consoleName: DesktopConsole) => Promise<void>;
  };
  updates: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
  };
  openExternal: (url: string) => Promise<void>;
  onAuthCallback: (listener: (callback: DesktopAuthCallback) => void) => () => void;
  onMenuLogout: (listener: () => void) => () => void;
};

declare global {
  interface Window {
    desktopApi?: DesktopApi;
  }
}

export function isDesktopRuntime() {
  return typeof window !== "undefined" && window.desktopApi?.isDesktop === true;
}

export function setDesktopConnectivity(online: boolean) {
  desktopConnectivity = online ? "online" : "offline";
  if (typeof document !== "undefined" && isDesktopRuntime()) {
    document.documentElement.dataset.desktopConnectivity = desktopConnectivity;
  }
}

export function isDesktopOffline() {
  return isDesktopRuntime() && desktopConnectivity === "offline";
}

export function assertDesktopOnline(method?: string) {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  if (isDesktopOffline() && !["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    throw new DesktopOfflineError();
  }
}

export function getApiUrl(pathOrUrl: string | URL) {
  const value = pathOrUrl.toString();
  if (/^(https?|app|kitezh):/i.test(value)) {
    const url = new URL(value);
    if (isLocalAssetUrl(url)) {
      const assetPath = `${url.pathname}${url.search}${url.hash}`;
      if (isDesktopRuntime() && window.desktopApi) {
        return new URL(assetPath, window.desktopApi.apiBaseUrl).toString();
      }
      if (typeof window !== "undefined") {
        return new URL(assetPath, window.location.origin).toString();
      }
    }
    return value;
  }
  if (!isDesktopRuntime() || !window.desktopApi) return value;
  return new URL(value, window.desktopApi.apiBaseUrl).toString();
}

function isLocalAssetUrl(url: URL) {
  return (
    ["localhost", "127.0.0.1", "kitezh.local"].includes(url.hostname) &&
    (url.pathname.startsWith("/avatars/") || url.pathname.startsWith("/brand/"))
  );
}

export async function loadDesktopConfig() {
  if (!isDesktopRuntime() || !window.desktopApi) return null;
  return window.desktopApi.getConfig();
}

export function apiUrl(pathOrUrl: string | URL) {
  return getApiUrl(pathOrUrl);
}

// Existing console components use the browser fetch API directly. The desktop renderer keeps
// those calls source-compatible while routing relative backend requests to Render.
if (typeof window !== "undefined" && isDesktopRuntime()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    try {
      assertDesktopOnline(method);
    } catch (error) {
      return Promise.reject(error);
    }
    if (typeof input === "string" || input instanceof URL) {
      return originalFetch(apiUrl(input), init);
    }
    return originalFetch(new Request(apiUrl(input.url), input), init);
  };
}
