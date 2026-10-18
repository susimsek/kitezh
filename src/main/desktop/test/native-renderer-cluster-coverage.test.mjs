import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const providersPath =
  "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc";

function adminAccess(overrides = {}) {
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
    ...overrides,
  };
}

test("consent details render populated metadata, empty scopes, and manager confirmation", async () => {
  const harness = await renderConsole("admin", {
    response: (path) =>
      path === "/api/admin/whoami" ? { access: adminAccess() } : null,
  });
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
  }));
  harness.setResponse(
    "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "GET",
    () => ({
      content: [
        {
          clientId: "profile-client",
          clientName: "Profile",
          principalName: "ada@example.test",
          authorities: [],
          createdAt: "2026-10-01T12:00:00Z",
          updatedAt: "2026-10-02T12:00:00Z",
        },
      ],
      number: 0,
      totalPages: 0,
    }),
  );
  try {
    await settle();
    harness.document.querySelector('[data-route="users"]').click();
    await settle();
    harness.document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    harness.document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="consents"]')
      .click();
    await settle();
    const row = harness.document.querySelector(
      '[data-action="admin-user-detail-consent-details"]',
    );
    assert.ok(row);
    assert.match(harness.document.querySelector(".admin-user-detail-data-table").textContent, /Profile/);
    row.click();
    await settle();
    const details = harness.document.querySelector(".admin-user-detail-expand-row");
    assert.match(details.textContent, /ada@example\.test/);
    assert.match(details.textContent, /—/);
    assert.match(details.textContent, /2026/);
    harness.document
      .querySelector('[data-action="admin-user-detail-revoke-consent"]')
      .click();
    await settle();
    assert.ok(
      harness.document.querySelector(
        '[data-action="admin-user-detail-revoke-consent-confirm"]',
      ),
    );
    assert.ok(
      harness.document.querySelector(
        '[data-action="admin-user-detail-revoke-consent-cancel"]',
      ),
    );
  } finally {
    harness.restore();
  }
});

test("client-scope edit reports server field violations without losing the draft", async () => {
  const harness = await renderConsole("admin", {
    hash: "#/admin/client-scopes/custom-scope/edit",
    response: (path) => {
      if (path === "/api/admin/whoami")
        return { access: adminAccess() };
      if (path === "/api/admin/client-scopes/custom-scope")
        return {
          id: "custom-scope",
          name: "custom-scope",
          builtIn: false,
          displayOnConsentScreen: false,
          includeInTokenScope: false,
          groupMapperEnabled: false,
          groupMapperFullPath: false,
        };
      if (path.startsWith("/api/admin/client-scopes?"))
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
      if (path.endsWith("/role-mappings"))
        return { applicationRoles: [], clientRoles: [] };
      if (path.endsWith("/mappers?page=0&size=20&sort=name,asc"))
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
      return null;
    },
  });
  harness.setResponse("/api/admin/client-scopes/custom-scope", "PUT", () => ({
    status: 400,
    body: {
      violations: [
        { field: "name", message: "Name is invalid" },
        { field: "groupClaimName", message: "Group claim is required" },
      ],
    },
  }));
  try {
    await settle();
    const form = harness.document.querySelector(
      '[data-form="admin-client-scope-edit"]',
    );
    assert.ok(form);
    form.elements.namedItem("name").value = "draft-name";
    form.elements.namedItem("groupClaimName").value = "group_claim";
    form.dispatchEvent(
      new harness.dom.window.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const updatedForm = harness.document.querySelector(
      '[data-form="admin-client-scope-edit"]',
    );
    assert.equal(updatedForm.elements.namedItem("name").value, "draft-name");
    assert.match(
      updatedForm.querySelector('[name="name"]').parentElement.textContent,
      /Name is invalid/,
    );
    assert.match(
      updatedForm.querySelector('[name="groupClaimName"]').parentElement.textContent,
      /Group claim is required/,
    );
  } finally {
    harness.restore();
  }
});

test("identity-provider list shows an empty state when the collection is empty", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(providersPath, "GET", () => ({
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
  }));
  try {
    await settle();
    harness.document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    assert.match(
      harness.document.querySelector(".provider-table-card").textContent,
      /adminNoIdentityProviders/,
    );
    assert.equal(harness.document.querySelector(".table-pagination"), null);
  } finally {
    harness.restore();
  }
});

test("identity-provider detail falls back to a visible load error for an unknown provider", async () => {
  const harness = await renderConsole("admin", {
    hash: "#/admin/identity-providers/unknown-provider/details",
  });
  harness.setResponse(providersPath, "GET", () => ({
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
  }));
  harness.setResponse("/api/admin/identity-providers/unknown-provider", "GET", () => ({
    status: 404,
    body: { detail: "Provider not found" },
  }));
  try {
    await settle();
    assert.match(
      harness.document.querySelector(".content").textContent,
      /adminIdentityProvidersLoadError/,
    );
    assert.ok(harness.document.querySelector('[data-action="admin-provider-list"]'));
  } finally {
    harness.restore();
  }
});
