import { contextBridge, ipcRenderer } from "electron";

const config = ipcRenderer.sendSync("desktop:config-sync") as {
  apiBaseUrl: string;
  protocol: string;
};

contextBridge.exposeInMainWorld("desktopApi", {
  isDesktop: true,
  apiBaseUrl: config.apiBaseUrl,
  protocol: config.protocol,
  auth: {
    startLogin: (request: unknown) =>
      ipcRenderer.invoke("desktop:auth-start-login", request),
    getSession: (consoleName: unknown) =>
      ipcRenderer.invoke("desktop:auth-get-session", consoleName),
    setSession: (consoleName: unknown, tokens: unknown) =>
      ipcRenderer.invoke("desktop:auth-set-session", consoleName, tokens),
    clearSession: (consoleName: unknown) =>
      ipcRenderer.invoke("desktop:auth-clear-session", consoleName),
    clearAllSessions: () =>
      ipcRenderer.invoke("desktop:auth-clear-all-sessions"),
    getStorageStatus: () => ipcRenderer.invoke("desktop:auth-storage-status"),
  },
  getConfig: () => ipcRenderer.invoke("desktop:config"),
  getAppVersion: () => ipcRenderer.invoke("desktop:app-version"),
  preferences: {
    get: () => ipcRenderer.invoke("desktop:preferences-get"),
    set: (value: unknown) =>
      ipcRenderer.invoke("desktop:preferences-set", value),
  },
  diagnostics: {
    get: () => ipcRenderer.invoke("desktop:diagnostics-get"),
  },
  theme: {
    set: (value: unknown) => ipcRenderer.invoke("desktop:theme-set", value),
  },
  language: {
    set: (value: unknown) => ipcRenderer.invoke("desktop:language-set", value),
  },
  settings: {
    close: () => ipcRenderer.invoke("desktop:settings-close"),
    ready: () => ipcRenderer.invoke("desktop:settings-ready"),
  },
  companion: {
    openConsole: (consoleName: unknown) =>
      ipcRenderer.invoke("desktop:companion-open-console", consoleName),
  },
  updates: {
    check: () => ipcRenderer.invoke("desktop:update-check"),
    download: () => ipcRenderer.invoke("desktop:update-download"),
    install: () => ipcRenderer.invoke("desktop:update-install"),
    onStatus: (listener: (status: unknown) => void) => {
      const callback = (_event: Electron.IpcRendererEvent, status: unknown) =>
        listener(status);
      ipcRenderer.on("desktop:update-status", callback);
      return () =>
        ipcRenderer.removeListener("desktop:update-status", callback);
    },
  },
  openExternal: (url: string) =>
    ipcRenderer.invoke("desktop:open-external", url),
  onAuthCallback: (
    listener: (callback: {
      console: "admin" | "account";
      url: string;
      error?: string;
    }) => void,
  ) => {
    const callback = (
      _event: Electron.IpcRendererEvent,
      value: { console: "admin" | "account"; url: string; error?: string },
    ) => listener(value);
    ipcRenderer.on("desktop:auth-callback", callback);
    return () => ipcRenderer.removeListener("desktop:auth-callback", callback);
  },
  onMenuLogout: (listener: () => void) => {
    const callback = () => listener();
    ipcRenderer.on("desktop:menu-logout", callback);
    return () => ipcRenderer.removeListener("desktop:menu-logout", callback);
  },
});
