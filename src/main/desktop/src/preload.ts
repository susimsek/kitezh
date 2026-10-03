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
});
