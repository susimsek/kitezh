import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminApiError,
  getAdminDashboard,
  listAdminUsers,
  listAdminClients,
  listAdminClientScopes,
  listAdminGroups,
  listAdminRoles,
  deleteAdminUser,
  setAdminUserEnabled,
} from "./admin-api.ts";

test("admin dashboard uses the admin API scope endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInfo | URL | undefined;
  let authorization: string | null | undefined;
  globalThis.fetch = async (input, init) => {
    request = input;
    authorization = new Headers(init?.headers).get("Authorization");
    return new Response(
      JSON.stringify({ clients: 3, users: 4, sessions: 2, consents: 1 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    assert.deepEqual(await getAdminDashboard("access-token"), {
      clients: 3,
      users: 4,
      sessions: 2,
      consents: 1,
    });
    assert.equal(request?.toString(), "https://kitezh.onrender.com/api/admin/dashboard");
    assert.equal(authorization, "Bearer access-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin dashboard refreshes once after an unauthorized response", async () => {
  const originalFetch = globalThis.fetch;
  const tokens: string[] = [];
  globalThis.fetch = async (_input, init) => {
    tokens.push(new Headers(init?.headers).get("Authorization") ?? "");
    if (tokens.length === 1) return new Response(null, { status: 401 });
    return new Response(
      JSON.stringify({ clients: 1, users: 1, sessions: 1, consents: 1 }),
      { status: 200 },
    );
  };
  try {
    await getAdminDashboard("expired-token", {
      refreshAccessToken: async () => "fresh-token",
    });
    assert.deepEqual(tokens, ["Bearer expired-token", "Bearer fresh-token"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin dashboard preserves forbidden status for the native shell", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });
  try {
    await assert.rejects(
      getAdminDashboard("access-token"),
      (error: unknown) => error instanceof AdminApiError && error.status === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin users request encodes search and pagination parameters", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({ content: [], number: 1, size: 10, totalElements: 0, totalPages: 0 }),
      { status: 200 },
    );
  };
  try {
    await listAdminUsers("access-token", "ada@example.test", 1, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/users?q=ada%40example.test&page=1&size=10&sort=username%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin user mutations use protected HTTP methods and JSON state", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      body: init?.body?.toString() ?? null,
      method: init?.method ?? "GET",
      url: input.toString(),
    });
    return new Response(null, { status: 204 });
  };
  try {
    await setAdminUserEnabled("access-token", 7, false);
    await deleteAdminUser("access-token", 7);
    assert.deepEqual(calls, [
      {
        body: JSON.stringify({ enabled: false }),
        method: "PUT",
        url: "https://kitezh.onrender.com/api/admin/users/7/enabled",
      },
      {
        body: null,
        method: "DELETE",
        url: "https://kitezh.onrender.com/api/admin/users/7",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin clients request uses a bounded sorted page", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({ content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 }),
      { status: 200 },
    );
  };
  try {
    await listAdminClients("access-token", "mobile", 0, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/clients?q=mobile&page=0&size=10&sort=clientId%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin client scopes request uses a bounded sorted page", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({ content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 }),
      { status: 200 },
    );
  };
  try {
    await listAdminClientScopes("access-token", "profile", 0, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/client-scopes?q=profile&page=0&size=10&sort=name%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin roles and groups requests use bounded sorted pages", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(input.toString());
    return new Response(
      JSON.stringify({ content: [], number: 0, size: 10, totalElements: 0, totalPages: 0 }),
      { status: 200 },
    );
  };
  try {
    await listAdminRoles("access-token", "admin", 0, 10);
    await listAdminGroups("access-token", "finance", 1, 10);
    assert.deepEqual(requests, [
      "https://kitezh.onrender.com/api/admin/roles?q=admin&page=0&size=10&sort=name%2Casc",
      "https://kitezh.onrender.com/api/admin/groups?q=finance&page=1&size=10&sort=name%2Casc",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
