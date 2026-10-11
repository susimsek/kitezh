import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import * as storage from "../auth/storage";
import { MobileAuthProvider, useMobileAuth } from "../auth/MobileAuthProvider";

jest.mock("expo-auth-session", () => {
  const request = {
    codeVerifier: "test-verifier",
    redirectUri: "kitezh://account/oauth/callback",
    state: "test-state",
  };
  const promptAsync = jest.fn();
  const exchangeCode = jest.fn();
  const refresh = jest.fn();
  return {
    __exchangeCode: exchangeCode,
    __promptAsync: promptAsync,
    __refresh: refresh,
    exchangeCodeAsync: exchangeCode,
    makeRedirectUri: () => "kitezh://account/oauth/callback",
    refreshAsync: refresh,
    useAuthRequest: () => [request, null, promptAsync],
    useAutoDiscovery: () => ({
      authorizationEndpoint: "https://issuer.example.test/authorize",
      endSessionEndpoint: "https://issuer.example.test/logout",
      tokenEndpoint: "https://issuer.example.test/token",
    }),
  };
});
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: "success" })),
}));
jest.mock("@/config", () => ({
  authorizationServerIssuer: "https://issuer.example.test",
  getMobileConsoleConfig: () => ({
    clientId: "mobile-account",
    namespace: "account",
    postLogoutRedirectUri: "kitezh://account/logout/callback",
    redirectUri: "kitezh://account/oauth/callback",
    scopes: ["openid", "account-api"],
  }),
}));
jest.mock("@/i18n/LocaleProvider", () => ({
  useLocale: () => ({ resolvedLocale: "en" }),
}));
jest.mock("../auth/storage", () => ({
  clearSession: jest.fn(),
  readSession: jest.fn(),
  writeSession: jest.fn(),
}));

const {
  __exchangeCode: mockExchangeCode,
  __promptAsync: mockPromptAsync,
  __refresh: mockRefresh,
} = jest.requireMock("expo-auth-session");

function AuthProbe() {
  const auth = useMobileAuth();
  return (
    <div>
      <output>{auth.status}</output>
      <output>{auth.error ?? "no-error"}</output>
      <output>{auth.session?.accessToken ?? "no-session"}</output>
      <button onClick={() => void auth.signIn()}>sign-in</button>
      <button onClick={() => void auth.refreshSession(true)}>refresh</button>
      <button onClick={() => void auth.signOut()}>sign-out</button>
    </div>
  );
}

function renderProvider(children: ReactNode = <AuthProbe />) {
  return render(
    <MobileAuthProvider consoleName="account">{children}</MobileAuthProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(storage.readSession).mockResolvedValue(null);
  jest.mocked(storage.writeSession).mockResolvedValue(undefined);
  jest.mocked(storage.clearSession).mockResolvedValue(undefined);
  mockPromptAsync.mockResolvedValue({
    type: "success",
    params: { code: "authorization-code", state: "test-state" },
  });
  mockExchangeCode.mockResolvedValue({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    idToken: "id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  mockRefresh.mockResolvedValue({
    accessToken: "refreshed-access-token",
    refreshToken: "rotated-refresh-token",
    idToken: "refreshed-id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });
});

it("restores an account session, exchanges PKCE, refreshes, and clears on logout", async () => {
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "stored-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: Date.now() - 1,
  });
  renderProvider();
  expect(await screen.findByText("signed-in")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() =>
    expect(storage.writeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        idToken: "id-token",
      }),
      "account",
    ),
  );
  expect(mockExchangeCode).toHaveBeenCalledWith(
    expect.objectContaining({
      extraParams: { code_verifier: "test-verifier" },
    }),
    expect.any(Object),
  );

  fireEvent.click(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() =>
    expect(storage.writeSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accessToken: "refreshed-access-token",
        refreshToken: "rotated-refresh-token",
      }),
      "account",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "sign-out" }));
  await waitFor(() =>
    expect(storage.clearSession).toHaveBeenCalledWith("account"),
  );
  expect(await screen.findByText("signed-out")).toBeVisible();
});

it("keeps a cancelled authorization signed out and reports unavailable discovery", async () => {
  mockPromptAsync.mockResolvedValueOnce({ type: "cancel" });
  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.click(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(mockPromptAsync).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("signed-out")).toBeVisible();
  expect(storage.writeSession).not.toHaveBeenCalled();
});

it("clears a session after refresh failure and rejects use outside its provider", async () => {
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "expired-access-token",
    refreshToken: "invalid-refresh-token",
    idToken: null,
    expiresAt: 0,
  });
  mockRefresh.mockRejectedValue(new Error("refresh denied"));
  renderProvider();
  await screen.findByText("signed-in");
  fireEvent.click(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() =>
    expect(storage.clearSession).toHaveBeenCalledWith("account"),
  );
  expect(await screen.findByText("signed-out")).toBeVisible();
  expect(() => render(<AuthProbe />)).toThrow(
    "useMobileAuth must be used inside MobileAuthProvider",
  );
});
