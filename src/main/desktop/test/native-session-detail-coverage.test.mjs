import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const sessionsPath =
  "/api/admin/sessions?q=&status=active&clientId=&page=0&size=10&sort=lastAccessTime%2Cdesc";

async function openSessions(harness) {
  harness.document.querySelector('[data-route="sessions"]').click();
  for (let turn = 0; turn < 30; turn += 1) {
    await settle();
    if (harness.calls.some(({ path }) => path === sessionsPath)) break;
  }
}

test("native Admin session detail handles dates, authorizations, empty values, and close", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(sessionsPath, "GET", () => ({
    content: [
      {
        id: "session-detail-1",
        username: "ada",
        active: true,
        createdAt: "2026-10-12T08:30:00Z",
        lastAccessedAt: "invalid-date",
        expiresAt: null,
        authorizationCount: 1,
      },
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
  }));
  harness.setResponse("/api/admin/sessions/session-detail-1", "GET", () => ({
    session: {
      id: "session-detail-1",
      username: "ada",
      createdAt: "2026-10-12T08:30:00Z",
      lastAccessedAt: "not-a-date",
      expiresAt: null,
    },
    authorizations: [
      {
        clientName: "Kitezh console",
        clientId: "admin-console",
        grantType: "authorization_code",
        scopes: ["openid", "admin-api"],
      },
    ],
  }));

  try {
    const { document, calls } = harness;
    await openSessions(harness);
    document
      .querySelector(
        '[data-action="admin-session-detail"][data-id="session-detail-1"]',
      )
      .click();
    await settle();

    assert.ok(document.querySelector("dialog.native-modal[open]"));
    assert.match(
      document.querySelector("dialog.native-modal").textContent,
      /session-detail-1/,
    );
    assert.match(
      document.querySelector("dialog.native-modal").textContent,
      /Kitezh console/,
    );
    assert.match(
      document.querySelector("dialog.native-modal").textContent,
      /authorization_code/,
    );
    assert.match(
      document.querySelector("dialog.native-modal").textContent,
      /openid, admin-api/,
    );
    assert.match(
      document.querySelector("dialog.native-modal").textContent,
      /—/,
    );
    assert.ok(
      calls.some(({ path }) => path === "/api/admin/sessions/session-detail-1"),
    );

    document
      .querySelector('[data-action="admin-session-detail-close"]')
      .click();
    await settle();
    assert.equal(document.querySelector("dialog.native-modal"), null);
  } finally {
    harness.restore();
  }
});

test("native Admin session detail keeps the session list when its detail request fails", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(sessionsPath, "GET", () => ({
    content: [{ id: "session-unavailable", username: "grace", active: true }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
  }));
  harness.setResponse("/api/admin/sessions/session-unavailable", "GET", () => {
    throw new Error("temporary session detail failure");
  });

  try {
    const { document } = harness;
    await openSessions(harness);
    document
      .querySelector(
        '[data-action="admin-session-detail"][data-id="session-unavailable"]',
      )
      .click();
    await settle();
    assert.equal(document.querySelector("dialog.native-modal"), null);
    assert.ok(
      document.querySelector(
        '[data-action="admin-session-detail"][data-id="session-unavailable"]',
      ),
    );
  } finally {
    harness.restore();
  }
});
