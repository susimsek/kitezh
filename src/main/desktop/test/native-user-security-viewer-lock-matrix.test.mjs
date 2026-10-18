import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const viewerAccess = {
  isAdmin: true,
  queryUsers: true,
  viewUsers: true,
  manageUsers: false,
  viewRoles: true,
  manageRoles: false,
  queryGroups: true,
  viewGroups: true,
  manageGroups: false,
  queryClients: true,
  viewClients: true,
  manageClients: false,
  viewSessions: true,
  manageSessions: false,
  viewConsents: true,
  manageConsents: false,
  viewEvents: true,
  manageEvents: false,
  viewKeys: true,
  manageKeys: false,
};

test("read-only user detail shows lock and temporary-password state without unlock controls", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path === "/api/admin/whoami") return { access: viewerAccess };
      if (path === "/api/admin/users/1")
        return {
          id: 1,
          username: "locked-viewer",
          enabled: true,
          locked: true,
          temporaryPassword: true,
          mustChangePassword: false,
          failedLoginCount: null,
          authorities: ["ROLE_USER"],
        };
      if (path === "/api/admin/users/1/profile-attributes")
        return { definitions: [], attributes: {} };
      return null;
    },
  });

  try {
    await settle();
    harness.document.querySelector('[data-route="users"]').click();
    await settle();
    harness.document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();

    const security = harness.document.querySelector(
      ".admin-user-security-panel",
    );
    assert.match(security.textContent, /Locked/);
    assert.match(security.textContent, /Failed logins: 0/);
    assert.match(security.textContent, /Password change required/);
    assert.equal(
      harness.document.querySelector(
        '[data-action="admin-user-detail-unlock"]',
      ),
      null,
    );
    assert.equal(
      harness.document.querySelector(
        '[data-action="admin-user-detail-toggle-enabled"]',
      ),
      null,
    );
  } finally {
    harness.restore();
  }
});
