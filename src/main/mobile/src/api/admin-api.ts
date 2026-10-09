import { authorizationServerIssuer } from "../config.ts";
import {
  classifyApiError,
  parseProblemDetail,
  type ApiErrorKind,
  type ProblemDetail,
} from "../../../shared/src/api.ts";

export type AdminDashboard = {
  clients: number;
  users: number;
  sessions: number;
  consents: number;
};

export type AdminUser = {
  id: number;
  username: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  enabled: boolean;
  locked: boolean;
  effectiveRoles: string[];
};

export type AdminPage<T> = {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AdminClient = {
  id: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  enabled: boolean;
  serviceAccountEnabled: boolean;
};

export type AdminClientScope = {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  builtIn: boolean;
  displayOnConsentScreen: boolean;
  includeInTokenScope: boolean;
};

export type AdminRole = {
  name: string;
  description: string | null;
};

export type AdminGroup = {
  id: number;
  name: string;
  path: string;
  parentId: number | null;
  roles: string[];
  effectiveRoles: string[];
  defaultGroup: boolean;
  userCount: number;
};

export type AdminIdentityProvider = {
  id: string;
  registrationId: string;
  providerType: string;
  displayName: string;
  alias: string;
  enabled: boolean;
  configured: boolean;
  hideOnLogin: boolean;
  mapperCount: number;
};

export type AdminSession = {
  id: string;
  username: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  authorizationCount: number;
  active: boolean;
};

export type AdminConsent = {
  clientId: string;
  clientName: string;
  principalName: string;
  userId: number;
  authorities: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminKey = {
  id: string;
  kid: string;
  type: string;
  algorithm: string;
  use: string;
  active: boolean;
  createdAt: string;
};

export type AdminEvent = {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  occurredAt: string;
};

export type AdminUserRequest = {
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  password?: string | null;
  temporary?: boolean | null;
  enabled?: boolean;
  roles: string[];
};

export type AdminClientRequest = {
  clientId: string;
  clientName: string;
  clientAuthenticationMethods: string[];
  authorizationGrantTypes: string[];
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scopes: string[];
  requireAuthorizationConsent: boolean;
  requireProofKey: boolean;
  requireDpop: boolean;
  requireDpopJkt: boolean;
  dpopRefreshTokenOnly: boolean;
  dpopSigningAlgorithms: string[];
  cibaDeliveryMode: string;
  cibaNotificationEndpoint?: string | null;
  cibaClientNotificationToken?: string | null;
  authorizationCodeTimeToLive: string;
  accessTokenTimeToLive: string;
  refreshTokenTimeToLive: string;
  serviceAccountEnabled: boolean;
  clientSecretTimeToLive?: string | null;
  enabled?: boolean | null;
  rootUrl?: string | null;
  homeUrl?: string | null;
  webOrigins: string[];
  adminUrl?: string | null;
  frontChannelLogout?: boolean | null;
  backchannelLogout?: boolean | null;
  jwkSetUrl?: string | null;
  tokenEndpointAuthenticationSigningAlgorithm?: string | null;
  x509CertificateSubjectDN?: string | null;
  clientSecretGracePeriod?: string | null;
  offlineSessionIdle?: string | null;
  offlineSessionMax?: string | null;
  tokenExchangeDownscopeOnly?: boolean | null;
  tokenExchangeAllowDelegation?: boolean | null;
  tokenExchangeAllowedAudiences: string[];
};

export type AdminClientScopeRequest = {
  name: string;
  displayName?: string | null;
  description?: string | null;
  displayOnConsentScreen?: boolean;
  consentScreenText?: string | null;
  includeInTokenScope?: boolean;
  groupMapperEnabled?: boolean;
  groupClaimName?: string;
  groupMapperFullPath?: boolean;
};

export type AdminRoleRequest = { name: string; description?: string | null };

export type AdminGroupRequest = {
  name: string;
  parentId?: number | null;
  attributes?: Record<string, string[]>;
  defaultGroup?: boolean;
};

export type AdminIdentityProviderRequest = {
  registrationId: string;
  providerType: string;
  displayName: string;
  alias: string;
  iconKey: string;
  shortStateParameter: boolean;
  caseSensitiveUsername: boolean;
  enabled: boolean;
  clientId?: string | null;
  clientSecret?: string | null;
  hideOnLogin: boolean;
  accountLinkingOnly: boolean;
  trustEmail: boolean;
  mfaRequired: boolean;
  requiredClaims?: string | null;
  storeTokens: boolean;
  storedTokensReadable: boolean;
  guiOrder: number;
  showInAccountConsole: string;
  syncMode: string;
  authorizationUri?: string | null;
  tokenUri?: string | null;
  userInfoUri?: string | null;
  jwkSetUri?: string | null;
  issuerUri?: string | null;
  clientAuthenticationMethod: string;
  scopes: string;
  userNameAttribute: string;
  samlMetadataUri?: string | null;
  samlAssertingPartyEntityId?: string | null;
  samlSingleSignOnServiceUrl?: string | null;
  samlSingleLogoutServiceUrl?: string | null;
  samlIdpCertificate?: string | null;
  samlSigningPrivateKey?: string | null;
  samlSigningCertificate?: string | null;
  samlServiceProviderEntityId?: string | null;
  samlSignAuthnRequests: boolean;
  samlWantAssertionsSigned: boolean;
  samlNameIdFormat?: string | null;
  samlPrincipalAttribute?: string | null;
  samlEmailAttribute?: string | null;
  samlFirstNameAttribute?: string | null;
  samlLastNameAttribute?: string | null;
  samlGroupsAttribute?: string | null;
  samlDecryptionPrivateKey?: string | null;
  samlDecryptionCertificate?: string | null;
  samlSignatureAlgorithm?: string | null;
  samlAuthnRequestBinding?: string | null;
  samlResponseBinding?: string | null;
  samlLogoutBinding?: string | null;
  samlForceAuthentication: boolean;
  samlPassSubject: boolean;
};

export type AdminClientCreated = { client: AdminClient; clientSecret: string | null };

export class AdminApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly problem: ProblemDetail | undefined;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
  }
}

type RequestOptions = {
  refreshAccessToken?: () => Promise<string | null>;
  signal?: AbortSignal;
};

function adminApiUrl(path: string) {
  return `${authorizationServerIssuer.replace(/\/$/, "")}${path}`;
}

async function requestAdmin<T>(
  accessToken: string,
  path: string,
  options: RequestOptions,
  retried: boolean,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(adminApiUrl(path), {
      ...init,
      headers: {
        ...init.headers,
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new AdminApiError(0, "Administration request failed", cause);
  }

  if (response.status === 401 && !retried && options.refreshAccessToken) {
    const refreshedAccessToken = await options.refreshAccessToken();
    if (refreshedAccessToken) {
      return requestAdmin(
        refreshedAccessToken,
        path,
        options,
        true,
        init,
      );
    }
  }
  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    throw new AdminApiError(response.status, "Administration request failed", data);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function getAdminDashboard(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminDashboard>(
    accessToken,
    "/api/admin/dashboard",
    options,
    false,
  );
}

export function listAdminUsers(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "username,asc",
  });
  return requestAdmin<AdminPage<AdminUser>>(
    accessToken,
    `/api/admin/users?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminClients(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "clientId,asc",
  });
  return requestAdmin<AdminPage<AdminClient>>(
    accessToken,
    `/api/admin/clients?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminClientScopes(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "name,asc",
  });
  return requestAdmin<AdminPage<AdminClientScope>>(
    accessToken,
    `/api/admin/client-scopes?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminRoles(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "name,asc",
  });
  return requestAdmin<AdminPage<AdminRole>>(
    accessToken,
    `/api/admin/roles?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminGroups(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "name,asc",
  });
  return requestAdmin<AdminPage<AdminGroup>>(
    accessToken,
    `/api/admin/groups?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminIdentityProviders(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "guiOrder,asc",
  });
  return requestAdmin<AdminPage<AdminIdentityProvider>>(
    accessToken,
    `/api/admin/identity-providers?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminSessions(
  accessToken: string,
  query = "",
  status = "active",
  clientId = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    clientId,
    status,
    page: String(page),
    size: String(size),
    sort: "lastAccessTime,desc",
  });
  return requestAdmin<AdminPage<AdminSession>>(
    accessToken,
    `/api/admin/sessions?${params.toString()}`,
    options,
    false,
  );
}

export function deleteAdminSession(
  accessToken: string,
  sessionId: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/sessions/${encodeURIComponent(sessionId)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function listAdminConsents(
  accessToken: string,
  query = "",
  clientId = "",
  username = "",
  scope = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    clientId,
    username,
    scope,
    page: String(page),
    size: String(size),
    sort: "id.principalName,asc",
  });
  return requestAdmin<AdminPage<AdminConsent>>(
    accessToken,
    `/api/admin/consents?${params.toString()}`,
    options,
    false,
  );
}

export function listAdminKeys(
  accessToken: string,
  query = "",
  active: boolean | undefined = undefined,
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({ q: query, page: String(page), size: String(size), sort: "createdAt,desc" });
  if (active !== undefined) params.set("active", String(active));
  return requestAdmin<AdminPage<AdminKey>>(accessToken, `/api/admin/keys?${params.toString()}`, options, false);
}

export function rotateAdminKey(accessToken: string, options: RequestOptions = {}) {
  return requestAdmin<AdminKey>(accessToken, "/api/admin/keys/rotate", options, false, { method: "POST" });
}

export function listAdminEvents(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({ q: query, action: "", targetType: "", targetId: "", page: String(page), size: String(size), sort: "occurredAt,desc" });
  return requestAdmin<AdminPage<AdminEvent>>(accessToken, `/api/admin/events?${params.toString()}`, options, false);
}

export function deleteAdminEvents(accessToken: string, options: RequestOptions = {}) {
  return requestAdmin<void>(accessToken, "/api/admin/events", options, false, { method: "DELETE" });
}

export function revokeAdminConsent(
  accessToken: string,
  clientId: string,
  username: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/consents/${encodeURIComponent(clientId)}/${encodeURIComponent(username)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function setAdminUserEnabled(
  accessToken: string,
  userId: number,
  enabled: boolean,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/users/${encodeURIComponent(userId)}/enabled`,
    options,
    false,
    {
      body: JSON.stringify({ enabled }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    },
  );
}

export function deleteAdminUser(
  accessToken: string,
  userId: number,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/users/${encodeURIComponent(userId)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function unlockAdminUser(
  accessToken: string,
  userId: number,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/users/${encodeURIComponent(userId)}/unlock`,
    options,
    false,
    { method: "POST" },
  );
}

function jsonRequest<T>(
  accessToken: string,
  path: string,
  body: unknown,
  options: RequestOptions = {},
  method: "POST" | "PUT" = "POST",
) {
  return requestAdmin<T>(accessToken, path, options, false, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method,
  });
}

export function createAdminUser(
  accessToken: string,
  request: AdminUserRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminUser>(accessToken, "/api/admin/users", request, options);
}

export function updateAdminUser(
  accessToken: string,
  userId: number,
  request: AdminUserRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminUser>(
    accessToken,
    `/api/admin/users/${encodeURIComponent(userId)}`,
    request,
    options,
    "PUT",
  );
}

export function createAdminClient(
  accessToken: string,
  request: AdminClientRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminClientCreated>(accessToken, "/api/admin/clients", request, options);
}

export function updateAdminClient(
  accessToken: string,
  clientId: string,
  request: AdminClientRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminClient>(
    accessToken,
    `/api/admin/clients/${encodeURIComponent(clientId)}`,
    request,
    options,
    "PUT",
  );
}

export function deleteAdminClient(
  accessToken: string,
  clientId: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/clients/${encodeURIComponent(clientId)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function createAdminClientScope(
  accessToken: string,
  request: AdminClientScopeRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminClientScope>(
    accessToken,
    "/api/admin/client-scopes",
    request,
    options,
  );
}

export function updateAdminClientScope(
  accessToken: string,
  scopeId: string,
  request: AdminClientScopeRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminClientScope>(
    accessToken,
    `/api/admin/client-scopes/${encodeURIComponent(scopeId)}`,
    request,
    options,
    "PUT",
  );
}

export function deleteAdminClientScope(
  accessToken: string,
  scopeId: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/client-scopes/${encodeURIComponent(scopeId)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function createAdminRole(
  accessToken: string,
  request: AdminRoleRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminRole>(accessToken, "/api/admin/roles", request, options);
}

export function updateAdminRole(
  accessToken: string,
  roleName: string,
  request: AdminRoleRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminRole>(
    accessToken,
    `/api/admin/roles/${encodeURIComponent(roleName)}`,
    request,
    options,
    "PUT",
  );
}

export function deleteAdminRole(
  accessToken: string,
  roleName: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/roles/${encodeURIComponent(roleName)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function createAdminGroup(
  accessToken: string,
  request: AdminGroupRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminGroup>(accessToken, "/api/admin/groups", request, options);
}

export function updateAdminGroup(
  accessToken: string,
  groupId: number,
  request: AdminGroupRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminGroup>(
    accessToken,
    `/api/admin/groups/${encodeURIComponent(groupId)}`,
    request,
    options,
    "PUT",
  );
}

export function deleteAdminGroup(
  accessToken: string,
  groupId: number,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/groups/${encodeURIComponent(groupId)}`,
    options,
    false,
    { method: "DELETE" },
  );
}

export function createAdminIdentityProvider(
  accessToken: string,
  request: AdminIdentityProviderRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminIdentityProvider>(
    accessToken,
    "/api/admin/identity-providers",
    request,
    options,
  );
}

export function updateAdminIdentityProvider(
  accessToken: string,
  providerId: string,
  request: AdminIdentityProviderRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminIdentityProvider>(
    accessToken,
    `/api/admin/identity-providers/${encodeURIComponent(providerId)}`,
    request,
    options,
    "PUT",
  );
}

export function deleteAdminIdentityProvider(
  accessToken: string,
  providerId: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(
    accessToken,
    `/api/admin/identity-providers/${encodeURIComponent(providerId)}`,
    options,
    false,
    { method: "DELETE" },
  );
}
