import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

async function openAdminGroups(harness) {
  const { document, calls } = harness;
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
  for (let turn = 0; turn < 60; turn += 1) {
    await settle();
    if (calls.some(({ path }) => path === "/api/admin/whoami")) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  document.querySelector('[data-route="groups"]').click();
  await settle();
}

test("native group detail saves roles and validates then saves permissions", async () => {
  const harness = await renderConsole("admin");
  try {
    const { document, calls } = harness;
    harness.setResponse("/api/admin/groups/3", "GET", () => ({
      id: 3,
      name: "Engineering",
      path: "/Engineering",
      roles: ["ROLE_USER"],
      attributes: { department: ["engineering"] },
      userCount: 1,
    }));
    harness.setResponse("/api/admin/groups/3/roles", "PUT", ({ body }) => ({
      id: 3,
      name: "Engineering",
      roles: body.roles,
    }));
    harness.setResponse("/api/admin/roles?page=0&size=100&sort=name,asc", "GET", () => ({
      content: [{ name: "ROLE_USER" }, { name: "ROLE_AUDITOR" }],
      page: { number: 0, size: 100, totalElements: 2, totalPages: 1 },
    }));
    harness.setResponse("/api/admin/groups/3/permissions", "GET", () => [
      { userId: 1, username: "ada", permission: "VIEW" },
    ]);
    harness.setResponse("/api/admin/groups/3/permissions", "PUT", ({ body }) =>
      body.permissions.map((permission) => ({ ...permission, username: "ada" })),
    );

    await openAdminGroups(harness);
    document.querySelector('[data-action="group-open"][data-id="3"]').click();
    await settle();
    document.querySelector('[data-action="group-tab"][data-id="roles"]').click();
    await settle();
    const auditorRole = document.querySelector('input[name="roles"][value="ROLE_AUDITOR"]');
    assert.ok(auditorRole);
    auditorRole.checked = true;
    document.querySelector('[data-form="native-group-roles"]').dispatchEvent(
      new document.defaultView.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.ok(calls.some(({ path, method, body }) =>
      path === "/api/admin/groups/3/roles" && method === "PUT" &&
      body.roles.includes("ROLE_AUDITOR"),
    ));

    document.querySelector('[data-action="group-tab"][data-id="permissions"]').click();
    await settle();
    document.querySelector('[data-action="group-permission-add"]').click();
    await settle();
    document.querySelector('[data-form="native-group-permissions"]').dispatchEvent(
      new document.defaultView.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.equal(
      calls.some(({ path, method }) => path === "/api/admin/groups/3/permissions" && method === "PUT"),
      false,
      "permission rows without a user must not be submitted",
    );
    const userSelect = document.querySelector('[data-permission-index="1"][data-permission-field="userId"]');
    userSelect.value = "1";
    userSelect.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    const permissionSelect = document.querySelector('[data-permission-index="1"][data-permission-field="permission"]');
    permissionSelect.value = "MANAGE_GROUP";
    permissionSelect.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    document.querySelector('[data-form="native-group-permissions"]').dispatchEvent(
      new document.defaultView.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.ok(calls.some(({ path, method, body }) =>
      path === "/api/admin/groups/3/permissions" && method === "PUT" &&
      body.permissions.length === 2 && body.permissions[1].permission === "MANAGE_GROUP",
    ));
  } finally {
    harness.restore();
  }
});

test("native group creation rejects invalid attributes and submits valid group data", async () => {
  const harness = await renderConsole("admin");
  try {
    const { document, calls } = harness;
    harness.setResponse("/api/admin/groups", "POST", ({ body }) => ({ id: 8, ...body }));
    await openAdminGroups(harness);
    document.querySelector('[data-action="create-group"]').click();
    await settle();
    const form = document.querySelector('[data-form="native-group-settings"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "Platform";
    form.elements.namedItem("attributesJson").value = "[]";
    form.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    assert.ok(document.getElementById("group-attributesJson-error").textContent);
    assert.equal(calls.some(({ path, method }) => path === "/api/admin/groups" && method === "POST"), false);

    form.elements.namedItem("attributesJson").value = '{"department":["platform"]}';
    form.elements.namedItem("defaultGroup").checked = true;
    form.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    assert.ok(calls.some(({ path, method, body }) =>
      path === "/api/admin/groups" && method === "POST" &&
      body.name === "Platform" && body.defaultGroup &&
      body.attributes.department[0] === "platform",
    ));
  } finally {
    harness.restore();
  }
});

test("native group list corrects an out-of-range page before rendering", async () => {
  const harness = await renderConsole("admin");
  try {
    const { calls, document } = harness;
    harness.setResponse("/api/admin/groups?q=&page=0&size=10&sort=name%2Casc", "GET", () => ({
      content: [{ id: 3, name: "Engineering", path: "/Engineering" }],
      page: { number: 9, size: 10, totalElements: 21, totalPages: 3 },
    }));
    harness.setResponse("/api/admin/groups?q=&page=2&size=10&sort=name%2Casc", "GET", () => ({
      content: [{ id: 3, name: "Engineering", path: "/Engineering" }],
      page: { number: 2, size: 10, totalElements: 21, totalPages: 3 },
    }));
    await openAdminGroups(harness);
    await settle();
    assert.ok(calls.some(({ path }) => path.includes("/api/admin/groups?") && path.includes("page=0")));
    assert.ok(calls.some(({ path }) => path.includes("groups?") && path.includes("page=2")));
    assert.match(document.querySelector(".group-pagination").textContent, /3 \/ 3/);
  } finally {
    harness.restore();
  }
});

test("native group member candidate search can recover from a failed request", async () => {
  const harness = await renderConsole("admin");
  try {
    const { calls, document } = harness;
    harness.setResponse("/api/admin/groups/3", "GET", () => ({
      id: 3,
      name: "Engineering",
      path: "/Engineering",
      roles: [],
    }));
    harness.setResponse("/api/admin/groups/3/users?q=&page=0&size=10&sort=username%2Casc", "GET", () => ({
      content: [],
      page: { number: 0, size: 10, totalElements: 0, totalPages: 0 },
    }));
    harness.setResponse("/api/admin/groups/3/available-users?q=ad&page=0&size=10", "GET", () => ({
      status: 503,
      body: { detail: "Temporary service failure" },
    }));
    await openAdminGroups(harness);
    document.querySelector('[data-action="group-open"][data-id="3"]').click();
    await settle();
    document.querySelector('[data-action="group-tab"][data-id="members"]').click();
    await settle();
    const search = document.getElementById("group-candidate-query");
    search.value = "ad";
    search.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.ok(document.querySelector('[data-action="group-candidate-retry"]'));
    assert.ok(calls.some(({ path }) => path.includes("/available-users?q=ad")));

    harness.setResponse("/api/admin/groups/3/available-users?q=ad&page=0&size=10", "GET", () => ({
      content: [{ id: 7, username: "ada" }],
      page: { number: 0, size: 10, totalElements: 1, totalPages: 1 },
    }));
    document.querySelector('[data-action="group-candidate-retry"]').click();
    await settle();
    assert.ok(document.querySelector('[data-action="group-candidate-select"][data-id="7"]'));
  } finally {
    harness.restore();
  }
});
