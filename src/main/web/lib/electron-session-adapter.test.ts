import type { DesktopApi } from "./desktop-api";
import { ElectronSessionAdapter } from "./electron-session-adapter";
import type { StoredConsoleTokens } from "./console-auth-types";

describe("ElectronSessionAdapter", () => {
  const adapter = new ElectronSessionAdapter();
  const tokens = {
    accessToken: "access",
    expiresAt: 10,
    idToken: null,
    refreshToken: "refresh",
    version: 1 as const,
  } satisfies StoredConsoleTokens;
  const api = {
    isDesktop: true,
    auth: {
      getSession: jest.fn(async () => tokens),
      setSession: jest.fn(async () => undefined),
      clearSession: jest.fn(async () => undefined),
      clearAllSessions: jest.fn(async () => undefined),
    },
  } as unknown as DesktopApi;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, "desktopApi", {
      configurable: true,
      value: undefined,
    });
  });

  it("keeps browser sessions unavailable outside Electron", async () => {
    await expect(adapter.read("admin")).resolves.toBeNull();
    await expect(adapter.write("admin", tokens)).resolves.toBeUndefined();
    await expect(adapter.clear("admin")).resolves.toBeUndefined();
    await expect(adapter.clearAll()).resolves.toBeUndefined();
  });

  it("delegates session operations to the desktop main-process bridge", async () => {
    Object.defineProperty(window, "desktopApi", { configurable: true, value: api });

    await expect(adapter.read("account")).resolves.toBe(tokens);
    await adapter.write("account", tokens);
    await adapter.clear("account");
    await adapter.clearAll();

    expect(api.auth.getSession).toHaveBeenCalledWith("account");
    expect(api.auth.setSession).toHaveBeenCalledWith("account", tokens);
    expect(api.auth.clearSession).toHaveBeenCalledWith("account");
    expect(api.auth.clearAllSessions).toHaveBeenCalledTimes(1);
  });
});
