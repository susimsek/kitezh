import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const group = {
  id: 3,
  name: "Engineering",
  path: "/Engineering",
  roles: ["ROLE_USER"],
  attributes: {},
};

async function openGroup(harness, tab = "details") {
  const { document } = harness;
  await settle();
  document.querySelector('[data-route="groups"]').click();
  await settle();
  document.querySelector('[data-action="group-open"][data-id="3"]').click();
  await settle();
  if (tab !== "details") {
    document.querySelector(`[data-action="group-tab"][data-id="${tab}"]`).click();
    await settle();
  }
}

const emit = (harness, element, type = "submit") =>
  element.dispatchEvent(
    new harness.dom.window.Event(type, { bubbles: true, cancelable: true }),
  );

test("group permissions normalize malformed reads and retain referenced users", async (t) => {
  for (const scenario of [
    {
      name: "non-array saved assignments",
      permissions: { invalid: true },
      users: { content: "invalid" },
      expectedRows: 0,
    },
    {
      name: "assignment user missing from directory page",
      permissions: [{ userId: 42, username: "former-user", permission: "VIEW" }],
      users: { content: [{ id: 1, username: "ada" }] },
      expectedRows: 1,
    },
  ]) {
    await t.test(scenario.name, async () => {
      const harness = await renderConsole("admin", {
        response: (path, method) => {
          if (path === "/api/admin/groups/3" && method === "GET") return group;
          if (path === "/api/admin/groups/3/permissions" && method === "GET")
            return scenario.permissions;
          if (path === "/api/admin/users?page=0&size=100&sort=username,asc")
            return scenario.users;
          return null;
        },
      });

      try {
        await openGroup(harness, "permissions");
        assert.equal(
          harness.document.querySelectorAll(".group-permission-row").length,
          scenario.expectedRows,
        );
        if (scenario.expectedRows) {
          assert.equal(
            harness.document.querySelector('#group-permission-user-0 option[value="42"]').textContent,
            "former-user",
          );
        } else {
          assert.ok(harness.document.querySelector(".group-permissions .empty, .group-panel .empty"));
        }
      } finally {
        harness.restore();
      }
    });
  }
});

test("group permission save failure keeps the draft available for retry", async () => {
  const harness = await renderConsole("admin", {
    response: (path, method) => {
      if (path === "/api/admin/groups/3" && method === "GET") return group;
      if (path === "/api/admin/groups/3/permissions" && method === "GET") return [];
      if (path === "/api/admin/users?page=0&size=100&sort=username,asc")
        return { content: [{ id: 1, username: "ada" }] };
      if (path === "/api/admin/groups/3/permissions" && method === "PUT")
        return { status: 503, body: { detail: "Permission service unavailable" } };
      return null;
    },
  });

  try {
    await openGroup(harness, "permissions");
    harness.document.querySelector('[data-action="group-permission-add"]').click();
    const user = harness.document.getElementById("group-permission-user-0");
    user.value = "1";
    emit(harness, user, "change");
    const permission = harness.document.getElementById("group-permission-value-0");
    permission.value = "MANAGE_GROUP";
    emit(harness, permission, "change");
    emit(harness, harness.document.querySelector('[data-form="native-group-permissions"]'));
    await settle();

    assert.ok(harness.document.querySelector('[data-form="native-group-permissions"]'));
    assert.equal(harness.document.querySelectorAll(".group-permission-row").length, 1);
    assert.match(harness.document.querySelector(".notice.error").textContent, /apiFailure/i);
    assert.ok(
      harness.calls.some(
        ({ path, method, body }) =>
          path === "/api/admin/groups/3/permissions" &&
          method === "PUT" &&
          body.permissions[0].permission === "MANAGE_GROUP",
      ),
    );
  } finally {
    harness.restore();
  }
});

test("group save maps a server validation violation to the attributes field", async () => {
  const harness = await renderConsole("admin", {
    response: (path, method) => {
      if (path.startsWith("/api/admin/groups?") && method === "GET")
        return { content: [group] };
      if (path === "/api/admin/groups/3" && method === "GET") return group;
      if (path === "/api/admin/groups/3" && method === "PUT")
        return {
          status: 400,
          body: {
            violations: [{ field: "attributes", message: "Invalid department" }],
          },
        };
      return null;
    },
  });

  try {
    await openGroup(harness);
    const input = harness.document.getElementById("group-attributesJson");
    input.value = '{"department":["finance"]}';
    emit(harness, input, "input");
    emit(harness, harness.document.querySelector('[data-form="native-group-settings"]'));
    await settle();

    assert.equal(
      harness.document.getElementById("group-attributesJson-error").textContent,
      "Invalid department",
    );
    assert.equal(harness.document.getElementById("group-attributesJson").getAttribute("aria-invalid"), "true");
  } finally {
    harness.restore();
  }
});
