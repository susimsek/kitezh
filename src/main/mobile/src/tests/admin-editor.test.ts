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
  validateAdminEditor,
} from "../admin/admin-editor.ts";

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
  assert.equal(editorDefaults("identity-providers").providerType, "oidc");
  assert.equal(editorDefaults("identity-providers").enabled, "true");
  assert.equal(editorDefaults("identity-providers").samlResponseBinding, "POST");
});

test("validates mobile admin editors by field and accepts an optional edit password", () => {
  assert.deepEqual(
    validateAdminEditor(
      "users",
      { username: " ", email: "not-an-email", password: "short", roles: "" },
      true,
    ),
    {
      username: "required",
      email: "email",
      password: "password",
      roles: "role-required",
    },
  );
  assert.deepEqual(
    validateAdminEditor(
      "users",
      {
        username: "alice",
        email: "alice@example.test",
        password: "",
        roles: "ROLE_USER",
      },
      false,
    ),
    {},
  );
  assert.deepEqual(
    validateAdminEditor("roles", { name: "ROLE bad" }, true),
    { name: "role-format" },
  );
  assert.deepEqual(
    validateAdminEditor("groups", { name: "Operators", parentId: "1.5" }, true),
    { parentId: "parent-id" },
  );
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

test("preserves unedited identity-provider policy and SAML settings on update", () => {
  const values = editorValues("identity-providers", {
    registrationId: "acme",
    providerType: "saml",
    displayName: "Acme SSO",
    alias: "acme",
    iconKey: "generic",
    enabled: true,
    trustEmail: true,
    mfaRequired: true,
    storeTokens: true,
    storedTokensReadable: true,
    guiOrder: 4,
    showInAccountConsole: "when-linked",
    syncMode: "read_only",
    samlMetadataUri: "https://idp.example.test/metadata",
    samlIdpCertificate: "existing certificate",
    samlWantAssertionsSigned: true,
    samlResponseBinding: "REDIRECT",
  });
  const request = toAdminRequest("identity-providers", values) as AdminIdentityProviderRequest;
  assert.equal(request.trustEmail, true);
  assert.equal(request.mfaRequired, true);
  assert.equal(request.storeTokens, true);
  assert.equal(request.storedTokensReadable, true);
  assert.equal(request.guiOrder, 4);
  assert.equal(request.showInAccountConsole, "when-linked");
  assert.equal(request.syncMode, "read_only");
  assert.equal(request.samlMetadataUri, "https://idp.example.test/metadata");
  assert.equal(request.samlIdpCertificate, "existing certificate");
  assert.equal(request.samlWantAssertionsSigned, true);
  assert.equal(request.samlResponseBinding, "REDIRECT");
  assert.equal(request.clientSecret, null);
  assert.equal(request.samlSigningPrivateKey, null);
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

  const providerValues = editorValues("identity-providers", {
    providerType: null,
    iconKey: "custom",
    trustEmail: true,
  });
  assert.equal(providerValues.providerType, "oidc");
  assert.equal(providerValues.iconKey, "custom");
  assert.equal(providerValues.trustEmail, "true");
  assert.equal(providerValues.samlResponseBinding, "POST");
  assert.equal(providerValues.registrationId, "");
  assert.equal(providerValues.scopes, "openid,profile,email");
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
