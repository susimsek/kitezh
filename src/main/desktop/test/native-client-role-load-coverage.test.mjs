import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const roleListPath =
  "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc";
const emit = (document, element, type = "submit") =>
  element.dispatchEvent(
    new document.defaultView.Event(type, { bubbles: true, cancelable: true }),
  );

async function openClientRoles(harness) {
  harness.document.querySelector('[data-route="clients"]').click();
  await settle();
  harness.document
    .querySelector('.client-name [data-action="client-open"]')
    .click();
  await settle();
  harness.document
    .querySelector('[data-action="client-tab"][data-id="roles"]')
    .click();
  await settle();
}

test("client role list trims searches and renders backend roles", async () => {
  const harness = await renderConsole("admin");
  try {
    harness.setResponse(roleListPath, "GET", () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      page: { number: 0, size: 20, totalElements: 21, totalPages: 2 },
    }));
    harness.setResponse(
      "/api/admin/clients/console-client/roles?q=REPORT&page=0&size=20&sort=name%2Casc",
      "GET",
      () => ({
        content: [
          { id: 23, name: "REPORT_VIEWER", description: "Read reports" },
        ],
        page: { number: 0, size: 20, totalElements: 21, totalPages: 2 },
      }),
    );

    await openClientRoles(harness);
    const { document, calls } = harness;
    const search = document.querySelector(
      '[data-form="admin-client-role-search"]',
    );
    search.elements.q.value = " REPORT ";
    emit(document, search);
    await settle();
    assert.ok(
      calls.some(({ path }) =>
        path.endsWith("roles?q=REPORT&page=0&size=20&sort=name%2Casc"),
      ),
    );
    assert.match(
      document.querySelector("[data-client-roles-panel]").textContent,
      /REPORT_VIEWER/,
    );
  } finally {
    harness.restore();
  }
});

test("client role list presents a useful empty state after a failed search", async () => {
  const harness = await renderConsole("admin");
  try {
    harness.setResponse(roleListPath, "GET", () => ({
      content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    }));
    harness.setResponse(
      "/api/admin/clients/console-client/roles?q=missing&page=0&size=20&sort=name%2Casc",
      "GET",
      () => ({ status: 503, body: { detail: "Temporarily unavailable" } }),
    );
    await openClientRoles(harness);
    const { document } = harness;
    const search = document.querySelector(
      '[data-form="admin-client-role-search"]',
    );
    search.elements.q.value = "missing";
    emit(document, search);
    await settle();
    assert.ok(document.querySelector('[role="alert"]'));
    assert.ok(document.querySelector("[data-client-roles-panel]"));
  } finally {
    harness.restore();
  }
});
