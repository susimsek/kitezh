import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const violations = [
  ["name", "Scope name is invalid"],
  ["displayName", "Display name is invalid"],
  ["description", "Description is invalid"],
  ["consentScreenText", "Consent text is invalid"],
  ["groupClaimName", "Group claim is invalid"],
];

const adminAccess = {
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

test("client-scope editor maps every server validation violation to its field", async () => {
  const scope = {
    id: "scope-errors",
    name: "scope-errors",
    displayName: "Scope errors",
    description: "Original description",
    builtIn: false,
    displayOnConsentScreen: true,
    consentScreenText: "Original consent text",
    includeInTokenScope: true,
    groupMapperEnabled: true,
    groupClaimName: "groups",
    groupMapperFullPath: true,
  };
  const harness = await renderConsole("admin", {
    hash: "#/admin/client-scopes/scope-errors/edit",
    response: (path) => {
      if (path === "/api/admin/whoami") return { access: adminAccess };
      if (path === "/api/admin/client-scopes/scope-errors") return scope;
      if (path.startsWith("/api/admin/client-scopes?"))
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
      if (path.endsWith("/role-mappings"))
        return { applicationRoles: [], clientRoles: [] };
      if (path.includes("/role-mappings/") || path.includes("/mappers?"))
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
      return null;
    },
  });
  harness.setResponse(
    "/api/admin/client-scopes/scope-errors",
    "PUT",
    () => ({
      status: 400,
      body: { violations: violations.map(([field, message]) => ({ field, message })) },
    }),
  );

  try {
    await settle();
    const form = harness.document.querySelector(
      '[data-form="admin-client-scope-edit"]',
    );
    assert.ok(form);
    for (const [field] of violations) {
      const input = form.elements.namedItem(field);
      input.value = `draft-${field}`;
    }
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
    for (const [field, message] of violations) {
      assert.equal(updatedForm.elements.namedItem(field).value, `draft-${field}`);
      assert.match(
        updatedForm.elements.namedItem(field).parentElement.textContent,
        new RegExp(message),
      );
    }
  } finally {
    harness.restore();
  }
});
