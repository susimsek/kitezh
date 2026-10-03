import type { ConsoleKind, StoredConsoleTokens } from "./console-auth-types";
import { isDesktopRuntime } from "./desktop-api";

/** Renderer-side adapter for the main-process, OS-protected Electron session vault. */
export class ElectronSessionAdapter {
  async read(consoleKind: ConsoleKind): Promise<StoredConsoleTokens | null> {
    if (!isDesktopRuntime() || !window.desktopApi) return null;
    return window.desktopApi.auth.getSession(consoleKind);
  }

  async write(consoleKind: ConsoleKind, tokens: StoredConsoleTokens) {
    if (!isDesktopRuntime() || !window.desktopApi) return;
    await window.desktopApi.auth.setSession(consoleKind, tokens);
  }

  async clear(consoleKind: ConsoleKind) {
    if (!isDesktopRuntime() || !window.desktopApi) return;
    await window.desktopApi.auth.clearSession(consoleKind);
  }

  async clearAll() {
    if (!isDesktopRuntime() || !window.desktopApi) return;
    await window.desktopApi.auth.clearAllSessions();
  }
}

export const electronSessionAdapter = new ElectronSessionAdapter();
