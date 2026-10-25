import assert from "node:assert/strict";
import test from "node:test";
import { messages } from "../../shared/dist/catalog.js";
import { desktopIconMetadata } from "../../shared/dist/icons.js";
import { userMessages } from "../src/native/user-messages.mjs";
import {
  createOrganizationScreens,
  organizationPage,
} from "../src/native/organizations.mjs";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const organization = {
  id: 8,
  alias: "acme",
  name: "Acme Corporation",
  displayName: "Acme",
  enabled: true,
  memberCount: 12,
  domainCount: 2,
  groupCount: 4,
};
const catalogs = {
  en: { ...messages.en.native, ...userMessages.en },
  tr: { ...messages.tr.native, ...userMessages.tr },
};
const hMessages = Object.fromEntries(
  Object.entries(catalogs).map(([locale, catalog]) => [locale, catalog]),
);
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
const click = async (h, selector) => {
  const element = h.document.querySelector(selector);
  assert.ok(element, selector);
  element.click();
  await settle();
};
const submitDetailForm = async (h, kind, values) => {
  const form = h.document.querySelector(`[data-organization-form="${kind}"]`);
  assert.ok(form, kind);
  for (const [name, value] of Object.entries(values)) {
    const control = form.querySelector(`[name="${name}"]`);
    assert.ok(control, `${kind}.${name}`);
    control.value = value;
    control.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
  }
  form.dispatchEvent(
    new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await settle();
};
const organizationScreens = (state, options = {}) =>
  createOrganizationScreens({
    state,
    text: (key) => key,
    escapeHtml: (value) => String(value ?? ""),
    button: (label, attributes = {}) =>
      `<button data-action="${attributes.action ?? ""}">${label}</button>`,
    icon: (name) => `<i data-icon="${name}"></i>`,
    spin: (active) => (active ? '<span class="spinner"></span>' : ""),
    violations: (body) =>
      Object.fromEntries(
        (body?.violations ?? [])
          .filter((item) => item?.field && item?.message)
          .map((item) => [item.field, item.message]),
      ),
    render: () => {},
    request: options.request ?? (async () => ({})),
    loadRoute: options.loadRoute ?? (async () => {}),
  });
const harness = (options = {}) =>
  renderConsole("admin", {
    icons: desktopIconMetadata,
    messages: hMessages,
    hash: options.hash,
    response: (path, method, body) => {
      const customized = options.response?.(path, method, body);
      if (customized !== undefined) return customized;
      if (path.startsWith("/api/admin/organizations?") && method === "GET")
        return page([organization], {
          size: Number(
            new URL(path, "https://test.invalid").searchParams.get("size"),
          ),
          totalElements: 21,
          totalPages: 3,
          number: Number(
            new URL(path, "https://test.invalid").searchParams.get("page"),
          ),
        });
      if (
        /^\/api\/admin\/organizations\/[1-9]\d*$/.test(path) &&
        method === "GET"
      )
        return { ...organization, id: Number(path.split("/").at(-1)) };
      if (
        /\/organizations\/[1-9]\d*\/(members|invitations|groups)\?/.test(path)
      )
        return page([]);
      if (
        /\/organizations\/[1-9]\d*\/(domains|claims|identity-providers)$/.test(
          path,
        )
      )
        return [];
      if (path === "/api/admin/organizations" && method === "POST")
        return { id: 42, ...body };
      return undefined;
    },
  });

test("organization page normalizes Spring page metadata safely", () => {
  assert.deepEqual(
    organizationPage(
      page([organization], { number: 1, totalPages: 2, totalElements: 11 }),
    ),
    {
      content: [organization],
      size: 10,
      number: 1,
      totalPages: 2,
      totalElements: 11,
    },
  );
  assert.deepEqual(organizationPage({ content: "invalid", page: {} }), {
    content: [],
    size: 10,
    number: 0,
    totalElements: 0,
    totalPages: 0,
  });
});

test("organization detail renders every collection and both manage-access states", () => {
  const state = {
    route: "organization-detail",
    offline: false,
    busy: null,
    data: {
      adminAccess: { manageOrganizations: true },
      organizationDetail: organization,
      organizationMembers: [{ userId: 1, username: null, role: null }],
      organizationDomains: [
        { id: 2, domain: null, verified: false },
        { id: 3, domain: "verified.example", verified: true },
      ],
      organizationInvitations: [
        { email: null, role: null, revokedAt: "2026-01-01" },
        { email: "member@example.test", role: "MEMBER" },
      ],
      organizationGroups: [
        { name: null, memberCount: null },
        { name: "Operators", memberCount: 4 },
      ],
      organizationClaims: [{ claimName: null, claimValue: null }],
      organizationProviders: [
        { providerAlias: "google", enabled: true },
        { displayName: "GitHub", enabled: false },
        {},
      ],
    },
  };
  const screen = organizationScreens(state);
  const detail = screen.detail();
  assert.match(detail, /adminOrganizationVerify/);
  assert.match(detail, /adminOrganizationRemoveMember/);
  assert.match(detail, /adminOrganizationRevoked/);
  assert.match(detail, /verified\.example/);
  assert.match(detail, /Operators/);
  assert.match(detail, /google/);
  assert.match(detail, /GitHub/);
  assert.match(detail, /✓/);
  assert.match(detail, /—/);

  state.data.adminAccess = { queryOrganizations: true };
  const viewOnlyDetail = screen.detail();
  assert.doesNotMatch(viewOnlyDetail, /data-organization-form=/);
  assert.doesNotMatch(viewOnlyDetail, /organization-domain-verify/);
  assert.doesNotMatch(viewOnlyDetail, /organization-member-remove/);
});

test("organization loading handles invalid identifiers, request errors, and stale results", async () => {
  const invalidState = {
    route: "organization-detail",
    offline: false,
    busy: null,
    data: { organizationDetailId: 0 },
  };
  await organizationScreens(invalidState).load();
  assert.equal(invalidState.data.organizationDetailLoadError, true);

  const failedState = {
    route: "organization-detail",
    offline: false,
    busy: null,
    data: { organizationDetailId: 8, organizationDetail: organization },
  };
  await organizationScreens(failedState, {
    request: async () => {
      throw new Error("request failed");
    },
  }).load();
  assert.equal(failedState.data.organizationDetail, null);
  assert.equal(failedState.data.organizationDetailLoadError, true);

  let resolveList;
  const staleState = {
    route: "organizations",
    offline: false,
    busy: null,
    data: { organizations: { content: [organization] } },
  };
  const pendingLoad = organizationScreens(staleState, {
    request: () =>
      new Promise((resolve) => {
        resolveList = resolve;
      }),
  }).load();
  staleState.route = "organization-detail";
  resolveList(page([{ ...organization, id: 9 }]));
  await pendingLoad;
  assert.equal(staleState.data.organizations.content[0].id, 8);
});

test("organization routes restore bounded query state and support browser history", async () => {
  const h = await harness({
    hash: "#/admin/organizations?page=-1&size=999&sort=alias%2Casc&q=acme",
  });
  try {
    await settle();
    assert.ok(
      h.document.querySelector('[data-route="organizations"]'),
      `${h.document.defaultView.location.href} :: ${h.document.body.textContent}`,
    );
    assert.equal(
      h.document.getElementById("organization-query")?.value,
      "acme",
      `${h.document.defaultView.location.href} :: ${h.document.body.textContent}`,
    );
    assert.equal(
      h.document.getElementById("organization-sort").value,
      "name,asc",
    );
    assert.match(
      h.calls.find((call) => call.path.startsWith("/api/admin/organizations?"))
        .path,
      /page=0&size=10&sort=name%2Casc/,
    );

    h.dom.window.location.hash = "#/admin/organizations/new";
    h.dom.window.dispatchEvent(new h.dom.window.PopStateEvent("popstate"));
    await settle();
    assert.ok(h.document.querySelector('[data-form="organization-create"]'));
    assert.ok(h.document.querySelector(".organization-breadcrumb"));

    h.dom.window.history.pushState(null, "", "#/admin/organizations/8");
    h.dom.window.dispatchEvent(new h.dom.window.PopStateEvent("popstate"));
    await settle();
    assert.equal(
      h.document.defaultView.location.hash,
      "#/admin/organizations/8",
    );
    assert.match(h.document.querySelector("h1").textContent, /Acme/);

    h.dom.window.history.pushState(null, "", "#/admin/organizations/07");
    h.dom.window.dispatchEvent(new h.dom.window.PopStateEvent("popstate"));
    await settle();
    assert.equal(
      h.document.defaultView.location.hash,
      "#/admin/organizations/07",
    );
  } finally {
    h.restore();
  }
});

test("organization list filters, sorts, changes page size, and clears filters", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    const query = h.document.getElementById("organization-query");
    query.value = "acme";
    h.document
      .getElementById("organization-search")
      .dispatchEvent(
        new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await settle();
    assert.ok(h.document.querySelector(".group-active-filter"));
    assert.ok(h.calls.some((call) => /q=acme/.test(call.path)));

    const sort = h.document.getElementById("organization-sort");
    sort.value = "name,desc";
    sort.dispatchEvent(new h.dom.window.Event("change", { bubbles: true }));
    await settle();
    assert.ok(h.calls.some((call) => /sort=name%2Cdesc/.test(call.path)));

    const size = h.document.getElementById("organization-size");
    size.value = "20";
    size.dispatchEvent(new h.dom.window.Event("change", { bubbles: true }));
    await settle();
    assert.ok(h.calls.some((call) => /size=20/.test(call.path)));

    await click(h, '[data-action="organization-page"][data-target="1"]');
    assert.ok(h.calls.some((call) => /page=1/.test(call.path)));
    await click(h, '[data-action="organization-clear"]');
    assert.equal(h.document.getElementById("organization-query").value, "");
    assert.ok(h.calls.some((call) => /q=&page=0/.test(call.path)));
  } finally {
    h.restore();
  }
});

test("all organization detail forms submit valid additions", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    for (const [kind, values, path] of [
      ["member", { userId: "3", role: "ADMIN" }, "/members"],
      ["domain", { domain: "example.test" }, "/domains"],
      [
        "invitation",
        { email: "member@example.test", role: "MEMBER" },
        "/invitations",
      ],
      ["group", { name: "Operators" }, "/groups"],
      ["claim", { claimName: "department", claimValue: "ops" }, "/claims"],
      ["provider", { providerAlias: "google" }, "/identity-providers"],
    ]) {
      await submitDetailForm(h, kind, values);
      assert.ok(
        h.calls.some(
          (call) =>
            call.method === "POST" &&
            call.path === `/api/admin/organizations/8${path}`,
        ),
        kind,
      );
    }
  } finally {
    h.restore();
  }
});

test("organization detail validation covers identifiers, formats, and field limits", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    for (const [kind, values, field] of [
      ["member", { userId: "0" }, "userId"],
      ["member", { userId: "2", role: "INVALID" }, "role"],
      ["domain", { domain: "x".repeat(256) }, "domain"],
      ["invitation", { email: "invalid", role: "MEMBER" }, "email"],
      ["invitation", { email: "a@example.test", role: "INVALID" }, "role"],
      ["group", { name: "x".repeat(101) }, "name"],
      ["claim", { claimName: "x".repeat(201), claimValue: "v" }, "claimName"],
      ["claim", { claimName: "x", claimValue: "v".repeat(2001) }, "claimValue"],
      ["provider", { providerAlias: "x".repeat(101) }, "providerAlias"],
    ]) {
      await submitDetailForm(h, kind, values);
      assert.ok(
        h.document.getElementById(`organization-detail-${field}-error`)
          .textContent,
        `${kind}.${field}`,
      );
    }
    assert.equal(h.calls.filter((call) => call.method === "POST").length, 0);
  } finally {
    h.restore();
  }
});

test("native organizations menu respects server access and renders list in English and Turkish", async () => {
  const h = await harness();
  try {
    await settle();
    assert.ok(h.document.querySelector('[data-route="organizations"]'));
    await click(h, '[data-route="organizations"]');
    assert.match(h.document.querySelector("h1").textContent, /Organizations/);
    assert.match(h.document.body.textContent, /Acme/);
    assert.match(h.document.body.textContent, /12/);
    assert.deepEqual(
      [...h.document.querySelectorAll(".organization-table thead th")].map(
        (heading) => heading.textContent.trim(),
      ),
      ["Name", "Alias", "Members", "Domains", "Groups", "Enabled", "Actions"],
    );
    assert.equal(
      h.document.querySelector('.organization-table [data-label="Enabled"]')
        .textContent,
      "✓",
    );
    assert.ok(
      h.document.querySelector(
        '.organization-row-menu [data-action="organization-open"][data-id="8"]',
      ),
    );
    const paginationControls = h.document.querySelector(
      ".organization-pagination .admin-pagination-controls",
    );
    assert.equal(paginationControls.children[0].tagName, "LABEL");
    assert.equal(paginationControls.children[1].id, "organization-size");
    assert.equal(
      paginationControls.children[2].dataset.action,
      "organization-page",
    );
    assert.match(
      h.document.querySelector("#organization-sort").value,
      /name,asc/,
    );
    assert.equal(
      h.calls.some((call) =>
        call.path.startsWith(
          "/api/admin/organizations?q=&page=0&size=10&sort=name%2Casc",
        ),
      ),
      true,
    );
    h.callbacks.language("tr");
    h.callbacks.theme("dark");
    assert.match(h.document.querySelector("h1").textContent, /Organizasyonlar/);
    assert.equal(h.document.documentElement.dataset.theme, "dark");
    h.callbacks.theme("light");
    assert.equal(h.document.documentElement.dataset.theme, "light");
  } finally {
    h.restore();
  }
});

test("organization row settings menu is localized and opens its detail page", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    const settings = h.document.querySelector(
      '.organization-row-menu [data-action="organization-open"][data-id="8"]',
    );
    assert.equal(settings.textContent.trim(), "Settings");
    h.callbacks.language("tr");
    assert.equal(
      h.document
        .querySelector(".organization-row-menu button")
        .textContent.trim(),
      "Ayarlar",
    );
    await click(h, ".organization-row-menu button");
    assert.equal(
      h.document.defaultView.location.hash,
      "#/admin/organizations/8",
    );
  } finally {
    h.restore();
  }
});

test("organization list renders disabled rows and falls back for missing values", async () => {
  const h = await harness({
    response: (path, method) => {
      if (path.startsWith("/api/admin/organizations?") && method === "GET")
        return page(
          [
            {
              id: 9,
              name: "Legacy organization",
              enabled: false,
              memberCount: null,
            },
            { id: 10, enabled: false },
          ],
          { totalElements: 2, totalPages: 1 },
        );
      return undefined;
    },
  });
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    const rows = h.document.querySelectorAll(".organization-table tbody tr");
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /Legacy organization/);
    assert.match(rows[0].textContent, /—/);
    assert.match(rows[1].textContent, /—/);
    assert.equal(
      rows[0].querySelector('[data-label="Enabled"]').textContent,
      "—",
    );
    assert.equal(
      rows[0].querySelector('[data-label="Members"]').textContent,
      "0",
    );
    assert.equal(rows[1].querySelector('[data-label="Name"]').textContent, "—");
  } finally {
    h.restore();
  }
});

test("native organization list opens the localized detail screen", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    assert.equal(
      h.document.defaultView.location.hash,
      "#/admin/organizations/8",
    );
    assert.match(h.document.querySelector("h1").textContent, /Acme/);
    assert.match(h.document.querySelector("h1").textContent, /Acme/);
    assert.match(h.document.querySelector(".topbar p").textContent, /acme/i);
    assert.match(h.document.body.textContent, /Identity providers/);
    assert.deepEqual(
      [...h.document.querySelectorAll(".organization-detail-section h2")].map(
        (heading) => heading.textContent,
      ),
      [
        "Members",
        "Domains",
        "Invitations",
        "Groups",
        "Claims",
        "Identity providers",
      ],
    );
    assert.equal(
      h.document.querySelectorAll(".organization-detail-grid").length,
      1,
    );
    assert.ok(h.document.querySelector('[data-organization-form="member"]'));
    assert.ok(h.document.querySelector('[data-organization-form="claim"]'));
    for (const path of [
      "/api/admin/organizations/8/members?page=0&size=20&sort=user.username,asc",
      "/api/admin/organizations/8/domains",
      "/api/admin/organizations/8/invitations?page=0&size=20&sort=createdAt,desc",
      "/api/admin/organizations/8/groups?page=0&size=20&sort=name,asc",
      "/api/admin/organizations/8/claims",
      "/api/admin/organizations/8/identity-providers",
    ])
      assert.ok(
        h.calls.some((call) => call.path === path),
        path,
      );
    assert.ok(
      h.calls.some((call) => call.path === "/api/admin/organizations/8"),
    );
    h.callbacks.language("tr");
    assert.match(h.document.body.textContent, /Kimlik sağlayıcıları/);
  } finally {
    h.restore();
  }
});

test("native organization detail submits validated additions through the matching backend contracts", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    const invalidGroup = h.document.querySelector(
      '[data-organization-form="group"]',
    );
    invalidGroup.dispatchEvent(
      new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.match(
      h.document.getElementById("organization-detail-name-error").textContent,
      /required/i,
    );
    assert.equal(
      h.calls.some(
        (call) => call.method === "POST" && call.path.endsWith("/groups"),
      ),
      false,
    );

    const groupName = h.document.querySelector(
      '[data-organization-form="group"] input[name="name"]',
    );
    groupName.value = "Operators";
    groupName.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    h.document
      .querySelector('[data-organization-form="group"]')
      .dispatchEvent(
        new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await settle();
    assert.deepEqual(
      h.calls.find(
        (call) =>
          call.method === "POST" &&
          call.path === "/api/admin/organizations/8/groups",
      ).body,
      { name: "Operators" },
    );
  } finally {
    h.restore();
  }
});

test("native organization mutation shows inline progress and blocks duplicate submits", async () => {
  let resolveMutation;
  const mutationResult = new Promise((resolve) => {
    resolveMutation = resolve;
  });
  const h = await harness({
    response: (path, method) =>
      method === "POST" && path.endsWith("/groups")
        ? mutationResult
        : undefined,
  });
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    const form = h.document.querySelector('[data-organization-form="group"]');
    const name = form.querySelector('input[name="name"]');
    name.value = "Operators";
    name.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    form.dispatchEvent(
      new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const busyForm = h.document.querySelector(
      '[data-organization-form="group"]',
    );
    const submit = busyForm.querySelector('button[type="submit"]');
    assert.equal(submit.disabled, true);
    assert.ok(submit.querySelector(".spinner"));
    busyForm.dispatchEvent(
      new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      h.calls.filter(
        (call) => call.method === "POST" && call.path.endsWith("/groups"),
      ).length,
      1,
    );
    resolveMutation({ id: 2, name: "Operators", memberCount: 0 });
    await settle();
  } finally {
    resolveMutation?.({ id: 2, name: "Operators", memberCount: 0 });
    h.restore();
  }
});

test("organization creation validates locally and submits only the existing DTO fields", async () => {
  const h = await harness();
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="create-organization"]');
    let form = h.document.querySelector('[data-form="organization-create"]');
    assert.ok(form);
    assert.equal(
      h.document.defaultView.location.hash,
      "#/admin/organizations/new",
    );
    assert.ok(h.document.querySelector(".organization-breadcrumb"));
    assert.match(
      h.document.querySelector("h1").textContent,
      /Create organization/,
    );
    assert.equal(h.document.getElementById("organization-description").rows, 3);
    assert.ok(
      h.document.querySelector(
        "label.organization-enabled.admin-user-detail-switch",
      ),
    );
    h.callbacks.language("tr");
    assert.equal(
      h.document.querySelector('label[for="organization-alias"]').textContent,
      "Takma ad",
    );
    assert.equal(
      h.document.querySelector('label[for="organization-name"]').textContent,
      "Ad",
    );
    assert.match(
      h.document.querySelector(".organization-cancel-button").textContent,
      /İptal/,
    );
    h.callbacks.language("en");
    form = h.document.querySelector('[data-form="organization-create"]');
    h.document.getElementById("organization-alias").value = "Bad Alias";
    h.document.getElementById("organization-name").value = "Acme";
    form.dispatchEvent(
      new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.match(
      h.document.getElementById("organization-alias-error").textContent,
      /lowercase|küçük harf/i,
    );
    assert.equal(
      h.calls.some(
        (call) =>
          call.method === "POST" && call.path === "/api/admin/organizations",
      ),
      false,
    );

    h.document.getElementById("organization-alias").value = "acme";
    h.document
      .getElementById("organization-alias")
      .dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    form = h.document.querySelector('[data-form="organization-create"]');
    form.dispatchEvent(
      new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    const create = h.calls.find(
      (call) =>
        call.method === "POST" && call.path === "/api/admin/organizations",
    );
    assert.deepEqual(create.body, {
      alias: "acme",
      name: "Acme",
      displayName: "",
      description: "",
      enabled: true,
    });
    assert.match(h.document.body.textContent, /Organization created/);
  } finally {
    h.restore();
  }
});

test("organization route shows the localized forbidden state and does not retry automatically", async () => {
  const h = await harness({
    response: (path) =>
      path.startsWith("/api/admin/organizations?")
        ? { status: 403, kind: "forbidden", body: { detail: "Forbidden" } }
        : undefined,
  });
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    assert.match(h.document.body.textContent, /could not load organizations/i);
    assert.ok(h.document.querySelector('[data-action="organization-retry"]'));
    assert.equal(
      h.calls.filter((call) =>
        call.path.startsWith("/api/admin/organizations?"),
      ).length,
      1,
    );
  } finally {
    h.restore();
  }
});

test("organization create and detail mutations show backend validation and generic errors", async () => {
  const h = await harness({
    response: (path, method) => {
      if (path === "/api/admin/organizations" && method === "POST")
        return {
          status: 400,
          kind: "validation",
          body: { violations: [{ field: "alias", message: "Alias exists" }] },
        };
      if (path.endsWith("/groups") && method === "POST")
        return {
          status: 400,
          kind: "validation",
          body: { violations: [{ field: "name", message: "Group exists" }] },
        };
      if (path.endsWith("/claims") && method === "POST")
        return { status: 500, kind: "server_error", body: {} };
      return undefined;
    },
  });
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="create-organization"]');
    for (const [name, value] of Object.entries({ alias: "acme", name: "Acme" }))
      h.document.querySelector(`[name="${name}"]`).value = value;
    h.document
      .querySelector('[data-form="organization-create"]')
      .dispatchEvent(
        new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await settle();
    assert.equal(
      h.document.getElementById("organization-alias-error").textContent,
      "Alias exists",
    );

    await click(h, '[data-action="organization-cancel"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    await submitDetailForm(h, "group", { name: "Operators" });
    assert.equal(
      h.document.getElementById("organization-detail-name-error").textContent,
      "Group exists",
    );
    await submitDetailForm(h, "claim", {
      claimName: "department",
      claimValue: "ops",
    });
    assert.match(h.document.body.textContent, /could not be completed|error/i);
  } finally {
    h.restore();
  }
});

test("organization detail supports retry, cancel, member removal, and domain verification", async () => {
  let failDetail = true;
  const h = await harness({
    response: (path, method) => {
      if (
        path === "/api/admin/organizations/8" &&
        method === "GET" &&
        failDetail
      ) {
        failDetail = false;
        return { status: 500, kind: "server_error", body: {} };
      }
      if (
        path ===
        "/api/admin/organizations/8/members?page=0&size=20&sort=user.username,asc"
      )
        return page([{ userId: 3, username: "ada", role: "MEMBER" }], {
          size: 20,
        });
      if (path === "/api/admin/organizations/8/domains")
        return [{ id: 5, domain: "example.test", verified: false }];
      return undefined;
    },
  });
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="organization-open"][data-id="8"]');
    assert.ok(h.document.querySelector('[data-action="organization-retry"]'));
    await click(h, '[data-action="organization-retry"]');
    assert.ok(h.document.querySelector('[data-organization-form="member"]'));
    await click(h, '[data-action="organization-member-remove"][data-id="3"]');
    await click(h, '[data-action="organization-domain-verify"][data-id="5"]');
    assert.ok(
      h.calls.some(
        (call) => call.method === "DELETE" && call.path.endsWith("/members/3"),
      ),
    );
    assert.ok(
      h.calls.some(
        (call) =>
          call.method === "POST" && call.path.endsWith("/domains/5/verify"),
      ),
    );
    await click(h, '[data-action="organization-cancel"]');
    assert.ok(h.document.querySelector('[data-route="organizations"]'));
  } finally {
    h.restore();
  }
});

test("organization search debounce honors composition, session, offline and pending states", async () => {
  const h = await harness();
  try {
    const root =
      h.document.implementation.createHTMLDocument("isolated search");
    root.body.innerHTML =
      '<form id="organization-search"><input id="organization-query" name="q"></form>';
    const state = {
      console: "admin",
      route: "organizations",
      session: {},
      offline: false,
      busy: null,
      data: {},
    };
    const requested = [];
    const screen = organizationScreens(state, {
      loadRoute: async () => requested.push(state.data.organizationQuery),
    });
    screen.bind(root);
    const query = root.getElementById("organization-query");
    query.value = "ada";
    query.dispatchEvent(
      new h.dom.window.InputEvent("input", {
        bubbles: true,
        isComposing: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.deepEqual(requested, []);
    query.dispatchEvent(
      new h.dom.window.CompositionEvent("compositionend", { bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.deepEqual(requested, ["ada"]);

    state.data.organizationSearchDraft = "no-session";
    state.session = null;
    query.value = "no-session";
    query.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.deepEqual(requested, ["ada"]);

    state.session = {};
    state.offline = true;
    query.value = "offline";
    query.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    assert.deepEqual(requested, ["ada"]);

    state.offline = false;
    state.busy = "refresh";
    query.value = "busy-search";
    query.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 330));
    state.busy = null;
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.deepEqual(requested, ["ada", "busy-search"]);
  } finally {
    h.restore();
  }
});

test("organization create preserves disabled state and restores the URL while busy", async () => {
  let releaseCreate;
  const h = await harness({
    response: (path, method) => {
      if (path === "/api/admin/organizations" && method === "POST")
        return new Promise((resolve) => {
          releaseCreate = resolve;
        });
      return undefined;
    },
  });
  try {
    await settle();
    await click(h, '[data-route="organizations"]');
    await click(h, '[data-action="create-organization"]');
    const enabled = h.document.querySelector(
      '[data-form="organization-create"] input[name="enabled"]',
    );
    enabled.checked = false;
    enabled.dispatchEvent(new h.dom.window.Event("change", { bubbles: true }));
    for (const [name, value] of Object.entries({
      alias: "disabled-org",
      name: "Disabled org",
    }))
      h.document.querySelector(
        `[data-form="organization-create"] [name="${name}"]`,
      ).value = value;
    const submit = h.document.querySelector(
      '[data-form="organization-create"]',
    );
    submit.dispatchEvent(
      new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    assert.ok(releaseCreate);
    h.dom.window.history.pushState(null, "", "#/admin/organizations");
    h.dom.window.dispatchEvent(new h.dom.window.PopStateEvent("popstate"));
    assert.equal(h.dom.window.location.hash, "#/admin/organizations/new");
    releaseCreate({
      status: 200,
      body: {
        id: 42,
        alias: "disabled-org",
        name: "Disabled org",
        enabled: false,
      },
    });
    await settle();
    assert.equal(
      h.calls.find(
        (call) =>
          call.method === "POST" && call.path === "/api/admin/organizations",
      ).body.enabled,
      false,
    );
  } finally {
    releaseCreate?.({ status: 200, body: { id: 42 } });
    h.restore();
  }
});
