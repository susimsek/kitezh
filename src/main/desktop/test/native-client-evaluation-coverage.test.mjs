import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const client = {
  id: "console-client",
  clientId: "console-client",
  clientName: "Console Client",
  clientAuthenticationMethods: ["none"],
  authorizationGrantTypes: ["authorization_code"],
  scopes: ["openid", "profile"],
};

async function openEvaluationTab(harness) {
  const { calls, document } = harness;
  document.querySelector('[data-route="clients"]').click();
  for (let turn = 0; turn < 30; turn += 1) {
    await settle();
    if (calls.some(({ path }) => path.startsWith("/api/admin/clients?"))) break;
  }
  document
    .querySelector(
      '.client-name [data-action="client-open"][data-id="console-client"]',
    )
    .click();
  await settle();
  document
    .querySelector('[data-action="client-tab"][data-id="evaluation"]')
    .click();
  await settle();
}

test("native Admin client scope evaluation submits normalized input and renders claims", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/clients/console-client", "GET", () => client);
  harness.setResponse(
    "/api/admin/clients/console-client/scope-evaluation?scopes=openid+profile&subject=ada",
    "GET",
    () => ({
      effectiveScopes: ["openid", "profile"],
      roles: ["ROLE_USER"],
      mappedClaims: ["sub", "email"],
      claims: { sub: "ada", email: "ada@example.test" },
    }),
  );

  try {
    const { calls, document } = harness;
    await openEvaluationTab(harness);
    const form = document.querySelector('[data-form="client-evaluation"]');
    assert.ok(form);
    form.elements.namedItem("scopes").value = " openid profile ";
    form.elements.namedItem("subject").value = " ada ";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    assert.ok(
      calls.some(
        ({ path }) =>
          path ===
          "/api/admin/clients/console-client/scope-evaluation?scopes=openid+profile&subject=ada",
      ),
    );
    assert.match(
      document.querySelector(".client-tab-content").textContent,
      /ROLE_USER/,
    );
    assert.match(
      document.querySelector(".client-tab-content").textContent,
      /ada@example.test/,
    );
  } finally {
    harness.restore();
  }
});

test("native Admin client scope evaluation preserves its draft after a timed-out request", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/clients/console-client", "GET", () => client);
  harness.setResponse(
    "/api/admin/clients/console-client/scope-evaluation?scopes=admin-api&subject=grace",
    "GET",
    () => ({
      status: 0,
      kind: "timeout",
      body: null,
    }),
  );

  try {
    const { document } = harness;
    await openEvaluationTab(harness);
    const form = document.querySelector('[data-form="client-evaluation"]');
    form.elements.namedItem("scopes").value = "admin-api";
    form.elements.namedItem("subject").value = "grace";
    form.dispatchEvent(
      new document.defaultView.Event("submit", {
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();

    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /apiTimeout/,
    );
    assert.equal(
      document.querySelector('[data-form="client-evaluation"] [name="scopes"]')
        .value,
      "admin-api",
    );
  } finally {
    harness.restore();
  }
});
