import assert from "node:assert/strict";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const emitClick = (document, element) =>
  element.dispatchEvent(
    new document.defaultView.Event("click", { bubbles: true, cancelable: true }),
  );

test("login and email settings render enabled policy switches and configured fields", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/settings/login/native", "GET", () => ({
    userRegistration: true,
    forgotPassword: true,
    rememberMe: true,
    loginWithEmail: true,
    verifyEmail: true,
    sessionTimeoutMinutes: 45,
    passwordMinimumLength: 14,
    bruteForceEnabled: true,
    bruteForceMaxFailures: 6,
    otpEnabled: true,
    otpRequired: true,
    passkeys: true,
  }));
  harness.setResponse("/api/admin/settings/email", "GET", () => ({
    enabled: true,
    fromAddress: "auth@example.test",
    baseUrl: "https://auth.example.test",
    host: "smtp.example.test",
    port: 465,
    username: "mailer",
    smtpAuth: true,
    starttls: true,
    ssl: true,
  }));
  try {
    const { document } = harness;
    document.querySelector('[data-route="login-email"]').click();
    await settle();
    const login = document.querySelector('[data-form="admin-login-settings"]');
    for (const name of [
      "userRegistration",
      "forgotPassword",
      "rememberMe",
      "loginWithEmail",
      "verifyEmail",
      "bruteForceEnabled",
      "otpEnabled",
      "otpRequired",
      "passkeys",
    ])
      assert.equal(login.elements.namedItem(name).checked, true, `${name} is enabled`);
    assert.equal(login.elements.namedItem("sessionTimeoutMinutes").value, "45");
    assert.equal(login.elements.namedItem("passwordMinimumLength").value, "14");

    const email = document.querySelector('[data-form="admin-email-settings"]');
    for (const name of ["enabled", "smtpAuth", "starttls", "ssl"])
      assert.equal(email.elements.namedItem(name).checked, true, `${name} is enabled`);
    assert.equal(email.elements.namedItem("fromAddress").value, "auth@example.test");
    assert.equal(email.elements.namedItem("username").value, "");
  } finally {
    harness.restore();
  }
});

test("user consent details handle sparse values and confirmed revocation", async () => {
  const harness = await renderConsole("admin");
  harness.setResponse("/api/admin/users/1", "GET", () => ({
    id: 1,
    username: "ada",
    enabled: true,
    authorities: ["ROLE_USER"],
  }));
  harness.setResponse(
    "/api/admin/users/1/consents?page=0&size=10&sort=id.registeredClientId,asc",
    "GET",
    () => ({
      content: [
        {
          clientId: "sparse-client",
          principalName: "ada",
          authorities: [],
        },
      ],
      number: 0,
      totalPages: 0,
    }),
  );
  try {
    const { document, calls } = harness;
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    emitClick(
      document,
      document.querySelector('[data-action="admin-user-detail-open"][data-id="1"]'),
    );
    await settle();
    emitClick(
      document,
      document.querySelector('[data-action="admin-user-detail-tab"][data-tab="consents"]'),
    );
    await settle();

    let row = document.querySelector(".admin-user-detail-data-table tbody tr");
    assert.match(row.textContent, /sparse-client/);
    assert.match(row.textContent, /—/);
    emitClick(document, row.querySelector('[data-action="admin-user-detail-consent-details"]'));
    await settle();
    assert.match(document.querySelector(".admin-user-detail-expand-row").textContent, /ada/);
    assert.match(document.querySelector(".admin-user-detail-expand-row").textContent, /—/);

    emitClick(document, row.querySelector('[data-action="admin-user-detail-revoke-consent"]'));
    await settle();
    emitClick(
      document,
      document.querySelector('[data-action="admin-user-detail-revoke-consent-confirm"]'),
    );
    await settle();
    assert.ok(
      calls.some(
        ({ path, method }) =>
          path === "/api/admin/consents/sparse-client/ada" && method === "DELETE",
      ),
    );
    assert.match(document.querySelector(".content").textContent, /consent revoked/i);
  } finally {
    harness.restore();
  }
});
