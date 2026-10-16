import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const base = "/api/admin/required-actions/users/1";
const user = {
  id: 1,
  username: "ada",
  enabled: true,
  email: "ada@example.test",
  authorities: ["ROLE_USER"],
};
const actions = [
  {
    key: "RECOVERY_CODES",
    displayName: "API recovery action",
    assigned: false,
    enabled: true,
    globalPolicy: false,
  },
  {
    key: "UPDATE_PASSWORD",
    displayName: "API global action",
    assigned: true,
    enabled: true,
    globalPolicy: true,
  },
  {
    key: "TERMS",
    displayName: "API disabled action",
    assigned: false,
    enabled: false,
    globalPolicy: false,
  },
];
const change = (document, element) =>
  element.dispatchEvent(
    new document.defaultView.Event("change", { bubbles: true }),
  );
const submit = (document, form) =>
  form.dispatchEvent(
    new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );

async function credentials(harness) {
  harness.setResponse("/api/admin/users/1", "GET", () => user);
  await settle();
  harness.document.querySelector('[data-route="users"]').click();
  await settle();
  harness.document
    .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
    .click();
  await settle();
  harness.document.querySelector('[data-tab="credentials"]').click();
  await settle();
}

test("native Users search debounces typing, preserves focus, and clears the filter without Enter", async () => {
  const h = await renderConsole("admin");
  try {
    await settle();
    h.document.querySelector('[data-route="users"]').click();
    await settle();
    const initial = h.calls.length;
    const input = h.document.getElementById("admin-user-query");
    input.focus();
    for (const value of ["a", "ad", "ada"]) {
      input.value = value;
      input.dispatchEvent(
        new h.document.defaultView.Event("input", { bubbles: true }),
      );
    }
    assert.equal(h.calls.length, initial);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    const searches = h.calls
      .slice(initial)
      .filter(({ path }) => path.startsWith("/api/admin/users?"));
    assert.equal(searches.length, 1);
    assert.equal(
      new URL(searches[0].path, "http://local").searchParams.get("q"),
      "ada",
    );
    assert.equal(h.document.activeElement.id, "admin-user-query");
    assert.equal(h.document.activeElement.value, "ada");
    h.document.activeElement.value = "";
    h.document.activeElement.dispatchEvent(
      new h.document.defaultView.Event("input", { bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.ok(
      h.calls
        .slice(initial)
        .some(({ path }) => path.includes("users?q=&page=0")),
    );
  } finally {
    h.restore();
  }
});

test("native Users search ignores stale results and searches text entered during the request", async () => {
  const h = await renderConsole("admin");
  let complete;
  try {
    await settle();
    h.document.querySelector('[data-route="users"]').click();
    await settle();
    h.setResponse(
      "/api/admin/users?q=old&page=0&size=20&sort=username%2Casc",
      "GET",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    h.setResponse(
      "/api/admin/users?q=new&page=0&size=20&sort=username%2Casc",
      "GET",
      () => ({
        content: [{ ...user, username: "new-result" }],
        totalElements: 1,
        totalPages: 1,
        number: 0,
      }),
    );
    const type = (value) => {
      const input = h.document.getElementById("admin-user-query");
      input.focus();
      input.value = value;
      input.dispatchEvent(
        new h.document.defaultView.Event("input", { bubbles: true }),
      );
    };
    type("old");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.equal(
      h.document.getElementById("admin-user-search").getAttribute("aria-busy"),
      "true",
    );
    assert.equal(
      h.document.querySelectorAll("#admin-user-search .spinner").length,
      1,
    );
    type("new");
    complete({
      content: [{ ...user, username: "stale-result" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
    });
    await settle();
    assert.doesNotMatch(
      h.document.querySelector(".admin-users-table").textContent,
      /stale-result/,
    );
    assert.equal(h.document.getElementById("admin-user-query").value, "new");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.match(
      h.document.querySelector(".admin-users-table").textContent,
      /new-result/,
    );
    assert.equal(h.document.activeElement.id, "admin-user-query");
    assert.equal(
      h.document.getElementById("admin-user-search").getAttribute("aria-busy"),
      "false",
    );
  } finally {
    h.restore();
  }
});

test("native Users pagination sends page size, first/last page, sort and status to API", async () => {
  const h = await renderConsole("admin");
  try {
    await settle();
    const usersPath = "/api/admin/users?q=&page=0&size=20&sort=username%2Casc";
    h.setResponse(usersPath, "GET", () => ({
      content: [user],
      totalElements: 47,
      totalPages: 3,
      number: 0,
    }));
    h.document.querySelector('[data-route="users"]').click();
    await settle();
    assert.match(
      h.document.querySelector(".admin-pagination-summary").textContent,
      /1–20.*47/,
    );
    const last = h.document.querySelector('[aria-label="Last page"]');
    assert.equal(last.disabled, false);
    last.click();
    await settle();
    assert.ok(
      h.calls.some(
        ({ path }) =>
          new URL(path, "http://local").searchParams.get("page") === "2",
      ),
    );
    const size = h.document.getElementById("admin-user-page-size");
    size.value = "50";
    change(h.document, size);
    await settle();
    assert.ok(h.calls.some(({ path }) => path.includes("page=0&size=50")));
    const sort = h.document.getElementById("admin-user-sort");
    sort.value = "username,desc";
    change(h.document, sort);
    await settle();
    const status = h.document.getElementById("admin-user-status");
    status.value = "false";
    change(h.document, status);
    await settle();
    assert.ok(
      h.calls.some(({ path }) =>
        path.includes("size=50&sort=username%2Cdesc&enabled=false"),
      ),
    );
  } finally {
    h.restore();
  }
});

test("required-action failures render retry instead of a misleading empty list", async () => {
  const h = await renderConsole("admin");
  try {
    h.setResponse(base, "GET", () => ({ status: 503, body: {} }));
    await credentials(h);
    const card = () =>
      h.document.querySelector(".admin-user-required-actions-card");
    assert.match(card().textContent, /could not be loaded/i);
    assert.equal(card().querySelector(".empty"), null);
    assert.equal(card().querySelector('input[type="checkbox"]'), null);
    let complete;
    h.setResponse(
      base,
      "GET",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    card().querySelector("button").click();
    await settle();
    const retry = card().querySelector("button");
    assert.equal(retry.disabled, true);
    assert.equal(retry.querySelectorAll(".spinner").length, 1);
    complete(actions.map((item) => ({ ...item })));
    await settle();
    assert.equal(card().querySelectorAll('input[type="checkbox"]').length, 3);
    assert.equal(card().querySelector('[role="alert"]'), null);
    assert.equal(
      card().querySelector('[data-key="UPDATE_PASSWORD"]').disabled,
      true,
    );
    assert.equal(card().querySelector('[data-key="TERMS"]').disabled, true);
    assert.match(card().textContent, /API recovery action/);
  } finally {
    h.restore();
  }
});

test("required-action mutations preserve password draft, show progress, refresh API and recover errors", async () => {
  const h = await renderConsole("admin");
  const current = actions.map((item) => ({ ...item }));
  try {
    h.setResponse(base, "GET", () => current.map((item) => ({ ...item })));
    await credentials(h);
    const checkbox = () =>
      h.document.querySelector('[data-key="RECOVERY_CODES"]');
    const password = () =>
      h.document.querySelector(
        '[data-form="admin-user-detail-password"] input[name="password"]',
      );
    password().value = "Pending-password-42!";
    let complete;
    h.setResponse(
      `${base}/RECOVERY_CODES`,
      "POST",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    checkbox().click();
    await settle();
    assert.equal(checkbox().disabled, true);
    assert.equal(
      checkbox().closest("label").querySelectorAll(".spinner").length,
      1,
    );
    assert.equal(password().value, "Pending-password-42!");
    const before = h.calls.length;
    checkbox().click();
    await settle();
    assert.equal(h.calls.length, before);
    current[0].assigned = true;
    complete(null);
    await settle();
    assert.equal(checkbox().checked, true);
    assert.equal(checkbox().disabled, false);
    assert.equal(password().value, "Pending-password-42!");
    h.setResponse(`${base}/RECOVERY_CODES`, "DELETE", () => ({
      status: 403,
      body: {},
    }));
    checkbox().click();
    await settle();
    assert.equal(checkbox().checked, true);
    assert.match(
      h.document.querySelector(".admin-user-required-actions-card [role=alert]")
        .textContent,
      /could not be updated/,
    );
    h.setResponse(`${base}/RECOVERY_CODES`, "DELETE", () => {
      current[0].assigned = false;
      return null;
    });
    checkbox().click();
    await settle();
    assert.equal(checkbox().checked, false);
    assert.equal(
      h.document.querySelector(
        ".admin-user-required-actions-card [role=alert]",
      ),
      null,
    );
    assert.ok(
      h.calls.filter(({ path, method }) => path === base && method === "GET")
        .length >= 3,
    );
  } finally {
    h.restore();
  }
});

test("credential Save validates optional password, submits once and clears it on success", async () => {
  const h = await renderConsole("admin");
  try {
    h.setResponse(base, "GET", () => actions.map((item) => ({ ...item })));
    await credentials(h);
    const form = () =>
      h.document.querySelector('[data-form="admin-user-detail-password"]');
    const headings = [
      ...h.document.querySelectorAll(".admin-user-credentials-grid > .card h2"),
    ].map((element) => element.textContent);
    assert.deepEqual(headings, [
      "adminResetPassword",
      "Passkeys",
      "Required actions",
      "Credential reset",
      "Reset authenticator",
    ]);
    assert.equal(
      h.document
        .querySelector('.admin-user-detail-form-actions button[type="submit"]')
        .getAttribute("form"),
      form().id,
    );
    submit(h.document, form());
    await settle();
    assert.equal(
      h.calls.some(
        ({ path, method }) => path.endsWith("/password") && method === "PUT",
      ),
      false,
    );
    form().elements.namedItem("password").value = "short";
    submit(h.document, form());
    await settle();
    assert.ok(form().querySelector(".field-error").textContent);
    let complete;
    h.setResponse(
      "/api/admin/users/1/password",
      "PUT",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    form().elements.namedItem("password").value = "Strong-Test-Password-42!";
    form()
      .elements.namedItem("password")
      .dispatchEvent(
        new h.document.defaultView.Event("input", { bubbles: true }),
      );
    assert.equal(form().querySelector(".field-error").textContent, "");
    form().elements.namedItem("temporary").checked = false;
    submit(h.document, form());
    await settle();
    const save = h.document.querySelector(
      '.admin-user-detail-form-actions button[type="submit"]',
    );
    assert.equal(save.disabled, true);
    assert.equal(save.querySelectorAll(".spinner").length, 1);
    complete(null);
    await settle();
    assert.equal(form().elements.namedItem("password").value, "");
    assert.ok(
      h.calls.some(
        ({ path, method, body }) =>
          path.endsWith("/password") &&
          method === "PUT" &&
          body.temporary === false,
      ),
    );
    form().elements.namedItem("password").value = "Discard-This-Password-42!";
    h.document
      .querySelector(
        '.admin-user-detail-form-actions [data-action="admin-user-detail-back"]',
      )
      .click();
    await settle();
    h.document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    h.document.querySelector('[data-tab="credentials"]').click();
    await settle();
    assert.equal(form().elements.namedItem("password").value, "");
  } finally {
    h.restore();
  }
});
