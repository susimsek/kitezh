import type {
  AdminClientRequest,
  AdminClientScopeRequest,
  AdminGroupRequest,
  AdminIdentityProviderRequest,
  AdminRoleRequest,
  AdminUserRequest,
} from "@/api/admin-api";
import type { AdminEditorResource } from "@/components/AdminResourceEditor";
import { isValidEmail } from "../validation/email.ts";

export type AdminEditorFieldError =
  | "required"
  | "email"
  | "password"
  | "role-required"
  | "role-format"
  | "parent-id";

export function validateAdminEditor(
  resource: AdminEditorResource,
  values: Record<string, string>,
  isCreate: boolean,
): Record<string, AdminEditorFieldError> {
  const errors: Record<string, AdminEditorFieldError> = {};
  const required = (key: string) => {
    if (!values[key]?.trim()) errors[key] = "required";
  };

  if (resource === "users") {
    required("username");
    if (values.email?.trim() && !isValidEmail(values.email.trim())) {
      errors.email = "email";
    }
    if (isCreate && (values.password?.length ?? 0) < 12) {
      errors.password = "password";
    }
    if (!splitValues(values.roles ?? "").length) {
      errors.roles = "role-required";
    }
  } else if (resource === "clients") {
    required("clientId");
    required("clientName");
    required("scopes");
  } else if (resource === "scopes") {
    required("name");
  } else if (resource === "roles") {
    required("name");
    if (values.name?.trim() && !/^ROLE_[A-Z0-9_]+$/.test(values.name.trim())) {
      errors.name = "role-format";
    }
  } else if (resource === "groups") {
    required("name");
    const parentId = values.parentId?.trim();
    if (parentId && (!/^\d+$/.test(parentId) || Number(parentId) < 1)) {
      errors.parentId = "parent-id";
    }
  } else {
    for (const key of [
      "registrationId",
      "providerType",
      "displayName",
      "alias",
      "iconKey",
    ]) {
      required(key);
    }
  }

  return errors;
}

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
    shortStateParameter: "false",
    caseSensitiveUsername: "false",
    enabled: "true",
    hideOnLogin: "false",
    accountLinkingOnly: "false",
    trustEmail: "false",
    mfaRequired: "false",
    requiredClaims: "",
    storeTokens: "false",
    storedTokensReadable: "false",
    guiOrder: "0",
    showInAccountConsole: "always",
    syncMode: "import",
    clientAuthenticationMethod: "client_secret_basic",
    scopes: "openid,profile,email",
    userNameAttribute: "sub",
    samlMetadataUri: "",
    samlAssertingPartyEntityId: "",
    samlSingleSignOnServiceUrl: "",
    samlSingleLogoutServiceUrl: "",
    samlIdpCertificate: "",
    samlSigningCertificate: "",
    samlServiceProviderEntityId: "",
    samlSignAuthnRequests: "false",
    samlWantAssertionsSigned: "true",
    samlNameIdFormat: "",
    samlPrincipalAttribute: "NameID",
    samlEmailAttribute: "email",
    samlFirstNameAttribute: "givenName",
    samlLastNameAttribute: "sn",
    samlGroupsAttribute: "groups",
    samlDecryptionCertificate: "",
    samlSignatureAlgorithm: "",
    samlAuthnRequestBinding: "REDIRECT",
    samlResponseBinding: "POST",
    samlLogoutBinding: "REDIRECT",
    samlForceAuthentication: "false",
    samlPassSubject: "false",
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
    shortStateParameter: parseBoolean(values.shortStateParameter),
    caseSensitiveUsername: parseBoolean(values.caseSensitiveUsername),
    enabled: parseBoolean(values.enabled, true),
    clientId: values.clientId?.trim() || null,
    clientSecret: values.clientSecret?.trim() || null,
    hideOnLogin: parseBoolean(values.hideOnLogin),
    accountLinkingOnly: parseBoolean(values.accountLinkingOnly),
    trustEmail: parseBoolean(values.trustEmail),
    mfaRequired: parseBoolean(values.mfaRequired),
    requiredClaims: values.requiredClaims?.trim() || null,
    storeTokens: parseBoolean(values.storeTokens),
    storedTokensReadable: parseBoolean(values.storedTokensReadable),
    guiOrder: parseNonNegativeInteger(values.guiOrder),
    showInAccountConsole: values.showInAccountConsole?.trim() || "always",
    syncMode: values.syncMode?.trim() || "import",
    authorizationUri: values.authorizationUri?.trim() || null,
    tokenUri: values.tokenUri?.trim() || null,
    userInfoUri: values.userInfoUri?.trim() || null,
    jwkSetUri: values.jwkSetUri?.trim() || null,
    issuerUri: values.issuerUri?.trim() || null,
    clientAuthenticationMethod:
      values.clientAuthenticationMethod?.trim() || "client_secret_basic",
    scopes: values.scopes?.trim() || "openid,profile,email",
    userNameAttribute: values.userNameAttribute?.trim() || "sub",
    samlMetadataUri: values.samlMetadataUri?.trim() || null,
    samlAssertingPartyEntityId: values.samlAssertingPartyEntityId?.trim() || null,
    samlSingleSignOnServiceUrl: values.samlSingleSignOnServiceUrl?.trim() || null,
    samlSingleLogoutServiceUrl: values.samlSingleLogoutServiceUrl?.trim() || null,
    samlIdpCertificate: values.samlIdpCertificate?.trim() || null,
    samlSigningPrivateKey: null,
    samlSigningCertificate: values.samlSigningCertificate?.trim() || null,
    samlServiceProviderEntityId: values.samlServiceProviderEntityId?.trim() || null,
    samlSignAuthnRequests: parseBoolean(values.samlSignAuthnRequests),
    samlWantAssertionsSigned: parseBoolean(values.samlWantAssertionsSigned, true),
    samlNameIdFormat: values.samlNameIdFormat?.trim() || null,
    samlPrincipalAttribute: values.samlPrincipalAttribute?.trim() || null,
    samlEmailAttribute: values.samlEmailAttribute?.trim() || null,
    samlFirstNameAttribute: values.samlFirstNameAttribute?.trim() || null,
    samlLastNameAttribute: values.samlLastNameAttribute?.trim() || null,
    samlGroupsAttribute: values.samlGroupsAttribute?.trim() || null,
    samlDecryptionPrivateKey: null,
    samlDecryptionCertificate: values.samlDecryptionCertificate?.trim() || null,
    samlSignatureAlgorithm: values.samlSignatureAlgorithm?.trim() || null,
    samlAuthnRequestBinding: values.samlAuthnRequestBinding?.trim() || "REDIRECT",
    samlResponseBinding: values.samlResponseBinding?.trim() || "POST",
    samlLogoutBinding: values.samlLogoutBinding?.trim() || "REDIRECT",
    samlForceAuthentication: parseBoolean(values.samlForceAuthentication),
    samlPassSubject: parseBoolean(values.samlPassSubject),
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
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      values[key] = String(value);
    } else if (
      Array.isArray(value) &&
      value.every((entry) => typeof entry === "string")
    ) {
      values[key] = value.join(",");
    }
  }
  if (resource === "users") {
    values.password = "";
    if (source.effectiveRoles)
      values.roles = (source.effectiveRoles as string[]).join(",");
  }
  if (resource === "clients") {
    values.clientId = toDisplayString(source.clientId);
    values.clientName = toDisplayString(source.clientName);
    values.scopes = Array.isArray(source.scopes)
      ? source.scopes.join(",")
      : "openid,profile";
  }
  if (resource === "identity-providers") {
    values.registrationId = toDisplayString(source.registrationId);
    values.providerType = toDisplayString(source.providerType, "oidc");
    values.displayName = toDisplayString(source.displayName);
    values.alias = toDisplayString(source.alias);
    values.iconKey = toDisplayString(source.iconKey, "generic");
  }
  return values;
}

function toDisplayString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function splitValues(value: string, separator = /[,\n]/) {
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback = false) {
  return value === undefined || value === "" ? fallback : value === "true";
}

function parseNonNegativeInteger(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}
