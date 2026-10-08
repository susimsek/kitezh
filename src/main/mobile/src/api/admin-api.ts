import { authorizationServerIssuer } from "../config.ts";

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

export class AdminApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
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
    throw new AdminApiError(0, "Administration request failed");
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
  if (!response.ok) throw new AdminApiError(response.status, "Administration request failed");
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
