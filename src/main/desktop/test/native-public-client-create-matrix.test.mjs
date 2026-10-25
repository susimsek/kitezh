import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

test("public client creation validates redirect lists and applies safe public defaults", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/clients", "POST", ({ body }) => ({
    client: {
      id: "public-native-client",
      clientId: body.clientId,
      clientName: body.clientName,
      scopes: body.scopes,
    },
  }));

  try {
    const { calls, document } = harness;
    document.querySelector('[data-route="clients"]').click();
    await settle();
    document.querySelector('[data-action="create-client"]').click();
    await settle();

    let form = document.querySelector('[data-form="admin-client-create"]');
    form.elements.namedItem("clientId").value = " public-native ";
    form.elements.namedItem("clientName").value = "Public Native Client";
    form.elements.namedItem("authenticationMode").value = "public";
    form.elements.namedItem("redirectUris").value =
      "  https://native.example.test/callback  \n\nhttps://native.example.test/second";
    form.elements.namedItem("postLogoutRedirectUris").value =
      "https://native.example.test/logout#fragment";
    form.elements.namedItem("scopes").value = "openid   profile\n email ";
    form.elements.namedItem("requireAuthorizationConsent").checked = false;
    form.dispatchEvent(new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await settle();

    assert.equal(calls.some(({ path, method }) => path === "/api/admin/clients" && method === "POST"), false);
    assert.ok(document.querySelector('[role="alert"]'));
    form = document.querySelector('[data-form="admin-client-create"]');
    assert.equal(form.elements.namedItem("authenticationMode").value, "public");
    form.elements.namedItem("postLogoutRedirectUris").value =
      " https://native.example.test/logout \n";
    form.dispatchEvent(new document.defaultView.Event("submit", {
      bubbles: true,
      cancelable: true,
    }));
    await settle();

    const createCall = calls.find(({ path, method }) => path === "/api/admin/clients" && method === "POST");
    assert.ok(createCall);
    assert.equal(createCall.body.clientId, "public-native");
    assert.deepEqual(createCall.body.clientAuthenticationMethods, ["none"]);
    assert.deepEqual(createCall.body.authorizationGrantTypes, ["authorization_code", "refresh_token"]);
    assert.deepEqual(createCall.body.redirectUris, [
      "https://native.example.test/callback",
      "https://native.example.test/second",
    ]);
    assert.deepEqual(createCall.body.postLogoutRedirectUris, [
      "https://native.example.test/logout",
    ]);
    assert.deepEqual(createCall.body.scopes, ["openid", "profile", "email"]);
    assert.equal(createCall.body.requireAuthorizationConsent, false);
    assert.equal(createCall.body.clientSecretTimeToLive, null);
    assert.equal(document.querySelector('[data-one-time-client-secret="true"]'), null);
    assert.ok(document.querySelector('[data-route="clients"]'));
    assert.ok(document.querySelector('[data-client-id="public-native-client"]'));
  } finally {
    harness.restore();
  }
});
