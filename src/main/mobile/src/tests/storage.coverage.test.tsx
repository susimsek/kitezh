jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import {
  clearOAuthTransaction,
  clearSession,
  clearSessionIfCurrent,
  consumeOAuthTransaction,
  readSession,
  saveOAuthTransaction,
  writeSession,
  writeSessionIfCurrent,
} from "@/auth/storage";
import {
  invalidateSessionOperations,
  sessionOperationGeneration,
} from "@/auth/session-operations";

const mockSecureStore = jest.requireMock("expo-secure-store") as {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
};

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  idToken: "id-token",
  expiresAt: 1_900_000_000_000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSecureStore.getItemAsync.mockResolvedValue(null);
  mockSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);
});

it("reads and writes the namespaced SecureStore session", async () => {
  await writeSession(session, "admin");
  expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.admin.session",
    JSON.stringify({ schemaVersion: 1, session }),
  );

  mockSecureStore.getItemAsync.mockResolvedValueOnce(
    JSON.stringify({ schemaVersion: 1, session }),
  );
  await expect(readSession("admin")).resolves.toEqual(session);
});

it("returns an empty session when SecureStore has no value", async () => {
  await expect(readSession()).resolves.toBeNull();
});

it("serializes session mutations and rejects stale writes", async () => {
  const generation = sessionOperationGeneration("account");
  await expect(
    writeSessionIfCurrent(session, "account", generation),
  ).resolves.toBe(true);

  const staleGeneration = sessionOperationGeneration("account");
  invalidateSessionOperations("account");
  await expect(
    writeSessionIfCurrent(session, "account", staleGeneration),
  ).resolves.toBeUndefined();
  expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(1);
});

it("clears the default session and only clears a current conditional session", async () => {
  await clearSession();
  const generation = sessionOperationGeneration("account");
  await expect(clearSessionIfCurrent("account", generation)).resolves.toBe(
    true,
  );
  expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);

  const staleGeneration = sessionOperationGeneration("account");
  invalidateSessionOperations("account");
  await expect(
    clearSessionIfCurrent("account", staleGeneration),
  ).resolves.toBeUndefined();
  expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
});

it("saves, consumes, and clears a one-time OAuth transaction", async () => {
  const transaction = {
    clientId: "mobile-account-console",
    codeVerifier: "A".repeat(43),
    createdAt: Date.now(),
    redirectUri: "kitezh://oauth/callback",
    state: "state-value-123",
  };
  await saveOAuthTransaction("account", transaction);
  expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.account.oauth-transaction",
    JSON.stringify({ schemaVersion: 1, transaction }),
  );

  mockSecureStore.getItemAsync.mockResolvedValueOnce(
    JSON.stringify({ schemaVersion: 1, transaction }),
  );
  await expect(
    consumeOAuthTransaction("account", {
      clientId: transaction.clientId,
      redirectUri: transaction.redirectUri,
    }),
  ).resolves.toEqual(transaction);
  expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
    "kitezh.mobile.account.oauth-transaction",
  );
  await clearOAuthTransaction("account");
});
