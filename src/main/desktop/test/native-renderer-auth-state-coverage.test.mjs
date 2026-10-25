import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const consentPath =
  "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc";
const consentActionPath = "/api/admin/consents/console-client/ada";

async function openUser(harness) {
  const { document } = harness;
  await settle();
  document.querySelector('[data-route="users"]').click();
  await settle();
  document
    .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
    .click();
  await settle();
}

async function openConsents(harness) {
  const tab = harness.document.querySelector(
    '[data-action="admin-user-detail-tab"][data-tab="consents"]',
  );
  if (tab) {
    tab.click();
    await settle();
  }
  return tab;
}

function completeAccess(overrides = {}) {
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

function configureUser(harness) {
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
  }));
}

const scenarios = [
  {
    name: "view-only consent access renders rows without revoke controls",
    access: { viewConsents: true, manageConsents: false },
    consentResponse: { content: [{ clientId: "console-client", principalName: "ada" }] },
    verify({ document }) {
      assert.ok(document.querySelector('[data-action="admin-user-detail-consent-details"]'));
      assert.equal(document.querySelector('[data-action="admin-user-detail-revoke-consent"]'), null);
      assert.match(document.querySelector(".admin-user-detail-data-table").textContent, /console-client/);
    },
  },
  {
    name: "consent collection failures stay visible as errors",
    access: { viewConsents: true, manageConsents: true },
    consentResponse: { status: 503, body: { detail: "Unavailable" } },
    verify({ document }) {
      assert.ok(document.querySelector('[role="alert"]'));
      assert.equal(document.querySelector(".admin-user-detail-data-table"), null);
    },
  },
  {
    name: "a failed consent revocation preserves its confirmation for retry",
    access: { viewConsents: true, manageConsents: true },
    consentResponse: {
      content: [{ clientId: "console-client", principalName: "ada", authorities: ["openid"] }],
    },
    revokeResponse: { status: 503, body: { detail: "Unavailable" } },
    async verify({ harness, document, calls }) {
      document
        .querySelector('[data-action="admin-user-detail-revoke-consent"]')
        .click();
      await settle();
      document
        .querySelector('[data-action="admin-user-detail-revoke-consent-confirm"]')
        .click();
      await settle();
      assert.ok(document.querySelector('[data-action="admin-user-detail-revoke-consent-confirm"]'));
      assert.ok(calls.some(({ path, method }) => path === consentActionPath && method === "DELETE"));
      assert.ok(harness.document.querySelector('[role="alert"]'));
    },
  },
  {
    name: "users without consent visibility do not receive a consent tab",
    access: { viewConsents: false, manageConsents: true },
    verify({ document }) {
      assert.equal(
        document.querySelector('[data-action="admin-user-detail-tab"][data-tab="consents"]'),
        null,
      );
    },
  },
];

for (const scenario of scenarios) {
  test(`native renderer ${scenario.name}`, async () => {
    const access = completeAccess(scenario.access);
    const harness = await renderConsole("admin", {
      response: (path) => (path === "/api/admin/whoami" ? { access } : null),
    });
    configureUser(harness);
    if (scenario.consentResponse) {
      harness.setResponse(consentPath, "GET", () => scenario.consentResponse);
    }
    if (scenario.revokeResponse) {
      harness.setResponse(consentActionPath, "DELETE", () => scenario.revokeResponse);
    }
    try {
      await openUser(harness);
      const tab = await openConsents(harness);
      assert.equal(Boolean(tab), scenario.access.viewConsents);
      await scenario.verify({
        harness,
        document: harness.document,
        calls: harness.calls,
      });
    } finally {
      harness.restore();
    }
  });
}

test("read-only user detail renders populated related tabs without mutation controls", async () => {
  const access = completeAccess({
    manageUsers: false,
    manageRoles: false,
    manageGroups: false,
    manageSessions: false,
    manageConsents: false,
    manageEvents: false,
  });
  const harness = await renderConsole("admin", {
    response: (path) => (path === "/api/admin/whoami" ? { access } : null),
  });
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
    content: [{ id: 4, name: "Engineering", path: "/Engineering", roles: ["ROLE_EDITOR"] }],
    number: 0,
    totalPages: 0,
  }));
  harness.setResponse("/api/admin/groups?page=0&size=100&sort=name%2Casc", "GET", () => ({
    content: [{ id: 4, path: "/Engineering" }, { id: 5, path: "/Research" }],
  }));
  harness.setResponse(
    "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
    "GET",
    () => ({ content: [{ id: "session-1", username: "ada", authorizationCount: 2 }] }),
  );
  harness.setResponse(consentPath, "GET", () => ({
    content: [{ clientId: "console-client", clientName: "Console", principalName: "ada", authorities: ["openid"] }],
  }));
  harness.setResponse(
    "/api/admin/users/1/events?page=0&size=10&sort=occurredAt,desc",
    "GET",
    () => ({ content: [{ action: "login.succeeded", actor: "admin", targetType: "USER", targetId: "1" }] }),
  );
  try {
    await openUser(harness);
    for (const [tab, selector, expectedText] of [
      ["roles", ".admin-user-role-summary", "ROLE_EDITOR"],
      ["groups", ".admin-user-group-table", "Engineering"],
      ["sessions", ".admin-user-session-table", "ada"],
      ["consents", ".admin-user-detail-data-table", "Console"],
      ["events", ".admin-user-detail-data-table", "login.succeeded"],
    ]) {
      harness.document
        .querySelector(`[data-action="admin-user-detail-tab"][data-tab="${tab}"]`)
        .click();
      await settle();
      const panel = harness.document.querySelector(selector);
      assert.ok(panel, `${tab} detail is visible`);
      assert.match(panel.textContent, new RegExp(expectedText));
      assert.equal(
        panel.querySelector(
          '[data-action^="admin-user-detail-"][data-action*="remove"], [data-action^="admin-user-detail-"][data-action*="revoke"]',
        ),
        null,
        `${tab} remains read-only`,
      );
    }
    assert.equal(harness.document.querySelector("#admin-user-detail-group-search"), null);
  } finally {
    harness.restore();
  }
});

test("empty user detail tabs show their explicit empty states for a manager", async () => {
  const access = completeAccess();
  const harness = await renderConsole("admin", {
    response: (path) => (path === "/api/admin/whoami" ? { access } : null),
  });
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    locked: false,
    authorities: [],
    totpEnabled: false,
    avatarUrl: "https://untrusted.example/avatar.png",
  }));
  harness.setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
    definitions: [
      { name: "activeFlag", displayName: "Active", type: "BOOLEAN", enabled: true, builtIn: false },
      { name: "consentFlag", displayName: "Consent", type: "BOOLEAN", enabled: true, builtIn: false, required: true },
      { name: "aliases", displayName: "Aliases", type: "STRING", enabled: true, builtIn: false, multivalued: true, description: "Alternate names" },
      { name: "contactEmail", displayName: "Contact email", type: "EMAIL", enabled: true, builtIn: false, required: true, pattern: ".+@.+" },
      { name: "employeeNumber", displayName: "Employee number", type: "INTEGER", enabled: true, builtIn: false, minLength: 1, maxLength: 8 },
      { name: "hiddenField", displayName: "Hidden", type: "STRING", enabled: false, builtIn: false },
      { name: "systemField", displayName: "System", type: "STRING", enabled: true, builtIn: true },
    ],
    attributes: {
      activeFlag: ["true"],
      consentFlag: ["false"],
      aliases: ["ada", "augusta"],
      contactEmail: ["ada@example.test"],
      employeeNumber: ["42"],
    },
  }));
  harness.setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({ content: [] }));
  harness.setResponse("/api/admin/users/1/groups?page=0&size=100", "GET", () => ({ content: [] }));
  harness.setResponse("/api/admin/groups?page=0&size=100&sort=name%2Casc", "GET", () => ({ content: [] }));
  harness.setResponse(
    "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
    "GET",
    () => ({ content: [], number: 0, totalPages: 0 }),
  );
  harness.setResponse(consentPath, "GET", () => ({ content: [], number: 0, totalPages: 0 }));
  harness.setResponse(
    "/api/admin/users/1/events?page=0&size=10&sort=occurredAt,desc",
    "GET",
    () => ({ content: [], number: 0, totalPages: 0 }),
  );
  harness.setResponse("/api/admin/required-actions/users/1", "GET", () => []);
  harness.setResponse("/api/admin/users/1/webauthn/credentials?page=0&size=20", "GET", () => ({ content: [] }));
  try {
    await openUser(harness);
    assert.match(harness.document.querySelector(".admin-user-detail").textContent, /Not locked/);
    assert.equal(harness.document.querySelector('img[src*="untrusted.example"]'), null);
    assert.equal(harness.document.querySelector('[data-action="admin-user-avatar-delete-request"]'), null);
    assert.equal(harness.document.querySelector('select[name="activeFlag"]').value, "true");
    assert.equal(harness.document.querySelector('textarea[name="aliases"]').value, "ada\naugusta");
    assert.equal(harness.document.querySelector('input[name="contactEmail"]').type, "email");
    assert.equal(harness.document.querySelector('input[name="employeeNumber"]').type, "number");
    assert.equal(harness.document.querySelector('[name="hiddenField"]'), null);
    assert.equal(harness.document.querySelector('[name="systemField"]'), null);
    for (const [tab, selector, emptyText] of [
      ["roles", ".admin-user-role-summary", "No roles are inherited"],
      ["groups", ".admin-user-related-card", "No records found"],
      ["sessions", ".admin-user-related-card", "No records found"],
      ["consents", ".admin-user-related-card", "No records found"],
      ["events", ".admin-user-related-card", "No records found"],
    ]) {
      harness.document
        .querySelector(`[data-action="admin-user-detail-tab"][data-tab="${tab}"]`)
        .click();
      await settle();
      assert.match(harness.document.querySelector(selector).textContent, new RegExp(emptyText));
    }
    harness.document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="credentials"]')
      .click();
    await settle();
    assert.match(harness.document.querySelector(".admin-user-required-actions-card").textContent, /No required actions/);
    assert.match(harness.document.querySelector(".admin-user-passkeys-card").textContent, /adminNoPasskeys/);
  } finally {
    harness.restore();
  }
});

test("required-action controls reflect assignment, enablement and global policy", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    email: "ada@example.test",
    enabled: true,
    authorities: ["ROLE_USER"],
  }));
  harness.setResponse("/api/admin/required-actions/users/1", "GET", () => [
    { key: "VERIFY_EMAIL", displayName: "Verify email", enabled: true, globalPolicy: false, assigned: true },
    { key: "UPDATE_PASSWORD", displayName: "Update password", enabled: false, globalPolicy: false, assigned: false },
    { key: "CONFIGURE_TOTP", displayName: "Configure OTP", enabled: true, globalPolicy: true, assigned: false },
  ]);
  harness.setResponse("/api/admin/users/1/webauthn/credentials?page=0&size=20", "GET", () => ({ content: [] }));
  try {
    await openUser(harness);
    harness.document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="credentials"]')
      .click();
    await settle();
    const actions = harness.document.querySelectorAll(
      '[data-action="admin-user-detail-required-action"]',
    );
    assert.equal(actions.length, 3);
    assert.equal(actions[0].checked, true);
    assert.equal(actions[0].disabled, false);
    assert.equal(actions[1].checked, false);
    assert.equal(actions[1].disabled, true);
    assert.equal(actions[2].checked, false);
    assert.equal(actions[2].disabled, true);
  } finally {
    harness.restore();
  }
});

const notificationScenarios = [
  {
    name: "malformed empty payloads use safe count and empty fallbacks",
    page: { content: null },
    unread: "unknown",
    verify({ document }) {
      assert.match(document.querySelector(".content").textContent, /notificationsEmpty/);
      assert.match(document.querySelector(".content").textContent, /: 0/);
    },
  },
  {
    name: "known read and unknown unread messages render safely and mark read",
    page: {
      content: [
        {
          id: "10000000-0000-4000-8000-000000000010",
          messageKey: "notificationAdminUserRegistered",
          createdAt: "2026-10-12T08:30:00Z",
          read: true,
        },
        {
          id: "10000000-0000-4000-8000-000000000011",
          messageKey: "untrusted.message.key",
          createdAt: "not-a-date",
          read: false,
        },
      ],
    },
    unread: 1,
    readResponse: { status: 204, body: null },
    verify({ document, calls }) {
      const cards = document.querySelectorAll(".content .list-item");
      assert.equal(cards.length, 2);
      assert.equal(cards[0].querySelector('[data-action="notification-read"]'), null);
      assert.match(cards[0].textContent, /notificationRead/);
      assert.match(cards[1].textContent, /notificationsUnknown/);
      assert.equal(cards[1].querySelector(".muted").textContent, "");
      cards[1].querySelector('[data-action="notification-read"]').click();
      return settle().then(() => {
        assert.ok(
          calls.some(
            ({ path, method }) =>
              path === "/api/admin/notifications/10000000-0000-4000-8000-000000000011/read" &&
              method === "PUT",
          ),
        );
        assert.match(document.querySelector(".content").textContent, /: 0/);
      });
    },
  },
  {
    name: "failed notification reads preserve unread state",
    page: {
      content: [
        {
          id: "10000000-0000-4000-8000-000000000012",
          messageKey: "notificationAccountMfaEnabled",
          createdAt: "invalid",
          read: false,
        },
      ],
    },
    unread: 1,
    readResponse: { status: 503, body: { detail: "Unavailable" } },
    verify({ document, calls }) {
      document.querySelector('[data-action="notification-read"]').click();
      return settle().then(() => {
        assert.match(document.querySelector(".content").textContent, /notificationUnread/);
        assert.match(document.querySelector('[role="alert"]').textContent, /apiFailure/);
        assert.ok(calls.some(({ method }) => method === "PUT"));
      });
    },
  },
];

for (const scenario of notificationScenarios) {
  test(`native renderer notifications ${scenario.name}`, async () => {
    const harness = await renderConsole("admin");
    harness.setResponse("/api/admin/notifications?page=0&size=20", "GET", () => scenario.page);
    harness.setResponse("/api/admin/notifications/unread-count", "GET", () => scenario.unread);
    if (scenario.readResponse) {
      for (const item of scenario.page.content ?? []) {
        harness.setResponse(
          `/api/admin/notifications/${item.id}/read`,
          "PUT",
          () => scenario.readResponse,
        );
      }
    }
    try {
      harness.document.querySelector('[data-route="notifications"]').click();
      await settle();
      await scenario.verify({ document: harness.document, calls: harness.calls });
    } finally {
      harness.restore();
    }
  });
}
