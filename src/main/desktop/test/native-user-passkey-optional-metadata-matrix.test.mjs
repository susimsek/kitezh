import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderConsole, settle } from "./native-renderer-harness.mjs";

const require = createRequire(import.meta.url);
const { messages } = require("@kitezh/shared/i18n");

test("user passkeys render sparse metadata and explicit negative verification state", async () => {
  const harness = await renderConsole("admin", {
    messages,
    response: (path) => {
      if (path === "/api/admin/users/1")
        return { id: 1, username: "ada", enabled: true, authorities: ["ROLE_USER"] };
      if (path === "/api/admin/users/1/profile-attributes")
        return { definitions: [], attributes: {} };
      if (path === "/api/admin/required-actions/users/1") return [];
      if (path === "/api/admin/users/1/webauthn/credentials?page=0&size=20")
        return {
          content: [
            {
              credentialId: "sparse-key",
              label: "",
              transports: [],
              createdAt: null,
              lastUsedAt: null,
              signatureCount: 0,
              credentialType: "",
              uvInitialized: false,
            },
            {
              credentialId: "legacy-key",
              label: "Legacy key",
              transports: [],
              createdAt: null,
              lastUsedAt: null,
            },
          ],
          number: 0,
          totalPages: 1,
          totalElements: 2,
        };
      return null;
    },
  });

  try {
    const { document } = harness;
    await settle();
    document.querySelector('[data-route="users"]').click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-open"][data-id="1"]')
      .click();
    await settle();
    document
      .querySelector('[data-action="admin-user-detail-tab"][data-tab="credentials"]')
      .click();
    await settle();

    const sparse = document.querySelector('[data-passkey-index="0"]');
    const legacy = document.querySelector('[data-passkey-index="1"]');
    assert.ok(sparse);
    assert.match(sparse.textContent, /Unnamed passkey/);
    assert.match(sparse.textContent, /Signature counter: 0/);
    assert.match(sparse.textContent, /User verification: No/);
    assert.ok(legacy);
    assert.doesNotMatch(legacy.textContent, /Signature counter/);
    assert.match(legacy.textContent, /Added: —/);
    assert.match(legacy.textContent, /Last used: —/);
  } finally {
    harness.restore();
  }
});
