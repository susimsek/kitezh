import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("Turkish user detail tabs render populated role, group, session, consent and event data", async () => {
  const harness = await renderConsole("admin", { locale: "tr" });
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
    groupMappings: [{ groupPath: "/Engineering", roles: ["ROLE_EDITOR"] }],
    inheritedRoles: ["ROLE_EDITOR"],
    effectiveRoles: ["ROLE_USER", "ROLE_EDITOR"],
  }));
  harness.setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({
    content: [{ name: "ROLE_USER" }, { name: "ROLE_EDITOR" }],
  }));
  harness.setResponse("/api/admin/users/1/groups?page=0&size=100", "GET", () => ({
    content: [{ id: 4, name: "Engineering", roles: ["ROLE_EDITOR"] }],
    number: 0,
    totalPages: 1,
    totalElements: 1,
  }));
  harness.setResponse("/api/admin/groups?page=0&size=100&sort=name%2Casc", "GET", () => ({
    content: [{ id: 4, name: "Engineering" }, { id: 5, path: "/Research" }],
  }));
  harness.setResponse(
    "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
    "GET",
    () => ({
      content: [{
        id: "session-tr",
        username: "ada",
        createdAt: "2026-10-10T08:00:00Z",
        lastAccessedAt: "2026-10-11T09:00:00Z",
        expiresAt: "2026-10-12T10:00:00Z",
        authorizationCount: 2,
      }],
      number: 0,
      totalPages: 1,
      totalElements: 1,
    }),
  );
  harness.setResponse(
    "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "GET",
    () => ({
      content: [{
        clientId: "account-console",
        clientName: "Account Console",
        principalName: "ada",
        authorities: ["openid", "profile"],
        createdAt: "2026-10-10T08:00:00Z",
        updatedAt: "2026-10-11T09:00:00Z",
      }],
      number: 0,
      totalPages: 1,
      totalElements: 1,
    }),
  );
  harness.setResponse(
    "/api/admin/users/1/events?page=0&size=10&sort=occurredAt,desc",
    "GET",
    () => ({
      content: [{
        occurredAt: "2026-10-12T08:30:00Z",
        action: "user.updated",
        details: "Profile updated",
        actor: "admin",
        targetType: "USER",
        targetId: "1",
      }],
      number: 0,
      totalPages: 1,
      totalElements: 1,
    }),
  );

  try {
    const { document } = harness;
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();

    const openTab = async (tab) => {
      document
        .querySelector(`[data-action="admin-user-detail-tab"][data-tab="${tab}"]`)
        .click();
      await settle();
    };

    await openTab("roles");
    assert.match(document.querySelector(".admin-user-role-summary").textContent, /Gruplardan miras alınan roller/);
    assert.match(document.querySelector(".admin-user-role-summary").textContent, /ROLE_EDITOR/);

    await openTab("groups");
    assert.match(document.querySelector(".admin-user-group-editor").textContent, /Grup üyelikleri/);
    assert.match(document.querySelector(".admin-user-group-table").textContent, /Engineering/);

    await openTab("sessions");
    assert.match(document.querySelector(".admin-user-session-table").textContent, /Kullanıcı/);
    assert.match(document.querySelector(".admin-user-session-table").textContent, /ada/);

    await openTab("consents");
    const consentRow = document.querySelector(".admin-user-detail-data-table tbody tr");
    assert.match(consentRow.textContent, /İzni kaldır/);
    consentRow.querySelector('[data-action="admin-user-detail-consent-details"]').click();
    await settle();
    assert.match(document.querySelector(".admin-user-detail-expand-row").textContent, /Son güncelleme/);

    await openTab("events");
    assert.match(document.querySelector(".admin-user-detail-data-table").textContent, /Zaman/);
    assert.match(document.querySelector(".admin-user-detail-data-table").textContent, /Profile updated/);
  } finally {
    harness.restore();
  }
});
