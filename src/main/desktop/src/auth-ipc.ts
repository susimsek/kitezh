import type { IpcMain, IpcMainInvokeEvent } from "electron";
import type {
  DesktopConsoleName,
  DesktopTokens,
  PendingAuthorization,
} from "./security/auth-flow";

type SessionVault = Partial<Record<DesktopConsoleName, DesktopTokens>>;
type ConsoleAssertion = (value: unknown) => asserts value is DesktopConsoleName;

export interface DesktopAuthIpcDependencies {
  ipcMain: Pick<IpcMain, "handle">;
  assertTrustedSender(event: IpcMainInvokeEvent): void;
  assertConsole(value: unknown): asserts value is DesktopConsoleName;
  pendingAuthorizations: Map<DesktopConsoleName, PendingAuthorization>;
  isPendingAuthorizationValid(
    pending: PendingAuthorization,
    state: string,
  ): boolean;
  createAuthorizationRequest(consoleName: DesktopConsoleName): {
    authorizationUrl: URL;
    pending: PendingAuthorization;
  };
  persistPendingAuthorizations(): Promise<void>;
  openExternal(url: string): Promise<void>;
  readVault(): Promise<SessionVault>;
  writeVault(vault: SessionVault): Promise<void>;
  setLogoutMenuVisible(visible: boolean): void;
  isEncryptionAvailable(): boolean;
  logoutDesktopSession(consoleName: DesktopConsoleName): Promise<void>;
  startNativeSocialLink(provider: unknown): Promise<unknown>;
}

export function registerDesktopAuthIpc({
  ipcMain,
  assertTrustedSender,
  assertConsole,
  pendingAuthorizations,
  isPendingAuthorizationValid,
  createAuthorizationRequest,
  persistPendingAuthorizations,
  openExternal,
  readVault,
  writeVault,
  setLogoutMenuVisible,
  isEncryptionAvailable,
  logoutDesktopSession,
  startNativeSocialLink,
}: DesktopAuthIpcDependencies): void {
  const validateConsole: ConsoleAssertion = assertConsole;
  ipcMain.handle(
    "desktop:auth-start-login",
    async (event, request: unknown) => {
      assertTrustedSender(event);
      if (typeof request !== "string") throw new Error("Invalid login request");
      validateConsole(request);
      const existing = pendingAuthorizations.get(request);
      if (existing && isPendingAuthorizationValid(existing, existing.state)) {
        throw new Error("Desktop authorization is already in progress");
      }
      const nativeRequest = createAuthorizationRequest(request);
      pendingAuthorizations.set(request, nativeRequest.pending);
      try {
        await persistPendingAuthorizations();
        await openExternal(nativeRequest.authorizationUrl.toString());
      } catch {
        pendingAuthorizations.delete(request);
        await persistPendingAuthorizations();
        throw new Error("Desktop authorization browser could not be opened");
      }
    },
  );

  ipcMain.handle(
    "desktop:auth-cancel-login",
    async (event, consoleName: unknown) => {
      assertTrustedSender(event);
      validateConsole(consoleName);
      pendingAuthorizations.delete(consoleName);
      await persistPendingAuthorizations();
    },
  );
  ipcMain.handle(
    "desktop:auth-has-session",
    async (event, consoleName: unknown) => {
      assertTrustedSender(event);
      validateConsole(consoleName);
      const vault = await readVault();
      return Boolean(vault[consoleName]);
    },
  );
  ipcMain.handle(
    "desktop:auth-clear-session",
    async (event, consoleName: unknown) => {
      assertTrustedSender(event);
      validateConsole(consoleName);
      const vault = await readVault();
      delete vault[consoleName];
      await writeVault(vault);
      setLogoutMenuVisible(Boolean(vault.admin || vault.account));
    },
  );
  ipcMain.handle("desktop:auth-clear-all-sessions", async (event) => {
    assertTrustedSender(event);
    await writeVault({});
    setLogoutMenuVisible(false);
  });
  ipcMain.handle("desktop:auth-storage-status", (event) => {
    assertTrustedSender(event);
    return isEncryptionAvailable() ? "available" : "unavailable";
  });
  ipcMain.handle("desktop:auth-logout", async (event, consoleName: unknown) => {
    assertTrustedSender(event);
    validateConsole(consoleName);
    await logoutDesktopSession(consoleName);
  });
  ipcMain.handle(
    "desktop:social-link-start",
    async (event, provider: unknown) => {
      assertTrustedSender(event);
      return startNativeSocialLink(provider);
    },
  );
}
