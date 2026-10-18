import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopApiAdapter } from "../dist/api/desktop-api.js";

test("successful refresh rotates optional ID and refresh tokens and retries once", async () => {
  let current = {
    accessToken: "expired-access",
    refreshToken: "old-refresh",
    idToken: "old-id",
    expiresAt: 0,
    version: 1,
  };
  const requests = [];
  const adapter = createDesktopApiAdapter({
    apiBaseUrl: "https://kitezh.onrender.com",
    readSession: async () => current,
    writeSession: async (_namespace, next) => {
      current = next;
    },
    clearSession: async () => {
      current = null;
    },
    fetcher: async (url) => {
      const requestUrl = String(url);
      requests.push(requestUrl);
      if (requestUrl.endsWith("/oauth2/token"))
        return new Response(
          JSON.stringify({
            access_token: "fresh-access",
            expires_in: 300,
            id_token: "fresh-id",
            refresh_token: "fresh-refresh",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      return new Response("{}", {
        status: requests.length === 1 ? 401 : 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const response = await adapter.request({
    console: "account",
    path: "/api/account/profile",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requests.map((url) => new URL(url).pathname), [
    "/api/account/profile",
    "/oauth2/token",
    "/api/account/profile",
  ]);
  assert.equal(current.accessToken, "fresh-access");
  assert.equal(current.idToken, "fresh-id");
  assert.equal(current.refreshToken, "fresh-refresh");
  assert.ok(current.expiresAt > Date.now());
});
