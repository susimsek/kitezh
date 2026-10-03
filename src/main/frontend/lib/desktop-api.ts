export type DesktopConfig = {
  apiBaseUrl: string;
  protocol: string;
};

export type DesktopConsole = "admin" | "account";
export type DesktopTokens = {
  accessToken: string;
  expiresAt: number;
  idToken: string | null;
  refreshToken: string | null;
  version: 1;
};
export type DesktopAuthCallback = { console: DesktopConsole; url: string; error?: string };

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
  };
  getConfig: () => Promise<DesktopConfig>;
  getAppVersion: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  onAuthCallback: (listener: (callback: DesktopAuthCallback) => void) => () => void;
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
  if (/^(https?|app|springauth):/i.test(value)) return value;
  if (!isDesktopRuntime() || !window.desktopApi) return value;
  return new URL(value, window.desktopApi.apiBaseUrl).toString();
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
