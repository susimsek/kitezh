import {
  classifyApiError,
  createNativeRequestSignal,
  DEFAULT_NATIVE_API_TIMEOUT_MS,
  parseRetryAfterMs,
  parseProblemDetail,
  readRetryAfterHeader,
  type ApiErrorKind,
  type ProblemDetail,
} from "../../../shared/src/api.ts";
import {
  createMobileApiClient,
  getMobileTransportCause,
  readMobileResponseData,
  toHeaderRecord,
} from "./http-client.ts";

export type AdminDashboard = {
  clients: number;
  users: number;
  sessions: number;
  consents: number;
};

export type AdminServerInfo = {
  issuer: string;
  discoveryEndpoint: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  introspectionEndpoint: string;
  revocationEndpoint: string;
  jwksEndpoint: string;
  userInfoEndpoint: string;
  endSessionEndpoint: string;
  sessionTimeout: string | null;
  activeSigningKey: {
    kid: string;
    type: string;
    algorithm: string;
    use: string;
    createdAt: string;
  } | null;
};

export type AdminAccessFlags = {
  isAdmin: boolean;
  queryClients: boolean;
  viewClients: boolean;
  manageClients: boolean;
  queryUsers: boolean;
  viewUsers: boolean;
  manageUsers: boolean;
  impersonateUsers: boolean;
  queryGroups: boolean;
  viewGroups: boolean;
  manageGroups: boolean;
  queryOrganizations: boolean;
  viewOrganizations: boolean;
  manageOrganizations: boolean;
  viewRoles: boolean;
  manageRoles: boolean;
  viewSessions: boolean;
  manageSessions: boolean;
  viewConsents: boolean;
  manageConsents: boolean;
  viewEvents: boolean;
  manageEvents: boolean;
  viewKeys: boolean;
  manageKeys: boolean;
};

export type AdminWhoAmI = {
  username: string;
  avatarUrl: string | null;
  authorities: string[];
  access: AdminAccessFlags;
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

export type AdminRoleUser = {
  id: number;
  username: string;
  enabled: boolean;
};

export type AdminRoleDetail = AdminRole & {
  userCount: number;
  protectedRole: boolean;
  users: AdminPage<AdminRoleUser>;
  compositeRoles: string[];
  compositeClientRoles: AdminClientRole[];
};

export type AdminClientRole = {
  id: number;
  clientId: string;
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

export type AdminGroupUser = {
  id: number;
  username: string;
  enabled: boolean;
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

export type AdminEventSettings = {
  eventsEnabled: boolean;
  adminEventsEnabled: boolean;
  adminEventsDetailsEnabled: boolean;
  eventsExpirationDays: number;
};

export type AdminLocalizationSettings = {
  internationalizationEnabled: boolean;
  defaultLocale: string;
  supportedLocales: string[];
  availableLocales: string[];
  availableBundles: string[];
};

export type AdminLocalizationSettingsRequest = Pick<
  AdminLocalizationSettings,
  "internationalizationEnabled" | "defaultLocale" | "supportedLocales"
>;

export type AdminEmailSettings = {
  enabled: boolean;
  fromAddress: string;
  baseUrl: string;
  host: string;
  port: number;
  username: string;
  passwordConfigured: boolean;
  smtpAuth: boolean;
  starttls: boolean;
  ssl: boolean;
};

export type AdminEmailSettingsRequest = Omit<
  AdminEmailSettings,
  "passwordConfigured"
> & { password: string };

export type NativeAdminLoginSettings = {
  userRegistration: boolean;
  forgotPassword: boolean;
  rememberMe: boolean;
  loginWithEmail: boolean;
  verifyEmail: boolean;
  sessionTimeoutMinutes: number;
  passwordMinimumLength: number;
  bruteForceEnabled: boolean;
  bruteForceMaxFailures: number;
  otpEnabled: boolean;
  otpRequired: boolean;
  passkeys: boolean;
};

export type AdminCibaPolicy = {
  requestLifespanSeconds: number;
  pollingIntervalSeconds: number;
  deliveryMode: "all" | "poll" | "ping" | "push";
  userVerification: "required" | "preferred" | "discouraged";
  mfaRequired: boolean;
  stepUpRequired: boolean;
  stepUpAcr: string | null;
};

export type AdminOfflineAccessPolicy = {
  idleTimeout: string;
  maxLifespan: string | null;
  maxLimited: boolean;
  revokedBefore: string | null;
};

export type AdminOfflineAccessPolicyRequest = Pick<
  AdminOfflineAccessPolicy,
  "idleTimeout" | "maxLifespan" | "maxLimited"
>;

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

export type AdminClientCreated = {
  client: AdminClient;
  clientSecret: string | null;
};

export class AdminApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly problem: ProblemDetail | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    status: number,
    message: string,
    data?: unknown,
    retryAfter?: string,
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.kind = classifyApiError(status, data);
    this.problem = parseProblemDetail(data);
    this.retryAfterMs = parseRetryAfterMs(retryAfter);
  }
}

type RequestOptions = {
  refreshAccessToken?: () => Promise<string | null>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const adminClient = createMobileApiClient(DEFAULT_NATIVE_API_TIMEOUT_MS);

async function requestAdmin<T>(
  accessToken: string,
  path: string,
  options: RequestOptions,
  init: RequestInit = {},
): Promise<T> {
  const requestSignal = createNativeRequestSignal(
    options.timeoutMs ?? DEFAULT_NATIVE_API_TIMEOUT_MS,
    options.signal,
  );
  try {
    const response = await adminClient.request<T>(
      {
        data: init.body,
        headers: toHeaderRecord(init.headers),
        method: init.method,
        signal: requestSignal.signal,
        timeout: options.timeoutMs ?? DEFAULT_NATIVE_API_TIMEOUT_MS,
        url: path,
      },
      { accessToken, refreshAccessToken: options.refreshAccessToken },
    );
    if (response.status < 200 || response.status >= 300) {
      throw new AdminApiError(
        response.status,
        "Administration request failed",
        readMobileResponseData(response.data),
        readRetryAfterHeader(response.headers),
      );
    }
    if (response.status === 204) return undefined as T;
    return readMobileResponseData(response.data) as T;
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    const cause = requestSignal.signal.aborted
      ? requestSignal.signal.reason
      : error;
    throw new AdminApiError(
      0,
      "Administration request failed",
      getMobileTransportCause(cause),
    );
  } finally {
    requestSignal.dispose();
  }
}

export function getAdminDashboard(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminDashboard>(
    accessToken,
    "/api/admin/dashboard",
    options,
  );
}

export function getAdminServerInfo(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminServerInfo>(
    accessToken,
    "/api/admin/server-info",
    options,
  );
}

export function getAdminWhoAmI(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminWhoAmI>(accessToken, "/api/admin/whoami", options);
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
  );
}

export function getAdminRoleDetail(
  accessToken: string,
  roleName: string,
  query = "",
  enabled: boolean | undefined = undefined,
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
  if (enabled !== undefined) params.set("enabled", String(enabled));
  return requestAdmin<AdminRoleDetail>(
    accessToken,
    `/api/admin/roles/${encodeURIComponent(roleName)}?${params.toString()}`,
    options,
  );
}

export function listAdminAvailableRoleUsers(
  accessToken: string,
  roleName: string,
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
  return requestAdmin<AdminPage<AdminRoleUser>>(
    accessToken,
    `/api/admin/roles/${encodeURIComponent(roleName)}/available-users?${params.toString()}`,
    options,
  );
}

export function assignAdminRoleUser(
  accessToken: string,
  roleName: string,
  userId: number,
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: "username,asc",
  });
  return jsonRequest<AdminRoleDetail>(
    accessToken,
    `/api/admin/roles/${encodeURIComponent(roleName)}/users?${params.toString()}`,
    { userId },
    options,
  );
}

export function removeAdminRoleUser(
  accessToken: string,
  roleName: string,
  userId: number,
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort: "username,asc",
  });
  return requestAdmin<AdminRoleDetail>(
    accessToken,
    `/api/admin/roles/${encodeURIComponent(roleName)}/users/${encodeURIComponent(userId)}?${params.toString()}`,
    options,
    { method: "DELETE" },
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
    { method: "DELETE" },
  );
}

export type AdminConsentQuery = Readonly<{
  query?: string;
  clientId?: string;
  username?: string;
  scope?: string;
  page?: number;
  size?: number;
}>;

export function listAdminConsents(
  accessToken: string,
  filters: AdminConsentQuery = {},
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: filters.query ?? "",
    clientId: filters.clientId ?? "",
    username: filters.username ?? "",
    scope: filters.scope ?? "",
    page: String(filters.page ?? 0),
    size: String(filters.size ?? 10),
    sort: "id.principalName,asc",
  });
  return requestAdmin<AdminPage<AdminConsent>>(
    accessToken,
    `/api/admin/consents?${params.toString()}`,
    options,
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
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "createdAt,desc",
  });
  if (active !== undefined) params.set("active", String(active));
  return requestAdmin<AdminPage<AdminKey>>(
    accessToken,
    `/api/admin/keys?${params.toString()}`,
    options,
  );
}

export function rotateAdminKey(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminKey>(
    accessToken,
    "/api/admin/keys/rotate",
    options,
    { method: "POST" },
  );
}

export function listAdminEvents(
  accessToken: string,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  const params = new URLSearchParams({
    q: query,
    action: "",
    targetType: "",
    targetId: "",
    page: String(page),
    size: String(size),
    sort: "occurredAt,desc",
  });
  return requestAdmin<AdminPage<AdminEvent>>(
    accessToken,
    `/api/admin/events?${params.toString()}`,
    options,
  );
}

export function deleteAdminEvents(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<void>(accessToken, "/api/admin/events", options, {
    method: "DELETE",
  });
}

export function getAdminEventSettings(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminEventSettings>(
    accessToken,
    "/api/admin/events/config",
    options,
  );
}

export function updateAdminEventSettings(
  accessToken: string,
  settings: AdminEventSettings,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminEventSettings>(
    accessToken,
    "/api/admin/events/config",
    options,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    },
  );
}

export function getAdminLocalizationSettings(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminLocalizationSettings>(
    accessToken,
    "/api/admin/settings/localization",
    options,
  );
}

export function updateAdminLocalizationSettings(
  accessToken: string,
  settings: AdminLocalizationSettingsRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminLocalizationSettings>(
    accessToken,
    "/api/admin/settings/localization",
    settings,
    options,
    "PUT",
  );
}

export function getAdminEmailSettings(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminEmailSettings>(
    accessToken,
    "/api/admin/settings/email",
    options,
  );
}

export function updateAdminEmailSettings(
  accessToken: string,
  settings: AdminEmailSettingsRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminEmailSettings>(
    accessToken,
    "/api/admin/settings/email",
    settings,
    options,
    "PUT",
  );
}

export function testAdminEmailConnection(
  accessToken: string,
  settings: AdminEmailSettingsRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<void>(
    accessToken,
    "/api/admin/settings/email/test",
    settings,
    options,
  );
}

export function getNativeAdminLoginSettings(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<NativeAdminLoginSettings>(
    accessToken,
    "/api/admin/settings/login/native",
    options,
  );
}

export function updateNativeAdminLoginSettings(
  accessToken: string,
  settings: NativeAdminLoginSettings,
  options: RequestOptions = {},
) {
  return requestAdmin<NativeAdminLoginSettings>(
    accessToken,
    "/api/admin/settings/login/native",
    options,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    },
  );
}

export function getAdminCibaPolicy(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminCibaPolicy>(
    accessToken,
    "/api/admin/settings/ciba-policy",
    options,
  );
}

export function updateAdminCibaPolicy(
  accessToken: string,
  policy: AdminCibaPolicy,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminCibaPolicy>(
    accessToken,
    "/api/admin/settings/ciba-policy",
    options,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    },
  );
}

export function getAdminOfflineAccessPolicy(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminOfflineAccessPolicy>(
    accessToken,
    "/api/admin/settings/offline-access",
    options,
  );
}

export function updateAdminOfflineAccessPolicy(
  accessToken: string,
  policy: AdminOfflineAccessPolicyRequest,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminOfflineAccessPolicy>(
    accessToken,
    "/api/admin/settings/offline-access",
    options,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    },
  );
}

export function revokeAllAdminOfflineAccess(
  accessToken: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminOfflineAccessPolicy>(
    accessToken,
    "/api/admin/settings/offline-access/revoke-all",
    options,
    { method: "POST" },
  );
}

export function revokeAdminConsent(
  accessToken: string,
  clientId: string,
  username: string,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminGroup>(
    accessToken,
    `/api/admin/consents/${encodeURIComponent(clientId)}/${encodeURIComponent(username)}`,
    options,
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
  return requestAdmin<T>(accessToken, path, options, {
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
  return jsonRequest<AdminUser>(
    accessToken,
    "/api/admin/users",
    request,
    options,
  );
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
  return jsonRequest<AdminClientCreated>(
    accessToken,
    "/api/admin/clients",
    request,
    options,
  );
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
    { method: "DELETE" },
  );
}

export function createAdminRole(
  accessToken: string,
  request: AdminRoleRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminRole>(
    accessToken,
    "/api/admin/roles",
    request,
    options,
  );
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
    { method: "DELETE" },
  );
}

export function createAdminGroup(
  accessToken: string,
  request: AdminGroupRequest,
  options: RequestOptions = {},
) {
  return jsonRequest<AdminGroup>(
    accessToken,
    "/api/admin/groups",
    request,
    options,
  );
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
    { method: "DELETE" },
  );
}

export function listAdminGroupUsers(
  accessToken: string,
  groupId: number,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  return listAdminGroupMembershipUsers(
    accessToken,
    groupId,
    "users",
    query,
    page,
    size,
    options,
  );
}

export function listAdminAvailableGroupUsers(
  accessToken: string,
  groupId: number,
  query = "",
  page = 0,
  size = 10,
  options: RequestOptions = {},
) {
  return listAdminGroupMembershipUsers(
    accessToken,
    groupId,
    "available-users",
    query,
    page,
    size,
    options,
  );
}

function listAdminGroupMembershipUsers(
  accessToken: string,
  groupId: number,
  collection: "users" | "available-users",
  query: string,
  page: number,
  size: number,
  options: RequestOptions,
) {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    size: String(size),
    sort: "username,asc",
  });
  return requestAdmin<AdminPage<AdminGroupUser>>(
    accessToken,
    `/api/admin/groups/${groupId}/${collection}?${params.toString()}`,
    options,
  );
}

export function addAdminGroupUser(
  accessToken: string,
  groupId: number,
  userId: number,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminGroup>(
    accessToken,
    `/api/admin/groups/${groupId}/users`,
    options,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    },
  );
}

export function removeAdminGroupUser(
  accessToken: string,
  groupId: number,
  userId: number,
  options: RequestOptions = {},
) {
  return requestAdmin<AdminGroup>(
    accessToken,
    `/api/admin/groups/${groupId}/users/${userId}`,
    options,
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
    { method: "DELETE" },
  );
}
