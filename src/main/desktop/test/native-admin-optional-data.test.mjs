import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native Admin collection rows render optional and invalid metadata safely", async () => {
  let showEmptyKeys = false;
  const harness = await renderConsole("admin", {
    response: async (path) => {
      if (path.startsWith("/api/admin/sessions?"))
        return {
          content: [
            {
              id: "sparse-session",
              active: true,
              createdAt: "not-a-date",
              lastAccessedAt: null,
              expiresAt: "",
              authorizationCount: 2.5,
            },
            { id: "expired-session", username: "ada", active: false },
          ],
          number: 0,
          totalElements: 2,
          totalPages: 1,
        };
      if (path === "/api/admin/sessions/sparse-session")
        return {
          session: { id: "sparse-session", createdAt: "bad-date" },
          authorizations: [],
        };
      if (path.startsWith("/api/admin/consents?"))
        return {
          content: [
            {
              clientId: "fallback-client",
              principalName: "",
              authorities: [],
              createdAt: "bad-date",
            },
          ],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      if (path.startsWith("/api/admin/events?"))
        return {
          content: [
            {
              occurredAt: "bad-date",
              action: "",
              actor: "",
              targetType: "unrecognized-type",
              targetId: "",
            },
          ],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      if (path.startsWith("/api/admin/keys?") && showEmptyKeys)
        return { content: null, number: "invalid", totalPages: "invalid", totalElements: "invalid" };
      if (path.startsWith("/api/admin/keys?"))
        return {
          content: [
            {
              kid: null,
              keyId: "fallback-key-id",
              type: "",
              algorithm: null,
              active: false,
              createdAt: "bad-date",
            },
          ],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      return null;
    },
  });
  try {
    const { document } = harness;

    document.querySelector('[data-route="sessions"]').click();
    await settle();
    assert.match(document.querySelector(".admin-session-table").textContent, /sparse-sessi/);
    assert.match(document.querySelector(".admin-session-table").textContent, /—/);
    document.querySelector('[data-action="admin-session-detail"]').click();
    await settle();
    assert.match(document.querySelector("dialog").textContent, /sparse-session/);
    assert.match(document.querySelector("dialog").textContent, /—/);
    document.querySelector('[data-action="admin-session-detail-close"]').click();
    await settle();

    document.querySelector('[data-route="consents"]').click();
    await settle();
    const consentText = document.querySelector(".admin-consent-table").textContent;
    assert.match(consentText, /fallback-client/);
    assert.match(consentText, /—/);

    document.querySelector('[data-route="events"]').click();
    await settle();
    const eventText = document.querySelector(".admin-event-table").textContent;
    assert.match(eventText, /—/);
    assert.ok(document.querySelector(".admin-event-row"));
    document.querySelector(".admin-event-row").click();
    await settle();
    assert.ok(document.querySelector(".admin-event-drawer"));
    document.querySelector('[data-action="admin-event-detail-close"]').click();
    await settle();

    document.querySelector('[data-route="keys"]').click();
    await settle();
    const keyText = document.querySelector(".admin-key-table").textContent;
    assert.match(keyText, /fallback-key-id/);
    assert.match(keyText, /—/);
    assert.match(keyText, /Inactive/);
    showEmptyKeys = true;
    const keyQuery = document.getElementById("admin-key-query");
    keyQuery.value = "missing-key";
    document.getElementById("admin-key-search").dispatchEvent(
      new document.defaultView.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.ok(document.querySelector(".admin-key-table .empty"));
    assert.equal(document.querySelector(".admin-session-pagination-controls"), null);
  } finally {
    harness.restore();
  }
});

test("native Admin identity-provider rows cover alias, status, and empty-page variants", async () => {
  const harness = await renderConsole("admin", {
    response: async (path) => {
      if (path.startsWith("/api/admin/identity-providers?"))
        return {
          content: [
            {
              id: "provider-alias",
              alias: "github-login",
              displayName: "GitHub",
              enabled: false,
              status: "not-configured",
              iconKey: "github",
              guiOrder: 4,
            },
            {
              id: "provider-same-alias",
              alias: "google",
              displayName: "Google",
              enabled: true,
              status: "configured",
              iconKey: "unknown-provider-icon",
              guiOrder: 5,
            },
          ],
          number: 0,
          totalElements: 2,
          totalPages: 2,
        };
      return null;
    },
  });
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    const providerText = document.querySelector(".provider-table-card").textContent;
    assert.match(providerText, /github-login/);
    assert.match(providerText, /GitHub/);
    assert.match(providerText, /Google/);
    assert.ok(document.querySelector('[data-identity-provider-page="1"]'));
    document.querySelector('[data-identity-provider-page="1"]').click();
    await settle();
    assert.ok(calls.some(({ path }) =>
      path.startsWith("/api/admin/identity-providers?") &&
      new URL(path, "http://local").searchParams.get("page") === "1",
    ));
  } finally {
    harness.restore();
  }
});

test("native signing-key list covers last-page, empty-filter, and rotation-result states", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path === "/api/admin/keys/rotate") return { kid: "rotated-key" };
      if (path.startsWith("/api/admin/keys?")) {
        const url = new URL(path, "https://test.invalid");
        const pageNumber = Number(url.searchParams.get("page") ?? 0);
        if (url.searchParams.get("active"))
          return {
            content: [],
            number: 0,
            totalElements: 0,
            totalPages: 0,
          };
        return {
          content: Array.from({ length: pageNumber === 2 ? 5 : 10 }, (_, index) => ({
            kid: `key-${pageNumber}-${index}`,
            type: "RSA",
            algorithm: "RS256",
            active: pageNumber === 0,
            createdAt: "2026-10-10T08:00:00Z",
          })),
          number: pageNumber,
          totalElements: 25,
          totalPages: 3,
        };
      }
      return null;
    },
  });
  try {
    const { calls, document } = harness;
    await settle();
    document.querySelector('[data-route="keys"]').click();
    await settle();
    assert.match(document.querySelector(".admin-key-count").textContent, /25/);
    document.querySelector('[data-admin-key-page="2"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path.startsWith("/api/admin/keys?") &&
          new URL(path, "https://test.invalid").searchParams.get("page") === "2",
      ),
    );
    assert.match(document.querySelector(".admin-session-summary").textContent, /21–25/);

    const active = document.getElementById("admin-key-active");
    active.value = "false";
    active.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    await settle();
    assert.ok(document.querySelector(".admin-key-table .empty"));
    assert.equal(document.querySelector(".admin-session-pagination-controls"), null);
    assert.ok(document.querySelector(".admin-key-active-filters"));

    document.querySelector('[data-action="admin-key-rotate-request"]').click();
    await settle();
    document.querySelector('[data-action="admin-key-rotate-confirm"]').click();
    await settle();
    assert.match(document.querySelector("dialog").textContent, /rotated-key/);
    document.querySelector('[data-action="admin-key-rotated-close"]').click();
    assert.equal(document.querySelector("dialog"), null);
  } finally {
    harness.restore();
  }
});

test("native read-only Admin access keeps collection details and hides mutation controls", async () => {
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
  access.viewSessions = true;
  access.viewConsents = true;
  access.viewEvents = true;
  access.viewKeys = true;

  const harness = await renderConsole("admin", {
    response: async (path) => {
      if (path === "/api/admin/whoami") return { access };
      if (path.startsWith("/api/admin/sessions?"))
        return {
          content: [{ id: "read-only-session", active: true }],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      if (path.startsWith("/api/admin/consents?"))
        return {
          content: [{ clientId: "read-only-client", principalName: "ada" }],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      if (path.startsWith("/api/admin/events?"))
        return {
          content: [{ action: "user.viewed", targetType: "user", targetId: "1" }],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      if (path.startsWith("/api/admin/keys?"))
        return {
          content: [{ kid: "read-only-key", algorithm: "RS256", active: true }],
          number: 0,
          totalElements: 1,
          totalPages: 1,
        };
      return null;
    },
  });
  try {
    const { document } = harness;
    for (const [route, row, absentAction] of [
      ["sessions", ".admin-session-table", "admin-session-delete-request"],
      ["consents", ".admin-consent-table", "admin-consent-revoke-confirm"],
      ["events", ".admin-event-table", "admin-event-clear-request"],
      ["keys", ".admin-key-table", "admin-key-rotate-request"],
    ]) {
      const navigation = document.querySelector(`[data-route="${route}"]`);
      assert.ok(navigation, `${route} should remain visible to a viewer`);
      navigation.click();
      await settle();
      assert.ok(document.querySelector(row), `${route} should render its records`);
      assert.equal(
        document.querySelector(`[data-action="${absentAction}"]`),
        null,
        `${route} should hide mutation controls from a viewer`,
      );
    }
  } finally {
    harness.restore();
  }
});
