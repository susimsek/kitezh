import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const rolesPath =
  "/api/admin/clients/console-client/roles?q=&page=0&size=20&sort=name%2Casc";
const rolePath = "/api/admin/clients/console-client/roles/23";
const dispatch = (document, element) =>
  element.dispatchEvent(
    new document.defaultView.Event("click", { bubbles: true, cancelable: true }),
  );

async function openRoleComposites(harness) {
  const { document } = harness;
  document.querySelector('[data-route="clients"]').click();
  await settle();
  document
    .querySelector('.client-name [data-action="client-open"]')
    .click();
  await settle();
  document
    .querySelector('[data-action="client-tab"][data-id="roles"]')
    .click();
  await settle();
  document
    .querySelector(
      '[data-action="admin-client-role-composites-toggle"][data-client-role-id="23"]',
    )
    .click();
  await settle();
}

function configureRoleList(harness) {
  harness.setResponse(rolesPath, "GET", () => ({
    content: [{ id: 23, name: "REPORT_VIEWER", description: "Read reports" }],
    totalElements: 1,
    totalPages: 1,
    number: 0,
  }));
}

test("client role composites search, filter and add client-role candidates", async () => {
  const harness = await renderConsole("admin");
  configureRoleList(harness);
  harness.setResponse(`${rolePath}?page=0&size=20&sort=username,asc`, "GET", () => ({
    compositeRealmRoles: [{ name: "ROLE_AUDITOR" }],
    compositeRoles: [],
  }));
  harness.setResponse(
    `${rolePath}/available-composites?q=client&page=0&size=10&sort=name,asc`,
    "GET",
    () => ({
      content: [
        { id: 41, clientId: "reporting", name: "EXPORT" },
        { id: 0, clientId: "reporting", name: "INVALID_ID" },
        { id: 42, clientId: "bad client", name: "INVALID_CLIENT" },
        { id: 43, clientId: "reporting", name: null },
      ],
    }),
  );
  harness.setResponse(
    `${rolePath}/composites/41?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({ compositeRealmRoles: [], compositeRoles: [{ id: 41, clientId: "reporting", name: "EXPORT" }] }),
  );
  try {
    await openRoleComposites(harness);
    let panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    const search = panel.querySelector(
      '[data-action="admin-client-role-composite-search"][data-member-kind="client"]',
    );
    const query = panel.querySelector('[name="client-composite-q"]');

    query.value = "x";
    dispatch(harness.document, search);
    await settle();
    assert.equal(
      harness.calls.some(({ path }) => path.includes("available-composites?q=x")),
      false,
    );

    query.value = " client ";
    dispatch(harness.document, search);
    await settle();
    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    assert.match(panel.textContent, /reporting \/ EXPORT/);
    assert.doesNotMatch(panel.textContent, /INVALID_ID|INVALID_CLIENT/);
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-add-request"][data-member-kind="client"][data-member-id="41"]',
      ),
    );
    await settle();
    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-add-confirm"][data-member-kind="client"][data-member-id="41"]',
      ),
    );
    await settle();

    assert.ok(
      harness.calls.some(
        ({ path, method }) =>
          path === `${rolePath}/composites/41?page=0&size=20&sort=username,asc` &&
          method === "POST",
      ),
    );
    assert.ok(harness.calls.some(({ path }) => path === "clear-all-sessions"));
    assert.equal(
      harness.document.querySelector('[data-client-role-composites="console-client:23"]'),
      null,
    );
  } finally {
    harness.restore();
  }
});

test("client role composite API errors retain the open panel for retry", async () => {
  const harness = await renderConsole("admin");
  configureRoleList(harness);
  harness.setResponse(`${rolePath}?page=0&size=20&sort=username,asc`, "GET", () => ({
    compositeRealmRoles: [],
    compositeRoles: [],
  }));
  harness.setResponse(
    `${rolePath}/available-realm-composites?q=ROLE&page=0&size=10&sort=name,asc`,
    "GET",
    () => ({ content: [{ name: "ROLE_EXPORTER" }] }),
  );
  harness.setResponse(
    `${rolePath}/realm-composites/ROLE_EXPORTER?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({ status: 503, body: { detail: "Please retry" } }),
  );
  try {
    await openRoleComposites(harness);
    let panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    panel.querySelector('[name="realm-composite-q"]').value = "ROLE";
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-search"][data-member-kind="realm"]',
      ),
    );
    await settle();
    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-add-request"][data-member-id="ROLE_EXPORTER"]',
      ),
    );
    await settle();
    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-add-confirm"][data-member-id="ROLE_EXPORTER"]',
      ),
    );
    await settle();

    assert.ok(harness.document.querySelector('[data-client-role-composites="console-client:23"]'));
    assert.ok(harness.document.querySelector('[role="alert"]'));
    assert.equal(harness.calls.some(({ path }) => path === "clear-all-sessions"), false);
  } finally {
    harness.restore();
  }
});

test("client role composite removal requires confirmation before deleting", async () => {
  const harness = await renderConsole("admin");
  configureRoleList(harness);
  harness.setResponse(`${rolePath}?page=0&size=20&sort=username,asc`, "GET", () => ({
    compositeRealmRoles: [],
    compositeRoles: [{ id: 41, clientId: "reporting", name: "EXPORT" }],
  }));
  harness.setResponse(
    `${rolePath}/composites/41?page=0&size=20&sort=username,asc`,
    "DELETE",
    () => ({ compositeRealmRoles: [], compositeRoles: [] }),
  );
  try {
    await openRoleComposites(harness);
    let panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-remove-request"][data-member-kind="client"][data-member-id="41"]',
      ),
    );
    await settle();
    assert.equal(
      harness.calls.some(
        ({ path, method }) =>
          path === `${rolePath}/composites/41?page=0&size=20&sort=username,asc` &&
          method === "DELETE",
      ),
      false,
    );

    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-remove-confirm"][data-member-kind="client"][data-member-id="41"]',
      ),
    );
    await settle();

    assert.ok(
      harness.calls.some(
        ({ path, method }) =>
          path === `${rolePath}/composites/41?page=0&size=20&sort=username,asc` &&
          method === "DELETE",
      ),
    );
    assert.ok(harness.calls.some(({ path }) => path === "clear-all-sessions"));
  } finally {
    harness.restore();
  }
});

test("timed-out composite mutation clears local state even if session clearing fails", async () => {
  const harness = await renderConsole("admin");
  configureRoleList(harness);
  harness.setResponse(`${rolePath}?page=0&size=20&sort=username,asc`, "GET", () => ({
    compositeRealmRoles: [],
    compositeRoles: [],
  }));
  harness.setResponse(
    `${rolePath}/available-composites?q=client&page=0&size=10&sort=name,asc`,
    "GET",
    () => ({ content: [{ id: 41, clientId: "reporting", name: "EXPORT" }] }),
  );
  harness.setResponse(
    `${rolePath}/composites/41?page=0&size=20&sort=username,asc`,
    "POST",
    () => ({ status: 0, kind: "timeout", body: null }),
  );
  harness.api.auth.clearAllSessions = async () => {
    harness.calls.push({ path: "clear-all-sessions", method: "POST" });
    throw new Error("session cleanup unavailable");
  };
  try {
    await openRoleComposites(harness);
    let panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    panel.querySelector('[name="client-composite-q"]').value = "client";
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-search"][data-member-kind="client"]',
      ),
    );
    await settle();
    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-add-request"][data-member-id="41"]',
      ),
    );
    await settle();
    panel = harness.document.querySelector(
      '[data-client-role-composites="console-client:23"]',
    );
    dispatch(
      harness.document,
      panel.querySelector(
        '[data-action="admin-client-role-composite-add-confirm"][data-member-id="41"]',
      ),
    );
    await settle();

    assert.ok(harness.calls.some(({ path }) => path === "clear-all-sessions"));
    assert.equal(
      harness.document.querySelector('[data-client-role-composites="console-client:23"]'),
      null,
    );
    assert.ok(harness.document.querySelector('[role="alert"]'));
  } finally {
    harness.restore();
  }
});
