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

test("client detail bridge permits exact scoped contracts and rejects widened variants", async () => {
  const { adapter } = harness(async () => new Response("{}", { status: 200 }));
  for (const [method, path] of [
    [
      "GET",
      "/api/admin/clients/account-console/scope-evaluation?scopes=openid+profile&subject=user",
    ],
    ["POST", "/api/admin/clients/example/secret"],
    ["GET", "/api/admin/clients/account-console/sessions?page=0&size=10"],
    ["GET", "/api/admin/clients/account-console/consents?page=1&size=50"],
    ["GET", "/api/admin/clients/account-console/events?page=0&size=100"],
    ["DELETE", "/api/admin/clients/account-console/sessions"],
    ["DELETE", "/api/admin/clients/account-console/sessions/session-1"],
    ["GET", "/api/admin/clients?sort=clientName,asc&page=0&size=10"],
    ["GET", "/api/admin/clients?sort=clientName,desc&page=0&size=10"],
  ])
    assert.equal(
      (await adapter.request({ console: "admin", method, path })).status,
      200,
      path,
    );
  for (const [method, path] of [
    ["GET", "/api/admin/clients/example/secret"],
    ["POST", "/api/admin/clients/example/secret?extra=1"],
    ["POST", "/api/admin/clients/example/secret/nested"],
    ["GET", "/api/admin/clients/example/sessions?page=0&page=1"],
    ["GET", "/api/admin/clients/example/sessions?size=101"],
    ["GET", "/api/admin/clients/example/events?sort=password,asc"],
    ["GET", "/api/admin/clients/example/consents?page=-1"],
    ["GET", "/api/admin/clients/example/sessions/session-1"],
    ["DELETE", "/api/admin/clients/example/sessions/session-1?extra=1"],
    ["GET", "/api/admin/clients/example/scope-evaluation?subject=a&subject=b"],
    [
      "GET",
      "/api/admin/clients/example/scope-evaluation?scopes=" + "a".repeat(2001),
    ],
    ["GET", "/api/admin/clients/example/scope-evaluation#fragment"],
  ])
    await assert.rejects(
      adapter.request({ console: "admin", method, path }),
      /not allowed/,
      path,
    );
  await assert.rejects(
    adapter.request({
      console: "account",
      method: "POST",
      path: "/api/admin/clients/example/secret",
    }),
    /not allowed/,
  );
});

test("group bridge accepts detail, settings, permissions, roles and bounded members only", async () => {
  const { adapter } = harness(async () => new Response("{}", { status: 200 }));
  for (const [method, path, body] of [
    ["GET", "/api/admin/groups/7"],
    [
      "PUT",
      "/api/admin/groups/7",
      { name: "Finance", parentId: null, attributes: {}, defaultGroup: true },
    ],
    ["GET", "/api/admin/groups?q=fin&page=1&size=50&sort=name,desc"],
    ["GET", "/api/admin/groups/7/permissions"],
    ["PUT", "/api/admin/groups/7/permissions", { permissions: [] }],
    ["PUT", "/api/admin/groups/7/roles", { roles: ["ROLE_USER"] }],
    [
      "GET",
      "/api/admin/groups/7/users?q=ada&page=0&size=10&sort=username,desc",
    ],
    ["GET", "/api/admin/groups/7/available-users?q=ad&page=0&size=10"],
    ["POST", "/api/admin/groups/7/users", { userId: 8 }],
    ["DELETE", "/api/admin/groups/7/users/8"],
    ["DELETE", "/api/admin/groups/7"],
  ])
    assert.equal(
      (
        await adapter.request({
          console: "admin",
          method,
          path,
          ...(body ? { body } : {}),
        })
      ).status,
      200,
      path,
    );
  for (const path of [
    "/api/admin/groups/0",
    "/api/admin/groups/07",
    "/api/admin/groups/-7",
    "/api/admin/groups/9007199254740992",
    "/api/admin/groups/7?extra=1",
    "/api/admin/groups/7/nested",
    "/api/admin/groups/7#hash",
    "/api/admin/groups?page=0&page=1",
    "/api/admin/groups?size=101",
    "/api/admin/groups?sort=username,asc",
    "/api/admin/groups/7/users?sort=name,asc",
    "/api/admin/groups/7/users?page=-1",
    "/api/admin/groups/7/users?q=a&q=b",
    "/api/admin/groups/7/available-users?size=0",
    "/api/admin/groups/9007199254740992/users?page=0",
  ])
    await assert.rejects(
      adapter.request({ console: "admin", path }),
      /not allowed/,
      path,
    );
  await assert.rejects(
    adapter.request({ console: "account", path: "/api/admin/groups/7" }),
    /not allowed/,
  );
});

test("role membership bridge accepts exact bounded contracts and rejects malformed paths, parameters and bodies", async () => {
  const requests = [];
  const { adapter } = harness(async (url, options) => {
    requests.push({ url, options });
    return new Response("{}", { status: 200 });
  });
  const base = "/api/admin/roles/ROLE_AUDITOR";
  for (const [method, suffix, body] of [
    ["GET", ""],
    ["GET", "?q=ada&enabled=false&page=1&size=100&sort=email,desc"],
    ["GET", "/available-users?q=ada&page=0&size=10&sort=username,asc"],
    ["POST", "/users", { userId: 7 }],
    ["DELETE", "/users/7"],
  ]) {
    const response = await adapter.request({
      console: "admin",
      method,
      path: base + suffix,
      ...(body ? { body } : {}),
    });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 5);
  for (const [method, path, body] of [
    ["GET", base + "?page=-1"],
    ["GET", base + "?page=1000001"],
    ["GET", base + "?size=101"],
    ["GET", base + "?page=01"],
    ["GET", base + "?size=0"],
    ["GET", base + "?q=a&q=b"],
    ["GET", base + "?sort=password,asc"],
    ["GET", base + "?enabled=yes"],
    ["GET", base + "?extra=1"],
    ["GET", base + "#fragment"],
    ["GET", base + "?q=" + "a".repeat(201)],
    ["GET", base + "/available-users?enabled=true"],
    ["GET", base + "/available-users/1"],
    ["DELETE", base + "/users/0"],
    ["DELETE", base + "/users/9007199254740992"],
    ["DELETE", base + "/users/7/nested"],
    ["DELETE", base + "/users/7?q=a"],
    ["POST", base + "/users", { userId: "7" }],
    ["POST", base + "/users", { userId: -1 }],
    ["POST", base + "/users", { userId: 9007199254740992 }],
    ["POST", base + "/users", { userId: 7, role: "ROLE_ADMIN" }],
    ["POST", base + "/users", [7]],
    ["POST", base + "/users", null],
    ["GET", "/api/admin/roles/ROLE_lower?size=10"],
    ["GET", "/api/admin/roles/ROLE_" + "A".repeat(46)],
    ["GET", "/api/admin/roles/ROLE_AUDITOR%2Fusers"],
    ["POST", base + "/available-users"],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", method, path, body }),
      /not allowed|Invalid role user assignment/,
    );
  }
  await assert.rejects(
    adapter.request({ console: "account", method: "GET", path: base }),
    /not allowed/,
  );
  assert.equal(requests.length, 5, "Rejected requests must never reach fetch");
});

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

test("allows bounded user required-action reads and mutations", async () => {
  const requests = [];
  const { adapter } = harness(async (url, init) => {
    requests.push([new URL(url).pathname, init.method]);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  for (const [method, path] of [
    ["GET", "/api/admin/required-actions/users/1"],
    ["POST", "/api/admin/required-actions/users/1/UPDATE_PASSWORD"],
    ["DELETE", "/api/admin/required-actions/users/1/UPDATE_PASSWORD"],
  ]) {
    const response = await adapter.request({ console: "admin", method, path });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 3);
  for (const [method, path] of [
    ["PUT", "/api/admin/required-actions/users/1/UPDATE_PASSWORD"],
    ["GET", "/api/admin/required-actions/users/1/UPDATE_PASSWORD"],
    ["POST", "/api/admin/required-actions/users/1"],
    ["GET", "/api/admin/required-actions/users/1?all=true"],
    ["GET", "/api/admin/required-actions/users/01"],
    ["POST", "/api/admin/required-actions/users/1/../UPDATE_PASSWORD"],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", method, path }),
      /not allowed/,
    );
  }
  assert.equal(requests.length, 3);
});

test("allows only the read-only readiness probe for the Admin dashboard", async () => {
  let requestedUrl;
  const { adapter } = harness(async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({ status: "UP" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const response = await adapter.request({
    console: "admin",
    path: "/actuator/health/readiness",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "UP" });
  assert.equal(
    requestedUrl,
    "https://kitezh.onrender.com/actuator/health/readiness",
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      method: "POST",
      path: "/actuator/health/readiness",
    }),
    /not allowed/,
  );
});

test("uploads only bounded Admin avatar payloads as multipart data", async () => {
  let captured;
  const { adapter } = harness(async (_url, init) => {
    captured = init;
    return new Response(JSON.stringify({ avatarUrl: "/avatars/test?v=1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const bytes = Buffer.from("avatar-bytes");
  const response = await adapter.request({
    console: "admin",
    path: "/api/admin/users/7/avatar",
    method: "PUT",
    body: { contentType: "image/png", dataBase64: bytes.toString("base64") },
  });
  assert.equal(response.status, 200);
  assert.equal(captured.headers["Content-Type"], undefined);
  assert.ok(captured.body instanceof FormData);
  const file = captured.body.get("file");
  assert.equal(file.type, "image/png");
  assert.equal(file.size, bytes.length);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/7/avatar",
      method: "PUT",
      body: { contentType: "image/svg+xml", dataBase64: "PHN2Zz4=" },
    }),
    /Invalid native avatar payload/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/7/avatar?override=true",
      method: "PUT",
      body: { contentType: "image/png", dataBase64: bytes.toString("base64") },
    }),
    /not allowed/,
  );
});

test("allows only exact client scope protocol mapper routes", async () => {
  const requests = [];
  const { adapter } = harness(async (url, init) => {
    requests.push({ url: String(url), method: init.method });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  for (const [method, path] of [
    [
      "GET",
      "/api/admin/client-scopes/scope-main/mappers?page=0&size=20&sort=name,asc",
    ],
    ["POST", "/api/admin/client-scopes/scope-main/mappers"],
    ["PUT", "/api/admin/client-scopes/scope-main/mappers/12"],
    ["DELETE", "/api/admin/client-scopes/scope-main/mappers/12"],
  ]) {
    const response = await adapter.request({ console: "admin", path, method });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 4);
  for (const [method, path] of [
    ["POST", "/api/admin/client-scopes/scope-main/mappers/12"],
    ["PUT", "/api/admin/client-scopes/scope-main/mappers/0"],
    ["DELETE", "/api/admin/client-scopes/scope-main/mappers/12/nested"],
    ["GET", "/api/admin/client-scopes/scope-main/mappers?size=1000"],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method }),
      /not allowed/,
    );
  }
});

test("allows only the exact authenticated Admin revoke-all sessions route", async () => {
  const requests = [];
  const { adapter } = harness(async (url, init) => {
    requests.push({ url: String(url), method: init.method, body: init.body });
    return new Response(null, { status: 204 });
  });
  const response = await adapter.request({
    console: "admin",
    path: "/api/admin/sessions/revoke-all",
    method: "POST",
  });
  assert.equal(response.status, 204);
  assert.deepEqual(requests, [
    {
      url: "https://kitezh.onrender.com/api/admin/sessions/revoke-all",
      method: "POST",
      body: undefined,
    },
  ]);
  for (const path of [
    "/api/admin/sessions/revoke-all?all=true",
    "/api/admin/sessions/revoke-all/nested",
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method: "POST" }),
      /not allowed/,
    );
  }
});

test("allows bounded native realm-role composite reads and mutations only", async () => {
  const requests = [];
  const { adapter } = harness(async (url, init) => {
    requests.push({ url: String(url), method: init.method });
    return new Response(JSON.stringify({ compositeRoles: ["ROLE_VIEWER"] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  for (const [method, path] of [
    ["GET", "/api/admin/roles/ROLE_ADMIN"],
    [
      "GET",
      "/api/admin/roles/ROLE_ADMIN/available-composites?q=VIEW&page=0&size=10&sort=name,asc",
    ],
    [
      "GET",
      "/api/admin/roles/ROLE_ADMIN/available-client-composites?q=VIEW&page=0&size=10&sort=name,asc",
    ],
    [
      "POST",
      "/api/admin/roles/ROLE_ADMIN/composites/ROLE_VIEWER?page=0&size=20&sort=username,asc",
    ],
    [
      "DELETE",
      "/api/admin/roles/ROLE_ADMIN/composites/ROLE_VIEWER?page=0&size=20&sort=username,asc",
    ],
    [
      "POST",
      "/api/admin/roles/ROLE_ADMIN/client-composites/42?page=0&size=20&sort=username,asc",
    ],
    [
      "DELETE",
      "/api/admin/roles/ROLE_ADMIN/client-composites/42?page=0&size=20&sort=username,asc",
    ],
  ]) {
    const response = await adapter.request({ console: "admin", path, method });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 7);
  for (const [method, path] of [
    ["GET", "/api/admin/roles/ROLE_ADMIN?size=101"],
    [
      "GET",
      "/api/admin/roles/ROLE_ADMIN/available-composites?q=V&page=0&size=10&sort=name,asc",
    ],
    [
      "GET",
      "/api/admin/roles/ROLE_ADMIN/available-client-composites?q=V&page=0&size=10&sort=name,asc",
    ],
    [
      "POST",
      "/api/admin/roles/ROLE_ADMIN/composites/ROLE_VIEWER?page=0&size=20&sort=username,asc&extra=true",
    ],
    [
      "DELETE",
      "/api/admin/roles/ROLE_ADMIN/composites/ROLE_VIEWER/nested?page=0&size=20&sort=username,asc",
    ],
    [
      "POST",
      "/api/admin/roles/ROLE_ADMIN/client-composites/42?page=0&size=20&sort=username,asc&extra=true",
    ],
    [
      "DELETE",
      "/api/admin/roles/ROLE_ADMIN/client-composites/42/nested?page=0&size=20&sort=username,asc",
    ],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method }),
      /not allowed/,
    );
  }
});

test("allows bounded client-role CRUD routes only", async () => {
  const requests = [];
  const { adapter } = harness(async (url, init) => {
    requests.push({ url: String(url), method: init.method });
    return new Response(JSON.stringify({ id: 42, name: "invoice.read" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  for (const [method, path, body] of [
    [
      "GET",
      "/api/admin/clients/billing-api/roles?q=invoice&page=0&size=20&sort=name,asc",
    ],
    ["POST", "/api/admin/clients/billing-api/roles", { name: "invoice.read" }],
    [
      "PUT",
      "/api/admin/clients/billing-api/roles/42",
      { name: "invoice.view" },
    ],
    ["DELETE", "/api/admin/clients/billing-api/roles/42"],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42?page=0&size=20&sort=username,asc",
    ],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-users?q=ad&page=0&size=10&sort=username,asc",
    ],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-groups?q=fi&page=0&size=10&sort=name,asc",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/users?page=0&size=20&sort=username,asc",
      { userId: 7 },
    ],
    [
      "DELETE",
      "/api/admin/clients/billing-api/roles/42/users/7?page=0&size=20&sort=username,asc",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/groups/8?page=0&size=20&sort=username,asc",
    ],
    [
      "DELETE",
      "/api/admin/clients/billing-api/roles/42/groups/8?page=0&size=20&sort=username,asc",
    ],
  ]) {
    const response = await adapter.request({
      console: "admin",
      path,
      method,
      ...(body ? { body } : {}),
    });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 11);
  for (const [method, path] of [
    ["GET", "/api/admin/clients/billing-api/roles?size=1000"],
    ["GET", "/api/admin/clients/billing-api/roles/nested"],
    ["POST", "/api/admin/clients/billing-api/roles/42"],
    ["PUT", "/api/admin/clients/billing-api/roles/0"],
    ["DELETE", "/api/admin/clients/billing-api/roles/42/nested"],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-users?q=a&page=0&size=10&sort=username,asc",
    ],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-groups?q=fi&page=0&size=10&sort=name,desc",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/users?page=0&size=20&sort=username,asc&extra=1",
    ],
    [
      "DELETE",
      "/api/admin/clients/billing-api/roles/42/groups/0?page=0&size=20&sort=username,asc",
    ],
    ["POST", "/api/admin/clients/billing-api/roles/42/groups/8"],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method }),
      /not allowed/,
    );
  }
});

test("allows only bounded client-role composite routes", async () => {
  const requests = [];
  const { adapter } = harness(async (url, init) => {
    requests.push({ url: String(url), method: init.method });
    return new Response(
      JSON.stringify({ compositeRoles: [], compositeRealmRoles: [] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  });
  for (const [method, path] of [
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-composites?q=invoice&page=0&size=10&sort=name,asc",
    ],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-realm-composites?q=ROLE&page=0&size=10&sort=name,asc",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/composites/43?page=0&size=20&sort=username,asc",
    ],
    [
      "DELETE",
      "/api/admin/clients/billing-api/roles/42/composites/43?page=0&size=20&sort=username,asc",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/realm-composites/ROLE_USER?page=0&size=20&sort=username,asc",
    ],
    [
      "DELETE",
      "/api/admin/clients/billing-api/roles/42/realm-composites/ROLE_USER?page=0&size=20&sort=username,asc",
    ],
  ]) {
    const response = await adapter.request({ console: "admin", path, method });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 6);
  for (const [method, path] of [
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-composites?q=x&page=0&size=10&sort=name,asc",
    ],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-realm-composites?q=ROLE&page=0&size=100&sort=name,asc",
    ],
    [
      "GET",
      "/api/admin/clients/billing-api/roles/42/available-composites?q=invoice&page=0&size=10&sort=name,asc&extra=1",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/composites/43/nested?page=0&size=20&sort=username,asc",
    ],
    [
      "DELETE",
      "/api/admin/clients/billing-api/roles/42/realm-composites/ROLE_user?page=0&size=20&sort=username,asc",
    ],
    [
      "POST",
      "/api/admin/clients/billing-api/roles/42/realm-composites/ROLE_USER?page=0&size=20&sort=username,asc&page=0",
    ],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method }),
      /not allowed/,
    );
  }
  assert.equal(requests.length, 6);
});

test("allows only the client scope assignment read and replacement routes", async () => {
  const { adapter } = harness(
    async () =>
      new Response(JSON.stringify({ defaultScopes: ["openid"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  for (const [method, path] of [
    ["GET", "/api/admin/clients/client-main/scope-assignments"],
    ["PUT", "/api/admin/clients/client-main/scope-assignments"],
  ]) {
    const response = await adapter.request({ console: "admin", path, method });
    assert.equal(response.status, 200);
  }
  for (const [method, path] of [
    ["POST", "/api/admin/clients/client-main/scope-assignments"],
    ["PUT", "/api/admin/clients/client-main/scope-assignments/nested"],
    ["PUT", "/api/admin/clients/client-main/scope-assignments?q=unbounded"],
    ["GET", "/api/admin/clients/client-main/scope-assignments?page=1"],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method }),
      /not allowed/,
    );
  }
});

test("allows only exact client protocol mapper routes", async () => {
  const { adapter } = harness(
    async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  for (const [method, path] of [
    [
      "GET",
      "/api/admin/clients/client-main/mappers?page=0&size=20&sort=name,asc",
    ],
    ["POST", "/api/admin/clients/client-main/mappers"],
    ["PUT", "/api/admin/clients/client-main/mappers/12"],
    ["DELETE", "/api/admin/clients/client-main/mappers/12"],
  ]) {
    const response = await adapter.request({ console: "admin", path, method });
    assert.equal(response.status, 200);
  }
  for (const [method, path] of [
    ["POST", "/api/admin/clients/client-main/mappers/12"],
    ["PUT", "/api/admin/clients/client-main/mappers/0"],
    ["DELETE", "/api/admin/clients/client-main/mappers/12/nested"],
    ["GET", "/api/admin/clients/client-main/mappers?size=1000"],
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method }),
      /not allowed/,
    );
  }
});

test("limits the Admin namespace to approved settings writes and bounded read contracts", async () => {
  const requestLanguages = [];
  const { adapter } = harness(async (_url, init) => {
    requestLanguages.push(init.headers["Accept-Language"]);
    return new Response(
      JSON.stringify({ clients: 2, users: 3, sessions: 4, consents: 5 }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  });
  const response = await adapter.request({
    console: "admin",
    path: "/api/admin/dashboard",
    locale: "tr",
  });
  assert.equal(response.status, 200);
  assert.equal(requestLanguages[0], "tr");
  assert.equal(
    (
      await adapter.request({
        console: "admin",
        path: "/api/admin/whoami",
      })
    ).status,
    200,
  );
  for (const path of [
    "/api/admin/whoami?expand=authorities",
    "/api/admin/whoami/",
    "/api/admin/whoami#fragment",
  ])
    await assert.rejects(
      adapter.request({ console: "admin", path }),
      /not allowed/,
    );
  await assert.rejects(
    adapter.request({ console: "account", path: "/api/admin/dashboard" }),
    /not allowed/,
  );
  const users = await adapter.request({
    console: "admin",
    path: "/api/admin/users?q=alice&page=1&size=20&sort=username,asc",
  });
  assert.equal(users.status, 200);
  const filteredUsers = await adapter.request({
    console: "admin",
    path: "/api/admin/users?q=alice&page=0&size=20&sort=username,asc&enabled=true",
  });
  assert.equal(filteredUsers.status, 200);
  const userDetail = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2",
  });
  assert.equal(userDetail.status, 200);
  for (const path of [
    "/api/admin/users/2/groups?q=platform&page=0&size=10&sort=name,asc",
    "/api/admin/users/2/sessions?page=0&size=10&sort=lastAccessTime,desc",
    "/api/admin/users/2/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "/api/admin/users/2/events?page=0&size=10&sort=occurredAt,desc",
  ]) {
    const response = await adapter.request({ console: "admin", path });
    assert.equal(response.status, 200);
  }
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/events?include=secrets",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users?q=alice&page=0&size=20&sort=username,asc&enabled=yes",
    }),
    /not allowed/,
  );
  const createdUser = await adapter.request({
    console: "admin",
    path: "/api/admin/users",
    method: "POST",
    body: {
      username: "new-user",
      password: "temporary-password",
      enabled: true,
      roles: ["ROLE_USER"],
    },
  });
  assert.equal(createdUser.status, 200);
  const bulkUserAction = await adapter.request({
    console: "admin",
    path: "/api/admin/users/bulk",
    method: "POST",
    body: { userIds: [2], action: "ENABLE" },
  });
  assert.equal(bulkUserAction.status, 200);
  const updatedUser = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2",
    method: "PUT",
    body: {
      username: "updated-user",
      firstName: "Updated",
      lastName: "User",
      email: "updated-user@example.test",
      emailVerified: true,
      enabled: true,
      roles: ["ROLE_USER"],
    },
  });
  assert.equal(updatedUser.status, 200);
  const disabledUser = await adapter.request({
    console: "admin",
    path: "/api/admin/users/1/enabled",
    method: "PUT",
    body: { enabled: false },
  });
  assert.equal(disabledUser.status, 200);
  const userActionEmail = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/execute-actions-email?lifespan=43200",
    method: "PUT",
    body: ["UPDATE_PASSWORD"],
  });
  assert.equal(userActionEmail.status, 200);
  const resetUserAuthenticator = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/totp",
    method: "DELETE",
  });
  assert.equal(resetUserAuthenticator.status, 200);
  const unlockUser = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/unlock",
    method: "POST",
  });
  assert.equal(unlockUser.status, 200);
  const resetUserPassword = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/password",
    method: "PUT",
    body: { password: "test-password-not-a-secret", temporary: true },
  });
  assert.equal(resetUserPassword.status, 200);
  const profileAttributeDefinitions = await adapter.request({
    console: "admin",
    path: "/api/admin/profile-attributes",
  });
  assert.equal(profileAttributeDefinitions.status, 200);
  const userProfileAttributes = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/profile-attributes",
  });
  assert.equal(userProfileAttributes.status, 200);
  const updatedUserProfileAttributes = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/profile-attributes",
    method: "PUT",
    body: { attributes: { department: ["IT"] } },
  });
  assert.equal(updatedUserProfileAttributes.status, 200);
  const userPasskeys = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/webauthn/credentials?page=0&size=100",
  });
  assert.equal(userPasskeys.status, 200);
  const renamedUserPasskey = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/webauthn/credentials/credential_123",
    method: "PUT",
    body: { label: "Office laptop" },
  });
  assert.equal(renamedUserPasskey.status, 200);
  const deletedUserPasskey = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2/webauthn/credentials/credential_123",
    method: "DELETE",
  });
  assert.equal(deletedUserPasskey.status, 200);
  const deletedClient = await adapter.request({
    console: "admin",
    path: "/api/admin/clients/client-42",
    method: "DELETE",
  });
  assert.equal(deletedClient.status, 200);
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/clients/client-42/secret",
      method: "DELETE",
    }),
    /not allowed/,
  );
  const deletedUser = await adapter.request({
    console: "admin",
    path: "/api/admin/users/2",
    method: "DELETE",
  });
  assert.equal(deletedUser.status, 200);
  const createdRole = await adapter.request({
    console: "admin",
    path: "/api/admin/roles",
    method: "POST",
    body: { name: "ROLE_NATIVE_VIEWER", description: "Native viewer access" },
  });
  assert.equal(createdRole.status, 200);
  const updatedRole = await adapter.request({
    console: "admin",
    path: "/api/admin/roles/ROLE_AUDITOR",
    method: "PUT",
    body: { name: "ROLE_AUDITOR", description: "Native audit reader" },
  });
  assert.equal(updatedRole.status, 200);
  const deletedRole = await adapter.request({
    console: "admin",
    path: "/api/admin/roles/ROLE_NATIVE_VIEWER",
    method: "DELETE",
  });
  assert.equal(deletedRole.status, 200);
  const createdGroup = await adapter.request({
    console: "admin",
    path: "/api/admin/groups",
    method: "POST",
    body: {
      name: "native-viewers",
      parentId: null,
      attributes: {},
      defaultGroup: false,
    },
  });
  assert.equal(createdGroup.status, 200);
  const providerPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-12/native-policy",
  });
  assert.equal(providerPolicy.status, 200);
  const providerDetails = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-12",
  });
  assert.equal(providerDetails.status, 200);
  const createdProvider = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers",
    method: "POST",
    body: { providerType: "oidc", clientSecret: "transient-test-secret" },
  });
  assert.equal(createdProvider.status, 200);
  const updatedProvider = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-12",
    method: "PUT",
    body: { providerType: "oidc", clientSecret: "" },
  });
  assert.equal(updatedProvider.status, 200);
  const updatedProviderPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-12/native-policy",
    method: "PUT",
    body: {
      displayName: "Acme SSO",
      enabled: true,
      hideOnLogin: false,
      accountLinkingOnly: false,
      trustEmail: false,
      mfaRequired: true,
      guiOrder: 1,
      showInAccountConsole: "always",
      syncMode: "import",
    },
  });
  assert.equal(updatedProviderPolicy.status, 200);
  const renamedGroup = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/name",
    method: "PUT",
    body: { name: "native-observers" },
  });
  assert.equal(renamedGroup.status, 200);
  const updatedGroupRoles = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/roles",
    method: "PUT",
    body: { roles: ["ROLE_USER_VIEWER"] },
  });
  assert.equal(updatedGroupRoles.status, 200);
  const groupMembers = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/users?q=alice&page=0&size=10&sort=username,asc",
  });
  assert.equal(groupMembers.status, 200);
  const availableGroupUsers = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/available-users?page=0&size=10&sort=username,asc",
  });
  assert.equal(availableGroupUsers.status, 200);
  const addedGroupUser = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/users",
    method: "POST",
    body: { userId: 7 },
  });
  assert.equal(addedGroupUser.status, 200);
  const removedGroupUser = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/users/7",
    method: "DELETE",
  });
  assert.equal(removedGroupUser.status, 200);
  const deletedGroup = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12",
    method: "DELETE",
  });
  assert.equal(deletedGroup.status, 200);
  const groupPermissions = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/permissions",
  });
  assert.equal(groupPermissions.status, 200);
  const updatedGroupPermissions = await adapter.request({
    console: "admin",
    path: "/api/admin/groups/12/permissions",
    method: "PUT",
    body: { permissions: [{ userId: 7, permission: "MANAGE_MEMBERS" }] },
  });
  assert.equal(updatedGroupPermissions.status, 200);
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/12/permissions?admin=true",
      method: "PUT",
    }),
    /Native API path is not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/12/permissions/extra",
      method: "PUT",
    }),
    /Native API path is not allowed/,
  );
  const createdClientScope = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes",
    method: "POST",
    body: {
      name: "native-observer",
      displayName: "Native observer",
      description: "Read-only native console scope",
    },
  });
  assert.equal(createdClientScope.status, 200);
  const updatedClientScope = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes/scope-native-observer",
    method: "PUT",
    body: {
      name: "native-observer",
      displayName: "Native observer updated",
      description: "Read-only native console scope",
    },
  });
  assert.equal(updatedClientScope.status, 200);
  const clientScopeRoleMappings = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes/scope-native-observer/role-mappings",
  });
  assert.equal(clientScopeRoleMappings.status, 200);
  const applicationRoleCandidates = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes/scope-native-observer/role-mappings/application-roles?q=VIEWER&page=0&size=20&sort=name,asc",
  });
  assert.equal(applicationRoleCandidates.status, 200);
  const clientRoleCandidates = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes/scope-native-observer/role-mappings/client-roles?q=admin&page=0&size=20&sort=name,asc",
  });
  assert.equal(clientRoleCandidates.status, 200);
  const updatedClientScopeRoleMappings = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes/scope-native-observer/role-mappings",
    method: "PUT",
    body: { applicationRoles: ["ROLE_USER"], clientRoleIds: [12] },
  });
  assert.equal(updatedClientScopeRoleMappings.status, 200);
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/client-scopes/scope-native-observer/role-mappings?includeSecrets=true",
    }),
    /not allowed/,
  );
  const deletedClientScope = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes/scope-native-observer",
    method: "DELETE",
  });
  assert.equal(deletedClientScope.status, 200);
  const revokedOfflineSession = await adapter.request({
    console: "admin",
    path: "/api/admin/offline-sessions/offline-auth-opaque-id",
    method: "DELETE",
  });
  assert.equal(revokedOfflineSession.status, 200);
  const revokedConsent = await adapter.request({
    console: "admin",
    path: "/api/admin/consents/account-console/alice",
    method: "DELETE",
  });
  assert.equal(revokedConsent.status, 200);
  const deletedAdminSession = await adapter.request({
    console: "admin",
    path: "/api/admin/sessions/session-secret-id",
    method: "DELETE",
  });
  assert.equal(deletedAdminSession.status, 200);
  const createdMessageOverride = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization/messages",
    method: "POST",
    body: {
      locale: "tr",
      bundle: "admin",
      messageKey: "native.created",
      messageValue: "Native override",
    },
  });
  assert.equal(createdMessageOverride.status, 200);
  const deletedMessageOverride = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization/messages/7",
    method: "DELETE",
  });
  assert.equal(deletedMessageOverride.status, 200);
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
  const clientMetadata = await adapter.request({
    console: "admin",
    path: "/api/admin/clients/client-1/native-metadata",
  });
  assert.equal(clientMetadata.status, 200);
  const clientConfiguration = await adapter.request({
    console: "admin",
    path: "/api/admin/clients/client-1",
  });
  assert.equal(clientConfiguration.status, 200);
  const updatedClientConfiguration = await adapter.request({
    console: "admin",
    path: "/api/admin/clients/client-1",
    method: "PUT",
    body: { clientId: "service-client", clientName: "Updated Client" },
  });
  assert.equal(updatedClientConfiguration.status, 200);
  const updatedClientMetadata = await adapter.request({
    console: "admin",
    path: "/api/admin/clients/client-1/native-metadata",
    method: "PUT",
    body: { clientName: "Reporting Client" },
  });
  assert.equal(updatedClientMetadata.status, 200);
  const createdClient = await adapter.request({
    console: "admin",
    path: "/api/admin/clients",
    method: "POST",
    body: { clientId: "native-test-client" },
  });
  assert.equal(createdClient.status, 200);
  for (const request of [
    { path: "/api/admin/clients?includeSecrets=true", method: "POST" },
    { path: "/api/admin/clients/client-1?includeSecrets=true" },
    { path: "/api/admin/clients/client-1/nested" },
    { path: "/api/admin/clients/client-1?includeSecrets=true", method: "PUT" },
    { path: "/api/admin/clients/client-1/nested", method: "PUT" },
    { path: "/api/admin/clients/client-1/secret", method: "DELETE" },
    {
      path: "/api/admin/clients/client-1/native-metadata/secret",
      method: "PUT",
    },
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", ...request }),
      /not allowed/,
    );
  }
  for (const request of [
    {
      path: "/api/admin/identity-providers/provider-12?includeSecrets=true",
    },
    {
      path: "/api/admin/identity-providers/provider-12/nested",
      method: "GET",
    },
    {
      path: "/api/admin/identity-providers/provider-12?includeSecrets=true",
      method: "PUT",
    },
    {
      path: "/api/admin/identity-providers?replace=true",
      method: "POST",
    },
    {
      path: "/api/admin/identity-providers/provider-12",
      method: "PATCH",
    },
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", ...request }),
      /not allowed/,
    );
  }
  const identityProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers?q=google&page=0&size=20&sort=guiOrder,asc",
  });
  assert.equal(identityProviders.status, 200);
  const providerMappers = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-1/mappers?page=0&size=20&sort=name,asc",
  });
  assert.equal(providerMappers.status, 200);
  const createdProviderMapper = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-1/mappers",
    method: "POST",
    body: {
      name: "email-mapper",
      sourceClaim: "email",
      target: "email",
      mapperType: "user-attribute",
      syncMode: "import",
      addToIdToken: true,
      addToAccessToken: true,
    },
  });
  assert.equal(createdProviderMapper.status, 200);
  const updatedProviderMapper = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-1/mappers/mapper-1",
    method: "PUT",
    body: {
      name: "email-mapper",
      sourceClaim: "email",
      target: "profile.email",
      mapperType: "user-attribute",
      syncMode: "import",
      addToIdToken: true,
      addToAccessToken: false,
    },
  });
  assert.equal(updatedProviderMapper.status, 200);
  const deletedProviderMapper = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-1/mappers/mapper-1",
    method: "DELETE",
  });
  assert.equal(deletedProviderMapper.status, 200);
  const deletedIdentityProvider = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers/provider-1",
    method: "DELETE",
  });
  assert.equal(deletedIdentityProvider.status, 200);
  const sessions = await adapter.request({
    console: "admin",
    path: "/api/admin/sessions?q=alice&status=expired&page=0&size=20&sort=lastAccessTime,desc",
  });
  assert.equal(sessions.status, 200);
  const consents = await adapter.request({
    console: "admin",
    path: "/api/admin/consents?q=account&page=0&size=20&sort=id.principalName,asc",
  });
  assert.equal(consents.status, 200);
  const offlineSessions = await adapter.request({
    console: "admin",
    path: "/api/admin/offline-sessions?page=0&size=20&sort=refreshTokenIssuedAt,desc",
  });
  assert.equal(offlineSessions.status, 200);
  const events = await adapter.request({
    console: "admin",
    path: "/api/admin/events?q=admin&page=0&size=20&sort=occurredAt,desc",
  });
  assert.equal(events.status, 200);
  const keys = await adapter.request({
    console: "admin",
    path: "/api/admin/keys?q=rsa&active=false&page=0&size=20&sort=createdAt,desc",
  });
  assert.equal(keys.status, 200);
  const cibaPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/ciba-policy",
  });
  assert.equal(cibaPolicy.status, 200);
  const offlineAccessPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/offline-access",
  });
  assert.equal(offlineAccessPolicy.status, 200);
  const updatedCibaPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/ciba-policy",
    method: "PUT",
    body: { requestLifespanSeconds: 300 },
  });
  assert.equal(updatedCibaPolicy.status, 200);
  const updatedOfflineAccessPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/offline-access",
    method: "PUT",
    body: { idleTimeout: "P30D", maxLimited: false },
  });
  assert.equal(updatedOfflineAccessPolicy.status, 200);
  const branding = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/branding",
  });
  assert.equal(branding.status, 200);
  const updatedBranding = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/branding",
    method: "PUT",
    body: { applicationName: "Kitezh", primaryColor: "#123abc" },
  });
  assert.equal(updatedBranding.status, 200);
  const serverInfo = await adapter.request({
    console: "admin",
    path: "/api/admin/server-info",
  });
  assert.equal(serverInfo.status, 200);
  const loginSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/login",
  });
  assert.equal(loginSettings.status, 200);
  const emailSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/email",
  });
  assert.equal(emailSettings.status, 200);
  const updatedEmailSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/email",
    method: "PUT",
    body: {
      enabled: true,
      fromAddress: "noreply@example.test",
      baseUrl: "https://example.test",
      host: "smtp.example.test",
      port: 587,
      username: "",
      password: "",
      smtpAuth: true,
      starttls: true,
      ssl: false,
    },
  });
  assert.equal(updatedEmailSettings.status, 200);
  const localizationSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization",
  });
  assert.equal(localizationSettings.status, 200);
  const updatedLocalizationSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization",
    method: "PUT",
    body: {
      internationalizationEnabled: true,
      defaultLocale: "en",
      supportedLocales: ["en", "tr"],
    },
  });
  assert.equal(updatedLocalizationSettings.status, 200);
  const ldapProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/ldap",
  });
  assert.equal(ldapProviders.status, 200);
  const authenticationFlows = await adapter.request({
    console: "admin",
    path: "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
  });
  assert.equal(authenticationFlows.status, 200);
  const authenticationBindings = await adapter.request({
    console: "admin",
    path: "/api/admin/authentication/bindings",
  });
  assert.equal(authenticationBindings.status, 200);
  const executionProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/authentication/execution-providers",
  });
  assert.equal(executionProviders.status, 200);
  const messageOverrides = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization/messages?q=login&locale=tr&bundle=admin&page=0&size=20&sort=locale,asc",
  });
  assert.equal(messageOverrides.status, 200);
  const updatedMessageOverride = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization/messages/7",
    method: "PUT",
    body: {
      locale: "tr",
      bundle: "admin",
      messageKey: "login.title",
      messageValue: "Oturum aç",
    },
  });
  assert.equal(updatedMessageOverride.status, 200);
  await assert.rejects(
    adapter.request({
      console: "account",
      path: "/api/admin/settings/ciba-policy",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/branding?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/login",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/email?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/1",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/1/enabled/nested",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/9007199254740992",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/password/nested",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/bulk/nested",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/webauthn/credentials?page=0&size=101",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/profile-attributes?include=all",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/profile-attributes?include=all",
    }),
    /not allowed/,
  );
  for (const lifespan of ["0", "1200", "86401", "1e5"]) {
    await assert.rejects(
      adapter.request({
        console: "admin",
        path: `/api/admin/users/2/execute-actions-email?lifespan=${lifespan}`,
        method: "PUT",
      }),
      /not allowed/,
    );
  }
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/webauthn/credentials/credential_123/nested",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/totp/nested",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/unlock/nested",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/2/groups/1",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/roles/ROLE_NATIVE_VIEWER",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/roles/ROLE_NATIVE_VIEWER/users/1",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/roles/ROLE_NATIVE_VIEWER/users/0",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/1",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/1/users/2/nested",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/9007199254740992/users/2",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/2/roles/nested",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/client-scopes/native-observer",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/client-scopes/scope-native-observer/mappers/1/nested",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/client-scopes/scope-native-observer/mappers/0",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/offline-sessions/offline-auth-opaque-id/mappers/1",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/identity-providers/provider-1/mappers/1/nested",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/consents/client%2Fother/alice",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/sessions/session-secret-id/authorizations",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages/1",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages/0",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages/0",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages/9007199254740992",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/ldap",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/authentication/flows/1",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/authentication/flows?q=browser&page=0&size=20",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages?locale=tr&messageKey=auth.token",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages?locale=../../secret&page=0&size=20&sort=locale,asc",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/ciba-policy?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  const revokeAll = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/offline-access/revoke-all",
    method: "POST",
  });
  assert.equal(revokeAll.status, 200);
  const nativeLoginSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/login/native",
  });
  assert.equal(nativeLoginSettings.status, 200);
  const nativeLoginUpdate = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/login/native",
    method: "PUT",
    body: { passwordMinimumLength: 12 },
  });
  assert.equal(nativeLoginUpdate.status, 200);
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/login/native?all=true",
      method: "PUT",
      body: {},
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/offline-access/revoke-all?all=true",
      method: "POST",
    }),
    /not allowed/,
  );
  const rotatedKey = await adapter.request({
    console: "admin",
    path: "/api/admin/keys/rotate",
    method: "POST",
  });
  assert.equal(rotatedKey.status, 200);
  for (const path of [
    "/api/admin/keys/rotate?force=true",
    "/api/admin/keys/rotate/other",
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path, method: "POST" }),
      /not allowed/,
    );
  }
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/sessions?status=all",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/users/2/nested" }),
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

test("allows only bounded Account and Admin notification feed and read paths", async () => {
  const requests = [];
  const { adapter } = harness(async (url, options) => {
    requests.push({
      path: new URL(String(url)).pathname,
      method: options.method,
    });
    return new Response("0", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  for (const [consoleName, base] of [
    ["account", "/api/account/notifications"],
    ["admin", "/api/admin/notifications"],
  ]) {
    await adapter.request({
      console: consoleName,
      path: `${base}?page=0&size=20`,
    });
    await adapter.request({
      console: consoleName,
      path: `${base}/unread-count`,
    });
    await adapter.request({
      console: consoleName,
      path: `${base}/9a418c80-2b43-4afe-977f-17ea426e8c80/read`,
      method: "PUT",
    });
    for (const [path, method] of [
      [`${base}?size=101`, "GET"],
      [`${base}?page=-1`, "GET"],
      [`${base}?includePrivate=true`, "GET"],
      [`${base}/unread-count?userId=2`, "GET"],
      [`${base}/not-a-uuid/read`, "PUT"],
      [`${base}/9a418c80-2b43-4afe-977f-17ea426e8c80/read`, "DELETE"],
    ]) {
      await assert.rejects(
        adapter.request({ console: consoleName, path, method }),
        /not allowed/,
        `${method} ${path} must be rejected`,
      );
    }
  }
  assert.equal(requests.length, 6);
});
