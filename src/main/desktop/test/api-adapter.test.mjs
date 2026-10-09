import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopApiAdapter } from "../dist/api/desktop-api.js";

const session = {
  accessToken: "old-access",
  refreshToken: "refresh-secret",
  idToken: "id-secret",
  expiresAt: Date.now() + 60_000,
  version: 1,
};

function harness(fetcher) {
  let current = { ...session };
  const cleared = [];
  return {
    adapter: createDesktopApiAdapter({
      apiBaseUrl: "https://kitezh.onrender.com",
      fetcher,
      readSession: async () => current,
      writeSession: async (_namespace, next) => {
        current = next;
      },
      clearSession: async (namespace) => {
        cleared.push(namespace);
        current = null;
      },
    }),
    cleared,
    session: () => current,
  };
}

test("refreshes once and retries concurrent requests without exposing refresh data", async () => {
  let requests = 0;
  let refreshes = 0;
  const { adapter, session: readSession } = harness(async (url) => {
    requests += 1;
    if (url.endsWith("/oauth2/token")) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(
        JSON.stringify({ access_token: "new-access", expires_in: 300 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: requests === 1 ? 401 : 200,
      headers: { "content-type": "application/json" },
    });
  });

  const first = adapter.request({ console: "account", path: "/api/account/profile" });
  const second = adapter.request({ console: "account", path: "/api/account/sessions?page=0&size=20" });
  const results = await Promise.all([first, second]);

  assert.equal(refreshes, 1);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.equal(readSession().accessToken, "new-access");
});

test("keeps forbidden responses authoritative and rejects non-account paths", async () => {
  const { adapter } = harness(async () => new Response("forbidden", { status: 403 }));
  const response = await adapter.request({ console: "account", path: "/api/account/profile" });
  assert.equal(response.kind, "forbidden");
  await assert.rejects(
    adapter.request({ console: "account", path: "/oauth2/token" }),
    /not allowed/,
  );
});

test("maps transport failures to a recoverable offline result", async () => {
  const { adapter } = harness(async () => {
    throw new TypeError("network unavailable");
  });
  const response = await adapter.request({ console: "account", path: "/api/account/profile" });
  assert.equal(response.status, 0);
  assert.equal(response.kind, "offline");
});
