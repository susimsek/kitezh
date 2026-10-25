import {
  clearStoredTransactions,
  CONSOLE_TRANSACTION_KEYS,
  persistTokens,
  readAndRemoveTransaction,
  readPersistedTokens,
  readStoredTokens,
  removeAllPersistedTokens,
  removeAllStoredTokens,
  removePersistedTokens,
  removeStoredTokens,
  storeTokens,
  storeTransaction,
} from "./console-auth-storage";

const config = {
  clientId: "console",
  scope: "openid",
  transactionKey: CONSOLE_TRANSACTION_KEYS.admin,
  redirectPath: () => "/admin/callback",
  postLogoutRedirectPath: () => "/admin",
} as const;

const transaction = {
  codeVerifier: "verifier",
  expires: Date.now() + 60_000,
  nonce: "nonce",
  redirectUri: "http://localhost/callback",
  returnTo: "/admin",
  state: "state-1",
};

const tokens = {
  accessToken: "access",
  expiresAt: Date.now() + 60_000,
  idToken: null,
  refreshToken: "refresh",
  version: 1 as const,
};

describe("console authentication browser storage", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    delete window.desktopApi;
    document.cookie = "cleanup=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("stores and consumes valid transactions and tokens", () => {
    storeTransaction(config, transaction);
    expect(readAndRemoveTransaction(config, transaction.state)).toEqual(transaction);
    expect(readAndRemoveTransaction(config, transaction.state)).toBeNull();

    storeTokens("admin", tokens);
    expect(readStoredTokens("admin")).toEqual(tokens);
    removeStoredTokens("admin");
    expect(readStoredTokens("admin")).toBeNull();
  });

  it("rejects malformed, expired, and mismatched transaction data", () => {
    localStorage.setItem(
      `${CONSOLE_TRANSACTION_KEYS.admin}:bad`,
      JSON.stringify({ ...transaction, state: "different" }),
    );
    expect(readAndRemoveTransaction(config, "bad")).toBeNull();

    localStorage.setItem(
      `${CONSOLE_TRANSACTION_KEYS.admin}:expired`,
      JSON.stringify({ ...transaction, state: "expired", expires: Date.now() - 1 }),
    );
    expect(readAndRemoveTransaction(config, "expired")).toBeNull();

    localStorage.setItem(`${CONSOLE_TRANSACTION_KEYS.admin}:invalid`, "{");
    expect(readAndRemoveTransaction(config, "invalid")).toBeNull();
    localStorage.setItem("AUTH_CONSOLE_TOKEN:admin", JSON.stringify({ accessToken: "" }));
    expect(readStoredTokens("admin")).toBeNull();
  });

  it("falls back to cookies and tolerates unavailable local storage", () => {
    const storage = jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    storeTransaction(config, transaction);
    storage.mockRestore();
    expect(readAndRemoveTransaction(config, transaction.state)).toEqual(transaction);

    jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    storeTokens("account", tokens);
    removeAllStoredTokens();
    clearStoredTransactions();
  });

  it("uses the desktop session vault for token reads, writes, and removal", async () => {
    const desktopAuth = {
      getSession: jest.fn().mockResolvedValue(tokens),
      setSession: jest.fn().mockResolvedValue(undefined),
      clearSession: jest.fn().mockResolvedValue(undefined),
      clearAllSessions: jest.fn().mockResolvedValue(undefined),
    };
    window.desktopApi = { isDesktop: true, auth: desktopAuth } as never;

    await expect(readPersistedTokens("admin")).resolves.toEqual(tokens);
    await persistTokens("admin", tokens);
    await removePersistedTokens("account");
    await removeAllPersistedTokens();

    expect(desktopAuth.getSession).toHaveBeenCalledWith("admin");
    expect(desktopAuth.setSession).toHaveBeenCalledWith("admin", tokens);
    expect(desktopAuth.clearSession).toHaveBeenCalledWith("account");
    expect(desktopAuth.clearAllSessions).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
  });

  it("uses browser token storage when reading, persisting, and removing persisted tokens", async () => {
    await persistTokens("account", tokens);
    await expect(readPersistedTokens("account")).resolves.toEqual(tokens);
    await removePersistedTokens("account");
    expect(readStoredTokens("account")).toBeNull();

    storeTokens("admin", tokens);
    storeTokens("account", tokens);
    await removeAllPersistedTokens();
    expect(readStoredTokens("admin")).toBeNull();
    expect(readStoredTokens("account")).toBeNull();
  });

  it.each(
    [
      null,
      "not an object",
      [],
      { ...tokens, version: 2 },
      { ...tokens, accessToken: "" },
      { ...tokens, accessToken: 42 },
      { ...tokens, expiresAt: "later" },
      { ...tokens, idToken: 42 },
      { ...tokens, refreshToken: false },
    ].map((value) => [value]),
  )("rejects token records with an invalid persisted shape", (value) => {
    localStorage.setItem("AUTH_CONSOLE_TOKEN:admin", JSON.stringify(value));

    expect(readStoredTokens("admin")).toBeNull();
  });

  it.each(
    [
      { codeVerifier: "", expires: Date.now() + 60_000 },
      { ...transaction, codeVerifier: 42 },
      { ...transaction, expires: "later" },
      { ...transaction, nonce: "" },
      { ...transaction, redirectUri: "" },
      { ...transaction, returnTo: "https://example.com" },
      { ...transaction, state: "" },
    ].map((value) => [value]),
  )("rejects malformed transaction records from local storage", (value) => {
    const parsed = { ...transaction, ...value };
    localStorage.setItem(
      `${CONSOLE_TRANSACTION_KEYS.admin}:${parsed.state}`,
      JSON.stringify(parsed),
    );

    expect(readAndRemoveTransaction(config, parsed.state)).toBeNull();
  });

  it("ignores malformed cookie encoding and removes transaction cookies selectively", () => {
    const malformedValueKey = `${CONSOLE_TRANSACTION_KEYS.admin}:bad-cookie`;
    document.cookie = `${encodeURIComponent(malformedValueKey)}=%E0%A4%A; path=/`;
    expect(readAndRemoveTransaction(config, "bad-cookie")).toBeNull();

    storeTransaction(config, transaction);
    const unrelatedKey = "UNRELATED_SESSION_STATE";
    document.cookie = `${encodeURIComponent(unrelatedKey)}=keep; path=/`;
    document.cookie = "%E0%A4%A=malformed-name; path=/";
    clearStoredTransactions();

    expect(
      localStorage.getItem(`${CONSOLE_TRANSACTION_KEYS.admin}:${transaction.state}`),
    ).toBeNull();
    expect(document.cookie).toContain(`${encodeURIComponent(unrelatedKey)}=keep`);
  });
});
