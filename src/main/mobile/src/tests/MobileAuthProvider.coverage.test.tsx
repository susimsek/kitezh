import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Linking } from "react-native";
import type { ReactNode } from "react";
import * as storage from "../auth/storage";
import { MobileAuthProvider, useMobileAuth } from "../auth/MobileAuthProvider";

jest.mock("expo-auth-session", () => {
  let authDiscovery: unknown = {
    authorizationEndpoint: "https://issuer.example.test/authorize",
    discoveryDocument: { issuer: "https://issuer.example.test" },
    endSessionEndpoint: "https://issuer.example.test/logout",
    tokenEndpoint: "https://issuer.example.test/token",
  };
  const promptAsync = jest.fn();
  const exchangeCode = jest.fn();
  const refresh = jest.fn();
  let requestSequence = 0;
  class MockAuthRequest {
    codeVerifier: string | null = null;
    redirectUri: string;
    state: string;

    constructor(config: { redirectUri: string }) {
      requestSequence += 1;
      this.redirectUri = config.redirectUri;
      this.state = `test-state-${requestSequence}`;
    }

    async makeAuthUrlAsync() {
      this.codeVerifier = `test-verifier-${requestSequence}`;
      return "https://issuer.example.test/authorize";
    }

    async promptAsync() {
      const result = await promptAsync();
      if (result.type === "success") {
        return {
          ...result,
          params: { ...result.params, state: this.state },
        };
      }
      return result;
    }
  }
  return {
    AuthRequest: MockAuthRequest,
    __exchangeCode: exchangeCode,
    __promptAsync: promptAsync,
    __refresh: refresh,
    __setDiscovery: (discovery: unknown) => {
      authDiscovery = discovery;
    },
    exchangeCodeAsync: exchangeCode,
    makeRedirectUri: () => "kitezh://account/oauth/callback",
    refreshAsync: refresh,
    useAutoDiscovery: () => authDiscovery,
  };
});
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: "success" })),
}));
jest.mock("expo-linking", () => ({
  parse: (url: string) => ({
    queryParams: Object.fromEntries(new URL(url).searchParams.entries()),
  }),
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
  useLocale: () => ({
    dictionary: { authError: "Authentication failed" },
    resolvedLocale: "en",
  }),
}));
jest.mock("../auth/storage", () => ({
  clearSession: jest.fn(),
  clearOAuthTransaction: jest.fn(),
  consumeOAuthTransaction: jest.fn(),
  readSession: jest.fn(),
  saveOAuthTransaction: jest.fn(),
  writeSession: jest.fn(),
}));

let savedOAuthTransaction: Awaited<
  ReturnType<typeof storage.consumeOAuthTransaction>
> = null;

const {
  __exchangeCode: mockExchangeCode,
  __promptAsync: mockPromptAsync,
  __refresh: mockRefresh,
  __setDiscovery: mockSetDiscovery,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDiscovery({
    authorizationEndpoint: "https://issuer.example.test/authorize",
    discoveryDocument: { issuer: "https://issuer.example.test" },
    endSessionEndpoint: "https://issuer.example.test/logout",
    tokenEndpoint: "https://issuer.example.test/token",
  });
  jest.mocked(storage.readSession).mockResolvedValue(null);
  jest.mocked(storage.writeSession).mockResolvedValue(undefined);
  jest.mocked(storage.clearSession).mockResolvedValue(undefined);
  jest.mocked(storage.clearOAuthTransaction).mockResolvedValue(undefined);
  jest.mocked(storage.consumeOAuthTransaction).mockResolvedValue({
    clientId: "mobile-account",
    codeVerifier: "test-verifier",
    createdAt: Date.now(),
    redirectUri: "kitezh://account/oauth/callback",
    state: "test-state",
  });
  jest.mocked(storage.saveOAuthTransaction).mockResolvedValue(undefined);
  savedOAuthTransaction = null;
  jest
    .mocked(storage.saveOAuthTransaction)
    .mockImplementation(async (_namespace, transaction) => {
      savedOAuthTransaction = transaction;
    });
  jest
    .mocked(storage.consumeOAuthTransaction)
    .mockImplementation(async () => savedOAuthTransaction);
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
  expect(storage.saveOAuthTransaction).toHaveBeenCalledWith(
    "account",
    expect.objectContaining({
      clientId: "mobile-account",
      codeVerifier: expect.stringMatching(/^test-verifier-\d+$/),
      redirectUri: "kitezh://account/oauth/callback",
      state: expect.stringMatching(/^test-state-\d+$/),
    }),
  );
  expect(storage.consumeOAuthTransaction).toHaveBeenCalledWith("account", {
    clientId: "mobile-account",
    redirectUri: "kitezh://account/oauth/callback",
  });
  expect(mockExchangeCode).toHaveBeenCalledWith(
    expect.objectContaining({
      extraParams: {
        code_verifier: expect.stringMatching(/^test-verifier-\d+$/),
      },
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

it("refuses an authorization endpoint from mismatched discovery metadata", async () => {
  mockSetDiscovery({
    authorizationEndpoint: "https://attacker.example.test/authorize",
    discoveryDocument: { issuer: "https://issuer.example.test" },
    tokenEndpoint: "https://issuer.example.test/token",
  });
  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.click(screen.getByRole("button", { name: "sign-in" }));
  expect(await screen.findByText("error")).toBeVisible();
  expect(mockPromptAsync).not.toHaveBeenCalled();
  expect(storage.saveOAuthTransaction).not.toHaveBeenCalled();
});

it("creates a fresh OAuth state for every sign-in attempt", async () => {
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.click(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(mockExchangeCode).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(mockExchangeCode).toHaveBeenCalledTimes(2));
  expect(storage.saveOAuthTransaction).toHaveBeenCalledTimes(2);
  const firstState = jest.mocked(storage.saveOAuthTransaction).mock
    .calls[0]?.[1].state;
  const secondState = jest.mocked(storage.saveOAuthTransaction).mock
    .calls[1]?.[1].state;
  expect(firstState).toEqual(expect.stringMatching(/^test-state-\d+$/));
  expect(secondState).toEqual(expect.stringMatching(/^test-state-\d+$/));
  expect(secondState).not.toBe(firstState);
});

it("ignores repeated sign-in taps while the browser request is pending", async () => {
  const pendingPrompt = deferred<{
    type: "success";
    params: { code: string; state: string };
  }>();
  mockPromptAsync.mockReturnValueOnce(pendingPrompt.promise);
  renderProvider();
  await screen.findByText("signed-out");
  const signIn = screen.getByRole("button", { name: "sign-in" });

  fireEvent.click(signIn);
  fireEvent.click(signIn);

  await waitFor(() => expect(mockPromptAsync).toHaveBeenCalledTimes(1));
  expect(storage.saveOAuthTransaction).toHaveBeenCalledTimes(1);
  pendingPrompt.resolve({
    type: "success",
    params: { code: "authorization-code", state: "replaced-by-request" },
  });
  await waitFor(() => expect(mockExchangeCode).toHaveBeenCalledTimes(1));
});

it("resumes a cold-start callback from its SecureStore PKCE transaction", async () => {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockResolvedValueOnce(
      "kitezh://account/oauth/callback?code=resumed-authorization-code&state=test-state",
    );
  jest.mocked(storage.consumeOAuthTransaction).mockResolvedValueOnce({
    clientId: "mobile-account",
    codeVerifier: "persisted-test-verifier",
    createdAt: Date.now(),
    redirectUri: "kitezh://account/oauth/callback",
    state: "test-state",
  });

  renderProvider();
  await waitFor(() => expect(mockExchangeCode).toHaveBeenCalledTimes(1));
  expect(mockExchangeCode).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "resumed-authorization-code",
      extraParams: { code_verifier: "persisted-test-verifier" },
    }),
    expect.any(Object),
  );
  expect(await screen.findByText("signed-in")).toBeVisible();
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

it("does not restore a session when logout races a pending refresh", async () => {
  const pendingRefresh = deferred<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    issuedAt: number;
  }>();
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "expired-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: 0,
  });
  mockRefresh.mockReturnValueOnce(pendingRefresh.promise);
  renderProvider();
  await screen.findByText("signed-in");

  fireEvent.click(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "sign-out" }));
  expect(await screen.findByText("signing-out")).toBeVisible();

  pendingRefresh.resolve({
    accessToken: "stale-access-token",
    refreshToken: "stale-refresh-token",
    idToken: "stale-id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });

  expect(await screen.findByText("signed-out")).toBeVisible();
  expect(storage.writeSession).not.toHaveBeenCalled();
  expect(storage.clearSession).toHaveBeenCalledWith("account");
});

it("serializes reauthentication after a stale refresh completes", async () => {
  const pendingRefresh = deferred<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
    expiresIn: number;
    issuedAt: number;
  }>();
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "expired-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: 0,
  });
  mockRefresh.mockReturnValueOnce(pendingRefresh.promise);
  renderProvider();
  await screen.findByText("signed-in");

  fireEvent.click(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "sign-in" }));
  expect(mockPromptAsync).not.toHaveBeenCalled();

  pendingRefresh.resolve({
    accessToken: "stale-access-token",
    refreshToken: "stale-refresh-token",
    idToken: "stale-id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  await waitFor(() => expect(mockPromptAsync).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("signed-in")).toBeVisible();
  expect(storage.writeSession).toHaveBeenCalledTimes(1);
  expect(storage.writeSession).toHaveBeenCalledWith(
    expect.objectContaining({ accessToken: "access-token" }),
    "account",
  );
});
