import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const require = createRequire(import.meta.url);
const { messages } = require("@kitezh/shared/i18n");
const { desktopIconMetadata } = require("@kitezh/shared/icons");
const scopes = [
  {
    id: "account-api",
    name: "account-api",
    displayName: "Account API",
    description: "Account information",
    builtIn: true,
    displayOnConsentScreen: false,
    consentScreenText: null,
    includeInTokenScope: true,
    groupMapperEnabled: true,
    groupClaimName: "groups",
    groupMapperFullPath: false,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  },
  {
    id: "user-read",
    name: "user.read",
    displayName: "Kullanıcı bilgileri",
    description: "Uzun Türkçe açıklama",
    builtIn: false,
    displayOnConsentScreen: true,
    consentScreenText: "İzin ver",
    includeInTokenScope: false,
    groupMapperEnabled: true,
    groupClaimName: "user_groups",
    groupMapperFullPath: false,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
  },
];
async function fixture({ manage = true, hash = "", response } = {}) {
  return renderConsole("admin", {
    locale: "tr",
    hash,
    messages,
    icons: desktopIconMetadata,
    response: async (path, method, body) => {
      const custom = await response?.(path, method, body);
      if (custom !== undefined) return custom;
      if (path === "/api/admin/whoami")
        return {
          access: {
            isAdmin: true,
            queryUsers: true,
            viewUsers: true,
            manageUsers: true,
            viewRoles: true,
            manageRoles: true,
            queryGroups: true,
            viewGroups: true,
            manageGroups: true,
            queryClients: true,
            viewClients: true,
            manageClients: manage,
            viewSessions: true,
            manageSessions: true,
            viewConsents: true,
            manageConsents: true,
            viewEvents: true,
            manageEvents: true,
            viewKeys: true,
            manageKeys: true,
          },
        };
      if (path.startsWith("/api/admin/client-scopes?"))
        return { content: scopes, number: 0, totalPages: 1, totalElements: 2 };
      if (/^\/api\/admin\/client-scopes\/[^/]+$/.test(path))
        return scopes.find((scope) => scope.id === path.split("/").at(-1));
      if (path.endsWith("/role-mappings"))
        return { applicationRoles: [], clientRoles: [] };
      if (
        path.includes("/role-mappings/application-roles?") ||
        path.includes("/role-mappings/client-roles?")
      )
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
      if (path.endsWith("/mappers?page=0&size=20&sort=name,asc"))
        return { content: [], number: 0, totalPages: 0, totalElements: 0 };
    },
  });
}
async function openList(harness) {
  await settle();
  harness.document.querySelector('[data-route="client-scopes"]').click();
  await settle();
}

test("scope list preserves four columns, technical names, badges and authorized row actions", async () => {
  const harness = await fixture();
  try {
    await openList(harness);
    const { document } = harness;
    assert.deepEqual(
      [...document.querySelectorAll(".scope-table th")].map(
        (cell) => cell.textContent,
      ),
      ["Ad", "Görünen ad", "Açıklama", "İşlemler"],
    );
    const builtIn = document.querySelector(
      '[data-client-scope-id="account-api"]',
    );
    assert.equal(builtIn.querySelector("a").textContent, "account-api");
    assert.equal(
      builtIn.querySelector(".client-badge").textContent,
      "Yerleşik",
    );
    assert.equal(builtIn.querySelectorAll("[data-action]").length, 2);
    assert.equal(
      builtIn.querySelector('[data-action="client-scope-edit"]'),
      null,
    );
    const custom = document.querySelector('[data-client-scope-id="user-read"]');
    assert.ok(custom.querySelector('[data-action="client-scope-edit"]'));
    assert.ok(
      custom.querySelector('[data-action="admin-client-scope-delete-request"]'),
    );
    assert.equal(
      document.querySelector('.topbar [data-action="logout"]'),
      null,
    );
    assert.ok(
      document.querySelector(
        '.sidebar-footer .secondary-button[data-action="logout"]',
      ),
    );
    assert.ok(document.querySelector('[data-route="client-scopes"] svg'));
    assert.equal(document.querySelector(".scope-table form"), null);
    assert.equal(document.querySelector(".brand-mark").textContent, "");
    assert.ok(
      document
        .querySelector(".topbar p")
        .textContent.includes("istemcilere atayın"),
    );
  } finally {
    harness.restore();
  }
});

test("read-only viewers see Details only and can open a built-in scope by keyboard link", async () => {
  const harness = await fixture({ manage: false });
  try {
    await openList(harness);
    const { document } = harness;
    assert.equal(
      document.querySelector('[data-action="create-client-scope"]'),
      null,
    );
    assert.equal(
      document.querySelector('[data-action="client-scope-edit"]'),
      null,
    );
    assert.equal(
      document.querySelector(
        '[data-action="admin-client-scope-delete-request"]',
      ),
      null,
    );
    document.querySelector('[data-client-scope-id="account-api"] a').click();
    await settle();
    assert.ok(
      document.querySelector('[data-client-scope-detail="account-api"]'),
    );
    assert.ok(
      document
        .querySelector('[data-client-scope-detail="account-api"]')
        .textContent.includes("Grup claim adı"),
    );
    assert.ok(
      document
        .querySelector('[data-client-scope-detail="account-api"]')
        .textContent.includes("Grup claim adı"),
    );
    assert.equal(
      document.querySelector('[data-form="admin-client-scope-edit"]'),
      null,
    );
    assert.ok(
      document.querySelector(
        '[data-action="admin-client-scope-role-mappings-toggle"]',
      ),
    );
    assert.ok(
      document.querySelector(
        '[data-action="admin-client-scope-mappers-toggle"]',
      ),
    );
    document
      .querySelector('[data-action="admin-client-scope-role-mappings-toggle"]')
      .click();
    await settle();
    const rolePanel = document.querySelector(
      '[data-client-scope-role-mappings-panel="true"]',
    );
    assert.ok(rolePanel);
    assert.equal(
      rolePanel.querySelector(
        '[data-action="admin-client-scope-role-mappings-save"]',
      ),
      null,
    );
    document
      .querySelector('[data-action="admin-client-scope-mappers-toggle"]')
      .click();
    await settle();
    assert.ok(
      document.querySelector(
        '[aria-label="Protocol mapper’lar"]',
      ),
    );
    assert.equal(
      document.querySelector(
        '[data-action="admin-client-scope-mapper-create"]',
      ),
      null,
    );
    assert.equal(
      document
        .querySelector('[data-route="client-scopes"]')
        .getAttribute("aria-current"),
      "page",
    );
    assert.equal(
      harness.dom.window.location.hash,
      "#/admin/client-scopes/account-api/details",
    );
  } finally {
    harness.restore();
  }
});

test("scope detail deep link loads independently and edit persists through the API", async () => {
  const harness = await fixture({
    hash: "#/admin/client-scopes/user-read/edit",
  });
  try {
    await settle();
    const { document } = harness;
    const form = document.querySelector(
      '[data-form="admin-client-scope-edit"]',
    );
    assert.ok(form);
    assert.equal(
      document.querySelector(".topbar p").textContent,
      "Kullanıcı bilgileri",
    );
    assert.ok(
      document.querySelector(
        '.topbar [data-action="admin-client-scope-delete-request"]',
      ),
    );
    assert.equal(
      document.querySelector(
        '[data-client-scope-detail] [data-action="admin-client-scope-delete-request"]',
      ),
      null,
    );
    form.elements.namedItem("name").value = "user.profile";
    form.elements.namedItem("displayName").value = "Yeni görünen ad";
    form.elements.namedItem("description").value = "Yeni açıklama";
    form.elements.namedItem("consentScreenText").value = "Profil erişimi";
    form.elements.namedItem("displayOnConsentScreen").checked = true;
    form.elements.namedItem("includeInTokenScope").checked = false;
    form.elements.namedItem("groupClaimName").value = "profile_groups";
    form.elements.namedItem("groupMapperEnabled").checked = true;
    form.elements.namedItem("groupMapperFullPath").checked = false;
    form.dispatchEvent(
      new harness.dom.window.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    const saved = harness.calls.find(
      (call) =>
        call.method === "PUT" &&
        call.path === "/api/admin/client-scopes/user-read",
    );
    assert.equal(saved.body.name, "user.profile");
    assert.equal(saved.body.displayName, "Yeni görünen ad");
    assert.equal(saved.body.description, "Yeni açıklama");
    assert.equal(saved.body.consentScreenText, "Profil erişimi");
    assert.equal(saved.body.displayOnConsentScreen, true);
    assert.equal(saved.body.includeInTokenScope, false);
    assert.equal(saved.body.groupMapperEnabled, true);
    assert.equal(saved.body.groupClaimName, "profile_groups");
    assert.equal(saved.body.groupMapperFullPath, false);
  } finally {
    harness.restore();
  }
});

test("search submits server sorting and pagination once while pending, preserving its label and spinner", async () => {
  let finish;
  const harness = await fixture({
    response: (path) => {
      if (path.includes("q=user"))
        return new Promise((resolve) => {
          finish = resolve;
        });
    },
  });
  try {
    await openList(harness);
    const { document } = harness;
    document.querySelector("#admin-client-scope-query").value = " user ";
    document.querySelector("#admin-client-scope-sort").value = "name,desc";
    const submit = () =>
      document.querySelector("#admin-client-scope-search").dispatchEvent(
        new harness.dom.window.Event("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    submit();
    await settle();
    const button = document.querySelector("#admin-client-scope-search button");
    assert.equal(button.disabled, true);
    assert.equal(button.textContent, "Ara");
    assert.ok(button.querySelector(".spinner"));
    submit();
    assert.equal(
      harness.calls.filter((call) => call.path.includes("q=user")).length,
      1,
    );
    assert.ok(
      harness.calls.some(
        (call) =>
          call.path.includes("sort=name%2Cdesc") &&
          call.path.includes("page=0") &&
          call.path.includes("size=20"),
      ),
    );
    finish({ content: scopes, number: 0, totalPages: 1, totalElements: 2 });
    await settle();
    assert.equal(
      document.querySelector("#admin-client-scope-search button").disabled,
      false,
    );
  } finally {
    harness.restore();
  }
});

test("custom scope deletion needs confirmation and then refreshes counts", async () => {
  const harness = await fixture();
  try {
    await openList(harness);
    const { document } = harness;
    document
      .querySelector('[data-action="admin-client-scope-delete-request"]')
      .click();
    await settle();
    assert.equal(
      harness.calls.filter((call) => call.method === "DELETE").length,
      0,
    );
    document
      .querySelector('[data-action="admin-client-scope-delete-confirm"]')
      .click();
    await settle();
    assert.ok(
      harness.calls.some(
        (call) =>
          call.method === "DELETE" &&
          call.path === "/api/admin/client-scopes/user-read",
      ),
    );
    assert.ok(
      harness.calls.filter((call) =>
        call.path.startsWith("/api/admin/client-scopes?"),
      ).length >= 2,
    );
  } finally {
    harness.restore();
  }
});
