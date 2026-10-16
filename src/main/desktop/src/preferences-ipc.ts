import type { IpcMain, IpcMainInvokeEvent } from "electron";

export type UpdatePreferences = {
  skippedVersion?: string;
  remindUntil?: number;
  automaticDownload?: boolean;
};

export type DesktopPreferences = {
  launchAtLogin: boolean;
  showInMenuBar: boolean;
  showInDock: boolean;
  notifications: boolean;
  globalShortcut: string;
};

export interface DesktopPreferencesIpcDependencies {
  ipcMain: Pick<IpcMain, "handle">;
  assertTrustedSender(event: IpcMainInvokeEvent): void;
  readDesktopPreferences(): Promise<DesktopPreferences>;
  writeDesktopPreferences(preferences: DesktopPreferences): Promise<void>;
  readUpdatePreferences(): Promise<UpdatePreferences>;
  writeUpdatePreferences(preferences: UpdatePreferences): Promise<void>;
  applyLaunchAtLogin(enabled: boolean): Promise<void>;
  setTrayVisibility(visible: boolean): void;
  setDockVisibility(visible: boolean): void;
  registerGlobalShortcut(accelerator: string): boolean;
  isValidGlobalShortcut(accelerator: string): boolean;
  setAutomaticInstallOnAppQuit(enabled: boolean): void;
  platform: NodeJS.Platform;
  defaultGlobalShortcut: string;
}

export function registerDesktopPreferencesIpc({
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
  platform,
  defaultGlobalShortcut,
}: DesktopPreferencesIpcDependencies): void {
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
    if (!value || typeof value !== "object") {
      throw new Error("Invalid desktop preferences");
    }
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
    if (platform === "darwin" && !next.showInMenuBar && !next.showInDock) {
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
      globalShortcut: defaultGlobalShortcut,
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
}
