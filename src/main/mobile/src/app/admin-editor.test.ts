import assert from "node:assert/strict";
import test from "node:test";

import type {
  AdminClientRequest,
  AdminIdentityProviderRequest,
} from "@/api/admin-api";
import {
  editorDefaults,
  editorValues,
  toAdminRequest,
} from "./admin-editor.ts";

test("provides resource-specific defaults for mobile administration editors", () => {
  assert.deepEqual(editorDefaults("users"), {
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roles: "ROLE_USER",
  });
  assert.deepEqual(editorDefaults("clients"), {
    clientName: "",
    scopes: "openid,profile",
    redirectUris: "",
    postLogoutRedirectUris: "",
  });
  assert.deepEqual(editorDefaults("scopes"), {
    name: "",
    displayName: "",
    description: "",
  });
  assert.deepEqual(editorDefaults("roles"), {
    name: "ROLE_",
    description: "",
  });
  assert.deepEqual(editorDefaults("groups"), { name: "", parentId: "" });
  assert.deepEqual(editorDefaults("identity-providers"), {
    providerType: "oidc",
    iconKey: "generic",
    enabled: "true",
    showInAccountConsole: "always",
    syncMode: "import",
    clientAuthenticationMethod: "client_secret_basic",
    scopes: "openid,profile,email",
    userNameAttribute: "sub",
  });
});

test("normalizes user, role, and client form requests", () => {
  assert.deepEqual(
    toAdminRequest("users", {
      username: " alice ",
      firstName: " Alice ",
      lastName: " Smith ",
      email: " alice@example.test ",
      password: " secret ",
      roles: "ROLE_USER, ROLE_ADMIN\nROLE_AUDITOR",
    }),
    {
      username: "alice",
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.test",
      emailVerified: false,
      password: "secret",
      temporary: false,
      enabled: true,
      roles: ["ROLE_USER", "ROLE_ADMIN", "ROLE_AUDITOR"],
    },
  );

  const role = toAdminRequest("roles", {
    name: " ROLE_ADMIN ",
    description: " ",
  });
  assert.deepEqual(role, { name: "ROLE_ADMIN", description: null });

  const client = toAdminRequest("clients", {
    clientId: " mobile-app ",
    clientName: " Mobile app ",
    redirectUris: "kitezh://callback\n https://example.test/callback ",
    postLogoutRedirectUris: "kitezh://logout",
    scopes: "openid, profile, email",
  }) as AdminClientRequest;
  assert.equal(client.clientId, "mobile-app");
  assert.equal(client.clientName, "Mobile app");
  assert.deepEqual(client.redirectUris, [
    "kitezh://callback",
    "https://example.test/callback",
  ]);
  assert.deepEqual(client.postLogoutRedirectUris, ["kitezh://logout"]);
  assert.deepEqual(client.scopes, ["openid", "profile", "email"]);
  assert.equal(client.requireProofKey, true);
  assert.equal(client.tokenExchangeDownscopeOnly, false);
});

test("normalizes client-scope and group requests including optional values", () => {
  assert.deepEqual(
    toAdminRequest("scopes", {
      name: " profile ",
      displayName: " ",
      description: " User data ",
    }),
    {
      name: "profile",
      displayName: null,
      description: "User data",
      displayOnConsentScreen: true,
      consentScreenText: null,
      includeInTokenScope: true,
      groupMapperEnabled: false,
      groupClaimName: "groups",
      groupMapperFullPath: false,
    },
  );
  assert.deepEqual(
    toAdminRequest("groups", { name: " Operators ", parentId: "42" }),
    {
      name: "Operators",
      parentId: 42,
      attributes: {},
      defaultGroup: false,
    },
  );
  assert.deepEqual(toAdminRequest("groups", { name: "Root", parentId: " " }), {
    name: "Root",
    parentId: null,
    attributes: {},
    defaultGroup: false,
  });
});

test("normalizes identity-provider fields and applies optional defaults", () => {
  const provider = toAdminRequest("identity-providers", {
    registrationId: " github ",
    providerType: " OIDC ",
    displayName: " GitHub ",
    alias: " github-login ",
    iconKey: " ",
    clientId: " client-id ",
    clientSecret: " secret ",
    authorizationUri: " https://idp.example.test/auth ",
    tokenUri: " ",
    scopes: " ",
    userNameAttribute: " ",
  }) as AdminIdentityProviderRequest;
  assert.equal(provider.registrationId, "github");
  assert.equal(provider.providerType, "oidc");
  assert.equal(provider.displayName, "GitHub");
  assert.equal(provider.alias, "github-login");
  assert.equal(provider.iconKey, "generic");
  assert.equal(provider.clientId, "client-id");
  assert.equal(provider.clientSecret, "secret");
  assert.equal(provider.authorizationUri, "https://idp.example.test/auth");
  assert.equal(provider.tokenUri, null);
  assert.equal(provider.scopes, "openid,profile,email");
  assert.equal(provider.userNameAttribute, "sub");
  assert.equal(provider.samlMetadataUri, null);
  assert.equal(provider.samlPassSubject, false);
});

test("hydrates user, client, and provider editors from resource details", () => {
  assert.deepEqual(
    editorValues("users", {
      username: "alice",
      firstName: null,
      enabled: false,
      effectiveRoles: ["ROLE_USER", "ROLE_ADMIN"],
    }),
    {
      username: "alice",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      roles: "ROLE_USER,ROLE_ADMIN",
    },
  );
  assert.deepEqual(editorValues("users", { effectiveRoles: [] }), {
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    roles: "",
  });

  assert.deepEqual(
    editorValues("clients", {
      clientId: " mobile ",
      clientName: null,
      scopes: ["openid", "email"],
      redirectUris: ["https://example.test/callback"],
    }),
    {
      clientName: "",
      scopes: "openid,email",
      redirectUris: "https://example.test/callback",
      postLogoutRedirectUris: "",
      clientId: " mobile ",
    },
  );
  assert.equal(
    editorValues("clients", { scopes: "openid" }).scopes,
    "openid,profile",
  );

  assert.deepEqual(
    editorValues("identity-providers", {
      providerType: null,
      iconKey: "custom",
    }),
    {
      providerType: "oidc",
      iconKey: "generic",
      enabled: "true",
      showInAccountConsole: "always",
      syncMode: "import",
      clientAuthenticationMethod: "client_secret_basic",
      scopes: "openid,profile,email",
      userNameAttribute: "sub",
      registrationId: "",
      displayName: "",
      alias: "",
    },
  );
  assert.deepEqual(
    editorValues("scopes", {
      name: "orders.read",
      displayName: "Orders read",
      description: "Read order data",
    }),
    {
      name: "orders.read",
      displayName: "Orders read",
      description: "Read order data",
    },
  );
  assert.deepEqual(editorValues("roles", { name: "ROLE_USER" }), {
    name: "ROLE_USER",
    description: "",
  });
  assert.deepEqual(editorValues("groups", { name: "Operators", parentId: 2 }), {
    name: "Operators",
    parentId: "2",
  });
});
