import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useConsoleAuth } from "./console-auth";
import { codeChallenge } from "./console-auth-crypto";
import { isDesktopRuntime, type DesktopAuthCallback } from "./desktop-api";
import {
  readAndRemoveTransaction,
  readPersistedTokens,
  removePersistedTokens,
  persistTokens,
  storeTransaction,
} from "./console-auth-storage";

jest.mock("axios", () => ({
  __esModule: true,
  default: { post: jest.fn(), isAxiosError: jest.fn() },
}));
jest.mock("@/store/hooks", () => ({ useAppDispatch: jest.fn(), useAppSelector: jest.fn() }));
jest.mock("./console-auth-storage", () => ({
  clearStoredTransactions: jest.fn(),
  readAndRemoveTransaction: jest.fn(),
  readPersistedTokens: jest.fn(),
  removeAllPersistedTokens: jest.fn(),
  removePersistedTokens: jest.fn(),
  persistTokens: jest.fn(),
  storeTransaction: jest.fn(),
}));
jest.mock("./console-auth-crypto", () => ({
  codeChallenge: jest.fn().mockResolvedValue("challenge"),
  decodeJwt: (token?: string) => {
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  },
  ensureOpenIdScope: (scope: string) => (scope.includes("openid") ? scope : `openid ${scope}`),
  randomValue: jest.fn().mockReturnValue("random-value"),
}));
jest.mock("./desktop-api", () => ({
  apiUrl: (path: string) => path,
  isDesktopRuntime: jest.fn(() => false),
}));
jest.mock("./client-metadata", () => ({ getClientMetadataHeaders: () => ({}) }));

const dispatch = jest.fn();
const mockDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockReadTokens = readPersistedTokens as jest.MockedFunction<typeof readPersistedTokens>;
const mockTransaction = readAndRemoveTransaction as jest.MockedFunction<
  typeof readAndRemoveTransaction
>;
let desktopAuthCallback: ((callback: DesktopAuthCallback) => void) | undefined;

const config = {
  clientId: "web-client",
  scope: "profile",
  transactionKey: "ADMIN_OIDC_TRANSACTION",
  redirectPath: (locale: "en" | "tr") => `/${locale}/callback`,
  postLogoutRedirectPath: (locale: "en" | "tr") => `/${locale}/logout`,
};

function jwt(payload: object) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: jwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "user-1" }),
    expires_in: 3600,
    id_token: jwt({ nonce: "nonce-1", sub: "user-1" }),
    refresh_token: "refresh-1",
    ...overrides,
  };
}

function storedTokens(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: jwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "user-1" }),
    expiresAt: Date.now() + 3600_000,
    idToken: jwt({ nonce: "nonce-1", sub: "user-1" }),
    refreshToken: "refresh-1",
    version: 1 as const,
    ...overrides,
  };
}

function useDesktopRuntime() {
  const api = {
    apiBaseUrl: "https://kitezh.example",
    auth: {
      getStorageStatus: jest.fn().mockResolvedValue("available"),
      startLogin: jest.fn().mockResolvedValue(undefined),
    },
    onAuthCallback: jest.fn((callback: (event: DesktopAuthCallback) => void) => {
      desktopAuthCallback = callback;
      return jest.fn();
    }),
  };
  Object.defineProperty(window, "desktopApi", { configurable: true, value: api });
  (isDesktopRuntime as jest.Mock).mockReturnValue(true);
  return api;
}

describe("useConsoleAuth token lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Reflect.deleteProperty(window, "desktopApi");
    desktopAuthCallback = undefined;
    (isDesktopRuntime as jest.Mock).mockReturnValue(false);
    (persistTokens as jest.MockedFunction<typeof persistTokens>).mockResolvedValue(undefined);
    (removePersistedTokens as jest.MockedFunction<typeof removePersistedTokens>).mockResolvedValue(
      undefined,
    );
    mockDispatch.mockReturnValue(dispatch);
    mockSelector.mockImplementation((selector) =>
      selector({
        auth: {
          admin: {
            accessToken: null,
            idToken: null,
            expiresAt: null,
            authenticated: false,
            initialized: false,
            subject: null,
            tokenParsed: null,
            idTokenParsed: null,
            refreshTokenParsed: null,
            isLoggingOut: false,
          },
        },
      } as never),
    );
    mockReadTokens.mockResolvedValue(null);
    mockAxios.isAxiosError.mockReturnValue(false);
    mockAxios.post.mockReset();
  });

  it("initializes an empty session when no persisted token set exists", async () => {
    renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: "auth/setConsoleInitialized",
        payload: { console: "admin", initialized: true },
      }),
    );
  });

  it("hydrates and persists a restored token set", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens());
    renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "auth/applyConsoleToken",
          payload: expect.objectContaining({ console: "admin", subject: "user-1" }),
        }),
      ),
    );
    expect(persistTokens).toHaveBeenCalledWith(
      "admin",
      expect.objectContaining({
        accessToken: expect.stringContaining("header."),
        refreshToken: "refresh-1",
      }),
    );
  });

  it("refreshes an expiring token and reuses the returned token for concurrent callers", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens({ expiresAt: Date.now() - 1 }));
    let finishRefresh!: (value: { data: ReturnType<typeof tokenResponse> }) => void;
    mockAxios.post.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRefresh = resolve;
      }) as never,
    );
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());
    let refreshOne!: Promise<string | null>;
    let refreshTwo!: Promise<string | null>;
    act(() => {
      refreshOne = result.current.refreshAccessToken(-1);
      refreshTwo = result.current.refreshAccessToken(-1);
    });
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    await act(async () => finishRefresh({ data: tokenResponse() }));
    await expect(Promise.all([refreshOne, refreshTwo])).resolves.toEqual([
      expect.stringContaining("header."),
      expect.stringContaining("header."),
    ]);
  });

  it("clears the session after a permanent refresh failure but retains a still-valid token on network errors", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens({ expiresAt: Date.now() - 1 }));
    mockAxios.post.mockRejectedValueOnce({ response: { status: 401 } });
    mockAxios.isAxiosError.mockReturnValue(true);
    const first = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());
    await expect(first.result.current.refreshAccessToken(-1)).resolves.toBeNull();
    expect(removePersistedTokens).toHaveBeenCalledWith("admin");
    first.unmount();

    jest.clearAllMocks();
    mockDispatch.mockReturnValue(dispatch);
    mockSelector.mockImplementation((selector) => selector({ auth: { admin: {} } } as never));
    mockReadTokens.mockResolvedValueOnce(storedTokens());
    mockAxios.isAxiosError.mockReturnValue(false);
    mockAxios.post.mockRejectedValueOnce(new Error("offline"));
    const second = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());
    await expect(second.result.current.refreshAccessToken(-1)).resolves.toEqual(
      expect.stringContaining("header."),
    );
  });

  it("returns no access token when a transient refresh error leaves the current token expired", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens({ expiresAt: Date.now() - 1 }));
    mockAxios.post.mockRejectedValueOnce(new Error("network unavailable"));
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());

    await expect(result.current.refreshAccessToken(-1)).resolves.toBeNull();
    expect(removePersistedTokens).not.toHaveBeenCalled();
  });

  it("keeps the existing ID and refresh tokens when a refresh response omits them", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens({ expiresAt: Date.now() - 1 }));
    const nextAccessToken = jwt({ sub: "user-1" });
    mockAxios.post.mockResolvedValueOnce({
      data: { access_token: nextAccessToken, expires_in: 90 },
    } as never);
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());

    await expect(result.current.refreshAccessToken(-1)).resolves.toBe(nextAccessToken);
    expect(persistTokens).toHaveBeenLastCalledWith(
      "admin",
      expect.objectContaining({
        accessToken: nextAccessToken,
        idToken: expect.any(String),
        refreshToken: "refresh-1",
      }),
    );
  });

  it("initializes cleanly when reading the persisted token set fails", async () => {
    mockReadTokens.mockRejectedValueOnce(new Error("storage unavailable"));
    renderHook(() => useConsoleAuth(config, "admin"));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: "auth/setConsoleInitialized",
        payload: { console: "admin", initialized: true },
      }),
    );
  });

  it("ignores a refresh response after the local session is cleared", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens({ expiresAt: Date.now() - 1 }));
    let finishRefresh!: (value: { data: ReturnType<typeof tokenResponse> }) => void;
    mockAxios.post.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRefresh = resolve;
      }) as never,
    );
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());
    const appliedTokensBeforeRefresh = dispatch.mock.calls.filter(
      ([action]) => action.type === "auth/applyConsoleToken",
    ).length;

    let pendingRefresh!: Promise<string | null>;
    act(() => {
      pendingRefresh = result.current.refreshAccessToken(-1);
      result.current.clearLocalSession();
    });
    await act(async () => finishRefresh({ data: tokenResponse() }));

    await expect(pendingRefresh).resolves.toBeNull();
    expect(
      dispatch.mock.calls.filter(([action]) => action.type === "auth/applyConsoleToken"),
    ).toHaveLength(appliedTokensBeforeRefresh);
  });

  it("does not refresh when the restored session has no refresh token", async () => {
    mockReadTokens.mockResolvedValueOnce(storedTokens({ refreshToken: null }));
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(persistTokens).toHaveBeenCalled());

    await expect(result.current.refreshAccessToken(-1)).resolves.toBeNull();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it("exchanges a valid callback once and rejects missing or mismatched transactions", async () => {
    mockTransaction.mockReturnValueOnce({
      codeVerifier: "verifier",
      expires: Date.now() + 1000,
      nonce: "nonce-1",
      redirectUri: "https://kitezh.example/en/callback",
      returnTo: "/admin/users",
      state: "state-1",
    });
    mockAxios.post.mockResolvedValueOnce({ data: tokenResponse() } as never);
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    await expect(result.current.completeAuthorization("auth-code", "state-1")).resolves.toBe(
      "/admin/users",
    );
    expect(mockAxios.post).toHaveBeenCalledWith(
      "/oauth2/token",
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
    expect(mockTransaction).toHaveBeenCalledWith(config, "state-1");

    mockTransaction.mockReturnValueOnce(null);
    await expect(result.current.completeAuthorization("bad-code", "missing")).rejects.toThrow(
      "Missing authorization transaction",
    );
  });

  it("clears the local session when an authorization callback has the wrong nonce", async () => {
    mockTransaction.mockReturnValueOnce({
      codeVerifier: "verifier",
      expires: Date.now() + 1000,
      nonce: "expected-nonce",
      redirectUri: "https://kitezh.example/en/callback",
      returnTo: "/admin/users",
      state: "state-1",
    });
    mockAxios.post.mockResolvedValueOnce({
      data: tokenResponse({ id_token: jwt({ nonce: "unexpected-nonce", sub: "user-1" }) }),
    } as never);
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    await expect(result.current.completeAuthorization("auth-code", "state-1")).rejects.toThrow(
      "Invalid nonce",
    );
    expect(removePersistedTokens).toHaveBeenCalledWith("admin");
    expect(dispatch).toHaveBeenCalledWith({
      type: "auth/clearConsoleAuth",
      payload: { console: "admin", loggingOut: false },
    });
  });

  it("releases callback transaction state when the authorization-code exchange fails", async () => {
    mockTransaction.mockReturnValueOnce({
      codeVerifier: "verifier",
      expires: Date.now() + 1000,
      nonce: "nonce-1",
      redirectUri: "https://kitezh.example/en/callback",
      returnTo: "/admin/users",
      state: "state-1",
    });
    mockAxios.post.mockRejectedValueOnce(new Error("token endpoint unavailable"));
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    await expect(result.current.completeAuthorization("auth-code", "state-1")).rejects.toThrow(
      "token endpoint unavailable",
    );
    expect(mockTransaction).toHaveBeenCalledWith(config, "state-1");
  });

  it("rejects an authorization-code response after the local session is cleared", async () => {
    mockTransaction.mockReturnValueOnce({
      codeVerifier: "verifier",
      expires: Date.now() + 1000,
      nonce: "nonce-1",
      redirectUri: "https://kitezh.example/en/callback",
      returnTo: "/admin/users",
      state: "state-1",
    });
    let finishExchange!: (value: { data: ReturnType<typeof tokenResponse> }) => void;
    mockAxios.post.mockReturnValueOnce(
      new Promise((resolve) => {
        finishExchange = resolve;
      }) as never,
    );
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    let pendingExchange!: Promise<string>;
    act(() => {
      pendingExchange = result.current.completeAuthorization("auth-code", "state-1");
      result.current.clearLocalSession();
    });
    const rejectedExchange = expect(pendingExchange).rejects.toThrow("Authorization was cancelled");
    await act(async () => finishExchange({ data: tokenResponse() }));

    await rejectedExchange;
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "auth/applyConsoleToken" }),
    );
  });

  it("starts one PKCE authorization and stores the localized return path", async () => {
    const desktopApi = useDesktopRuntime();
    const authConfig = {
      ...config,
      desktopClientId: "desktop-client",
      postLoginReturnToKey: "admin-return-to",
    };
    const { result } = renderHook(() => useConsoleAuth(authConfig, "admin"));

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    await act(async () => {
      await Promise.all([
        result.current.beginAuthorization("tr", "/admin/users"),
        result.current.beginAuthorization("tr", "/admin/users"),
      ]);
    });

    expect(desktopApi.auth.startLogin).toHaveBeenCalledTimes(1);
    expect(storeTransaction).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("admin-return-to")).toBe("/admin/users");
    const authorizationUrl = new URL(desktopApi.auth.startLogin.mock.calls[0][0].authorizationUrl);
    expect(authorizationUrl.pathname).toBe("/oauth2/authorize");
    expect(authorizationUrl.searchParams.get("client_id")).toBe("desktop-client");
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid profile");
    expect(authorizationUrl.searchParams.get("ui_locales")).toBe("tr");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("removes the saved authorization transaction when PKCE setup fails", async () => {
    useDesktopRuntime();
    (codeChallenge as jest.MockedFunction<typeof codeChallenge>).mockRejectedValueOnce(
      new Error("crypto unavailable"),
    );
    const authConfig = { ...config, postLoginReturnToKey: "admin-return-to" };
    const { result } = renderHook(() => useConsoleAuth(authConfig, "admin"));

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    await expect(result.current.beginAuthorization("en", "/admin/users")).rejects.toThrow(
      "crypto unavailable",
    );
    expect(mockTransaction).toHaveBeenCalledWith(authConfig, "random-value");
    expect(sessionStorage.getItem("admin-return-to")).toBeNull();
  });

  it("rejects desktop authorization when secure token storage is unavailable", async () => {
    const desktopApi = useDesktopRuntime();
    desktopApi.auth.getStorageStatus.mockResolvedValueOnce("unavailable");
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    await expect(result.current.beginAuthorization("en", "/admin/users")).rejects.toThrow(
      "Secure desktop storage is unavailable",
    );
    expect(storeTransaction).not.toHaveBeenCalled();
    expect(desktopApi.auth.startLogin).not.toHaveBeenCalled();
  });

  it("completes a desktop callback from the persisted token set", async () => {
    useDesktopRuntime();
    mockReadTokens.mockResolvedValue(storedTokens());
    mockTransaction.mockReturnValueOnce({
      codeVerifier: "verifier",
      expires: Date.now() + 1000,
      nonce: "nonce-1",
      redirectUri: "kitezh://oauth/callback",
      returnTo: "/admin/users",
      state: "desktop-state",
    });
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    await expect(result.current.completeAuthorization("", "desktop-state")).resolves.toBe(
      "/admin/users",
    );
    expect(mockAxios.post).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledWith(config, "desktop-state");
  });

  it("rejects a desktop callback when its persisted token set is missing", async () => {
    useDesktopRuntime();
    mockReadTokens.mockResolvedValue(null);
    mockTransaction.mockReturnValueOnce({
      codeVerifier: "verifier",
      expires: Date.now() + 1000,
      nonce: "nonce-1",
      redirectUri: "kitezh://oauth/callback",
      returnTo: "/admin/users",
      state: "desktop-state",
    });
    const { result } = renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());

    await expect(result.current.completeAuthorization("", "desktop-state")).rejects.toThrow(
      "Missing desktop session",
    );
    expect(mockTransaction).toHaveBeenCalledWith(config, "desktop-state");
  });

  it("ignores desktop callbacks for other consoles and callbacks without a state", async () => {
    const desktopApi = useDesktopRuntime();
    renderHook(() => useConsoleAuth(config, "admin"));
    await waitFor(() => expect(desktopApi.onAuthCallback).toHaveBeenCalled());

    act(() =>
      desktopAuthCallback?.({
        console: "account",
        url: "kitezh://oauth/callback?code=wrong-console&state=state-1",
      }),
    );
    act(() =>
      desktopAuthCallback?.({
        console: "admin",
        url: "kitezh://oauth/callback#code=missing-state",
      }),
    );

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });
});
