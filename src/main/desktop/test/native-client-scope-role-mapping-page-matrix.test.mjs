import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("client-scope role mappings consume nested Spring Page metadata and content fallbacks", async () => {
  const scopeId = "profile";
  const roleMappings = {
    applicationRoles: ["ROLE_PROFILE_READER"],
    clientRoles: [{ id: 7, clientId: "reports", name: "VIEW_REPORTS" }],
  };
  const harness = await renderConsole("admin", {
    hash: `#/admin/client-scopes/${scopeId}/details`,
    response: async (path) => {
      if (path === `/api/admin/client-scopes/${scopeId}`)
        return {
          id: scopeId,
          name: "profile",
          displayName: "Profile",
          description: "Profile details",
          builtIn: false,
        };
      if (path === `/api/admin/client-scopes/${scopeId}/role-mappings`)
        return roleMappings;
      if (path.startsWith(`/api/admin/client-scopes/${scopeId}/role-mappings/application-roles?`))
        return {
          content: [
            { name: "ROLE_PROFILE_READER" },
            { name: "ROLE_PROFILE_EDITOR" },
          ],
          page: { number: 0, totalPages: 3, totalElements: 45 },
        };
      if (path.startsWith(`/api/admin/client-scopes/${scopeId}/role-mappings/client-roles?`))
        return {
          content: [
            { id: 7, clientId: "reports", name: "VIEW_REPORTS" },
            { id: 8, clientId: "reports", name: "EDIT_REPORTS" },
          ],
        };
      if (path === `/api/admin/client-scopes/${scopeId}/mappers?page=0&size=20&sort=name,asc`)
        return { content: [] };
      return undefined;
    },
  });

  try {
    await settle();
    const { document, calls } = harness;
    const toggle = document.querySelector(
      `[data-action="admin-client-scope-role-mappings-toggle"][data-id="${scopeId}"]`,
    );
    assert.ok(toggle);
    toggle.click();
    await settle();

    const panel = document.querySelector(
      `[data-client-scope-role-mappings-panel][data-scope-id="${scopeId}"]`,
    );
    assert.ok(panel);
    assert.match(panel.textContent, /ROLE_PROFILE_READER/);
    assert.match(panel.textContent, /VIEW_REPORTS/);
    assert.ok(
      [...panel.querySelector('[name="applicationRoles"]').options].some(
        ({ value }) => value === "ROLE_PROFILE_EDITOR",
      ),
      JSON.stringify(calls.map(({ path }) => path)),
    );
    assert.ok(
      [...panel.querySelector('[name="clientRoleIds"]').options].some(
        ({ value }) => value === "8",
      ),
    );
    assert.ok(
      calls.some(({ path }) => path.endsWith("application-roles?page=0&size=100&sort=name,asc")),
    );
    assert.ok(
      calls.some(({ path }) => path.endsWith("client-roles?page=0&size=100&sort=name,asc")),
    );
  } finally {
    harness.restore();
  }
});
