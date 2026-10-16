import test from "node:test";
import assert from "node:assert/strict";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const flowPath = "/api/admin/authentication/flows?page=0&size=20&sort=name,asc";
const providerPath = "/api/admin/authentication/execution-providers";

async function openAuthenticationOverview(harness) {
  const { calls, document } = harness;
  document.querySelector('[data-route="authentication"]').click();
  for (let turn = 0; turn < 30; turn += 1) {
    await settle();
    if (calls.some(({ path }) => path === providerPath)) break;
  }
  return document.querySelector(".content").textContent;
}

test("native Admin authentication overview renders configured flow details and bindings", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: {
        adminBuiltIn: "Built-in",
        adminCustom: "Custom",
        adminNotConfigured: "Not configured",
      },
    },
  });
  harness.setResponse(flowPath, "GET", () => ({
    content: [
      {
        name: "browser",
        alias: "browser",
        flowType: "basic",
        description: "Browser sign-in with a second factor",
        builtIn: true,
      },
      {
        name: "custom-device",
        alias: "device-flow",
        flowType: "client",
        description: "",
        builtIn: false,
      },
    ],
    totalElements: 2,
    totalPages: 1,
    number: 0,
  }));
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => [
    { bindingType: "browser", flowName: "browser" },
    { bindingType: "direct-grant", flowName: null },
  ]);
  harness.setResponse(providerPath, "GET", () => [
    "auth-cookie",
    "webauthn-authenticator",
  ]);

  try {
    const content = await openAuthenticationOverview(harness);
    assert.match(content, /Browser sign-in with a second factor/);
    assert.match(content, /device-flow · client/);
    assert.match(content, /Built-in/);
    assert.match(content, /Custom/);
    assert.match(content, /browser/);
    assert.match(content, /direct-grant/);
    assert.match(content, /Not configured/);
    assert.match(content, /auth-cookie/);
    assert.match(content, /webauthn-authenticator/);
    assert.ok(harness.calls.some(({ path }) => path === flowPath));
  } finally {
    harness.restore();
  }
});

test("native Admin authentication overview gives explicit empty states", async () => {
  const harness = await renderConsole("admin", {
    messages: {
      en: {
        adminNoAuthenticationFlows: "No authentication flows",
        adminNoAuthenticationBindings: "No authentication bindings",
        adminNoExecutionProviders: "No execution providers",
      },
    },
  });
  harness.setResponse(flowPath, "GET", () => ({ content: [] }));
  harness.setResponse("/api/admin/authentication/bindings", "GET", () => []);
  harness.setResponse(providerPath, "GET", () => []);

  try {
    const content = await openAuthenticationOverview(harness);
    assert.match(content, /No authentication flows/);
    assert.match(content, /No authentication bindings/);
    assert.match(content, /No execution providers/);
  } finally {
    harness.restore();
  }
});
