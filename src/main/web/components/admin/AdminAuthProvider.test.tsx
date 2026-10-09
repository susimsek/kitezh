/* eslint-disable react-hooks/globals */

import { act, render, waitFor } from "@testing-library/react";
import axios from "axios";

import { StoreProvider } from "@/store/StoreProvider";

import { type AdminAccess, AdminAuthProvider, useAdminAuth } from "./AdminAuthProvider";

const mockPost = jest.fn();
const completeAccess: AdminAccess = {
  viewClients: true,
  manageClients: false,
  viewUsers: false,
  manageUsers: false,
  impersonateUsers: false,
  viewRoles: false,
  manageRoles: false,
  viewSessions: false,
  manageSessions: false,
  viewConsents: false,
  manageConsents: false,
  viewKeys: false,
  manageKeys: false,
};

let auth: ReturnType<typeof useAdminAuth>;

function Consumer() {
  auth = useAdminAuth();
  return null;
}

function jwt(payload: Record<string, unknown>) {
  const encoded = btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `e30.${encoded}.signature`;
}

function storeTransaction(state: string, returnTo = "/admin") {
  localStorage.setItem(
    `ADMIN_OIDC_TRANSACTION:${state}`,
    JSON.stringify({
      codeVerifier: "verifier",
      expires: Date.now() + 60 * 60 * 1000,
      nonce: "nonce",
      redirectUri: "http://localhost/admin/callback",
      returnTo,
      state,
    }),
  );
}

function storeTokens(overrides: Partial<Record<string, unknown>> = {}) {
  localStorage.setItem(
    "AUTH_CONSOLE_TOKEN:admin",
    JSON.stringify({
      accessToken: jwt({
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        sid: "s1",
        sub: "u1",
      }),
      expiresAt: Date.now() + 60_000,
      idToken: jwt({ sub: "u1" }),
      refreshToken: "refresh",
      version: 1,
      ...overrides,
    }),
  );
}

function renderProvider() {
  return render(
    <StoreProvider>
      <AdminAuthProvider>
        <Consumer />
      </AdminAuthProvider>
    </StoreProvider>,
  );
}

describe("AdminAuthProvider", () => {
  beforeEach(() => {
    mockPost.mockReset();
    Object.assign(axios, { post: mockPost });
    sessionStorage.clear();
    localStorage.clear();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => bytes.fill(7),
        subtle: { digest: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer) },
      },
    });
  });

  it("requires its provider", () => {
    expect(() =>
      render(
        <StoreProvider>
          <Consumer />
        </StoreProvider>,
      ),
    ).toThrow("AdminAuthProvider is required");
  });

  it("does not refresh when no refresh token is available", async () => {
    renderProvider();

    await expect(auth.refreshAccessToken()).resolves.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("hydrates Redux and its refresh-token state from browser storage", async () => {
    storeTokens();
    mockPost.mockResolvedValueOnce({
      data: {
        access_token: jwt({
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60,
          sid: "s1",
          sub: "u1",
        }),
        expires_in: 60,
      },
    });
    renderProvider();

    await waitFor(() => expect(auth.authenticated).toBe(true));
    expect(auth.initialized).toBe(true);
    expect(auth.accessToken).not.toBeNull();
    await expect(auth.refreshAccessToken(-1)).resolves.not.toBeNull();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("AUTH_CONSOLE_TOKEN:admin") ?? "{}")).toMatchObject({
      refreshToken: "refresh",
    });
  });

  it("ignores malformed persisted token state", async () => {
    localStorage.setItem("AUTH_CONSOLE_TOKEN:admin", "not-json");
    renderProvider();

    await waitFor(() => expect(auth.initialized).toBe(true));
    expect(auth.authenticated).toBe(false);
    expect(auth.accessToken).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("starts an authorization request only once and stores its transaction", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    renderProvider();

    await act(async () => {
      await Promise.all([
        auth.beginAuthorization("tr", "/admin"),
        auth.beginAuthorization("tr", "/admin"),
      ]);
    });

    expect(sessionStorage.getItem("AUTH_ADMIN_RETURN_TO")).toBe("/admin");
    const transactionKey = Object.keys(localStorage).find((key) =>
      key.startsWith("ADMIN_OIDC_TRANSACTION:"),
    );
    expect(transactionKey).toBeDefined();
    expect(JSON.parse(localStorage.getItem(transactionKey ?? "") ?? "{}")).toMatchObject({
      returnTo: "/admin",
    });
  });

  it("rejects missing and invalid authorization transactions", async () => {
    renderProvider();

    await expect(auth.completeAuthorization("code", "state")).rejects.toThrow(
      "Missing authorization transaction",
    );
    storeTransaction("expected");
    const invalid = JSON.parse(localStorage.getItem("ADMIN_OIDC_TRANSACTION:expected") ?? "{}");
    invalid.state = "different";
    localStorage.setItem("ADMIN_OIDC_TRANSACTION:expected", JSON.stringify(invalid));

    await expect(auth.completeAuthorization("code", "expected")).rejects.toThrow(
      "Missing authorization transaction",
    );
  });

  it("exchanges a code, stores token state, and refreshes it", async () => {
    renderProvider();
    storeTransaction("state");
    sessionStorage.setItem("AUTH_ADMIN_RETURN_TO", "/admin");
    mockPost
      .mockResolvedValueOnce({
        data: {
          access_token: jwt({
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60,
            sid: "s1",
            sub: "u1",
          }),
          expires_in: 60,
          refresh_token: "refresh",
          id_token: jwt({ nonce: "nonce", sub: "u1" }),
        },
      })
      .mockResolvedValueOnce({
        data: {
          access_token: jwt({
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60,
            sid: "s1",
            sub: "u1",
          }),
          expires_in: 60,
          refresh_token: "refresh2",
          id_token: jwt({ sub: "u1" }),
        },
      });

    await act(async () => {
      await expect(auth.completeAuthorization("code", "state")).resolves.toBe("/admin");
    });
    expect(auth.accessToken).not.toBeNull();
    expect(auth.expiresAt).toEqual(expect.any(Number));
    expect(JSON.parse(localStorage.getItem("AUTH_CONSOLE_TOKEN:admin") ?? "{}")).toMatchObject({
      refreshToken: "refresh",
    });
    expect(sessionStorage.getItem("AUTH_ADMIN_RETURN_TO")).toBeNull();

    await act(async () => {
      await expect(auth.refreshAccessToken(-1)).resolves.not.toBeNull();
    });
    expect(auth.accessToken).not.toBeNull();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem("AUTH_CONSOLE_TOKEN:admin") ?? "{}")).toMatchObject({
      refreshToken: "refresh2",
    });
  });

  it("keeps a still-valid token after a transient refresh failure and revokes on logout", async () => {
    renderProvider();
    storeTransaction("state");
    localStorage.setItem("AUTH_CONSOLE_TOKEN:account", "another-console-token");
    localStorage.setItem("ACCOUNT_OIDC_TRANSACTION:pending", "pending-transaction");
    mockPost
      .mockResolvedValueOnce({
        data: {
          access_token: jwt({
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60,
            sid: "s1",
            sub: "u1",
          }),
          expires_in: 60,
          refresh_token: "refresh",
          id_token: jwt({ nonce: "nonce", sub: "u1" }),
        },
      })
      .mockRejectedValueOnce(new Error("expired"))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await act(async () => auth.completeAuthorization("code", "state"));
    await act(async () => expect(auth.refreshAccessToken(-1)).resolves.not.toBeNull());
    await act(async () => auth.logout("en"));

    expect(auth.accessToken).toBeNull();
    expect(auth.isLoggingOut).toBe(true);
    expect(localStorage.getItem("AUTH_CONSOLE_TOKEN:admin")).toBeNull();
    expect(localStorage.getItem("AUTH_CONSOLE_TOKEN:account")).toBeNull();
    expect(localStorage.getItem("ACCOUNT_OIDC_TRANSACTION:pending")).toBeNull();
  });

  it("coalesces concurrent refresh requests into one token exchange", async () => {
    storeTokens();
    let resolveRefresh!: (value: { data: Record<string, unknown> }) => void;
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    renderProvider();
    await waitFor(() => expect(auth.authenticated).toBe(true));

    let first!: Promise<string | null>;
    let second!: Promise<string | null>;
    await act(async () => {
      first = auth.refreshAccessToken(-1);
      second = auth.refreshAccessToken(-1);
      resolveRefresh({
        data: {
          access_token: jwt({
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60,
          }),
          expires_in: 60,
        },
      });
      await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("clears persisted authentication after a permanent refresh rejection", async () => {
    storeTokens();
    const error = Object.assign(new Error("invalid refresh"), {
      isAxiosError: true,
      response: { status: 400 },
    });
    mockPost.mockRejectedValueOnce(error);
    renderProvider();
    await waitFor(() => expect(auth.authenticated).toBe(true));

    await act(async () => {
      await expect(auth.refreshAccessToken(-1)).resolves.toBeNull();
    });
    expect(auth.authenticated).toBe(false);
    expect(localStorage.getItem("AUTH_CONSOLE_TOKEN:admin")).toBeNull();
  });

  it("allows access state to be updated by guards", async () => {
    renderProvider();

    await act(async () => auth.setAccess(completeAccess));
    await waitFor(() => expect(auth.access).toEqual(completeAccess));
  });
});
