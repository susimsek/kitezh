import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

async function createPersonalAccessToken(harness) {
  const { document, setResponse } = harness;
  setResponse("/api/account/personal-access-tokens", "POST", () => ({
    id: "pat-new",
    name: "Codex desktop",
    description: null,
    token: "one-time-pat-secret",
    scope: "mcp.read",
    createdAt: "2026-10-17T08:00:00Z",
    expiresAt: null,
  }));
  const form = document.querySelector('[data-form="personal-access-token"]');
  form.elements.namedItem("name").value = "Codex desktop";
  form.dispatchEvent(
    new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
}

test("native Account PAT copies the secret, hides it, and dismisses the one-time value", async () => {
  const copied = [];
  const harness = await renderConsole("account");
  const { document } = harness;
  Object.defineProperty(harness.dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value) => copied.push(value) },
  });
  try {
    document.querySelector('[data-route="security"]').click();
    await settle();
    await createPersonalAccessToken(harness);

    document.querySelector('[data-action="personal-access-token-copy"]').click();
    await settle();
    assert.deepEqual(copied, ["one-time-pat-secret"]);
    assert.ok(document.querySelector('[role="status"]'));

    document.querySelector('[data-action="personal-access-token-toggle"]').click();
    await settle();
    assert.equal(document.getElementById("personal-access-token-value").type, "text");
    document.querySelector('[data-action="personal-access-token-toggle"]').click();
    await settle();
    assert.equal(document.getElementById("personal-access-token-value").type, "password");

    document.querySelector('[data-action="personal-access-token-dismiss"]').click();
    await settle();
    assert.equal(document.getElementById("personal-access-token-value"), null);
  } finally {
    harness.restore();
  }
});

test("native Account PAT reports clipboard failures and keeps revoke confirmation authoritative", async () => {
  let allowRevoke = false;
  const harness = await renderConsole("account", {
    confirm: () => allowRevoke,
  });
  const { calls, document, setResponse } = harness;
  Object.defineProperty(harness.dom.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("clipboard unavailable");
      },
    },
  });
  try {
    setResponse("/api/account/personal-access-tokens", "GET", () => [
      {
        id: "pat-kept",
        name: "Existing token",
        description: null,
        scope: "mcp.read",
        createdAt: "2026-10-17T08:00:00Z",
        expiresAt: null,
      },
    ]);
    setResponse("/api/account/personal-access-tokens", "POST", () => ({
      id: "pat-new",
      name: "Codex desktop",
      description: null,
      token: "one-time-pat-secret",
      scope: "mcp.read",
      createdAt: "2026-10-17T08:00:00Z",
      expiresAt: null,
    }));
    setResponse("/api/account/personal-access-tokens/pat-kept", "DELETE", () => ({
      status: 500,
      body: { detail: "revocation failed" },
    }));
    document.querySelector('[data-route="security"]').click();
    await settle();
    await createPersonalAccessToken(harness);

    document.querySelector('[data-action="personal-access-token-copy"]').click();
    await settle();
    assert.ok(document.querySelector('[role="alert"]'));

    document
      .querySelector('[data-action="personal-access-token-revoke"]')
      .click();
    await settle();
    assert.equal(
      calls.some(({ path, method }) =>
        path === "/api/account/personal-access-tokens/pat-kept" && method === "DELETE",
      ),
      false,
    );

    allowRevoke = true;
    document
      .querySelector('[data-action="personal-access-token-revoke"]')
      .click();
    await settle();
    assert.ok(
      calls.some(({ path, method }) =>
        path === "/api/account/personal-access-tokens/pat-kept" && method === "DELETE",
      ),
    );
    assert.ok(document.querySelector('[data-id="pat-kept"]'));
    assert.ok(document.querySelector('[role="alert"]'));
  } finally {
    harness.restore();
  }
});
