import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { rolePage } from "../src/native/roles.mjs";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const wirePage = JSON.parse(
  await readFile(new URL("./fixtures/role-page.json", import.meta.url), "utf8"),
);
const listPath = "/api/admin/roles?q=&page=0&size=10&sort=name%2Casc";
const detailPath =
  "/api/admin/roles/ROLE_USER?q=&page=0&size=10&sort=username%2Casc";
const user = { id: 8, username: "grace", enabled: true };
const detail = {
  name: "ROLE_USER",
  description: "User description",
  userCount: 1,
  protectedRole: true,
  compositeRoles: ["ROLE_EDITOR"],
  compositeClientRoles: [{ id: 42, clientId: "demo-client", name: "read" }],
  users: {
    content: [user],
    page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
  },
};
const emit = (document, element, type = "input") =>
  element.dispatchEvent(
    new document.defaultView.Event(type, { bubbles: true, cancelable: true }),
  );
const delay = () => new Promise((resolve) => setTimeout(resolve, 360));
async function roles(h) {
  h.setResponse(listPath, "GET", () => wirePage);
  h.setResponse(detailPath, "GET", () => structuredClone(detail));
  await settle();
  h.document.querySelector('[data-route="roles"]').click();
  await settle();
}
async function open(h) {
  await roles(h);
  h.document
    .querySelector('[data-action="role-open"][data-id="ROLE_USER"]')
    .click();
  await settle();
}

test("role pagination consumes metadata captured from the real backend", () => {
  assert.equal(wirePage.totalElements, undefined);
  assert.deepEqual(rolePage(wirePage), {
    content: wirePage.content,
    ...wirePage.page,
  });
  assert.equal(rolePage(wirePage).totalElements, 14);
  assert.equal(rolePage(wirePage).totalPages, 2);
});

test("native role list is compact, protects built-in roles and sends bounded pagination", async () => {
  const h = await renderConsole("admin");
  try {
    await roles(h);
    const { document, calls } = h;
    assert.equal(document.querySelectorAll(".role-table tbody tr").length, 10);
    assert.equal(document.querySelector('[data-form="admin-role-edit"]'), null);
    for (const name of ["ROLE_ADMIN", "ROLE_USER"]) {
      assert.equal(
        document.querySelector(
          `[data-role-name="${name}"] [data-action="admin-role-delete-request"]`,
        ),
        null,
      );
    }
    assert.equal(
      document.querySelector(".admin-pagination-summary").textContent,
      "1–10 / 14",
    );
    document
      .querySelector('[data-action="role-page"][data-target="1"]')
      .click();
    await settle();
    assert.ok(calls.some(({ path }) => path.includes("page=1&size=10")));
    const size = document.getElementById("role-size");
    size.value = "50";
    emit(document, size, "change");
    await settle();
    assert.ok(calls.some(({ path }) => path.includes("page=0&size=50")));
    const sort = document.getElementById("role-sort");
    sort.value = "name,desc";
    emit(document, sort, "change");
    await settle();
    assert.ok(calls.some(({ path }) => path.includes("sort=name%2Cdesc")));
    const menu = document.querySelector(".role-menu");
    menu.open = true;
    const menuItems = [...menu.querySelectorAll("button:not(:disabled)")];
    assert.ok(menuItems.length > 0);
    menu.dispatchEvent(
      new document.defaultView.KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    assert.equal(document.activeElement, menuItems[0]);
    menu.dispatchEvent(
      new document.defaultView.KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      }),
    );
    assert.equal(document.activeElement, menuItems[0]);
    menu.dispatchEvent(
      new document.defaultView.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }),
    );
    assert.equal(menu.open, false);
    assert.equal(document.activeElement, menu.querySelector("summary"));
  } finally {
    h.restore();
  }
});

test("role detail corrects an out-of-range backend page and reloads the last valid page", async () => {
  const h = await renderConsole("admin");
  try {
    h.setResponse(listPath, "GET", () => wirePage);
    h.setResponse(detailPath, "GET", () => ({
      ...detail,
      users: {
        content: [],
        page: { size: 10, number: 4, totalElements: 15, totalPages: 2 },
      },
    }));
    const lastPagePath =
      "/api/admin/roles/ROLE_USER?q=&page=1&size=10&sort=username%2Casc";
    h.setResponse(lastPagePath, "GET", () => ({
      ...detail,
      users: {
        content: [],
        page: { size: 10, number: 1, totalElements: 15, totalPages: 2 },
      },
    }));
    await settle();
    h.document.querySelector('[data-route="roles"]').click();
    await settle();
    h.document
      .querySelector('[data-action="role-open"][data-id="ROLE_USER"]')
      .click();
    await settle();
    h.document
      .querySelector('[data-action="role-tab"][data-id="users"]')
      .click();
    await settle();

    assert.ok(h.calls.some(({ path }) => path === detailPath));
    assert.ok(h.calls.some(({ path }) => path === lastPagePath));
    assert.match(
      h.document.querySelector(".admin-pagination-controls").textContent,
      /2\s*\/\s*2/,
    );
  } finally {
    h.restore();
  }
});

test("role detail tabs support ArrowRight, Home, and End keyboard navigation", async () => {
  const h = await renderConsole("admin");
  try {
    await open(h);
    const tabs = () => [
      ...h.document.querySelectorAll('[data-action="role-tab"]'),
    ];
    assert.ok(tabs().length > 1);
    tabs()[0].dispatchEvent(
      new h.document.defaultView.KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(tabs()[1].getAttribute("aria-selected"), "true");
    tabs()[1].dispatchEvent(
      new h.document.defaultView.KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(tabs().at(-1).getAttribute("aria-selected"), "true");
    tabs().at(-1).dispatchEvent(
      new h.document.defaultView.KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(tabs()[0].getAttribute("aria-selected"), "true");
  } finally {
    h.restore();
  }
});

test("native role search debounces, retains focus and ignores an older response", async () => {
  const h = await renderConsole("admin");
  let release;
  try {
    await roles(h);
    h.setResponse(
      "/api/admin/roles?q=OLD&page=0&size=10&sort=name%2Casc",
      "GET",
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    h.setResponse(
      "/api/admin/roles?q=NEW&page=0&size=10&sort=name%2Casc",
      "GET",
      () => ({
        content: [{ name: "ROLE_NEW" }],
        page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
      }),
    );
    const input = h.document.getElementById("admin-role-query");
    input.focus();
    for (const query of ["O", "OL", "OLD"]) {
      input.value = query;
      emit(h.document, input);
    }
    await delay();
    await settle();
    assert.equal(
      h.calls.filter(({ path }) => path.includes("q=OLD")).length,
      1,
    );
    const next = h.document.getElementById("admin-role-query");
    next.value = "NEW";
    emit(h.document, next);
    await delay();
    await settle();
    release({
      content: [{ name: "ROLE_OLD" }],
      page: { size: 10, number: 0, totalElements: 1, totalPages: 1 },
    });
    await settle();
    assert.match(
      h.document.querySelector(".role-table").textContent,
      /ROLE_NEW/,
    );
    assert.equal(
      h.document.querySelector(".role-table").textContent.includes("ROLE_OLD"),
      false,
    );
    assert.equal(h.document.activeElement.id, "admin-role-query");
    const formQuery = h.document.getElementById("admin-role-query");
    formQuery.value = "FORM";
    emit(h.document, formQuery);
    h.document
      .getElementById("admin-role-search")
      .dispatchEvent(
        new h.dom.window.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settle();
    assert.ok(h.calls.some(({ path }) => path.includes("q=FORM&page=0")));
    h.document.querySelector('[data-action="role-clear"]').click();
    await settle();
    assert.equal(h.document.getElementById("admin-role-query").value, "");
  } finally {
    h.restore();
  }
});

test("role detail preserves list state and saves a blank description as null once", async () => {
  const h = await renderConsole("admin");
  let release;
  try {
    await open(h);
    const { document } = h;
    assert.equal(document.querySelector('[name="description"]').rows, 3);
    assert.equal(document.querySelectorAll('[role="tab"]').length, 2);
    assert.match(
      document.querySelector(".role-detail-summary").textContent,
      /1 assigned users/,
    );
    h.setResponse(
      "/api/admin/roles/ROLE_USER",
      "PUT",
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const form = document.querySelector('[data-form="admin-role-edit"]');
    form.elements.description.value = "  ";
    emit(document, form, "submit");
    await settle();
    const busy = document.querySelector('[data-form="admin-role-edit"] button');
    assert.equal(busy.textContent, "Save description");
    assert.ok(busy.disabled);
    assert.ok(busy.querySelector(".spinner"));
    emit(document, form, "submit");
    await settle();
    const calls = h.calls.filter(({ method }) => method === "PUT");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.description, null);
    release({ name: "ROLE_USER", description: null });
    await settle();
    document.querySelector('[data-action="role-back"]').click();
    await settle();
    assert.equal(document.getElementById("role-size").value, "10");
  } finally {
    h.restore();
  }
});

test("role detail keeps overlong descriptions local and shows a field error", async () => {
  const h = await renderConsole("admin");
  try {
    await open(h);
    const form = h.document.querySelector('[data-form="admin-role-edit"]');
    form.elements.description.value = "x".repeat(501);
    emit(h.document, form, "submit");
    await settle();
    assert.equal(h.calls.some(({ method }) => method === "PUT"), false);
    assert.match(h.document.querySelector(".content").textContent, /500/);
    assert.equal(
      h.document.querySelector('[name="description"]').value.length,
      501,
    );
  } finally {
    h.restore();
  }
});

test("role users select candidates, exclude current members, filter, assign and confirm removal", async () => {
  const h = await renderConsole("admin");
  let members = [user];
  try {
    await open(h);
    h.setResponse(detailPath, "GET", () => ({
      ...detail,
      userCount: members.length,
      users: {
        content: members,
        page: {
          size: 10,
          number: 0,
          totalElements: members.length,
          totalPages: 1,
        },
      },
    }));
    h.document
      .querySelector('[data-action="role-tab"][data-id="users"]')
      .click();
    await settle();
    h.setResponse(
      "/api/admin/roles/ROLE_USER/available-users?q=ada&page=0&size=10&sort=username,asc",
      "GET",
      () => ({
        content: [user, { id: 9, username: "ada", enabled: true }],
        page: { size: 10, number: 0, totalElements: 2, totalPages: 1 },
      }),
    );
    const search = h.document.getElementById("role-candidate-user");
    search.value = "かな";
    search.dispatchEvent(
      new h.dom.window.InputEvent("input", {
        bubbles: true,
        isComposing: true,
      }),
    );
    await delay();
    assert.equal(
      h.calls.some(
        ({ path }) =>
          new URL(path, "https://test.invalid").searchParams.get("q") ===
          "かな",
      ),
      false,
    );
    search.dispatchEvent(
      new h.dom.window.CompositionEvent("compositionend", { bubbles: true }),
    );
    await delay();
    await settle();
    assert.ok(
      h.calls.some(
        ({ path }) =>
          new URL(path, "https://test.invalid").searchParams.get("q") ===
          "かな",
      ),
    );
    search.value = "ada";
    emit(h.document, search);
    await delay();
    await settle();
    const select = h.document.getElementById("role-candidate-select-user");
    assert.equal(select.querySelector('option[value="8"]'), null);
    assert.ok(
      h.document.querySelector('[data-action="role-user-add"]').disabled,
    );
    select.value = "9";
    emit(h.document, select, "change");
    h.setResponse("/api/admin/roles/ROLE_USER/users", "POST", () => {
      members = [...members, { id: 9, username: "ada", enabled: true }];
      return detail;
    });
    h.document.querySelector('[data-action="role-user-add"]').click();
    await settle();
    assert.ok(
      h.calls.some(
        ({ path, body }) => path.endsWith("/users") && body.userId === 9,
      ),
    );
    assert.match(
      h.document.querySelector(".role-detail-summary").textContent,
      /2 assigned users/,
    );
    h.setResponse("/api/admin/roles/ROLE_USER/users/9", "DELETE", () => {
      members = [user];
      return detail;
    });
    h.document
      .querySelector('[data-action="role-user-remove"][data-id="9"]')
      .click();
    await settle();
    assert.equal(
      h.calls.some(({ method }) => method === "DELETE"),
      false,
    );
    h.document
      .querySelector('[data-action="role-user-remove-confirm"][data-id="9"]')
      .click();
    await settle();
    assert.match(
      h.document.querySelector(".role-detail-summary").textContent,
      /1 assigned users/,
    );
    const enabled = h.document.getElementById("role-users-enabled");
    enabled.value = "false";
    emit(h.document, enabled, "change");
    await settle();
    assert.ok(h.calls.some(({ path }) => path.includes("enabled=false")));
    const sort = h.document.getElementById("role-users-sort");
    sort.value = "email,desc";
    emit(h.document, sort, "change");
    await settle();
    assert.ok(h.calls.some(({ path }) => path.includes("sort=email%2Cdesc")));
  } finally {
    h.restore();
  }
});

test("view-only role detail displays composites and members but blocks mutations", async () => {
  const h = await renderConsole("admin");
  try {
    await settle();
    h.setResponse("/api/admin/whoami", "GET", () => ({
      access: {
        ...Object.fromEntries(
          [
            "isAdmin",
            "queryUsers",
            "viewUsers",
            "manageUsers",
            "viewRoles",
            "manageRoles",
            "queryGroups",
            "viewGroups",
            "manageGroups",
            "queryClients",
            "viewClients",
            "manageClients",
            "viewSessions",
            "manageSessions",
            "viewConsents",
            "manageConsents",
            "viewEvents",
            "manageEvents",
            "viewKeys",
            "manageKeys",
          ].map((key) => [key, true]),
        ),
        manageRoles: false,
      },
    }));
    h.callbacks.auth({});
    await settle();
    await open(h);
    assert.equal(h.document.querySelector('[data-action="create-role"]'), null);
    assert.ok(h.document.querySelector('[name="description"]').disabled);
    assert.equal(
      h.document.querySelector('[data-form="admin-role-edit"] button'),
      null,
    );
    assert.match(
      h.document.querySelector("#role-tab-panel").textContent,
      /ROLE_EDITOR/,
    );
    assert.equal(
      h.document.querySelector(
        '[data-action="admin-role-composite-remove-request"]',
      ),
      null,
    );
    const form = h.document.querySelector('[data-form="admin-role-edit"]');
    emit(h.document, form, "submit");
    await settle();
    assert.equal(
      h.calls.some(({ method }) => method === "PUT"),
      false,
    );
    h.document.querySelector('[data-action="role-back"]').click();
    await settle();
    const forgedDelete = h.document.querySelector('[data-action="role-open"]');
    forgedDelete.dataset.action = "admin-role-delete-request";
    forgedDelete.click();
    await settle();
    assert.equal(
      h.document.querySelector('[data-action="admin-role-delete-confirm"]'),
      null,
    );
    h.document
      .querySelector('[data-action="role-open"][data-id="ROLE_USER"]')
      .click();
    await settle();
    h.document
      .querySelector('[data-action="role-tab"][data-id="users"]')
      .click();
    await settle();
    assert.match(
      h.document.querySelector("#role-tab-panel").textContent,
      /grace/,
    );
    assert.equal(
      h.document.querySelector('[data-action="role-user-remove"]'),
      null,
    );
  } finally {
    h.restore();
  }
});

test("role loading failures and missing roles do not masquerade as empty members", async () => {
  for (const status of [404, 503]) {
    const h = await renderConsole("admin");
    try {
      await roles(h);
      h.setResponse(detailPath, "GET", () => ({
        status,
        kind: "server",
        body: null,
      }));
      h.document
        .querySelector('[data-action="role-open"][data-id="ROLE_USER"]')
        .click();
      await settle();
      assert.equal(
        h.document.querySelector('[data-action="role-user-add"]'),
        null,
      );
      assert.match(
        h.document.querySelector(".content").textContent,
        status === 404 ? /could not be found/ : /could not be loaded/,
      );
      assert.ok(h.document.querySelector('[data-action="retry"]'));
    } finally {
      h.restore();
    }
  }
});

test("role member candidate failures can be retried and empty results stay explicit", async () => {
  const h = await renderConsole("admin");
  try {
    await open(h);
    h.document
      .querySelector('[data-action="role-tab"][data-id="users"]')
      .click();
    await settle();
    const query = h.document.getElementById("role-candidate-user");
    const retryPath =
      "/api/admin/roles/ROLE_USER/available-users?q=ada&page=0&size=10&sort=username,asc";
    h.setResponse(retryPath, "GET", () => ({
      status: 503,
      kind: "server",
      body: null,
    }));
    query.value = "ada";
    emit(h.document, query);
    await delay();
    await settle();
    assert.match(
      h.document.querySelector('[data-role-candidate="user"]').textContent,
      /could not be loaded/i,
    );
    const retry = h.document.querySelector(
      '[data-action="role-candidate-retry"][data-id="user"]',
    );
    assert.ok(retry);
    retry.click();
    await settle();
    h.setResponse(retryPath, "GET", () => ({ content: [] }));
    h.document
      .querySelector('[data-action="role-candidate-retry"][data-id="user"]')
      .click();
    await settle();
    assert.match(
      h.document.querySelector('[data-role-candidate="user"]').textContent,
      /no matching candidates found/i,
    );
    assert.equal(
      h.document.querySelector('[data-action="role-candidate-retry"]'),
      null,
    );
  } finally {
    h.restore();
  }
});

test("role member removal can be canceled and retains the row after an API failure", async () => {
  const h = await renderConsole("admin");
  try {
    await open(h);
    h.document
      .querySelector('[data-action="role-tab"][data-id="users"]')
      .click();
    await settle();
    const remove = () =>
      h.document.querySelector('[data-action="role-user-remove"][data-id="8"]');
    remove().click();
    await settle();
    h.document
      .querySelector('[data-action="role-user-remove-cancel"]')
      .click();
    await settle();
    assert.ok(remove());
    assert.equal(h.calls.some(({ method }) => method === "DELETE"), false);

    h.setResponse("/api/admin/roles/ROLE_USER/users/8", "DELETE", () => ({
      status: 503,
      kind: "server",
      body: null,
    }));
    remove().click();
    await settle();
    h.document
      .querySelector('[data-action="role-user-remove-confirm"][data-id="8"]')
      .click();
    await settle();
    assert.ok(h.calls.some(({ method, path }) =>
      method === "DELETE" && path.endsWith("/users/8"),
    ));
    assert.ok(
      h.document.querySelector(
        '[data-action="role-user-remove-confirm"][data-id="8"]',
      ),
    );
  } finally {
    h.restore();
  }
});

test("role deletion refreshes the previous page after deleting the last row", async () => {
  const h = await renderConsole("admin");
  try {
    await roles(h);
    h.setResponse(
      "/api/admin/roles?q=&page=1&size=10&sort=name%2Casc",
      "GET",
      () => ({
        content: [{ name: "ROLE_TEMP" }],
        page: { size: 10, number: 1, totalElements: 11, totalPages: 2 },
      }),
    );
    h.document
      .querySelector('[data-action="role-page"][data-target="1"]')
      .click();
    await settle();
    h.document
      .querySelector('[data-action="admin-role-delete-request"]')
      .click();
    await settle();
    const before = h.calls.length;
    h.document
      .querySelector('[data-action="admin-role-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      h.calls
        .slice(before)
        .some(
          ({ path, method }) =>
            path === "/api/admin/roles/ROLE_TEMP" && method === "DELETE",
        ),
    );
    assert.ok(h.calls.slice(before).some(({ path }) => path === listPath));
  } finally {
    h.restore();
  }
});

test("composite candidates require two characters, ignore stale results and preserve search focus", async () => {
  const h = await renderConsole("admin");
  let release;
  try {
    await open(h);
    const first = h.document.getElementById("role-candidate-realm");
    first.focus();
    first.value = "O";
    emit(h.document, first);
    await delay();
    await settle();
    assert.equal(
      h.calls.some(({ path }) => path.includes("available-composites")),
      false,
    );
    h.setResponse(
      "/api/admin/roles/ROLE_USER/available-composites?q=OLD&page=0&size=10&sort=name,asc",
      "GET",
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    h.setResponse(
      "/api/admin/roles/ROLE_USER/available-composites?q=NEW&page=0&size=10&sort=name,asc",
      "GET",
      () => ({ content: [{ name: "ROLE_NEW" }] }),
    );
    first.value = "OLD";
    emit(h.document, first);
    await delay();
    await settle();
    const next = h.document.getElementById("role-candidate-realm");
    next.value = "NEW";
    emit(h.document, next);
    await delay();
    await settle();
    release({ status: 503, kind: "server", body: { detail: "Stale error" } });
    await settle();
    assert.ok(
      h.document.querySelector(
        '#role-candidate-select-realm option[value="ROLE_NEW"]',
      ),
    );
    assert.equal(
      h.document.querySelector(".content").textContent.includes("Stale error"),
      false,
    );
    assert.equal(h.document.activeElement.id, "role-candidate-realm");
    const select = h.document.getElementById("role-candidate-select-realm");
    select.value = "ROLE_NEW";
    emit(h.document, select, "change");
    assert.equal(
      h.document.querySelector('[data-action="admin-role-composite-add"]')
        .disabled,
      false,
    );
    const input = h.document.getElementById("role-candidate-realm");
    input.value = "N";
    emit(h.document, input);
    assert.equal(
      h.document.querySelector('[data-action="admin-role-composite-add"]')
        .disabled,
      true,
    );
    await delay();
    await settle();
  } finally {
    h.restore();
  }
});

test("role composite search filters malformed, self, and already assigned candidates", async () => {
  const h = await renderConsole("admin");
  try {
    await open(h);
    const realmPath =
      "/api/admin/roles/ROLE_USER/available-composites?q=ROLE&page=0&size=10&sort=name,asc";
    h.setResponse(realmPath, "GET", () => ({
      content: [
        { name: "not-a-role" },
        { name: "ROLE_USER" },
        { name: "ROLE_EDITOR" },
        { name: "ROLE_REVIEWER" },
      ],
    }));
    const realmSearch = h.document.getElementById("role-candidate-realm");
    realmSearch.value = "ROLE";
    emit(h.document, realmSearch);
    await delay();
    await settle();
    assert.ok(
      h.document.querySelector(
        '#role-candidate-select-realm option[value="ROLE_REVIEWER"]',
      ),
    );
    for (const excluded of ["not-a-role", "ROLE_USER", "ROLE_EDITOR"])
      assert.equal(
        h.document.querySelector(
          `#role-candidate-select-realm option[value="${excluded}"]`,
        ),
        null,
      );

    const clientPath =
      "/api/admin/roles/ROLE_USER/available-client-composites?q=client&page=0&size=10&sort=name,asc";
    h.setResponse(clientPath, "GET", () => ({
      content: [
        { id: 0, clientId: "console", name: "READ" },
        { id: 43, clientId: "bad/client", name: "READ" },
        { id: 45, name: "READ" },
        { id: 44, clientId: "console", name: null },
        { id: 42, clientId: "demo-client", name: "read" },
        { id: 43, clientId: "console", name: "REVIEW" },
      ],
    }));
    const clientSearch = h.document.getElementById("role-candidate-client");
    clientSearch.value = "client";
    emit(h.document, clientSearch);
    await delay();
    await settle();
    assert.ok(
      h.document.querySelector(
        '#role-candidate-select-client option[value="43"]',
      ),
    );
    for (const excluded of ["0", "42", "44", "45"])
      assert.equal(
        h.document.querySelector(
          `#role-candidate-select-client option[value="${excluded}"]`,
        ),
        null,
      );
  } finally {
    h.restore();
  }
});
