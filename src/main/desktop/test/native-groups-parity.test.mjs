import assert from "node:assert/strict";
import test from "node:test";
import { messages } from "../../shared/dist/catalog.js";
import { desktopIconMetadata } from "../../shared/dist/icons.js";
import { groupPage, groupAttributes } from "../src/native/groups.mjs";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const group = {
  id: 3,
  name: "Engineering",
  path: "/Engineering",
  roles: ["ROLE_USER"],
  userCount: 1,
  attributes: { department: ["finance"] },
  parentId: null,
  defaultGroup: false,
};
const users = [
  { id: 1, username: "ada", enabled: true },
  { id: 4, username: "grace", enabled: false },
];
const page = (content, metadata = {}) => ({
  content,
  page: {
    size: 10,
    number: 0,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
    ...metadata,
  },
});
const emit = (h, element, type = "input") =>
  element.dispatchEvent(
    new h.dom.window.Event(type, { bubbles: true, cancelable: true }),
  );
const click = async (h, selector) => {
  const element = h.document.querySelector(selector);
  assert.ok(element, selector);
  element.click();
  await settle();
};
const delay = () => new Promise((resolve) => setTimeout(resolve, 340));
async function harness(options = {}) {
  let detail = structuredClone(group);
  let members = [users[0]];
  let assignments = [];
  return renderConsole("admin", {
    icons: desktopIconMetadata,
    messages: { en: messages.en.native, tr: messages.tr.native },
    ...options,
    response: (path, method, body) => {
      const customized = options.response?.(path, method, body);
      if (customized !== undefined) return customized;
      const url = new URL(path, "https://test.invalid");
      if (url.pathname === "/api/admin/groups" && method === "GET")
        return page(
          [detail, { ...group, id: 7, name: "Parent", path: "/Parent" }],
          {
            size: Number(url.searchParams.get("size")),
            totalElements: 21,
            totalPages: 3,
            number: Number(url.searchParams.get("page")),
          },
        );
      if (path === "/api/admin/groups" && method === "POST") {
        detail = { ...detail, ...body, id: 8 };
        return detail;
      }
      if (path === `/api/admin/groups/${detail.id}`) {
        if (method === "PUT") detail = { ...detail, ...body };
        return detail;
      }
      if (
        url.pathname === `/api/admin/groups/${detail.id}/users` &&
        method === "GET"
      )
        return page(members, {
          size: Number(url.searchParams.get("size")),
          number: Number(url.searchParams.get("page")),
        });
      if (url.pathname.endsWith("/available-users")) return page([users[1]]);
      if (
        path === `/api/admin/groups/${detail.id}/users` &&
        method === "POST"
      ) {
        members.push(users.find((user) => user.id === body.userId));
        return { status: 204 };
      }
      if (
        path.startsWith(`/api/admin/groups/${detail.id}/users/`) &&
        method === "DELETE"
      ) {
        members = members.filter(
          (user) => String(user.id) !== path.split("/").at(-1),
        );
        return { status: 204 };
      }
      if (path === `/api/admin/groups/${detail.id}/permissions`) {
        if (method === "PUT") assignments = body.permissions;
        return assignments;
      }
      if (path === `/api/admin/groups/${detail.id}/roles`) {
        detail.roles = body.roles;
        return detail;
      }
      if (path.startsWith("/api/admin/roles?"))
        return page([{ name: "ROLE_USER" }, { name: "ROLE_EDITOR" }]);
      if (path.startsWith("/api/admin/users?")) return page(users);
      return undefined;
    },
  });
}
async function list(h) {
  await settle();
  await click(h, '[data-route="groups"]');
}
async function open(h, tab = "details") {
  await list(h);
  await click(h, '[data-action="group-open"][data-id="3"]');
  if (tab !== "details")
    await click(h, `[data-action="group-tab"][data-id="${tab}"]`);
}

test("group metadata and attributes follow the real wire contract", () => {
  assert.deepEqual(
    groupPage(page([group], { number: 1, totalPages: 2, totalElements: 11 })),
    { content: [group], size: 10, number: 1, totalPages: 2, totalElements: 11 },
  );
  assert.deepEqual(groupAttributes('{"department":["finance"]}'), {
    department: ["finance"],
  });
  for (const invalid of ["null", "[]", '{"a":"b"}', '{"a":[1]}', "{"])
    assert.throws(() => groupAttributes(invalid));

  assert.deepEqual(groupPage(null), {
    content: [],
    size: 10,
    number: 0,
    totalElements: 0,
    totalPages: 0,
  });
  assert.deepEqual(
    groupPage(
      {
        content: "not-an-array",
        page: {
          size: 0,
          number: 1.5,
          totalElements: -1,
          totalPages: Number.MAX_SAFE_INTEGER + 1,
        },
      },
      20,
    ),
    {
      content: [],
      size: 20,
      number: 0,
      totalElements: 0,
      totalPages: 0,
    },
  );
  assert.deepEqual(groupPage({ content: [group], totalElements: 1 }), {
    content: [group],
    size: 10,
    number: 0,
    totalElements: 1,
    totalPages: 1,
  });
});

test("sparse group list records render safe defaults for optional metadata", async () => {
  const sparseGroup = { id: 12, name: "Platform" };
  const h = await harness({
    response: (path, method) =>
      path.startsWith("/api/admin/groups?") && method === "GET"
        ? page([sparseGroup], { totalElements: 1, totalPages: 1 })
        : undefined,
  });
  try {
    await list(h);
    const row = h.document.querySelector(".group-table tbody tr");
    assert.equal(row.querySelector("td:first-child a").textContent, "Platform");
    assert.equal(row.querySelector("td:nth-child(2)").textContent, "0");
    assert.equal(row.querySelector("td:nth-child(3)").textContent, "0");
  } finally {
    h.restore();
  }
});

test("group list renders counts, overflow actions, search, sorting, all pagination and size", async () => {
  const h = await harness();
  try {
    await list(h);
    assert.equal(h.document.querySelectorAll(".group-table th").length, 4);
    assert.equal(
      h.document.querySelector(".group-table tbody td:nth-child(2)")
        .textContent,
      "1",
    );
    assert.match(
      h.document.querySelector(".admin-pagination-controls").textContent,
      /Page 1 \/ 3/,
    );
    assert.equal(
      h.document.querySelectorAll(".admin-pagination-control").length,
      4,
    );
    assert.equal(
      h.document.querySelector('[data-action="admin-group-members-toggle"]'),
      null,
    );
    assert.ok(h.document.querySelector(".group-menu summary svg"));
    await click(h, '[data-action="group-page"][data-target="2"]');
    const sort = h.document.getElementById("group-sort");
    sort.value = "name,desc";
    emit(h, sort, "change");
    await settle();
    assert.ok(
      h.calls.some(({ path }) =>
        path.includes("page=0&size=10&sort=name%2Cdesc"),
      ),
    );
    const size = h.document.getElementById("group-size");
    size.value = "50";
    emit(h, size, "change");
    await settle();
    assert.ok(h.calls.some(({ path }) => path.includes("page=0&size=50")));
    const query = h.document.getElementById("group-query");
    query.focus();
    query.value = "Engineering";
    emit(h, query);
    await delay();
    await settle();
    assert.ok(
      h.calls.some(({ path }) => path.includes("q=Engineering&page=0&size=50")),
    );
    assert.equal(h.document.activeElement.id, "group-query");
    query.value = "Parent";
    emit(h, query);
    emit(h, h.document.getElementById("group-search"), "submit");
    await delay();
    await settle();
    assert.ok(
      h.calls.some(({ path }) =>
        path.includes("q=Parent&page=0&size=50"),
      ),
    );
    const requestCount = h.calls.length;
    query.value = "東京";
    query.dispatchEvent(
      new h.dom.window.InputEvent("input", {
        bubbles: true,
        isComposing: true,
      }),
    );
    await delay();
    assert.equal(h.calls.length, requestCount);
    query.dispatchEvent(
      new h.dom.window.CompositionEvent("compositionend", { bubbles: true }),
    );
    await delay();
    assert.ok(
      h.calls.some(({ path }) =>
        new URL(path, "https://test.invalid").searchParams.has("q", "東京"),
      ),
    );
    await click(h, '[data-action="group-clear"]');
    assert.equal(h.document.getElementById("group-query").value, "");
    assert.equal(
      h.document.querySelector(".topbar p").textContent,
      "Manage user groups and role mappings.",
    );
  } finally {
    h.restore();
  }
});

test("group navigation restores a user detail deep link from browser history", async () => {
  const h = await harness();
  h.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    firstName: "Ada",
    lastName: "Lovelace",
    enabled: true,
    emailVerified: true,
    authorities: [],
    attributes: {},
  }));
  try {
    await list(h);
    h.dom.window.history.pushState(null, "", "#/admin/users/1/details");
    h.dom.window.dispatchEvent(new h.dom.window.PopStateEvent("popstate"));
    await settle();
    assert.ok(h.calls.some(({ path }) => path === "/api/admin/users/1"));
    assert.ok(h.document.querySelector('[data-form="admin-user-detail-save"]'));
  } finally {
    h.restore();
  }
});

test("group settings validate JSON and submit complete PUT, reset dirty state and map duplicate errors", async () => {
  const h = await harness();
  try {
    await open(h);
    assert.match(
      h.document.querySelector(".group-breadcrumb").textContent,
      /Groups.*Engineering/,
    );
    assert.equal(h.document.querySelectorAll('[role="tab"]').length, 4);
    assert.equal(h.dom.window.location.hash, "#/admin/groups/3/details");
    assert.equal(h.document.querySelector('option[value="3"]'), null);
    assert.equal(
      h.document.querySelector(".group-default-checkbox span").textContent,
      "Add new users to this group by default",
    );
    assert.equal(
      h.document.querySelector("#group-defaultGroup").checked,
      false,
    );
    assert.equal(
      h.document.querySelector(
        '[data-form="native-group-settings"] button[type="submit"]',
      ).disabled,
      true,
    );
    const change = (id, value, type = "input") => {
      const input = h.document.getElementById(id);
      if (typeof value === "boolean") input.checked = value;
      else input.value = value;
      emit(h, input, type);
    };
    change("group-name", "Finance");
    change("group-attributesJson", "[]");
    emit(
      h,
      h.document.querySelector('[data-form="native-group-settings"]'),
      "submit",
    );
    await settle();
    assert.match(
      h.document.getElementById("group-attributesJson-error").textContent,
      /JSON object/,
    );
    assert.equal(
      h.calls.some(({ method }) => method === "PUT"),
      false,
    );
    change("group-attributesJson", '{"department":["finance"]}');
    change("group-parentId", "7", "change");
    change("group-defaultGroup", true, "change");
    emit(
      h,
      h.document.querySelector('[data-form="native-group-settings"]'),
      "submit",
    );
    await settle();
    assert.deepEqual(h.calls.find(({ method }) => method === "PUT").body, {
      name: "Finance",
      parentId: 7,
      attributes: { department: ["finance"] },
      defaultGroup: true,
    });
    assert.equal(
      h.document.querySelector(
        '[data-form="native-group-settings"] button[type="submit"]',
      ).disabled,
      true,
    );
    h.setResponse("/api/admin/groups/3", "PUT", () => ({
      status: 409,
      body: {
        field: "name",
        errorCode: "group_duplicate_name",
        detail: "Already exists",
      },
    }));
    change("group-name", "Duplicate");
    emit(
      h,
      h.document.querySelector('[data-form="native-group-settings"]'),
      "submit",
    );
    await settle();
    assert.equal(
      h.document.getElementById("group-name-error").textContent,
      "Already exists",
    );
    change("group-name", "New");
    assert.equal(h.document.getElementById("group-name-error").textContent, "");
  } finally {
    h.restore();
  }
});

test("create sends parent, default and attributes and opens new details with breadcrumb", async () => {
  const h = await harness();
  try {
    await list(h);
    await click(h, '[data-action="create-group"]');
    const form = h.document.querySelector(
      '[data-form="native-group-settings"]',
    );
    form.elements.name.value = "Runtime";
    form.elements.parentId.value = "3";
    form.elements.defaultGroup.checked = true;
    form.elements.attributesJson.value = '{"team":["runtime"]}';
    emit(h, form, "submit");
    await settle();
    assert.deepEqual(h.calls.find(({ method }) => method === "POST").body, {
      name: "Runtime",
      parentId: 3,
      defaultGroup: true,
      attributes: { team: ["runtime"] },
    });
    assert.equal(h.dom.window.location.hash, "#/admin/groups/8/details");
    assert.equal(h.document.querySelector(".topbar h1").textContent, "Runtime");
  } finally {
    h.restore();
  }
});

test("permissions add validates a blank row, save and remove sends complete assignments", async () => {
  const h = await harness();
  try {
    await open(h, "permissions");
    assert.ok(h.document.querySelector(".empty"));
    await click(h, '[data-action="group-permission-add"]');
    emit(
      h,
      h.document.querySelector('[data-form="native-group-permissions"]'),
      "submit",
    );
    await settle();
    assert.equal(
      h.calls.some(({ method }) => method === "PUT"),
      false,
    );
    const user = h.document.getElementById("group-permission-user-0");
    user.value = "1";
    emit(h, user, "change");
    const permission = h.document.getElementById("group-permission-value-0");
    permission.value = "MANAGE_GROUP";
    emit(h, permission, "change");
    emit(
      h,
      h.document.querySelector('[data-form="native-group-permissions"]'),
      "submit",
    );
    await settle();
    assert.deepEqual(h.calls.find(({ method }) => method === "PUT").body, {
      permissions: [{ userId: 1, permission: "MANAGE_GROUP" }],
    });
    await click(h, '[data-action="group-permission-remove"]');
    emit(
      h,
      h.document.querySelector('[data-form="native-group-permissions"]'),
      "submit",
    );
    await settle();
    assert.deepEqual(
      h.calls.filter(({ method }) => method === "PUT").at(-1).body,
      { permissions: [] },
    );
  } finally {
    h.restore();
  }
});

test("group permission assignments reject duplicate user and permission pairs", async () => {
  const h = await harness();
  try {
    await open(h, "permissions");
    await click(h, '[data-action="group-permission-add"]');
    await click(h, '[data-action="group-permission-add"]');
    for (const index of [0, 1]) {
      const user = h.document.getElementById(`group-permission-user-${index}`);
      user.value = "1";
      emit(h, user, "change");
      const permission = h.document.getElementById(
        `group-permission-value-${index}`,
      );
      permission.value = "MANAGE_GROUP";
      emit(h, permission, "change");
    }
    const form = h.document.querySelector(
      '[data-form="native-group-permissions"]',
    );
    emit(h, form, "submit");
    await settle();
    assert.match(
      h.document.querySelectorAll(".group-permission-row .field-error")[1]
        .textContent,
      /must be unique/i,
    );
    assert.equal(
      h.calls.some(
        ({ path, method }) =>
          path === "/api/admin/groups/3/permissions" && method === "PUT",
      ),
      false,
    );

    const secondPermission = h.document.getElementById(
      "group-permission-value-1",
    );
    secondPermission.value = "MANAGE_ROLES";
    emit(h, secondPermission, "change");
    emit(h, form, "submit");
    await settle();
    assert.deepEqual(
      h.calls.find(
        ({ path, method }) =>
          path === "/api/admin/groups/3/permissions" && method === "PUT",
      ).body,
      {
        permissions: [
          { userId: 1, permission: "MANAGE_GROUP" },
          { userId: 1, permission: "MANAGE_ROLES" },
        ],
      },
    );
  } finally {
    h.restore();
  }
});

test("group permissions recover when the user directory is temporarily unavailable", async () => {
  let unavailable = true;
  const h = await harness({
    response: (path) =>
      path.startsWith("/api/admin/users?") && unavailable
        ? { status: 503, kind: "server", body: null }
        : undefined,
  });
  try {
    await open(h, "permissions");
    assert.ok(h.document.querySelector('[data-action="retry"]'));
    assert.match(
      h.document.querySelector(".content").textContent,
      /operation could not be completed/i,
    );
    unavailable = false;
    await click(h, '[data-action="retry"]');
    assert.ok(
      h.document.querySelector('[data-form="native-group-permissions"]'),
    );
    assert.ok(h.calls.some(({ path }) => path.startsWith("/api/admin/users?")));
  } finally {
    h.restore();
  }
});

test("role mappings load sorted realm roles and save group response", async () => {
  const h = await harness();
  try {
    await open(h, "roles");
    assert.ok(h.document.querySelector(".group-role-card"));
    assert.ok(h.document.querySelector(".group-role-grid"));
    assert.ok(h.document.querySelector(".group-role-option input[value=\"ROLE_USER\"]"));
    assert.ok(
      h.calls.some(
        ({ path }) => path === "/api/admin/roles?page=0&size=100&sort=name,asc",
      ),
    );
    assert.equal(
      h.document.querySelector('input[value="ROLE_USER"]').checked,
      true,
    );
    const role = h.document.querySelector('input[value="ROLE_EDITOR"]');
    role.checked = true;
    emit(h, role, "change");
    emit(
      h,
      h.document.querySelector('[data-form="native-group-roles"]'),
      "submit",
    );
    await settle();
    assert.deepEqual(h.calls.find(({ method }) => method === "PUT").body, {
      roles: ["ROLE_USER", "ROLE_EDITOR"],
    });
    await click(h, '[data-action="group-tab"][data-id="details"]');
    await click(h, '[data-action="group-tab"][data-id="roles"]');
    assert.equal(
      h.document.querySelector('input[value="ROLE_EDITOR"]').checked,
      true,
    );
  } finally {
    h.restore();
  }
});

test("members debounce autocomplete, add, remove, filter, sort, size and link to user details", async () => {
  const h = await harness();
  try {
    await open(h, "members");
    assert.equal(
      h.document.querySelector('[data-action="group-member-add"]').disabled,
      true,
    );
    let query = h.document.getElementById("group-candidate-query");
    query.value = "g";
    emit(h, query);
    await delay();
    assert.equal(
      h.calls.some(({ path }) => path.includes("available-users")),
      false,
    );
    query = h.document.getElementById("group-candidate-query");
    query.value = "gr";
    emit(h, query);
    await delay();
    await settle();
    assert.ok(
      h.calls.some(
        ({ path }) =>
          path === "/api/admin/groups/3/available-users?q=gr&page=0&size=10",
      ),
    );
    await click(h, '[data-action="group-candidate-select"][data-id="4"]');
    await click(h, '[data-action="group-member-add"]');
    assert.equal(h.document.getElementById("group-candidate-query").value, "");
    assert.equal(
      h.document.querySelectorAll(".group-members-table tbody tr").length,
      2,
    );
    assert.ok(h.document.querySelector(".admin-user-status.is-disabled"));
    assert.match(
      h.document.querySelector(".admin-pagination-controls").textContent,
      /Page 1 \/ 1/,
    );
    const sort = h.document.getElementById("groupMember-sort");
    sort.value = "username,desc";
    emit(h, sort, "change");
    await settle();
    const size = h.document.getElementById("groupMember-size");
    size.value = "20";
    emit(h, size, "change");
    await settle();
    query = h.document.getElementById("groupMember-query");
    query.value = "ada";
    emit(h, query);
    await delay();
    await settle();
    assert.ok(
      h.calls.some(({ path }) =>
        path.includes("users?q=ada&page=0&size=20&sort=username%2Cdesc"),
      ),
    );
    await click(h, '[data-action="group-member-remove"][data-id="4"]');
    assert.ok(
      h.calls.some(
        ({ path, method }) =>
          path === "/api/admin/groups/3/users/4" && method === "DELETE",
      ),
    );
    assert.equal(
      h.document
        .querySelector('[data-action="group-user-open"]')
        .getAttribute("href"),
      "#/admin/users/1/details",
    );
    h.setResponse("/api/admin/users/1", "GET", () => ({
      ...users[0],
      createdAt: "2026-01-01T00:00:00Z",
      authorities: [],
    }));
    await click(h, '[data-action="group-user-open"][data-id="1"]');
    assert.ok(h.calls.some(({ path }) => path === "/api/admin/users/1"));
    h.dom.window.history.back();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await settle();
    assert.equal(
      h.document.querySelector('[role="tab"][aria-selected="true"]')
        .textContent,
      "Members",
    );
  } finally {
    h.restore();
  }
});

test("group tabs and member suggestions support keyboard navigation", async () => {
  const h = await harness();
  try {
    await open(h);
    const detailsTab = h.document.querySelector(
      '[data-action="group-tab"][data-id="details"]',
    );
    detailsTab.dispatchEvent(
      new h.dom.window.KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    assert.equal(
      h.document.querySelector('[role="tab"][aria-selected="true"]')
        .textContent,
      "Permissions",
    );
    for (const [key, expectedTab] of [
      ["Home", "Settings"],
      ["End", "Members"],
      ["ArrowLeft", "Role mappings"],
    ]) {
      const activeTab = h.document.querySelector(
        '[role="tab"][aria-selected="true"]',
      );
      activeTab.dispatchEvent(
        new h.dom.window.KeyboardEvent("keydown", {
          key,
          bubbles: true,
          cancelable: true,
        }),
      );
      await settle();
      assert.equal(
        h.document.querySelector('[role="tab"][aria-selected="true"]')
          .textContent,
        expectedTab,
      );
    }
    await click(h, '[data-action="group-tab"][data-id="members"]');

    const query = h.document.getElementById("group-candidate-query");
    query.value = "gr";
    emit(h, query);
    await delay();
    const activeQuery = h.document.getElementById("group-candidate-query");
    const arrowDown = new h.dom.window.KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    activeQuery.dispatchEvent(arrowDown);
    assert.equal(arrowDown.defaultPrevented, true);
    assert.equal(
      h.document.activeElement,
      h.document.querySelector('#group-candidates [role="option"]'),
    );

    const escape = new h.dom.window.KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    activeQuery.dispatchEvent(escape);
    await settle();
    assert.equal(
      h.document.querySelector('#group-candidates [role="option"]'),
      null,
    );
  } finally {
    h.restore();
  }
});

test("last row deletion returns to previous group and member pages", async () => {
  let removed = false;
  const h = await harness({
    response: (path, method) => {
      if (path === "/api/admin/groups/3" && method === "DELETE") {
        removed = true;
        return { status: 204 };
      }
      if (path.startsWith("/api/admin/groups?q=")) {
        const number = Number(
          new URL(path, "https://test.invalid").searchParams.get("page"),
        );
        return page([group], {
          number,
          totalElements: removed ? 10 : 11,
          totalPages: removed ? 1 : 2,
        });
      }
    },
  });
  try {
    await list(h);
    await click(h, '[data-action="group-page"][data-target="1"]');
    await click(h, '[data-action="group-delete-request"]');
    await click(h, '[data-action="group-delete-confirm"]');
    assert.match(
      h.document.querySelector(".admin-pagination-controls").textContent,
      /Page 1 \/ 1/,
    );
    await click(h, '[data-action="group-open"]');
    await click(h, '[data-action="group-tab"][data-id="members"]');
    let memberRemoved = false;
    h.setResponse(
      "/api/admin/groups/3/users?q=&page=0&size=10&sort=username%2Casc",
      "GET",
      () =>
        page([users[0]], {
          totalElements: memberRemoved ? 10 : 11,
          totalPages: memberRemoved ? 1 : 2,
        }),
    );
    h.setResponse(
      "/api/admin/groups/3/users?q=&page=1&size=10&sort=username%2Casc",
      "GET",
      () => page([users[1]], { number: 1, totalElements: 11, totalPages: 2 }),
    );
    await click(h, '[data-action="group-tab"][data-id="roles"]');
    await click(h, '[data-action="group-tab"][data-id="members"]');
    await click(h, '[data-action="group-page"][data-target="1"]');
    h.setResponse("/api/admin/groups/3/users/4", "DELETE", () => {
      memberRemoved = true;
      return { status: 204 };
    });
    await click(h, '[data-action="group-member-remove"][data-id="4"]');
    assert.match(
      h.document.querySelector(".admin-pagination-controls").textContent,
      /Page 1 \/ 1/,
    );
  } finally {
    h.restore();
  }
});

for (const variant of ["viewer", "manageRoles", "isAdmin"])
  test(`group authorization separates ${variant} from user management`, async () => {
    const h = await harness();
    try {
      await settle();
      const accessResponse = await h.api.api.request({
        path: "/api/admin/whoami",
      });
      const access = Object.fromEntries(
        Object.keys(accessResponse.body.access).map((key) => [key, false]),
      );
      Object.assign(access, {
        queryGroups: true,
        viewGroups: true,
        viewRoles: true,
        ...(variant === "viewer" ? {} : { [variant]: true }),
      });
      h.setResponse("/api/admin/whoami", "GET", () => ({ access }));
      h.callbacks.auth({});
      await settle();
      await list(h);
      assert.equal(
        h.document.querySelector('[data-action="create-group"]'),
        null,
      );
      assert.equal(
        h.document.querySelector('[data-action="group-delete-request"]'),
        null,
      );
      await click(h, '[data-action="group-open"]');
      assert.equal(h.document.getElementById("group-name").disabled, true);
      emit(
        h,
        h.document.querySelector('[data-form="native-group-settings"]'),
        "submit",
      );
      await settle();
      await click(h, '[data-action="group-tab"][data-id="roles"]');
      assert.equal(
        h.document.querySelector('input[name="roles"]').disabled,
        variant !== "manageRoles",
      );
      await click(h, '[data-action="group-tab"][data-id="permissions"]');
      assert.equal(
        Boolean(
          h.document.querySelector('[data-action="group-permission-add"]'),
        ),
        variant === "isAdmin",
      );
      await click(h, '[data-action="group-tab"][data-id="members"]');
      assert.equal(
        h.document.querySelector('[data-action="group-member-add"]'),
        null,
      );
      assert.equal(
        h.calls.some(({ method }) =>
          ["PUT", "POST", "DELETE"].includes(method),
        ),
        false,
      );
    } finally {
      h.restore();
    }
  });

test("mutation preserves label, shows spinner, blocks repeated submit and restores icon", async () => {
  const h = await harness();
  let complete;
  try {
    await open(h);
    h.setResponse(
      "/api/admin/groups/3",
      "PUT",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const input = h.document.getElementById("group-name");
    input.value = "Updated";
    emit(h, input);
    emit(
      h,
      h.document.querySelector('[data-form="native-group-settings"]'),
      "submit",
    );
    await settle();
    const submit = h.document.querySelector(
      '[data-form="native-group-settings"] button[type="submit"]',
    );
    assert.equal(submit.textContent, "Save");
    assert.equal(submit.disabled, true);
    assert.ok(submit.querySelector(".spinner"));
    emit(
      h,
      h.document.querySelector('[data-form="native-group-settings"]'),
      "submit",
    );
    await settle();
    assert.equal(h.calls.filter(({ method }) => method === "PUT").length, 1);
    complete({ ...group, name: "Updated" });
    await settle();
    assert.equal(
      h.document.querySelector('[data-form="native-group-settings"] .spinner'),
      null,
    );
    assert.ok(
      h.document.querySelector(
        '[data-form="native-group-settings"] button svg',
      ),
    );
  } finally {
    h.restore();
  }
});

test("deep link hydrates active tab, locale and theme after reload", async () => {
  const h = await harness({
    hash: "#/admin/groups/3/roles",
    locale: "tr",
    theme: "dark",
  });
  try {
    await settle();
    assert.equal(
      h.document.querySelector('[role="tab"][aria-selected="true"]')
        .textContent,
      "Rol eşlemeleri",
    );
    h.callbacks.auth({});
    await settle();
    assert.equal(h.dom.window.location.hash, "#/admin/groups/3/roles");
    assert.equal(h.document.documentElement.dataset.theme, "dark");
  } finally {
    h.restore();
  }
});

test("group member deep links clamp invalid pagination and restore the member sort", async () => {
  const h = await harness({
    hash: "#/admin/groups/3/members?page=1000001&size=25&sort=name,asc&q=ada",
  });
  try {
    await settle();
    assert.equal(h.document.getElementById("groupMember-size").value, "10");
    assert.equal(h.document.getElementById("groupMember-sort").value, "username,asc");
    assert.ok(
      h.calls.some(
        ({ path }) =>
          path ===
          "/api/admin/groups/3/users?q=ada&page=0&size=10&sort=username%2Casc",
      ),
    );
  } finally {
    h.restore();
  }
});

test("stale autocomplete responses cannot overwrite newer query or tab", async () => {
  const h = await harness();
  let complete;
  try {
    await open(h, "members");
    h.setResponse(
      "/api/admin/groups/3/available-users?q=ad&page=0&size=10",
      "GET",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    let query = h.document.getElementById("group-candidate-query");
    query.value = "ad";
    emit(h, query);
    await delay();
    query = h.document.getElementById("group-candidate-query");
    query.value = "gr";
    emit(h, query);
    await delay();
    await settle();
    complete(page([users[0]]));
    await settle();
    assert.equal(
      h.document.querySelector('[role="option"]').textContent,
      "grace",
    );
    await click(h, '[data-action="group-tab"][data-id="details"]');
    assert.equal(h.document.getElementById("group-candidates"), null);
  } finally {
    h.restore();
  }
});

test("group loading, empty, retry and offline states keep the same hierarchy", async () => {
  let complete;
  const h = await harness();
  try {
    await settle();
    const route = "/api/admin/groups?q=&page=0&size=10&sort=name%2Casc";
    h.setResponse(
      route,
      "GET",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    h.document.querySelector('[data-route="groups"]').click();
    await settle();
    assert.ok(h.document.querySelector(".loading .spinner"));
    assert.equal(h.document.querySelector(".group-table"), null);
    complete(page([]));
    await settle();
    assert.ok(h.document.querySelector(".group-table .empty"));
    assert.match(
      h.document.querySelector(".admin-pagination-controls").textContent,
      /Page 1 \/ 1/,
    );
    h.setResponse(route, "GET", () => ({
      status: 503,
      body: { detail: "Unavailable" },
    }));
    await click(h, '[data-route="groups"]');
    assert.ok(h.document.querySelector('.notice.error [data-action="retry"]'));
    h.setResponse(route, "GET", () => page([group]));
    await click(h, '[data-action="retry"]');
    assert.ok(h.document.querySelector('[data-action="group-open"]'));
    h.dom.window.dispatchEvent(new h.dom.window.Event("offline"));
    await settle();
    assert.ok(h.document.querySelector(".notice.warning"));
    assert.equal(
      h.document.querySelector('[data-action="create-group"]').disabled,
      true,
    );
    assert.equal(
      h.document.querySelector('[data-action="group-delete-request"]').disabled,
      true,
    );
  } finally {
    h.restore();
  }
});

test("all group copy keys exist in English and Turkish", async () => {
  const { readFile } = await import("node:fs/promises");
  const { userMessages } = await import("../src/native/user-messages.mjs");
  const source = await readFile(
    new URL("../src/native/groups.mjs", import.meta.url),
    "utf8",
  );
  const keys = [...source.matchAll(/copy\("([^"]+)"\)/g)].map(
    (match) => `adminGroup${match[1]}`,
  );
  for (const locale of ["en", "tr"])
    for (const key of keys)
      assert.ok(userMessages[locale][key], `${locale} ${key}`);
  assert.equal(
    userMessages.tr.adminGroupDefault,
    "Yeni kullanıcıları varsayılan olarak bu gruba ekle",
  );
});
