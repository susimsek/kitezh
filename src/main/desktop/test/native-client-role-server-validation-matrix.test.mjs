import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("client-role server validation keeps edited values and shows both field errors", async () => {
  const rolesPath =
    "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc";
  const updatePath = "/api/admin/clients/console-client/roles/23";
  const harness = await renderConsole("admin");
  harness.setResponse(rolesPath, "GET", () => ({
    content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
  }));
  harness.setResponse(updatePath, "PUT", () => ({
    status: 400,
    body: {
      violations: [
        { field: "name", message: "Role name is reserved" },
        { field: "description", message: "Description is too long" },
      ],
    },
  }));

  try {
    const { document } = harness;
    await settle();
    document.querySelector('[data-route="clients"]').click();
    await settle();
    document
      .querySelector('.client-name [data-action="client-open"][data-id="console-client"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="client-tab"][data-id="roles"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-client-role-edit"][data-client-role-id="23"]')
      .click();
    await settle();

    const form = document.querySelector('[data-form="admin-client-role-update"]');
    assert.ok(form);
    form.elements.namedItem("name").value = "draft-role";
    form.elements.namedItem("description").value = "draft description";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const updatedForm = document.querySelector(
      '[data-form="admin-client-role-update"]',
    );
    assert.equal(updatedForm.elements.namedItem("name").value, "draft-role");
    assert.equal(
      updatedForm.elements.namedItem("description").value,
      "draft description",
    );
    assert.match(
      updatedForm.elements.namedItem("name").parentElement.textContent,
      /Role name is reserved/,
    );
    assert.match(
      updatedForm.elements.namedItem("description").parentElement.textContent,
      /Description is too long/,
    );
  } finally {
    harness.restore();
  }
});
