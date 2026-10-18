import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const allAccess = {
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

const profileDefinitions = [
  {
    name: "booleanChoice",
    displayName: "Boolean choice",
    type: "BOOLEAN",
    enabled: true,
    builtIn: false,
    required: true,
    description: "Choose a value",
  },
  {
    name: "alternateEmails",
    displayName: "Alternate emails",
    type: "EMAIL",
    enabled: true,
    builtIn: false,
    multivalued: true,
    minLength: 5,
    maxLength: 120,
  },
  {
    name: "seatCount",
    displayName: "Seat count",
    type: "INTEGER",
    enabled: true,
    builtIn: false,
    pattern: "^[0-9]+$",
  },
  {
    name: "unknownType",
    displayName: "Unknown type",
    type: "URL",
    enabled: true,
    builtIn: false,
  },
  { name: "disabledField", enabled: false, builtIn: false },
  { name: "systemField", enabled: true, builtIn: true },
];

const scenarios = [
  {
    name: "manager sees locked account metadata and enabled required-action controls",
    access: allAccess,
    user: {
      id: 1,
      username: "ada",
      email: "ada@example.test",
      enabled: false,
      locked: true,
      lockedUntil: "2026-10-18T12:00:00Z",
      failedLoginCount: 3,
      emailVerified: false,
      mustChangePassword: true,
      temporaryPassword: true,
      totpEnabled: true,
      createdAt: "2026-01-01T10:00:00Z",
      updatedAt: "2026-10-01T10:00:00Z",
      authorities: ["ROLE_USER"],
      groupMappings: [{ groupPath: "/Engineering", roles: ["ROLE_EDITOR"] }],
      inheritedRoles: ["ROLE_EDITOR"],
      effectiveRoles: ["ROLE_USER", "ROLE_EDITOR"],
    },
    actions: [
      { key: "VERIFY_EMAIL", displayName: "Verify email", enabled: true, assigned: false, globalPolicy: false },
      { key: "UPDATE_PASSWORD", displayName: "Update password", enabled: true, assigned: true, globalPolicy: false },
    ],
    memberships: [{ id: 4, name: "Engineering", roles: [] }],
    sessions: [{ id: "session-1", username: "ada", createdAt: "2026-10-01T10:00:00Z", lastAccessedAt: "2026-10-02T10:00:00Z", expiresAt: "2026-10-03T10:00:00Z", authorizationCount: 2 }],
    verifyDetails({ document }) {
      assert.match(document.querySelector(".admin-user-security-panel").textContent, /Failed logins: 3/);
      assert.match(document.querySelector(".admin-user-security-panel").textContent, /Password change required/);
      assert.ok(document.querySelector('[data-action="admin-user-detail-unlock"]'));
      assert.equal(document.querySelector('[data-action="admin-user-detail-toggle-enabled"]').textContent.includes("Enable"), true);
      assert.match(document.querySelector(".admin-user-metadata").textContent, /2026/);
    },
    verifyCredentials({ document }) {
      const controls = [...document.querySelectorAll('[data-action="admin-user-detail-required-action"]')];
      assert.equal(controls.length, 2, JSON.stringify(document.body.textContent));
      assert.equal(controls[0].disabled, false);
      assert.equal(controls[1].checked, true);
      assert.equal(document.querySelector('[data-action="admin-user-detail-totp-request"]').disabled, false);
      assert.equal(document.querySelector('[data-form="admin-user-action-email"] select[name="action"]').disabled, false);
    },
  },
  {
    name: "viewer gets disabled fields and read-only required actions without email",
    access: {
      ...allAccess,
      manageUsers: false,
      manageRoles: false,
      manageGroups: false,
      manageSessions: false,
      manageConsents: false,
      manageEvents: false,
    },
    user: {
      id: 1,
      username: "ada",
      enabled: true,
      locked: false,
      failedLoginCount: 0,
      emailVerified: true,
      totpEnabled: false,
      authorities: ["ROLE_USER"],
    },
    actions: [
      { key: "CONFIGURE_TOTP", displayName: "Configure TOTP", enabled: true, assigned: true, globalPolicy: false },
      { key: "UPDATE_PASSWORD", displayName: "Update password", enabled: false, assigned: false, globalPolicy: false },
      { key: "VERIFY_EMAIL", displayName: "Verify email", enabled: true, assigned: false, globalPolicy: true },
    ],
    memberships: [],
    sessions: [{ id: "session-2", authorizationCount: null }],
    verifyDetails({ document }) {
      assert.match(document.querySelector(".admin-user-security-panel").textContent, /Not locked/);
      assert.equal(document.querySelector('[data-action="admin-user-detail-unlock"]'), null);
      assert.equal(document.querySelector('[data-action="admin-user-detail-delete"]'), null);
      assert.ok(document.querySelector('[data-form="admin-user-detail-save"] input[name="enabled"]').disabled);
      assert.equal(document.querySelector('[data-action="admin-user-avatar-upload"]').disabled, true);
    },
    verifyCredentials({ document }) {
      for (const control of document.querySelectorAll('[data-action="admin-user-detail-required-action"]')) {
        assert.equal(control.disabled, true);
      }
      assert.equal(document.querySelector('[data-form="admin-user-action-email"] select[name="action"]').disabled, true);
      assert.equal(document.querySelector('[data-form="admin-user-action-email"] button[type="submit"]').disabled, true);
      assert.equal(document.querySelector('[data-action="admin-user-detail-totp-request"]').disabled, true);
    },
  },
];

for (const scenario of scenarios) {
  test(`native renderer profile state ${scenario.name}`, async () => {
    const harness = await renderConsole("admin", {
      response: (path) =>
        path === "/api/admin/whoami" ? { access: scenario.access } : null,
    });
    harness.setResponse("/api/admin/users/1", "GET", () => scenario.user);
    harness.setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
      definitions: profileDefinitions,
      attributes: {
        booleanChoice: ["false"],
        alternateEmails: [],
        seatCount: ["0"],
        unknownType: ["value"],
      },
    }));
    harness.setResponse("/api/admin/required-actions/users/1", "GET", () => scenario.actions);
    harness.setResponse("/api/admin/users/1/webauthn/credentials?page=0&size=20", "GET", () => ({
      content: [],
      number: 0,
      totalPages: 0,
    }));
    harness.setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({
      content: [{ name: "ROLE_USER" }, { name: "ROLE_EDITOR" }],
    }));
    harness.setResponse("/api/admin/users/1/groups?page=0&size=100", "GET", () => ({
      content: scenario.memberships,
      number: 0,
      totalPages: scenario.memberships.length ? 1 : 0,
      totalElements: scenario.memberships.length,
    }));
    harness.setResponse("/api/admin/groups?page=0&size=100&sort=name%2Casc", "GET", () => ({
      content: [{ id: 4, name: "Engineering", path: "/Engineering" }, { id: 5, name: "Research", path: "/Research" }],
      number: 0,
      totalPages: 1,
      totalElements: 2,
    }));
    harness.setResponse(
      "/api/admin/users/1/sessions?page=0&size=10&sort=lastAccessTime,desc",
      "GET",
      () => ({
        content: scenario.sessions,
        number: 0,
        totalPages: 1,
        totalElements: scenario.sessions.length,
      }),
    );
    try {
      await settle();
      harness.document.querySelector('[data-route="users"]').click();
      await settle();
      harness.document
        .querySelector('[data-action="admin-user-profile-attributes-toggle"][data-id="1"]')
        .click();
      await settle();
      const profile = harness.document.querySelector('[data-form="admin-user-profile-attributes"]');
      assert.ok(profile);
      assert.equal(profile.querySelector('[name="attribute-booleanChoice"]').value, "false");
      assert.equal(profile.querySelector('[name="attribute-alternateEmails"]').value, "");
      assert.equal(profile.querySelector('[name="attribute-seatCount"]').type, "number");
      assert.equal(profile.querySelector('[name="attribute-unknownType"]').type, "text");
      assert.equal(profile.querySelector('[name="attribute-disabledField"]'), null);
      assert.equal(profile.querySelector('[name="attribute-systemField"]'), null);
      harness.document
        .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
        .click();
      await settle();
      scenario.verifyDetails({ document: harness.document });
      harness.document
        .querySelector('[data-action="admin-user-detail-tab"][data-tab="roles"]')
        .click();
      await settle();
      assert.match(harness.document.querySelector(".admin-user-role-summary").textContent, /ROLE_USER/);
      assert.match(harness.document.querySelector(".admin-user-role-summary").textContent, /Engineering|No roles are inherited/);
      harness.document
        .querySelector('[data-action="admin-user-detail-tab"][data-tab="groups"]')
        .click();
      await settle();
      const groupPanel = harness.document.querySelector(".admin-user-related-card");
      assert.ok(groupPanel);
      if (scenario.access.manageUsers) {
        assert.match(groupPanel.textContent, /Engineering/);
        assert.match(groupPanel.textContent, /—/);
        assert.ok(groupPanel.querySelector('[data-action="admin-user-detail-remove-group"]'));
      } else {
        assert.match(groupPanel.textContent, /No records found/);
        assert.equal(groupPanel.querySelector('[data-action="admin-user-detail-remove-group"]'), null);
      }
      harness.document
        .querySelector('[data-action="admin-user-detail-tab"][data-tab="sessions"]')
        .click();
      await settle();
      const sessionTable = harness.document.querySelector(".admin-user-session-table");
      assert.ok(sessionTable);
      assert.match(sessionTable.textContent, scenario.access.manageSessions ? /2/ : /0/);
      assert.equal(
        sessionTable.querySelector('[data-action="admin-user-detail-revoke-session"]') !== null,
        Boolean(scenario.access.manageSessions),
      );
      harness.document
        .querySelector('[data-action="admin-user-detail-tab"][data-tab="credentials"]')
        .click();
      await settle();
      scenario.verifyCredentials({ document: harness.document });
      harness.document
        .querySelector('[data-action="admin-user-detail-tab"][data-tab="details"]')
        .click();
      await settle();
    } finally {
      harness.restore();
    }
  });
}

test("provider details fall back to connection metadata when policy and mapper data are sparse", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=10&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "github",
          providerType: "saml",
          alias: "github-login",
          displayName: "GitHub",
          enabled: false,
        },
      ],
      number: 0,
      totalPages: 1,
      totalElements: 1,
    }),
  );
  harness.setResponse("/api/admin/identity-providers/github", "GET", () => ({
    id: "github",
    providerType: "saml",
    alias: "github-login",
    displayName: "GitHub",
    registrationId: "github",
    samlMetadataUri: "https://issuer.example.test/metadata",
    enabled: false,
  }));
  harness.setResponse("/api/admin/identity-providers/github/native-policy", "GET", () => ({
    status: 503,
    body: { detail: "Policy service unavailable" },
  }));
  harness.setResponse(
    "/api/admin/identity-providers/github/mappers?q=&page=0&size=10&sort=name%2Casc",
    "GET",
    () => ({ content: null, number: 0, totalPages: 0, totalElements: 0 }),
  );
  try {
    await settle();
    harness.document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    harness.document
      .querySelector('[data-action="admin-provider-open"][data-id="github"]')
      .click();
    await settle();
    const policy = harness.document.querySelector(
      '[data-form="admin-identity-provider-policy"]',
    );
    assert.ok(policy, JSON.stringify(harness.calls));
    assert.equal(policy.elements.namedItem("displayName").value, "GitHub");
    assert.equal(policy.elements.namedItem("enabled").checked, false);
    assert.ok(harness.document.querySelector(".identity-provider-form-layout form"));
    harness.document
      .querySelector('[data-action="admin-provider-tab"][data-tab="mappers"]')
      .click();
    await settle();
    assert.ok(harness.document.querySelector(".provider-mapper-empty"));
    assert.ok(harness.document.querySelector('[data-action="admin-provider-mapper-create"]'));
  } finally {
    harness.restore();
  }
});

test("profile-attribute server validation keeps the draft beside its field error", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
    definitions: [
      {
        name: "contactEmail",
        displayName: "Contact email",
        type: "EMAIL",
        enabled: true,
        builtIn: false,
        required: true,
      },
    ],
    attributes: { contactEmail: ["ada@example.test"] },
  }));
  harness.setResponse("/api/admin/users/1/profile-attributes", "PUT", () => ({
    status: 400,
    body: {
      violations: [
        { field: "attributes.contactEmail", message: "Email is already in use" },
      ],
    },
  }));
  try {
    await settle();
    harness.document.querySelector('[data-route="users"]').click();
    await settle();
    harness.document
      .querySelector('[data-action="admin-user-profile-attributes-toggle"][data-id="1"]')
      .click();
    await settle();
    let form = harness.document.querySelector('[data-form="admin-user-profile-attributes"]');
    form.querySelector('[name="attribute-contactEmail"]').value = "ada@example.test";
    form.dispatchEvent(
      new harness.dom.window.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    form = harness.document.querySelector('[data-form="admin-user-profile-attributes"]');
    const input = form.querySelector('[name="attribute-contactEmail"]');
    assert.equal(input.value, "ada@example.test");
    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.match(input.parentElement.querySelector(".field-error").textContent, /already in use/);
  } finally {
    harness.restore();
  }
});
