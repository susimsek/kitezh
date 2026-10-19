import assert from "node:assert/strict";
import test from "node:test";
import { messages } from "../../shared/dist/catalog.js";
import { desktopIconMetadata } from "../../shared/dist/icons.js";
import { userMessages } from "../src/native/user-messages.mjs";
import { organizationPage } from "../src/native/organizations.mjs";
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
const harness = (options = {}) =>
  renderConsole("admin", {
    icons: desktopIconMetadata,
    messages: hMessages,
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

test("native organizations menu respects server access and renders list in English and Turkish", async () => {
  const h = await harness();
  try {
    await settle();
    assert.ok(h.document.querySelector('[data-route="organizations"]'));
    await click(h, '[data-route="organizations"]');
    assert.match(h.document.querySelector("h1").textContent, /Organizations/);
    assert.match(h.document.body.textContent, /Acme/);
    assert.match(h.document.body.textContent, /12/);
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
