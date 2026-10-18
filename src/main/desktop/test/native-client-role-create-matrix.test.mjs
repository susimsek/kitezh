import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const listPath =
  "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc";
const createPath = "/api/admin/clients/console-client/roles";

test("client role creation retains invalid drafts, retries conflicts, and prepends success", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse(listPath, "GET", () => ({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
  }));
  let rejectFirstCreate = true;
  harness.setResponse(createPath, "POST", ({ body }) => {
    if (rejectFirstCreate) {
      rejectFirstCreate = false;
      return { status: 409, body: { detail: "Role already exists" } };
    }
    return { id: 31, ...body };
  });

  try {
    const { document, calls } = harness;
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

    let form = document.querySelector('[data-form="admin-client-role-create"]');
    assert.ok(form);
    const submit = async () => {
      form.dispatchEvent(
        new document.defaultView.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle();
      form = document.querySelector('[data-form="admin-client-role-create"]');
    };

    form.elements.namedItem("name").value = "   ";
    await submit();
    assert.match(form.textContent, /adminRequired/);
    assert.equal(calls.some(({ method }) => method === "POST"), false);

    form.elements.namedItem("name").value = "invalid role";
    await submit();
    assert.match(form.textContent, /adminClientRoleNameInvalid/);
    assert.equal(calls.some(({ method }) => method === "POST"), false);

    form.elements.namedItem("name").value = "REPORT_EXPORTER";
    form.elements.namedItem("description").value = "d".repeat(501);
    await submit();
    assert.match(form.textContent, /adminClientRoleDescriptionInvalid/);
    assert.equal(calls.some(({ method }) => method === "POST"), false);

    form.elements.namedItem("name").value = "REPORT_EXPORTER";
    form.elements.namedItem("description").value = "Exports reports";
    await submit();
    assert.ok(document.querySelector('[role="alert"]'));
    assert.equal(form.elements.namedItem("name").value, "REPORT_EXPORTER");

    await submit();
    assert.ok(
      calls.some(
        ({ path, method, body }) =>
          path === createPath &&
          method === "POST" &&
          body.name === "REPORT_EXPORTER" &&
          body.description === "Exports reports",
      ),
    );
    assert.match(
      document.querySelector('[data-client-roles-panel="console-client"]').textContent,
      /REPORT_EXPORTER/,
    );
    assert.ok(document.querySelector('[data-client-role-id="31"]'));
  } finally {
    harness.restore();
  }
});
