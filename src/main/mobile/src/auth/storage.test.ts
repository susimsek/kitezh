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
  const storage = createSessionStorage(
    createStore(JSON.stringify({ accessToken: "access", expiresAt: 123 })),
  );

  assert.deepEqual(await storage.readSession(), {
    accessToken: "access",
    refreshToken: null,
    idToken: null,
    expiresAt: 123,
  });
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
    assert.equal(
      await createSessionStorage(createStore(stored)).readSession(),
      null,
    );
  }
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
  assert.equal(
    store.entries.get("kitezh.mobile.admin.session"),
    JSON.stringify(session),
  );
  await storage.clearSession("admin");
  assert.equal(store.entries.has("kitezh.mobile.admin.session"), false);
});
