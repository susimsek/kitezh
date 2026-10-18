import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const sessionsPath =
  "/api/admin/sessions?q=&status=active&clientId=&page=0&size=10&sort=lastAccessTime%2Cdesc";

async function openSessions(harness) {
  harness.document.querySelector('[data-route="sessions"]').click();
  await settle();
  assert.ok(harness.calls.some(({ path }) => path === sessionsPath));
}

test("Admin session state matrix renders active, expired, sparse and empty authorization details", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(sessionsPath, "GET", () => ({
    content: [
      {
        id: "active-session-42",
        username: "ada",
        active: true,
        createdAt: "invalid-date",
        lastAccessedAt: null,
        expiresAt: "2026-10-19T09:00:00Z",
        authorizationCount: "unknown",
      },
      {
        id: "expired-session-19",
        active: false,
        createdAt: "2026-10-10T09:00:00Z",
        lastAccessedAt: "2026-10-11T09:00:00Z",
        expiresAt: "2026-10-12T09:00:00Z",
        authorizationCount: 3,
      },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 0,
  }));
  harness.setResponse("/api/admin/sessions/active-session-42", "GET", () => ({
    session: { id: "active-session-42" },
    authorizations: [],
  }));
  harness.setResponse(
    "/api/admin/sessions?q=&status=expired&clientId=&page=0&size=10&sort=lastAccessTime%2Cdesc",
    "GET",
    () => ({
      content: [{ id: "expired-session-19", active: false }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );

  try {
    const { document } = harness;
    await openSessions(harness);
    const rows = document.querySelectorAll(".admin-session-table tbody tr");
    assert.equal(rows.length, 2);
    assert.ok(rows[0].querySelector(".is-active"));
    assert.match(rows[0].textContent, /ada/);
    assert.match(rows[0].textContent, /0/);
    assert.ok(rows[0].querySelector('[data-action="admin-session-delete-request"]'));
    assert.ok(rows[1].querySelector(".is-expired"));
    assert.ok(rows[1].querySelector('[data-action="admin-session-delete-request"]') === null);

    rows[0].querySelector('[data-action="admin-session-detail"]').click();
    await settle();
    const detail = document.querySelector("dialog.native-modal[open]");
    assert.ok(detail);
    assert.match(detail.textContent, /active-session-42/);
    assert.match(detail.textContent, /—/);
    document.querySelector('[data-action="admin-session-detail-close"]').click();
    await settle();

    const filter = document.getElementById("admin-session-search");
    filter.elements.namedItem("status").value = "expired";
    filter.dispatchEvent(new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await settle();
    assert.ok(document.querySelector(".admin-session-table .is-expired"));
  } finally {
    harness.restore();
  }
});

test("Admin session state matrix hides revoke controls for viewers and handles an empty result", async () => {
  const access = Object.fromEntries(
    [
      "isAdmin", "queryUsers", "viewUsers", "manageUsers", "viewRoles", "manageRoles",
      "queryGroups", "viewGroups", "manageGroups", "queryClients", "viewClients",
      "manageClients", "viewSessions", "manageSessions", "viewConsents", "manageConsents",
      "viewEvents", "manageEvents", "viewKeys", "manageKeys",
    ].map((key) => [key, false]),
  );
  access.viewSessions = true;
  const harness = await renderConsole("admin", {
    response: (path) => path === "/api/admin/whoami" ? { access } : null,
  });
  harness.setResponse(sessionsPath, "GET", () => ({
    content: [{ id: "viewer-session", username: "grace", active: true }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
  }));
  harness.setResponse(
    "/api/admin/sessions?q=&status=expired&clientId=&page=0&size=10&sort=lastAccessTime%2Cdesc",
    "GET",
    () => ({ content: [], totalElements: 0, totalPages: 0, number: 0 }),
  );

  try {
    const { document } = harness;
    await openSessions(harness);
    assert.ok(document.querySelector('[data-action="admin-session-detail"][data-id="viewer-session"]'));
    assert.equal(document.querySelector('[data-action="admin-session-delete-request"]'), null);

    const search = document.getElementById("admin-session-search");
    search.elements.namedItem("status").value = "expired";
    search.dispatchEvent(new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await settle();
    assert.match(document.querySelector(".admin-session-empty").textContent, /adminNoSessions/);
    assert.equal(document.querySelector('[data-action="admin-session-delete-request"]'), null);
    assert.equal(document.querySelector(".admin-session-page-indicator strong").textContent, "0");
  } finally {
    harness.restore();
  }
});
