import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useConsoleAuth } from "./console-auth";
import {
  readAndRemoveTransaction,
  readPersistedTokens,
  removePersistedTokens,
  persistTokens,
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
  isDesktopRuntime: () => false,
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

describe("useConsoleAuth token lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
