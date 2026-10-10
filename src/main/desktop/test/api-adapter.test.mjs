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

  const first = adapter.request({
    console: "account",
    path: "/api/account/profile",
  });
  const second = adapter.request({
    console: "account",
    path: "/api/account/sessions?page=0&size=20",
  });
  const results = await Promise.all([first, second]);

  assert.equal(refreshes, 1);
  assert.deepEqual(
    results.map((result) => result.status),
    [200, 200],
  );
  assert.equal(readSession().accessToken, "new-access");
});

test("keeps forbidden responses authoritative and rejects unapproved API paths", async () => {
  const { adapter } = harness(
    async () => new Response("forbidden", { status: 403 }),
  );
  const response = await adapter.request({
    console: "account",
    path: "/api/account/profile",
  });
  assert.equal(response.kind, "forbidden");
  await assert.rejects(
    adapter.request({ console: "account", path: "/oauth2/token" }),
    /not allowed/,
  );
});

test("limits the Admin namespace to read-only dashboard and bounded user-list contracts", async () => {
  const { adapter } = harness(
    async () =>
      new Response(
        JSON.stringify({ clients: 2, users: 3, sessions: 4, consents: 5 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  );
  const response = await adapter.request({
    console: "admin",
    path: "/api/admin/dashboard",
  });
  assert.equal(response.status, 200);
  await assert.rejects(
    adapter.request({ console: "account", path: "/api/admin/dashboard" }),
    /not allowed/,
  );
  const users = await adapter.request({
    console: "admin",
    path: "/api/admin/users?q=alice&page=1&size=20&sort=username,asc",
  });
  assert.equal(users.status, 200);
  const roles = await adapter.request({
    console: "admin",
    path: "/api/admin/roles?q=USER&page=0&size=20&sort=name,asc",
  });
  assert.equal(roles.status, 200);
  const groups = await adapter.request({
    console: "admin",
    path: "/api/admin/groups?q=finance&page=0&size=20&sort=name,asc",
  });
  assert.equal(groups.status, 200);
  const clientScopes = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes?q=account&page=0&size=20&sort=name,asc",
  });
  assert.equal(clientScopes.status, 200);
  const clients = await adapter.request({
    console: "admin",
    path: "/api/admin/clients?q=console&page=0&size=20&sort=clientId,asc",
  });
  assert.equal(clients.status, 200);
  const identityProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers?q=google&page=0&size=20&sort=guiOrder,asc",
  });
  assert.equal(identityProviders.status, 200);
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/roles/ROLE_USER" }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/users/2" }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/users?size=101" }),
    /not allowed/,
  );
});

test("maps transport failures to a recoverable offline result", async () => {
  const { adapter } = harness(async () => {
    throw new TypeError("network unavailable");
  });
  const response = await adapter.request({
    console: "account",
    path: "/api/account/profile",
  });
  assert.equal(response.status, 0);
  assert.equal(response.kind, "offline");
});

test("maps request timeouts and validation problems to typed responses", async () => {
  const timedOut = createDesktopApiAdapter({
    apiBaseUrl: "https://kitezh.onrender.com",
    fetcher: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("request aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    readSession: async () => session,
    writeSession: async () => {},
    clearSession: async () => {},
    timeoutMs: 1,
  });
  const timeoutResponse = await timedOut.request({
    console: "admin",
    path: "/api/admin/dashboard",
  });
  assert.equal(timeoutResponse.kind, "timeout");

  const { adapter } = harness(
    async () =>
      new Response(
        JSON.stringify({
          detail: "Correct the request.",
          violations: [{ field: "name", message: "Required." }],
        }),
        {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        },
      ),
  );
  const validationResponse = await adapter.request({
    console: "admin",
    path: "/api/admin/dashboard",
  });
  assert.equal(validationResponse.kind, "validation");
  assert.equal(validationResponse.body.violations[0].field, "name");
});
