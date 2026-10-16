import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DesktopPreferences } from "./preferences-ipc";

export type DesktopLanguage = "en" | "tr";
export type DesktopLanguageMode = DesktopLanguage | "system";

export interface DesktopSettingsStoreOptions {
  userDataPath(): string;
  appDataPath(): string;
  appPath(): string;
  platform: NodeJS.Platform;
  appName: string;
  execPath: string;
  defaultApp: boolean;
  getLoginItemSettings(): { openAtLogin: boolean };
  setLoginItemSettings(settings: {
    openAtLogin: boolean;
    args: string[];
  }): void;
}

export function createDesktopSettingsStore({
  userDataPath,
  appDataPath,
  appPath,
  platform,
  appName,
  execPath,
  defaultApp,
  getLoginItemSettings,
  setLoginItemSettings,
}: DesktopSettingsStoreOptions) {
  const preferencesFile = () =>
    path.join(userDataPath(), "desktop-preferences.json");
  const languageFile = () => path.join(userDataPath(), "desktop-language.json");
  const languageModeFile = () =>
    path.join(userDataPath(), "desktop-language-mode.json");
  const autostartFile = () =>
    path.join(appDataPath(), "autostart", "kitezh.desktop");

  async function writePrivateFile(file: string, value: string) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value, { encoding: "utf8", mode: 0o600 });
  }

  function launchAtLoginEnabled() {
    return platform === "linux"
      ? existsSync(autostartFile())
      : getLoginItemSettings().openAtLogin;
  }

  function defaultDesktopPreferences(
    defaultGlobalShortcut: string,
  ): DesktopPreferences {
    return {
      launchAtLogin: launchAtLoginEnabled(),
      showInMenuBar: true,
      showInDock: true,
      notifications: true,
      globalShortcut: defaultGlobalShortcut,
    };
  }

  async function readDesktopPreferences(
    defaults: DesktopPreferences,
  ): Promise<DesktopPreferences> {
    try {
      const value = JSON.parse(
        await readFile(preferencesFile(), "utf8"),
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
    await writePrivateFile(preferencesFile(), JSON.stringify(preferences));
  }

  async function readDesktopLanguage(
    fallback: DesktopLanguage,
  ): Promise<DesktopLanguage> {
    try {
      return (await readFile(languageFile(), "utf8")).trim() === "tr"
        ? "tr"
        : "en";
    } catch {
      return fallback;
    }
  }

  async function writeDesktopLanguage(language: DesktopLanguage) {
    await writePrivateFile(languageFile(), language);
  }

  async function readDesktopLanguageMode(): Promise<DesktopLanguageMode> {
    try {
      const normalized = (await readFile(languageModeFile(), "utf8")).trim();
      return normalized === "tr" || normalized === "en" ? normalized : "system";
    } catch {
      return "system";
    }
  }

  async function writeDesktopLanguageMode(mode: DesktopLanguageMode) {
    await writePrivateFile(languageModeFile(), mode);
  }

  async function applyLaunchAtLogin(enabled: boolean) {
    if (platform === "linux") {
      if (!enabled) {
        await rm(autostartFile(), { force: true });
        return;
      }
      const entry = [
        "[Desktop Entry]",
        "Type=Application",
        `Name=${appName}`,
        `Exec=\"${execPath}\"`,
        "Hidden=false",
        "NoDisplay=false",
        "X-GNOME-Autostart-enabled=true",
        "",
      ].join("\n");
      await writePrivateFile(autostartFile(), entry);
      return;
    }
    setLoginItemSettings({
      openAtLogin: enabled,
      args: defaultApp ? [appPath()] : [],
    });
  }

  return {
    launchAtLoginEnabled,
    defaultDesktopPreferences,
    readDesktopPreferences,
    writeDesktopPreferences,
    readDesktopLanguage,
    writeDesktopLanguage,
    readDesktopLanguageMode,
    writeDesktopLanguageMode,
    applyLaunchAtLogin,
  };
}
