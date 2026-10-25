import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native Admin user detail shows locked-account policy and sparse event rows", async () => {
  const harness = await renderConsole("admin");
  const { document, setResponse } = harness;
  setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    locked: true,
    mustChangePassword: true,
    failedLoginCount: 0,
    authorities: ["ROLE_USER"],
  }));
  setResponse("/api/admin/users/1/profile-attributes", "GET", () => ({
    definitions: [],
    attributes: {},
  }));
  setResponse(
    "/api/admin/users/1/events?page=0&size=10&sort=occurredAt,desc",
    "GET",
    () => ({
      content: [
        {
          action: "login.succeeded",
          actor: "",
          targetType: "",
          targetId: "",
          details: "",
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
    assert.match(document.querySelector(".admin-user-detail").textContent, /Password change required/);
    assert.match(document.querySelector(".admin-user-detail").textContent, /Failed logins: 0/);
    assert.ok(document.querySelector('[data-action="admin-user-detail-unlock"]'));

    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="events"]')
      .click();
    await settle();
    const eventTable = document.querySelector(".admin-user-detail-data-table");
    assert.match(eventTable.textContent, /login\.succeeded/);
    assert.match(eventTable.textContent, /—/);
  } finally {
    harness.restore();
  }
});
