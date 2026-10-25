import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native admin collection screens tolerate malformed page envelopes", async () => {
  const malformed = { content: {} };
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/users?")) return malformed;
      if (path.startsWith("/api/admin/clients?"))
        return { content: null, page: { size: 0 } };
      if (path.startsWith("/api/admin/identity-providers?")) return malformed;
      return null;
    },
  });

  try {
    const { document } = harness;

    document.querySelector('[data-route="users"]').click();
    await settle();
    assert.ok(document.querySelector(".admin-users-empty"));
    assert.match(document.querySelector(".admin-users-count").textContent, /0/);
    assert.match(document.querySelector(".admin-users-pagination").textContent, /0–0/);

    document.querySelector('[data-route="clients"]').click();
    await settle();
    assert.ok(document.querySelector(".client-list .empty"));
    assert.match(document.querySelector(".client-list .admin-pagination-summary").textContent, /0–0/);

    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    assert.ok(document.querySelector(".provider-table-card .empty"));
    assert.equal(document.querySelector(".provider-table-card .table-pagination"), null);
  } finally {
    harness.restore();
  }
});

test("native client detail normalizes optional scopes and malformed mapper pages", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/clients?"))
        return {
          content: [
            { id: "client-a", clientId: "client-a", clientName: "Client A" },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        };
      if (path === "/api/admin/clients/client-a")
        return { id: "client-a", clientId: "client-a", clientName: "Client A" };
      if (path === "/api/admin/clients/client-a/scope-assignments") return {};
      if (path.startsWith("/api/admin/clients/client-a/mappers?"))
        return { content: null, page: { totalElements: 0 } };
      if (path.startsWith("/api/admin/clients/client-a/roles?"))
        return { content: null, page: {} };
      return null;
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="clients"]').click();
    await settle();
    document.querySelector('[data-action="client-open"][data-id="client-a"]').click();
    await settle();

    document.querySelector('[data-action="client-tab"][data-id="scopes"]').click();
    await settle();
    assert.ok(document.querySelector('[data-client-scope-assignments-panel="true"]'));
    assert.ok(document.querySelector('[data-client-scope-assignments-panel="true"] .empty'));

    document.querySelector('[data-action="client-tab"][data-id="mappers"]').click();
    await settle();
    assert.ok(document.querySelector(".client-tab-content .list .empty"));

    document.querySelector('[data-action="client-tab"][data-id="roles"]').click();
    await settle();
    assert.ok(document.querySelector('[data-client-roles-panel="client-a"]'));
    assert.ok(document.querySelector('[data-client-roles-panel="client-a"] .empty'));
  } finally {
    harness.restore();
  }
});

test("native client and provider detail failures remain on their list routes safely", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/clients?"))
        return {
          content: [
            { id: "broken-client", clientId: "broken-client", clientName: "Broken client" },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        };
      if (path === "/api/admin/clients/broken-client")
        return { status: 503, body: { detail: "Client service unavailable" } };
      if (path.startsWith("/api/admin/identity-providers?"))
        return {
          content: [
            { id: "broken-provider", alias: "provider-a", providerType: "oidc" },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
        };
      if (path === "/api/admin/identity-providers/broken-provider")
        return { status: 503, body: { detail: "Provider service unavailable" } };
      return null;
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="clients"]').click();
    await settle();
    document.querySelector('[data-action="client-open"][data-id="broken-client"]').click();
    await settle();
    assert.ok(document.querySelector(".content [role=alert], .content [role=status]"));

    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    document.querySelector('[data-action="admin-provider-open"][data-id="broken-provider"]').click();
    await settle();
    assert.ok(document.querySelector(".content [role=alert], .content [role=status]"));
  } finally {
    harness.restore();
  }
});

test("native provider list normalizes sparse names and malformed result metadata", async () => {
  let useMalformedPage = false;
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (!path.startsWith("/api/admin/identity-providers?")) return null;
      return useMalformedPage
        ? { content: null, number: "bad", totalPages: "bad" }
        : {
            content: [
              { id: "alias-only", alias: "alias-only", enabled: true },
              { id: "empty-name", alias: "", displayName: "", enabled: false },
            ],
            number: 0,
            totalElements: 2,
            totalPages: 1,
          };
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    const rows = document.querySelectorAll(".provider-table-card tbody tr");
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /alias-only/);
    assert.match(rows[1].textContent, /adminProviderDisabled|Disabled/);

    useMalformedPage = true;
    const query = document.getElementById("admin-identity-provider-query");
    query.value = "missing";
    query.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
    query.dispatchEvent(new document.defaultView.Event("change", { bubbles: true }));
    const form = document.getElementById("admin-identity-provider-search");
    form.dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
    await settle();
    assert.ok(document.querySelector(".provider-table-card .empty"));
  } finally {
    harness.restore();
  }
});

test("native provider deep link tolerates a malformed cached list envelope", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/identity-providers?"))
        return { content: {} };
      if (path === "/api/admin/identity-providers/broken-provider")
        return { status: 503, body: { detail: "Provider service unavailable" } };
      return null;
    },
  });

  try {
    const { document } = harness;
    const { window } = harness.dom;
    document.querySelector('[data-route="identity-providers"]').click();
    await settle();
    assert.ok(document.querySelector(".provider-table-card .empty"));

    window.location.hash = "#/admin/identity-providers/broken-provider/details";
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await settle();
    assert.match(document.querySelector(".content").textContent, /adminIdentityProvidersLoadError/);
  } finally {
    harness.restore();
  }
});
