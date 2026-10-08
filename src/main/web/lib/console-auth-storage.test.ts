import {
  clearStoredTransactions,
  CONSOLE_TRANSACTION_KEYS,
  readAndRemoveTransaction,
  readStoredTokens,
  removeAllStoredTokens,
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
    localStorage.clear();
    document.cookie = "cleanup=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    jest.restoreAllMocks();
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
});
