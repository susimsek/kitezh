import { authorizationServerIssuer } from "../config.ts";

export type AdminDashboard = {
  clients: number;
  users: number;
  sessions: number;
  consents: number;
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
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(adminApiUrl(path), {
      headers: {
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
      );
    }
  }
  if (!response.ok) throw new AdminApiError(response.status, "Administration request failed");
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
