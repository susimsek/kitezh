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
    if (method === "POST" && path === "/api/admin/users") return true;
    const userUpdateMatch = path.match(/^\/api\/admin\/users\/([1-9]\d*)$/);
    if (
      method === "PUT" &&
      userUpdateMatch &&
      Number.isSafeInteger(Number(userUpdateMatch[1]))
    )
      return true;
    const userEnabledMatch = path.match(
      /^\/api\/admin\/users\/([1-9]\d*)\/enabled$/,
    );
    if (
      method === "PUT" &&
      userEnabledMatch &&
      Number.isSafeInteger(Number(userEnabledMatch[1]))
    )
      return true;
    const userTotpResetMatch = path.match(
      /^\/api\/admin\/users\/([1-9]\d*)\/totp$/,
    );
    if (
      method === "DELETE" &&
      userTotpResetMatch &&
      Number.isSafeInteger(Number(userTotpResetMatch[1]))
    )
      return true;
    const userUnlockMatch = path.match(
      /^\/api\/admin\/users\/([1-9]\d*)\/unlock$/,
    );
    if (
      method === "POST" &&
      userUnlockMatch &&
      Number.isSafeInteger(Number(userUnlockMatch[1]))
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/users\/[1-9]\d*$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-1)))
    )
      return true;
    if (method === "POST" && path === "/api/admin/roles") return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/roles\/ROLE_[A-Z0-9_]{1,45}$/.test(path)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/roles\/ROLE_[A-Z0-9_]{1,45}$/.test(path)
    )
      return true;
    if (method === "POST" && path === "/api/admin/groups") return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/groups\/[1-9]\d*\/name$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-2)))
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/groups\/[1-9]\d*\/roles$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-2)))
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/groups\/[1-9]\d*$/.test(path) &&
      Number.isSafeInteger(Number(path.split("/").at(-1)))
    )
      return true;
    const groupMembershipMatch = path.match(
      /^\/api\/admin\/groups\/([1-9]\d*)\/users(?:\/([1-9]\d*))?$/,
    );
    if (
      groupMembershipMatch &&
      groupMembershipMatch
        .slice(1)
        .every((id) =>
          id === undefined ? true : Number.isSafeInteger(Number(id)),
        ) &&
      ((method === "POST" && groupMembershipMatch[2] === undefined) ||
        (method === "DELETE" && groupMembershipMatch[2] !== undefined))
    )
      return true;
    if (method === "POST" && path === "/api/admin/client-scopes") return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings$/.test(
        path,
      )
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/offline-sessions\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/native-policy$/.test(
        path,
      )
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/native-metadata$/.test(
        path,
      )
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers\/[A-Za-z0-9_-]{1,100}$/.test(
        path,
      )
    )
      return true;
    if (
      method === "POST" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers$/.test(
        path,
      )
    )
      return true;
    if (
      method === "PUT" &&
      /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/mappers\/[A-Za-z0-9_-]{1,100}$/.test(
        path,
      )
    )
      return true;
    const consentRevokeMatch = path.match(
      /^\/api\/admin\/consents\/consents\/([^/]{1,300})\/([^/]{1,300})$/,
    );
    if (method === "DELETE" && consentRevokeMatch) {
      try {
        const clientId = decodeURIComponent(consentRevokeMatch[1]);
        const username = decodeURIComponent(consentRevokeMatch[2]);
        return [clientId, username].every(
          (segment) =>
            segment.length > 0 &&
            segment.length <= 100 &&
            !segment.includes("/") &&
            !segment.includes("\\") &&
            segment !== "." &&
            segment !== "..",
        );
      } catch {
        return false;
      }
    }
    if (
      method === "PUT" &&
      /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (
      method === "PUT" &&
      (path === "/api/admin/settings/ciba-policy" ||
        path === "/api/admin/settings/offline-access" ||
        path === "/api/admin/settings/branding" ||
        path === "/api/admin/settings/localization" ||
        path === "/api/admin/settings/email" ||
        path === "/api/admin/settings/login/native")
    )
      return true;
    if (
      method === "POST" &&
      path === "/api/admin/settings/offline-access/revoke-all"
    )
      return true;
    const localizationMessageMatch = path.match(
      /^\/api\/admin\/settings\/localization\/messages\/([1-9]\d*)$/,
    );
    if (
      method === "POST" &&
      path === "/api/admin/settings/localization/messages"
    )
      return true;
    if (
      method === "PUT" &&
      localizationMessageMatch &&
      Number.isSafeInteger(Number(localizationMessageMatch[1]))
    )
      return true;
    if (
      method === "DELETE" &&
      localizationMessageMatch &&
      Number.isSafeInteger(Number(localizationMessageMatch[1]))
    )
      return true;
    if (
      method === "DELETE" &&
      /^\/api\/admin\/sessions\/[A-Za-z0-9_-]{1,100}$/.test(path)
    )
      return true;
    if (method !== "GET") return false;
    if (path === "/api/admin/dashboard") return true;
    if (
      path === "/api/admin/settings/ciba-policy" ||
      path === "/api/admin/settings/offline-access" ||
      path === "/api/admin/settings/branding" ||
      path === "/api/admin/server-info" ||
      path === "/api/admin/settings/login" ||
      path === "/api/admin/settings/email" ||
      path === "/api/admin/settings/ldap" ||
      path === "/api/admin/settings/login/native"
    )
      return true;
    if (path === "/api/admin/settings/localization") return true;
    if (
      path === "/api/admin/authentication/bindings" ||
      path === "/api/admin/authentication/execution-providers"
    )
      return true;
    try {
      const url = new URL(path, "https://desktop.invalid");
      if (
        /^\/api\/admin\/identity-providers\/[A-Za-z0-9_-]{1,100}\/native-policy$/.test(
          url.pathname,
        )
      )
        return (
          url.origin === "https://desktop.invalid" && !url.search && !url.hash
        );
      if (
        /^\/api\/admin\/clients\/[A-Za-z0-9_-]{1,100}\/native-metadata$/.test(
          url.pathname,
        )
      )
        return (
          url.origin === "https://desktop.invalid" && !url.search && !url.hash
        );
      const isUsers = url.pathname === "/api/admin/users";
      const isRoles = url.pathname === "/api/admin/roles";
      const isGroups = url.pathname === "/api/admin/groups";
      const groupMemberSearchMatch = url.pathname.match(
        /^\/api\/admin\/groups\/([1-9]\d*)\/(?:users|available-users)$/,
      );
      const isGroupMemberSearch = Boolean(
        groupMemberSearchMatch &&
        Number.isSafeInteger(Number(groupMemberSearchMatch[1])),
      );
      const isClientScopes = url.pathname === "/api/admin/client-scopes";
      const isClientScopeRoleMappings =
        /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings$/.test(
          url.pathname,
        );
      const isClientScopeRoleCandidates =
        /^\/api\/admin\/client-scopes\/[A-Za-z0-9_-]{1,100}\/role-mappings\/(?:application-roles|client-roles)$/.test(
          url.pathname,
        );
      const isClients = url.pathname === "/api/admin/clients";
      const isIdentityProviders =
        url.pathname === "/api/admin/identity-providers";
      const providerMappersMatch = url.pathname.match(
        /^\/api\/admin\/identity-providers\/([A-Za-z0-9_-]{1,100})\/mappers$/,
      );
      const isProviderMappers = Boolean(providerMappersMatch);
      const isSessions = url.pathname === "/api/admin/sessions";
      const isConsents = url.pathname === "/api/admin/consents";
      const isOfflineSessions = url.pathname === "/api/admin/offline-sessions";
      const isEvents = url.pathname === "/api/admin/events";
      const isKeys = url.pathname === "/api/admin/keys";
      const isLocalizationMessages =
        url.pathname === "/api/admin/settings/localization/messages";
      const isAuthenticationFlows =
        url.pathname === "/api/admin/authentication/flows";
      const allowedParameters = new Set([
        "q",
        "page",
        "size",
        "sort",
        ...(isLocalizationMessages ? ["locale", "bundle"] : []),
        ...(isSessions ? ["status"] : []),
        ...(isKeys ? ["active"] : []),
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
                    : isKeys
                      ? ["createdAt,asc", "createdAt,desc"]
                      : isLocalizationMessages
                        ? [
                            "locale,asc",
                            "locale,desc",
                            "messageKey,asc",
                            "messageKey,desc",
                          ]
                        : isAuthenticationFlows
                          ? ["name,asc", "name,desc"]
                          : isGroupMemberSearch
                            ? ["username,asc", "username,desc"]
                            : ["name,asc", "name,desc"];
      return (
        (isUsers ||
          isRoles ||
          isGroups ||
          isGroupMemberSearch ||
          isClientScopes ||
          isClientScopeRoleMappings ||
          isClientScopeRoleCandidates ||
          isClients ||
          isIdentityProviders ||
          isProviderMappers ||
          isSessions ||
          isConsents ||
          isOfflineSessions ||
          isEvents ||
          isKeys ||
          isLocalizationMessages ||
          isAuthenticationFlows) &&
        url.origin === "https://desktop.invalid" &&
        !url.hash &&
        [...url.searchParams.keys()].every((key) =>
          allowedParameters.has(key),
        ) &&
        (!isAuthenticationFlows || !url.searchParams.has("q")) &&
        [...allowedParameters].every(
          (key) => url.searchParams.getAll(key).length <= 1,
        ) &&
        (url.searchParams.get("q")?.length ?? 0) <= 200 &&
        (!isLocalizationMessages ||
          (/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(
            url.searchParams.get("locale") ?? "en",
          ) &&
            /^[A-Za-z0-9_-]{1,64}$/.test(
              url.searchParams.get("bundle") ?? "backend",
            ))) &&
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
                          : isKeys
                            ? "createdAt,desc"
                            : "name,asc"),
        ) &&
        ["active", "expired"].includes(
          url.searchParams.get("status") ?? "active",
        ) &&
        ["true", "false"].includes(url.searchParams.get("active") ?? "true")
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
          "Accept-Language": request.locale === "tr" ? "tr" : "en",
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
