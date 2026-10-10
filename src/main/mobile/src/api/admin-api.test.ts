import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminApiError,
  getAdminDashboard,
  listAdminUsers,
  listAdminClients,
  listAdminClientScopes,
  listAdminGroups,
  listAdminIdentityProviders,
  listAdminSessions,
  deleteAdminSession,
  listAdminConsents,
  revokeAdminConsent,
  listAdminRoles,
  deleteAdminUser,
  setAdminUserEnabled,
  createAdminUser,
  updateAdminUser,
  createAdminClient,
  updateAdminClient,
  deleteAdminClient,
  createAdminClientScope,
  updateAdminClientScope,
  deleteAdminClientScope,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  createAdminGroup,
  updateAdminGroup,
  deleteAdminGroup,
  createAdminIdentityProvider,
  updateAdminIdentityProvider,
  deleteAdminIdentityProvider,
  listAdminKeys,
  rotateAdminKey,
  listAdminEvents,
  deleteAdminEvents,
} from "./admin-api.ts";

test("admin dashboard uses the admin API scope endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request: RequestInfo | URL | undefined;
  let authorization: string | null | undefined;
  globalThis.fetch = async (input, init) => {
    request = input;
    authorization = new Headers(init?.headers).get("Authorization");
    return new Response(
      JSON.stringify({ clients: 3, users: 4, sessions: 2, consents: 1 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    assert.deepEqual(await getAdminDashboard("access-token"), {
      clients: 3,
      users: 4,
      sessions: 2,
      consents: 1,
    });
    assert.equal(
      request?.toString(),
      "https://kitezh.onrender.com/api/admin/dashboard",
    );
    assert.equal(authorization, "Bearer access-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin dashboard refreshes once after an unauthorized response", async () => {
  const originalFetch = globalThis.fetch;
  const tokens: string[] = [];
  globalThis.fetch = async (_input, init) => {
    tokens.push(new Headers(init?.headers).get("Authorization") ?? "");
    if (tokens.length === 1) return new Response(null, { status: 401 });
    return new Response(
      JSON.stringify({ clients: 1, users: 1, sessions: 1, consents: 1 }),
      { status: 200 },
    );
  };
  try {
    await getAdminDashboard("expired-token", {
      refreshAccessToken: async () => "fresh-token",
    });
    assert.deepEqual(tokens, ["Bearer expired-token", "Bearer fresh-token"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin dashboard preserves forbidden status for the native shell", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 403 });
  try {
    await assert.rejects(
      getAdminDashboard("access-token"),
      (error: unknown) =>
        error instanceof AdminApiError && error.status === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin requests classify timeout and offline failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        { once: true },
      );
    });
  try {
    await assert.rejects(
      getAdminDashboard("access-token", { timeoutMs: 5 }),
      (error: unknown) =>
        error instanceof AdminApiError &&
        error.status === 0 &&
        error.kind === "timeout",
    );
  } finally {
    globalThis.fetch = async () => {
      throw new TypeError("private transport detail");
    };
    try {
      await assert.rejects(
        getAdminDashboard("access-token"),
        (error: unknown) =>
          error instanceof AdminApiError && error.kind === "offline",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
});

test("admin users request encodes search and pagination parameters", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({
        content: [],
        number: 1,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminUsers("access-token", "ada@example.test", 1, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/users?q=ada%40example.test&page=1&size=10&sort=username%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin user mutations use protected HTTP methods and JSON state", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      body: init?.body?.toString() ?? null,
      method: init?.method ?? "GET",
      url: input.toString(),
    });
    return new Response(null, { status: 204 });
  };
  try {
    await setAdminUserEnabled("access-token", 7, false);
    await deleteAdminUser("access-token", 7);
    assert.deepEqual(calls, [
      {
        body: JSON.stringify({ enabled: false }),
        method: "PUT",
        url: "https://kitezh.onrender.com/api/admin/users/7/enabled",
      },
      {
        body: null,
        method: "DELETE",
        url: "https://kitezh.onrender.com/api/admin/users/7",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("native admin resource mutations use JSON contracts and protected paths", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      body: init?.body?.toString() ?? null,
      method: init?.method ?? "GET",
      url: input.toString(),
    });
    return new Response(
      JSON.stringify({ client: { id: "client-1" }, clientSecret: null }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  try {
    await createAdminUser("access-token", {
      username: "native-user",
      roles: ["ROLE_USER"],
    });
    await updateAdminClient("access-token", "client-1", {
      clientId: "client-1",
      clientName: "Native client",
      clientAuthenticationMethods: ["none"],
      authorizationGrantTypes: ["authorization_code"],
      redirectUris: [],
      postLogoutRedirectUris: [],
      scopes: ["openid"],
      requireAuthorizationConsent: true,
      requireProofKey: true,
      requireDpop: false,
      requireDpopJkt: false,
      dpopRefreshTokenOnly: false,
      dpopSigningAlgorithms: ["RS256"],
      cibaDeliveryMode: "poll",
      authorizationCodeTimeToLive: "PT5M",
      accessTokenTimeToLive: "PT5M",
      refreshTokenTimeToLive: "PT1H",
      serviceAccountEnabled: false,
      webOrigins: [],
      tokenExchangeAllowedAudiences: [],
    });
    await deleteAdminGroup("access-token", 12);
    await createAdminIdentityProvider("access-token", {
      registrationId: "native",
      providerType: "oidc",
      displayName: "Native OIDC",
      alias: "native",
      iconKey: "generic",
      shortStateParameter: false,
      caseSensitiveUsername: false,
      enabled: true,
      hideOnLogin: false,
      accountLinkingOnly: false,
      trustEmail: false,
      mfaRequired: false,
      storeTokens: false,
      storedTokensReadable: false,
      guiOrder: 0,
      showInAccountConsole: "always",
      syncMode: "import",
      clientAuthenticationMethod: "client_secret_basic",
      scopes: "openid profile",
      userNameAttribute: "sub",
      samlSignAuthnRequests: false,
      samlWantAssertionsSigned: false,
      samlForceAuthentication: false,
      samlPassSubject: false,
    });
    assert.deepEqual(
      calls.map(({ method, url }) => ({ method, url })),
      [
        { method: "POST", url: "https://kitezh.onrender.com/api/admin/users" },
        {
          method: "PUT",
          url: "https://kitezh.onrender.com/api/admin/clients/client-1",
        },
        {
          method: "DELETE",
          url: "https://kitezh.onrender.com/api/admin/groups/12",
        },
        {
          method: "POST",
          url: "https://kitezh.onrender.com/api/admin/identity-providers",
        },
      ],
    );
    assert.match(calls[0].body ?? "", /native-user/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin CRUD wrappers send the expected JSON methods and encoded resource paths", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      body: init?.body?.toString() ?? null,
      method: init?.method ?? "GET",
      url: input.toString(),
    });
    return new Response(JSON.stringify({ id: "created" }), { status: 200 });
  };
  const payload = { name: "native-resource" } as never;
  try {
    await updateAdminUser("token", 4, payload);
    await createAdminClient("token", payload);
    await deleteAdminClient("token", "client/one");
    await createAdminClientScope("token", payload);
    await updateAdminClientScope("token", "scope/one", payload);
    await deleteAdminClientScope("token", "scope/one");
    await createAdminRole("token", payload);
    await updateAdminRole("token", "ROLE/ADMIN", payload);
    await deleteAdminRole("token", "ROLE/ADMIN");
    await createAdminGroup("token", payload);
    await updateAdminGroup("token", 12, payload);
    await updateAdminIdentityProvider("token", "oidc/one", payload);
    await deleteAdminIdentityProvider("token", "oidc/one");

    assert.deepEqual(
      calls.map(({ method, url }) => ({ method, url })),
      [
        { method: "PUT", url: "https://kitezh.onrender.com/api/admin/users/4" },
        {
          method: "POST",
          url: "https://kitezh.onrender.com/api/admin/clients",
        },
        {
          method: "DELETE",
          url: "https://kitezh.onrender.com/api/admin/clients/client%2Fone",
        },
        {
          method: "POST",
          url: "https://kitezh.onrender.com/api/admin/client-scopes",
        },
        {
          method: "PUT",
          url: "https://kitezh.onrender.com/api/admin/client-scopes/scope%2Fone",
        },
        {
          method: "DELETE",
          url: "https://kitezh.onrender.com/api/admin/client-scopes/scope%2Fone",
        },
        { method: "POST", url: "https://kitezh.onrender.com/api/admin/roles" },
        {
          method: "PUT",
          url: "https://kitezh.onrender.com/api/admin/roles/ROLE%2FADMIN",
        },
        {
          method: "DELETE",
          url: "https://kitezh.onrender.com/api/admin/roles/ROLE%2FADMIN",
        },
        { method: "POST", url: "https://kitezh.onrender.com/api/admin/groups" },
        {
          method: "PUT",
          url: "https://kitezh.onrender.com/api/admin/groups/12",
        },
        {
          method: "PUT",
          url: "https://kitezh.onrender.com/api/admin/identity-providers/oidc%2Fone",
        },
        {
          method: "DELETE",
          url: "https://kitezh.onrender.com/api/admin/identity-providers/oidc%2Fone",
        },
      ],
    );
    assert.ok(
      calls
        .filter(({ body }) => body !== null)
        .every(({ body }) => body === JSON.stringify(payload)),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin clients request uses a bounded sorted page", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminClients("access-token", "mobile", 0, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/clients?q=mobile&page=0&size=10&sort=clientId%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin client scopes request uses a bounded sorted page", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminClientScopes("access-token", "profile", 0, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/client-scopes?q=profile&page=0&size=10&sort=name%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin roles and groups requests use bounded sorted pages", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(input.toString());
    return new Response(
      JSON.stringify({
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminRoles("access-token", "admin", 0, 10);
    await listAdminGroups("access-token", "finance", 1, 10);
    assert.deepEqual(requests, [
      "https://kitezh.onrender.com/api/admin/roles?q=admin&page=0&size=10&sort=name%2Casc",
      "https://kitezh.onrender.com/api/admin/groups?q=finance&page=1&size=10&sort=name%2Casc",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin identity providers request uses the login-order sort", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminIdentityProviders("access-token", "google", 0, 10);
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/identity-providers?q=google&page=0&size=10&sort=guiOrder%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin sessions request encodes status and client filters", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminSessions(
      "access-token",
      "ada",
      "active",
      "account-console",
      0,
      10,
    );
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/sessions?q=ada&clientId=account-console&status=active&page=0&size=10&sort=lastAccessTime%2Cdesc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin session deletion uses the protected delete endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let method = "";
  let request = "";
  globalThis.fetch = async (input, init) => {
    request = input.toString();
    method = init?.method ?? "GET";
    return new Response(null, { status: 204 });
  };
  try {
    await deleteAdminSession("access-token", "session/one");
    assert.equal(method, "DELETE");
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/sessions/session%2Fone",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin consents request encodes all filters and stable sort", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  globalThis.fetch = async (input) => {
    request = input.toString();
    return new Response(
      JSON.stringify({
        content: [],
        number: 0,
        size: 10,
        totalElements: 0,
        totalPages: 0,
      }),
      { status: 200 },
    );
  };
  try {
    await listAdminConsents(
      "access-token",
      "account",
      "account-console",
      "ada",
      "openid",
    );
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/consents?q=account&clientId=account-console&username=ada&scope=openid&page=0&size=10&sort=id.principalName%2Casc",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin consent revoke encodes client and username", async () => {
  const originalFetch = globalThis.fetch;
  let request = "";
  let method = "";
  globalThis.fetch = async (input, init) => {
    request = input.toString();
    method = init?.method ?? "GET";
    return new Response(null, { status: 204 });
  };
  try {
    await revokeAdminConsent("access-token", "client/one", "ada@example.com");
    assert.equal(method, "DELETE");
    assert.equal(
      request,
      "https://kitezh.onrender.com/api/admin/consents/client%2Fone/ada%40example.com",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin keys and events expose bounded native management endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; method: string }[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: input.toString(), method: init?.method ?? "GET" });
    return init?.method === "POST" || init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : new Response(
          JSON.stringify({
            content: [],
            number: 0,
            size: 10,
            totalElements: 0,
            totalPages: 0,
          }),
          { status: 200 },
        );
  };
  try {
    await listAdminKeys("access-token", "rsa", true);
    await rotateAdminKey("access-token");
    await listAdminEvents("access-token", "user.updated");
    await deleteAdminEvents("access-token");
    assert.deepEqual(requests, [
      {
        url: "https://kitezh.onrender.com/api/admin/keys?q=rsa&page=0&size=10&sort=createdAt%2Cdesc&active=true",
        method: "GET",
      },
      {
        url: "https://kitezh.onrender.com/api/admin/keys/rotate",
        method: "POST",
      },
      {
        url: "https://kitezh.onrender.com/api/admin/events?q=user.updated&action=&targetType=&targetId=&page=0&size=10&sort=occurredAt%2Cdesc",
        method: "GET",
      },
      { url: "https://kitezh.onrender.com/api/admin/events", method: "DELETE" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
