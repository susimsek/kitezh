import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopApiAdapter } from "../dist/api/desktop-api.js";

test("clears an expired session that has no refresh token after an unauthorized request", async () => {
  const clearedNamespaces = [];
  const requests = [];
  const adapter = createDesktopApiAdapter({
    apiBaseUrl: "https://kitezh.onrender.com",
    readSession: async () => ({
      accessToken: "expired-access",
      expiresAt: 0,
      version: 1,
    }),
    writeSession: async () => {
      assert.fail("A session without a refresh token cannot be renewed");
    },
    clearSession: async (namespace) => {
      clearedNamespaces.push(namespace);
    },
    fetcher: async (url, options) => {
      requests.push({ url: String(url), method: options.method });
      return new Response("unauthorized", { status: 401 });
    },
  });

  const response = await adapter.request({
    console: "account",
    path: "/api/account/profile",
  });

  assert.deepEqual(response, { status: 401, kind: "unauthorized", body: null });
  assert.equal(requests.length, 1, "No token endpoint request should be made");
  assert.deepEqual(clearedNamespaces, ["account"]);
});
