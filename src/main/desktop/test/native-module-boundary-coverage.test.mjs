import assert from "node:assert/strict";
import test from "node:test";
import { createDesktopApiAdapter } from "../dist/api/desktop-api.js";
import { groupAttributes, groupPage } from "../src/native/groups.mjs";
import { rolePage } from "../src/native/roles.mjs";

test("native group and role page helpers preserve empty and malformed-page fallbacks", () => {
  assert.deepEqual(groupAttributes("  "), {});
  assert.deepEqual(groupAttributes('{"labels":["blue","green"]}'), {
    labels: ["blue", "green"],
  });
  for (const value of ['null', '[]', '{"labels":"blue"}', "{"]) {
    assert.throws(() => groupAttributes(value), /Invalid group attributes|JSON/);
  }

  assert.deepEqual(groupPage(null, 20), {
    content: [],
    size: 20,
    number: 0,
    totalElements: 0,
    totalPages: 0,
  });
  assert.deepEqual(
    groupPage(
      {
        content: "invalid",
        page: { size: -1, number: -1, totalElements: -1, totalPages: -1 },
      },
      50,
    ),
    { content: [], size: 50, number: 0, totalElements: 0, totalPages: 0 },
  );

  assert.deepEqual(rolePage(null, 25), {
    content: [],
    size: 25,
    number: 0,
    totalElements: 0,
    totalPages: 0,
  });
  assert.deepEqual(
    rolePage({ content: "invalid", page: { size: 1.5, totalElements: 2.5 } }, 20),
    { content: [], size: 20, number: 0, totalElements: 0, totalPages: 0 },
  );
});

test("desktop API adapter accepts bounded typed filters and rejects widened filter values", async () => {
  const session = {
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: Date.now() + 60_000,
    version: 1,
  };
  const requested = [];
  const adapter = createDesktopApiAdapter({
    apiBaseUrl: "https://kitezh.example.test",
    readSession: async () => session,
    writeSession: async () => {},
    clearSession: async () => {},
    fetcher: async (url) => {
      requested.push(String(url));
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  for (const path of [
    "/api/admin/users?page=0&size=20&sort=username,asc&enabled=false",
    "/api/admin/events?page=0&size=20&sort=occurredAt,desc&targetType=user&from=2026-10-01T00:00:00Z",
    "/api/admin/clients/demo/roles/12/available-composites?page=0&size=10&sort=name,asc&q=rea",
  ]) {
    assert.equal(
      (await adapter.request({ console: "admin", path })).status,
      200,
      path,
    );
  }

  for (const path of [
    "/api/admin/users?enabled=maybe",
    "/api/admin/events?targetType=arbitrary",
    "/api/admin/events?from=not-a-date",
    "/api/admin/authentication/flows?q=unbounded",
    "/api/admin/clients/demo/roles/12/available-composites?page=0&size=10&sort=name,asc&q=a",
  ]) {
    await assert.rejects(
      adapter.request({ console: "admin", path }),
      /not allowed/,
      path,
    );
  }
  assert.equal(requested.length, 3);
});
