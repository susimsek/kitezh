import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";

export interface DesktopRuntimeInfoIpcDependencies {
  ipcMain: Pick<IpcMain, "on" | "handle">;
  isTrustedRendererFrame(url: string | undefined): boolean;
  assertTrustedSender(event: IpcMainInvokeEvent): void;
  getApiBaseUrl(): string;
  protocol: string;
  getAppVersion(): string;
  getOs(): string;
  getAppStatus(): { isPackaged: boolean };
  getProcessStatus(): {
    versions: NodeJS.ProcessVersions;
    platform: NodeJS.Platform;
    architecture: string;
    environment: NodeJS.ProcessEnv;
  };
  isSecureStorageAvailable(): boolean;
  readDiagnosticEvents(): Promise<unknown>;
  isAllowedExternalUrl(value: string): boolean;
  openExternal(url: string): Promise<void>;
}

function createDesktopConfig(
  getApiBaseUrl: () => string,
  protocol: string,
  getAppVersion: () => string,
  getOs: () => string,
) {
  return {
    apiBaseUrl: getApiBaseUrl(),
    protocol,
    appVersion: getAppVersion(),
    os: getOs(),
  };
}

export function registerDesktopRuntimeInfoIpc({
  ipcMain,
  isTrustedRendererFrame,
  assertTrustedSender,
  getApiBaseUrl,
  protocol,
  getAppVersion,
  getOs,
  getAppStatus,
  getProcessStatus,
  isSecureStorageAvailable,
  readDiagnosticEvents,
  isAllowedExternalUrl,
  openExternal,
}: DesktopRuntimeInfoIpcDependencies): void {
  ipcMain.on("desktop:config-sync", (event: IpcMainEvent) => {
    if (!isTrustedRendererFrame(event.senderFrame?.url)) {
      event.returnValue = null;
      return;
    }
    event.returnValue = createDesktopConfig(
      getApiBaseUrl,
      protocol,
      getAppVersion,
      getOs,
    );
  });
  ipcMain.handle("desktop:config", (event) => {
    assertTrustedSender(event);
    return createDesktopConfig(getApiBaseUrl, protocol, getAppVersion, getOs);
  });
  ipcMain.handle("desktop:open-external", async (event, value: unknown) => {
    assertTrustedSender(event);
    if (typeof value !== "string" || !isAllowedExternalUrl(value)) {
      throw new Error("External URL is not allowed");
    }
    await openExternal(new URL(value).toString());
  });
  ipcMain.handle("desktop:app-version", (event) => {
    assertTrustedSender(event);
    return getAppVersion();
  });
  ipcMain.handle("desktop:diagnostics-get", async (event) => {
    assertTrustedSender(event);
    const appStatus = getAppStatus();
    const processStatus = getProcessStatus();
    let apiHost = "unknown";
    try {
      apiHost = new URL(getApiBaseUrl()).host;
    } catch {
      // Keep diagnostics safe when the configured API origin is unavailable.
    }
    return {
      appVersion: getAppVersion(),
      electronVersion: processStatus.versions.electron,
      chromeVersion: processStatus.versions.chrome,
      nodeVersion: processStatus.versions.node,
      platform: processStatus.platform,
      architecture: processStatus.architecture,
      apiHost,
      packaged: appStatus.isPackaged,
      secureStorage: isSecureStorageAvailable()
        ? "available"
        : "unavailable",
      autoUpdatesSupported:
        appStatus.isPackaged &&
        processStatus.environment.DESKTOP_AUTO_UPDATE !== "false" &&
        (processStatus.platform !== "linux" ||
          Boolean(processStatus.environment.APPIMAGE)),
      events: await readDiagnosticEvents(),
    };
  });
}
