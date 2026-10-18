import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopApiAdapter } from "../dist/api/desktop-api.js";

const previousSession = {
  accessToken: "expired-access",
  refreshToken: "refresh-secret",
  idToken: "id-secret",
  expiresAt: 0,
  version: 1,
};

const invalidTokenResponses = [
  { name: "missing access token", body: { expires_in: 300 } },
  { name: "string expiry", body: { access_token: "new-access", expires_in: "300" } },
  { name: "zero expiry", body: { access_token: "new-access", expires_in: 0 } },
  { name: "negative expiry", body: { access_token: "new-access", expires_in: -1 } },
];

for (const scenario of invalidTokenResponses) {
  test(`invalid refresh response with ${scenario.name} clears the session`, async () => {
    let current = previousSession;
    const requests = [];
    const cleared = [];
    const adapter = createDesktopApiAdapter({
      apiBaseUrl: "https://kitezh.onrender.com",
      readSession: async () => current,
      writeSession: async (_namespace, session) => {
        current = session;
      },
      clearSession: async (namespace) => {
        cleared.push(namespace);
        current = null;
      },
      fetcher: async (url) => {
        requests.push(String(url));
        if (String(url).endsWith("/oauth2/token"))
          return new Response(JSON.stringify(scenario.body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        return new Response("unauthorized", { status: 401 });
      },
    });

    const response = await adapter.request({
      console: "account",
      path: "/api/account/profile",
    });

    assert.deepEqual(response, { status: 401, kind: "unauthorized", body: null });
    assert.equal(requests.length, 2, "Invalid token data must not be retried");
    assert.equal(requests[1], "https://kitezh.onrender.com/oauth2/token");
    assert.deepEqual(cleared, ["account"]);
    assert.equal(current, null);
  });
}
