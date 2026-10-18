import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const scope = {
  id: "recovered-scope",
  name: "recovered-scope",
  displayName: "Recovered scope",
  description: "Loaded after retry",
  builtIn: true,
  includeInTokenScope: true,
};

function access() {
  return {
    isAdmin: true,
    queryUsers: true,
    viewUsers: true,
    manageUsers: true,
    viewRoles: true,
    manageRoles: true,
    queryGroups: true,
    viewGroups: true,
    manageGroups: true,
    queryClients: true,
    viewClients: true,
    manageClients: true,
    viewSessions: true,
    manageSessions: true,
    viewConsents: true,
    manageConsents: true,
    viewEvents: true,
    manageEvents: true,
    viewKeys: true,
    manageKeys: true,
  };
}

test("client-scope deep link recovers after a missing detail and returns to the list", async () => {
  const detailPath = "/api/admin/client-scopes/recovered-scope";
  const harness = await renderConsole("admin", {
    hash: "#/admin/client-scopes/recovered-scope/details",
    response: (path) => {
      if (path === "/api/admin/whoami") return { access: access() };
      if (path === detailPath)
        return { status: 404, body: { detail: "Scope not found" } };
      if (path.startsWith("/api/admin/client-scopes?"))
        return {
          content: [scope],
          number: 0,
          totalPages: 1,
          totalElements: 1,
        };
      if (path.endsWith("/role-mappings"))
        return { applicationRoles: [], clientRoles: [] };
      if (path.includes("/role-mappings/") || path.includes("/mappers?"))
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
      return null;
    },
  });

  try {
    await settle();
    assert.ok(harness.document.querySelector(".scope-detail-unavailable"));
    assert.ok(
      harness.document.querySelector(
        '.scope-detail-unavailable [data-action="retry"]',
      ),
    );

    harness.setResponse(detailPath, "GET", () => scope);
    harness.document
      .querySelector('.scope-detail-unavailable [data-action="retry"]')
      .click();
    await settle();

    assert.equal(
      harness.document.querySelector("[data-client-scope-detail]")?.dataset
        .clientScopeDetail,
      "recovered-scope",
    );
    assert.match(harness.document.querySelector(".topbar h1").textContent, /recovered-scope/);

    harness.document
      .querySelector('.client-breadcrumb [data-action="client-scope-back"]')
      .click();
    await settle();
    assert.ok(harness.document.querySelector('[data-route="client-scopes"]'));
    assert.ok(
      harness.document.querySelector('[data-client-scope-id="recovered-scope"]'),
    );
  } finally {
    harness.restore();
  }
});
