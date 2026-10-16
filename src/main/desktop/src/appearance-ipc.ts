import type { IpcMain, IpcMainInvokeEvent } from "electron";
import type { ThemeMode } from "@kitezh/shared";

export type DesktopLanguage = "en" | "tr";
export type DesktopLanguageMode = DesktopLanguage | "system";

export interface DesktopAppearanceIpcDependencies {
  ipcMain: Pick<IpcMain, "handle">;
  assertTrustedSender(event: IpcMainInvokeEvent): void;
  applyTheme(theme: ThemeMode): void;
  persistTheme(theme: ThemeMode): void;
  getTheme(): ThemeMode;
  applyLanguage(language: unknown): Promise<void>;
  getLanguage(): DesktopLanguage;
  getLanguageMode(): DesktopLanguageMode;
}

export function registerDesktopAppearanceIpc({
  ipcMain,
  assertTrustedSender,
  applyTheme,
  persistTheme,
  getTheme,
  applyLanguage,
  getLanguage,
  getLanguageMode,
}: DesktopAppearanceIpcDependencies): void {
  ipcMain.handle("desktop:theme-set", (event, value: unknown) => {
    assertTrustedSender(event);
    const theme: ThemeMode =
      value === "light" || value === "dark" || value === "system"
        ? value
        : "system";
    applyTheme(theme);
    void persistTheme(theme);
  });
  ipcMain.handle("desktop:theme-get", (event) => {
    assertTrustedSender(event);
    return getTheme();
  });
  ipcMain.handle("desktop:language-set", async (event, value: unknown) => {
    assertTrustedSender(event);
    await applyLanguage(value);
  });
  ipcMain.handle("desktop:language-get", (event) => {
    assertTrustedSender(event);
    return getLanguage();
  });
  ipcMain.handle("desktop:language-mode-get", (event) => {
    assertTrustedSender(event);
    return getLanguageMode();
  });
}
