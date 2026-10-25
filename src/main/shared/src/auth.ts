/**
 * OAuth callback validation shared by native clients.
 *
 * The platform adapter owns the browser transaction. This pure helper only
 * validates values returned by the adapter before a code can be exchanged.
 */
export type AuthorizationCallbackParams = {
  code?: unknown;
  state?: unknown;
  error?: unknown;
  error_description?: unknown;
};

export type ValidAuthorizationCallback = {
  code: string;
  state: string;
};

export type AuthorizationDiscovery = {
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  endSessionEndpoint?: string;
};

const NATIVE_AUTH_REDIRECTS = new Set([
  "oauth/callback",
  "admin/oauth/callback",
]);

/**
 * Validates OIDC metadata before a native client trusts its endpoints.
 * Development may use loopback HTTP; every other issuer/endpoint must use TLS.
 */
export function validateNativeAuthorizationConfig(
  issuer: string,
  clientId: string,
  redirectUri: string,
  discovery?: AuthorizationDiscovery | null,
  allowAndroidEmulatorHttp = false,
): boolean {
  try {
    const issuerUrl = new URL(issuer);
    const redirect = new URL(redirectUri);
    const localIssuer =
      issuerUrl.protocol === "http:" &&
      (["localhost", "127.0.0.1", "::1"].includes(issuerUrl.hostname) ||
        (allowAndroidEmulatorHttp && issuerUrl.hostname === "10.0.2.2"));
    const allowedProtocol = (url: URL) =>
      url.protocol === "https:" ||
      (localIssuer &&
        url.protocol === "http:" &&
        url.hostname === issuerUrl.hostname);

    if (
      !allowedProtocol(issuerUrl) ||
      !clientId.trim() ||
      redirect.protocol !== "kitezh:" ||
      !NATIVE_AUTH_REDIRECTS.has(`${redirect.hostname}${redirect.pathname}`) ||
      hasUnsafeNativeUrlAuthority(redirectUri, redirect) ||
      redirect.search ||
      redirect.hash ||
      !discovery?.issuer ||
      !discovery.authorizationEndpoint ||
      !discovery.tokenEndpoint
    ) {
      return false;
    }

    const metadataIssuer = new URL(discovery.issuer);
    const authorizationEndpoint = new URL(discovery.authorizationEndpoint);
    const tokenEndpoint = new URL(discovery.tokenEndpoint);
    const endSessionEndpoint = discovery.endSessionEndpoint
      ? new URL(discovery.endSessionEndpoint)
      : undefined;
    if (
      metadataIssuer.origin !== issuerUrl.origin ||
      metadataIssuer.pathname.replace(/\/$/, "") !==
        issuerUrl.pathname.replace(/\/$/, "") ||
      !allowedProtocol(authorizationEndpoint) ||
      !allowedProtocol(tokenEndpoint) ||
      authorizationEndpoint.origin !== issuerUrl.origin ||
      tokenEndpoint.origin !== issuerUrl.origin ||
      (endSessionEndpoint && endSessionEndpoint.origin !== issuerUrl.origin) ||
      (endSessionEndpoint && !allowedProtocol(endSessionEndpoint))
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateAuthorizationCallback(
  params: AuthorizationCallbackParams,
  expectedState: string | undefined,
): ValidAuthorizationCallback {
  if (params.error !== undefined) {
    throw new Error("authorization_callback_error");
  }
  if (typeof params.code !== "string" || params.code.length === 0) {
    throw new TypeError("authorization_callback_code_missing");
  }
  if (typeof params.state !== "string" || params.state.length === 0) {
    throw new TypeError("authorization_callback_state_missing");
  }
  if (!expectedState || params.state !== expectedState) {
    throw new Error("authorization_callback_state_mismatch");
  }
  return { code: params.code, state: params.state };
}

function hasUnsafeNativeUrlAuthority(value: string, url: URL): boolean {
  const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] ?? "";
  return (
    value.trim() !== value ||
    authority.includes("@") ||
    authority.toLowerCase() !== url.hostname.toLowerCase() ||
    Boolean(url.username || url.password || url.port) ||
    value.includes("#")
  );
}

export function isAllowedNativeRedirect(
  value: string,
  expectedRedirect: string,
): boolean {
  try {
    const actual = new URL(value);
    const expected = new URL(expectedRedirect);
    if (
      hasUnsafeNativeUrlAuthority(value, actual) ||
      hasUnsafeNativeUrlAuthority(expectedRedirect, expected) ||
      expected.search
    ) {
      return false;
    }
    return matchesNativeRedirect(actual, expected);
  } catch {
    return false;
  }
}

export type NativeDeepLink = {
  kind:
    | "oauth-callback"
    | "admin-oauth-callback"
    | "logout-callback"
    | "admin-logout-callback"
    | "verify-email"
    | "confirm-email"
    | "reset-password";
  token?: string;
};

const CALLBACK_LINK_KINDS = new Map<string, NativeDeepLink["kind"]>([
  ["oauth/callback", "oauth-callback"],
  ["admin/oauth/callback", "admin-oauth-callback"],
  ["logout/callback", "logout-callback"],
  ["admin/logout/callback", "admin-logout-callback"],
]);

const TOKEN_LINK_KINDS = new Map<
  string,
  "verify-email" | "confirm-email" | "reset-password"
>([
  ["verify-email", "verify-email"],
  ["confirm-email", "confirm-email"],
  ["reset-password", "reset-password"],
]);
const NATIVE_APP_LINK_HOST = "kitezh.onrender.com";
const UNIVERSAL_REDIRECT_PATHS = new Map([
  ["kitezh://oauth/callback", "/oauth/callback"],
  ["kitezh://admin/oauth/callback", "/admin/oauth/callback"],
  ["kitezh://logout/callback", "/logout/callback"],
  ["kitezh://admin/logout/callback", "/admin/logout/callback"],
]);

function matchesNativeRedirect(actual: URL, expected: URL): boolean {
  if (
    actual.protocol === "kitezh:" &&
    actual.protocol === expected.protocol &&
    actual.hostname === expected.hostname &&
    actual.pathname === expected.pathname
  ) {
    return true;
  }
  const universalPath = UNIVERSAL_REDIRECT_PATHS.get(expected.href);
  return (
    actual.protocol === "https:" &&
    actual.hostname === NATIVE_APP_LINK_HOST &&
    Boolean(universalPath) &&
    actual.pathname === universalPath
  );
}

export function parseNativeDeepLink(value: string): NativeDeepLink | null {
  try {
    const url = new URL(value);
    const customScheme = url.protocol === "kitezh:";
    const verifiedAppLink =
      url.protocol === "https:" && url.hostname === NATIVE_APP_LINK_HOST;
    if (
      (!customScheme && !verifiedAppLink) ||
      hasUnsafeNativeUrlAuthority(value, url)
    ) {
      return null;
    }
    const callbackKind = CALLBACK_LINK_KINDS.get(
      customScheme
        ? `${url.hostname}${url.pathname}`
        : url.pathname.replace(/^\//, ""),
    );
    if (callbackKind) return { kind: callbackKind };

    const actionRoute = customScheme
      ? url.pathname === "/"
        ? url.hostname
        : ""
      : url.pathname.replace(/^\//, "");
    const tokenKind = TOKEN_LINK_KINDS.get(actionRoute);
    if (!tokenKind) return null;
    const tokens = url.searchParams.getAll("token");
    if (tokens.length !== 1) return null;
    const token = tokens[0];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return { kind: tokenKind, token };
  } catch {
    return null;
  }
}

export function resolveNativeIntentPath(value: string): string | null {
  const deepLink = parseNativeDeepLink(value);
  if (!deepLink) return null;
  switch (deepLink.kind) {
    case "oauth-callback":
      return "/oauth/callback";
    case "admin-oauth-callback":
      return "/admin/oauth/callback";
    case "logout-callback":
      return "/logout/callback";
    case "admin-logout-callback":
      return "/admin/logout/callback";
    case "verify-email":
      return `/verify-email?token=${encodeURIComponent(deepLink.token ?? "")}`;
    case "confirm-email":
      return `/confirm-email?token=${encodeURIComponent(deepLink.token ?? "")}`;
    case "reset-password":
      return `/reset-password?token=${encodeURIComponent(deepLink.token ?? "")}`;
  }
}
