import assert from "node:assert/strict";
import test from "node:test";

import { createSessionStorage } from "./session-storage.ts";

function createStore(value: string | null) {
  const entries = new Map<string, string>();
  if (value !== null) entries.set("kitezh.mobile.account.session", value);
  return {
    entries,
    getItemAsync: async (key: string) => entries.get(key) ?? null,
    setItemAsync: async (key: string, item: string) => {
      entries.set(key, item);
    },
    deleteItemAsync: async (key: string) => {
      entries.delete(key);
    },
  };
}

test("reads valid sessions and fills missing optional tokens", async () => {
  const store = createStore(
    JSON.stringify({ accessToken: "access", expiresAt: 123 }),
  );
  const storage = createSessionStorage(store);

  assert.deepEqual(await storage.readSession(), {
    accessToken: "access",
    refreshToken: null,
    idToken: null,
    expiresAt: 123,
  });
  assert.deepEqual(
    JSON.parse(store.entries.get("kitezh.mobile.account.session")!),
    {
      schemaVersion: 1,
      session: {
        accessToken: "access",
        refreshToken: null,
        idToken: null,
        expiresAt: 123,
      },
    },
  );
});

test("rejects absent, malformed, and invalid session values", async () => {
  for (const stored of [
    null,
    "{invalid",
    JSON.stringify({ expiresAt: 123 }),
    JSON.stringify({ accessToken: "access", expiresAt: "123" }),
    JSON.stringify({ accessToken: "access", expiresAt: Number.NaN }),
    JSON.stringify({ accessToken: "access", expiresAt: 123, refreshToken: 2 }),
    JSON.stringify({ accessToken: "access", expiresAt: 123, idToken: false }),
  ]) {
    const store = createStore(stored);
    assert.equal(await createSessionStorage(store).readSession(), null);
    if (stored !== null) {
      assert.equal(store.entries.has("kitezh.mobile.account.session"), false);
    }
  }
});

test("rejects and removes sessions from unsupported storage versions", async () => {
  const store = createStore(
    JSON.stringify({
      schemaVersion: 2,
      session: { accessToken: "access", expiresAt: 123 },
    }),
  );
  assert.equal(await createSessionStorage(store).readSession(), null);
  assert.equal(store.entries.has("kitezh.mobile.account.session"), false);
});

test("writes and clears sessions in their isolated namespace", async () => {
  const store = createStore(null);
  const storage = createSessionStorage(store);
  const session = {
    accessToken: "access",
    refreshToken: "refresh",
    idToken: "id",
    expiresAt: 123,
  };

  await storage.writeSession(session, "admin");
  assert.deepEqual(
    JSON.parse(store.entries.get("kitezh.mobile.admin.session")!),
    {
      schemaVersion: 1,
      session,
    },
  );
  await storage.clearSession("admin");
  assert.equal(store.entries.has("kitezh.mobile.admin.session"), false);
});

test("restores the account session after storage recreation and keeps logout durable", async () => {
  const store = createStore(null);
  const session = {
    accessToken: "access",
    refreshToken: "refresh",
    idToken: "id",
    expiresAt: 123,
  };

  await createSessionStorage(store).writeSession(session, "account");

  const restartedStorage = createSessionStorage(store);
  assert.deepEqual(await restartedStorage.readSession("account"), session);
  assert.equal(await restartedStorage.readSession("admin"), null);

  await restartedStorage.clearSession("account");
  assert.equal(await createSessionStorage(store).readSession("account"), null);
});
