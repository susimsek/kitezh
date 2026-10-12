import assert from "node:assert/strict";
import test from "node:test";

import {
  createOAuthTransactionStorage,
  OAUTH_TRANSACTION_MAX_AGE_MS,
} from "./oauth-transaction-storage.ts";

function createStore() {
  const values = new Map<string, string>();
  return {
    deleteItemAsync: async (key: string) => void values.delete(key),
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) =>
      void values.set(key, value),
    values,
  };
}

test("OAuth transactions are namespaced, short lived, and consumed once", async () => {
  const storage = createStore();
  const transactions = createOAuthTransactionStorage(storage);
  const transaction = {
    clientId: "mobile-account-console",
    codeVerifier: "v".repeat(43),
    createdAt: 1_000,
    redirectUri: "kitezh://oauth/callback",
    state: "one-time-state",
  };
  await transactions.save("account", transaction);
  assert.equal(storage.values.size, 1);
  assert.equal(await transactions.consume("admin", transaction), null);
  assert.deepEqual(
    await transactions.consume("account", transaction, 1_001),
    transaction,
  );
  assert.equal(await transactions.consume("account", transaction, 1_002), null);
  assert.equal(storage.values.size, 0);
});

test("OAuth transactions reject expired, future, and mismatched records", async () => {
  const storage = createStore();
  const transactions = createOAuthTransactionStorage(storage);
  const transaction = {
    clientId: "mobile-account-console",
    codeVerifier: "v".repeat(43),
    createdAt: 1_000,
    redirectUri: "kitezh://oauth/callback",
    state: "one-time-state",
  };

  await transactions.save("account", transaction);
  assert.equal(
    await transactions.consume(
      "account",
      transaction,
      1_000 + OAUTH_TRANSACTION_MAX_AGE_MS + 1,
    ),
    null,
  );
  await transactions.save("account", transaction);
  assert.equal(
    await transactions.consume(
      "account",
      { ...transaction, clientId: "other" },
      999,
    ),
    null,
  );
  await transactions.save("account", transaction);
  assert.equal(await transactions.consume("account", transaction, 999), null);
  assert.equal(storage.values.size, 0);
});
