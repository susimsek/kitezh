import assert from "node:assert/strict";
import test from "node:test";

import { createDesktopApiAdapter } from "../dist/api/desktop-api.js";

const session = {
  accessToken: "old-access",
  refreshToken: "refresh-secret",
  idToken: "id-secret",
  expiresAt: Date.now() + 60_000,
  version: 1,
};

function harness(fetcher) {
  let current = { ...session };
  const cleared = [];
  return {
    adapter: createDesktopApiAdapter({
      apiBaseUrl: "https://kitezh.onrender.com",
      fetcher,
      readSession: async () => current,
      writeSession: async (_namespace, next) => {
        current = next;
      },
      clearSession: async (namespace) => {
        cleared.push(namespace);
        current = null;
      },
    }),
    cleared,
    session: () => current,
  };
}

test("refreshes once and retries concurrent requests without exposing refresh data", async () => {
  let requests = 0;
  let refreshes = 0;
  const { adapter, session: readSession } = harness(async (url) => {
    requests += 1;
    if (url.endsWith("/oauth2/token")) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(
        JSON.stringify({ access_token: "new-access", expires_in: 300 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: requests === 1 ? 401 : 200,
      headers: { "content-type": "application/json" },
    });
  });

  const first = adapter.request({
    console: "account",
    path: "/api/account/profile",
  });
  const second = adapter.request({
    console: "account",
    path: "/api/account/sessions?page=0&size=20",
  });
  const results = await Promise.all([first, second]);

  assert.equal(refreshes, 1);
  assert.deepEqual(
    results.map((result) => result.status),
    [200, 200],
  );
  assert.equal(readSession().accessToken, "new-access");
});

test("keeps forbidden responses authoritative and rejects unapproved API paths", async () => {
  const { adapter } = harness(
    async () => new Response("forbidden", { status: 403 }),
  );
  const response = await adapter.request({
    console: "account",
    path: "/api/account/profile",
  });
  assert.equal(response.kind, "forbidden");
  await assert.rejects(
    adapter.request({ console: "account", path: "/oauth2/token" }),
    /not allowed/,
  );
});

test("limits the Admin namespace to approved settings writes and bounded read contracts", async () => {
  const { adapter } = harness(
    async () =>
      new Response(
        JSON.stringify({ clients: 2, users: 3, sessions: 4, consents: 5 }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  );
  const response = await adapter.request({
    console: "admin",
    path: "/api/admin/dashboard",
  });
  assert.equal(response.status, 200);
  await assert.rejects(
    adapter.request({ console: "account", path: "/api/admin/dashboard" }),
    /not allowed/,
  );
  const users = await adapter.request({
    console: "admin",
    path: "/api/admin/users?q=alice&page=1&size=20&sort=username,asc",
  });
  assert.equal(users.status, 200);
  const createdUser = await adapter.request({
    console: "admin",
    path: "/api/admin/users",
    method: "POST",
    body: {
      username: "new-user",
      password: "temporary-password",
      enabled: true,
      roles: ["ROLE_USER"],
    },
  });
  assert.equal(createdUser.status, 200);
  const createdRole = await adapter.request({
    console: "admin",
    path: "/api/admin/roles",
    method: "POST",
    body: { name: "ROLE_NATIVE_VIEWER", description: "Native viewer access" },
  });
  assert.equal(createdRole.status, 200);
  const createdGroup = await adapter.request({
    console: "admin",
    path: "/api/admin/groups",
    method: "POST",
    body: {
      name: "native-viewers",
      parentId: null,
      attributes: {},
      defaultGroup: false,
    },
  });
  assert.equal(createdGroup.status, 200);
  const roles = await adapter.request({
    console: "admin",
    path: "/api/admin/roles?q=USER&page=0&size=20&sort=name,asc",
  });
  assert.equal(roles.status, 200);
  const groups = await adapter.request({
    console: "admin",
    path: "/api/admin/groups?q=finance&page=0&size=20&sort=name,asc",
  });
  assert.equal(groups.status, 200);
  const clientScopes = await adapter.request({
    console: "admin",
    path: "/api/admin/client-scopes?q=account&page=0&size=20&sort=name,asc",
  });
  assert.equal(clientScopes.status, 200);
  const clients = await adapter.request({
    console: "admin",
    path: "/api/admin/clients?q=console&page=0&size=20&sort=clientId,asc",
  });
  assert.equal(clients.status, 200);
  const identityProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/identity-providers?q=google&page=0&size=20&sort=guiOrder,asc",
  });
  assert.equal(identityProviders.status, 200);
  const sessions = await adapter.request({
    console: "admin",
    path: "/api/admin/sessions?q=alice&status=expired&page=0&size=20&sort=lastAccessTime,desc",
  });
  assert.equal(sessions.status, 200);
  const consents = await adapter.request({
    console: "admin",
    path: "/api/admin/consents?q=account&page=0&size=20&sort=id.principalName,asc",
  });
  assert.equal(consents.status, 200);
  const offlineSessions = await adapter.request({
    console: "admin",
    path: "/api/admin/offline-sessions?page=0&size=20&sort=refreshTokenIssuedAt,desc",
  });
  assert.equal(offlineSessions.status, 200);
  const events = await adapter.request({
    console: "admin",
    path: "/api/admin/events?q=admin&page=0&size=20&sort=occurredAt,desc",
  });
  assert.equal(events.status, 200);
  const keys = await adapter.request({
    console: "admin",
    path: "/api/admin/keys?q=rsa&active=false&page=0&size=20&sort=createdAt,desc",
  });
  assert.equal(keys.status, 200);
  const cibaPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/ciba-policy",
  });
  assert.equal(cibaPolicy.status, 200);
  const offlineAccessPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/offline-access",
  });
  assert.equal(offlineAccessPolicy.status, 200);
  const updatedCibaPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/ciba-policy",
    method: "PUT",
    body: { requestLifespanSeconds: 300 },
  });
  assert.equal(updatedCibaPolicy.status, 200);
  const updatedOfflineAccessPolicy = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/offline-access",
    method: "PUT",
    body: { idleTimeout: "P30D", maxLimited: false },
  });
  assert.equal(updatedOfflineAccessPolicy.status, 200);
  const branding = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/branding",
  });
  assert.equal(branding.status, 200);
  const updatedBranding = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/branding",
    method: "PUT",
    body: { applicationName: "Kitezh", primaryColor: "#123abc" },
  });
  assert.equal(updatedBranding.status, 200);
  const serverInfo = await adapter.request({
    console: "admin",
    path: "/api/admin/server-info",
  });
  assert.equal(serverInfo.status, 200);
  const loginSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/login",
  });
  assert.equal(loginSettings.status, 200);
  const emailSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/email",
  });
  assert.equal(emailSettings.status, 200);
  const updatedEmailSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/email",
    method: "PUT",
    body: {
      enabled: true,
      fromAddress: "noreply@example.test",
      baseUrl: "https://example.test",
      host: "smtp.example.test",
      port: 587,
      username: "",
      password: "",
      smtpAuth: true,
      starttls: true,
      ssl: false,
    },
  });
  assert.equal(updatedEmailSettings.status, 200);
  const localizationSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization",
  });
  assert.equal(localizationSettings.status, 200);
  const updatedLocalizationSettings = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization",
    method: "PUT",
    body: {
      internationalizationEnabled: true,
      defaultLocale: "en",
      supportedLocales: ["en", "tr"],
    },
  });
  assert.equal(updatedLocalizationSettings.status, 200);
  const ldapProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/ldap",
  });
  assert.equal(ldapProviders.status, 200);
  const authenticationFlows = await adapter.request({
    console: "admin",
    path: "/api/admin/authentication/flows?page=0&size=20&sort=name,asc",
  });
  assert.equal(authenticationFlows.status, 200);
  const authenticationBindings = await adapter.request({
    console: "admin",
    path: "/api/admin/authentication/bindings",
  });
  assert.equal(authenticationBindings.status, 200);
  const executionProviders = await adapter.request({
    console: "admin",
    path: "/api/admin/authentication/execution-providers",
  });
  assert.equal(executionProviders.status, 200);
  const messageOverrides = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization/messages?q=login&locale=tr&bundle=admin&page=0&size=20&sort=locale,asc",
  });
  assert.equal(messageOverrides.status, 200);
  const updatedMessageOverride = await adapter.request({
    console: "admin",
    path: "/api/admin/settings/localization/messages/7",
    method: "PUT",
    body: {
      locale: "tr",
      bundle: "admin",
      messageKey: "login.title",
      messageValue: "Oturum aç",
    },
  });
  assert.equal(updatedMessageOverride.status, 200);
  await assert.rejects(
    adapter.request({
      console: "account",
      path: "/api/admin/settings/ciba-policy",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/branding?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/login",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/email?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users/1",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/roles/ROLE_NATIVE_VIEWER",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/roles/ROLE_NATIVE_VIEWER",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/groups/1",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages/0",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages/9007199254740992",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/ldap",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/authentication/flows/1",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/authentication/flows?q=browser&page=0&size=20",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages?locale=tr&messageKey=auth.token",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/localization/messages?locale=../../secret&page=0&size=20&sort=locale,asc",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/ciba-policy?unexpected=true",
      method: "PUT",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/settings/offline-access/revoke-all",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/keys/rotate",
      method: "POST",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/sessions?status=all",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/roles/ROLE_USER" }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/users/2" }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({
      console: "admin",
      path: "/api/admin/users",
      method: "DELETE",
    }),
    /not allowed/,
  );
  await assert.rejects(
    adapter.request({ console: "admin", path: "/api/admin/users?size=101" }),
    /not allowed/,
  );
});

test("maps transport failures to a recoverable offline result", async () => {
  const { adapter } = harness(async () => {
    throw new TypeError("network unavailable");
  });
  const response = await adapter.request({
    console: "account",
    path: "/api/account/profile",
  });
  assert.equal(response.status, 0);
  assert.equal(response.kind, "offline");
});

test("maps request timeouts and validation problems to typed responses", async () => {
  const timedOut = createDesktopApiAdapter({
    apiBaseUrl: "https://kitezh.onrender.com",
    fetcher: async (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("request aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    readSession: async () => session,
    writeSession: async () => {},
    clearSession: async () => {},
    timeoutMs: 1,
  });
  const timeoutResponse = await timedOut.request({
    console: "admin",
    path: "/api/admin/dashboard",
  });
  assert.equal(timeoutResponse.kind, "timeout");

  const { adapter } = harness(
    async () =>
      new Response(
        JSON.stringify({
          detail: "Correct the request.",
          violations: [{ field: "name", message: "Required." }],
        }),
        {
          status: 400,
          headers: { "content-type": "application/problem+json" },
        },
      ),
  );
  const validationResponse = await adapter.request({
    console: "admin",
    path: "/api/admin/dashboard",
  });
  assert.equal(validationResponse.kind, "validation");
  assert.equal(validationResponse.body.violations[0].field, "name");
});
