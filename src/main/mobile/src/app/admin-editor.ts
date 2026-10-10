import type {
  AdminClientRequest,
  AdminClientScopeRequest,
  AdminGroupRequest,
  AdminIdentityProviderRequest,
  AdminRoleRequest,
  AdminUserRequest,
} from "@/api/admin-api";
import type { AdminEditorResource } from "@/components/AdminResourceEditor";

export function editorDefaults(
  resource: AdminEditorResource,
): Record<string, string> {
  if (resource === "users") {
    return {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      roles: "ROLE_USER",
    };
  }
  if (resource === "clients") {
    return {
      clientName: "",
      scopes: "openid,profile",
      redirectUris: "",
      postLogoutRedirectUris: "",
    };
  }
  if (resource === "scopes") {
    return { name: "", displayName: "", description: "" };
  }
  if (resource === "roles") return { name: "ROLE_", description: "" };
  if (resource === "groups") return { name: "", parentId: "" };
  return {
    providerType: "oidc",
    iconKey: "generic",
    enabled: "true",
    showInAccountConsole: "always",
    syncMode: "import",
    clientAuthenticationMethod: "client_secret_basic",
    scopes: "openid,profile,email",
    userNameAttribute: "sub",
  };
}

export function toAdminRequest(
  resource: AdminEditorResource,
  values: Record<string, string>,
):
  | AdminUserRequest
  | AdminClientRequest
  | AdminClientScopeRequest
  | AdminRoleRequest
  | AdminGroupRequest
  | AdminIdentityProviderRequest {
  if (resource === "users") {
    return {
      username: values.username.trim(),
      firstName: values.firstName?.trim() || null,
      lastName: values.lastName?.trim() || null,
      email: values.email?.trim() || null,
      emailVerified: false,
      password: values.password?.trim() || null,
      temporary: false,
      enabled: true,
      roles: splitValues(values.roles || "ROLE_USER"),
    };
  }
  if (resource === "clients") {
    return {
      clientId: values.clientId.trim(),
      clientName: values.clientName.trim(),
      clientAuthenticationMethods: ["client_secret_basic"],
      authorizationGrantTypes: ["authorization_code", "refresh_token"],
      redirectUris: splitValues(values.redirectUris || "", /\n/),
      postLogoutRedirectUris: splitValues(
        values.postLogoutRedirectUris || "",
        /\n/,
      ),
      scopes: splitValues(values.scopes || ""),
      requireAuthorizationConsent: true,
      requireProofKey: true,
      requireDpop: false,
      requireDpopJkt: false,
      dpopRefreshTokenOnly: false,
      dpopSigningAlgorithms: ["RS256", "ES256"],
      cibaDeliveryMode: "poll",
      cibaNotificationEndpoint: null,
      cibaClientNotificationToken: null,
      authorizationCodeTimeToLive: "PT5M",
      accessTokenTimeToLive: "PT5M",
      refreshTokenTimeToLive: "PT1H",
      serviceAccountEnabled: false,
      clientSecretTimeToLive: null,
      enabled: true,
      rootUrl: null,
      homeUrl: null,
      webOrigins: [],
      adminUrl: null,
      frontChannelLogout: false,
      backchannelLogout: false,
      jwkSetUrl: null,
      tokenEndpointAuthenticationSigningAlgorithm: null,
      x509CertificateSubjectDN: null,
      clientSecretGracePeriod: "PT24H",
      offlineSessionIdle: null,
      offlineSessionMax: null,
      tokenExchangeDownscopeOnly: false,
      tokenExchangeAllowDelegation: false,
      tokenExchangeAllowedAudiences: [],
    };
  }
  if (resource === "scopes") {
    return {
      name: values.name.trim(),
      displayName: values.displayName?.trim() || null,
      description: values.description?.trim() || null,
      displayOnConsentScreen: true,
      consentScreenText: null,
      includeInTokenScope: true,
      groupMapperEnabled: false,
      groupClaimName: "groups",
      groupMapperFullPath: false,
    };
  }
  if (resource === "roles") {
    return {
      name: values.name.trim(),
      description: values.description?.trim() || null,
    };
  }
  if (resource === "groups") {
    const parentId = values.parentId?.trim();
    return {
      name: values.name.trim(),
      parentId: parentId ? Number(parentId) : null,
      attributes: {},
      defaultGroup: false,
    };
  }
  return {
    registrationId: values.registrationId.trim(),
    providerType: values.providerType.trim().toLowerCase(),
    displayName: values.displayName.trim(),
    alias: values.alias.trim(),
    iconKey: values.iconKey.trim() || "generic",
    shortStateParameter: false,
    caseSensitiveUsername: false,
    enabled: true,
    clientId: values.clientId?.trim() || null,
    clientSecret: values.clientSecret?.trim() || null,
    hideOnLogin: false,
    accountLinkingOnly: false,
    trustEmail: false,
    mfaRequired: false,
    requiredClaims: null,
    storeTokens: false,
    storedTokensReadable: false,
    guiOrder: 0,
    showInAccountConsole: "always",
    syncMode: "import",
    authorizationUri: values.authorizationUri?.trim() || null,
    tokenUri: values.tokenUri?.trim() || null,
    userInfoUri: values.userInfoUri?.trim() || null,
    jwkSetUri: values.jwkSetUri?.trim() || null,
    issuerUri: values.issuerUri?.trim() || null,
    clientAuthenticationMethod: "client_secret_basic",
    scopes: values.scopes?.trim() || "openid,profile,email",
    userNameAttribute: values.userNameAttribute?.trim() || "sub",
    samlMetadataUri: null,
    samlAssertingPartyEntityId: null,
    samlSingleSignOnServiceUrl: null,
    samlSingleLogoutServiceUrl: null,
    samlIdpCertificate: null,
    samlSigningPrivateKey: null,
    samlSigningCertificate: null,
    samlServiceProviderEntityId: null,
    samlSignAuthnRequests: false,
    samlWantAssertionsSigned: false,
    samlNameIdFormat: null,
    samlPrincipalAttribute: null,
    samlEmailAttribute: null,
    samlFirstNameAttribute: null,
    samlLastNameAttribute: null,
    samlGroupsAttribute: null,
    samlDecryptionPrivateKey: null,
    samlDecryptionCertificate: null,
    samlSignatureAlgorithm: null,
    samlAuthnRequestBinding: null,
    samlResponseBinding: null,
    samlLogoutBinding: null,
    samlForceAuthentication: false,
    samlPassSubject: false,
  };
}

export function editorValues(
  resource: AdminEditorResource,
  item?: unknown,
): Record<string, string> {
  const source = (item ?? {}) as Record<string, unknown>;
  const values: Record<string, string> = { ...editorDefaults(resource) };
  for (const key of Object.keys(values)) {
    const value = source[key];
    if (value !== null && value !== undefined) values[key] = String(value);
  }
  if (resource === "users") {
    values.password = "";
    if (source.effectiveRoles)
      values.roles = (source.effectiveRoles as string[]).join(",");
  }
  if (resource === "clients") {
    values.clientId = String(source.clientId ?? "");
    values.clientName = String(source.clientName ?? "");
    values.scopes = Array.isArray(source.scopes)
      ? source.scopes.join(",")
      : "openid,profile";
  }
  if (resource === "identity-providers") {
    values.registrationId = String(source.registrationId ?? "");
    values.providerType = String(source.providerType ?? "oidc");
    values.displayName = String(source.displayName ?? "");
    values.alias = String(source.alias ?? "");
    values.iconKey = "generic";
  }
  return values;
}

function splitValues(value: string, separator = /[,\n]/) {
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}
