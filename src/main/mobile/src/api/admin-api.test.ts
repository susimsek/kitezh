import assert from "node:assert/strict";
import test from "node:test";

import { AdminApiError, getAdminDashboard } from "./admin-api.ts";

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
