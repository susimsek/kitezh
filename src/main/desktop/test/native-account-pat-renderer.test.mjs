import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("native Account security screen creates, reveals, and revokes a PAT", async () => {
  const confirmations = [];
  const harness = await renderConsole("account", {
    confirm: (message) => {
      confirmations.push(message);
      return true;
    },
  });
  const { calls, document, setResponse } = harness;
  try {
    setResponse("/api/account/personal-access-tokens", "GET", () => [
      {
        id: "pat-1",
        name: "Codex laptop",
        description: "Local setup",
        scope: "mcp.read",
        createdAt: "2026-10-17T08:00:00Z",
        expiresAt: null,
      },
    ]);
    setResponse("/api/account/personal-access-tokens", "POST", ({ body }) => ({
      id: "pat-2",
      name: body.name,
      description: body.description,
      token: "test-pat-secret",
      scope: "mcp.read",
      createdAt: "2026-10-17T08:00:00Z",
      expiresAt: null,
    }));
    document.querySelector('[data-route="security"]').click();
    await settle();

    assert.ok(
      calls.some(({ path }) => path === "/api/account/personal-access-tokens"),
    );
    assert.match(document.body.textContent, /No expiration/);
    assert.match(document.body.textContent, /Codex laptop/);
    const expiryOptions = [
      ...document.querySelectorAll("#personalAccessTokenExpiration option"),
    ].map((option) => option.value);
    assert.deepEqual(expiryOptions, ["7", "30", "60", "90", "custom", "never"]);

    const form = document.querySelector('[data-form="personal-access-token"]');
    form.elements.namedItem("name").value = "Codex desktop";
    form.elements.namedItem("description").value = "Workstation";
    form.elements.namedItem("expiration").value = "never";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    const created = calls.find(
      ({ path, method }) =>
        path === "/api/account/personal-access-tokens" && method === "POST",
    );
    assert.deepEqual(created.body, {
      name: "Codex desktop",
      description: "Workstation",
      expiration: "never",
    });
    const secret = document.getElementById("personal-access-token-value");
    assert.ok(secret);
    assert.equal(secret.type, "password");
    assert.equal(secret.value, "test-pat-secret");
    document
      .querySelector('[data-action="personal-access-token-toggle"]')
      .click();
    await settle();
    assert.equal(
      document.getElementById("personal-access-token-value").type,
      "text",
    );

    document
      .querySelector('[data-action="personal-access-token-revoke"]')
      .click();
    await settle();
    assert.match(confirmations[0], /Revoke this personal access token/);
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/account/personal-access-tokens/pat-1" &&
          method === "DELETE",
      ),
    );
    assert.doesNotMatch(document.body.textContent, /Codex laptop/);
  } finally {
    harness.restore();
  }
});

test("native Account PAT date field appears only for custom expiration", async () => {
  const harness = await renderConsole("account");
  try {
    harness.document.querySelector('[data-route="security"]').click();
    await settle();
    const form = harness.document.querySelector(
      '[data-form="personal-access-token"]',
    );
    const expiration = form.elements.namedItem("expiration");
    const customDate = form.querySelector("[data-pat-custom-date]");
    assert.equal(customDate.hidden, true);
    expiration.value = "custom";
    expiration.dispatchEvent(
      new harness.document.defaultView.Event("change", { bubbles: true }),
    );
    assert.equal(customDate.hidden, false);
    assert.equal(customDate.querySelector("input").required, true);
    expiration.value = "90";
    expiration.dispatchEvent(
      new harness.document.defaultView.Event("change", { bubbles: true }),
    );
    assert.equal(customDate.hidden, true);
    assert.equal(customDate.querySelector("input").required, false);
  } finally {
    harness.restore();
  }
});
