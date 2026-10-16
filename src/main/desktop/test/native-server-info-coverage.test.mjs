import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const serverInfo = {
  issuer: "https://issuer.example.test",
  authorizationEndpoint: "https://issuer.example.test/oauth2/authorize",
  tokenEndpoint: "https://issuer.example.test/oauth2/token",
  introspectionEndpoint: "https://issuer.example.test/oauth2/introspect",
  revocationEndpoint: "https://issuer.example.test/oauth2/revoke",
  userInfoEndpoint: "https://issuer.example.test/userinfo",
  jwksEndpoint: "https://issuer.example.test/oauth2/jwks",
  endSessionEndpoint: "https://issuer.example.test/logout",
  discoveryEndpoint:
    "https://issuer.example.test/.well-known/openid-configuration",
  sessionTimeout: "30 minutes",
  activeSigningKey: {
    kid: "active-key-1",
    algorithm: "RS256",
    type: "RSA",
    use: "sig",
    createdAt: "2026-10-12T08:30:00Z",
  },
};

async function openServerInfo(harness) {
  const { document, calls } = harness;
  document.querySelector('[data-route="server-info"]').click();
  for (let turn = 0; turn < 30; turn += 1) {
    await settle();
    if (
      calls.some(
        ({ path }) =>
          path ===
          serverInfo.discoveryEndpoint.slice(
            "https://issuer.example.test".length,
          ),
      )
    )
      break;
  }
}

test("native Admin server information renders endpoints and discovery/JWKS tabs", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: {
        adminIssuer: "Issuer",
        adminAuthorizationEndpoint: "Authorization",
        adminDiscovery: "Discovery document",
        adminJwks: "Signing keys",
        adminCopy: "Copy",
        adminCopyJson: "Copy JSON",
      },
    },
  });
  harness.setResponse("/api/admin/server-info", "GET", () => serverInfo);
  harness.setResponse("/.well-known/openid-configuration", "GET", () => ({
    issuer: serverInfo.issuer,
    authorization_endpoint: serverInfo.authorizationEndpoint,
  }));
  harness.setResponse("/oauth2/jwks", "GET", () => ({
    keys: [{ kid: "active-key-1", alg: "RS256" }],
  }));
  const copied = [];
  Object.defineProperty(harness.dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value) => copied.push(value) },
  });

  try {
    const { document } = harness;
    await openServerInfo(harness);
    const content = document.querySelector(".content");
    assert.match(content.textContent, /30 minutes/);
    assert.match(content.textContent, /active-key-1/);
    assert.match(
      content.textContent,
      /issuer\.example\.test\/oauth2\/authorize/,
    );
    assert.match(content.textContent, /authorization_endpoint/);
    assert.match(content.textContent, /Issuer/);

    content
      .querySelector(
        '[data-action="server-info-copy"][data-copy-id="endpoint:issuer"]',
      )
      .click();
    await settle();
    assert.deepEqual(copied, [serverInfo.issuer]);
    assert.equal(
      document.querySelector('[data-copy-id="endpoint:issuer"]').className,
      "success-button",
    );

    document
      .querySelector(
        '[data-action="server-info-copy"][data-copy-id="json:discovery"]',
      )
      .click();
    await settle();
    assert.match(copied.at(-1), /authorization_endpoint/);

    document
      .querySelector('[data-action="server-info-tab"][data-tab="jwks"]')
      .click();
    await settle();
    assert.match(document.querySelector(".content").textContent, /"keys"/);
    assert.match(
      document.querySelector(".content").textContent,
      /"alg": "RS256"/,
    );
    document
      .querySelector(
        '[data-action="server-info-copy"][data-copy-id="json:jwks"]',
      )
      .click();
    await settle();
    assert.match(copied.at(-1), /active-key-1/);
    await new Promise((resolve) => setTimeout(resolve, 1900));
  } finally {
    harness.restore();
  }
});

test("native Admin server information reports endpoint and clipboard failures safely", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: {
        adminJwksError: "Signing keys could not be loaded.",
        adminServerInfoCopyFailed: "Copy failed.",
      },
    },
  });
  harness.setResponse("/api/admin/server-info", "GET", () => serverInfo);
  harness.setResponse("/.well-known/openid-configuration", "GET", () => ({
    issuer: serverInfo.issuer,
  }));
  harness.setResponse("/oauth2/jwks", "GET", () => {
    throw new Error("temporary endpoint failure");
  });
  Object.defineProperty(harness.dom.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async () => {
        throw new Error("clipboard unavailable");
      },
    },
  });

  try {
    const { document } = harness;
    await openServerInfo(harness);
    const content = document.querySelector(".content");
    document
      .querySelector('[data-action="server-info-tab"][data-tab="jwks"]')
      .click();
    await settle();
    assert.match(
      document.querySelector(".content").textContent,
      /Signing keys could not be loaded/,
    );
    assert.equal(document.querySelector('[data-copy-id="json:jwks"]'), null);

    document
      .querySelector('[data-action="server-info-tab"][data-tab="discovery"]')
      .click();
    await settle();
    document
      .querySelector(
        '[data-action="server-info-copy"][data-copy-id="endpoint:issuer"]',
      )
      .click();
    await settle();
    assert.match(document.querySelector(".content").textContent, /Copy failed/);
  } finally {
    harness.restore();
  }
});

test("native Admin server information reports a failed metadata request", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: { adminServerInfoLoadError: "Server metadata is unavailable." },
    },
  });
  harness.setResponse("/api/admin/server-info", "GET", () => {
    throw new Error("metadata unavailable");
  });

  try {
    const { document } = harness;
    document.querySelector('[data-route="server-info"]').click();
    await settle();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /Server metadata is unavailable/,
    );
  } finally {
    harness.restore();
  }
});
