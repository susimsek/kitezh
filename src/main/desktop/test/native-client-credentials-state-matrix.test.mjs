import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const clients = [
  {
    id: "public-app",
    clientId: "public-app",
    clientName: "Public Application",
    clientAuthenticationMethods: ["none"],
    authorizationGrantTypes: ["authorization_code", "refresh_token"],
    scopes: ["openid"],
    requireProofKey: true,
    requireDpop: true,
    requireDpopJkt: true,
    dpopRefreshTokenOnly: true,
    clientIdIssuedAt: "2026-10-01T08:00:00Z",
  },
  {
    id: "service-app",
    clientId: "service-app",
    clientName: "Service Application",
    clientAuthenticationMethods: ["client_secret_basic", "private_key_jwt"],
    authorizationGrantTypes: ["client_credentials"],
    scopes: ["admin-api", "offline_access"],
    requireProofKey: false,
    requireDpop: false,
    dpopSigningAlgorithms: ["ES256"],
    clientSecretExpiresAt: null,
  },
];

test("client credential detail matrix renders public and confidential security states", async () => {
  const harness = await renderConsole("admin", {
    response: (path) => {
      if (path.startsWith("/api/admin/clients?"))
        return { content: clients, page: { number: 0, size: 10, totalElements: 2, totalPages: 1 } };
      if (path.startsWith("/api/admin/clients/service-app/scope-evaluation?"))
        return { effectiveScopes: [], roles: [], mappedClaims: [], claims: null };
      return clients.find((client) => path === `/api/admin/clients/${client.id}`) ?? null;
    },
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="clients"]').click();
    await settle();

    for (const scenario of [
      {
        id: "public-app",
        name: "Public Application",
        badge: /adminClientPublic/,
        security: [/PKCE/, /DPoP/, /dpop_jkt/, /DPoP refresh/, /RS256\/ES256/],
        secretCard: false,
      },
      {
        id: "service-app",
        name: "Service Application",
        badge: /adminClientConfidential/,
        security: [/PKCE/, /DPoP/, /ES256/],
        secretCard: true,
      },
    ]) {
      document
        .querySelector(`.client-name [data-action="client-open"][data-id="${scenario.id}"]`)
        .click();
      await settle();
      document.querySelector('[data-action="client-tab"][data-id="credentials"]').click();
      await settle();

      const content = document.querySelector(".client-tab-content");
      assert.equal(content.closest(".client-detail").dataset.clientDetail, scenario.id);
      assert.match(content.textContent, scenario.badge);
      for (const value of scenario.security) assert.match(content.textContent, value);
      assert.equal(Boolean(content.querySelector('[data-action="client-operation-request"][data-id="secret"]')), scenario.secretCard);
      if (scenario.secretCard) assert.match(content.textContent, /adminClientNoExpiry/);
      else assert.equal(content.querySelector('[data-one-time-client-secret]'), null);

      document.querySelector('[data-action="client-back"]').click();
      await settle();
    }

    document
      .querySelector('.client-name [data-action="client-open"][data-id="service-app"]')
      .click();
    await settle();
    document.querySelector('[data-action="client-tab"][data-id="evaluation"]').click();
    await settle();
    document.querySelector('[data-form="client-evaluation"]').dispatchEvent(
      new document.defaultView.Event("submit", { bubbles: true, cancelable: true }),
    );
    await settle();
    const evaluation = document.querySelector(".client-tab-content");
    assert.match(evaluation.textContent, /—/);
    assert.match(evaluation.querySelector("pre").textContent, /\{\}/);
  } finally {
    harness.restore();
  }
});
