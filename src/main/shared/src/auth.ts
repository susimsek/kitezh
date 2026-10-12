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

export function validateAuthorizationCallback(
  params: AuthorizationCallbackParams,
  expectedState: string | undefined,
): ValidAuthorizationCallback {
  if (typeof params.error === "string") {
    throw new Error("authorization_callback_error");
  }
  if (typeof params.code !== "string" || params.code.length === 0) {
    throw new Error("authorization_callback_code_missing");
  }
  if (typeof params.state !== "string" || params.state.length === 0) {
    throw new Error("authorization_callback_state_missing");
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

export function parseNativeDeepLink(value: string): NativeDeepLink | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "kitezh:") return null;
    if (url.hostname === "oauth" && url.pathname === "/callback") {
      return { kind: "oauth-callback" };
    }
    if (url.hostname === "admin" && url.pathname === "/oauth/callback") {
      return { kind: "admin-oauth-callback" };
    }
    if (url.hostname === "logout" && url.pathname === "/callback") {
      return { kind: "logout-callback" };
    }
    if (url.hostname === "admin" && url.pathname === "/logout/callback") {
      return { kind: "admin-logout-callback" };
    }
    if (
      (url.hostname === "verify-email" || url.hostname === "reset-password") &&
      url.pathname === "/"
    ) {
      const token = url.searchParams.get("token")?.trim();
      const kind =
        url.hostname === "verify-email" ? "verify-email" : "reset-password";
      return token ? { kind, token } : null;
    }
    return null;
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
      return "/verify-email";
    case "reset-password":
      return "/reset-password";
  }
}
