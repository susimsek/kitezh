import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/testing/native-testing-library";
import * as ExpoLinking from "expo-linking";
import { AppState, Linking, Platform, Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
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
  let requestHasCodeVerifier = true;
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
      this.codeVerifier = requestHasCodeVerifier
        ? `test-verifier-${requestSequence}`
        : null;
      return "https://issuer.example.test/authorize";
    }

    parseReturnUrl(url: string) {
      return {
        type: "success",
        params: Object.fromEntries(new URL(url).searchParams.entries()),
      };
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
    __setRequestHasCodeVerifier: (hasCodeVerifier: boolean) => {
      requestHasCodeVerifier = hasCodeVerifier;
    },
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
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
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
  __setRequestHasCodeVerifier: mockSetRequestHasCodeVerifier,
  __setDiscovery: mockSetDiscovery,
} = jest.requireMock("expo-auth-session");

function AuthProbe() {
  const auth = useMobileAuth();
  return (
    <View>
      <Text>{auth.status}</Text>
      <Text>{auth.error ?? "no-error"}</Text>
      <Text>{auth.session?.accessToken ?? "no-session"}</Text>
      <Pressable accessibilityRole="button" onPress={() => void auth.signIn()}><Text>sign-in</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.refreshSession(true)}><Text>refresh</Text></Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void auth.refreshSession(true);
          void auth.refreshSession(true);
        }}
      >
        <Text>refresh-twice</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void auth.signOut()}><Text>sign-out</Text></Pressable>
    </View>
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
  jest.restoreAllMocks();
  jest.clearAllMocks();
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  mockSetDiscovery({
    authorizationEndpoint: "https://issuer.example.test/authorize",
    discoveryDocument: { issuer: "https://issuer.example.test" },
    endSessionEndpoint: "https://issuer.example.test/logout",
    tokenEndpoint: "https://issuer.example.test/token",
  });
  mockSetRequestHasCodeVerifier(true);
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
  expect(await screen.findByText("signed-in")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
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

  fireEvent.press(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() =>
    expect(storage.writeSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        accessToken: "refreshed-access-token",
        refreshToken: "rotated-refresh-token",
      }),
      "account",
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "sign-out" }));
  await waitFor(() =>
    expect(storage.clearSession).toHaveBeenCalledWith("account"),
  );
  expect(await screen.findByText("signed-out")).toBeTruthy();
});

it("supports access-only tokens without refresh or end-session data", async () => {
  mockExchangeCode.mockResolvedValueOnce({
    accessToken: "access-only-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });

  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  await waitFor(() =>
    expect(storage.writeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "access-only-token",
        refreshToken: null,
        idToken: null,
      }),
      "account",
    ),
  );
  fireEvent.press(screen.getByRole("button", { name: "refresh" }));
  expect(mockRefresh).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "sign-out" }));
  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
});

it("keeps a cancelled authorization signed out and reports unavailable discovery", async () => {
  mockPromptAsync.mockResolvedValueOnce({ type: "cancel" });
  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(mockPromptAsync).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(storage.writeSession).not.toHaveBeenCalled();
});

it("rejects an authorization request without a PKCE verifier", async () => {
  mockSetRequestHasCodeVerifier(false);
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("authorization-failed")).toBeTruthy();
  expect(storage.saveOAuthTransaction).not.toHaveBeenCalled();
  expect(mockPromptAsync).not.toHaveBeenCalled();
});

it("reports a provider authorization error without exchanging a code", async () => {
  mockPromptAsync.mockResolvedValueOnce({
    type: "error",
    params: { error: "access_denied" },
  });
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("authorization-failed")).toBeTruthy();
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
});

it("clears the pending transaction when the browser dismisses authorization", async () => {
  mockPromptAsync.mockResolvedValueOnce({ type: "dismiss" });
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
  expect(mockExchangeCode).not.toHaveBeenCalled();
});

it("refuses an authorization endpoint from mismatched discovery metadata", async () => {
  mockSetDiscovery({
    authorizationEndpoint: "https://attacker.example.test/authorize",
    discoveryDocument: { issuer: "https://issuer.example.test" },
    tokenEndpoint: "https://issuer.example.test/token",
  });
  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  expect(await screen.findByText("error")).toBeTruthy();
  expect(mockPromptAsync).not.toHaveBeenCalled();
  expect(storage.saveOAuthTransaction).not.toHaveBeenCalled();
});

it("reports unavailable discovery without starting an authorization request", async () => {
  mockSetDiscovery(null);
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("Authentication failed")).toBeTruthy();
  expect(mockPromptAsync).not.toHaveBeenCalled();
  expect(storage.saveOAuthTransaction).not.toHaveBeenCalled();
});

it("times out a browser authorization that never returns", async () => {
  jest.useFakeTimers();
  mockPromptAsync.mockReturnValueOnce(new Promise(() => {}));
  try {
    renderProvider();
    await screen.findByText("signed-out");

    fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
    await waitFor(() => expect(mockPromptAsync).toHaveBeenCalledTimes(1));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60_000);
    });

    expect(screen.getByText("authorization-timeout")).toBeTruthy();
    expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
  } finally {
    jest.useRealTimers();
  }
});

it("completes Android authorization from the native redirect event", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  let receiveUrl: ((event: { url: string }) => void) | undefined;
  const removeUrlListener = jest.fn();
  const removeAppStateListener = jest.fn();
  jest.spyOn(Linking, "addEventListener").mockImplementation(((
    event: string,
    listener: (event: never) => void,
  ) => {
    if (event === "url") {
      receiveUrl = listener as (event: { url: string }) => void;
      return { remove: removeUrlListener };
    }
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({
    remove: removeAppStateListener,
  })) as never);

  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalled());
  const state = savedOAuthTransaction?.state;
  expect(state).toBeDefined();

  act(() => {
    receiveUrl?.({
      url: `kitezh://account/oauth/callback?code=android-code&state=${state}`,
    });
  });

  expect(await screen.findByText("signed-in")).toBeTruthy();
  expect(mockExchangeCode).toHaveBeenCalledWith(
    expect.objectContaining({ code: "android-code" }),
    expect.any(Object),
  );
  expect(removeUrlListener).toHaveBeenCalled();
  expect(removeAppStateListener).toHaveBeenCalled();
});

it("does not cancel Android authorization for an active state without a background transition", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  let receiveUrl: ((event: { url: string }) => void) | undefined;
  let changeAppState: ((state: string) => void) | undefined;
  jest.spyOn(Linking, "addEventListener").mockImplementation(((event, listener) => {
    if (event === "url") {
      receiveUrl = listener as (event: { url: string }) => void;
    }
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_event, listener) => {
    changeAppState = listener as (state: string) => void;
    return { remove: jest.fn() };
  }) as never);

  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalled());
  const state = savedOAuthTransaction?.state;
  expect(state).toBeDefined();

  act(() => changeAppState?.("active"));
  await act(async () => Promise.resolve());
  expect(screen.getByText("signing-in")).toBeTruthy();
  act(() => {
    receiveUrl?.({
      url: `kitezh://account/oauth/callback?code=android-code&state=${state}`,
    });
  });

  expect(await screen.findByText("signed-in")).toBeTruthy();
  expect(mockExchangeCode).toHaveBeenCalledWith(
    expect.objectContaining({ code: "android-code" }),
    expect.any(Object),
  );
});

it("times out an Android browser session and removes native listeners", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  const removeUrlListener = jest.fn();
  const removeAppStateListener = jest.fn();
  jest.spyOn(Linking, "addEventListener").mockImplementation((() => ({
    remove: removeUrlListener,
  })) as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({
    remove: removeAppStateListener,
  })) as never);

  renderProvider();
  await screen.findByText("signed-out");
  jest.useFakeTimers();
  try {
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60_000);
    });

    expect(await screen.findByText("authorization-timeout")).toBeTruthy();
    expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
    expect(removeUrlListener).toHaveBeenCalled();
    expect(removeAppStateListener).toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it("cancels Android authorization when the browser returns without a callback", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  let receiveUrl: ((event: { url: string }) => void) | undefined;
  let changeAppState: ((state: string) => void) | undefined;
  jest.spyOn(Linking, "addEventListener").mockImplementation(((
    event: string,
    listener: (event: never) => void,
  ) => {
    if (event === "url") {
      receiveUrl = listener as (event: { url: string }) => void;
    }
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _event,
    listener,
  ) => {
    changeAppState = listener as (state: string) => void;
    return { remove: jest.fn() };
  }) as never);

  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalled());

  jest.useFakeTimers();
  act(() => {
    receiveUrl?.({ url: "https://untrusted.example.test/callback?code=bad" });
    changeAppState?.("background");
    changeAppState?.("active");
  });
  try {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(750);
    });
    expect(await screen.findByText("signed-out")).toBeTruthy();
    expect(mockExchangeCode).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

it("stays signed out when Android immediately cancels browser launch", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  const removeUrlListener = jest.fn();
  const removeAppStateListener = jest.fn();
  jest.spyOn(Linking, "addEventListener").mockImplementation((() => ({
    remove: removeUrlListener,
  })) as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({
    remove: removeAppStateListener,
  })) as never);
  jest
    .mocked(WebBrowser.openBrowserAsync)
    .mockResolvedValueOnce({ type: "cancel" } as never);

  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
  expect(removeUrlListener).toHaveBeenCalled();
  expect(removeAppStateListener).toHaveBeenCalled();
});

it("cleans up Android authorization listeners when browser launch fails", async () => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: "android",
  });
  const removeUrlListener = jest.fn();
  const removeAppStateListener = jest.fn();
  jest.spyOn(Linking, "addEventListener").mockImplementation((() => ({
    remove: removeUrlListener,
  })) as never);
  jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({
    remove: removeAppStateListener,
  })) as never);
  jest
    .mocked(WebBrowser.openBrowserAsync)
    .mockRejectedValueOnce(new Error("system browser unavailable"));

  renderProvider();
  await screen.findByText("signed-out");
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("authorization-failed")).toBeTruthy();
  expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
  expect(removeUrlListener).toHaveBeenCalled();
  expect(removeAppStateListener).toHaveBeenCalled();
});

it("fails authorization when its PKCE transaction has expired", async () => {
  jest.mocked(storage.consumeOAuthTransaction).mockResolvedValueOnce(null);
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("authorization-failed")).toBeTruthy();
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
});

it("rejects an authorization callback whose state differs from the saved transaction", async () => {
  jest.mocked(storage.consumeOAuthTransaction).mockResolvedValueOnce({
    clientId: "mobile-account",
    codeVerifier: "test-verifier",
    createdAt: Date.now(),
    redirectUri: "kitezh://account/oauth/callback",
    state: "another-request-state",
  });
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));

  expect(await screen.findByText("authorization-failed")).toBeTruthy();
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account");
});

it("continues signed out when secure session restoration fails", async () => {
  jest
    .mocked(storage.readSession)
    .mockRejectedValueOnce(new Error("secure storage unavailable"));

  renderProvider();

  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(storage.clearSession).not.toHaveBeenCalled();
});

it("reports a cold-start callback lookup failure", async () => {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockRejectedValueOnce(new Error("initial URL unavailable"));

  renderProvider();

  expect(await screen.findByText("Authentication failed")).toBeTruthy();
  expect(screen.getByText("error")).toBeTruthy();
});

it("keeps the restored session when it has no refresh token", async () => {
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "stored-access-token",
    refreshToken: null,
    idToken: "stored-id-token",
    expiresAt: 0,
  });

  renderProvider();
  expect(await screen.findByText("signed-in")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "refresh" }));

  await waitFor(() => expect(mockRefresh).not.toHaveBeenCalled());
  expect(screen.getByText("stored-access-token")).toBeTruthy();
});

it("retains stored refresh and ID tokens when refresh omits rotated values", async () => {
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "expired-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: 0,
  });
  mockRefresh.mockResolvedValueOnce({
    accessToken: "refreshed-access-token",
    refreshToken: undefined,
    idToken: undefined,
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });

  renderProvider();
  expect(await screen.findByText("signed-in")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "refresh" }));

  await waitFor(() =>
    expect(storage.writeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "refreshed-access-token",
        refreshToken: "stored-refresh-token",
        idToken: "stored-id-token",
      }),
      "account",
    ),
  );
});

it("refreshes an expired session when the app becomes active", async () => {
  let changeAppState: ((state: string) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_event, listener) => {
    changeAppState = listener as (state: string) => void;
    return { remove: jest.fn() };
  }) as never);
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "expired-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: 0,
  });

  renderProvider();
  expect(await screen.findByText("signed-in")).toBeTruthy();

  act(() => changeAppState?.("active"));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
});

it("keeps a fresh session without refreshing when the app becomes active", async () => {
  let changeAppState: ((state: string) => void) | undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_event, listener) => {
    changeAppState = listener as (state: string) => void;
    return { remove: jest.fn() };
  }) as never);
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "fresh-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: Date.now() + 60 * 60_000,
  });

  renderProvider();
  expect(await screen.findByText("signed-in")).toBeTruthy();

  act(() => changeAppState?.("active"));

  expect(mockRefresh).not.toHaveBeenCalled();
  expect(screen.getByText("fresh-access-token")).toBeTruthy();
});

it("creates a fresh OAuth state for every sign-in attempt", async () => {
  renderProvider();
  await screen.findByText("signed-out");

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  await waitFor(() => expect(mockExchangeCode).toHaveBeenCalledTimes(1));

  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
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

  fireEvent.press(signIn);
  fireEvent.press(signIn);

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
  expect(await screen.findByText("signed-in")).toBeTruthy();
});

it("clears the pending transaction when a cold-start callback has no state", async () => {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockResolvedValueOnce(
      "kitezh://account/oauth/callback?code=untrusted-authorization-code",
    );

  renderProvider();

  await waitFor(() =>
    expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account"),
  );
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(await screen.findByText("signed-out")).toBeTruthy();
});

it.each([
  ["no URL", null],
  ["an unregistered URL", "https://untrusted.example.test/callback?state=state"],
] as const)("ignores cold-start callbacks from %s", async (_description, url) => {
  jest.spyOn(Linking, "getInitialURL").mockResolvedValueOnce(url);

  renderProvider();

  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(storage.consumeOAuthTransaction).not.toHaveBeenCalled();
  expect(mockExchangeCode).not.toHaveBeenCalled();
});

it("ignores duplicate cold-start callback parameters", async () => {
  jest
    .spyOn(Linking, "getInitialURL")
    .mockResolvedValueOnce("kitezh://account/oauth/callback?state=duplicate");
  jest.spyOn(ExpoLinking, "parse").mockReturnValueOnce({
    queryParams: {
      code: ["first-code", "second-code"],
      state: ["first-state", "second-state"],
    },
  } as never);

  renderProvider();

  await waitFor(() =>
    expect(storage.clearOAuthTransaction).toHaveBeenCalledWith("account"),
  );
  expect(mockExchangeCode).not.toHaveBeenCalled();
  expect(await screen.findByText("signed-out")).toBeTruthy();
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
  fireEvent.press(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() =>
    expect(storage.clearSession).toHaveBeenCalledWith("account"),
  );
  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(() => render(<AuthProbe />)).toThrow(
    "useMobileAuth must be used inside MobileAuthProvider",
  );
});

it("coalesces concurrent forced refreshes into one token request", async () => {
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

  fireEvent.press(screen.getByRole("button", { name: "refresh-twice" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  pendingRefresh.resolve({
    accessToken: "refreshed-access-token",
    refreshToken: "rotated-refresh-token",
    idToken: "refreshed-id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });

  await waitFor(() => expect(storage.writeSession).toHaveBeenCalledTimes(1));
  expect(storage.writeSession).toHaveBeenCalledWith(
    expect.objectContaining({
      accessToken: "refreshed-access-token",
      refreshToken: "rotated-refresh-token",
    }),
    "account",
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

  fireEvent.press(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "sign-out" }));
  expect(await screen.findByText("signing-out")).toBeTruthy();

  pendingRefresh.resolve({
    accessToken: "stale-access-token",
    refreshToken: "stale-refresh-token",
    idToken: "stale-id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });

  expect(await screen.findByText("signed-out")).toBeTruthy();
  expect(storage.writeSession).not.toHaveBeenCalled();
  expect(storage.clearSession).toHaveBeenCalledWith("account");
});

it("clears a refreshed token when logout races its storage write", async () => {
  const pendingWrite = deferred<void>();
  jest.mocked(storage.readSession).mockResolvedValue({
    accessToken: "expired-access-token",
    refreshToken: "stored-refresh-token",
    idToken: "stored-id-token",
    expiresAt: 0,
  });
  jest.mocked(storage.writeSession).mockReturnValueOnce(pendingWrite.promise);
  renderProvider();
  await screen.findByText("signed-in");

  fireEvent.press(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() => expect(storage.writeSession).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "sign-out" }));
  expect(await screen.findByText("signing-out")).toBeTruthy();

  pendingWrite.resolve(undefined);

  expect(await screen.findByText("signed-out")).toBeTruthy();
  await waitFor(() => expect(storage.clearSession).toHaveBeenCalledTimes(2));
  expect(screen.getByText("no-session")).toBeTruthy();
  expect(screen.getByText("signed-out")).toBeTruthy();
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

  fireEvent.press(screen.getByRole("button", { name: "refresh" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole("button", { name: "sign-in" }));
  expect(mockPromptAsync).not.toHaveBeenCalled();

  pendingRefresh.resolve({
    accessToken: "stale-access-token",
    refreshToken: "stale-refresh-token",
    idToken: "stale-id-token",
    expiresIn: 300,
    issuedAt: Math.floor(Date.now() / 1000),
  });
  await waitFor(() => expect(mockPromptAsync).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("signed-in")).toBeTruthy();
  expect(storage.writeSession).toHaveBeenCalledTimes(1);
  expect(storage.writeSession).toHaveBeenCalledWith(
    expect.objectContaining({ accessToken: "access-token" }),
    "account",
  );
});
