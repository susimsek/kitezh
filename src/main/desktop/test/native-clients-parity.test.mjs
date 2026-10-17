import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const require = createRequire(import.meta.url);
const { messages } = require("@kitezh/shared/i18n");
const { desktopIconMetadata: icons } = require("@kitezh/shared/icons");
const client = {
  id: "account-console",
  clientId: "account-console",
  clientName: "Account Console",
  enabled: true,
  clientAuthenticationMethods: ["none"],
  authorizationGrantTypes: ["authorization_code", "refresh_token"],
  scopes: ["openid", "profile", "email", "account-api", "offline_access"],
  requireProofKey: true,
  requireDpop: false,
  dpopSigningAlgorithms: ["RS256", "ES256"],
  redirectUris: [
    "http://localhost:9090/account/callback",
    "https://client.example/callback",
  ],
  postLogoutRedirectUris: ["http://localhost:9090/", "https://client.example/"],
};
const page = (content, size = 10, number = 0, total = content.length) => ({
  content,
  page: {
    size,
    number,
    totalElements: total,
    totalPages: Math.ceil(total / size),
  },
});
const submit = (h, form) =>
  form.dispatchEvent(
    new h.dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
const change = (h, control, value) => {
  control.value = value;
  control.dispatchEvent(new h.dom.window.Event("change", { bubbles: true }));
};

async function setup(options = {}) {
  let stored = { ...client };
  const h = await renderConsole("admin", {
    messages,
    icons,
    response: (path, method, body) => {
      if (path.startsWith("/api/admin/clients?")) return page([stored]);
      if (path === "/api/admin/clients/account-console") {
        if (method === "PUT") stored = { ...stored, ...body };
        return stored;
      }
      if (
        /\/clients\/account-console\/(sessions|consents|events|mappers)\?/.test(
          path,
        )
      )
        return page([]);
      if (path.endsWith("/scope-assignments"))
        return {
          defaultScopes: ["openid"],
          optionalScopes: [],
          availableScopes: [{ name: "openid" }],
        };
      if (path.includes("/roles?")) return page([]);
      return undefined;
    },
    ...options,
  });
  await settle();
  h.document.querySelector('[data-route="clients"]').click();
  await settle();
  return h;
}
async function open(h) {
  h.document.querySelector('.client-name [data-action="client-open"]').click();
  await settle();
}
async function tab(h, name) {
  h.document
    .querySelector(`[data-action="client-tab"][data-id="${name}"]`)
    .click();
  await settle();
}

test("native clients reads Spring Page metadata, badges and compact actions", async () => {
  const h = await setup({ locale: "tr" });
  try {
    const table = h.document.querySelector(".client-table");
    assert.equal(table.querySelectorAll("th").length, 5);
    assert.match(table.textContent, /PKCE Açık/);
    assert.match(table.textContent, /DPoP Kapalı/);
    assert.match(table.textContent, /RS256\/ES256/);
    assert.match(table.textContent, /\+1/);
    assert.doesNotMatch(table.textContent, /Yapılandırıldı|Yerleşik/);
    assert.equal(table.querySelector(".client-row-actions > button"), null);
    assert.ok(table.querySelector(".client-menu summary"));
    assert.ok(
      table.querySelector(
        '.client-menu [data-action="client-open"] .button-icon',
      ),
    );
    assert.equal(
      table.querySelectorAll('[data-action="admin-client-delete-request"]')
        .length,
      0,
    );
    assert.equal(
      h.document.querySelectorAll(".admin-pagination-control").length,
      4,
    );
    assert.match(
      h.document.querySelector(".admin-users-pagination").textContent,
      /1–1\s*\/ 1.*Sayfa\s*1\s*\/ 1/s,
    );
    assert.equal(
      h.document.querySelector(".client-name button").textContent,
      "Account Console",
    );
    assert.ok(
      h.document.querySelector('[data-action="create-client"] .button-icon'),
    );
  } finally {
    h.restore();
  }
});

test("native clients sends bounded search, name sorting and page size; returning preserves filters", async () => {
  const h = await setup();
  try {
    const input = h.document.getElementById("admin-client-query");
    input.value = "account";
    input.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await settle();
    assert.ok(
      h.calls.some(({ path }) => {
        if (!path.startsWith("/api/admin/clients?")) return false;
        return new URL(path, "http://local").searchParams.get("q") === "account";
      }),
      "typing a client query should trigger the debounced search",
    );
    submit(h, h.document.getElementById("admin-client-search"));
    await settle();
    change(
      h,
      h.document.getElementById("admin-client-sort"),
      "clientName,desc",
    );
    await settle();
    change(h, h.document.querySelector('[data-client-size="list"]'), "50");
    await settle();
    const lastQuery = new URL(
      h.calls
        .filter((call) => call.path.startsWith("/api/admin/clients?"))
        .at(-1).path,
      "http://local",
    ).searchParams;
    assert.equal(lastQuery.get("sort"), "clientName,desc");
    assert.equal(lastQuery.get("q"), "account");
    assert.equal(lastQuery.get("page"), "0");
    assert.equal(lastQuery.get("size"), "50");
    await open(h);
    assert.match(h.dom.window.location.hash, /account-console\/settings$/);
    h.document.querySelector('[data-action="client-back"]').click();
    await settle();
    assert.equal(
      h.document.getElementById("admin-client-query").value,
      "account",
    );
    assert.equal(
      h.document.getElementById("admin-client-sort").value,
      "clientName,desc",
    );
    h.document.querySelector('[data-action="client-clear-search"]').click();
    await settle();
    assert.equal(h.document.getElementById("admin-client-query").value, "");
  } finally {
    h.restore();
  }
});

test("account-console has nine tabs, complete settings and a persisted save with spinner and duplicate protection", async () => {
  const h = await setup();
  let complete;
  try {
    await open(h);
    assert.equal(
      h.document.querySelectorAll('[data-action="client-tab"]').length,
      9,
    );
    assert.equal(
      h.document.querySelectorAll(".client-settings-section").length,
      3,
    );
    let form = h.document.querySelector(
      '[data-form="admin-client-configuration"]',
    );
    assert.equal(
      form.elements.redirectUris.value,
      client.redirectUris.join("\n"),
    );
    assert.equal(
      form.elements.postLogoutRedirectUris.value,
      client.postLogoutRedirectUris.join("\n"),
    );
    assert.equal(form.elements.enabled.checked, true);
    assert.equal(
      h.document.querySelector('[data-action="admin-client-delete-request"]'),
      null,
    );
    form.elements.clientName.value = "Updated account";
    h.setResponse(
      "/api/admin/clients/account-console",
      "PUT",
      ({ body }) =>
        new Promise((resolve) => {
          complete = () => resolve({ ...client, ...body });
        }),
    );
    submit(h, form);
    await settle();
    const busy = h.document.querySelector('button[type="submit"]');
    assert.equal(busy.textContent, "Save");
    assert.equal(busy.disabled, true);
    assert.ok(busy.querySelector(".spinner"));
    submit(
      h,
      h.document.querySelector('[data-form="admin-client-configuration"]'),
    );
    await settle();
    assert.equal(h.calls.filter((call) => call.method === "PUT").length, 1);
    complete();
    await settle();
    form = h.document.querySelector('[data-form="admin-client-configuration"]');
    assert.equal(form.elements.clientName.value, "Updated account");
    const saved = h.calls.find((call) => call.method === "PUT").body;
    assert.deepEqual(saved.dpopSigningAlgorithms, ["RS256", "ES256"]);
    assert.deepEqual(saved.redirectUris, client.redirectUris);
    assert.equal(saved.tokenEndpointAuthenticationSigningAlgorithm, null);
    h.setResponse("/api/admin/clients/account-console", "GET", () => ({
      ...client,
      ...saved,
    }));
    await tab(h, "credentials");
    await tab(h, "settings");
    assert.equal(
      h.document.querySelector('[name="clientName"]').value,
      "Updated account",
    );
    h.document.querySelector('[data-action="client-back"]').click();
    await settle();
    await open(h);
    assert.equal(
      h.document.querySelector('[name="clientName"]').value,
      "Updated account",
    );
  } finally {
    h.restore();
  }
});

test("client validation stays under its field, clears on edit and cancel restores persisted values", async () => {
  const h = await setup();
  try {
    await open(h);
    let form = h.document.querySelector(
      '[data-form="admin-client-configuration"]',
    );
    form.elements.clientName.value = "";
    submit(h, form);
    await settle();
    const control = h.document.querySelector('[name="clientName"]');
    assert.ok(
      control.closest(".field").querySelector(".field-error").textContent,
    );
    assert.equal(h.calls.filter((call) => call.method === "PUT").length, 0);
    control.value = "temporary";
    control.dispatchEvent(new h.dom.window.Event("input", { bubbles: true }));
    assert.equal(
      control.closest(".field").querySelector(".field-error").textContent,
      "",
    );
    h.document
      .querySelector('[data-action="admin-client-configuration-cancel"]')
      .click();
    await settle();
    assert.equal(
      h.document.querySelector('[name="clientName"]').value,
      client.clientName,
    );
  } finally {
    h.restore();
  }
});

test("client scoped tabs use selected registered ID and bounded requests; events obey viewEvents", async () => {
  const h = await setup();
  try {
    await open(h);
    for (const name of [
      "scopes",
      "roles",
      "mappers",
      "evaluation",
      "sessions",
      "consents",
      "events",
    ])
      await tab(h, name);
    for (const suffix of [
      "scope-assignments",
      "roles?",
      "mappers?",
      "sessions?",
      "consents?",
      "events?",
    ])
      assert.ok(
        h.calls.some((call) =>
          call.path.startsWith(`/api/admin/clients/account-console/${suffix}`),
        ),
        suffix,
      );
    change(h, h.document.querySelector('[data-client-size="events"]'), "50");
    await settle();
    assert.ok(
      h.calls.some(
        (call) =>
          call.path ===
          "/api/admin/clients/account-console/events?page=0&size=50",
      ),
    );
    await tab(h, "evaluation");
    h.setResponse(
      "/api/admin/clients/account-console/scope-evaluation?scopes=openid+profile&subject=ada",
      "GET",
      () => ({
        effectiveScopes: ["openid"],
        roles: ["ROLE_USER"],
        claims: { sub: "<script>" },
      }),
    );
    const form = h.document.querySelector('[data-form="client-evaluation"]');
    form.elements.scopes.value = "openid profile";
    form.elements.subject.value = "ada";
    submit(h, form);
    await settle();
    assert.match(
      h.document.querySelector(".client-facts").textContent,
      /ROLE_USER/,
    );
    assert.equal(h.document.querySelector(".client-facts script"), null);
  } finally {
    h.restore();
  }
  const limited = await setup();
  try {
    const original = await limited.api.api.request({
      path: "/api/admin/whoami",
    });
    limited.setResponse("/api/admin/whoami", "GET", () => ({
      access: {
        ...original.body.access,
        viewEvents: false,
        manageClients: false,
      },
    }));
    limited.callbacks.auth({});
    await settle();
    limited.document.querySelector('[data-route="clients"]').click();
    await settle();
    await open(limited);
    assert.equal(
      limited.document.querySelector(
        '[data-action="client-tab"][data-id="events"]',
      ),
      null,
    );
    assert.equal(
      limited.document.querySelector(
        '[data-form="admin-client-configuration"] button[type="submit"]',
      ),
      null,
    );
    assert.ok(
      limited.document.querySelector("fieldset.client-readonly[disabled]"),
    );
  } finally {
    limited.restore();
  }
});

test("admin-console stays read only and a failing detail load shows the API error", async () => {
  const h = await setup();
  try {
    h.setResponse("/api/admin/clients/account-console", "GET", () => ({
      ...client,
      clientId: "admin-console",
    }));
    await open(h);
    assert.ok(h.document.querySelector("fieldset.client-readonly[disabled]"));
    assert.equal(
      h.document.querySelector(
        '[data-form="admin-client-configuration"] button[type="submit"]',
      ),
      null,
    );
    await tab(h, "credentials");
    assert.equal(
      h.document.querySelector(
        '[data-action="client-operation-request"][data-id="secret"]',
      ),
      null,
    );
    await tab(h, "settings");
    assert.equal(
      h.document.querySelector('[name="clientName"]').value,
      client.clientName,
    );
    assert.equal(
      h.document.querySelector('[name="redirectUris"]').value,
      client.redirectUris.join("\n"),
    );
    h.document.querySelector('[data-action="client-back"]').click();
    await settle();
    h.setResponse("/api/admin/clients/account-console", "GET", () => ({
      status: 500,
      kind: "server",
      body: { detail: "Unavailable" },
    }));
    await open(h);
    assert.ok(h.document.querySelector('[role="alert"]'));
  } finally {
    h.restore();
  }
});

test("client session termination confirms, blocks duplicates, reloads and cancels without writes", async () => {
  const h = await setup();
  let complete;
  try {
    h.setResponse(
      "/api/admin/clients/account-console/sessions?page=0&size=10",
      "GET",
      () => page([{ id: "session-1", username: "ada", authorizationCount: 1 }]),
    );
    await open(h);
    await tab(h, "sessions");
    h.document
      .querySelector(
        '[data-action="client-operation-request"][data-id="sessions:0"]',
      )
      .click();
    h.document.querySelector('[data-action="client-operation-cancel"]').click();
    assert.equal(
      h.calls.some((call) => call.method === "DELETE"),
      false,
    );
    h.setResponse(
      "/api/admin/clients/account-console/sessions/session-1",
      "DELETE",
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    h.document
      .querySelector(
        '[data-action="client-operation-request"][data-id="sessions:0"]',
      )
      .click();
    h.document
      .querySelector('[data-action="client-operation-confirm"]')
      .click();
    await settle();
    const confirm = h.document.querySelector(
      '[data-action="client-operation-confirm"]',
    );
    assert.equal(confirm.disabled, true);
    assert.ok(confirm.querySelector(".spinner"));
    confirm.click();
    assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 1);
    h.setResponse(
      "/api/admin/clients/account-console/sessions?page=0&size=10",
      "GET",
      () => page([]),
    );
    complete({ status: 204 });
    await settle();
    assert.equal(
      h.document.querySelector('[data-action="client-operation-confirm"]'),
      null,
    );
    assert.match(
      h.document.querySelector(".client-related").textContent,
      /No records/,
    );
    assert.ok(
      h.document.querySelector(
        '[data-action="client-operation-request"][data-id="sessions:all"]',
      ),
    );
  } finally {
    h.restore();
  }
});

test("confidential client rotates a secret once and clears it on tab navigation", async () => {
  const h = await setup();
  try {
    h.setResponse("/api/admin/clients/account-console", "GET", () => ({
      ...client,
      clientAuthenticationMethods: ["client_secret_basic"],
    }));
    h.setResponse("/api/admin/clients/account-console/secret", "POST", () => ({
      clientSecret: "ONE_TIME_FIXTURE",
    }));
    await open(h);
    await tab(h, "credentials");
    h.document
      .querySelector(
        '[data-action="client-operation-request"][data-id="secret"]',
      )
      .click();
    h.document
      .querySelector('[data-action="client-operation-confirm"]')
      .click();
    await settle();
    assert.equal(
      h.calls.filter(
        (call) => call.path.endsWith("/secret") && call.method === "POST",
      ).length,
      1,
    );
    assert.equal(
      h.document.querySelector("[data-one-time-client-secret]").textContent,
      "ONE_TIME_FIXTURE",
    );
    assert.equal(h.dom.window.localStorage.length, 0);
    await tab(h, "settings");
    await tab(h, "credentials");
    assert.equal(
      h.document.querySelector("[data-one-time-client-secret]"),
      null,
    );
  } finally {
    h.restore();
  }
});

test("direct client route loads without a cached list and offline drafts retain no notification token", async () => {
  const h = await renderConsole("admin", {
    messages,
    icons,
    hash: "#/admin/clients/account-console/settings",
    response: (path) =>
      path === "/api/admin/clients/account-console" ? client : undefined,
  });
  try {
    await settle();
    assert.ok(
      h.document.querySelector('[data-client-detail="account-console"]'),
    );
    const form = h.document.querySelector(
      '[data-form="admin-client-configuration"]',
    );
    form.elements.rootUrl.value = "https://draft.example";
    form.elements.cibaClientNotificationToken.value = "TRANSIENT_FIXTURE";
    h.dom.window.dispatchEvent(new h.dom.window.Event("offline"));
    await settle();
    assert.equal(
      h.document.querySelector('[name="rootUrl"]').value,
      "https://draft.example",
    );
    assert.equal(
      h.document.querySelector('[name="cibaClientNotificationToken"]').value,
      "",
    );
    assert.equal(
      h.document.querySelector('button[type="submit"]').disabled,
      true,
    );
  } finally {
    h.restore();
  }
});

test("custom client deletion keeps its menu confirmation visible and reloads the result count", async () => {
  const custom = {
    ...client,
    id: "custom",
    clientId: "custom",
    clientName: "Custom client",
  };
  let deleted = false;
  let complete;
  const h = await setup({
    response: (path) =>
      path.startsWith("/api/admin/clients?")
        ? page(deleted ? [] : [custom])
        : undefined,
  });
  try {
    h.setResponse(
      "/api/admin/clients/custom",
      "DELETE",
      () =>
        new Promise((resolve) => {
          complete = () => {
            deleted = true;
            resolve({ status: 204 });
          };
        }),
    );
    h.document.querySelector(".client-menu summary").click();
    h.document
      .querySelector('[data-action="admin-client-delete-request"]')
      .click();
    await settle();
    assert.ok(h.document.querySelector(".client-menu[open]"));
    h.document
      .querySelector('[data-action="admin-client-delete-cancel"]')
      .click();
    assert.equal(
      h.calls.some((call) => call.method === "DELETE"),
      false,
    );
    h.document.querySelector(".client-menu summary").click();
    h.document
      .querySelector('[data-action="admin-client-delete-request"]')
      .click();
    h.document
      .querySelector('[data-action="admin-client-delete-confirm"]')
      .click();
    await settle();
    const confirmation = h.document.querySelector(
      '[data-action="admin-client-delete-confirm"]',
    );
    assert.equal(confirmation.disabled, true);
    assert.ok(confirmation.querySelector(".spinner"));
    assert.ok(h.document.querySelector(".client-menu[open]"));
    confirmation.click();
    assert.equal(h.calls.filter((call) => call.method === "DELETE").length, 1);
    complete();
    await settle();
    assert.equal(
      h.document.querySelectorAll(".client-table tr[data-client-id]").length,
      0,
    );
    assert.match(
      h.document.querySelector(".client-results").textContent,
      /0 records/,
    );
  } finally {
    h.restore();
  }
});
