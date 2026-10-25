import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native Admin role details show mapped, inherited, and effective role paths", async () => {
  const harness = await renderConsole("admin");
  const { document, setResponse } = harness;
  setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
    groupMappings: [
      { groupPath: "/Engineering", roles: ["ROLE_EDITOR"] },
    ],
    inheritedRoles: ["ROLE_EDITOR"],
    effectiveRoles: ["ROLE_USER", "ROLE_EDITOR"],
  }));
  setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({
    content: [{ name: "ROLE_USER" }, { name: "ROLE_EDITOR" }],
  }));

  try {
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="roles"]')
      .click();
    await settle();

    const summary = document.querySelector(".admin-user-role-summary");
    assert.match(summary.textContent, /\/Engineering/);
    assert.match(summary.textContent, /ROLE_EDITOR/);
    assert.match(summary.textContent, /ROLE_USER/);
    assert.equal(summary.querySelectorAll(".admin-user-role").length, 4);
  } finally {
    harness.restore();
  }
});

test("native Admin user detail renders sparse related data and reversible consent details", async () => {
  const harness = await renderConsole("admin");
  const { calls, document, setResponse } = harness;
  setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
    groupMappings: [{ groupPath: "/Engineering" }],
  }));
  setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({
    content: [{ name: "ROLE_USER" }],
  }));
  setResponse("/api/admin/users/1/groups?page=0&size=100", "GET", () => ({
    content: [{ id: 4, path: "/Engineering" }],
    number: 0,
    totalPages: 0,
  }));
  setResponse("/api/admin/groups?page=0&size=100&sort=name%2Casc", "GET", () => ({
    content: [
      { id: 4, name: "Engineering" },
      { id: 5, path: "/Research" },
    ],
  }));
  setResponse(
    "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
    "GET",
    () => ({
      content: [
        { id: "session-1" },
        {
          id: "session-2",
          username: "grace",
          createdAt: "2026-10-10T08:00:00Z",
          lastAccessedAt: "2026-10-11T09:00:00Z",
          expiresAt: "2026-10-12T10:00:00Z",
          authorizationCount: 3,
        },
      ],
      number: 0,
      totalPages: 0,
    }),
  );
  setResponse(
    "/api/admin/users/1/events?page=0&size=10&sort=occurredAt,desc",
    "GET",
    () => ({
      content: [
        {
          occurredAt: "2026-10-12T08:30:00Z",
          action: "user.updated",
          details: "Profile updated",
          actor: "admin",
          targetType: "USER",
          targetId: "1",
        },
      ],
      number: 0,
      totalPages: 0,
    }),
  );
  setResponse(
    "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "GET",
    () => ({
      content: [
        { clientId: "account-console", authorities: [] },
        {
          clientId: "profile-client",
          clientName: "Profile Client",
          principalName: "ada@example.test",
          authorities: ["openid", "profile"],
          createdAt: "2026-10-10T08:00:00Z",
          updatedAt: "2026-10-11T09:00:00Z",
        },
      ],
      number: 0,
      totalPages: 0,
    }),
  );

  try {
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();

    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="roles"]')
      .click();
    await settle();
    assert.match(document.querySelector(".admin-user-role-summary").textContent, /ROLE_USER/);
    assert.match(document.querySelector(".admin-user-role-summary").textContent, /No roles are inherited/);

    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="groups"]')
      .click();
    await settle();
    assert.match(document.querySelector(".admin-user-group-table").textContent, /Engineering/);
    assert.match(document.querySelector(".admin-user-group-table").textContent, /—/);
    assert.equal(
      document.querySelector('#admin-user-detail-group-options option[value="/Engineering"]'),
      null,
    );
    assert.ok(
      document.querySelector('#admin-user-detail-group-options option[value="/Research"]'),
    );

    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="sessions"]')
      .click();
    await settle();
    assert.match(document.querySelector(".admin-user-session-table").textContent, /ada/);
    assert.match(document.querySelector(".admin-user-session-table").textContent, /grace/);
    assert.match(document.querySelector(".admin-user-session-table").textContent, /3/);
    assert.match(document.querySelector(".admin-user-session-table").textContent, /—/);

    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="events"]')
      .click();
    await settle();
    const eventTable = document.querySelector(".admin-user-detail-data-table");
    assert.match(eventTable.textContent, /user\.updated/);
    assert.match(eventTable.textContent, /Profile updated/);
    assert.match(eventTable.textContent, /USER 1/);

    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="consents"]')
      .click();
    await settle();
    assert.match(document.querySelector(".admin-user-detail-data-table").textContent, /account-console/);
    document
      .querySelector('[data-action="admin-user-detail-consent-details"]')
      .click();
    await settle();
    const details = document.querySelector(".admin-user-detail-expand-row");
    assert.match(details.textContent, /ada/);
    assert.match(details.textContent, /—/);
    document
      .querySelector(
        '[data-action="admin-user-detail-consent-details"][data-id="profile-client"]',
      )
      .click();
    await settle();
    assert.match(
      document.querySelector(".admin-user-detail-expand-row").textContent,
      /ada@example\.test/,
    );
    assert.match(
      document.querySelector(".admin-user-detail-expand-row").textContent,
      /openid, profile/,
    );
    document
      .querySelector(
        '[data-action="admin-user-detail-consent-details"][data-id="profile-client"]',
      )
      .click();
    await settle();
    assert.equal(document.querySelectorAll(".admin-user-detail-expand-row").length, 0);

    document
      .querySelector('[data-action="admin-user-detail-revoke-consent"]')
      .click();
    await settle();
    assert.ok(document.querySelector('[data-action="admin-user-detail-revoke-consent-confirm"]'));
    document
      .querySelector('[data-action="admin-user-detail-revoke-consent-cancel"]')
      .click();
    await settle();
    assert.ok(document.querySelector('[data-action="admin-user-detail-revoke-consent"]'));
    assert.equal(
      calls.some(({ method }) => method === "DELETE"),
      false,
    );
  } finally {
    harness.restore();
  }
});

test("read-only user group tab shows an empty state without membership controls", async () => {
  const access = Object.fromEntries(
    [
      "isAdmin",
      "queryUsers",
      "viewUsers",
      "manageUsers",
      "viewRoles",
      "manageRoles",
      "queryGroups",
      "viewGroups",
      "manageGroups",
      "queryClients",
      "viewClients",
      "manageClients",
      "viewSessions",
      "manageSessions",
      "viewConsents",
      "manageConsents",
      "viewEvents",
      "manageEvents",
      "viewKeys",
      "manageKeys",
    ].map((key) => [key, false]),
  );
  access.queryUsers = true;
  access.viewUsers = true;
  access.viewGroups = true;
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path === "/api/admin/whoami") return { access };
      if (path === "/api/admin/users/1")
        return { id: 1, username: "ada", enabled: true, authorities: [] };
      if (path.startsWith("/api/admin/users?"))
        return {
          content: [{ id: 1, username: "ada", enabled: true }],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      if (path.startsWith("/api/admin/users/1/groups?"))
        return { content: [], number: 0, totalElements: 0, totalPages: 0 };
      return null;
    },
  });
  try {
    const { document } = harness;
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="groups"]')
      .click();
    await settle();

    assert.match(
      document.querySelector(".admin-user-related-card").textContent,
      /No records found/,
    );
    assert.equal(document.querySelector("#admin-user-detail-group-search"), null);
    assert.equal(
      document.querySelector('[data-action="admin-user-detail-add-group"]'),
      null,
    );
  } finally {
    harness.restore();
  }
});
