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
