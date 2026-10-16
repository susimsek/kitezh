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

export function isAllowedNativeRedirect(
  value: string,
  expectedRedirect: string,
): boolean {
  try {
    const actual = new URL(value);
    const expected = new URL(expectedRedirect);
    return (
      actual.protocol === "kitezh:" &&
      actual.protocol === expected.protocol &&
      actual.hostname === expected.hostname &&
      actual.pathname === expected.pathname
    );
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
    | "reset-password";
  token?: string;
};

const CALLBACK_LINK_KINDS = new Map<string, NativeDeepLink["kind"]>([
  ["oauth/callback", "oauth-callback"],
  ["admin/oauth/callback", "admin-oauth-callback"],
  ["logout/callback", "logout-callback"],
  ["admin/logout/callback", "admin-logout-callback"],
]);

const TOKEN_LINK_KINDS = new Map<string, "verify-email" | "reset-password">([
  ["verify-email", "verify-email"],
  ["reset-password", "reset-password"],
]);

export function parseNativeDeepLink(value: string): NativeDeepLink | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "kitezh:") return null;
    const callbackKind = CALLBACK_LINK_KINDS.get(
      `${url.hostname}${url.pathname}`,
    );
    if (callbackKind) return { kind: callbackKind };

    const tokenKind = TOKEN_LINK_KINDS.get(url.hostname);
    if (!tokenKind || url.pathname !== "/") return null;
    const token = url.searchParams.get("token")?.trim();
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
    case "reset-password":
      return `/reset-password?token=${encodeURIComponent(deepLink.token ?? "")}`;
  }
}
