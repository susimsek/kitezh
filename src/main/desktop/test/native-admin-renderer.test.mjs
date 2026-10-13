import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseVisibleEditorActions,
  renderConsole,
  settle,
} from "./native-renderer-harness.mjs";

test("native Admin renderer covers every authorized primary route", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/whoami", "GET", () => ({
    access: {
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
    },
  }));
  try {
    const { calls, document } = harness;
    for (let turn = 0; turn < 60; turn += 1) {
      await settle();
      if (
        calls.some(({ path }) => path === "/api/admin/whoami") &&
        document.querySelector('[data-route="notifications"]')
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const routes = [
      "dashboard",
      "users",
      "roles",
      "groups",
      "clients",
      "client-scopes",
      "identity-providers",
      "sessions",
      "notifications",
      "consents",
      "offline-sessions",
      "events",
      "keys",
      "policies",
      "configuration",
      "login-email",
      "localization",
      "ldap",
      "authentication",
    ];
    for (const route of routes) {
      const link = document.querySelector(`[data-route="${route}"]`);
      assert.ok(link, `Admin navigation should include ${route}`);
      link.click();
      for (let turn = 0; turn < 30; turn += 1) {
        await settle();
        if (!document.querySelector(`[data-route="${route}"]`)?.disabled) break;
      }
      assert.equal(
        document
          .querySelector(`[data-route="${route}"]`)
          .getAttribute("aria-current"),
        "page",
      );
      assert.equal(
        document.querySelector(`[data-route="${route}"]`).disabled,
        false,
      );
      if (route === "users") {
        assert.ok(document.getElementById("admin-user-search"));
        assert.match(
          document.querySelector(".content").textContent,
          /adminSearchUsers/,
        );

        const editButton = document.querySelector(
          '[data-action="admin-user-edit-toggle"][data-id="1"]',
        );
        assert.ok(editButton);
        editButton.click();
        await settle();
        assert.ok(document.querySelector('[data-form="admin-user-edit"]'));
        const editForm = document.querySelector(
          '[data-form="admin-user-edit"]',
        );
        editForm.elements.namedItem("firstName").value = "Grace";
        const editRole = editForm.querySelector('input[name="roles"]');
        assert.ok(editRole);
        editRole.checked = true;
        editForm.dispatchEvent(
          new document.defaultView.Event("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
        await settle();
        assert.ok(
          calls.some(
            ({ path, method, body }) =>
              path === "/api/admin/users/1" &&
              method === "PUT" &&
              body.firstName === "Grace",
          ),
        );
        document.querySelector('[data-route="users"]').click();
        await settle();
        document
          .querySelector('[data-action="admin-user-edit-cancel"][data-id="1"]')
          ?.click();
        await settle();
        assert.equal(
          document.querySelector('[data-form="admin-user-edit"]'),
          null,
        );

        document
          .querySelector(
            '[data-action="admin-user-action-email-toggle"][data-id="1"]',
          )
          ?.click();
        await settle();
        assert.ok(
          document.querySelector('[data-form="admin-user-action-email"]'),
        );
        document
          .querySelector('[data-form="admin-user-action-email"]')
          .dispatchEvent(
            new document.defaultView.Event("submit", {
              bubbles: true,
              cancelable: true,
            }),
          );
        await settle();
        assert.ok(
          calls.some(
            ({ path, method }) =>
              path ===
                "/api/admin/users/1/execute-actions-email?lifespan=43200" &&
              method === "PUT",
          ),
        );
        document.querySelector('[data-route="users"]').click();
        await settle();
        document
          .querySelector(
            '[data-action="admin-user-action-email-close"][data-id="1"]',
          )
          ?.click();
        await settle();

        document
          .querySelector(
            '[data-action="admin-user-password-reset-toggle"][data-id="1"]',
          )
          .click();
        await settle();
        const resetForm = document.querySelector(
          '[data-form="admin-user-password-reset"]',
        );
        assert.ok(resetForm);
        resetForm.elements.namedItem("password").value =
          "Another-Strong-Test-42";
        resetForm.dispatchEvent(
          new document.defaultView.Event("submit", {
            bubbles: true,
            cancelable: true,
          }),
        );
        await settle();
        assert.ok(
          calls.some(
            ({ path, method }) =>
              path === "/api/admin/users/1/password" && method === "PUT",
          ),
        );
      }
      await exerciseVisibleEditorActions(document);
    }
    assert.ok(calls.some(({ path }) => path === "/api/admin/whoami"));
    assert.ok(calls.some(({ path }) => path.startsWith("/api/admin/users?")));
    assert.ok(calls.some(({ path }) => path.startsWith("/api/admin/roles?")));
    assert.ok(
      calls.some(({ path }) => path.startsWith("/api/admin/notifications")),
    );

    document.querySelector('[data-route="users"]').click();
    await settle();
    document.querySelector('[data-action="create-user"]').click();
    await settle();
    const createForm = document.querySelector(
      '[data-form="admin-user-create"]',
    );
    assert.ok(createForm);
    createForm.elements.namedItem("username").value = "grace";
    createForm.elements.namedItem("password").value = "Strong-Test-Password-42";
    createForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users" &&
          method === "POST" &&
          body.username === "grace" &&
          body.password === "Strong-Test-Password-42",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin user creation persists profile attributes and retries a failed profile save", async () => {
  const harness = await renderConsole("admin");
  let profileSaveAttempts = 0;
  harness.setResponse("/api/admin/profile-attributes", "GET", () => [
    {
      name: "department",
      displayName: "Department",
      type: "STRING",
      enabled: true,
      builtIn: false,
      required: true,
      minLength: 2,
      maxLength: 80,
      pattern: "^[A-Za-z ]+$",
    },
    {
      name: "contactEmail",
      displayName: "Contact email",
      type: "EMAIL",
      enabled: true,
      builtIn: false,
    },
    {
      name: "seatCount",
      displayName: "Seat count",
      type: "INTEGER",
      enabled: true,
      builtIn: false,
    },
    {
      name: "enabledFeature",
      displayName: "Enabled feature",
      type: "BOOLEAN",
      enabled: true,
      builtIn: false,
    },
    {
      name: "aliases",
      displayName: "Aliases",
      type: "STRING",
      enabled: true,
      builtIn: false,
      multivalued: true,
    },
    {
      name: "invalid name!",
      type: "STRING",
      enabled: true,
      builtIn: false,
    },
    {
      name: "disabledAttribute",
      type: "STRING",
      enabled: false,
      builtIn: false,
    },
    {
      name: "builtInAttribute",
      type: "STRING",
      enabled: true,
      builtIn: true,
    },
  ]);
  harness.setResponse(
    "/api/admin/users/9/profile-attributes",
    "PUT",
    ({ body }) => {
      profileSaveAttempts += 1;
      if (profileSaveAttempts === 1) return { status: 503, body: {} };
      return body;
    },
  );

  try {
    const { calls, document } = harness;
    for (let turn = 0; turn < 40; turn += 1) {
      await settle();
      if (document.querySelector('[data-route="users"]')) break;
    }
    document.querySelector('[data-route="users"]').click();
    await settle();
    document.querySelector('[data-action="create-user"]').click();
    await settle();
    const createForm = document.querySelector(
      '[data-form="admin-user-create"]',
    );
    assert.ok(createForm);
    assert.ok(
      createForm.querySelector('[type="email"][name="attribute-contactEmail"]'),
    );
    assert.ok(
      createForm.querySelector('[type="number"][name="attribute-seatCount"]'),
    );
    assert.ok(
      createForm.querySelector('select[name="attribute-enabledFeature"]'),
    );
    assert.ok(createForm.querySelector('textarea[name="attribute-aliases"]'));
    assert.equal(
      createForm.querySelector('[name="attribute-invalid name!"]'),
      null,
    );
    assert.equal(
      createForm.querySelector('[name="attribute-disabledAttribute"]'),
      null,
    );
    assert.equal(
      createForm.querySelector('[name="attribute-builtInAttribute"]'),
      null,
    );

    createForm.elements.namedItem("username").value = "grace-profile";
    createForm.elements.namedItem("password").value = "Strong-Test-Password-42";
    createForm.querySelector('[name="attribute-department"]').value =
      "Research";
    createForm.querySelector('[name="attribute-contactEmail"]').value =
      "grace@example.test";
    createForm.querySelector('[name="attribute-seatCount"]').value = "4";
    createForm.querySelector('[name="attribute-enabledFeature"]').value =
      "true";
    createForm.querySelector('[name="attribute-aliases"]').value =
      "G. Hopper\nRear Admiral";
    createForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const retryForm = document.querySelector('[data-form="admin-user-create"]');
    assert.equal(retryForm.dataset.createdUserId, "9");
    assert.equal(
      retryForm.querySelector('[name="attribute-department"]').value,
      "Research",
    );
    assert.equal(profileSaveAttempts, 1);
    retryForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const profileRequests = calls.filter(
      ({ path, method }) =>
        path === "/api/admin/users/9/profile-attributes" && method === "PUT",
    );
    assert.equal(profileRequests.length, 2);
    assert.deepEqual(profileRequests[0].body.attributes, {
      department: ["Research"],
      contactEmail: ["grace@example.test"],
      seatCount: ["4"],
      enabledFeature: ["true"],
      aliases: ["G. Hopper", "Rear Admiral"],
    });
    assert.equal(profileSaveAttempts, 2);
    assert.equal(
      document
        .querySelector('[data-route="users"]')
        .getAttribute("aria-current"),
      "page",
    );
  } finally {
    harness.restore();
  }
});

test("native Admin group permissions validates, edits, and persists assignments", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/groups/3/permissions", "GET", () => []);
  harness.setResponse("/api/admin/groups/3/permissions", "PUT", () => []);

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="groups"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="groups"]').disabled) break;
    }

    document
      .querySelector(
        '[data-action="admin-group-permissions-toggle"][data-id="3"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-group-permissions"]',
    );
    assert.ok(form, "authorized group permissions should load an editor");
    assert.ok(form.elements.namedItem("newUserId").options.length > 0);

    form.querySelector('[data-action="admin-group-permission-add"]').click();
    await settle();
    const updatedForm = document.querySelector(
      '[data-form="admin-group-permissions"]',
    );
    updatedForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/groups/3/permissions" &&
          method === "PUT" &&
          body.permissions.length === 1 &&
          body.permissions[0].userId === 1,
      ),
      "a valid permission assignment should be persisted once",
    );
  } finally {
    harness.restore();
  }
});

test("native Admin group editor covers role, name, and child-group flows", async () => {
  const harness = await renderConsole("admin");
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="groups"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="groups"]').disabled) break;
    }

    document
      .querySelector('[data-action="admin-group-roles-toggle"][data-id="3"]')
      .click();
    await settle();
    const roleForm = document.querySelector('[data-form="admin-group-roles"]');
    assert.ok(roleForm);
    roleForm.querySelector('input[name="roles"]').checked = true;
    roleForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/groups/3/roles" &&
          method === "PUT" &&
          body.roles.includes("ROLE_USER"),
      ),
    );

    document
      .querySelector('[data-action="admin-group-name-toggle"][data-id="3"]')
      .click();
    await settle();
    const nameForm = document.querySelector('[data-form="admin-group-rename"]');
    assert.ok(nameForm);
    nameForm.elements.namedItem("name").value = "Platform Engineering";
    nameForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/groups/3/name" &&
          method === "PUT" &&
          body.name === "Platform Engineering",
      ),
    );

    document
      .querySelector(
        '[data-action="admin-group-child-create-toggle"][data-id="3"]',
      )
      .click();
    await settle();
    const childForm = document.querySelector(
      '[data-form="admin-group-child-create"]',
    );
    assert.ok(childForm);
    childForm.elements.namedItem("name").value = "Runtime";
    childForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/groups" &&
          method === "POST" &&
          body.parentId === 3 &&
          body.name === "Runtime",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin role-composition panel renders and cancels removals", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/roles/ROLE_USER", "GET", () => ({
    compositeRoles: ["ROLE_ADMIN"],
    compositeClientRoles: [
      { id: 12, clientId: "console-client", name: "read" },
    ],
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="roles"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="roles"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-role-compositions-toggle"]')
      .click();
    await settle();

    const panel = document.querySelector('[data-role-composition="ROLE_USER"]');
    assert.ok(panel);
    assert.match(panel.textContent, /ROLE_ADMIN/);
    assert.match(panel.textContent, /console-client \/ read/);
    assert.ok(calls.some(({ path }) => path === "/api/admin/roles/ROLE_USER"));

    panel
      .querySelector('[data-action="admin-role-composite-remove-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-role-composite-remove-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-role-composite-remove-cancel"]')
      .click();
    await settle();

    document
      .querySelector(
        '[data-action="admin-role-client-composite-remove-request"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-role-client-composite-remove-confirm"]',
      ),
    );
    assert.equal(
      calls.some(({ method }) => method === "DELETE"),
      false,
      "canceling confirmation must not mutate the role",
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client-scope role mappings load, save, and cancel drafts", async () => {
  const harness = await renderConsole("admin");
  let mappers = [
    {
      id: "8",
      name: "email",
      mapperType: "email",
      claimName: "email",
      priority: 100,
      addToIdToken: true,
      addToAccessToken: true,
    },
  ];
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers?page=0&size=20&sort=name,asc",
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers/8",
    "PUT",
    ({ body }) => ({ id: "8", ...body }),
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers/8",
    "DELETE",
    () => {
      mappers = [];
      return { status: 204 };
    },
  );
  harness.setResponse(
    "/api/admin/client-scopes/profile/mappers",
    "POST",
    ({ body }) => {
      const saved = { id: "9", ...body };
      mappers = [...mappers, saved];
      return saved;
    },
  );
  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="client-scopes"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="client-scopes"]').disabled)
        break;
    }

    document
      .querySelector(
        '[data-action="admin-client-scope-role-mappings-toggle"][data-id="profile"]',
      )
      .click();
    await settle();
    const panel = document.querySelector(
      '[data-client-scope-role-mappings-panel][data-scope-id="profile"]',
    );
    assert.ok(panel);

    panel
      .querySelector('[data-action="admin-client-scope-role-mappings-save"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes/profile/role-mappings" &&
          method === "PUT" &&
          Array.isArray(body.applicationRoles) &&
          Array.isArray(body.clientRoleIds),
      ),
    );

    document
      .querySelector('[data-action="admin-client-scope-role-mappings-cancel"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector("[data-client-scope-role-mappings-panel]"),
      null,
    );

    document
      .querySelector(
        '[data-action="admin-client-scope-mappers-toggle"][data-id="profile"]',
      )
      .click();
    await settle();
    assert.ok(document.querySelector('[data-client-scope-mapper-id="8"]'));
    document
      .querySelector('[data-action="admin-client-scope-mapper-edit"]')
      .click();
    await settle();
    let mapperForm = document.querySelector(
      '[data-form="admin-client-scope-mapper"]',
    );
    mapperForm.elements.namedItem("claimName").value = "primary_email";
    mapperForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes/profile/mappers/8" &&
          method === "PUT" &&
          body.claimName === "primary_email",
      ),
    );
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-mapper-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes/profile/mappers/8" &&
          method === "DELETE",
      ),
    );
    document
      .querySelector(
        '[data-action="admin-client-scope-mapper-create"][data-id="profile"]',
      )
      .click();
    await settle();
    mapperForm = document.querySelector(
      '[data-form="admin-client-scope-mapper"]',
    );
    assert.ok(mapperForm);
    mapperForm.elements.namedItem("name").value = "Email claim";
    mapperForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes/profile/mappers" &&
          method === "POST" &&
          body.name === "Email claim" &&
          body.mapperType === "email",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client-scope deletion requires confirmation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/client-scopes/profile", "DELETE", () => ({
    status: 204,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="client-scopes"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="client-scopes"]').disabled)
        break;
    }
    document
      .querySelector(
        '[data-action="admin-client-scope-delete-request"][data-id="profile"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-scope-delete-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes/profile" && method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-client-scope-delete-request"][data-id="profile"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-scope-delete-confirm"][data-id="profile"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes/profile" && method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client-scope assignments edit and persist scope choices", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/clients/console-client/scope-assignments",
    "GET",
    () => ({
      defaultScopes: [],
      optionalScopes: [],
      availableScopes: [
        {
          name: "profile",
          displayName: "Profile",
          description: "Profile scope",
        },
      ],
    }),
  );
  harness.setResponse(
    "/api/admin/clients/console-client/scope-assignments",
    "PUT",
    ({ body }) => body,
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-client-scope-assignments-toggle"][data-id="console-client"]',
      )
      .click();
    await settle();

    const panel = document.querySelector(
      '[data-client-scope-assignments-panel][data-client-id="console-client"]',
    );
    assert.ok(panel);
    panel.querySelector('[name="defaultScopes"]').checked = true;
    panel
      .querySelector('[data-form="admin-client-scope-assignments"]')
      .dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/clients/console-client/scope-assignments" &&
          method === "PUT" &&
          body.defaultScopes.includes("profile"),
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client metadata loads, updates, and avoids secret fields", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/clients/console-client/native-metadata",
    "GET",
    () => ({ clientName: "Console Client" }),
  );
  harness.setResponse(
    "/api/admin/clients/console-client/native-metadata",
    "PUT",
    ({ body }) => body,
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-client-metadata-edit"][data-id="console-client"]',
      )
      .click();
    await settle();

    let form = document.querySelector(
      '[data-form="admin-client-native-metadata"]',
    );
    assert.ok(form);
    assert.equal(form.querySelector('[type="password"]'), null);
    form.elements.namedItem("clientName").value = "Native Console";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/clients/console-client/native-metadata" &&
          method === "PUT" &&
          body.clientName === "Native Console",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin localization settings save asynchronously without duplicate submissions", async () => {
  const harness = await renderConsole("admin");
  let finishSave;
  harness.setResponse("/api/admin/settings/localization", "GET", () => ({
    internationalizationEnabled: true,
    defaultLocale: "en",
    supportedLocales: ["en", "tr"],
  }));
  harness.setResponse(
    "/api/admin/settings/localization/messages?page=0&size=20&sort=locale,asc",
    "GET",
    () => ({ content: [], totalElements: 0, totalPages: 0, number: 0 }),
  );
  harness.setResponse(
    "/api/admin/settings/localization",
    "PUT",
    () =>
      new Promise((resolve) => {
        finishSave = () =>
          resolve({
            internationalizationEnabled: true,
            defaultLocale: "tr",
            supportedLocales: ["en", "tr"],
          });
      }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="localization"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="localization"]').disabled)
        break;
    }

    const form = document.querySelector(
      '[data-form="admin-localization-settings"]',
    );
    assert.ok(form);
    form.elements.namedItem("defaultLocale").value = "tr";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const busyButton = document.querySelector(
      '[data-form="admin-localization-settings"] button[type="submit"]',
    );
    assert.equal(busyButton.disabled, true);
    assert.ok(busyButton.querySelector(".spinner"));
    const busyLabel = busyButton.textContent;
    document
      .querySelector('[data-form="admin-localization-settings"]')
      .dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();

    const saves = calls.filter(
      ({ path, method }) =>
        path === "/api/admin/settings/localization" && method === "PUT",
    );
    assert.equal(saves.length, 1);
    assert.equal(saves[0].body.defaultLocale, "tr");
    assert.deepEqual(saves[0].body.supportedLocales, ["en", "tr"]);

    finishSave();
    await settle();
    const completedButton = document.querySelector(
      '[data-form="admin-localization-settings"] button[type="submit"]',
    );
    assert.equal(completedButton.disabled, false);
    assert.equal(completedButton.querySelector(".spinner"), null);
    assert.equal(completedButton.textContent, busyLabel);
    assert.match(document.querySelector(".content").textContent, /saved/i);
  } finally {
    harness.restore();
  }
});

test("native Admin login policy requires OTP before it can be mandatory", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login/native", "GET", () => ({
    sessionTimeoutMinutes: 30,
    passwordMinimumLength: 12,
    bruteForceMaxFailures: 5,
    otpEnabled: false,
    otpRequired: false,
  }));
  harness.setResponse("/api/admin/settings/email", "GET", () => ({
    enabled: false,
    fromAddress: "auth@example.test",
    baseUrl: "https://example.test",
    host: "smtp.example.test",
    port: 587,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="login-email"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="login-email"]').disabled) break;
    }
    const form = document.querySelector('[data-form="admin-login-settings"]');
    assert.ok(form);
    form.elements.namedItem("sessionTimeoutMinutes").value = "30";
    form.elements.namedItem("passwordMinimumLength").value = "12";
    form.elements.namedItem("bruteForceMaxFailures").value = "5";
    form.elements.namedItem("otpRequired").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/settings/login/native" && method === "PUT",
      ),
      false,
      "mandatory OTP must not be sent while OTP is disabled",
    );
    assert.match(document.querySelector('[role="alert"]').textContent, /OTP/i);

    const updatedForm = document.querySelector(
      '[data-form="admin-login-settings"]',
    );
    updatedForm.elements.namedItem("otpEnabled").checked = true;
    updatedForm.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/settings/login/native" && method === "PUT",
    );
    assert.ok(save);
    assert.equal(save.body.otpEnabled, true);
    assert.equal(save.body.otpRequired, true);
    assert.equal(save.body.passwordMinimumLength, 12);
  } finally {
    harness.restore();
  }
});

test("native Admin email settings preserve the configured username and clear the secret draft", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login/native", "GET", () => ({}));
  harness.setResponse("/api/admin/settings/email", "GET", () => ({
    enabled: true,
    fromAddress: "auth@example.test",
    baseUrl: "https://example.test",
    host: "smtp.example.test",
    port: 587,
    username: "service-account",
    smtpAuth: true,
    starttls: true,
    ssl: false,
  }));
  harness.setResponse("/api/admin/settings/email", "PUT", ({ body }) => ({
    ...body,
    username: body.username,
    password: undefined,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="login-email"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="login-email"]').disabled) break;
    }
    const form = document.querySelector('[data-form="admin-email-settings"]');
    assert.ok(form);
    assert.equal(form.elements.namedItem("username").value, "");
    form.elements.namedItem("password").value = "sensitive-test-secret";
    form.elements.namedItem("fromAddress").value = "auth@example.test";
    form.elements.namedItem("baseUrl").value = "https://example.test";
    form.elements.namedItem("host").value = "smtp.example.test";
    form.elements.namedItem("port").value = "587";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/settings/email" && method === "PUT",
    );
    assert.ok(save);
    assert.equal(save.body.username === "service-account", true);
    assert.equal(save.body.password === "sensitive-test-secret", true);
    const updatedForm = document.querySelector(
      '[data-form="admin-email-settings"]',
    );
    assert.equal(updatedForm.elements.namedItem("password").value, "");
    assert.equal(
      document
        .querySelector(".content")
        .textContent.includes("sensitive-test-secret"),
      false,
      "the secret must not remain in the rendered form after saving",
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client-scope creation validates and normalizes the draft", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/client-scopes", "POST", ({ body }) => ({
    id: "claims",
    ...body,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="client-scopes"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="client-scopes"]').disabled)
        break;
    }
    document.querySelector('[data-action="create-client-scope"]').click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-client-scope-create"]',
    );
    assert.ok(form);
    form.elements.namedItem("name").value = "  ";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/client-scopes" && method === "POST",
      ),
      false,
      "an empty normalized scope name must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));

    form = document.querySelector('[data-form="admin-client-scope-create"]');
    form.elements.namedItem("name").value = "  claims  ";
    form.elements.namedItem("displayName").value = " User Claims ";
    form.elements.namedItem("description").value = " Optional claims ";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/client-scopes" &&
          method === "POST" &&
          body.name === "claims" &&
          body.displayName === "User Claims" &&
          body.description === "Optional claims",
      ),
    );
    assert.ok(document.querySelector('[data-route="client-scopes"]'));
  } finally {
    harness.restore();
  }
});

test("native Admin forbidden response returns to an authorized Admin route", async () => {
  const harness = await renderConsole("admin");
  let forbidden = true;
  harness.setResponse("/api/admin/settings/localization", "GET", () => {
    if (forbidden) {
      forbidden = false;
      return {
        status: 403,
        kind: "forbidden",
        body: { detail: "Forbidden" },
      };
    }
    return {
      internationalizationEnabled: true,
      defaultLocale: "en",
      supportedLocales: ["en", "tr"],
    };
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="localization"]').click();
    await settle();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /admin/i,
    );
    const returnToAuthorizedRoute = document.querySelector(
      '[data-action="admin-return-authorized"]',
    );
    assert.ok(returnToAuthorizedRoute);
    returnToAuthorizedRoute.click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (
        document
          .querySelector('[data-route="dashboard"]')
          ?.getAttribute("aria-current") === "page"
      )
        break;
    }
    assert.equal(
      document
        .querySelector('[data-route="dashboard"]')
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/settings/localization" && method === "GET",
      ).length,
      1,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin role creation rejects malformed names and submits normalized data", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/roles", "POST", ({ body }) => ({
    id: 44,
    ...body,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="roles"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="roles"]').disabled) break;
    }
    document.querySelector('[data-action="create-role"]').click();
    await settle();
    let form = document.querySelector('[data-form="admin-role-create"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "auditor";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === "/api/admin/roles" && method === "POST",
      ),
      false,
      "role identifiers outside ROLE_* format must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));

    form = document.querySelector('[data-form="admin-role-create"]');
    form.elements.namedItem("name").value = "  ROLE_AUDITOR  ";
    form.elements.namedItem("description").value = " Audit access ";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/roles" &&
          method === "POST" &&
          body.name === "ROLE_AUDITOR" &&
          body.description === "Audit access",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin user deletion requires confirmation and can be canceled", async () => {
  const harness = await renderConsole("admin");

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }

    document
      .querySelector('[data-action="admin-user-unlock"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/unlock" && method === "POST",
      ),
    );

    document
      .querySelector('[data-action="admin-user-toggle-enabled"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-user-toggle-confirm"]'),
    );
    document.querySelector('[data-action="admin-user-toggle-confirm"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/enabled" &&
          method === "PUT" &&
          body.enabled === false,
      ),
    );

    document
      .querySelector('[data-action="admin-user-delete-request"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-delete-confirm"][data-id="1"]',
      ),
    );
    document.querySelector('[data-action="admin-user-delete-cancel"]').click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1" && method === "DELETE",
      ),
      false,
      "canceling confirmation must leave the user intact",
    );

    document
      .querySelector('[data-action="admin-user-delete-request"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-delete-confirm"][data-id="1"]')
      .click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/users/1" && method === "DELETE",
      ).length,
      1,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin user editor requires a role and clears email verification without email", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1", "PUT", ({ body }) => body);

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-edit-toggle"][data-id="1"]')
      .click();
    await settle();
    let form = document.querySelector('[data-form="admin-user-edit"]');
    assert.ok(form);
    form.querySelector('[name="roles"]').checked = false;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === "/api/admin/users/1" && method === "PUT",
      ),
      false,
    );
    form = document.querySelector('[data-form="admin-user-edit"]');
    assert.ok(
      [...form.querySelectorAll(".field-error")].some(
        (element) => element.textContent,
      ),
    );
    form.querySelector('[name="roles"]').checked = true;
    form.elements.namedItem("email").value = "";
    form.elements.namedItem("emailVerified").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const save = calls.find(
      ({ path, method }) => path === "/api/admin/users/1" && method === "PUT",
    );
    assert.ok(save);
    assert.deepEqual(save.body.roles, ["ROLE_USER"]);
    assert.equal(save.body.emailVerified, false);
  } finally {
    harness.restore();
  }
});

test("native Admin user access controls confirm disable, reset MFA, unlock, and send action email", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/enabled", "PUT", ({ body }) => body);
  harness.setResponse("/api/admin/users/1/totp", "DELETE", () => ({
    status: 204,
  }));
  harness.setResponse("/api/admin/users/1/unlock", "POST", () => ({
    status: 204,
  }));
  harness.setResponse(
    "/api/admin/users/1/execute-actions-email?lifespan=3600",
    "PUT",
    () => ({ status: 204 }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-toggle-enabled"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-toggle-confirm"][data-id="1"]',
      ),
    );
    document
      .querySelector('[data-action="admin-user-toggle-confirm"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/enabled" &&
          method === "PUT" &&
          body.enabled === false,
      ),
    );

    document
      .querySelector(
        '[data-action="admin-user-totp-reset-request"][data-id="1"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-user-totp-reset-confirm"][data-id="1"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/totp" && method === "DELETE",
      ),
    );

    document
      .querySelector('[data-action="admin-user-unlock"][data-id="1"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/unlock" && method === "POST",
      ),
    );

    document
      .querySelector(
        '[data-action="admin-user-action-email-toggle"][data-id="1"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-user-action-email"]',
    );
    assert.ok(form);
    form.elements.namedItem("action").value = "VERIFY_EMAIL";
    form.elements.namedItem("lifespan").value = "3600";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/execute-actions-email?lifespan=3600" &&
          method === "PUT" &&
          body[0] === "VERIFY_EMAIL",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin password reset validates strength and never keeps the submitted value", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/password", "PUT", () => ({
    status: 204,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-user-password-reset-toggle"][data-id="1"]',
      )
      .click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-user-password-reset"]',
    );
    assert.ok(form);
    form.elements.namedItem("password").value = "short";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/password" && method === "PUT",
      ),
      false,
    );

    form = document.querySelector('[data-form="admin-user-password-reset"]');
    const submittedPassword = "desktop-test-password-42";
    form.elements.namedItem("password").value = submittedPassword;
    form.elements.namedItem("temporary").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const reset = calls.find(
      ({ path, method }) =>
        path === "/api/admin/users/1/password" && method === "PUT",
    );
    assert.ok(reset);
    assert.equal(reset.body.password, submittedPassword);
    assert.equal(reset.body.temporary, true);
    assert.equal(
      document.querySelector('[data-form="admin-user-password-reset"]'),
      null,
    );
    assert.equal(document.body.textContent.includes(submittedPassword), false);
  } finally {
    harness.restore();
  }
});

test("native Admin OIDC provider creation validates endpoints and clears the client secret", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/identity-providers", "POST", ({ body }) => ({
    id: "example-oidc",
    providerType: "oidc",
    clientSecretConfigured: true,
    ...Object.fromEntries(
      Object.entries(body).filter(([key]) => key !== "clientSecret"),
    ),
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="identity-providers"]').disabled)
        break;
    }
    document
      .querySelector('[data-action="admin-oidc-provider-create"]')
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-identity-provider-connection"]',
    );
    assert.ok(form);
    const fields = {
      registrationId: "example-oidc",
      displayName: "Example Identity Provider",
      alias: "example-oidc",
      iconKey: "generic",
      clientId: "native-console",
      clientSecret: "sensitive-provider-secret",
      authorizationUri: "https://issuer.example.test/authorize",
      tokenUri: "https://issuer.example.test/token",
    };
    for (const [name, value] of Object.entries(fields))
      form.elements.namedItem(name).value = value;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/identity-providers" && method === "POST",
    );
    assert.ok(save);
    assert.equal(
      save.body.clientSecret === "sensitive-provider-secret",
      true,
      "the secret is sent only in the authorized provider save request",
    );
    assert.equal(save.body.providerType, "oidc");
    assert.equal(save.body.registrationId, "example-oidc");
    assert.equal(
      document.querySelector(
        '[data-form="admin-identity-provider-connection"]',
      ),
      null,
    );
    assert.equal(
      document
        .querySelector(".content")
        .textContent.includes("sensitive-provider-secret"),
      false,
      "the provider secret must not remain in rendered state",
    );
  } finally {
    harness.restore();
  }
});

test("native Admin SAML provider creation validates metadata and clears private keys", async () => {
  const harness = await renderConsole("admin");
  let finishSave;
  harness.setResponse(
    "/api/admin/identity-providers",
    "POST",
    ({ body }) =>
      new Promise((resolve) => {
        finishSave = () => resolve({ id: "example-saml", ...body });
      }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="identity-providers"]').disabled)
        break;
    }
    document
      .querySelector('[data-action="admin-saml-provider-create"]')
      .click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-saml-identity-provider-connection"]',
    );
    assert.ok(form);

    const setField = (name, value) => {
      form.elements.namedItem(name).value = value;
    };
    setField("registrationId", "example-saml");
    setField("displayName", "Example SAML");
    setField("alias", "example-saml");
    setField("iconKey", "generic");
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/identity-providers" && method === "POST",
      ),
      false,
      "SAML requires a metadata URI or complete manual configuration",
    );

    form = document.querySelector(
      '[data-form="admin-saml-identity-provider-connection"]',
    );
    form.elements.namedItem("samlMetadataUri").value =
      "https://issuer.example.test/metadata";
    form.elements.namedItem("samlSigningPrivateKey").value =
      "-----BEGIN PRIVATE KEY-----\\nSIGNING_SENTINEL\\n-----END PRIVATE KEY-----";
    form.elements.namedItem("samlDecryptionPrivateKey").value =
      "-----BEGIN PRIVATE KEY-----\\nDECRYPTION_SENTINEL\\n-----END PRIVATE KEY-----";
    form.elements.namedItem("samlWantAssertionsSigned").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    form = document.querySelector(
      '[data-form="admin-saml-identity-provider-connection"]',
    );
    const saveButton = form.querySelector('button[type="submit"]');
    assert.equal(saveButton.disabled, true);
    assert.ok(saveButton.querySelector(".spinner"));
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) =>
          path === "/api/admin/identity-providers" && method === "POST",
      ).length,
      1,
      "a pending SAML save must ignore duplicate submissions",
    );

    const save = calls.find(
      ({ path, method }) =>
        path === "/api/admin/identity-providers" && method === "POST",
    );
    assert.equal(save.body.providerType, "saml");
    assert.equal(
      save.body.samlMetadataUri,
      "https://issuer.example.test/metadata",
    );
    assert.equal(
      save.body.samlSigningPrivateKey.includes("SIGNING_SENTINEL"),
      true,
    );
    assert.equal(
      save.body.samlDecryptionPrivateKey.includes("DECRYPTION_SENTINEL"),
      true,
    );

    finishSave();
    await settle();
    assert.equal(
      document
        .querySelector(".content")
        .textContent.includes("SIGNING_SENTINEL"),
      false,
      "private key input must be cleared from the rendered form after save",
    );
  } finally {
    harness.restore();
  }
});

test("native Admin identity-provider policy edits and persists safe display settings", async () => {
  const harness = await renderConsole("admin");
  const providerPath = "/api/admin/identity-providers/example/native-policy";
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=20&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "example",
          providerType: "oidc",
          alias: "example",
          displayName: "Example",
          enabled: true,
          configured: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    "/api/admin/identity-providers/example/native-policy",
    "GET",
    () => ({
      displayName: "Example",
      enabled: true,
      hideOnLogin: false,
      accountLinkingOnly: false,
      trustEmail: false,
      mfaRequired: false,
      guiOrder: 1,
      showInAccountConsole: "always",
      syncMode: "import",
    }),
  );
  harness.setResponse(providerPath, "PUT", ({ body }) => body);

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="identity-providers"]').disabled)
        break;
    }
    document
      .querySelector(
        '[data-action="admin-identity-provider-policy-toggle"][data-id="example"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-identity-provider-policy"]',
    );
    assert.ok(form);
    form.elements.namedItem("displayName").value = " Example OIDC ";
    form.elements.namedItem("hideOnLogin").checked = true;
    form.elements.namedItem("mfaRequired").checked = true;
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === providerPath &&
          method === "PUT" &&
          body.displayName === "Example OIDC" &&
          body.hideOnLogin === true &&
          body.mfaRequired === true,
      ),
    );
    assert.equal(
      document.querySelector('[data-form="admin-identity-provider-policy"]'),
      null,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin passkey management renames and confirms credential deletion", async () => {
  const harness = await renderConsole("admin");
  const credentialPath = "/api/admin/users/1/webauthn/credentials/credential_1";
  harness.setResponse(
    "/api/admin/users/1/webauthn/credentials?page=0&size=100",
    "GET",
    () => ({
      content: [
        {
          credentialId: "credential_1",
          label: "Work laptop",
          transports: ["internal"],
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(credentialPath, "PUT", ({ body }) => body);
  harness.setResponse(credentialPath, "DELETE", () => ({ status: 204 }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-user-passkeys-toggle"][data-id="1"]')
      .click();
    await settle();
    const card = document.querySelector('[data-passkey-index="0"]');
    assert.ok(card);
    card
      .querySelector('[data-action="admin-user-passkey-rename-toggle"]')
      .click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-user-passkey-rename"]',
    );
    assert.ok(form);
    form.elements.namedItem("label").value = "  Updated laptop  ";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === credentialPath &&
          method === "PUT" &&
          body.label === "Updated laptop",
      ),
    );

    document
      .querySelector('[data-action="admin-user-passkey-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-passkey-delete-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-user-passkey-delete-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) => path === credentialPath && method === "DELETE",
      ),
      false,
    );

    document
      .querySelector('[data-action="admin-user-passkey-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-passkey-delete-confirm"]')
      .click();
    await settle();
    assert.equal(
      calls.filter(
        ({ path, method }) => path === credentialPath && method === "DELETE",
      ).length,
      1,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin user profile attributes normalize multi-value and boolean fields", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
    attributes: {
      departments: ["Platform"],
      publicProfile: ["false"],
      contactEmail: ["ada@example.test"],
      seatCount: ["4"],
      biography: ["Identity engineer"],
    },
    definitions: [
      {
        name: "departments",
        displayName: "Departments",
        enabled: true,
        builtIn: false,
        multivalued: true,
        required: true,
      },
      {
        name: "publicProfile",
        displayName: "Public profile",
        type: "BOOLEAN",
        enabled: true,
        builtIn: false,
        multivalued: false,
        required: false,
      },
      {
        name: "contactEmail",
        displayName: "Contact email",
        type: "EMAIL",
        enabled: true,
        builtIn: false,
        minLength: 5,
        maxLength: 120,
      },
      {
        name: "seatCount",
        displayName: "Seat count",
        type: "INTEGER",
        enabled: true,
        builtIn: false,
        minLength: 1,
        maxLength: 3,
        pattern: "^[0-9]+$",
      },
      {
        name: "biography",
        displayName: "Biography",
        type: "STRING",
        enabled: true,
        builtIn: false,
        pattern: "^[A-Za-z ]+$",
      },
    ],
  }));
  harness.setResponse(
    "/api/admin/users/1/profile-attributes",
    "PUT",
    ({ body }) => ({ attributes: body.attributes }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="users"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-user-profile-attributes-toggle"][data-id="1"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-user-profile-attributes"]',
    );
    assert.ok(form);
    assert.equal(
      form.querySelector('[name="attribute-contactEmail"]').type,
      "email",
    );
    assert.equal(
      form.querySelector('[name="attribute-seatCount"]').type,
      "number",
    );
    assert.equal(
      form.querySelector('[name="attribute-seatCount"]').getAttribute("step"),
      "1",
    );
    assert.equal(
      form.querySelector('[name="attribute-biography"]').type,
      "text",
    );
    assert.equal(
      form
        .querySelector('[name="attribute-biography"]')
        .getAttribute("pattern"),
      "^[A-Za-z ]+$",
    );
    form.querySelector('[data-profile-attribute="departments"]').value =
      " Platform \n Security \n \n";
    form.querySelector('[data-profile-attribute="publicProfile"]').value =
      "false";
    form.querySelector('[data-profile-attribute="contactEmail"]').value =
      "ada@example.test";
    form.querySelector('[data-profile-attribute="seatCount"]').value = "4";
    form.querySelector('[data-profile-attribute="biography"]').value =
      "Identity engineer";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/profile-attributes" &&
          method === "PUT" &&
          body.attributes.departments.join(",") === "Platform,Security" &&
          body.attributes.publicProfile[0] === "false" &&
          body.attributes.contactEmail[0] === "ada@example.test" &&
          body.attributes.seatCount[0] === "4" &&
          body.attributes.biography[0] === "Identity engineer",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin user avatar validates, uploads, and confirms removal", async () => {
  const harness = await renderConsole("admin");
  globalThis.__KITEZH_NATIVE_BOOTSTRAP__.apiBaseUrl =
    "https://kitezh.onrender.com";
  const previousCreateImageBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    writable: true,
    value: async () => ({ width: 32, height: 32, close() {} }),
  });
  harness.setResponse("/api/admin/users/1/avatar", "PUT", () => ({
    avatarUrl: "/avatars/550e8400-e29b-41d4-a716-446655440000?v=1",
  }));
  harness.setResponse("/api/admin/users/1/avatar", "DELETE", () => ({
    status: 204,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-avatar-toggle"][data-id="1"]')
      .click();
    await settle();

    const upload = document.querySelector(
      '[data-action="admin-user-avatar-upload"]',
    );
    upload.click();
    await settle();
    assert.match(document.querySelector(".content").textContent, /avatar/i);
    assert.equal(
      calls.some(
        ({ path, method }) => path.endsWith("/avatar") && method === "PUT",
      ),
      false,
    );

    const fileInput = document.querySelector('[data-admin-avatar-file="1"]');
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [
        {
          type: "image/png",
          size: 5,
          arrayBuffer: async () =>
            new Uint8Array([104, 101, 108, 108, 111]).buffer,
        },
      ],
    });
    document.querySelector('[data-action="admin-user-avatar-upload"]').click();
    await settle();
    assert.ok(
      document.querySelector(
        'img[src="https://kitezh.onrender.com/avatars/550e8400-e29b-41d4-a716-446655440000?v=1"]',
      ),
    );
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/1/avatar" &&
          method === "PUT" &&
          body.dataBase64 === "aGVsbG8=",
      ),
    );

    document
      .querySelector('[data-action="admin-user-avatar-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-user-avatar-delete-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-user-avatar-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/1/avatar" && method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector(
        'img[src="https://kitezh.onrender.com/avatars/550e8400-e29b-41d4-a716-446655440000?v=1"]',
      ),
      null,
    );
  } finally {
    harness.restore();
    if (previousCreateImageBitmap) {
      Object.defineProperty(
        globalThis,
        "createImageBitmap",
        previousCreateImageBitmap,
      );
    } else {
      delete globalThis.createImageBitmap;
    }
  }
});

test("native Admin confidential client validates redirects and reveals its secret once", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/clients", "POST", ({ body }) => ({
    client: {
      id: "created-console",
      clientId: body.clientId,
      clientName: body.clientName,
      scopes: body.scopes,
    },
    clientSecret: "one-time-client-secret",
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document.querySelector('[data-action="create-client"]').click();
    await settle();
    let form = document.querySelector('[data-form="admin-client-create"]');
    assert.ok(form);
    form.elements.namedItem("clientId").value = "native-console";
    form.elements.namedItem("clientName").value = "Native Console";
    form.elements.namedItem("redirectUris").value = "javascript:alert(1)";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/clients" && method === "POST",
      ),
      false,
      "unsafe redirect destinations must not reach the API",
    );
    assert.ok(document.querySelector('[role="alert"]'));

    form = document.querySelector('[data-form="admin-client-create"]');
    form.elements.namedItem("redirectUris").value =
      "https://console.example.test/callback";
    form.elements.namedItem("postLogoutRedirectUris").value =
      "https://console.example.test/logout";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const create = calls.find(
      ({ path, method }) => path === "/api/admin/clients" && method === "POST",
    );
    assert.ok(create);
    assert.equal(create.body.requireProofKey, true);
    assert.equal(
      create.body.clientAuthenticationMethods[0],
      "client_secret_basic",
    );
    assert.equal(
      document.querySelector('[data-one-time-client-secret="true"]')
        ?.textContent === "one-time-client-secret",
      true,
    );
    assert.equal(
      document.querySelector('[data-form="admin-client-create"]'),
      null,
    );
    document
      .querySelector('[data-action="client-create-secret-dismiss"]')
      .click();
    await settle();
    assert.equal(
      document.querySelector('[data-one-time-client-secret="true"]'),
      null,
    );
    assert.ok(document.querySelector('[data-route="clients"]'));
  } finally {
    harness.restore();
  }
});

test("native Admin policy and branding settings render and persist their forms", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/ciba-policy", "GET", () => ({
    requestLifespanSeconds: 120,
    pollingIntervalSeconds: 5,
    deliveryMode: "poll",
    userVerification: "preferred",
    mfaRequired: true,
    stepUpRequired: false,
    stepUpAcr: "urn:example:loa:2",
  }));
  harness.setResponse("/api/admin/settings/offline-access", "GET", () => ({
    idleTimeout: "P30D",
    maxLifespan: "P180D",
    maxLimited: true,
  }));
  harness.setResponse("/api/admin/settings/branding", "GET", () => ({
    applicationName: "Kitezh",
    primaryColor: "#112233",
    accentColor: "#445566",
    backgroundColor: "#ffffff",
    logoPath: "/assets/logo.svg",
  }));
  harness.setResponse("/api/admin/server-info", "GET", () => ({
    issuer: "https://issuer.example.test",
    activeSigningKey: {
      kid: "key-1",
      type: "RSA",
      algorithm: "RS256",
      use: "sig",
    },
  }));
  harness.setResponse(
    "/api/admin/settings/ciba-policy",
    "PUT",
    (request) => request.body,
  );
  harness.setResponse(
    "/api/admin/settings/offline-access",
    "PUT",
    (request) => request.body,
  );
  harness.setResponse(
    "/api/admin/settings/branding",
    "PUT",
    (request) => request.body,
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="policies"]').click();
    await settle();
    const ciba = document.querySelector('[data-form="admin-ciba-policy"]');
    assert.ok(ciba);
    ciba.elements.namedItem("stepUpRequired").checked = true;
    ciba.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/settings/ciba-policy" &&
          method === "PUT" &&
          body.stepUpRequired,
      ),
    );

    const offline = document.querySelector(
      '[data-form="admin-offline-access-policy"]',
    );
    assert.ok(offline);
    offline.elements.namedItem("maxLimited").checked = false;
    offline.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/settings/offline-access" &&
          method === "PUT" &&
          body.maxLimited === false,
      ),
    );

    document.querySelector('[data-route="configuration"]').click();
    await settle();
    const branding = document.querySelector('[data-form="admin-branding"]');
    assert.ok(branding);
    branding.elements.namedItem("applicationName").value = "Kitezh Desktop";
    branding.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/settings/branding" &&
          method === "PUT" &&
          body.applicationName === "Kitezh Desktop",
      ),
    );
    assert.match(
      document.querySelector(".content").textContent,
      /issuer\.example\.test/,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin dashboard shows healthy server, signing key, and recent events", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/dashboard", "GET", () => ({
    clients: 7,
    users: 22,
    sessions: 3,
    consents: 5,
  }));
  harness.setResponse(
    "/api/admin/events?size=6&sort=occurredAt,desc",
    "GET",
    () => ({
      content: [
        {
          action: "user.updated",
          actor: "admin@example.test",
          targetType: "user",
          targetId: "42",
          occurredAt: "2026-10-12T08:30:00Z",
        },
      ],
    }),
  );
  harness.setResponse("/api/admin/server-info", "GET", () => ({
    issuer: "https://issuer.example.test",
    activeSigningKey: { kid: "key-1", algorithm: "RS256" },
  }));
  harness.setResponse("/actuator/health/readiness", "GET", () => ({
    status: 200,
    body: { status: "UP" },
  }));

  try {
    const { document } = harness;
    document.querySelector('[data-route="dashboard"]').click();
    await settle();
    assert.match(
      document.querySelector(".content").textContent,
      /issuer\.example\.test/,
    );
    assert.match(document.querySelector(".content").textContent, /key-1/);
    assert.match(
      document.querySelector(".content").textContent,
      /user\.updated/,
    );
    assert.match(document.querySelector('[role="status"]').textContent, /UP/);
    assert.equal(document.querySelectorAll(".stat-value")[0].textContent, "7");
  } finally {
    harness.restore();
  }
});

test("native Admin LDAP overview displays configured provider status", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/ldap", "GET", () => [
    {
      id: 1,
      name: "Corporate Directory",
      vendor: "Active Directory",
      authenticationType: "simple",
      editMode: "READ_ONLY",
      enabled: true,
      lastSyncImported: 4,
    },
  ]);

  try {
    const { document } = harness;
    document.querySelector('[data-route="ldap"]').click();
    await settle();
    assert.match(
      document.querySelector(".content").textContent,
      /Corporate Directory/,
    );
    assert.match(
      document.querySelector(".content").textContent,
      /Active Directory/,
    );
    assert.match(document.querySelector(".content").textContent, /4/);
  } finally {
    harness.restore();
  }
});

test("native Admin sessions search and revocation controls use bounded contracts", async () => {
  const harness = await renderConsole("admin");
  let active = true;
  harness.setResponse("/api/admin/sessions/session-1", "DELETE", () => {
    active = false;
    return { status: 204 };
  });
  const sessionPage = () => ({
    content: active
      ? [
          {
            id: "session-1",
            username: "ada",
            authorizationCount: 2,
            active: true,
          },
        ]
      : [],
    number: 0,
    totalPages: 1,
  });
  harness.setResponse(
    "/api/admin/sessions?q=&status=active&page=0&size=20&sort=lastAccessTime%2Cdesc",
    "GET",
    sessionPage,
  );
  harness.setResponse(
    "/api/admin/sessions?q=ada&status=expired&page=0&size=20&sort=lastAccessTime%2Cdesc",
    "GET",
    sessionPage,
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="sessions"]').click();
    await settle();
    const search = document.getElementById("admin-session-search");
    search.elements.namedItem("q").value = "ada";
    search.elements.namedItem("status").value = "expired";
    search.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path }) => path.includes("q=ada") && path.includes("status=expired"),
      ),
    );

    document
      .querySelector('[data-action="admin-session-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-session-delete-confirm"]'),
    );
    document
      .querySelector('[data-action="admin-session-delete-cancel"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-session-delete-request"]'),
    );

    document
      .querySelector('[data-action="admin-session-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-session-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/sessions/session-1" && method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector('[data-action="admin-session-delete-request"]'),
      null,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin consent and offline-session revocation require confirmation", async () => {
  const harness = await renderConsole("admin");
  let consentActive = true;
  let offlineSessionActive = true;
  harness.setResponse(
    "/api/admin/consents?q=&page=0&size=20&sort=id.principalName%2Casc",
    "GET",
    () => ({
      content: consentActive
        ? [
            {
              clientId: "console-client",
              clientName: "Console",
              principalName: "ada@example.test",
              authorities: ["openid"],
            },
          ]
        : [],
      number: 0,
      totalPages: 1,
    }),
  );
  harness.setResponse(
    "/api/admin/consents/consents/console-client/ada%40example.test",
    "DELETE",
    () => {
      consentActive = false;
      return { status: 204 };
    },
  );
  harness.setResponse(
    "/api/admin/offline-sessions?page=0&size=20",
    "GET",
    () => ({
      content: offlineSessionActive
        ? [
            {
              id: "offline-session-1",
              clientId: "console-client",
              clientName: "Console",
              username: "ada",
            },
          ]
        : [],
      number: 0,
      totalPages: 1,
    }),
  );
  harness.setResponse(
    "/api/admin/offline-sessions/offline-session-1",
    "DELETE",
    () => {
      offlineSessionActive = false;
      return { status: 204 };
    },
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="consents"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-consent-revoke-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-consent-revoke-confirm"]'),
    );
    document
      .querySelector('[data-action="admin-consent-revoke-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-consent-revoke-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-consent-revoke-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path.includes("console-client/ada%40example.test") &&
          method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector('[data-action="admin-consent-revoke-request"]'),
      null,
    );

    document.querySelector('[data-route="offline-sessions"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-offline-session-revoke-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-offline-session-revoke-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-offline-session-revoke-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-offline-session-revoke-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-offline-session-revoke-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/offline-sessions/offline-session-1" &&
          method === "DELETE",
      ),
    );
    assert.equal(
      document.querySelector(
        '[data-action="admin-offline-session-revoke-request"]',
      ),
      null,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin signing-key rotation requires a second confirmation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/keys/rotate", "POST", () => ({
    kid: "signing-key-2",
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="keys"]').click();
    await settle();
    assert.match(
      document.querySelector(".content").textContent,
      /signing-key-1/,
    );
    document.querySelector('[data-action="admin-key-rotate-request"]').click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-key-rotate-confirm"]'),
    );
    document.querySelector('[data-action="admin-key-rotate-cancel"]').click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/keys/rotate" && method === "POST",
      ),
      false,
    );

    document.querySelector('[data-action="admin-key-rotate-request"]').click();
    await settle();
    document.querySelector('[data-action="admin-key-rotate-confirm"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/keys/rotate" && method === "POST",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin bulk user updates validate selection and confirm before submit", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/bulk", "POST", ({ body }) => body);

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="users"]').click();
    await settle();
    const checkbox = document.querySelector(
      '[data-action="admin-user-bulk-select"][data-id="1"]',
    );
    assert.ok(checkbox);
    checkbox.click();
    await settle();
    const enable = document.querySelector(
      '[data-action="admin-user-bulk-enable"]',
    );
    assert.ok(enable);
    enable.click();
    await settle();
    assert.ok(
      document.querySelector('[data-action="admin-user-bulk-confirm"]'),
    );
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/users/bulk" && method === "POST",
      ),
      false,
    );

    document.querySelector('[data-action="admin-user-bulk-confirm"]').click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/users/bulk" &&
          method === "POST" &&
          body.action === "ENABLE" &&
          body.userIds.includes(1),
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin identity-provider mapper CRUD validates and persists mappings", async () => {
  const harness = await renderConsole("admin");
  const mapperPath = "/api/admin/identity-providers/github/mappers";
  let mappers = [
    {
      id: "email-mapper",
      name: "email",
      sourceClaim: "email",
      target: "email",
      mapperType: "user-attribute",
      syncMode: "import",
      addToIdToken: true,
      addToAccessToken: true,
    },
  ];
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=20&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "github",
          alias: "github",
          providerType: "oidc",
          displayName: "GitHub",
          enabled: true,
          configured: true,
          mapperCount: mappers.length,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${mapperPath}?page=0&size=20&sort=name,asc`,
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(`${mapperPath}/email-mapper`, "PUT", ({ body }) => ({
    id: "email-mapper",
    ...body,
  }));
  harness.setResponse(mapperPath, "POST", ({ body }) => {
    const saved = { id: "given-name", ...body };
    mappers = [...mappers, saved];
    return saved;
  });
  harness.setResponse(`${mapperPath}/email-mapper`, "DELETE", () => {
    mappers = [];
    return { status: 204 };
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-provider-mappers-toggle"][data-id="github"]',
      )
      .click();
    await settle();
    assert.ok(
      document.querySelector('[data-provider-mapper-id="email-mapper"]'),
      JSON.stringify(calls.map(({ path }) => path)),
    );

    document
      .querySelector('[data-action="admin-provider-mapper-edit"]')
      .click();
    await settle();
    let form = document.querySelector('[data-form="admin-provider-mapper"]');
    assert.ok(form);
    form.elements.namedItem("target").value = "primaryEmail";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${mapperPath}/email-mapper` &&
          method === "PUT" &&
          body.target === "primaryEmail",
      ),
    );

    document
      .querySelector('[data-action="admin-provider-mapper-delete-request"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[data-action="admin-provider-mapper-delete-confirm"]',
      ),
    );
    document
      .querySelector('[data-action="admin-provider-mapper-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-provider-mapper-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === `${mapperPath}/email-mapper` && method === "DELETE",
      ),
    );

    document
      .querySelector('[data-action="admin-provider-mapper-create"]')
      .click();
    await settle();
    form = document.querySelector('[data-form="admin-provider-mapper"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "givenName";
    form.elements.namedItem("sourceClaim").value = "given_name";
    form.elements.namedItem("target").value = "firstName";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === mapperPath &&
          method === "POST" &&
          body.name === "givenName" &&
          body.target === "firstName",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin OIDC connection updates preserve configured secrets", async () => {
  const harness = await renderConsole("admin");
  const provider = {
    id: "github",
    registrationId: "github",
    providerType: "oidc",
    displayName: "GitHub",
    alias: "github",
    iconKey: "github",
    enabled: true,
    clientId: "public-client-id",
    clientSecretConfigured: true,
    authorizationUri: "https://github.example.test/authorize",
    tokenUri: "https://github.example.test/token",
    userInfoUri: "https://github.example.test/userinfo",
    clientAuthenticationMethod: "client_secret_basic",
    scopes: "openid profile email",
    userNameAttribute: "login",
  };
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=20&sort=guiOrder%2Casc",
    "GET",
    () => ({ content: [provider], totalElements: 1, totalPages: 1, number: 0 }),
  );
  harness.setResponse(
    "/api/admin/identity-providers/github",
    "GET",
    () => provider,
  );
  harness.setResponse(
    "/api/admin/identity-providers/github",
    "PUT",
    ({ body }) => ({
      ...provider,
      ...body,
      clientSecretConfigured: true,
    }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-identity-provider-config-edit"][data-id="github"]',
      )
      .click();
    await settle();
    const form = document.querySelector(
      '[data-form="admin-identity-provider-connection"]',
    );
    assert.ok(form);
    assert.equal(form.elements.namedItem("clientSecret").value, "");
    form.elements.namedItem("displayName").value = "GitHub Enterprise";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const update = calls.find(
      ({ path, method }) =>
        path === "/api/admin/identity-providers/github" && method === "PUT",
    );
    assert.ok(update);
    assert.equal(update.body.clientSecret, "");
    assert.equal(update.body.displayName, "GitHub Enterprise");
    assert.equal(
      document.querySelector(
        '[data-form="admin-identity-provider-connection"]',
      ),
      null,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin identity-provider deletion requires confirmation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(
    "/api/admin/identity-providers?q=&page=0&size=20&sort=guiOrder%2Casc",
    "GET",
    () => ({
      content: [
        {
          id: "github",
          alias: "github",
          registrationId: "github",
          providerType: "oidc",
          displayName: "GitHub",
          enabled: true,
          configured: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse("/api/admin/identity-providers/github", "DELETE", () => ({
    status: 204,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-identity-provider-delete-request"][data-id="github"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-identity-provider-delete-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/identity-providers/github" &&
          method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-identity-provider-delete-request"][data-id="github"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-identity-provider-delete-confirm"][data-id="github"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/identity-providers/github" &&
          method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client mapper CRUD validates and persists mappings", async () => {
  const harness = await renderConsole("admin");
  const mapperPath = "/api/admin/clients/console-client/mappers";
  let mappers = [
    {
      id: "17",
      name: "email",
      source: "email",
      mapperType: "email",
      claimName: "email",
      priority: 100,
      addToIdToken: true,
      addToAccessToken: true,
    },
  ];
  harness.setResponse(
    mapperPath + "?page=0&size=20&sort=name,asc",
    "GET",
    () => ({
      content: mappers,
      totalElements: mappers.length,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(`${mapperPath}/17`, "PUT", ({ body }) => ({
    id: "17",
    ...body,
  }));
  harness.setResponse(mapperPath, "POST", ({ body }) => {
    const saved = { id: "18", ...body };
    mappers = [...mappers, saved];
    return saved;
  });
  harness.setResponse(`${mapperPath}/17`, "DELETE", () => {
    mappers = [];
    return { status: 204 };
  });
  harness.setResponse("/api/admin/clients/console-client", "DELETE", () => ({
    status: 204,
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-client-mappers-toggle"][data-id="console-client"]',
      )
      .click();
    await settle();
    assert.ok(document.querySelector('[data-client-mapper-id="17"]'));

    document.querySelector('[data-action="admin-client-mapper-edit"]').click();
    await settle();
    let form = document.querySelector('[data-form="admin-client-mapper"]');
    assert.ok(form);
    form.elements.namedItem("claimName").value = "primary_email";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${mapperPath}/17` &&
          method === "PUT" &&
          body.claimName === "primary_email",
      ),
    );

    document
      .querySelector('[data-action="admin-client-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-mapper-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-mapper-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-mapper-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === `${mapperPath}/17` && method === "DELETE",
      ),
    );

    document
      .querySelector('[data-action="admin-client-mapper-create"]')
      .click();
    await settle();
    form = document.querySelector('[data-form="admin-client-mapper"]');
    form.elements.namedItem("name").value = "primary-email";
    form.elements.namedItem("claimName").value = "email";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === mapperPath &&
          method === "POST" &&
          body.name === "primary-email" &&
          body.mapperType === "email",
      ),
    );

    document
      .querySelector(
        '[data-action="admin-client-delete-request"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-delete-cancel"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-delete-request"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-delete-confirm"][data-id="console-client"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/clients/console-client" && method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin group membership adds and confirms member removal", async () => {
  const harness = await renderConsole("admin");
  let members = [{ id: 1, username: "ada", enabled: true }];
  let available = [{ id: 4, username: "grace", enabled: true }];
  const page = (items) => ({
    content: items,
    totalElements: items.length,
    totalPages: 1,
    number: 0,
  });
  harness.setResponse(
    "/api/admin/groups/3/users?q=&page=0&size=10&sort=username%2Casc",
    "GET",
    () => page(members),
  );
  harness.setResponse(
    "/api/admin/groups/3/available-users?q=&page=0&size=10&sort=username%2Casc",
    "GET",
    () => page(available),
  );
  harness.setResponse("/api/admin/groups/3/users", "POST", ({ body }) => {
    members = [
      ...members,
      { id: body.userId, username: "grace", enabled: true },
    ];
    available = available.filter((user) => user.id !== body.userId);
    return { status: 204 };
  });
  harness.setResponse("/api/admin/groups/3/users/1", "DELETE", () => {
    members = members.filter((user) => user.id !== 1);
    available = [...available, { id: 1, username: "ada", enabled: true }];
    return { status: 204 };
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="groups"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="groups"]').disabled) break;
    }
    document
      .querySelector('[data-action="admin-group-members-toggle"][data-id="3"]')
      .click();
    await settle();
    assert.ok(
      calls.some(({ path }) => path.startsWith("/api/admin/groups/3/users?")),
    );

    document
      .querySelector('[data-action="admin-group-member-add"][data-id="4"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/groups/3/users" &&
          method === "POST" &&
          body.userId === 4,
      ),
    );

    document
      .querySelector(
        '[data-action="admin-group-member-remove-request"][data-id="1"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-group-member-remove-cancel"]')
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-group-member-remove-request"][data-id="1"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-group-member-remove-confirm"][data-id="1"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/groups/3/users/1" && method === "DELETE",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client configuration validates, saves, and excludes the service username", async () => {
  const harness = await renderConsole("admin");
  const client = {
    id: "console-client",
    clientId: "console-client",
    clientName: "Console Client",
    clientAuthenticationMethods: ["client_secret_basic"],
    authorizationGrantTypes: ["authorization_code"],
    redirectUris: [],
    postLogoutRedirectUris: [],
    scopes: ["openid"],
    dpopSigningAlgorithms: ["RS256"],
    serviceAccountUsername: "internal-service-user",
  };
  harness.setResponse("/api/admin/clients/console-client", "GET", () => client);
  harness.setResponse(
    "/api/admin/clients/console-client",
    "PUT",
    ({ body }) => body,
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-client-configuration-edit"][data-id="console-client"]',
      )
      .click();
    await settle();
    let form = document.querySelector(
      '[data-form="admin-client-configuration"]',
    );
    assert.ok(form);
    assert.equal(form.textContent.includes("internal-service-user"), false);
    form.elements.namedItem("redirectUris").value = "not-a-url";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/clients/console-client" && method === "PUT",
      ),
      false,
      "invalid redirect URIs must not reach the API",
    );

    form = document.querySelector('[data-form="admin-client-configuration"]');
    form.elements.namedItem("redirectUris").value =
      "https://client.example.test/callback";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const update = calls.find(
      ({ path, method }) =>
        path === "/api/admin/clients/console-client" && method === "PUT",
    );
    assert.ok(update);
    assert.deepEqual(update.body.redirectUris, [
      "https://client.example.test/callback",
    ]);
    assert.equal("serviceAccountUsername" in update.body, false);
    assert.equal(update.body.cibaClientNotificationToken, "");
  } finally {
    harness.restore();
  }
});

test("native Admin client role assignment and composite panels load bounded candidates", async () => {
  const harness = await renderConsole("admin");
  const rolePath = "/api/admin/clients/console-client/roles/23";
  harness.setResponse(
    "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc",
    "GET",
    () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}?page=0&size=20&sort=username,asc`,
    "GET",
    () => ({
      users: { content: [{ id: 1, username: "ada" }] },
      groups: {
        content: [{ id: 3, name: "Engineering", path: "/Engineering" }],
      },
      compositeRealmRoles: [{ name: "ROLE_AUDITOR" }],
      compositeRoles: [{ id: 27, clientId: "reports", name: "EXPORT" }],
    }),
  );
  harness.setResponse(
    `${rolePath}/available-users?q=grace&page=0&size=10&sort=username,asc`,
    "GET",
    () => ({
      content: [{ id: 4, username: "grace" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}/users?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({
      users: {
        content: [
          { id: 1, username: "ada" },
          { id: 4, username: "grace" },
        ],
      },
    }),
  );
  harness.setResponse(
    `${rolePath}/available-realm-composites?q=ROLE&page=0&size=10&sort=name,asc`,
    "GET",
    () => ({
      content: [{ name: "ROLE_EDITOR" }, { name: "bad role" }],
      totalElements: 2,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}/realm-composites/ROLE_EDITOR?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({ compositeRealmRoles: [{ name: "ROLE_EDITOR" }] }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-client-roles-toggle"][data-id="console-client"]',
      )
      .click();
    await settle();
    assert.ok(document.querySelector('[data-client-role-id="23"]'));

    document
      .querySelector(
        '[data-action="admin-client-role-assignments-toggle"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    let assignment = document.querySelector(
      '[data-client-role-assignments="console-client:23"]',
    );
    assert.ok(assignment);
    assignment.querySelector('[name="user-q"]').value = "g";
    assignment
      .querySelector(
        '[data-action="admin-client-role-assignment-search"][data-member-kind="user"]',
      )
      .click();
    await settle();
    assignment = document.querySelector(
      '[data-client-role-assignments="console-client:23"]',
    );
    assert.ok(
      assignment.querySelector('[data-assignment-search-error="user"]')
        .textContent,
    );
    assignment.querySelector('[name="user-q"]').value = "grace";
    assignment
      .querySelector(
        '[data-action="admin-client-role-assignment-search"][data-member-kind="user"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          `${rolePath}/available-users?q=grace&page=0&size=10&sort=username,asc`,
      ),
    );
    assignment = document.querySelector(
      '[data-client-role-assignments="console-client:23"]',
    );
    assignment
      .querySelector(
        '[data-action="admin-client-role-assignment-add"][data-member-id="4"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${rolePath}/users?page=0&size=20&sort=username,asc` &&
          method === "POST" &&
          body.userId === 4,
      ),
    );

    document
      .querySelector(
        '[data-action="admin-client-role-composites-toggle"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    const composites = document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    assert.ok(composites);
    composites.querySelector('[name="realm-composite-q"]').value = "ROLE";
    composites
      .querySelector(
        '[data-action="admin-client-role-composite-search"][data-member-kind="realm"]',
      )
      .click();
    await settle();
    const updatedComposites = document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    assert.ok(updatedComposites.textContent.includes("ROLE_EDITOR"));
    assert.equal(updatedComposites.textContent.includes("bad role"), false);

    updatedComposites
      .querySelector('[data-action="admin-client-role-composite-add-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-add-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-add-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path ===
            `${rolePath}/realm-composites/ROLE_EDITOR?page=0&size=20&sort=username,asc` &&
          method === "POST",
      ),
    );
    assert.ok(calls.some(({ path }) => path === "clear-all-sessions"));
  } finally {
    harness.restore();
  }
});

test("native Admin client-role composite removal confirms before invalidating sessions", async () => {
  const harness = await renderConsole("admin");
  const rolePath = "/api/admin/clients/console-client/roles/23";
  harness.setResponse(
    "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc",
    "GET",
    () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    }),
  );
  harness.setResponse(
    `${rolePath}?page=0&size=20&sort=username,asc`,
    "GET",
    () => ({
      users: { content: [] },
      groups: { content: [] },
      compositeRealmRoles: [{ name: "ROLE_AUDITOR" }],
      compositeRoles: [],
    }),
  );
  harness.setResponse(
    `${rolePath}/realm-composites/ROLE_AUDITOR?page=0&size=20&sort=username,asc`,
    "DELETE",
    () => ({ compositeRealmRoles: [], compositeRoles: [] }),
  );

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="clients"]').disabled) break;
    }
    document
      .querySelector(
        '[data-action="admin-client-roles-toggle"][data-id="console-client"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-composites-toggle"][data-client-role-id="23"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-composite-remove-request"][data-member-id="ROLE_AUDITOR"]',
      )
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-composite-cancel"]')
      .click();
    await settle();
    assert.equal(
      calls.some(
        ({ path, method }) =>
          path ===
            `${rolePath}/realm-composites/ROLE_AUDITOR?page=0&size=20&sort=username,asc` &&
          method === "DELETE",
      ),
      false,
    );
    document
      .querySelector(
        '[data-action="admin-client-role-composite-remove-request"][data-member-id="ROLE_AUDITOR"]',
      )
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="admin-client-role-composite-remove-confirm"][data-member-id="ROLE_AUDITOR"]',
      )
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path ===
            `${rolePath}/realm-composites/ROLE_AUDITOR?page=0&size=20&sort=username,asc` &&
          method === "DELETE",
      ),
    );
    assert.ok(calls.some(({ path }) => path === "clear-all-sessions"));
  } finally {
    harness.restore();
  }
});

test("native Admin message overrides edit, create, and delete localized messages", async () => {
  const harness = await renderConsole("admin");
  let overrides = [
    {
      id: 12,
      locale: "tr",
      bundle: "messages",
      messageKey: "welcome.message",
      messageValue: "Hoş geldiniz",
    },
  ];
  const messagePath = "/api/admin/settings/localization/messages";
  const page = () => ({
    content: overrides,
    totalElements: overrides.length,
    totalPages: 1,
    number: 0,
  });
  harness.setResponse("/api/admin/settings/localization", "GET", () => ({
    internationalizationEnabled: true,
    defaultLocale: "en",
    supportedLocales: ["en", "tr"],
    availableLocales: ["en", "tr"],
    availableBundles: ["messages"],
  }));
  harness.setResponse(
    `${messagePath}?page=0&size=20&sort=locale,asc`,
    "GET",
    page,
  );
  harness.setResponse(`${messagePath}/12`, "PUT", ({ body }) => {
    overrides = overrides.map((item) =>
      item.id === 12 ? { ...item, ...body } : item,
    );
    return { id: 12, ...body };
  });
  harness.setResponse(`${messagePath}/12`, "DELETE", () => {
    overrides = overrides.filter((item) => item.id !== 12);
    return { status: 204 };
  });
  harness.setResponse(messagePath, "POST", ({ body }) => {
    overrides = [...overrides, { id: 13, ...body }];
    return { id: 13, ...body };
  });

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="localization"]').click();
    for (let turn = 0; turn < 30; turn += 1) {
      await settle();
      if (!document.querySelector('[data-route="localization"]').disabled)
        break;
    }
    const edit = document.querySelector(
      '[data-form="admin-localization-message"]',
    );
    assert.ok(edit);
    edit.elements.namedItem("messageValue").value = "Merhaba";
    edit.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === `${messagePath}/12` &&
          method === "PUT" &&
          body.messageValue === "Merhaba",
      ),
    );

    document
      .querySelector('[data-action="admin-message-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-message-delete-cancel"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-message-delete-request"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-message-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === `${messagePath}/12` && method === "DELETE",
      ),
    );

    const create = document.querySelector(
      '[data-form="admin-localization-message-create"]',
    );
    create.elements.namedItem("locale").value = "tr";
    create.elements.namedItem("bundle").value = "messages";
    create.elements.namedItem("messageKey").value = "account.notice";
    create.elements.namedItem("messageValue").value = "Hesabınız hazır";
    create.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === messagePath &&
          method === "POST" &&
          body.messageKey === "account.notice",
      ),
    );
  } finally {
    harness.restore();
  }
});
