import {
  classifyApiError,
  createSingleFlight,
  type NativeApiRequest,
  type NativeApiResponse,
  type NativeSession,
  type NativeSessionNamespace,
} from "@kitezh/shared";

type DesktopSession = NativeSession & { version: 1 };

type AdapterOptions = {
  apiBaseUrl: string;
  readSession: (
    namespace: NativeSessionNamespace,
  ) => Promise<DesktopSession | null>;
  writeSession: (
    namespace: NativeSessionNamespace,
    session: DesktopSession,
  ) => Promise<void>;
  clearSession: (namespace: NativeSessionNamespace) => Promise<void>;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  id_token?: unknown;
  refresh_token?: unknown;
};

const CLIENT_IDS: Record<NativeSessionNamespace, string> = {
  account: "desktop-account-console",
  admin: "desktop-admin-console",
};

const ACCOUNT_ALLOWED_PATHS = [
  "/api/account",
  "/api/auth/localization/me",
  "/api/ciba/",
];

function isAllowedApiPath(
  namespace: NativeSessionNamespace,
  method: string,
  path: string,
) {
  if (namespace === "admin") {
    if (method !== "GET") return false;
    if (path === "/api/admin/dashboard") return true;
    try {
      const url = new URL(path, "https://desktop.invalid");
      const isUsers = url.pathname === "/api/admin/users";
      const isRoles = url.pathname === "/api/admin/roles";
      const isGroups = url.pathname === "/api/admin/groups";
      const isClientScopes = url.pathname === "/api/admin/client-scopes";
      const isClients = url.pathname === "/api/admin/clients";
      const isIdentityProviders =
        url.pathname === "/api/admin/identity-providers";
      const isSessions = url.pathname === "/api/admin/sessions";
      const isConsents = url.pathname === "/api/admin/consents";
      const isOfflineSessions = url.pathname === "/api/admin/offline-sessions";
      const isEvents = url.pathname === "/api/admin/events";
      const allowedParameters = new Set([
        "q",
        "page",
        "size",
        "sort",
        ...(isSessions ? ["status"] : []),
      ]);
      const sortFields = isUsers
        ? ["username,asc", "username,desc"]
        : isClients
          ? ["clientId,asc", "clientId,desc"]
          : isIdentityProviders
            ? ["guiOrder,asc", "guiOrder,desc"]
            : isSessions
              ? ["lastAccessTime,asc", "lastAccessTime,desc"]
              : isConsents
                ? ["id.principalName,asc", "id.principalName,desc"]
                : isOfflineSessions
                  ? ["refreshTokenIssuedAt,asc", "refreshTokenIssuedAt,desc"]
                  : isEvents
                    ? ["occurredAt,asc", "occurredAt,desc"]
                    : ["name,asc", "name,desc"];
      return (
        (isUsers ||
          isRoles ||
          isGroups ||
          isClientScopes ||
          isClients ||
          isIdentityProviders ||
          isSessions ||
          isConsents ||
          isOfflineSessions ||
          isEvents) &&
        url.origin === "https://desktop.invalid" &&
        !url.hash &&
        [...url.searchParams.keys()].every((key) =>
          allowedParameters.has(key),
        ) &&
        [...allowedParameters].every(
          (key) => url.searchParams.getAll(key).length <= 1,
        ) &&
        (url.searchParams.get("q")?.length ?? 0) <= 200 &&
        /^\d+$/.test(url.searchParams.get("page") ?? "0") &&
        Number(url.searchParams.get("page") ?? 0) <= 1_000_000 &&
        /^(?:[1-9]\d?|100)$/.test(url.searchParams.get("size") ?? "20") &&
        sortFields.includes(
          url.searchParams.get("sort") ??
            (isUsers
              ? "username,asc"
              : isClients
                ? "clientId,asc"
                : isIdentityProviders
                  ? "guiOrder,asc"
                  : isSessions
                    ? "lastAccessTime,desc"
                    : isConsents
                      ? "id.principalName,asc"
                      : isOfflineSessions
                        ? "refreshTokenIssuedAt,desc"
                        : isEvents
                          ? "occurredAt,desc"
                          : "name,asc"),
        ) &&
        ["active", "expired"].includes(
          url.searchParams.get("status") ?? "active",
        )
      );
    } catch {
      return false;
    }
  }
  return (
    namespace === "account" &&
    ACCOUNT_ALLOWED_PATHS.some(
      (prefix) => path === prefix || path.startsWith(prefix),
    )
  );
}

function parseJsonBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return Promise.resolve(null);
  return response.json().catch(() => null);
}

function tokenResponseToSession(
  value: TokenResponse,
  previous: DesktopSession,
): DesktopSession | null {
  if (
    typeof value.access_token !== "string" ||
    typeof value.expires_in !== "number" ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0
  ) {
    return null;
  }
  return {
    accessToken: value.access_token,
    expiresAt: Date.now() + value.expires_in * 1000,
    idToken:
      typeof value.id_token === "string" ? value.id_token : previous.idToken,
    refreshToken:
      typeof value.refresh_token === "string"
        ? value.refresh_token
        : previous.refreshToken,
    version: 1,
  };
}

export function createDesktopApiAdapter(options: AdapterOptions) {
  const fetcher = options.fetcher ?? ((...args) => globalThis.fetch(...args));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const refreshFlights = new Map<
    NativeSessionNamespace,
    ReturnType<typeof createSingleFlight<string | null>>
  >();

  function refreshFlight(namespace: NativeSessionNamespace) {
    let flight = refreshFlights.get(namespace);
    if (!flight) {
      flight = createSingleFlight<string | null>();
      refreshFlights.set(namespace, flight);
    }
    return flight;
  }

  async function refresh(namespace: NativeSessionNamespace) {
    return refreshFlight(namespace).run(async () => {
      const current = await options.readSession(namespace);
      if (!current?.refreshToken) {
        await options.clearSession(namespace);
        return null;
      }
      try {
        const response = await fetcher(`${options.apiBaseUrl}/oauth2/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: CLIENT_IDS[namespace],
            grant_type: "refresh_token",
            refresh_token: current.refreshToken,
          }),
        });
        if (!response.ok) throw new Error("refresh_failed");
        const next = tokenResponseToSession(
          (await response.json()) as TokenResponse,
          current,
        );
        if (!next) throw new Error("invalid_refresh_response");
        await options.writeSession(namespace, next);
        return next.accessToken;
      } catch {
        await options.clearSession(namespace);
        return null;
      }
    });
  }

  async function send(
    request: NativeApiRequest,
    accessToken: string,
  ): Promise<NativeApiResponse> {
    const method = request.method ?? "GET";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${options.apiBaseUrl}${request.path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(request.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });
      return {
        status: response.status,
        kind: response.ok ? null : classifyApiError(response.status),
        body: await parseJsonBody(response),
      };
    } catch (cause) {
      return {
        status: 0,
        kind: classifyApiError(0, cause),
        body: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async request(request: NativeApiRequest): Promise<NativeApiResponse> {
      if (
        !request.path.startsWith("/") ||
        !isAllowedApiPath(
          request.console,
          request.method ?? "GET",
          request.path,
        )
      ) {
        throw new Error("Native API path is not allowed");
      }
      const namespace = request.console;
      const current = await options.readSession(namespace);
      if (!current) {
        return { status: 401, kind: "unauthorized", body: null };
      }
      let response = await send(request, current.accessToken);
      if (response.status !== 401) return response;
      const accessToken = await refresh(namespace);
      if (!accessToken) {
        return { status: 401, kind: "unauthorized", body: null };
      }
      response = await send(request, accessToken);
      if (response.status === 401) await options.clearSession(namespace);
      return response;
    },
  };
}
