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
  readSession: (namespace: NativeSessionNamespace) => Promise<DesktopSession | null>;
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

const ALLOWED_PATHS = [
  "/api/account",
  "/api/auth/localization/me",
  "/api/ciba/",
];

function isAllowedApiPath(path: string) {
  return ALLOWED_PATHS.some(
    (prefix) => path === prefix || path.startsWith(prefix),
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
    idToken: typeof value.id_token === "string" ? value.id_token : previous.idToken,
    refreshToken:
      typeof value.refresh_token === "string"
        ? value.refresh_token
        : previous.refreshToken,
    version: 1,
  };
}

export function createDesktopApiAdapter(options: AdapterOptions) {
  const fetcher = options.fetcher ?? fetch;
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
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
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
      if (!isAllowedApiPath(request.path) || !request.path.startsWith("/")) {
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
